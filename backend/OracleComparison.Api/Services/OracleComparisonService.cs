using System.Diagnostics;
using System.Text.Json;
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

        using var command = connection.CreateCommand();
        command.CommandText = BuildGetViewDdlQuery();
        command.CommandTimeout = _options.QueryTimeoutSeconds;
        command.BindByName = true;
        command.Parameters.Add("viewName", OracleDbType.Varchar2, 30).Value = viewName;
        command.Parameters.Add("schemaName", OracleDbType.Varchar2, 30).Value = schemaName;

        var stopwatch = Stopwatch.StartNew();
        string script;

        try
        {
            var value = await command.ExecuteScalarAsync(cancellationToken);
            script = ReadViewScript(value, _options.MaximumViewScriptLength);
        }
        catch (OracleException exception) when (exception.Number == 1013)
        {
            logger.LogWarning("Oracle metadata query exceeded the configured timeout.");
            throw new ApiException(
                StatusCodes.Status504GatewayTimeout,
                "ORACLE_QUERY_TIMEOUT",
                "Loading the view script exceeded the configured timeout.",
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
                "Loading the view script exceeded the configured timeout.");
        }

        stopwatch.Stop();

        var response = new LoadViewScriptResponse(
            true,
            stopwatch.ElapsedMilliseconds,
            schemaName,
            viewName,
            NormalizeScript(script));

        var responseSize = JsonSerializer.SerializeToUtf8Bytes(response).Length;
        if (responseSize > _options.MaximumResponseSizeBytes)
        {
            throw new ApiException(
                StatusCodes.Status413PayloadTooLarge,
                "RESPONSE_TOO_LARGE",
                "The view script exceeds the configured response size.");
        }

        return response;
    }

    public static string BuildGetViewDdlQuery() =>
        "SELECT DBMS_METADATA.GET_DDL('VIEW', :viewName, :schemaName) AS VIEW_SCRIPT FROM DUAL";

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
}
