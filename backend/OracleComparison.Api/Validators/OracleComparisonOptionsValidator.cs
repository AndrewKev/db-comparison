using Microsoft.Extensions.Options;
using OracleComparison.Api.Models;

namespace OracleComparison.Api.Validators;

public sealed class OracleComparisonOptionsValidator : IValidateOptions<OracleComparisonOptions>
{
    public ValidateOptionsResult Validate(string? name, OracleComparisonOptions options)
    {
        var failures = new List<string>();

        if (!Uri.TryCreate(options.AllowedCorsOrigin, UriKind.Absolute, out _))
            failures.Add("AllowedCorsOrigin must be an absolute URI.");
        if (options.QueryTimeoutSeconds < 1)
            failures.Add("QueryTimeoutSeconds must be positive.");
        if (options.MaximumViewScriptLength < 1)
            failures.Add("MaximumViewScriptLength must be positive.");
        if (options.MaximumResponseSizeBytes < 1024)
            failures.Add("MaximumResponseSizeBytes must be at least 1024.");

        return failures.Count == 0
            ? ValidateOptionsResult.Success
            : ValidateOptionsResult.Fail(failures);
    }
}
