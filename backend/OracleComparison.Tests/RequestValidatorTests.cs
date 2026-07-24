using OracleComparison.Api.Exceptions;
using OracleComparison.Api.DTOs;
using OracleComparison.Api.Validators;
using System.ComponentModel.DataAnnotations;

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

    [Fact]
    public void RequestDto_UsesPropertyValidationWithoutRecordMetadataConflict()
    {
        var request = new TestConnectionRequest();
        var results = new List<ValidationResult>();

        var isValid = Validator.TryValidateObject(
            request,
            new ValidationContext(request),
            results,
            validateAllProperties: true);

        Assert.False(isValid);
        Assert.Contains(results, result =>
            result.MemberNames.Contains(nameof(TestConnectionRequest.ConnectionString)));
    }
}
