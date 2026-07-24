using Microsoft.AspNetCore.Diagnostics;
using OracleComparison.Api.DTOs;

namespace OracleComparison.Api.Exceptions;

public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger,
    IHostEnvironment environment) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, errorCode, message) = exception switch
        {
            ApiException api => (api.StatusCode, api.ErrorCode, api.PublicMessage),
            OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested =>
                (StatusCodes.Status499ClientClosedRequest, "REQUEST_CANCELLED", "The request was cancelled."),
            _ => (StatusCodes.Status500InternalServerError, "INTERNAL_ERROR",
                "An unexpected server error occurred.")
        };

        if (exception is ApiException)
        {
            logger.LogWarning("Request failed with code {ErrorCode}.", errorCode);
        }
        else if (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Unhandled request failure in {Environment}.", environment.EnvironmentName);
        }

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(
            new ApiErrorResponse(false, message, errorCode),
            cancellationToken);
        return true;
    }
}
