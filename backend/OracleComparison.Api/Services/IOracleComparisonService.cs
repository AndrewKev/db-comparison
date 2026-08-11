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

    Task<CompareTableCountsResponse> CompareTableCountsAsync(
        CompareTableCountsRequest request,
        CancellationToken cancellationToken);

    Task<CreateTableBackupResponse> CreateTableBackupAsync(
        BackupTableRequest request,
        CancellationToken cancellationToken);

    Task<CheckTableBackupResponse> CheckTableBackupAsync(
        BackupTableRequest request,
        CancellationToken cancellationToken);

    Task<DeleteLocalTableDataResponse> DeleteLocalTableDataAsync(
        DeleteLocalTableDataRequest request,
        CancellationToken cancellationToken);

    Task<SyncProductionDataResponse> SyncProductionDataAsync(
        CompareTableCountsRequest request,
        CancellationToken cancellationToken);
}
