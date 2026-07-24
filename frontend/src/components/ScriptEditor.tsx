import Editor from "@monaco-editor/react";
import styles from "./ScriptEditor.module.css";

interface ScriptEditorProps {
  value: string;
  label: string;
  emptyMessage?: string;
  height?: number;
  onNormalize: () => void;
  onCopy: () => void;
}

export function ScriptEditor({
  value,
  label,
  emptyMessage = "Load a view script to preview its SQL definition.",
  height = 330,
  onNormalize,
  onCopy,
}: ScriptEditorProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span>{label}</span>
        <div>
          <button type="button" onClick={onNormalize} disabled={!value}>
            Normalize SQL
          </button>
          <button type="button" onClick={onCopy} disabled={!value}>
            Copy
          </button>
        </div>
      </div>
      {value ? (
        <Editor
          height={height}
          language="sql"
          theme="vs-dark"
          value={value}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      ) : (
        <div className={styles.empty} style={{ height }}>
          <span aria-hidden="true">SQL</span>
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
