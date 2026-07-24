using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;
using OracleComparison.Api.Exceptions;
using OracleComparison.Api.Models;
using OracleComparison.Api.Services;
using OracleComparison.Api.Validators;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(api =>
    {
        api.InvalidModelStateResponseFactory = context =>
        {
            var message = context.ModelState.Values
                .SelectMany(value => value.Errors)
                .Select(error => error.ErrorMessage)
                .FirstOrDefault() ?? "The request is invalid.";
            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(
                new OracleComparison.Api.DTOs.ApiErrorResponse(
                    false,
                    message,
                    "VALIDATION_FAILED"));
        };
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.Configure<OracleComparisonOptions>(
    builder.Configuration.GetSection(OracleComparisonOptions.SectionName));
builder.Services.AddSingleton<IValidateOptions<OracleComparisonOptions>, OracleComparisonOptionsValidator>();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddScoped<IOracleComparisonService, OracleComparisonService>();

var options = builder.Configuration
    .GetSection(OracleComparisonOptions.SectionName)
    .Get<OracleComparisonOptions>() ?? new OracleComparisonOptions();

builder.Services.Configure<FormOptions>(form =>
{
    form.MultipartBodyLengthLimit = options.MaximumRequestSizeBytes;
});

builder.WebHost.ConfigureKestrel(server =>
{
    server.Limits.MaxRequestBodySize = options.MaximumRequestSizeBytes;
});

builder.Services.AddCors(cors =>
{
    cors.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(options.AllowedCorsOrigin)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseExceptionHandler();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();

public partial class Program;
