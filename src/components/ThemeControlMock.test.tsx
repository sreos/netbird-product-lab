import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { judgeContrast } from "@/lib/contrast";
import { PREVIEW_THEMES, ThemeControlMock } from "./ThemeControlMock";

const preview = () => screen.getByTestId("theme-preview");
const radio = (name: RegExp) => screen.getByRole("radio", { name });

describe("the preview themes practise what the case study preaches", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`${mode}: every text and button pairing meets WCAG AA`, () => {
      const t = PREVIEW_THEMES[mode];
      const check = (fg: string, bg: string) => judgeContrast(fg, bg)!;
      expect(check(t.text, t.bg).normalText).toBe(true);
      expect(check(t.muted, t.bg).normalText).toBe(true);
      expect(check(t.text, t.surface).normalText).toBe(true);
      expect(check(t.muted, t.surface).normalText).toBe(true);
      expect(check(t.accentText, t.accent).normalText).toBe(true);
    });
  }
});

describe("ThemeControlMock", () => {
  it("starts on the behavior in the report: Light and System shown but disabled, no explanation", () => {
    render(<ThemeControlMock />);
    expect(radio(/^Light$/)).toBeDisabled();
    expect(radio(/^System$/)).toBeDisabled();
    expect(radio(/^Dark$/)).toBeChecked();
    expect(preview()).toHaveAttribute("data-mode", "dark");
    expect(screen.queryByText(/not available yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Concept mock/i)).toBeInTheDocument();
  });

  it("the interim version says so and points at where progress is tracked", async () => {
    const user = userEvent.setup();
    render(<ThemeControlMock />);
    await user.click(screen.getByRole("radio", { name: /Interim/ }));
    expect(screen.getByText(/Light and System are not available yet/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /follow progress on github/i });
    expect(link).toHaveAttribute("href", "https://github.com/netbirdio/dashboard/pull/658");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(radio(/^Light$/)).toBeDisabled();
  });

  it("the proposed version enables every option and changes the preview", async () => {
    const user = userEvent.setup();
    render(<ThemeControlMock />);
    await user.click(screen.getByRole("radio", { name: /Proposed/ }));
    expect(radio(/^Light$/)).toBeEnabled();
    expect(radio(/^Dark$/)).toBeEnabled();

    await user.click(radio(/^Light$/));
    expect(preview()).toHaveAttribute("data-mode", "light");
    expect(preview()).toHaveStyle({ backgroundColor: PREVIEW_THEMES.light.bg });
    expect(screen.getAllByRole("status").some((el) => /Theme set to light/.test(el.textContent ?? ""))).toBe(true);

    await user.click(radio(/^Dark$/));
    expect(preview()).toHaveAttribute("data-mode", "dark");
  });

  it("System follows the device, and updates when the device setting changes", async () => {
    const user = userEvent.setup();
    render(<ThemeControlMock />);
    await user.click(screen.getByRole("radio", { name: /Proposed/ }));

    await user.click(radio(/^System/));
    expect(preview()).toHaveAttribute("data-mode", "dark"); // device pretends to be dark
    expect(radio(/^System/)).toHaveAccessibleName(/device: dark/);

    await user.click(screen.getByLabelText(/Pretend my device is set to light mode/));
    expect(preview()).toHaveAttribute("data-mode", "light"); // changed without choosing again
    expect(radio(/^System/)).toHaveAccessibleName(/device: light/);

    // An explicit choice ignores the device.
    await user.click(radio(/^Dark$/));
    expect(preview()).toHaveAttribute("data-mode", "dark");
  });

  it("forgets a proposed selection when going back to the as-reported version", async () => {
    const user = userEvent.setup();
    render(<ThemeControlMock />);
    await user.click(screen.getByRole("radio", { name: /Proposed/ }));
    await user.click(radio(/^Light$/));
    await user.click(screen.getByRole("radio", { name: /As reported/ }));
    expect(preview()).toHaveAttribute("data-mode", "dark");
    expect(radio(/^Light$/)).toBeDisabled();
  });

  it("explains each version in a design-rationale list", async () => {
    const user = userEvent.setup();
    render(<ThemeControlMock />);
    const rationale = () => screen.getByRole("heading", { name: "Design rationale" }).parentElement!;
    expect(within(rationale()).getByText(/visible but disabled/i)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Proposed/ }));
    expect(within(rationale()).getByText(/flash the wrong theme/i)).toBeInTheDocument();
  });
});
