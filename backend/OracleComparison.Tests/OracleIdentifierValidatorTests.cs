using OracleComparison.Api.Exceptions;
using OracleComparison.Api.Validators;

namespace OracleComparison.Tests;

public sealed class OracleIdentifierValidatorTests
{
    [Theory]
    [InlineData("MY_VIEW", "MY_VIEW")]
    [InlineData("my_view", "MY_VIEW")]
    [InlineData("V_$SESSION", "V_$SESSION")]
    public void ValidateViewName_AcceptsSafeSingleIdentifiers(string input, string expected)
    {
        Assert.Equal(expected, OracleIdentifierValidator.ValidateViewName(input));
    }

    [Theory]
    [InlineData("MY_VIEW; DROP TABLE USERS")]
    [InlineData("SCHEMA.MY_VIEW")]
    [InlineData("\"QuotedView\"")]
    [InlineData("VIEW--comment")]
    public void ValidateViewName_RejectsInjectionAndUnsafeSyntax(string input)
    {
        Assert.Throws<ApiException>(() => OracleIdentifierValidator.ValidateViewName(input));
    }

    [Fact]
    public void ValidateSchemaName_NormalizesSafeIdentifier()
    {
        Assert.Equal("MY_SCHEMA", OracleIdentifierValidator.ValidateSchemaName("my_schema"));
    }

    [Theory]
    [InlineData("MY_SCHEMA.OTHER")]
    [InlineData("SCHEMA; DELETE FROM USERS")]
    public void ValidateSchemaName_RejectsUnsafeSyntax(string input)
    {
        Assert.Throws<ApiException>(() => OracleIdentifierValidator.ValidateSchemaName(input));
    }
}
