import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackupDataSimulPage } from "./BackupDataSimulPage";

describe("BackupDataSimulPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("compares counts, creates a backup, checks it, and deletes local rows", async () => {
    const user = userEvent.setup();
    let backupExists = false;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/compare-table-counts")) {
          return jsonResponse({
            success: true,
            tableName: "M_CUSTOM_TABLE",
            databaseLink: "REMOTE_LINK.DOMAIN",
            localCount: 12,
            remoteCount: 10,
          });
        }
        if (url.endsWith("/create-table-backup")) {
          backupExists = true;
          return jsonResponse({
            success: true,
            backupTableName: "M_CUSTOM_TABLE_BU_LPP_SIM",
            rowsCopied: 12,
            message: "Backup table created.",
          });
        }
        if (url.endsWith("/check-table-backup")) {
          return jsonResponse({
            success: true,
            backupTableName: "M_CUSTOM_TABLE_BU_LPP_SIM",
            exists: backupExists,
            rowCount: backupExists ? 12 : 0,
          });
        }
        if (url.endsWith("/delete-local-table-data")) {
          return jsonResponse({
            success: true,
            tableName: "M_CUSTOM_TABLE",
            deletedRows: 12,
            message: "Deleted 12 rows from M_CUSTOM_TABLE.",
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );

    render(<BackupDataSimulPage />);
    await user.type(
      screen.getByLabelText("Backup connection string"),
      "Data Source=LOCAL;",
    );
    await user.clear(screen.getByLabelText("Table name"));
    await user.type(screen.getByLabelText("Table name"), "M_CUSTOM_TABLE");
    await user.clear(screen.getByLabelText("Database link"));
    await user.type(screen.getByLabelText("Database link"), "REMOTE_LINK.DOMAIN");
    await user.click(screen.getByRole("button", { name: "Compare Data Count" }));

    expect(await screen.findByText("Counts differ")).toBeInTheDocument();
    expect(screen.getByLabelText("Create table backup")).toHaveValue(
      "M_CUSTOM_TABLE_BU_LPP_SIM",
    );

    await user.click(
      screen.getByRole("button", { name: "Create & Insert Backup" }),
    );

    expect(
      await screen.findByRole("button", { name: "Check Isi Data" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Data Table Lokal" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check Isi Data" }));
    expect(
      await screen.findByText(
        "M_CUSTOM_TABLE_BU_LPP_SIM contains 12 rows.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Delete Data Table Lokal" }),
    );
    expect(confirm).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("Deleted 12 rows from M_CUSTOM_TABLE."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1]?.body as string),
    ).toMatchObject({
      tableName: "M_CUSTOM_TABLE",
      databaseLink: "REMOTE_LINK.DOMAIN",
    });
  });

  it("detects an existing backup during the first count comparison", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/compare-table-counts")) {
        return jsonResponse({
          success: true,
          tableName: "NAMA_TABLE",
          databaseLink: "HODB_ASLI",
          localCount: 8,
          remoteCount: 8,
        });
      }
      if (url.endsWith("/check-table-backup")) {
        return jsonResponse({
          success: true,
          backupTableName: "NAMA_TABLE_BU_LPP_SIM",
          exists: true,
          rowCount: 8,
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<BackupDataSimulPage />);
    await user.type(
      screen.getByLabelText("Backup connection string"),
      "Data Source=LOCAL;",
    );
    await user.click(screen.getByRole("button", { name: "Compare Data Count" }));

    expect(
      await screen.findByText(
        "Table counts loaded. Existing backup NAMA_TABLE_BU_LPP_SIM was found.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("8", { selector: "strong" })).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Check Isi Data" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create & Insert Backup" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a backup when the local table is empty", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/compare-table-counts")) {
        return jsonResponse({
          success: true,
          tableName: "NAMA_TABLE",
          databaseLink: "NAMA_DBLINK",
          localCount: 0,
          remoteCount: 5,
        });
      }
      if (url.endsWith("/check-table-backup")) {
        return jsonResponse({
          success: true,
          backupTableName: "NAMA_TABLE_BU_LPP_SIM",
          exists: false,
          rowCount: 0,
        });
      }
      if (url.endsWith("/sync-data-with-production")) {
        return jsonResponse({
          success: true,
          tableName: "NAMA_TABLE",
          databaseLink: "NAMA_DBLINK",
          insertedRows: 5,
          message: "Inserted 5 rows into NAMA_TABLE from NAMA_DBLINK.",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<BackupDataSimulPage />);
    await user.type(
      screen.getByLabelText("Backup connection string"),
      "Data Source=LOCAL;",
    );
    await user.click(screen.getByRole("button", { name: "Compare Data Count" }));

    expect(
      await screen.findByText("COUNT_LOKAL is 0. There is no local data to back up."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Create table backup")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Sync data dengan production" }),
    );
    expect(
      await screen.findByText("Inserted 5 rows into NAMA_TABLE from NAMA_DBLINK."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sync data dengan production" }),
    ).not.toBeInTheDocument();
  });

  it("requires a connection string before sending a request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<BackupDataSimulPage />);

    await user.click(screen.getByRole("button", { name: "Compare Data Count" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Connection string is required.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
