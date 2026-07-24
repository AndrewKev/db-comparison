namespace OracleComparison.Api.Models;

public sealed class OracleComparisonOptions
{
    public const string SectionName = "OracleComparison";

    public string AllowedCorsOrigin { get; init; } = "http://localhost:5173";
    public int QueryTimeoutSeconds { get; init; } = 60;
    public int MaximumViewScriptLength { get; init; } = 1_000_000;
    public int MaximumResponseSizeBytes { get; init; } = 10 * 1024 * 1024;
    public long MaximumRequestSizeBytes { get; init; } = 65_536;
}
