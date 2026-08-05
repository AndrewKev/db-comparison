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

public sealed record ApiErrorResponse(bool Success, string Message, string ErrorCode);
