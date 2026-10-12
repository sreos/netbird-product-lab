import type { Issue } from "./types";

/**
 * Wording-overlap similarity between issues: TF-IDF vectors compared with cosine similarity.
 *
 * This is lexical, not semantic. It finds issues that use the same distinctive words, which is
 * often a duplicate or a shared root cause, but it can also miss a duplicate phrased differently
 * or link two unrelated issues that share jargon. The UI says so, and never calls anything a
 * duplicate. Everything here is deterministic and dependency-free.
 */

export interface RelatedMatch {
  id: string;
  /** Cosine similarity, 0 to 1. */
  score: number;
  /** The most distinctive words the two issues share, in readable form. */
  shared: string[];
}

export interface Theme {
  /** Stable for a given set of issues: the smallest member id. */
  id: string;
  /** Readable label built from the words members share, e.g. "token · session · expire". */
  label: string;
  issueIds: string[];
}

export interface SimilarityIndex {
  related(issueId: string): RelatedMatch[];
  themes: Theme[];
  themeOf(issueId: string): Theme | undefined;
}

export interface SimilarityOptions {
  /** Minimum cosine similarity for "possibly related". */
  relatedThreshold?: number;
  /** Minimum average similarity inside a theme. */
  themeThreshold?: number;
  maxRelated?: number;
  maxThemeSize?: number;
}

/**
 * Thresholds were chosen by reading ranked pairs and clusters from real netbirdio/netbird and
 * netbirdio/dashboard issues, favouring fewer, more trustworthy links over many noisy ones.
 */
export const DEFAULTS = {
  relatedThreshold: 0.17,
  themeThreshold: 0.15,
  maxRelated: 5,
  maxThemeSize: 8,
} as const;

const STOPWORDS = new Set(
  (
    // Common English
    "a about above after again all also am an and any are as at be because been before being below between both but by can cannot could " +
    "did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me " +
    "more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there " +
    "these they this those through to too under until up very was we were what when where which while who why will with would you your " +
    // Issue-template and chatter words that carry no topic
    "describe problem reproduce reproduction expected behavior behaviour actual steps using cloud version additional context relevant " +
    "output log logs issue issues please thanks thank get got getting want like need needs able one two see seen make makes made use used uses " +
    "netbird self hosted info debug status feature request related describe solution alternatives considered " +
    // Template and paste noise that says nothing about the topic
    "file files help screenshot screenshots attach attached attachment troubleshooting code desc com src org http https www " +
    "even last know dont don stays tried applicable explain " +
    // Feature-request phrasing ("Add X", "Support for Y") would otherwise link unrelated requests
    "add allow enable support " +
    // Deployment tooling mentioned by most self-hosting reports; sharing it says nothing about the problem
    "docker compose"
  ).split(/\s+/),
);

const CODE_BLOCK = /```[\s\S]*?```/g;
const URL_RE = /https?:\/\/\S+/g;
const TITLE_WEIGHT = 3;
const BODY_WINDOW = 1500;
const MAX_TOKEN_LENGTH = 25;

/** A deliberately light stemmer: enough to unify reconnect/reconnecting/reconnected and retry/retries. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);

  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ied")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 6 && w.endsWith("ion")) w = w.slice(0, -3);

  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/**
 * Lower-cased, stemmed, stopword-free tokens. `onSurface` is told how each kept word originally
 * looked, so labels can show "expire" instead of the stem "expir".
 */
export function tokenize(text: string, onSurface?: (stemmed: string, surface: string) => void): string[] {
  const cleaned = text.replace(CODE_BLOCK, " ").replace(URL_RE, " ").toLowerCase();
  const out: string[] = [];
  for (const raw of cleaned.split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || raw.length > MAX_TOKEN_LENGTH) continue;
    if (/^\d+$/.test(raw) || STOPWORDS.has(raw)) continue;
    const s = stem(raw);
    if (s.length < 3 || STOPWORDS.has(s)) continue;
    out.push(s);
    onSurface?.(s, raw);
  }
  return out;
}

/** Collects readable surface forms per stem, so theme labels do not show chopped words. */
class SurfaceRegistry {
  private forms = new Map<string, Map<string, number>>();
  add(stemmed: string, surface: string) {
    let m = this.forms.get(stemmed);
    if (!m) this.forms.set(stemmed, (m = new Map()));
    m.set(surface, (m.get(surface) ?? 0) + 1);
  }
  readable(stemmed: string): string {
    const m = this.forms.get(stemmed);
    if (!m) return stemmed;
    // Most common form; ties go to the shorter one, then alphabetical, for determinism.
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0][0];
  }
}
type Vector = Map<string, number>;

function dot(a: Vector, b: Vector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let sum = 0;
  for (const [term, w] of small) {
    const o = large.get(term);
    if (o !== undefined) sum += w * o;
  }
  return sum;
}

export function buildSimilarity(issues: Issue[], options: SimilarityOptions = {}): SimilarityIndex {
  const cfg = { ...DEFAULTS, ...options };
  const surfaceRegistry = new SurfaceRegistry();
  const tok = (text: string) => tokenize(text, (s, surface) => surfaceRegistry.add(s, surface));

  // 1. Term frequencies (title words count more than description words).
  const titleTerms: Set<string>[] = [];
  const tfs: Map<string, number>[] = issues.map((issue) => {
    const tf = new Map<string, number>();
    const fromTitle = tok(issue.title);
    titleTerms.push(new Set(fromTitle));
    for (const t of fromTitle) tf.set(t, (tf.get(t) ?? 0) + TITLE_WEIGHT);
    for (const t of tok(issue.body.slice(0, BODY_WINDOW))) tf.set(t, (tf.get(t) ?? 0) + 1);
    return tf;
  });

  // 2. Document frequency, ignoring terms that appear almost everywhere.
  const n = issues.length;
  const df = new Map<string, number>();
  for (const tf of tfs) for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const tooCommon = (term: string) => n >= 10 && (df.get(term) ?? 0) > n * 0.5;

  // 3. L2-normalized TF-IDF vectors.
  const vectors: Vector[] = tfs.map((tf) => {
    const v: Vector = new Map();
    let norm = 0;
    for (const [term, count] of tf) {
      if (tooCommon(term)) continue;
      const idf = Math.log((n + 1) / ((df.get(term) ?? 0) + 1)) + 1;
      const w = (1 + Math.log(count)) * idf;
      v.set(term, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [term, w] of v) v.set(term, w / norm);
    return v;
  });

  // All terms two issues share, strongest contribution first.
  const sharedStems = (i: number, j: number): string[] => {
    const scored: Array<[string, number]> = [];
    for (const [term, w] of vectors[i]) {
      const o = vectors[j].get(term);
      if (o !== undefined) scored.push([term, w * o]);
    }
    return scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([term]) => term);
  };

  // 4. Pairwise similarity (n is at most a couple of hundred, so O(n^2) is fine).
  // Cosine similarity alone is not trusted: boilerplate in descriptions (template headings, pasted
  // logs) yields confident-looking but meaningless links. A pair is only linked when it shares a
  // word that appears in BOTH titles and either
  //  (a) that word is rare (e.g. "latency", "rpc"), or
  //  (b) the pair shares at least two distinctive words in total.
  const floor = Math.min(cfg.relatedThreshold, cfg.themeThreshold);
  const rareDf = Math.max(4, Math.floor(n * 0.08));
  const sim: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = dot(vectors[i], vectors[j]);
      if (s < floor) continue;
      const shared = sharedStems(i, j);
      const inBothTitles = shared.filter((t) => titleTerms[i].has(t) && titleTerms[j].has(t));
      const linked = inBothTitles.some((t) => (df.get(t) ?? n) <= rareDf) || (inBothTitles.length > 0 && shared.length >= 2);
      if (!linked) continue;
      sim[i][j] = s;
      sim[j][i] = s;
    }
  }

  const indexById = new Map(issues.map((issue, i) => [issue.id, i]));

  const related = (issueId: string): RelatedMatch[] => {
    const i = indexById.get(issueId);
    if (i === undefined) return [];
    const matches: RelatedMatch[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i || sim[i][j] < cfg.relatedThreshold) continue;
      const shared = sharedStems(i, j)
        .slice(0, 4)
        .map((t) => surfaceRegistry.readable(t));
      matches.push({ id: issues[j].id, score: sim[i][j], shared });
    }
    return matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, cfg.maxRelated);
  };

  // 5. Themes: average-link agglomerative clustering with a size cap.
  let clusters: number[][] = issues.map((_, i) => [i]);
  const avgLink = (a: number[], b: number[]) => {
    let sum = 0;
    for (const x of a) for (const y of b) sum += sim[x][y];
    return sum / (a.length * b.length);
  };
  for (;;) {
    let best = { score: cfg.themeThreshold, a: -1, b: -1 };
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        if (clusters[a].length + clusters[b].length > cfg.maxThemeSize) continue;
        const s = avgLink(clusters[a], clusters[b]);
        if (s > best.score) best = { score: s, a, b };
      }
    }
    if (best.a < 0) break;
    clusters[best.a] = [...clusters[best.a], ...clusters[best.b]];
    clusters = clusters.filter((_, idx) => idx !== best.b);
  }

  const themes: Theme[] = clusters
    .filter((c) => c.length >= 2)
    .map((members) => {
      // Label with the terms most members share, weighted by how distinctive they are.
      const weights = new Map<string, { sum: number; docs: number }>();
      for (const m of members) {
        for (const [term, w] of vectors[m]) {
          const e = weights.get(term) ?? { sum: 0, docs: 0 };
          e.sum += w;
          e.docs += 1;
          weights.set(term, e);
        }
      }
      const minDocs = Math.max(2, Math.ceil(members.length / 2));
      const top = [...weights.entries()]
        .filter(([, e]) => e.docs >= minDocs)
        .sort((a, b) => b[1].sum - a[1].sum || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([term]) => surfaceRegistry.readable(term));
      const ids = members.map((m) => issues[m].id).sort();
      return { id: ids[0], label: top.join(" · "), issueIds: ids };
    })
    // A theme with no shared words would be an arbitrary grouping; do not show it.
    .filter((t) => t.label.length > 0)
    .sort((a, b) => b.issueIds.length - a.issueIds.length || a.id.localeCompare(b.id));

  const themeByIssue = new Map<string, Theme>();
  for (const t of themes) for (const id of t.issueIds) themeByIssue.set(id, t);

  return { related, themes, themeOf: (id) => themeByIssue.get(id) };
}
