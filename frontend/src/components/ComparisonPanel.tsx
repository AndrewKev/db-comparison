import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  loader,
  type MonacoDiffEditor,
} from "@monaco-editor/react";
import type {
  IDisposable,
  editor as MonacoEditor,
} from "monaco-editor";
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

export interface ComparisonPanelHandle {
  getModifiedValue: () => string;
}

export const ComparisonPanel = forwardRef<
  ComparisonPanelHandle,
  ComparisonPanelProps
>(function ComparisonPanel(
  {
    sourceA,
    sourceB,
    visible,
    onSourceAChange,
    onSourceBChange,
    onCompare,
    onSwap,
    onClear,
  },
  ref,
) {
  const ready = Boolean(sourceA && sourceB);
  const [direction, setDirection] = useState<ApplyDirection>("AtoB");
  const [changeCount, setChangeCount] = useState(0);
  const [changeIndex, setChangeIndex] = useState(-1);
  const editorRef = useRef<MonacoDiffEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const originalModelRef = useRef<MonacoEditor.ITextModel | null>(null);
  const modifiedModelRef = useRef<MonacoEditor.ITextModel | null>(null);
  const latestTargetScriptRef = useRef("");
  const onModifiedChangeRef = useRef<(script: string) => void>(() => undefined);

  const isAtoB = direction === "AtoB";
  const referenceScript = isAtoB ? sourceA : sourceB;
  const targetScript = isAtoB ? sourceB : sourceA;
  const referenceLabel = isAtoB ? "Source A" : "Source B";
  const targetLabel = isAtoB ? "Source B" : "Source A";

  latestTargetScriptRef.current = targetScript;
  onModifiedChangeRef.current = isAtoB ? onSourceBChange : onSourceAChange;

  useImperativeHandle(
    ref,
    () => ({
      // Always read from the model so callers receive edits and hunk reverts immediately.
      getModifiedValue: () =>
        modifiedModelRef.current?.getValue() ?? latestTargetScriptRef.current,
    }),
    [],
  );

  useEffect(() => {
    setChangeCount(0);
    setChangeIndex(-1);
  }, [direction, referenceScript, visible]);

  useEffect(() => {
    if (!visible || !ready || !editorContainerRef.current) return;

    let cancelled = false;
    let editor: MonacoDiffEditor | null = null;
    let originalModel: MonacoEditor.ITextModel | null = null;
    let modifiedModel: MonacoEditor.ITextModel | null = null;
    let contentSubscription: IDisposable | null = null;
    let diffSubscription: IDisposable | null = null;
    let revertSubscription: IDisposable | null = null;
    let revertDecorationIds: string[] = [];
    let currentLineChanges: MonacoEditor.ILineChange[] = [];

    void loader
      .init()
      .then((monaco) => {
        if (cancelled || !editorContainerRef.current) return;

        originalModel = monaco.editor.createModel(referenceScript, "sql");
        modifiedModel = monaco.editor.createModel(
          latestTargetScriptRef.current,
          "sql",
        );
        // Keep one model character equal to one visible cursor step.
        // This changes tab rendering only; neither model's text is modified.
        originalModel.updateOptions({ tabSize: 1 });
        modifiedModel.updateOptions({ tabSize: 1 });

        editor = monaco.editor.createDiffEditor(editorContainerRef.current, {
          readOnly: false,
          originalEditable: false,
          renderSideBySide: true,
          // A custom margin handler below locks every action to one ILineChange.
          renderMarginRevertIcon: false,
          renderGutterMenu: false,
          // editor.api disables this standalone default; block icons live in this margin.
          glyphMargin: true,
          diffAlgorithm: "advanced",
          enableSplitViewResizing: true,
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          renderOverviewRuler: true,
          padding: { top: 12, bottom: 12 },
        });
        editor.setModel({ original: originalModel, modified: modifiedModel });
        editor.getOriginalEditor().updateOptions({ readOnly: true });
        monaco.editor.setTheme("vs-dark");

        editorRef.current = editor;
        originalModelRef.current = originalModel;
        modifiedModelRef.current = modifiedModel;

        const updateDiffState = () => {
          currentLineChanges = editor?.getLineChanges() ?? [];
          const count = currentLineChanges.length;

          revertDecorationIds = editor
            ? editor.getModifiedEditor().deltaDecorations(
                revertDecorationIds,
                currentLineChanges.map((change, index) => {
                  const lineNumber = getRevertIconLine(change, modifiedModel!);
                  return {
                    range: {
                      startLineNumber: lineNumber,
                      startColumn: 1,
                      endLineNumber: lineNumber,
                      endColumn: 1,
                    },
                    options: {
                      glyphMarginClassName:
                        `comparison-block-revert comparison-block-revert-${index}`,
                      glyphMarginHoverMessage: {
                        value: "Revert only this changed block",
                      },
                    },
                  };
                }),
              )
            : [];

          setChangeCount(count);
          setChangeIndex((current) => (current >= count ? count - 1 : current));
        };

        contentSubscription = editor
          .getModifiedEditor()
          .onDidChangeModelContent(() => {
            // This also runs after a block revert and keeps parent state current.
            onModifiedChangeRef.current(modifiedModel?.getValue() ?? "");
          });
        diffSubscription = editor.onDidUpdateDiff(updateDiffState);
        revertSubscription = editor
          .getModifiedEditor()
          .onMouseDown((event) => {
            const revertIcon = event.target.element?.closest(
              ".comparison-block-revert",
            );
            if (!revertIcon || !originalModel || !modifiedModel) {
              return;
            }

            const indexClass = [...revertIcon.classList].find((className) =>
              className.startsWith("comparison-block-revert-"),
            );
            const selectedChange = indexClass
              ? currentLineChanges[
                  Number(indexClass.replace("comparison-block-revert-", ""))
                ]
              : undefined;
            if (!selectedChange) return;

            event.event.preventDefault();
            event.event.stopPropagation();

            const modifiedEditor = editor?.getModifiedEditor();
            if (!modifiedEditor) return;

            // Only ranges belonging to the clicked ILineChange are edited.
            const edits = createBlockRevertEdits(
              selectedChange,
              originalModel,
              modifiedModel,
            );
            modifiedEditor.pushUndoStop();
            modifiedEditor.executeEdits("revert-diff-block", edits);
            modifiedEditor.pushUndoStop();
          });
        updateDiffState();
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Monaco initialization failed:", error);
        }
      });

    return () => {
      cancelled = true;
      contentSubscription?.dispose();
      diffSubscription?.dispose();
      revertSubscription?.dispose();
      if (editor && revertDecorationIds.length > 0) {
        editor
          .getModifiedEditor()
          .deltaDecorations(revertDecorationIds, []);
      }

      if (editorRef.current === editor) editorRef.current = null;
      if (originalModelRef.current === originalModel) {
        originalModelRef.current = null;
      }
      if (modifiedModelRef.current === modifiedModel) {
        modifiedModelRef.current = null;
      }

      editor?.dispose();
      originalModel?.dispose();
      modifiedModel?.dispose();
    };
  }, [direction, ready, referenceScript, visible]);

  useEffect(() => {
    const modifiedModel = modifiedModelRef.current;
    if (modifiedModel && modifiedModel.getValue() !== targetScript) {
      modifiedModel.setValue(targetScript);
    }
  }, [targetScript]);

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
          <div
            ref={editorContainerRef}
            className={styles.diffEditor}
            data-testid="monaco-diff"
            aria-label={`${referenceLabel} and ${targetLabel} SQL comparison`}
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
});

function getRevertIconLine(
  change: MonacoEditor.ILineChange,
  modifiedModel: MonacoEditor.ITextModel,
) {
  return Math.min(
    modifiedModel.getLineCount(),
    Math.max(1, change.modifiedStartLineNumber),
  );
}

function createBlockRevertEdits(
  change: MonacoEditor.ILineChange,
  originalModel: MonacoEditor.ITextModel,
  modifiedModel: MonacoEditor.ITextModel,
): MonacoEditor.IIdentifiedSingleEditOperation[] {
  if (change.charChanges?.length) {
    return change.charChanges.map((charChange) => {
      const originalRange = {
        startLineNumber: charChange.originalStartLineNumber,
        startColumn: charChange.originalStartColumn,
        endLineNumber: charChange.originalEndLineNumber,
        endColumn: charChange.originalEndColumn,
      };

      return {
        range: {
          startLineNumber: charChange.modifiedStartLineNumber,
          startColumn: charChange.modifiedStartColumn,
          endLineNumber: charChange.modifiedEndLineNumber,
          endColumn: charChange.modifiedEndColumn,
        },
        text: originalModel.getValueInRange(originalRange),
        forceMoveMarkers: true,
      };
    });
  }

  const originalIsEmpty = change.originalEndLineNumber === 0;
  const modifiedIsEmpty = change.modifiedEndLineNumber === 0;
  const originalText = originalIsEmpty
    ? ""
    : getLineBlock(
        originalModel,
        change.originalStartLineNumber,
        change.originalEndLineNumber,
      );

  if (modifiedIsEmpty) {
    const lineBeforeInsertion = change.modifiedStartLineNumber;
    if (lineBeforeInsertion <= 0) {
      const modifiedIsBlank =
        modifiedModel.getLineCount() === 1 && modifiedModel.getValue() === "";
      return [{
        range: emptyRange(1, 1),
        text: originalText + (modifiedIsBlank ? "" : modifiedModel.getEOL()),
        forceMoveMarkers: true,
      }];
    }

    if (lineBeforeInsertion >= modifiedModel.getLineCount()) {
      const lastLine = modifiedModel.getLineCount();
      return [{
        range: emptyRange(
          lastLine,
          modifiedModel.getLineMaxColumn(lastLine),
        ),
        text: modifiedModel.getEOL() + originalText,
        forceMoveMarkers: true,
      }];
    }

    return [{
      range: emptyRange(lineBeforeInsertion + 1, 1),
      text: originalText + modifiedModel.getEOL(),
      forceMoveMarkers: true,
    }];
  }

  const startsAt = change.modifiedStartLineNumber;
  const endsAt = change.modifiedEndLineNumber;
  const isAtEnd = endsAt === modifiedModel.getLineCount();

  if (originalIsEmpty && isAtEnd && startsAt > 1) {
    return [{
      range: {
        startLineNumber: startsAt - 1,
        startColumn: modifiedModel.getLineMaxColumn(startsAt - 1),
        endLineNumber: endsAt,
        endColumn: modifiedModel.getLineMaxColumn(endsAt),
      },
      text: "",
      forceMoveMarkers: true,
    }];
  }

  return [{
    range: {
      startLineNumber: startsAt,
      startColumn: 1,
      endLineNumber: isAtEnd ? endsAt : endsAt + 1,
      endColumn: isAtEnd ? modifiedModel.getLineMaxColumn(endsAt) : 1,
    },
    text: isAtEnd || originalIsEmpty
      ? originalText
      : originalText + modifiedModel.getEOL(),
    forceMoveMarkers: true,
  }];
}

function getLineBlock(
  model: MonacoEditor.ITextModel,
  startLineNumber: number,
  endLineNumber: number,
) {
  const lines: string[] = [];
  for (let line = startLineNumber; line <= endLineNumber; line += 1) {
    lines.push(model.getLineContent(line));
  }
  return lines.join(model.getEOL());
}

function emptyRange(lineNumber: number, column: number) {
  return {
    startLineNumber: lineNumber,
    startColumn: column,
    endLineNumber: lineNumber,
    endColumn: column,
  };
}
