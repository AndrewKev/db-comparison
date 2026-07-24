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
}
