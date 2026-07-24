using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OracleComparison.Api.DTOs;
using OracleComparison.Api.Models;
using OracleComparison.Api.Services;

namespace OracleComparison.Tests;

public sealed class OracleIntegrationTests
{
    [Fact]
    public async Task TestConnection_WhenConfigured()
    {
        var connectionString = Environment.GetEnvironmentVariable("ORACLE_TEST_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var service = new OracleComparisonService(
            Options.Create(new OracleComparisonOptions()),
            NullLogger<OracleComparisonService>.Instance);

        var response = await service.TestConnectionAsync(
            new TestConnectionRequest(connectionString),
            CancellationToken.None);

        Assert.True(response.Success);
    }
}
