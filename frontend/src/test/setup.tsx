import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value?: string }) => (
    <pre data-testid="monaco-editor">{value}</pre>
  ),
  loader: {
    init: async () => {
      const createModel = (initialValue: string) => {
        let value = initialValue;
        return {
          dispose: vi.fn(),
          getValue: () => value,
          setValue: (nextValue: string) => {
            value = nextValue;
          },
          updateOptions: vi.fn(),
        };
      };
      const disposable = { dispose: vi.fn() };
      const codeEditor = {
        deltaDecorations: () => [],
        executeEdits: vi.fn(),
        getValue: () => "",
        onDidChangeModelContent: () => disposable,
        onMouseDown: () => disposable,
        pushUndoStop: vi.fn(),
        updateOptions: vi.fn(),
      };
      const diffEditor = {
        dispose: vi.fn(),
        getLineChanges: () => [],
        getModifiedEditor: () => codeEditor,
        getOriginalEditor: () => codeEditor,
        onDidUpdateDiff: () => disposable,
        setModel: vi.fn(),
      };

      return {
        editor: {
          createDiffEditor: () => diffEditor,
          createModel,
          setTheme: vi.fn(),
        },
      };
    },
  },
}));

Object.defineProperty(window.navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
});
