namespace OracleComparison.Api.DTOs;

public sealed record TestConnectionResponse(bool Success, string Message);

public sealed record LoadViewScriptResponse(
    bool Success,
    long ExecutionTimeMs,
    string SchemaName,
    string ViewName,
    string Script);

public sealed record ApiErrorResponse(bool Success, string Message, string ErrorCode);
