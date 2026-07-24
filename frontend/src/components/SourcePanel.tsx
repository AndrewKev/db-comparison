import { useMemo, useState } from "react";
import type { OracleSourceState } from "../models/oracle";
import {
  hasValidationErrors,
  validateSource,
  type SourceValidationErrors,
} from "../utils/validation";
import { ScriptEditor } from "./ScriptEditor";
import styles from "./SourcePanel.module.css";

interface SourcePanelProps {
  label: "Source A" | "Source B";
  accent: "teal" | "amber";
  source: OracleSourceState;
  onChange: (patch: Partial<OracleSourceState>) => void;
  onTest: () => void;
  onLoad: () => void;
  onClear: () => void;
  onNormalize: () => void;
  onCopy: () => void;
}

export function SourcePanel({
  label,
  accent,
  source,
  onChange,
  onTest,
  onLoad,
  onClear,
  onNormalize,
  onCopy,
}: SourcePanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const errors = useMemo(() => validateSource(source), [source]);
  const visibleErrors: SourceValidationErrors = touched ? errors : {};
  const busy = source.loading || source.connectionStatus === "testing";

  const submit = (action: "test" | "load") => {
    setTouched(true);
    const relevantErrors =
      action === "test"
        ? Boolean(errors.connectionString)
        : hasValidationErrors(errors);
    if (relevantErrors) return;
    if (action === "test") onTest();
    else onLoad();
  };

  const clear = () => {
    if (
      (source.connectionString || source.schemaName || source.viewName || source.script) &&
      !window.confirm(`Clear all ${label} inputs and results?`)
    ) {
      return;
    }
    setTouched(false);
    onClear();
  };

  const statusLabel = {
    idle: "Not tested",
    testing: "Testing",
    success: "Connected",
    error: "Connection failed",
  }[source.connectionStatus];

  return (
    <article className={`${styles.panel} ${styles[accent]}`} aria-label={label}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Oracle database</span>
          <h2>{label}</h2>
        </div>
        <span
          className={`${styles.status} ${styles[source.connectionStatus] ?? ""}`}
          aria-label={`${label} status: ${statusLabel}`}
        >
          <i />
          {statusLabel}
        </span>
      </header>

      <div className={styles.form}>
        <label className={styles.full}>
          <span>Connection string</span>
          <div className={styles.passwordInput}>
            <input
              aria-label={`${label} connection string`}
              type={showPassword ? "text" : "password"}
              autoComplete="off"
              value={source.connectionString}
              placeholder="User Id=...;Password=...;Data Source=host:1521/service;"
              onChange={(event) =>
                onChange({
                  connectionString: event.target.value,
                  connectionStatus: "idle",
                  error: undefined,
                })
              }
              disabled={busy}
            />
            <button
              type="button"
              aria-label={`${showPassword ? "Hide" : "Show"} ${label} connection string`}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {visibleErrors.connectionString && (
            <small role="alert">{visibleErrors.connectionString}</small>
          )}
        </label>

        <label>
          <span>Schema name</span>
          <input
            aria-label={`${label} schema name`}
            value={source.schemaName}
            placeholder="MY_SCHEMA"
            onChange={(event) =>
              onChange({ schemaName: event.target.value, error: undefined })
            }
            disabled={busy}
          />
          {visibleErrors.schemaName && (
            <small role="alert">{visibleErrors.schemaName}</small>
          )}
        </label>

        <label>
          <span>View name</span>
          <input
            aria-label={`${label} view name`}
            value={source.viewName}
            placeholder="MY_VIEW"
            onChange={(event) =>
              onChange({ viewName: event.target.value, error: undefined })
            }
            disabled={busy}
          />
          {visibleErrors.viewName && <small role="alert">{visibleErrors.viewName}</small>}
        </label>

      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => submit("test")}
        >
          {source.connectionStatus === "testing" ? <Spinner /> : null}
          Test Connection
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => submit("load")}
        >
          {source.loading ? <Spinner /> : null}
          Load View Script
        </button>
        <button type="button" className={styles.ghost} disabled={busy} onClick={clear}>
          Clear
        </button>
      </div>

      <div className={styles.metrics}>
        <div>
          <span>Object type</span>
          <strong>VIEW</strong>
        </div>
        <div>
          <span>Metadata time</span>
          <strong>
            {source.executionTimeMs === undefined ? "—" : `${source.executionTimeMs} ms`}
          </strong>
        </div>
        <div>
          <span>Script length</span>
          <strong>{source.script ? `${source.script.length.toLocaleString()} chars` : "—"}</strong>
        </div>
      </div>

      {source.error && (
        <div className={styles.error} role="alert">
          <strong>Request failed</strong>
          <span>{source.error}</span>
        </div>
      )}

      <ScriptEditor
        value={source.script}
        label={`${label} view script`}
        onNormalize={onNormalize}
        onCopy={onCopy}
      />
    </article>
  );
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}
