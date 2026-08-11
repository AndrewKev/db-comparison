using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using OracleComparison.Api.DTOs;
using OracleComparison.Api.Exceptions;
using OracleComparison.Api.Models;
using OracleComparison.Api.Validators;

namespace OracleComparison.Api.Services;

public sealed class OracleComparisonService(
    IOptions<OracleComparisonOptions> options,
    ILogger<OracleComparisonService> logger) : IOracleComparisonService
{
    private static readonly Regex DatabaseLinkReferenceRegex = new(
        @"(?<![\w$#])(?:(?<owner>""(?:""""|[^""])+""|[A-Za-z][A-Za-z0-9_$#]*)\s*\.\s*)?(?<name>""(?:""""|[^""])+""|[A-Za-z][A-Za-z0-9_$#]*)\s*@\s*(?<link>""(?:""""|[^""])+""|[A-Za-z][A-Za-z0-9_$#]*(?:\.[A-Za-z][A-Za-z0-9_$#]*)*)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly OracleComparisonOptions _options = options.Value;

    public async Task<TestConnectionResponse> TestConnectionAsync(
        TestConnectionRequest request,
        CancellationToken cancellationToken)
    {
        var connectionString = RequestValidator.ValidateConnectionString(request.ConnectionString);

        try
        {
            using var connection = new OracleConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            return new TestConnectionResponse(true, "Connection successful");
        }
        catch (OracleException exception)
        {
            logger.LogWarning("Oracle connection test failed with provider error {Number}.", exception.Number);
            throw new ApiException(
                StatusCodes.Status502BadGateway,
                "ORACLE_CONNECTION_FAILED",
                "Unable to connect to Oracle database. Check the host, service, and credentials.",
                exception);
        }
        catch (ArgumentException exception)
        {
            throw new ApiException(
                StatusCodes.Status400BadRequest,
                "INVALID_CONNECTION_STRING",
                "The Oracle connection string format is invalid.",
                exception);
        }
    }

    public async Task<LoadViewScriptResponse> LoadViewScriptAsync(
        LoadViewScriptRequest request,
        CancellationToken cancellationToken)
    {
        var connectionString = RequestValidator.ValidateConnectionString(request.ConnectionString);
        var schemaName = OracleIdentifierValidator.ValidateSchemaName(request.SchemaName);
        var viewName = OracleIdentifierValidator.ValidateViewName(request.ViewName);

        using var connection = new OracleConnection(connectionString);
        try
        {
            await connection.OpenAsync(cancellationToken);
        }
        catch (OracleException exception)
        {
            logger.LogWarning("Oracle data connection failed with provider error {Number}.", exception.Number);
            throw new ApiException(
                StatusCodes.Status502BadGateway,
                "ORACLE_CONNECTION_FAILED",
                "Unable to connect to Oracle database. Check the host, service, and credentials.",
                exception);
        }
        catch (ArgumentException exception)
        {
            throw new ApiException(
                StatusCodes.Status400BadRequest,
                "INVALID_CONNECTION_STRING",
                "The Oracle connection string format is invalid.",
                exception);
        }

        var stopwatch = Stopwatch.StartNew();
        string script;
        IReadOnlyList<ViewDependencyResponse> dependencies;

        try
        {
            script = await LoadViewDdlAsync(
                connection,
                schemaName,
                viewName,
                cancellationToken);
            var catalogDependencies = await LoadCatalogDependenciesAsync(
                connection,
                schemaName,
                viewName,
                cancellationToken);
            dependencies = MergeDependencies(
                catalogDependencies,
                ExtractDatabaseLinkDependencies(script));
        }
        catch (OracleException exception) when (exception.Number == 1013)
        {
            logger.LogWarning("Oracle view metadata queries exceeded the configured timeout.");
            throw new ApiException(
                StatusCodes.Status504GatewayTimeout,
                "ORACLE_QUERY_TIMEOUT",
                "Loading the view metadata exceeded the configured timeout.",
                exception);
        }
        catch (OracleException exception)
        {
            logger.LogWarning("Oracle metadata query failed with provider error {Number}.", exception.Number);
            throw new ApiException(
                StatusCodes.Status422UnprocessableEntity,
                "ORACLE_METADATA_FAILED",
                "Unable to load the view script. Verify that the schema and view exist and that the account can access their metadata.",
                exception);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ApiException(
                StatusCodes.Status504GatewayTimeout,
                "ORACLE_QUERY_TIMEOUT",
                "Loading the view metadata exceeded the configured timeout.");
        }

        stopwatch.Stop();

        var response = new LoadViewScriptResponse(
            true,
            stopwatch.ElapsedMilliseconds,
            schemaName,
            viewName,
            NormalizeScript(script),
            dependencies);

        var responseSize = JsonSerializer.SerializeToUtf8Bytes(response).Length;
        if (responseSize > _options.MaximumResponseSizeBytes)
        {
            throw new ApiException(
                StatusCodes.Status413PayloadTooLarge,
                "RESPONSE_TOO_LARGE",
                "The view metadata exceeds the configured response size.");
        }

        return response;
    }

    public Task<CompareTableCountsResponse> CompareTableCountsAsync(
        CompareTableCountsRequest request,
        CancellationToken cancellationToken)
    {
        var connectionString = RequestValidator.ValidateConnectionString(request.ConnectionString);
        var tableName = OracleIdentifierValidator.ValidateTableName(request.TableName);
        var databaseLink = OracleIdentifierValidator.ValidateDatabaseLink(request.DatabaseLink);
        return ExecuteDataOperationAsync(
            connectionString,
            "TABLE_COUNT_COMPARISON_FAILED",
            "Unable to compare the local and remote table counts.",
            async (connection, token) =>
            {
                using var command = connection.CreateCommand();
                command.CommandText = BuildCompareTableCountsQuery(tableName, databaseLink);
                ConfigureDataCommand(command);

                using var reader = await command.ExecuteReaderAsync(token);
                if (!await reader.ReadAsync(token))
                {
                    throw new ApiException(
                        StatusCodes.Status422UnprocessableEntity,
                        "TABLE_COUNT_NOT_RETURNED",
                        "Oracle returned no row count data.");
                }

                return new CompareTableCountsResponse(
                    true,
                    tableName,
                    databaseLink,
                    Convert.ToInt64(reader.GetValue(0), CultureInfo.InvariantCulture),
                    Convert.ToInt64(reader.GetValue(1), CultureInfo.InvariantCulture));
            },
            cancellationToken);
    }

    public Task<CreateTableBackupResponse> CreateTableBackupAsync(
        BackupTableRequest request,
        CancellationToken cancellationToken)
    {
        var connectionString = RequestValidator.ValidateConnectionString(request.ConnectionString);
        var tableName = OracleIdentifierValidator.ValidateTableName(request.TableName);
        var backupTableName = OracleIdentifierValidator.ValidateTableName(request.BackupTableName);

        return ExecuteDataOperationAsync(
            connectionString,
            "CREATE_TABLE_BACKUP_FAILED",
            "Unable to create the backup table. Verify that the table does not already exist and that the account has CREATE TABLE permission.",
            async (connection, token) =>
            {
                using var command = connection.CreateCommand();
                command.CommandText = BuildCreateTableBackupQuery(backupTableName, tableName);
                ConfigureDataCommand(command);
                await command.ExecuteNonQueryAsync(token);

                var rowsCopied = await CountTableRowsAsync(connection, backupTableName, token);
                return new CreateTableBackupResponse(
                    true,
                    backupTableName,
                    rowsCopied,
                    $"Backup table {backupTableName} was created with {rowsCopied} rows.");
            },
            cancellationToken);
    }

    public Task<CheckTableBackupResponse> CheckTableBackupAsync(
        BackupTableRequest request,
        CancellationToken cancellationToken)
    {
        var connectionString = RequestValidator.ValidateConnectionString(request.ConnectionString);
        _ = OracleIdentifierValidator.ValidateTableName(request.TableName);
        var backupTableName = OracleIdentifierValidator.ValidateTableName(request.BackupTableName);

        return ExecuteDataOperationAsync(
            connectionString,
            "CHECK_TABLE_BACKUP_FAILED",
            "Unable to check the backup table.",
            async (connection, token) =>
            {
                var exists = await TableExistsAsync(
                    connection,
                    backupTableName,
                    token);
                var rowCount = exists
                    ? await CountTableRowsAsync(connection, backupTableName, token)
                    : 0;

                return new CheckTableBackupResponse(
                    true,
                    backupTableName,
                    exists,
                    rowCount);
            },
            cancellationToken);
    }

    public Task<DeleteLocalTableDataResponse> DeleteLocalTableDataAsync(
        DeleteLocalTableDataRequest request,
        CancellationToken cancellationToken)
    {
        var connectionString = RequestValidator.ValidateConnectionString(request.ConnectionString);
        var tableName = OracleIdentifierValidator.ValidateTableName(request.TableName);
        var backupTableName = OracleIdentifierValidator.ValidateTableName(request.BackupTableName);

        return ExecuteDataOperationAsync(
            connectionString,
            "DELETE_LOCAL_TABLE_DATA_FAILED",
            "Unable to delete the local table data.",
            async (connection, token) =>
            {
                var localRowCount = await CountTableRowsAsync(
                    connection,
                    tableName,
                    token);
                var backupRowCount = await CountTableRowsAsync(
                    connection,
                    backupTableName,
                    token);
                EnsureBackupMatchesLocalCount(
                    backupTableName,
                    backupRowCount,
                    localRowCount,
                    tableName);

                using var transaction = connection.BeginTransaction();
                using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = BuildDeleteLocalTableDataQuery(tableName);
                ConfigureDataCommand(command);
                var deletedRows = await command.ExecuteNonQueryAsync(token);
                transaction.Commit();

                return new DeleteLocalTableDataResponse(
                    true,
                    tableName,
                    deletedRows,
                    $"Deleted {deletedRows} rows from {tableName}.");
            },
            cancellationToken);
    }

    public Task<SyncProductionDataResponse> SyncProductionDataAsync(
        CompareTableCountsRequest request,
        CancellationToken cancellationToken)
    {
        var connectionString = RequestValidator.ValidateConnectionString(request.ConnectionString);
        var tableName = OracleIdentifierValidator.ValidateTableName(request.TableName);
        var databaseLink = OracleIdentifierValidator.ValidateDatabaseLink(request.DatabaseLink);

        return ExecuteDataOperationAsync(
            connectionString,
            "SYNC_PRODUCTION_DATA_FAILED",
            "Unable to sync data from production.",
            async (connection, token) =>
            {
                var localRowCount = await CountTableRowsAsync(connection, tableName, token);
                if (localRowCount != 0)
                {
                    throw new ApiException(
                        StatusCodes.Status409Conflict,
                        "LOCAL_TABLE_NOT_EMPTY",
                        $"Sync was cancelled because {tableName} already contains {localRowCount} rows.");
                }

                using var transaction = connection.BeginTransaction();
                using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = BuildSyncDataWithProductionQuery(
                    tableName,
                    databaseLink);
                ConfigureDataCommand(command);
                var insertedRows = await command.ExecuteNonQueryAsync(token);
                transaction.Commit();

                return new SyncProductionDataResponse(
                    true,
                    tableName,
                    databaseLink,
                    insertedRows,
                    $"Inserted {insertedRows} rows into {tableName} from {databaseLink}.");
            },
            cancellationToken,
            exposeOracleError: true);
    }

    public static string BuildCompareTableCountsQuery(
        string tableName,
        string databaseLink)
    {
        var validatedName = OracleIdentifierValidator.ValidateTableName(tableName);
        var validatedDatabaseLink =
            OracleIdentifierValidator.ValidateDatabaseLink(databaseLink);
        return $"""
        SELECT
            (SELECT COUNT(*) FROM {validatedName}) AS COUNT_LOKAL,
            (SELECT COUNT(*) FROM {validatedName}@{validatedDatabaseLink}) AS COUNT_HODB_ASLI
        FROM DUAL
        """;
    }

    public static string BuildCreateTableBackupQuery(
        string backupTableName,
        string sourceTableName)
    {
        var validatedBackupName = OracleIdentifierValidator.ValidateTableName(backupTableName);
        var validatedSourceName = OracleIdentifierValidator.ValidateTableName(sourceTableName);
        return $"CREATE TABLE {validatedBackupName} AS SELECT * FROM {validatedSourceName}";
    }

    public static string BuildCheckTableBackupQuery(string backupTableName)
    {
        var validatedName = OracleIdentifierValidator.ValidateTableName(backupTableName);
        return $"SELECT COUNT(*) FROM {validatedName}";
    }

    public static string BuildTableExistsQuery() =>
        "SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = :tableName";

    public static string BuildSyncDataWithProductionQuery(
        string tableName,
        string databaseLink)
    {
        var validatedName = OracleIdentifierValidator.ValidateTableName(tableName);
        var validatedDatabaseLink =
            OracleIdentifierValidator.ValidateDatabaseLink(databaseLink);
        return $"INSERT INTO {validatedName} SELECT * FROM {validatedName}@{validatedDatabaseLink}";
    }

    public static string BuildDeleteLocalTableDataQuery(string tableName)
    {
        var validatedName = OracleIdentifierValidator.ValidateTableName(tableName);
        return $"DELETE FROM {validatedName}";
    }

    public static void EnsureBackupMatchesLocalCount(
        string backupTableName,
        long backupRowCount,
        long localRowCount,
        string sourceTableName)
    {
        if (backupRowCount != localRowCount)
        {
            throw new ApiException(
                StatusCodes.Status409Conflict,
                "BACKUP_ROW_COUNT_MISMATCH",
                $"Delete was cancelled because {backupTableName} contains {backupRowCount} rows while {sourceTableName} contains {localRowCount} rows.");
        }
    }

    public static string BuildGetViewDdlQuery() =>
        "SELECT DBMS_METADATA.GET_DDL('VIEW', :viewName, :schemaName) AS VIEW_SCRIPT FROM DUAL";

    public static string BuildGetViewDependenciesQuery() =>
        """
        SELECT REFERENCED_OWNER,
               REFERENCED_NAME,
               REFERENCED_TYPE
        FROM ALL_DEPENDENCIES
        WHERE OWNER = UPPER(:schemaName)
          AND NAME = UPPER(:viewName)
          AND TYPE = 'VIEW'
        ORDER BY REFERENCED_OWNER, REFERENCED_NAME
        """;

    public static IReadOnlyList<ViewDependencyResponse> ExtractDatabaseLinkDependencies(
        string script)
    {
        if (string.IsNullOrWhiteSpace(script))
            return [];

        var searchableScript = MaskSqlCommentsAndStringLiterals(script);
        return DatabaseLinkReferenceRegex.Matches(searchableScript)
            .Select(match => new ViewDependencyResponse(
                NormalizeCapturedIdentifier(match.Groups["owner"]),
                NormalizeCapturedIdentifier(match.Groups["name"])!,
                "REMOTE OBJECT",
                NormalizeCapturedIdentifier(match.Groups["link"])))
            .DistinctBy(DependencyKey, StringComparer.OrdinalIgnoreCase)
            .OrderBy(dependency => dependency.ReferencedOwner, StringComparer.OrdinalIgnoreCase)
            .ThenBy(dependency => dependency.ReferencedName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(dependency => dependency.DatabaseLink, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    public static string NormalizeScript(string script)
    {
        var normalized = script.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Trim();
        return normalized;
    }

    public static string ReadViewScript(object? value, int maximumLength)
    {
        if (value is null or DBNull)
        {
            throw new ApiException(
                StatusCodes.Status404NotFound,
                "VIEW_SCRIPT_NOT_FOUND",
                "Oracle returned no script for the requested view.");
        }

        if (value is OracleClob clob)
        {
            using (clob)
            {
                if (clob.IsNull)
                {
                    throw new ApiException(
                        StatusCodes.Status404NotFound,
                        "VIEW_SCRIPT_NOT_FOUND",
                        "Oracle returned no script for the requested view.");
                }

                if (clob.Length > maximumLength)
                {
                    throw ScriptTooLarge();
                }

                var requested = checked((int)clob.Length);
                var buffer = new char[requested];
                var read = requested == 0 ? 0 : clob.Read(buffer, 0, requested);
                return new string(buffer, 0, read);
            }
        }

        var script = Convert.ToString(value) ?? string.Empty;
        if (script.Length > maximumLength)
            throw ScriptTooLarge();
        return script;
    }

    private static ApiException ScriptTooLarge() =>
        new(
            StatusCodes.Status413PayloadTooLarge,
            "VIEW_SCRIPT_TOO_LARGE",
            "The view script exceeds the configured maximum length.");

    private async Task<string> LoadViewDdlAsync(
        OracleConnection connection,
        string schemaName,
        string viewName,
        CancellationToken cancellationToken)
    {
        using var command = connection.CreateCommand();
        command.CommandText = BuildGetViewDdlQuery();
        ConfigureMetadataCommand(command, schemaName, viewName);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return ReadViewScript(value, _options.MaximumViewScriptLength);
    }

    private async Task<IReadOnlyList<ViewDependencyResponse>> LoadCatalogDependenciesAsync(
        OracleConnection connection,
        string schemaName,
        string viewName,
        CancellationToken cancellationToken)
    {
        using var command = connection.CreateCommand();
        command.CommandText = BuildGetViewDependenciesQuery();
        ConfigureMetadataCommand(command, schemaName, viewName);

        var dependencies = new List<ViewDependencyResponse>();
        using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (reader.IsDBNull(1))
                continue;

            dependencies.Add(new ViewDependencyResponse(
                reader.IsDBNull(0) ? null : reader.GetString(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? "UNKNOWN" : reader.GetString(2),
                null));
        }

        return dependencies;
    }

    private void ConfigureMetadataCommand(
        OracleCommand command,
        string schemaName,
        string viewName)
    {
        command.CommandTimeout = _options.QueryTimeoutSeconds;
        command.BindByName = true;
        command.Parameters.Add("viewName", OracleDbType.Varchar2, 30).Value = viewName;
        command.Parameters.Add("schemaName", OracleDbType.Varchar2, 30).Value = schemaName;
    }

    private void ConfigureDataCommand(OracleCommand command)
    {
        command.CommandTimeout = _options.QueryTimeoutSeconds;
        command.BindByName = true;
    }

    private async Task<long> CountTableRowsAsync(
        OracleConnection connection,
        string tableName,
        CancellationToken cancellationToken)
    {
        using var command = connection.CreateCommand();
        command.CommandText = BuildCheckTableBackupQuery(tableName);
        ConfigureDataCommand(command);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt64(value, CultureInfo.InvariantCulture);
    }

    private async Task<bool> TableExistsAsync(
        OracleConnection connection,
        string tableName,
        CancellationToken cancellationToken)
    {
        using var command = connection.CreateCommand();
        command.CommandText = BuildTableExistsQuery();
        ConfigureDataCommand(command);
        command.Parameters.Add("tableName", OracleDbType.Varchar2, 30).Value = tableName;
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt64(value, CultureInfo.InvariantCulture) > 0;
    }

    private async Task<T> ExecuteDataOperationAsync<T>(
        string connectionString,
        string errorCode,
        string publicMessage,
        Func<OracleConnection, CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken,
        bool exposeOracleError = false)
    {
        using var connection = new OracleConnection(connectionString);
        try
        {
            await connection.OpenAsync(cancellationToken);
        }
        catch (OracleException exception)
        {
            logger.LogWarning("Oracle data connection failed with provider error {Number}.", exception.Number);
            throw new ApiException(
                StatusCodes.Status502BadGateway,
                "ORACLE_CONNECTION_FAILED",
                ResolveOracleErrorMessage(
                    exception,
                    exposeOracleError,
                    "Unable to connect to Oracle database. Check the host, service, and credentials."),
                exception);
        }
        catch (ArgumentException exception)
        {
            throw new ApiException(
                StatusCodes.Status400BadRequest,
                "INVALID_CONNECTION_STRING",
                "The Oracle connection string format is invalid.",
                exception);
        }

        try
        {
            return await operation(connection, cancellationToken);
        }
        catch (OracleException exception) when (exception.Number == 1013)
        {
            logger.LogWarning("Oracle data operation exceeded the configured timeout.");
            throw new ApiException(
                StatusCodes.Status504GatewayTimeout,
                "ORACLE_QUERY_TIMEOUT",
                ResolveOracleErrorMessage(
                    exception,
                    exposeOracleError,
                    "The Oracle data operation exceeded the configured timeout."),
                exception);
        }
        catch (OracleException exception)
        {
            logger.LogWarning(
                "Oracle data operation failed with provider error {Number} and code {ErrorCode}.",
                exception.Number,
                errorCode);
            throw new ApiException(
                StatusCodes.Status422UnprocessableEntity,
                errorCode,
                ResolveOracleErrorMessage(exception, exposeOracleError, publicMessage),
                exception);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ApiException(
                StatusCodes.Status504GatewayTimeout,
                "ORACLE_QUERY_TIMEOUT",
                "The Oracle data operation exceeded the configured timeout.");
        }
    }

    private static string ResolveOracleErrorMessage(
        OracleException exception,
        bool exposeOracleError,
        string fallbackMessage) =>
        exposeOracleError && !string.IsNullOrWhiteSpace(exception.Message)
            ? exception.Message
            : fallbackMessage;

    private static IReadOnlyList<ViewDependencyResponse> MergeDependencies(
        IEnumerable<ViewDependencyResponse> catalogDependencies,
        IEnumerable<ViewDependencyResponse> databaseLinkDependencies) =>
        catalogDependencies
            .Concat(databaseLinkDependencies)
            .DistinctBy(DependencyKey, StringComparer.OrdinalIgnoreCase)
            .OrderBy(dependency => dependency.ReferencedOwner, StringComparer.OrdinalIgnoreCase)
            .ThenBy(dependency => dependency.ReferencedName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(dependency => dependency.DatabaseLink, StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static string DependencyKey(ViewDependencyResponse dependency) =>
        $"{dependency.ReferencedOwner}\u001f{dependency.ReferencedName}\u001f{dependency.DatabaseLink}";

    private static string? NormalizeCapturedIdentifier(Group group)
    {
        if (!group.Success)
            return null;

        var value = group.Value.Trim();
        if (value.Length >= 2 && value[0] == '"' && value[^1] == '"')
            return value[1..^1].Replace("\"\"", "\"", StringComparison.Ordinal);

        return value.ToUpperInvariant();
    }

    private static string MaskSqlCommentsAndStringLiterals(string script)
    {
        var characters = script.ToCharArray();
        var inString = false;
        var inLineComment = false;
        var inBlockComment = false;

        for (var index = 0; index < characters.Length; index++)
        {
            if (inLineComment)
            {
                if (characters[index] is '\r' or '\n')
                    inLineComment = false;
                else
                    characters[index] = ' ';
                continue;
            }

            if (inBlockComment)
            {
                if (characters[index] == '*' && index + 1 < characters.Length && characters[index + 1] == '/')
                {
                    characters[index] = characters[index + 1] = ' ';
                    index++;
                    inBlockComment = false;
                }
                else if (characters[index] is not ('\r' or '\n'))
                {
                    characters[index] = ' ';
                }
                continue;
            }

            if (inString)
            {
                if (characters[index] == '\'' && index + 1 < characters.Length && characters[index + 1] == '\'')
                {
                    characters[index] = characters[index + 1] = ' ';
                    index++;
                }
                else if (characters[index] == '\'')
                {
                    characters[index] = ' ';
                    inString = false;
                }
                else if (characters[index] is not ('\r' or '\n'))
                {
                    characters[index] = ' ';
                }
                continue;
            }

            if (characters[index] == '-' && index + 1 < characters.Length && characters[index + 1] == '-')
            {
                characters[index] = characters[index + 1] = ' ';
                index++;
                inLineComment = true;
            }
            else if (characters[index] == '/' && index + 1 < characters.Length && characters[index + 1] == '*')
            {
                characters[index] = characters[index + 1] = ' ';
                index++;
                inBlockComment = true;
            }
            else if (characters[index] == '\'')
            {
                characters[index] = ' ';
                inString = true;
            }
        }

        return new string(characters);
    }
}
