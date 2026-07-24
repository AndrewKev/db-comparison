using System.Text.RegularExpressions;
using OracleComparison.Api.Exceptions;

namespace OracleComparison.Api.Validators;

public static partial class OracleIdentifierValidator
{
    // Oracle Database 11g limits nonquoted identifiers to 30 bytes. The allowed
    // character set below is ASCII, so the character and byte limits are equal.
    private const int OracleIdentifierMaxLength = 30;

    [GeneratedRegex(@"^[A-Za-z][A-Za-z0-9_$#]*$", RegexOptions.CultureInvariant)]
    private static partial Regex IdentifierPattern();

    public static string ValidateViewName(string? value)
        => ValidateSingleIdentifier(value, "View name");

    public static string ValidateSchemaName(string? value)
        => ValidateSingleIdentifier(value, "Schema name");

    private static string ValidateSingleIdentifier(string? value, string label)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw ApiException.Validation($"{label} is required.");
        }

        var trimmed = value.Trim();
        if (!IsValidIdentifier(trimmed))
        {
            throw ApiException.Validation(
                $"{label} must be a single unquoted Oracle identifier.");
        }

        return trimmed.ToUpperInvariant();
    }

    private static bool IsValidIdentifier(string value) =>
        value.Length is > 0 and <= OracleIdentifierMaxLength &&
        IdentifierPattern().IsMatch(value);
}
