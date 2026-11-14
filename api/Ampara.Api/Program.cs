using Ampara.Api.Cyber;
using Ampara.Api.Endpoints;
using Ampara.Api.Middleware;
using Ampara.Application;
using Ampara.Application.Auth;
using Ampara.Infrastructure;
using Ampara.Infrastructure.Seguranca;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
    builder.WebHost.UseUrls("http://localhost:5080");

var origens = builder.Configuration.GetSection("Cors:Origens").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(origens).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddSingleton<Ampara.Application.Alertas.IGuardiaoNotificador, Ampara.Api.Hubs.SignalRGuardiaoNotificador>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure();
builder.Services.AddCyber(builder.Configuration);
builder.Services.AddHostedService<Ampara.Api.Workers.RetencaoWorker>();
builder.Services.AddHostedService<Ampara.Api.Workers.EscalonamentoWorker>();
builder.Services.AddExceptionHandler<ProblemaHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
// Configurado de forma preguiçosa para enxergar a config final do host (inclusive a dos testes).
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IConfiguration, TimeProvider>((o, cfg, tempo) =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = TokenService.Emissor,
            ValidateAudience = true,
            ValidAudience = TokenService.Audiencia,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = TokenService.ChaveDoSegredo(cfg["AMPARA_JWT_SECRET"]),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = "sub",
            RoleClaimType = "role",
            ClockSkew = TimeSpan.FromSeconds(30),
            // O relógio da aplicação (TimeProvider) manda na validade, para os testes com FakeTimeProvider.
            LifetimeValidator = (antes, expira, _, p) =>
            {
                var agora = tempo.GetUtcNow().UtcDateTime;
                return (antes is null || antes.Value <= agora + p.ClockSkew) && expira is not null && expira.Value >= agora - p.ClockSkew;
            },
        };
        // Navegadores não mandam cabeçalho no WebSocket: o token do SignalR vem na query, só em /hubs.
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Usuario", p => p.RequireAuthenticatedUser().RequireClaim("scope", "usuario"))
    .AddPolicy("UsuarioOuEmergencia", p => p.RequireAuthenticatedUser().RequireClaim("scope", "usuario", "emergencia"))
    .AddPolicy("Admin", p => p.RequireAuthenticatedUser().RequireClaim("scope", "usuario").RequireClaim("role", "admin"));

var app = builder.Build();

// Falha na subida se AMPARA_CRYPTO_KEY faltar ou nao tiver 32 bytes.
_ = app.Services.GetRequiredService<Ampara.Application.Comum.ICifrador>();
// Falha na subida se AMPARA_JWT_SECRET faltar ou tiver menos de 64 caracteres, ou se AMPARA_DB faltar.
_ = app.Services.GetRequiredService<ITokenService>();
_ = Ampara.Infrastructure.DependencyInjection.StringDeConexao(app.Configuration);
// Carrega as delegacias e as camadas do mapa na subida (arquivo ausente = lista vazia e aviso no log).
_ = app.Services.GetRequiredService<Ampara.Application.Bo.IDelegaciaLocator>();
_ = app.Services.GetRequiredService<Ampara.Infrastructure.Dados.CamadasMapa>();

var caminhoCatalogo = Path.Combine(AppContext.BaseDirectory, "Dados", "catalogo-contas.json");

if (args.Contains("--migrar"))
{
    using var escopo = app.Services.CreateScope();
    var db = escopo.ServiceProvider.GetRequiredService<AmparaDbContext>();
    await db.Database.MigrateAsync();
    await Ampara.Infrastructure.Dados.CatalogoSeeder.SemearAsync(db, caminhoCatalogo, CancellationToken.None);
    var total = await db.Catalogo.CountAsync();
    if (total < Ampara.Infrastructure.Dados.CatalogoSeeder.MinimoEsperado) throw new InvalidOperationException($"Catalogo com {total} itens (esperado >= {Ampara.Infrastructure.Dados.CatalogoSeeder.MinimoEsperado}).");
    if (app.Configuration.GetValue<bool>("AMPARA_DEMO")) await SemearDemoAsync(escopo.ServiceProvider);
    return;
}

// Modo demonstracao: semeia o catalogo na subida.
if (app.Configuration.GetValue<bool>("AMPARA_DEMO"))
{
    using var escopoDemo = app.Services.CreateScope();
    await Ampara.Infrastructure.Dados.CatalogoSeeder.SemearAsync(
        escopoDemo.ServiceProvider.GetRequiredService<AmparaDbContext>(), caminhoCatalogo, CancellationToken.None);
    await SemearDemoAsync(escopoDemo.ServiceProvider);
}

app.UseCyber();   // CorrelacaoMiddleware, UseExceptionHandler, PiiRequestMiddleware (nesta ordem)
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapAmparaEndpoints();
app.MapHub<Ampara.Api.Hubs.GuardiaoHub>("/hubs/guardiao");
app.MapOpenApi();
app.MapScalarApiReference();   // /scalar

app.Run();

// Usuarios sinteticos da demonstracao (admin inclusive); so e chamado com AMPARA_DEMO=true.
static Task SemearDemoAsync(IServiceProvider sp) => Ampara.Infrastructure.Dados.DemoSeeder.SemearAsync(
    sp.GetRequiredService<AmparaDbContext>(), sp.GetRequiredService<ISenhaHasher>(),
    sp.GetRequiredService<Ampara.Application.Comum.ICifrador>(), sp.GetRequiredService<TimeProvider>(), CancellationToken.None);

public partial class Program;
