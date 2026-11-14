# Ampara — API (C#/.NET)

## Ficha da CitizenTech

| Campo | Valor |
|---|---|
| Nome | **Ampara** — "Levaram seu celular. Não levam o resto." |
| Cidade e bairro | São Paulo, capital: eixo da CPTM Linha 9-Esmeralda (Pinheiros como estação crítica) e corredores de quebra-vidro (ex.: Av. do Estado) |
| Cidadão beneficiado | Quem anda com o celular em SP (passageiro de trem/metrô, motorista parado no trânsito) e o **guardião** (parente ou amigo que age por ele na hora) |
| Problema, em uma frase | Depois de um roubo de celular, a vítima fica de 30 a 90 minutos sem aparelho e em choque até chegar em casa ou no trabalho, e é nessa janela que os criminosos entram no banco e nas contas. |
| Como funciona | Antes: o app guarda o que a vítima não lembraria na hora (IMEI, bancos, operadora, guardiões) e a rota dos últimos 7 dias. Durante: um clique no chaveiro (ESP32) ou um código digitado em outro aparelho dispara um alarme insistente no celular do guardião, que segue um passo a passo de bloqueio enquanto a vítima ainda está a caminho. Depois: por outro aparelho, a vítima marca na rota onde e quando foi roubada e o Ampara gera o BO com o IMEI; a ocorrência, minimizada e com consentimento, vai para um painel da polícia (simulado), e o andamento volta ao cidadão. Um mapa mostra o risco previsto por um modelo treinado com dados da SSP-SP e relatos das últimas 2 horas com proteção contra abuso. O Ampara não bloqueia o celular: avisa quem pode bloquear contas e linha. |
| O que cada parte faz | **App** (Expo): cadastro, guardiões, alarme, mapa, histórico de rota, BO. **Página de emergência** (web): acesso por outro aparelho. **API Ampara** (C#/.NET): regras, dados, tempo real, escuta do chaveiro por MQTT, motor PII e taint. **Ponte Polícia** (Python/FastAPI): recebe ocorrências minimizadas e mostra pontos quentes à polícia. **ML** (Python): risco por área e horário. **Chaveiro** (ESP32/Wokwi, Vitor): botão de pânico que fala por MQTT com a API. **VM Linux**: provisiona e mantém tudo no ar. **Painel Risco Cidadão**: bloqueios de segurança traduzidos por IA. |
| Link do repositório | (preencher ao publicar) |
| Indicador de impacto | minutos entre o roubo e o primeiro bloqueio confirmado pelo guardião; % de BOs gerados com IMEI válido; tempo para gerar o BO |
| ODS conectados | **11, 10, 9** (na lista do briefing) e **16** (adicional, fora da lista do briefing) |

## Como rodar

Pré-requisitos: SDK .NET 11 (`api/global.json`) e um PostgreSQL. No Windows com Git Bash, use `DOTNET=~/scoop/apps/dotnet-sdk/current/dotnet.exe` (ver abaixo).

1. Copie `.env.example` para `.env` (nunca commite) e exporte as variáveis. Segredos só existem em variável de ambiente.

| Variável | Para que serve |
|---|---|
| `AMPARA_DB` | conexão Npgsql com o PostgreSQL (obrigatória) |
| `AMPARA_JWT_SECRET` | segredo do JWT, 64+ caracteres (obrigatória) |
| `AMPARA_CRYPTO_KEY` | chave AES-GCM de 32 bytes em base64 para IMEI e contas (obrigatória) |
| `AMPARA_DEMO` | `true` semeia o catálogo e os usuários sintéticos da demonstração (e, no plano 03, habilita a simulação de ataque); `false` em produção |
| `RISCO_CSV` | tabela de risco gerada pelo ML (`ml/saida/risco.csv`); ausente = mapa de risco vazio e aviso no log |
| `MQTT_HOST` / `MQTT_PORT` | broker que recebe o chaveiro (`broker.hivemq.com` / `1883`) |
| `PONTE_URL` / `PONTE_CHAVE_SERVICO` | endereço da Ponte Polícia e segredo de serviço compartilhado |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | tradução do Painel Risco Cidadão (plano 03) |

2. Crie o esquema e o catálogo: `dotnet run --project api/Ampara.Api -- --migrar` (aplica as migrations, semeia o catálogo e, com `AMPARA_DEMO=true`, os usuários da demonstração; sai com código 0). Nunca rode `--migrar` num banco que não seja seu.
3. Suba a API: `dotnet run --project api/Ampara.Api` (porta 5080). `GET /health` devolve `{"status":"ok","mqtt":true,"db":true}`; a documentação interativa está em `http://localhost:5080/scalar`.
4. Testes: `dotnet test api/Ampara.sln`. Usam SQLite em memória, relógio falso e fakes de MQTT e da Ponte, então não precisam de banco nem de rede.

### Demonstração

Com `AMPARA_DEMO=true` a API semeia, de forma idempotente, dados **sintéticos** (nada é de pessoa real): `admin@ampara.demo` (papel `admin`, único caminho que cria um admin), `vitima@ampara.demo`, `guardiao1@ampara.demo` e `guardiao2@ampara.demo`, todos com a senha de demonstração `Demo!2026-sintetico`. A vítima tem consentimento de rota, código de emergência `482915` com a palavra `girassol`, um aparelho de IMEI de exemplo e os dois guardiões vinculados em ordem. O chaveiro não vem pareado: pareie o `deviceId` pelo app ou pelo Scalar (`POST /api/v1/chaveiros`). Prova do ciclo chaveiro → MQTT → API: `python api/tools/publicar_alerta.py <deviceId pareado>` (espera o ack em até 15 s). Evidências da última rodada em `api/evidencias/`.

## Arquitetura em 5 linhas

- `Ampara.Domain`: entidades com comportamento, enums e `IGatilho` (web, guardião, chaveiro, impacto), sem dependências.
- `Ampara.Application`: serviços por interface (auth, aparelhos, contas, guardiões, rota, ocorrências, escalada, BO, Ponte, relatos, risco) sobre a porta `IAmparaDb`; tempo sempre por `TimeProvider`.
- `Ampara.Infrastructure`: EF Core/Npgsql, cifra AES-GCM, PBKDF2, JWT, MQTTnet (escuta do chaveiro), cliente HTTP da Ponte Polícia, seeders e leitura da tabela de risco.
- `Ampara.Api`: Minimal APIs em `/api/v1`, JWT com escopos `usuario` e `emergencia`, SignalR (`/hubs/guardiao`), workers de retenção e escalada, OpenAPI e Scalar.
- `Ampara.Tests`: xUnit com `WebApplicationFactory`, SQLite em memória e fakes; as interfaces do plano 03 (`ITaintGuard`, `IAcessoIndevido`, `IImeiRevelador`, `IModeradorRelato`) têm implementações no-op prontas para troca.

## Rotas

A fonte de verdade é o Scalar (`/scalar`) e o documento OpenAPI (`/openapi/v1.json`). Grupos, todos sob `/api/v1`:

| Grupo | Rotas |
|---|---|
| Saúde | `GET /health` (sem o prefixo `/api/v1`) |
| Auth e conta | `/auth/registrar`, `/auth/login`, `/auth/emergencia`, `/me`, `/me/emergencia`, `/me/consentimento-rota` |
| Cadastro | `/aparelhos`, `/contas` e `/contas/catalogo`, `/guardioes` (convites, aceite, ordem), `/chaveiros` (pareamento, estado, comandos) |
| Rota | `/rota/pontos`, `/rota` |
| Ocorrência | `/ocorrencias/gatilho`, `/ocorrencias`, `/ocorrencias/{id}` (momento, cancelar, passos, BO) |
| Alertas | `/alertas/ativos`, `/alertas/{id}/ciente` |
| Polícia | `/ocorrencias/{id}/compartilhar-policia`, `/retorno`, `/acompanhamento` |
| Mapa | `/camadas/{tipo}` (delegacias, estacoes, pm), `/risco`, `/relatos` (criar, confirmar, listar) |

## O que o plano 03 (cyber) acrescenta

Motor PII no `PiiRequestMiddleware` e `Sensitive<T>`; implementações reais de taint, acesso indevido, revelação de IMEI e moderação de relatos no lugar dos no-ops; `ITradutorRisco` (Claude API) e o Painel Risco Cidadão; as rotas `/seguranca/meu-risco`, `/seguranca/executivo` e `/seguranca/simular-ataque`; a tabela `EventosSeguranca`.

## Integrantes

- Pedro Martins
- Vitor Cesarino Marchese

## Versão do .NET

`TargetFramework` único em `api/Directory.Build.props`: **net11.0**. Escolha registrada com base em `docs/riscos-dia1.md` (linha `net-target`): o SDK 11.0.100 recusa `net10.0` no `dotnet new` e, mesmo com o csproj editado, o app não roda (só há runtime 11.0.0). `api/global.json` fixa o SDK 11.0.100 (`rollForward: latestFeature`).

Pacotes: ASP.NET (OpenApi, JwtBearer, Mvc.Testing, SignalR.Client) e TimeProvider.Testing na 11.0.0 estável. EF Core (`Microsoft.EntityFrameworkCore`, `.Design`, `.Sqlite`) fica na 10.0.15 estável com `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, porque o provedor Npgsql para EF 11 só existe em release candidate (11.0.0-rc.3, que exige EF rc.3 exato) e o Npgsql 10 exige EF `[10.0.4, 11.0.0)`. Rodam no runtime 11 pelos assets net10.0. Reavaliar quando o Npgsql 11 sair estável.

No Windows com Git Bash, `dotnet` do `C:\Program Files\dotnet` aparece antes do SDK do scoop no PATH e não tem o SDK 11: usar `DOTNET=~/scoop/apps/dotnet-sdk/current/dotnet.exe`.

## Dados do mapa e do BO

`api/Ampara.Api/Dados/delegacias.json`, `estacoes.json` e `pm.json` vieram do WFS do GeoSampa (Prefeitura de São Paulo) pelo script `api/tools/extrair_camadas.py` (só biblioteca padrão; `python api/tools/extrair_camadas.py` regrava os três). Fonte, URLs e data de acesso em `docs/fontes.md`. `delegacias.json` alimenta o BO (`GET /api/v1/ocorrencias/{id}/bo`, delegacia mais próxima por haversine; caminho em `Delegacias:Arquivo`) e as três camadas públicas saem em `GET /api/v1/camadas/{delegacias|estacoes|pm}` (só `nome`, `lat`, `lng`).
