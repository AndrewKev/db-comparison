import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(cleanup);

vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value?: string }) => (
    <pre data-testid="monaco-editor">{value}</pre>
  ),
  DiffEditor: ({
    original,
    modified,
  }: {
    original?: string;
    modified?: string;
  }) => (
    <div data-testid="monaco-diff">
      <pre>{original}</pre>
      <pre>{modified}</pre>
    </div>
  ),
}));

Object.defineProperty(window.navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
});
