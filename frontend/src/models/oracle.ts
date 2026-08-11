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
  dependencies: ViewDependency[];
}

export interface ViewDependency {
  referencedOwner: string | null;
  referencedName: string;
  referencedType: string;
  databaseLink: string | null;
}

export interface LoadViewScriptResponse {
  success: boolean;
  executionTimeMs: number;
  schemaName: string;
  viewName: string;
  script: string;
  dependencies: ViewDependency[];
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

export interface CompareTableCountsResponse {
  success: boolean;
  tableName: string;
  databaseLink: string;
  localCount: number;
  remoteCount: number;
}

export interface CreateTableBackupResponse {
  success: boolean;
  backupTableName: string;
  rowsCopied: number;
  message: string;
}

export interface CheckTableBackupResponse {
  success: boolean;
  backupTableName: string;
  exists: boolean;
  rowCount: number;
}

export interface DeleteLocalTableDataResponse {
  success: boolean;
  tableName: string;
  deletedRows: number;
  message: string;
}

export interface SyncProductionDataResponse {
  success: boolean;
  tableName: string;
  databaseLink: string;
  insertedRows: number;
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
  dependencies: [],
});
