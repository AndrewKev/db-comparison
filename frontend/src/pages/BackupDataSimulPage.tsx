import { useState } from "react";
import { oracleClient } from "../api/oracleClient";
import type { CompareTableCountsResponse } from "../models/oracle";
import styles from "./BackupDataSimulPage.module.css";

const DEFAULT_SOURCE_TABLE = "nama_table";
const DEFAULT_DATABASE_LINK = "nama_dblink";
const TABLE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_$#]{0,29}$/;
const DATABASE_LINK_PATTERN =
  /^[A-Za-z][A-Za-z0-9_$#]*(?:\.[A-Za-z][A-Za-z0-9_$#]*)*$/;

type BusyAction = "test" | "compare" | "create" | "check" | "delete" | "sync";
type ConnectionStatus = "idle" | "success" | "error";

export function BackupDataSimulPage() {
  const [connectionString, setConnectionString] = useState("");
  const [tableName, setTableName] = useState(DEFAULT_SOURCE_TABLE);
  const [databaseLink, setDatabaseLink] = useState(DEFAULT_DATABASE_LINK);
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [counts, setCounts] = useState<CompareTableCountsResponse>();
  const [backupTableName, setBackupTableName] = useState(() =>
    createDefaultBackupTableName(DEFAULT_SOURCE_TABLE),
  );
  const [backupCreated, setBackupCreated] = useState(false);
  const [backupRowCount, setBackupRowCount] = useState<number>();
  const [busyAction, setBusyAction] = useState<BusyAction>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const validateConnectionString = () => {
    if (!connectionString.trim()) {
      setError("Connection string is required.");
      return false;
    }
    return true;
  };

  const validateBackupTableName = () => {
    if (!TABLE_NAME_PATTERN.test(backupTableName.trim())) {
      setError(
        "Backup table name must be a valid Oracle identifier with a maximum of 30 characters.",
      );
      return false;
    }
    return true;
  };

  const validateTableName = () => {
    if (!TABLE_NAME_PATTERN.test(tableName.trim())) {
      setError(
        "Table name must be a valid Oracle identifier with a maximum of 30 characters.",
      );
      return false;
    }
    return true;
  };

  const validateDatabaseLink = () => {
    if (
      databaseLink.trim().length > 128 ||
      !DATABASE_LINK_PATTERN.test(databaseLink.trim())
    ) {
      setError("Database link must be a valid Oracle database link name.");
      return false;
    }
    return true;
  };

  const testConnection = async () => {
    if (!validateConnectionString()) return;
    setBusyAction("test");
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await oracleClient.testConnection(connectionString);
      setConnectionStatus("success");
      setMessage(`${response.message}.`);
    } catch (requestError) {
      setConnectionStatus("error");
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction(undefined);
    }
  };

  const compareCounts = async () => {
    if (
      !validateConnectionString() ||
      !validateTableName() ||
      !validateDatabaseLink()
    ) return;
    setBusyAction("compare");
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await oracleClient.compareTableCounts(
        connectionString,
        tableName.trim(),
        databaseLink.trim(),
      );
      const backupStatus = await oracleClient.checkTableBackup(
        connectionString,
        tableName.trim(),
        backupTableName.trim(),
      );
      setCounts(response);
      setConnectionStatus("success");
      setBackupCreated(backupStatus.exists);
      setBackupRowCount(backupStatus.exists ? backupStatus.rowCount : undefined);
      setMessage(
        backupStatus.exists
          ? `Table counts loaded. Existing backup ${backupStatus.backupTableName} was found.`
          : "Table counts loaded successfully.",
      );
    } catch (requestError) {
      setConnectionStatus("error");
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction(undefined);
    }
  };

  const createBackup = async () => {
    if (
      !validateConnectionString() ||
      !validateTableName() ||
      !validateBackupTableName()
    ) return;
    setBusyAction("create");
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await oracleClient.createTableBackup(
        connectionString,
        tableName.trim(),
        backupTableName.trim(),
      );
      setBackupTableName(response.backupTableName);
      setBackupCreated(true);
      setBackupRowCount(response.rowsCopied);
      setMessage(response.message);
    } catch (requestError) {
      setBackupCreated(false);
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction(undefined);
    }
  };

  const checkBackup = async () => {
    if (
      !validateConnectionString() ||
      !validateTableName() ||
      !validateBackupTableName()
    ) return;
    setBusyAction("check");
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await oracleClient.checkTableBackup(
        connectionString,
        tableName.trim(),
        backupTableName.trim(),
      );
      setBackupCreated(response.exists);
      setBackupRowCount(response.exists ? response.rowCount : undefined);
      if (!response.exists) {
        setError(`${response.backupTableName} does not exist.`);
        return;
      }
      setMessage(
        `${response.backupTableName} contains ${response.rowCount.toLocaleString()} rows.`,
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction(undefined);
    }
  };

  const deleteLocalData = async () => {
    if (!validateConnectionString() || !validateTableName()) return;
    if (
      !window.confirm(
        `Delete all local data from ${tableName}? The table structure will be retained.`,
      )
    ) {
      return;
    }

    setBusyAction("delete");
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await oracleClient.deleteLocalTableData(
        connectionString,
        tableName.trim(),
        backupTableName,
      );
      setCounts((current) => current && { ...current, localCount: 0 });
      setMessage(response.message);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction(undefined);
    }
  };

  const syncDataWithProduction = async () => {
    if (
      !validateConnectionString() ||
      !validateTableName() ||
      !validateDatabaseLink()
    ) return;

    setBusyAction("sync");
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await oracleClient.syncDataWithProduction(
        connectionString,
        tableName.trim(),
        databaseLink.trim(),
      );
      setCounts((current) =>
        current && { ...current, localCount: response.insertedRows },
      );
      setMessage(response.message);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction(undefined);
    }
  };

  const busy = busyAction !== undefined;
  const hasLocalData = counts !== undefined && counts.localCount !== 0;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.kicker}>Backup workspace</span>
        <h1>Backup Data Simul</h1>
        <p>
          Compare local and remote row counts before creating a local safety copy.
        </p>
      </section>

      <section className={styles.workspace} aria-label="Backup data simulation">
        <div className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.eyebrow}>Oracle database</span>
              <h2>Data source</h2>
            </div>
            <span className={`${styles.status} ${styles[connectionStatus]}`}>
              <i />
              {connectionStatus === "success"
                ? "Connected"
                : connectionStatus === "error"
                  ? "Connection failed"
                  : "Not tested"}
            </span>
          </header>

          <label className={styles.field}>
            <span>Connection string</span>
            <div className={styles.passwordInput}>
              <input
                aria-label="Backup connection string"
                type={showConnectionString ? "text" : "password"}
                autoComplete="off"
                value={connectionString}
                placeholder="User Id=...;Password=...;Data Source=host:1521/service;"
                disabled={busy}
                onChange={(event) => {
                  setConnectionString(event.target.value);
                  setConnectionStatus("idle");
                  setCounts(undefined);
                  setBackupCreated(false);
                  setBackupRowCount(undefined);
                  setError(undefined);
                  setMessage(undefined);
                }}
              />
              <button
                type="button"
                aria-label={`${showConnectionString ? "Hide" : "Show"} backup connection string`}
                onClick={() => setShowConnectionString((current) => !current)}
              >
                {showConnectionString ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className={styles.objectDetails}>
            <div>
              <label className={styles.field}>
                <span>Table</span>
                <input
                  aria-label="Table name"
                  value={tableName}
                  maxLength={30}
                  disabled={busy}
                  onChange={(event) => {
                    const nextTableName = event.target.value.toUpperCase();
                    setTableName(nextTableName);
                    setBackupTableName(createDefaultBackupTableName(nextTableName));
                    setCounts(undefined);
                    setBackupCreated(false);
                    setBackupRowCount(undefined);
                    setError(undefined);
                    setMessage(undefined);
                  }}
                />
              </label>
            </div>
            <div>
              <label className={styles.field}>
                <span>Database link</span>
                <input
                  aria-label="Database link"
                  value={databaseLink}
                  maxLength={128}
                  disabled={busy}
                  onChange={(event) => {
                    setDatabaseLink(event.target.value.toUpperCase());
                    setCounts(undefined);
                    setBackupCreated(false);
                    setBackupRowCount(undefined);
                    setError(undefined);
                    setMessage(undefined);
                  }}
                />
              </label>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => void testConnection()}
            >
              {busyAction === "test" && <Spinner />}
              Test Connection
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void compareCounts()}
            >
              {busyAction === "compare" && <Spinner />}
              Compare Data Count
            </button>
          </div>

          <details className={styles.queryPreview}>
            <summary>View comparison query</summary>
            <pre>{`SELECT
    (SELECT COUNT(*) FROM ${tableName || "NAMA_TABLE"}) AS COUNT_LOKAL,
    (SELECT COUNT(*) FROM ${tableName || "NAMA_TABLE"}@${databaseLink || "DATABASE_LINK"}) AS COUNT_${databaseLink}
FROM DUAL;`}</pre>
          </details>
        </div>

        {counts && (
          <section className={styles.resultPanel} aria-label="Table count results">
            <header className={styles.resultHeader}>
              <div>
                <span className={styles.eyebrow}>Comparison result</span>
                <h2>Row counts</h2>
              </div>
              <span
                className={`${styles.comparisonBadge} ${
                  counts.localCount === counts.remoteCount ? styles.match : styles.different
                }`}
              >
                {counts.localCount === counts.remoteCount ? "Counts match" : "Counts differ"}
              </span>
            </header>

            <div className={styles.countGrid}>
              <div>
                <span>COUNT_LOKAL</span>
                <strong>{counts.localCount.toLocaleString()}</strong>
                <small>{counts.tableName}</small>
              </div>
              <div>
                <span>COUNT_{databaseLink}</span>
                <strong>{counts.remoteCount.toLocaleString()}</strong>
                <small>@{counts.databaseLink}</small>
              </div>
            </div>

            {hasLocalData ? (
              <div className={styles.backupWorkflow}>
                <label className={styles.field}>
                  <span>
                    Create table backup
                    <small>{backupTableName.length}/30</small>
                  </span>
                  <input
                    aria-label="Create table backup"
                    value={backupTableName}
                    maxLength={30}
                    disabled={busy || backupCreated}
                    onChange={(event) => {
                      setBackupTableName(event.target.value.toUpperCase());
                      setError(undefined);
                    }}
                  />
                </label>

                {!backupCreated ? (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => void createBackup()}
                  >
                    {busyAction === "create" && <Spinner />}
                    Create &amp; Insert Backup
                  </button>
                ) : (
                  <div className={styles.successActions}>
                    <div className={styles.backupSummary}>
                      <span>Backup rows</span>
                      <strong>{backupRowCount?.toLocaleString() ?? "—"}</strong>
                    </div>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={busy}
                      onClick={() => void checkBackup()}
                    >
                      {busyAction === "check" && <Spinner />}
                      Check Isi Data
                    </button>
                    <button
                      type="button"
                      className={styles.danger}
                      disabled={busy}
                      onClick={() => void deleteLocalData()}
                    >
                      {busyAction === "delete" && <Spinner />}
                      Delete Data Table Lokal
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.emptyNotice}>
                <p>COUNT_LOKAL is 0. There is no local data to back up.</p>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => void syncDataWithProduction()}
                >
                  {busyAction === "sync" && <Spinner />}
                  Sync data dengan production
                </button>
              </div>
            )}
          </section>
        )}

        {message && <div className={styles.successMessage}>{message}</div>}
        {error && (
          <div className={styles.errorMessage} role="alert">
            <strong>Request failed</strong>
            <span>{error}</span>
          </div>
        )}
      </section>
    </main>
  );
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function createDefaultBackupTableName(sourceTableName: string) {
  return `${sourceTableName}_BU_LPP_SIM`.slice(0, 30);
}
