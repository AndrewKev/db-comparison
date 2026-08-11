using System.ComponentModel.DataAnnotations;

namespace OracleComparison.Api.DTOs;

public sealed class TestConnectionRequest
{
    public TestConnectionRequest()
    {
    }

    public TestConnectionRequest(string connectionString)
    {
        ConnectionString = connectionString;
    }

    [Required, MinLength(1), MaxLength(4096)]
    public string ConnectionString { get; init; } = string.Empty;
}

public sealed class LoadViewScriptRequest
{
    [Required, MinLength(1), MaxLength(4096)]
    public string ConnectionString { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(30)]
    public string SchemaName { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(30)]
    public string ViewName { get; init; } = string.Empty;
}

public sealed class CompareTableCountsRequest
{
    [Required, MinLength(1), MaxLength(4096)]
    public string ConnectionString { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(30)]
    public string TableName { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(128)]
    public string DatabaseLink { get; init; } = string.Empty;
}

public sealed class BackupTableRequest
{
    [Required, MinLength(1), MaxLength(4096)]
    public string ConnectionString { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(30)]
    public string BackupTableName { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(30)]
    public string TableName { get; init; } = string.Empty;
}

public sealed class DeleteLocalTableDataRequest
{
    [Required, MinLength(1), MaxLength(4096)]
    public string ConnectionString { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(30)]
    public string BackupTableName { get; init; } = string.Empty;

    [Required, MinLength(1), MaxLength(30)]
    public string TableName { get; init; } = string.Empty;
}
