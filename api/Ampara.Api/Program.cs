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

var app = builder.Build();

app.UseCors();
app.MapOpenApi();
app.MapScalarApiReference();   // /scalar

app.Run();

public partial class Program;
