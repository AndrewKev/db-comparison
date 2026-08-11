namespace OracleComparison.Api.DTOs;

public sealed record TestConnectionResponse(bool Success, string Message);

public sealed record LoadViewScriptResponse(
    bool Success,
    long ExecutionTimeMs,
    string SchemaName,
    string ViewName,
    string Script,
    IReadOnlyList<ViewDependencyResponse> Dependencies);

public sealed record ViewDependencyResponse(
    string? ReferencedOwner,
    string ReferencedName,
    string ReferencedType,
    string? DatabaseLink);

public sealed record CompareTableCountsResponse(
    bool Success,
    string TableName,
    string DatabaseLink,
    long LocalCount,
    long RemoteCount);

public sealed record CreateTableBackupResponse(
    bool Success,
    string BackupTableName,
    long RowsCopied,
    string Message);

public sealed record CheckTableBackupResponse(
    bool Success,
    string BackupTableName,
    bool Exists,
    long RowCount);

public sealed record DeleteLocalTableDataResponse(
    bool Success,
    string TableName,
    long DeletedRows,
    string Message);

public sealed record SyncProductionDataResponse(
    bool Success,
    string TableName,
    string DatabaseLink,
    long InsertedRows,
    string Message);

public sealed record ApiErrorResponse(bool Success, string Message, string ErrorCode);
