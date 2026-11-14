using Ampara.Api.Middleware;
using Ampara.Application;
using Ampara.Infrastructure;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Segredos só por variável de ambiente (já entram em builder.Configuration). A validação vem nas T3/T4.
_ = builder.Configuration["AMPARA_JWT_SECRET"];
_ = builder.Configuration["AMPARA_CRYPTO_KEY"];

if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
    builder.WebHost.UseUrls("http://localhost:5080");

var origens = builder.Configuration.GetSection("Cors:Origens").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(origens).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddOpenApi();
builder.Services.AddApplication();
builder.Services.AddInfrastructure();
builder.Services.AddExceptionHandler<ProblemaHandler>();
builder.Services.AddProblemDetails();
// Esquemas JWT entram na T4; aqui só o necessário para o pipeline combinado.
builder.Services.AddAuthentication();
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseMiddleware<CorrelacaoMiddleware>();
app.UseExceptionHandler();
app.UseMiddleware<PiiRequestMiddleware>();   // plano 03
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapOpenApi();
app.MapScalarApiReference();   // /scalar

app.Run();

public partial class Program;
