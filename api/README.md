# api

API Ampara (C#/.NET): regras, dados, tempo real, escuta do chaveiro por MQTT, motor PII e taint.

## Como rodar

Preencher no plano 02.

## Integrantes

- Pedro

## Versão do .NET

`TargetFramework` único em `api/Directory.Build.props`: **net11.0**. Escolha registrada com base em `docs/riscos-dia1.md` (linha `net-target`): o SDK 11.0.100 recusa `net10.0` no `dotnet new` e, mesmo com o csproj editado, o app não roda (só há runtime 11.0.0). `api/global.json` fixa o SDK 11.0.100 (`rollForward: latestFeature`).

Pacotes: ASP.NET (OpenApi, JwtBearer, Mvc.Testing, SignalR.Client) e TimeProvider.Testing na 11.0.0 estável. EF Core (`Microsoft.EntityFrameworkCore`, `.Design`, `.Sqlite`) fica na 10.0.15 estável com `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, porque o provedor Npgsql para EF 11 só existe em release candidate (11.0.0-rc.3, que exige EF rc.3 exato) e o Npgsql 10 exige EF `[10.0.4, 11.0.0)`. Rodam no runtime 11 pelos assets net10.0. Reavaliar quando o Npgsql 11 sair estável.

No Windows com Git Bash, `dotnet` do `C:\Program Files\dotnet` aparece antes do SDK do scoop no PATH e não tem o SDK 11: usar `DOTNET=~/scoop/apps/dotnet-sdk/current/dotnet.exe`.

## Dados do mapa e do BO

`api/Ampara.Api/Dados/delegacias.json`, `estacoes.json` e `pm.json` vieram do WFS do GeoSampa (Prefeitura de São Paulo) pelo script `api/tools/extrair_camadas.py` (só biblioteca padrão; `python api/tools/extrair_camadas.py` regrava os três). Fonte, URLs e data de acesso em `docs/fontes.md`. `delegacias.json` alimenta o BO (`GET /api/v1/ocorrencias/{id}/bo`, delegacia mais próxima por haversine; caminho em `Delegacias:Arquivo`) e as três camadas públicas saem em `GET /api/v1/camadas/{delegacias|estacoes|pm}` (só `nome`, `lat`, `lng`).
