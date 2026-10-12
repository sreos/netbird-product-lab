import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlainText } from "./PlainText";

describe("PlainText", () => {
  it("renders hostile HTML as inert text, never as elements", () => {
    const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script> [click](javascript:alert(3))';
    const { container } = render(<PlainText text={hostile} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe(hostile);
  });

  it("supports only bold and inline code", () => {
    const { container } = render(<PlainText text={"**Describe the problem**\nrun `netbird up` now"} />);
    expect(container.querySelector("strong")?.textContent).toBe("Describe the problem");
    expect(container.querySelector("code")?.textContent).toBe("netbird up");
    expect(container.textContent).not.toContain("**");
  });
});
