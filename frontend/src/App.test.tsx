import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App routing", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("redirects the root path to view-comparison", async () => {
    window.history.replaceState(null, "", "/");
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/view-comparison");
    });
    expect(
      screen.getByRole("link", { name: "View Comparison" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("switches between pages through the navigation tabs", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/view-comparison");
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Backup Data Simul" }));

    expect(window.location.pathname).toBe("/backup-data-simul");
    expect(
      screen.getByRole("heading", { name: "Backup Data Simul" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Backup Data Simul" }),
    ).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("link", { name: "View Comparison" }));

    expect(window.location.pathname).toBe("/view-comparison");
    expect(
      screen.getByRole("heading", {
        name: "Compare database views with absolute clarity.",
      }),
    ).toBeInTheDocument();
  });
});
