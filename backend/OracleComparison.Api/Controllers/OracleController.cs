using Microsoft.AspNetCore.Mvc;
using OracleComparison.Api.DTOs;
using OracleComparison.Api.Services;

namespace OracleComparison.Api.Controllers;

[ApiController]
[Route("api/oracle")]
[Produces("application/json")]
public sealed class OracleController(IOracleComparisonService service) : ControllerBase
{
    [HttpPost("test-connection")]
    [ProducesResponseType<TestConnectionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<TestConnectionResponse>> TestConnection(
        [FromBody] TestConnectionRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await service.TestConnectionAsync(request, cancellationToken));
    }

    [HttpPost("load-view-script")]
    [ProducesResponseType<LoadViewScriptResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<LoadViewScriptResponse>> LoadViewScript(
        [FromBody] LoadViewScriptRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await service.LoadViewScriptAsync(request, cancellationToken));
    }

    [HttpPost("compare-table-counts")]
    [ProducesResponseType<CompareTableCountsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<CompareTableCountsResponse>> CompareTableCounts(
        [FromBody] CompareTableCountsRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await service.CompareTableCountsAsync(request, cancellationToken));
    }

    [HttpPost("create-table-backup")]
    [ProducesResponseType<CreateTableBackupResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<CreateTableBackupResponse>> CreateTableBackup(
        [FromBody] BackupTableRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await service.CreateTableBackupAsync(request, cancellationToken));
    }

    [HttpPost("check-table-backup")]
    [ProducesResponseType<CheckTableBackupResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<CheckTableBackupResponse>> CheckTableBackup(
        [FromBody] BackupTableRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await service.CheckTableBackupAsync(request, cancellationToken));
    }

    [HttpPost("delete-local-table-data")]
    [ProducesResponseType<DeleteLocalTableDataResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<DeleteLocalTableDataResponse>> DeleteLocalTableData(
        [FromBody] DeleteLocalTableDataRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await service.DeleteLocalTableDataAsync(request, cancellationToken));
    }

    [HttpPost("sync-data-with-production")]
    [ProducesResponseType<SyncProductionDataResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ApiErrorResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<SyncProductionDataResponse>> SyncProductionData(
        [FromBody] CompareTableCountsRequest request,
        CancellationToken cancellationToken)
    {
        return Ok(await service.SyncProductionDataAsync(request, cancellationToken));
    }
}
