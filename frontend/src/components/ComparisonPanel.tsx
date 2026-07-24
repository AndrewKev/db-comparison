import { useEffect, useRef, useState } from "react";
import {
  DiffEditor,
  type DiffOnMount,
  type MonacoDiffEditor,
} from "@monaco-editor/react";
import styles from "./ComparisonPanel.module.css";

type ApplyDirection = "AtoB" | "BtoA";

interface ComparisonPanelProps {
  sourceA: string;
  sourceB: string;
  visible: boolean;
  onSourceAChange: (script: string) => void;
  onSourceBChange: (script: string) => void;
  onCompare: () => void;
  onSwap: () => void;
  onClear: () => void;
}

export function ComparisonPanel({
  sourceA,
  sourceB,
  visible,
  onSourceAChange,
  onSourceBChange,
  onCompare,
  onSwap,
  onClear,
}: ComparisonPanelProps) {
  const ready = Boolean(sourceA && sourceB);
  const [direction, setDirection] = useState<ApplyDirection>("AtoB");
  const [changeCount, setChangeCount] = useState(0);
  const [changeIndex, setChangeIndex] = useState(-1);
  const editorRef = useRef<MonacoDiffEditor | null>(null);

  const isAtoB = direction === "AtoB";
  const referenceScript = isAtoB ? sourceA : sourceB;
  const targetScript = isAtoB ? sourceB : sourceA;
  const referenceLabel = isAtoB ? "Source A" : "Source B";
  const targetLabel = isAtoB ? "Source B" : "Source A";

  useEffect(() => {
    setChangeCount(0);
    setChangeIndex(-1);
    editorRef.current = null;
  }, [direction]);

  const mountEditor: DiffOnMount = (editor) => {
    editorRef.current = editor;

    const updateDiffState = () => {
      const count = editor.getLineChanges()?.length ?? 0;
      setChangeCount(count);
      setChangeIndex((current) => (current >= count ? count - 1 : current));
    };

    const contentSubscription = editor
      .getModifiedEditor()
      .onDidChangeModelContent(() => {
        const script = editor.getModifiedEditor().getValue();
        if (isAtoB) onSourceBChange(script);
        else onSourceAChange(script);
      });
    const diffSubscription = editor.onDidUpdateDiff(updateDiffState);
    const disposeSubscription = editor.onDidDispose(() => {
      contentSubscription.dispose();
      diffSubscription.dispose();
      disposeSubscription.dispose();
      if (editorRef.current === editor) editorRef.current = null;
    });

    updateDiffState();
  };

  const navigateChange = (delta: -1 | 1) => {
    const editor = editorRef.current;
    const changes = editor?.getLineChanges() ?? [];
    if (!editor || changes.length === 0) return;

    const nextIndex =
      changeIndex < 0
        ? delta > 0
          ? 0
          : changes.length - 1
        : (changeIndex + delta + changes.length) % changes.length;
    const lineNumber = Math.max(1, changes[nextIndex].modifiedStartLineNumber);
    const targetEditor = editor.getModifiedEditor();

    setChangeIndex(nextIndex);
    targetEditor.setPosition({ lineNumber, column: 1 });
    targetEditor.revealLineInCenter(lineNumber);
    targetEditor.focus();
  };

  return (
    <section className={styles.section} aria-labelledby="comparison-title">
      <header className={styles.header}>
        <div>
          <span className={styles.step}>02 / Comparison result</span>
          <h2 id="comparison-title">Side-by-side SQL diff</h2>
          <p>Apply individual changed blocks between sources using the center gutter arrow.</p>
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

      <div className={styles.transferBar}>
        <div className={styles.directionGroup} aria-label="Apply change direction">
          <span>Apply direction</span>
          <button
            type="button"
            className={isAtoB ? styles.activeDirection : undefined}
            aria-pressed={isAtoB}
            disabled={!ready}
            onClick={() => setDirection("AtoB")}
          >
            A → B
          </button>
          <button
            type="button"
            className={!isAtoB ? styles.activeDirection : undefined}
            aria-pressed={!isAtoB}
            disabled={!ready}
            onClick={() => setDirection("BtoA")}
          >
            B → A
          </button>
        </div>
        <p>
          <strong>{targetLabel}</strong> is the editable target. Click the arrow beside a
          highlighted block to apply it from {referenceLabel}.
        </p>
        <div className={styles.navigation}>
          <button
            type="button"
            disabled={!visible || changeCount === 0}
            onClick={() => navigateChange(-1)}
          >
            ↑ Previous
          </button>
          <span>{changeCount === 0 ? "No changes" : `${changeIndex + 1 || 1} / ${changeCount}`}</span>
          <button
            type="button"
            disabled={!visible || changeCount === 0}
            onClick={() => navigateChange(1)}
          >
            Next ↓
          </button>
        </div>
      </div>

      <div className={styles.labels}>
        <span>{referenceLabel} · Reference</span>
        <span>{targetLabel} · Editable target</span>
      </div>

      {visible && ready ? (
        <div className={styles.diff}>
          <DiffEditor
            key={direction}
            height="590px"
            language="sql"
            theme="vs-dark"
            original={referenceScript}
            modified={targetScript}
            onMount={mountEditor}
            options={{
              readOnly: false,
              originalEditable: false,
              renderSideBySide: true,
              renderMarginRevertIcon: true,
              enableSplitViewResizing: true,
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
