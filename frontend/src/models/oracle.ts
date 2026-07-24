export type ConnectionStatus = "idle" | "testing" | "success" | "error";

export interface OracleSourceState {
  connectionString: string;
  schemaName: string;
  viewName: string;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  error?: string;
  executionTimeMs?: number;
  script: string;
}

export interface LoadViewScriptResponse {
  success: boolean;
  executionTimeMs: number;
  schemaName: string;
  viewName: string;
  script: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errorCode: string;
}

export const createEmptySource = (): OracleSourceState => ({
  connectionString: "",
  schemaName: "",
  viewName: "",
  loading: false,
  connectionStatus: "idle",
  script: "",
});
