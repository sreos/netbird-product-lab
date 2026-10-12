import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ContrastExplorer } from "./ContrastExplorer";

const verdicts = () => within(screen.getByRole("list", { name: /WCAG 2.2 AA results/ }));
const ratio = () => screen.getByText(/^\d+\.\d\d:1$/);

describe("ContrastExplorer", () => {
  it("starts on mid gray on near-black: a ratio that fails for normal text but passes for large text", () => {
    render(<ContrastExplorer />);
    // #767676 on #121212 is about 4.1:1
    expect(parseFloat(ratio().textContent!)).toBeGreaterThan(4);
    expect(parseFloat(ratio().textContent!)).toBeLessThan(4.5);
    expect(verdicts().getByText(/Normal text/).closest("li")).toHaveTextContent("Fails");
    expect(verdicts().getByText(/Large text and UI parts/).closest("li")).toHaveTextContent("Passes");
  });

  it("pairs every result with an icon and a word, never color alone", () => {
    render(<ContrastExplorer />);
    const items = verdicts().getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/✕ Fails|Fails/);
    expect(items[1]).toHaveTextContent(/Passes/);
  });

  it("recalculates when a preset is chosen", async () => {
    const user = userEvent.setup();
    render(<ContrastExplorer />);
    await user.click(screen.getByRole("button", { name: "Lighter gray on near-black" }));
    expect(parseFloat(ratio().textContent!)).toBeGreaterThan(4.5);
    expect(verdicts().getByText(/Normal text/).closest("li")).toHaveTextContent("Passes");
    expect(screen.getByRole("button", { name: "Lighter gray on near-black" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "The same mid gray on white" }));
    // #767676 on white is the classic 4.54:1 pass
    expect(ratio()).toHaveTextContent("4.54:1");
    expect(verdicts().getByText(/Normal text/).closest("li")).toHaveTextContent("Passes");
  });

  it("recalculates from the sliders and applies the colors to the sample", () => {
    render(<ContrastExplorer />);
    fireEvent.change(screen.getByLabelText(/Text gray level/), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(/Background gray level/), { target: { value: "255" } });
    expect(ratio()).toHaveTextContent("21.00:1");
    const sample = screen.getByTestId("contrast-sample");
    expect(sample.querySelector("rect")).toHaveAttribute("fill", "#ffffff");
    for (const text of sample.querySelectorAll("text")) expect(text).toHaveAttribute("fill", "#000000");
  });

  it("presents the specimen as an image, since it deliberately shows poor contrast", () => {
    render(<ContrastExplorer />);
    expect(screen.getByRole("img", { name: /Specimen/ })).toBeInTheDocument();
  });

  it("is honest that the colors are illustrative and nothing real was measured", () => {
    render(<ContrastExplorer />);
    expect(screen.getByText(/illustrative/i)).toBeInTheDocument();
    expect(screen.getByText(/not measured/i)).toBeInTheDocument();
  });
});
