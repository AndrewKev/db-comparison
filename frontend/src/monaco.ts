import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

type MonacoWorkerHost = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker(moduleId: string, label: string): Worker;
  };
};

(self as MonacoWorkerHost).MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });
