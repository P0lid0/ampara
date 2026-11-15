# Ampara — índice dos planos e contratos compartilhados

**Spec:** `docs/superpowers/specs/2026-11-14-ampara-design.md` (v3). Todo plano argumenta a partir dela e deste arquivo. Quando um plano e este arquivo divergirem, **este arquivo vence** (é a fonte única dos nomes, rotas, formatos e variáveis).

## Planos e cronograma

Hoje: sábado 14/11. Entrega: quinta 19/11, 23h55. Equipe: Pedro (tudo menos IoT) e Vitor (IoT).

| # | Plano | Arquivo | Quando | Depende de |
|---|---|---|---|---|
| 01 | Fundação e testes de risco do dia 1 | `2026-11-14-01-fundacao.md` | sáb 14 – dom 15 manhã | — |
| 02 | API Ampara (C#) | `2026-11-14-02-api.md` | dom 15 – seg 16 | 01 |
| 03 | Cyber: PII, taint, IA, painel e PDF | `2026-11-14-03-cyber.md` | seg 16 – ter 17 | 02 (tarefas de domínio e pipeline) |
| 04 | Ponte Polícia (Python) | `2026-11-14-04-ponte-policia.md` | seg 16 | 01 (contrato abaixo) |
| 05 | App Expo + página de emergência | `2026-11-14-05-app-web.md` | seg 16 – ter 17 | 02 (rotas abaixo) |
| 06 | ML | `2026-11-14-06-ml.md` | dom 15 – ter 17 (treinos em segundo plano) | 01 (dados) |
| 07 | VM Linux (SO) | `2026-11-14-07-infra.md` | ter 17 – qua 18 | 02, 04, 05 publicáveis |
| 08 | QA, entregas, vídeos e pitch | `2026-11-14-08-qa-entregas.md` | qua 18 – qui 19 | todos |

IoT: entregue pelo Vitor no repositório dele (submódulo `iot/`). Os combinados com ele estão na seção 15 da spec; o plano 08 tem a checagem final.

## Regras globais (valem para todas as tarefas)

- Nada de dado pessoal real. Pessoas, IMEIs, telefones e rotas de demonstração são sintéticos e marcados `# SINTETICO`/`// SINTETICO` no código e nos seeds.
- Segredos só em variável de ambiente; `.env` no `.gitignore`; existe `.env.example` sem valores.
- `prompts.md` na raiz: cada tarefa executada com ajuda de IA acrescenta o prompt usado.
- Textos de interface em português do Brasil, linguagem simples (ver acessibilidade na spec 6.6).
- Commits pequenos na `main`, só depois de rodar a verificação da tarefa (preferência do Pedro: testar antes de commitar).
- .NET: chamar `C:\Users\pedro.martins\scoop\apps\dotnet-sdk\current\dotnet.exe` (o `dotnet` do PATH aponta para um runtime antigo). Nos scripts Bash: `DOTNET="$HOME/scoop/apps/dotnet-sdk/current/dotnet.exe"`.
- Android SDK: comandos com sufixo `.bat` no Windows (`sdkmanager.bat`, `avdmanager.bat`). AVDs: `guardiao_vitima`, `guardiao_guardiao`.
- Downloads grandes (QEMU, imagem Ubuntu, planilhas SSP) só com o ok do Pedro.

## Variáveis de ambiente

| Variável | Quem usa | Exemplo / padrão |
|---|---|---|
| `AMPARA_DB` | API | `Host=localhost;Port=5432;Database=ampara;Username=ampara;Password=...` |
| `AMPARA_JWT_SECRET` | API | 64+ caracteres aleatórios |
| `AMPARA_CRYPTO_KEY` | API | 32 bytes em base64 (AES-GCM para IMEI e contas) |
| `AMPARA_DEMO` | API | `true` habilita `POST /api/v1/seguranca/simular-ataque` e a flag de taint desligado; `false` em "produção" |
| `RISCO_CSV` | API | caminho de `ml/saida/risco.csv` |
| `MQTT_HOST` / `MQTT_PORT` | API | `broker.hivemq.com` / `1883` |
| `PONTE_URL` / `PONTE_CHAVE_SERVICO` | API e Ponte | `http://localhost:8000` / segredo compartilhado |
| `PONTE_DB` | Ponte | `postgresql+psycopg://ponte:...@localhost:5432/ponte` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | API | chave do Pedro / `claude-haiku-5-5` |
| `EXPO_PUBLIC_API_URL` | App e web | `http://10.0.2.2:5080` no emulador; URL do túnel na demo |

Portas de desenvolvimento: API 5080, Ponte 8000, web Vite 5173. Na VM, nginx em 80: `/` página de emergência, `/painel-risco` painel Risco Cidadão, `/policia` painel da Ponte, `/api` e `/hubs` → API, `/ponte` → Ponte.

## Área do mapa (mesma função em C# e Python)

Grade de ~500 m sobre a capital. Limites: lat −23.80 a −23.35, lng −46.83 a −46.36. Célula: 0.0045° de latitude × 0.0049° de longitude.

```
linha  = floor((lat - (-23.80)) / 0.0045)
coluna = floor((lng - (-46.83)) / 0.0049)
area_id = f"g{linha:03d}_{coluna:03d}"      # ex.: g052_031
centro = (-23.80 + (linha + 0.5) * 0.0045, -46.83 + (coluna + 0.5) * 0.0049)
fora dos limites -> area_id = "fora"
```
Teste de referência (os dois lados): `area_id(-23.5672490, -46.7019515) == "g051_026"` (estação Pinheiros).

Faixa horária: 8 faixas de 3 h, `faixa = hora // 3` (0 = 00h–03h … 7 = 21h–24h). Dia da semana: 0 = segunda … 6 = domingo.

## Saída do ML consumida pela API

`ml/saida/risco.csv`, UTF-8, separador vírgula, cabeçalho exato:
`area_id,lat,lng,dia_semana,faixa,classe,prob_alto`
- `classe` ∈ `baixo`, `medio`, `alto`; `prob_alto` em [0,1] com 4 casas. A API importa no início (`IRiscoService.Importar(caminho)`) e responde `GET /api/v1/risco`.

## API Ampara — rotas (`/api/v1`, JSON, JWT Bearer salvo onde indicado)

| Método e rota | Auth | Corpo → resposta |
|---|---|---|
| `GET /health` | — | `{ "status": "ok", "mqtt": true/false, "db": true/false }` |
| `POST /auth/registrar` | — | `{nome, email, senha}` → 201 `{usuarioId}` |
| `POST /auth/login` | — | `{email, senha}` → `{token, expiraEm}` |
| `POST /auth/emergencia` | — | `{email, codigo, palavraSecreta}` → `{token, expiraEm}` (escopo `emergencia`, 30 min); 5 erros em 15 min → 429 |
| `PUT /me/emergencia` | JWT | `{codigo, palavraSecreta}` → 204 |
| `PUT /me/consentimento-rota` | JWT | `{aceito: bool}` → 204 |
| `POST /aparelhos` | JWT | `{imei, marca, modelo}` → 201; IMEI inválido (Luhn/15 dígitos) → 422 |
| `GET /contas/catalogo` | — | `[{id, nome, tipo: "banco"|"operadora", telefone, link, conferidoEm}]` |
| `POST /contas` | JWT | `{catalogoId}` → 201 |
| `POST /guardioes/convites` | JWT | → `{codigo (6 caracteres), expiraEm}` |
| `POST /guardioes/convites/{codigo}/aceitar` | JWT (guardião) | → 204 |
| `GET /guardioes` / `PUT /guardioes/ordem` | JWT | lista `{guardiaoId, nome, ordem}` / `{ordem: [guardiaoId]}` (máx. 3) |
| `POST /chaveiros` | JWT | `{deviceId}` → 201 |
| `GET /chaveiros` | JWT | `[{deviceId, online, bateria, vistoEm}]` |
| `POST /chaveiros/{deviceId}/comandos` | JWT | `{cmd: "find"|"ping"|"resolve"}` → 202 |
| `POST /rota/pontos` | JWT | `[{lat, lng, precisao, em}]` (lote até 500) → 202 |
| `GET /rota?de=&ate=` | JWT ou emergência (só do dono) | `[{lat, lng, em}]` |
| `POST /ocorrencias/gatilho` | emergência ou guardião | `{origem: "web"|"guardiao", vitimaId?}` → 201 `{ocorrenciaId}` |
| `GET /ocorrencias` / `GET /ocorrencias/{id}` | JWT/emergência/guardião | `{id, estado, origem, iniciadaEm, momento?, passos[], alertas[]}` |
| `POST /ocorrencias/{id}/momento` | emergência ou JWT | `{em, lat, lng}` → 204 |
| `POST /ocorrencias/{id}/cancelar` | dono | → 204 |
| `GET /ocorrencias/{id}/bo` | dono/emergência | `{texto, delegacia: {nome, endereco, lat, lng}, linkDelegaciaEletronica}` |
| `POST /ocorrencias/{id}/compartilhar-policia` | dono/emergência | `{consentimento: true}` → `{protocolo}` |
| `GET /ocorrencias/{id}/retorno` | dono | `{protocolo, status, mensagem, atualizadoEm}` |
| `GET /alertas/ativos` / `POST /alertas/{id}/ciente` | guardião | lista / 204 |
| `POST /ocorrencias/{id}/passos/{passo}/concluir` | guardião | `passo` ∈ `Banco, CelularSeguro, Operadora, Senhas, Bo` → 204 |
| `POST /relatos` | JWT | `{tipo: "roubo"|"furto"|"suspeita", lat, lng, em, texto?}` → 201 |
| `POST /relatos/{id}/confirmar` / `GET /relatos?minLat=&minLng=&maxLat=&maxLng=` | JWT | 204 / só relatos visíveis (≥ 2 confirmações ou risco alto; < 2 h) |
| `GET /risco?minLat=&minLng=&maxLat=&maxLng=&dia=&faixa=` | — | `[{areaId, lat, lng, classe, probAlto}]` |
| `GET /seguranca/meu-risco` | JWT | `{indice, farol: "verde"|"amarelo"|"vermelho", eventos: [EventoSegurancaDto]}` |
| `GET /seguranca/executivo` | papel `admin` | `{porClasse: {..}, porSink: {..}, porHora: [..], total24h}` |
| `POST /seguranca/simular-ataque` | `AMPARA_DEMO=true` | `{cenario: "cpf-no-log"|"senha-na-resposta"|"laudo-no-erro"|"acesso-indevido"}` → 202 |

Erros: `application/problem+json`; o corpo nunca contém valor de PII; o campo `detalheCidadao` traz a frase traduzida pela IA (plano 03).

### SignalR — hub `/hubs/guardiao` (JWT do guardião)
Servidor → cliente:
- `AlertaDisparado` `{alertaId, ocorrenciaId, vitimaNome, origem, em}`
- `AlertaEscalado` `{alertaId, paraGuardiaoId, em}`
- `AlertaEncerrado` `{alertaId, motivo: "ciente"|"cancelado"|"encerrado"}`
- `PassoAtualizado` `{ocorrenciaId, passo, concluidoEm}`
Cliente → servidor: nenhum (ações via REST).

### MQTT (contrato do Vitor, sem mudança)
Broker `broker.hivemq.com:1883`; tópicos `citizentech/chaveiro/{deviceId}/events`, `/status` (retido), `/cmd`. Eventos `alert | cancel | test | low_battery` (+ `impact` se o Vitor acrescentar). Comandos `{"cmd":"ack","eventId":...}`, `resolve`, `find`, `ping`. A API é o **único** componente que responde `ack`; ack em toda repetição, ação só na primeira (`EventoRecebido.eventId` único). `deviceId` de demonstração: `chaveiro-ampara-` + 6 caracteres aleatórios.

## Ponte Polícia — rotas (FastAPI, porta 8000)

| Método e rota | Auth | Corpo → resposta |
|---|---|---|
| `GET /health` | — | `{status: "ok"}` |
| `POST /ocorrencias` | cabeçalho `X-Chave-Servico` | `{origem_id: uuid, area_id: str, ts: ISO-8601, tipo: "roubo_celular"|"furto_celular", origem_gatilho: "chaveiro"|"web"|"guardiao"|"impacto", device_hash: sha256-hex, trilha: [{lat, lng, em}]}` → 201 `{protocolo: "PP-2026-000001", status: "recebida"}`; mesmo `origem_id` → 200 com o mesmo protocolo; payload com PII (CPF, e-mail, telefone, IMEI, nome) → 422 |
| `GET /ocorrencias/{protocolo}/retorno` | `X-Chave-Servico` | `{protocolo, status, mensagem, atualizado_em}` |
| `PATCH /ocorrencias/{protocolo}/status` | papel polícia (cabeçalho `X-Chave-Policia`) | `{status: "em_analise"|"atendida"|"descartada", mensagem}` → 200 |
| `GET /hotspots?janela_min=60` | `X-Chave-Policia` | `[{area_id, lat, lng, total, risco_previsto}]` |
| `GET /policia` | — | painel HTML (consome as rotas acima) |

`device_hash = sha256(deviceId + PONTE_CHAVE_SERVICO)` em hex minúsculo (calculado na API).

## Evento de segurança (API → banco → painel → IA)

`EventoSeguranca { id, em, correlationId, source: "http"|"form"|"query"|"header"|"mqtt", campo, classe: "Cpf"|"Rg"|"Imei"|"Telefone"|"Email"|"Placa"|"Senha"|"Saude", sink: "Log"|"HttpNaoAutenticada"|"Erro"|"Ponte"|"SignalR"|"Llm"|"Banco", decisao: "Bloqueado"|"Mascarado"|"Permitido"|"Cifrado", usuarioAlvoId?, mensagemCidadao? }`
O valor do dado nunca é gravado. Pesos do índice (24 h, teto 100): log bloqueado 10; resposta não autenticada bloqueada 25; acesso indevido 40. Farol: verde < 30, amarelo 30–69, vermelho ≥ 70.

## Decisões de contrato (rodada 2 — fecha as lacunas levantadas pelos planos; vencem qualquer trecho anterior)

**Gerais**
- Datas e horas: ISO-8601 em UTC com `Z` em toda API, Ponte e app; exibição em `America/Sao_Paulo`.
- `applicationId` Android: `br.fiap.ampara`.
- `deviceId` de demonstração: `chaveiro-ampara-` + 6 caracteres hex (`secrets.token_hex(3)`); `eventId` no padrão do Vitor `{deviceId}-{N}`.
- Resultados do dia 1: `docs/riscos-dia1.md` (linhas `chave: valor`: `TargetFramework`, `ExpoSDK`, `SSP_VEREDITO`, `SSP_CELULAR`, `MQTT_HOST_EFETIVO`, `VM`) e `docs/dados-ssp-colunas.md`. Os planos 02, 05, 06 e 07 leem esses arquivos antes de começar.
- Dados brutos: `ml/dados/brutos/<fonte>/` (ex.: `ml/dados/brutos/ssp/`), fora do git. (Onde o plano 01 escreveu `ml/dados/bruto/`, vale `ml/dados/brutos/ssp/`.)
- Pastas web: `web-emergencia/` (Vite 5173) e `web-painel-risco/` (Vite 5174, build com `--base=/painel-risco/`). Ambas aceitam `EXPO_PUBLIC_API_URL`/`VITE_API_URL` vazio = mesma origem e concatenam `/api/v1`.
- Evidências: `api/evidencias/`, `ponte-policia/evidencias/`, `infra/evidencias/`, `ml/figuras/`. Pasta `entrega/` (fora do git) recebe os artefatos de envio: `entrega/cyber/ampara-cyber.pdf`, `entrega/cyber/ampara-cyber-codigo.zip`, `entrega/testing/ampara-testing.pdf`.
- `docs/ods.md` (explicação dos ODS) e `docs/rascunhos/*.jpg` (fotos dos rascunhos em papel).
- Nomes completos e RMs do Pedro e do Vitor: perguntar ao Pedro na primeira tarefa que precisar (plano 01, Tarefa 1).

**API Ampara**
- `GET /health` fica na **raiz** (não em `/api/v1`): 200 `{status: "ok"|"degradado", mqtt, db}` (degradado = MQTT fora); 503 `{status: "falha", ...}` se o banco não responde. Saudável = 200. Na VM: `http://127.0.0.1:5080/health`; o nginx também expõe `/health`.
- Migrations: `dotnet Ampara.Api.dll --migrar` (executa `Database.MigrateAsync()` e sai 0). A VM usa isso; não precisa de `dotnet-ef` na VM.
- Novas rotas (JWT do dono): `GET /me` → `{usuarioId, nome, email, consentimentoRota, emergenciaConfigurada}`; `GET /aparelhos` → `[{id, marca, modelo, imeiMascarado}]` (`imeiMascarado` = `***********7518`); `GET /contas` → `[{id, nome, tipo, telefone, link}]`.
- `GET /ocorrencias/{id}` passa a trazer `contas: [{nome, tipo, telefone, link}]` (as contas vinculadas da vítima, para o passo a passo do guardião), `passos: [{passo, concluidoEm|null}]`, `alertas: [{alertaId, guardiaoId, enviadoEm, cienteEm|null}]`, `estado` ∈ `Aberta|Cancelada|Encerrada`, `momento: {em, lat, lng}|null`.
- `PUT /ocorrencias/{id}/acompanhamento` (dono/emergência): `{boNumero?: string, boStatus: "nao_registrado"|"registrado", recuperacao: "sem_noticia"|"localizado"|"recuperado"}` → 204. `GET /ocorrencias/{id}/retorno` inclui esses campos além do retorno da Ponte.
- `GET /alertas/ativos` → `[{alertaId, ocorrenciaId, vitimaNome, origem, em}]`. `GET /relatos` → `[{id, tipo, lat, lng, em, confirmacoes}]` (sem texto nem autor).
- `POST /ocorrencias/gatilho`: 201 ao criar; **200** com a mesma `ocorrenciaId` se a vítima já tem ocorrência `Aberta`. Clientes aceitam qualquer 2xx.
- `POST /rota/pontos`: o servidor descarta pontos repetidos (mesmo usuário e mesmo `em`), então reenviar o lote é seguro.
- Convites: inválido 404, vencido 410, limite de 3 guardiões 409; corpo `problem+json` com `detalheCidadao`.
- `GET /camadas/{tipo}` (público, **P2**): `tipo` ∈ `delegacias|estacoes|pm` → `[{nome, lat, lng}]`, servido de JSON extraído do GeoSampa (`api/Ampara.Api/Dados/{delegacias,estacoes,pm}.json`).
- Escalada: `paraGuardiaoId` = `Guardiao.Id`. `AlertaEscalado` ganha `ocorrenciaId` e vai para todos os guardiões já acionados; o novo guardião recebe `AlertaDisparado`. Depois do 3º não escala mais; os alertas seguem tocando até o primeiro "Estou ciente", que encerra todos (`AlertaEncerrado` motivo `ciente`).
- Papel `admin`: claim `role`=`admin`, criado só pelo `DemoSeeder` (`admin@ampara.demo`) com `AMPARA_DEMO=true`.
- `device_hash` sem chaveiro: `sha256("sem-chaveiro-" + ocorrenciaId + PONTE_CHAVE_SERVICO)`.
- O cliente da Ponte grava um exemplo serializado do corpo enviado em `ponte-policia/tests/contrato/exemplo_da_api.json` (usado pelo teste de contrato da Ponte).

**Taint e PII — nomes únicos nos planos 02 e 03** (o plano 02 cria estas assinaturas em `api/Ampara.Application/Cyber/` com implementações no-op; o plano 03 substitui só as implementações):
- `enum PiiClasse {Cpf,Rg,Imei,Telefone,Email,Placa,Senha,Saude}`; `enum OrigemDado {Http,Form,Query,Header,Mqtt}`; `enum Sink {Log,HttpNaoAutenticada,HttpAutenticada,Erro,Ponte,SignalR,Llm,Banco}`; `enum Decisao {Bloqueado,Mascarado,Permitido,Cifrado}`; `enum Farol {Verde,Amarelo,Vermelho}` (JSON em minúsculas).
- `record SanitizarOpcoes(OrigemDado? Origem = null, string? Campo = null, Guid? UsuarioAlvoId = null, string? CorrelationId = null)`; `record ResultadoTaint(string Texto, bool Bloqueado, IReadOnlyList<EventoSeguranca> Eventos)`; `interface ITaintGuard { bool Ativo { get; } ResultadoTaint Sanitizar(string texto, Sink sink, SanitizarOpcoes? o = null); }`.
- `interface IAcessoIndevido { void Registrar(Guid? usuarioAlvoId, string campo, string? correlationId = null); }` com `campo` ∈ `codigo-emergencia|recurso-de-outro-usuario`.
- `interface IImeiRevelador { string RevelarParaBo(string imeiCifrado, Guid donoId, Guid solicitanteId, string? correlationId = null); }` — o BO do plano 02 usa isso (no-op do 02: só decifra; o 03 grava o evento `Imei/HttpAutenticada/Permitido`, campo `bo.imei`).
- `interface IModeradorRelato { Task<string?> ModerarTextoAsync(string texto, CancellationToken ct); }` — o 02 entrega `ModeradorTextoDescartado`; o 03 entrega `ClaudeModeradorRelato` (scrub de PII → Claude classifica; barra uso político, ofensa e descrição de pessoas).
- Middlewares: `CorrelacaoMiddleware` (cabeçalho `X-Correlation-Id`) → `UseExceptionHandler` → `PiiRequestMiddleware` → autenticação → autorização. O 02 cria os dois middlewares (o de PII só chama `next`).
- Acesso indevido no rastro: `classe=Senha`, `sink=HttpNaoAutenticada`, `decisao=Bloqueado`, `campo` como acima.
- **Pesos do índice** (24 h, teto 100, por dono do dado-alvo): acesso indevido 40; resposta não autenticada bloqueada 25; qualquer outro `Bloqueado` (Log, Erro, Ponte, SignalR, Llm, Banco) 10; `Mascarado`, `Cifrado`, `Permitido` 0. Eventos sem dono não entram no índice do cidadão, só na visão executiva.
- Flag de demonstração do antes/depois: variável `Cyber__TaintAtivo=false` (só aceita com `AMPARA_DEMO=true`).
- `EventoSegurancaDto` = `EventoSeguranca` sem `usuarioAlvoId`. Executivo: `porHora` = 24 inteiros (posição 0 = há 23 h); conta as últimas 24 h exceto `Permitido`.

**Ponte Polícia**
- Variável nova `PONTE_CHAVE_POLICIA` (cabeçalho `X-Chave-Policia`); entra no `.env.example` e na VM.
- Rota nova `GET /ocorrencias?status=` (`X-Chave-Policia`) → `[{protocolo, area_id, ts, tipo, status, origem_gatilho}]` para o painel ter lista clicável.
- `risco_previsto` em `/hotspots`: `baixo|medio|alto` pelo total na janela (1 = baixo, 2–4 = medio, ≥ 5 = alto). Área `fora` não aparece.
- Erros: chave ausente ou errada 401; protocolo inexistente 404; transição de status inválida 409; PII 422 `{detail, achados: [{campo, classe}]}` (a Ponte também detecta `Nome`, classe só dela).
- Atrás do nginx: `location /ponte/` → Ponte; `location /policia` → Ponte com `proxy_set_header X-Forwarded-Prefix /ponte`; o painel monta as URLs com esse prefixo.

**Área do mapa**: limites superiores exclusivos (`lat >= -23.35` ou `lng >= -46.36` → `fora`), igual em C# e Python.

**ML**: `risco.csv` traz só as células ativas (≥ 120 ocorrências no treino; era 20, subiu no plano 06 para o painel caber em 2 milhões de linhas) × 56 combinações de dia e faixa; área ausente = "sem dado" no mapa (cinza, com legenda). O arquivo representa o trimestre seguinte ao último trimestre completo dos dados. Plano B por distrito: cada distrito vira a célula da grade que contém seu ponto representativo. `ml/saida/risco.csv` é versionado.

**VM**: portas do host `8080→80` (nginx), `2222→22` (ssh), `8088` (seed do cloud-init). Rede da VM `10.0.2.15/24`, gateway `10.0.2.2`, DNS `10.0.2.3 1.1.1.1`. No emulador: `EXPO_PUBLIC_API_URL=http://10.0.2.2:5080` (API local) ou `http://10.0.2.2:8080` (API na VM). Units: `ampara-api.service`, `ampara-ponte.service`, `ampara-monitor.service`, `cloudflared.service`; limites em `/etc/ampara/monitor.conf`. Ponte roda como `app.main:app` (compatível com Python 3.12 do Ubuntu 24.04).

## Identidade visual
Petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D`; fonte Manrope; alarme sempre vermelho; botões ≥ 48 dp.
