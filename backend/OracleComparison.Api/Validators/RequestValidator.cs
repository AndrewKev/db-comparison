using OracleComparison.Api.Exceptions;

namespace OracleComparison.Api.Validators;

public static class RequestValidator
{
    public static string ValidateConnectionString(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw ApiException.Validation("Connection string is required.");
        }

        if (value.Length > 4096)
        {
            throw ApiException.Validation("Connection string is too long.");
        }

        return value;
    }
}
