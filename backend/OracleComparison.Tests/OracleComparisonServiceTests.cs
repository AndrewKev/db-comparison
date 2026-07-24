using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OracleComparison.Api.DTOs;
using OracleComparison.Api.Exceptions;
using OracleComparison.Api.Models;
using OracleComparison.Api.Services;

namespace OracleComparison.Tests;

public sealed class OracleComparisonServiceTests
{
    [Fact]
    public async Task TestConnectionAsync_MapsInvalidConnectionStringToSafeError()
    {
        var service = new OracleComparisonService(
            Options.Create(new OracleComparisonOptions()),
            NullLogger<OracleComparisonService>.Instance);

        var exception = await Assert.ThrowsAsync<ApiException>(() =>
            service.TestConnectionAsync(
                new TestConnectionRequest("not-a-valid-oracle-connection-string"),
                CancellationToken.None));

        Assert.Equal("INVALID_CONNECTION_STRING", exception.ErrorCode);
        Assert.DoesNotContain("stack", exception.PublicMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void BuildGetViewDdlQuery_UsesBindParametersForBothIdentifiers()
    {
        var sql = OracleComparisonService.BuildGetViewDdlQuery();

        Assert.Equal(
            "SELECT DBMS_METADATA.GET_DDL('VIEW', :viewName, :schemaName) AS VIEW_SCRIPT FROM DUAL",
            sql);
        Assert.DoesNotContain("MY_SCHEMA", sql);
    }

    [Fact]
    public void NormalizeScript_NormalizesLineEndingsAndOuterWhitespace()
    {
        var result = OracleComparisonService.NormalizeScript(
            "\r\nCREATE VIEW MY_VIEW AS\r\nSELECT 1 FROM DUAL;\r\n ");

        Assert.Equal("CREATE VIEW MY_VIEW AS\nSELECT 1 FROM DUAL;", result);
    }

    [Fact]
    public void ReadViewScript_MapsDatabaseNullToSafeNotFoundError()
    {
        var exception = Assert.Throws<ApiException>(() =>
            OracleComparisonService.ReadViewScript(DBNull.Value, 1000));

        Assert.Equal("VIEW_SCRIPT_NOT_FOUND", exception.ErrorCode);
    }

    [Fact]
    public void ReadViewScript_RejectsScriptsOverConfiguredLimit()
    {
        var exception = Assert.Throws<ApiException>(() =>
            OracleComparisonService.ReadViewScript("CREATE VIEW TOO_LONG", 10));

        Assert.Equal("VIEW_SCRIPT_TOO_LARGE", exception.ErrorCode);
    }
}
