import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComparisonPage } from "./ComparisonPage";

describe("ComparisonPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps Compare disabled until both results exist", () => {
    render(<ComparisonPage />);
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
  });

  it("enables Compare and renders the diff after both sources load", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          success: true,
          executionTimeMs: 12,
          schemaName: "MY_SCHEMA",
          viewName: "MY_VIEW",
          script: "CREATE OR REPLACE VIEW MY_VIEW AS SELECT 1 AS ID FROM DUAL",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<ComparisonPage />);

    await user.type(screen.getByLabelText("Source A connection string"), "Data Source=A;");
    await user.type(screen.getByLabelText("Source A schema name"), "SCHEMA_A");
    await user.type(screen.getByLabelText("Source A view name"), "VIEW_A");
    await user.type(screen.getByLabelText("Source B connection string"), "Data Source=B;");
    await user.type(screen.getByLabelText("Source B schema name"), "SCHEMA_B");
    await user.type(screen.getByLabelText("Source B view name"), "VIEW_B");

    const loadButtons = screen.getAllByRole("button", { name: "Load View Script" });
    await user.click(loadButtons[0]);
    await waitFor(() => expect(loadButtons[0]).not.toBeDisabled());
    await user.click(loadButtons[1]);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Compare" })).toBeEnabled(),
    );
    expect(await screen.findByTestId("monaco-diff")).toBeInTheDocument();
  });

  it("renders a friendly API error", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network"));
    render(<ComparisonPage />);

    await user.type(
      screen.getByLabelText("Source A connection string"),
      "User Id=user;Password=secret;Data Source=db:1521/test;",
    );
    await user.click(screen.getAllByRole("button", { name: "Test Connection" })[0]);

    expect(
      (
        await screen.findAllByText(
          "Backend cannot be reached. Verify that the API is running.",
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it("swaps Source A and Source B form values", async () => {
    const user = userEvent.setup();
    render(<ComparisonPage />);

    await user.type(screen.getByLabelText("Source A schema name"), "SCHEMA_A");
    await user.type(screen.getByLabelText("Source A view name"), "VIEW_A");
    await user.type(screen.getByLabelText("Source B schema name"), "SCHEMA_B");
    await user.type(screen.getByLabelText("Source B view name"), "VIEW_B");

    await user.click(screen.getByRole("button", { name: "Swap Sources" }));

    expect(screen.getByLabelText("Source A schema name")).toHaveValue("SCHEMA_B");
    expect(screen.getByLabelText("Source A view name")).toHaveValue("VIEW_B");
    expect(screen.getByLabelText("Source B schema name")).toHaveValue("SCHEMA_A");
    expect(screen.getByLabelText("Source B view name")).toHaveValue("VIEW_A");
  });

  it("shows validation messages before a load request", async () => {
    const user = userEvent.setup();
    render(<ComparisonPage />);
    const sourceSection = screen.getByRole("article", { name: "Source A" });
    await user.click(
      within(sourceSection).getByRole("button", { name: "Load View Script" }),
    );
    expect(screen.getAllByText("Connection string is required.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Schema name is required.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("View name is required.").length).toBeGreaterThan(0);
  });
});
