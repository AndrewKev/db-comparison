namespace OracleComparison.Api.Exceptions;

public sealed class ApiException : Exception
{
    public ApiException(int statusCode, string errorCode, string publicMessage, Exception? inner = null)
        : base(publicMessage, inner)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
        PublicMessage = publicMessage;
    }

    public int StatusCode { get; }
    public string ErrorCode { get; }
    public string PublicMessage { get; }

    public static ApiException Validation(string message) =>
        new(StatusCodes.Status400BadRequest, "VALIDATION_FAILED", message);
}
