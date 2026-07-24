FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY OracleComparison.Api/OracleComparison.Api.csproj OracleComparison.Api/
RUN dotnet restore OracleComparison.Api/OracleComparison.Api.csproj
COPY OracleComparison.Api/ OracleComparison.Api/
RUN dotnet publish OracleComparison.Api/OracleComparison.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "OracleComparison.Api.dll"]
