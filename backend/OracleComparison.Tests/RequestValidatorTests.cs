using OracleComparison.Api.Exceptions;
using OracleComparison.Api.Validators;

namespace OracleComparison.Tests;

public sealed class RequestValidatorTests
{
    [Fact]
    public void ValidateConnectionString_AcceptsNonEmptyValue()
    {
        Assert.Equal(
            "Data Source=database;",
            RequestValidator.ValidateConnectionString("Data Source=database;"));
    }

    [Fact]
    public void ValidateConnectionString_RejectsEmptyValue()
    {
        Assert.Throws<ApiException>(() => RequestValidator.ValidateConnectionString(""));
    }
}
