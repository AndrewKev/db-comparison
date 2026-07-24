using System.ComponentModel.DataAnnotations;

namespace OracleComparison.Api.DTOs;

public sealed record TestConnectionRequest(
    [property: Required, MinLength(1), MaxLength(4096)] string ConnectionString);

public sealed record LoadViewScriptRequest(
    [property: Required, MinLength(1), MaxLength(4096)] string ConnectionString,
    [property: Required, MinLength(1), MaxLength(30)] string SchemaName,
    [property: Required, MinLength(1), MaxLength(30)] string ViewName);
