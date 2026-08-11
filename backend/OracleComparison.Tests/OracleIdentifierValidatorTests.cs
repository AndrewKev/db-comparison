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

    [Fact]
    public void ValidateTableName_AcceptsAnOracle11gIdentifier()
    {
        Assert.Equal(
            "BACKUP_LPP_SIM_M_ASAL_KIRIM_BA",
            OracleIdentifierValidator.ValidateTableName(
                "backup_lpp_sim_m_asal_kirim_ba"));
    }

    [Fact]
    public void ValidateTableName_RejectsIdentifiersOverThirtyCharacters()
    {
        Assert.Throws<ApiException>(() =>
            OracleIdentifierValidator.ValidateTableName(
                "BACKUP_LPP_SIM_M_ASAL_KIRIM_BARANG"));
    }

    [Theory]
    [InlineData("hodb_asli", "HODB_ASLI")]
    [InlineData("hodb_asli.domain", "HODB_ASLI.DOMAIN")]
    public void ValidateDatabaseLink_AcceptsSafeNames(string input, string expected)
    {
        Assert.Equal(expected, OracleIdentifierValidator.ValidateDatabaseLink(input));
    }

    [Theory]
    [InlineData("")]
    [InlineData("HODB_ASLI; DELETE FROM USERS")]
    [InlineData("HODB_ASLI@OTHER")]
    public void ValidateDatabaseLink_RejectsUnsafeNames(string input)
    {
        Assert.Throws<ApiException>(() =>
            OracleIdentifierValidator.ValidateDatabaseLink(input));
    }
}
