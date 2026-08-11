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
    public void BuildGetViewDependenciesQuery_UsesBindParametersAndViewTypeFilter()
    {
        var sql = OracleComparisonService.BuildGetViewDependenciesQuery();

        Assert.Contains("FROM ALL_DEPENDENCIES", sql);
        Assert.Contains("OWNER = UPPER(:schemaName)", sql);
        Assert.Contains("NAME = UPPER(:viewName)", sql);
        Assert.Contains("TYPE = 'VIEW'", sql);
        Assert.DoesNotContain("MY_VIEW", sql);
    }

    [Fact]
    public void ExtractDatabaseLinkDependencies_FindsQualifiedAndUnqualifiedObjects()
    {
        const string script = """
            CREATE VIEW SAMPLE_VIEW AS
            SELECT a.ID
            FROM REMOTE_OWNER.REMOTE_TABLE@REPORTING_LINK a
            JOIN "Mixed Owner"."Mixed Table"@"Case Link" b ON b.ID = a.ID
            JOIN SECOND_TABLE@SECOND_LINK.DOMAIN b ON b.ID = a.ID
            """;

        var result = OracleComparisonService.ExtractDatabaseLinkDependencies(script);

        Assert.Collection(
            result,
            dependency =>
            {
                Assert.Null(dependency.ReferencedOwner);
                Assert.Equal("SECOND_TABLE", dependency.ReferencedName);
                Assert.Equal("SECOND_LINK.DOMAIN", dependency.DatabaseLink);
            },
            dependency =>
            {
                Assert.Equal("Mixed Owner", dependency.ReferencedOwner);
                Assert.Equal("Mixed Table", dependency.ReferencedName);
                Assert.Equal("Case Link", dependency.DatabaseLink);
            },
            dependency =>
            {
                Assert.Equal("REMOTE_OWNER", dependency.ReferencedOwner);
                Assert.Equal("REMOTE_TABLE", dependency.ReferencedName);
                Assert.Equal("REPORTING_LINK", dependency.DatabaseLink);
                Assert.Equal("REMOTE OBJECT", dependency.ReferencedType);
            });
    }

    [Fact]
    public void ExtractDatabaseLinkDependencies_IgnoresCommentsAndStringLiteralsAndDeduplicates()
    {
        const string script = """
            CREATE VIEW SAMPLE_VIEW AS
            SELECT 'FAKE.TABLE@FAKE_LINK' AS VALUE
            FROM REAL_OWNER.REAL_TABLE@REAL_LINK a
            JOIN real_owner.real_table@real_link b ON b.ID = a.ID
            -- COMMENTED.TABLE@COMMENT_LINK
            /* BLOCKED.TABLE@BLOCK_LINK */
            """;

        var dependency = Assert.Single(
            OracleComparisonService.ExtractDatabaseLinkDependencies(script));

        Assert.Equal("REAL_OWNER", dependency.ReferencedOwner);
        Assert.Equal("REAL_TABLE", dependency.ReferencedName);
        Assert.Equal("REAL_LINK", dependency.DatabaseLink);
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

    [Fact]
    public void BuildCompareTableCountsQuery_UsesValidatedLocalAndRemoteTables()
    {
        var sql = OracleComparisonService.BuildCompareTableCountsQuery(
            "m_custom_table",
            "custom_link.domain");

        Assert.Contains("FROM M_CUSTOM_TABLE)", sql);
        Assert.Contains("FROM M_CUSTOM_TABLE@CUSTOM_LINK.DOMAIN)", sql);
        Assert.Contains("AS COUNT_LOKAL", sql);
        Assert.Contains("AS COUNT_HODB_ASLI", sql);
    }

    [Fact]
    public void BuildCreateTableBackupQuery_UsesValidatedTableNameAndCtas()
    {
        var sql = OracleComparisonService.BuildCreateTableBackupQuery(
            "backup_lpp_sim_test",
            "m_custom_table");

        Assert.Equal(
            "CREATE TABLE BACKUP_LPP_SIM_TEST AS SELECT * FROM M_CUSTOM_TABLE",
            sql);
    }

    [Fact]
    public void BuildCreateTableBackupQuery_RejectsSqlInjection()
    {
        Assert.Throws<ApiException>(() =>
            OracleComparisonService.BuildCreateTableBackupQuery(
                "BACKUP_TABLE; DELETE FROM USERS",
                "M_CUSTOM_TABLE"));

        Assert.Throws<ApiException>(() =>
            OracleComparisonService.BuildCompareTableCountsQuery(
                "M_CUSTOM_TABLE; DELETE FROM USERS",
                "CUSTOM_LINK"));

        Assert.Throws<ApiException>(() =>
            OracleComparisonService.BuildCompareTableCountsQuery(
                "M_CUSTOM_TABLE",
                "CUSTOM_LINK; DELETE FROM USERS"));

        Assert.Throws<ApiException>(() =>
            OracleComparisonService.BuildCreateTableBackupQuery(
                "BACKUP_LPP_SIM_TEST",
                "M_CUSTOM_TABLE; DELETE FROM USERS"));

        Assert.Throws<ApiException>(() =>
            OracleComparisonService.BuildSyncDataWithProductionQuery(
                "M_CUSTOM_TABLE",
                "CUSTOM_LINK; DELETE FROM USERS"));
    }

    [Fact]
    public void BuildCheckAndDeleteQueries_OnlyTargetValidatedTables()
    {
        Assert.Equal(
            "SELECT COUNT(*) FROM BACKUP_LPP_SIM_TEST",
            OracleComparisonService.BuildCheckTableBackupQuery("backup_lpp_sim_test"));
        Assert.Equal(
            "DELETE FROM M_CUSTOM_TABLE",
            OracleComparisonService.BuildDeleteLocalTableDataQuery("m_custom_table"));
        Assert.Equal(
            "SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = :tableName",
            OracleComparisonService.BuildTableExistsQuery());
        Assert.Equal(
            "INSERT INTO M_CUSTOM_TABLE SELECT * FROM M_CUSTOM_TABLE@CUSTOM_LINK.DOMAIN",
            OracleComparisonService.BuildSyncDataWithProductionQuery(
                "m_custom_table",
                "custom_link.domain"));
    }

    [Fact]
    public void EnsureBackupMatchesLocalCount_RejectsDeletingAnUnverifiedBackup()
    {
        var exception = Assert.Throws<ApiException>(() =>
            OracleComparisonService.EnsureBackupMatchesLocalCount(
                "BACKUP_LPP_SIM_TEST",
                backupRowCount: 9,
                localRowCount: 10,
                sourceTableName: "M_CUSTOM_TABLE"));

        Assert.Equal("BACKUP_ROW_COUNT_MISMATCH", exception.ErrorCode);
        Assert.Equal(409, exception.StatusCode);
    }

    [Fact]
    public void EnsureBackupMatchesLocalCount_AllowsMatchingCounts()
    {
        OracleComparisonService.EnsureBackupMatchesLocalCount(
            "BACKUP_LPP_SIM_TEST",
            backupRowCount: 10,
            localRowCount: 10,
            sourceTableName: "M_CUSTOM_TABLE");
    }
}
