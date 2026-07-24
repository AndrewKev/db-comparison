import { DiffEditor } from "@monaco-editor/react";
import styles from "./ComparisonPanel.module.css";

interface ComparisonPanelProps {
  sourceA: string;
  sourceB: string;
  visible: boolean;
  onCompare: () => void;
  onSwap: () => void;
  onClear: () => void;
}

export function ComparisonPanel({
  sourceA,
  sourceB,
  visible,
  onCompare,
  onSwap,
  onClear,
}: ComparisonPanelProps) {
  const ready = Boolean(sourceA && sourceB);

  return (
    <section className={styles.section} aria-labelledby="comparison-title">
      <header className={styles.header}>
        <div>
          <span className={styles.step}>02 / Comparison result</span>
          <h2 id="comparison-title">Side-by-side data diff</h2>
          <p>Normalized SQL highlights inserted, removed, and changed lines.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.compare} disabled={!ready} onClick={onCompare}>
            Compare
          </button>
          <button type="button" onClick={onSwap}>
            Swap Sources
          </button>
          <button type="button" disabled={!visible} onClick={onClear}>
            Clear Comparison
          </button>
        </div>
      </header>

      <div className={styles.labels}>
        <span>Source A · Original</span>
        <span>Source B · Modified</span>
      </div>

      {visible && ready ? (
        <div className={styles.diff}>
          <DiffEditor
            height="590px"
            language="sql"
            theme="vs-dark"
            original={sourceA}
            modified={sourceB}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              renderOverviewRuler: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <span>{"{ A }"}</span>
            <i />
            <span>{"{ B }"}</span>
          </div>
          <h3>{ready ? "Comparison cleared" : "Waiting for both sources"}</h3>
          <p>
            {ready
              ? "Select Compare to restore the diff."
              : "Load a view script from Source A and Source B to generate the diff automatically."}
          </p>
        </div>
      )}
    </section>
  );
}
