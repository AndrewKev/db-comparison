using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using OracleComparison.Api.Exceptions;
using OracleComparison.Api.Models;
using OracleComparison.Api.Services;
using OracleComparison.Api.Validators;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

var publishMetadata = typeof(Program).Assembly
    .GetCustomAttributes<AssemblyMetadataAttribute>()
    .Where(attribute => !string.IsNullOrWhiteSpace(attribute.Value))
    .ToDictionary(attribute => attribute.Key, attribute => attribute.Value!);

if (publishMetadata.TryGetValue("PublishedUrls", out var publishedUrls))
    builder.WebHost.UseUrls(publishedUrls);

if (publishMetadata.TryGetValue("PublishedAllowedCorsOrigin", out var publishedAllowedCorsOrigin))
{
    builder.Configuration[
        $"{OracleComparisonOptions.SectionName}:{nameof(OracleComparisonOptions.AllowedCorsOrigin)}"] =
        publishedAllowedCorsOrigin;
}

var frontendIsEmbedded =
    publishMetadata.TryGetValue("FrontendEmbedded", out var embeddedValue) &&
    bool.TryParse(embeddedValue, out var isEmbedded) &&
    isEmbedded;

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

StaticFileOptions? embeddedStaticFileOptions = null;
if (frontendIsEmbedded)
{
    var embeddedFrontend = new ManifestEmbeddedFileProvider(
        typeof(Program).Assembly,
        "wwwroot");
    embeddedStaticFileOptions = new StaticFileOptions
    {
        FileProvider = embeddedFrontend
    };
    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = embeddedFrontend
    });
    app.UseStaticFiles(embeddedStaticFileOptions);
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseCors("Frontend");
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
if (embeddedStaticFileOptions is not null)
    app.MapFallbackToFile("index.html", embeddedStaticFileOptions);
else
    app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
