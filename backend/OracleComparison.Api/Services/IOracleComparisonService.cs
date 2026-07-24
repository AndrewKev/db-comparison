using OracleComparison.Api.DTOs;

namespace OracleComparison.Api.Services;

public interface IOracleComparisonService
{
    Task<TestConnectionResponse> TestConnectionAsync(
        TestConnectionRequest request,
        CancellationToken cancellationToken);

    Task<LoadViewScriptResponse> LoadViewScriptAsync(
        LoadViewScriptRequest request,
        CancellationToken cancellationToken);
}
