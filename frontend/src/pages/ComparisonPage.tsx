import { useCallback, useEffect, useState } from "react";
import { oracleClient } from "../api/oracleClient";
import { ComparisonPanel } from "../components/ComparisonPanel";
import { SourcePanel } from "../components/SourcePanel";
import { Toast, type ToastMessage } from "../components/Toast";
import {
  createEmptySource,
  type OracleSourceState,
} from "../models/oracle";
import styles from "./ComparisonPage.module.css";

type SourceKey = "A" | "B";

export function ComparisonPage() {
  const [sources, setSources] = useState<Record<SourceKey, OracleSourceState>>({
    A: createEmptySource(),
    B: createEmptySource(),
  });
  const [comparisonVisible, setComparisonVisible] = useState(false);
  const [toast, setToast] = useState<ToastMessage>();

  useEffect(() => {
    if (sources.A.script && sources.B.script) {
      setComparisonVisible(true);
    }
  }, [sources.A.script, sources.B.script]);

  const notify = useCallback((type: ToastMessage["type"], text: string) => {
    setToast({ id: Date.now(), type, text });
  }, []);

  const updateSource = (
    key: SourceKey,
    patch:
      | Partial<OracleSourceState>
      | ((source: OracleSourceState) => Partial<OracleSourceState>),
  ) => {
    setSources((current) => {
      const source = current[key];
      const resolved = typeof patch === "function" ? patch(source) : patch;
      return { ...current, [key]: { ...source, ...resolved } };
    });
  };

  const testConnection = async (key: SourceKey) => {
    const source = sources[key];
    updateSource(key, {
      connectionStatus: "testing",
      error: undefined,
    });
    try {
      const response = await oracleClient.testConnection(source.connectionString);
      updateSource(key, { connectionStatus: "success" });
      notify("success", `${sourceLabel(key)}: ${response.message}.`);
    } catch (error) {
      const message = getErrorMessage(error);
      updateSource(key, { connectionStatus: "error", error: message });
      notify("error", `${sourceLabel(key)}: ${message}`);
    }
  };

  const loadViewScript = async (key: SourceKey) => {
    const source = sources[key];
    updateSource(key, {
      loading: true,
      error: undefined,
    });
    try {
      const response = await oracleClient.loadViewScript({
        connectionString: source.connectionString,
        schemaName: source.schemaName,
        viewName: source.viewName,
      });
      updateSource(key, {
        loading: false,
        connectionStatus: "success",
        executionTimeMs: response.executionTimeMs,
        schemaName: response.schemaName,
        viewName: response.viewName,
        script: response.script,
      });
      notify(
        "success",
        `${sourceLabel(key)} loaded ${response.schemaName}.${response.viewName}.`,
      );
    } catch (error) {
      const message = getErrorMessage(error);
      updateSource(key, {
        loading: false,
        error: message,
      });
      notify("error", `${sourceLabel(key)}: ${message}`);
    }
  };

  const clearSource = (key: SourceKey) => {
    setSources((current) => ({ ...current, [key]: createEmptySource() }));
    setComparisonVisible(false);
  };

  const normalizeSource = (key: SourceKey) => {
    const script = normalizeSql(sources[key].script);
    updateSource(key, { script });
    notify("success", `${sourceLabel(key)} SQL normalized.`);
  };

  const copySource = async (key: SourceKey) => {
    try {
      await navigator.clipboard.writeText(sources[key].script);
      notify("success", `${sourceLabel(key)} SQL copied.`);
    } catch {
      notify("error", "Clipboard access is unavailable in this browser.");
    }
  };

  const swapSources = () => {
    setSources((current) => ({ A: current.B, B: current.A }));
    notify("success", "Source A and Source B were swapped.");
  };

  return (
    <>
      <Toast toast={toast} onDismiss={() => setToast(undefined)} />
      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="Oracle Lens home">
          <span className={styles.mark}>OL</span>
          <span>
            <strong>Oracle Lens</strong>
            <small>Database comparison workspace</small>
          </span>
        </a>
        <div className={styles.security}>
          <span aria-hidden="true">◇</span>
          Session-only credentials
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <span className={styles.kicker}>Oracle 11g compatible</span>
          <h1>Compare database views<br />with absolute clarity.</h1>
          <p>
            Connect two Oracle sources, retrieve view DDL, and inspect normalized SQL
            differences without retaining credentials.
          </p>
          <div className={styles.heroFacts}>
            <span><i /> Strict identifier validation</span>
            <span><i /> DBMS_METADATA.GET_DDL</span>
            <span><i /> No browser storage</span>
          </div>
        </section>

        <div className={styles.content}>
          <div className={styles.sectionHeading}>
            <span>01 / Database sources</span>
            <p>Load each view definition independently using schema and view names.</p>
          </div>

          <section className={styles.sources} aria-label="Database sources">
            <SourcePanel
              label="Source A"
              accent="teal"
              source={sources.A}
              onChange={(patch) => updateSource("A", patch)}
              onTest={() => void testConnection("A")}
              onLoad={() => void loadViewScript("A")}
              onClear={() => clearSource("A")}
              onNormalize={() => normalizeSource("A")}
              onCopy={() => void copySource("A")}
            />
            <SourcePanel
              label="Source B"
              accent="amber"
              source={sources.B}
              onChange={(patch) => updateSource("B", patch)}
              onTest={() => void testConnection("B")}
              onLoad={() => void loadViewScript("B")}
              onClear={() => clearSource("B")}
              onNormalize={() => normalizeSource("B")}
              onCopy={() => void copySource("B")}
            />
          </section>

          <ComparisonPanel
            sourceA={sources.A.script}
            sourceB={sources.B.script}
            visible={comparisonVisible}
            onSourceAChange={(script) => updateSource("A", { script })}
            onSourceBChange={(script) => updateSource("B", { script })}
            onCompare={() => setComparisonVisible(true)}
            onSwap={swapSources}
            onClear={() => setComparisonVisible(false)}
          />
        </div>
      </main>

      <footer className={styles.footer}>
        <span>Oracle Lens</span>
        <p>Connection strings exist only in memory for the current page session.</p>
      </footer>
    </>
  );
}

function sourceLabel(key: SourceKey) {
  return `Source ${key}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export function normalizeSql(script: string) {
  return script
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim();
}
