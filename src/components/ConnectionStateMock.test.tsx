import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConnectionStateMock } from "./ConnectionStateMock";

describe("ConnectionStateMock", () => {
  it("starts on the behavior described in the issue and labels itself a concept", () => {
    render(<ConnectionStateMock />);
    expect(screen.getByRole("radio", { name: /as reported/i })).toBeChecked();
    expect(screen.getByText(/concept mock/i)).toBeInTheDocument();
    expect(screen.getByText(/Peers count: 2\/5 Connected/)).toBeInTheDocument();
  });

  it("previews the sign-in-required state with a clear action and a specific peer reason", async () => {
    const user = userEvent.setup();
    render(<ConnectionStateMock />);
    await user.click(screen.getByRole("radio", { name: /sign-in required/i }));

    const win = screen.getByRole("group", { name: /concept mock of a client status window/i });
    expect(within(win).getByText("Sign in again to restore your connections")).toBeInTheDocument();
    expect(within(win).getAllByText("Waiting for sign-in").length).toBeGreaterThan(0);
    expect(screen.getByText(/Action required: run `netbird up`/)).toBeInTheDocument();
  });

  it("walks from sign-in required to restored when the action is used", async () => {
    const user = userEvent.setup();
    render(<ConnectionStateMock />);
    await user.click(screen.getByRole("radio", { name: /sign-in required/i }));
    await user.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(screen.getByRole("radio", { name: /restored/i })).toBeChecked();
  });
});
