# Registro de uso de IA (prompts)

Formato de cada entrada: `## AAAA-MM-DD — Task N — autor`, seguido do prompt em citação. A IA (Claude Code) foi usada como copiloto; a equipe revisou e sabe explicar cada parte.

## 2026-11-14 — Plano — Pedro

> Monorepo do Ampara (GS CitizenTech): organizar o repositório com app, web de emergência, API em C#, Ponte Polícia, ML, infra, cyber e qa, incluir o repositório de IoT do Vitor como submódulo e escrever o plano de implementação de fundação com os testes de risco do dia 1.

## Prompts do Vitor

# Registro de uso de IA

A regra da GS pede que os prompts usados fiquem registrados aqui. A IA foi usada como copiloto; a equipe revisou e sabe explicar cada parte do código.

## Ferramenta

Claude Code (Anthropic).

## Prompts

### 1. Estrutura da parte IoT

> I am responsible for making the iot part of this project, the core idea is make a charm that the user can have on their keys that can block their phone with a click and send a alert to the police and trust worth contacts the user would setup on a app. I am only responsible for iot so only develop that.

(Enviado junto com o PDF do desafio.)

Resultado: firmware do ESP32, circuito do Wokwi, contrato MQTT com o app e simulador do app em Python.

### 2. Risco (c): colunas reais da planilha SSP (Task 2 da fundação)

> Executar a Task 2 do plano de fundação: escrever `qa/spikes/ssp/colunas.py` com testes primeiro (achar cabeçalho, validar coordenadas, classificar colunas, veredito, perfil e Markdown sem valores de célula), baixar a planilha SSP-SP de 2025 depois do ok do Pedro, rodar sobre o arquivo real e registrar `SSP_VEREDITO` e `SSP_CELULAR` em `docs/riscos-dia1.md`.

Resultado: módulo e testes em `qa/spikes/ssp/`, `docs/dados-ssp-colunas.md` gerado, veredito `GRADE_500M` (76,9% de coordenadas válidas numa amostra de 20000 linhas) e `SSP_CELULAR: PROXY`.

### 3. Risco (b): MQTT no broker.hivemq.com (Task 3 da fundação)

> Executar a Task 3 do plano de fundação: escrever `qa/spikes/mqtt/test_hivemq.py` (conexão, assinatura, ida e volta do evento, status retido e comando ack) com paho-mqtt 2.x, provar que falha contra um broker inexistente, rodar contra o `broker.hivemq.com` e registrar `b-mqtt` e `MQTT_HOST_EFETIVO` em `docs/riscos-dia1.md`.

Resultado: 5 testes passando no HiveMQ público; só mensagens `type: "test"` sintéticas, com `deviceId` aleatório.

### 4. Risco (a): rota no emulador e localização em segundo plano (Task 4 da fundação)

> Executar a Task 4 do plano de fundação: escrever `qa/spikes/verificar-gps-background.sh` (WHPX, AVD, APK instalado, permissões, app em segundo plano, 10 `adb emu geo fix` sintéticos, pelo menos 8 linhas `AMPARA_PONTO` e último ponto perto do destino), ver falhar na asserção 3, criar o app Expo descartável `qa/spikes/gps-background` com `expo-location` e `expo-task-manager`, compilar o APK release, ver passar e registrar `a-emulador-gps` e `ExpoSDK` em `docs/riscos-dia1.md`.

Resultado: script e app em `qa/spikes/`, 14 pontos recebidos em segundo plano no emulador `guardiao_vitima`; rota 100% sintética (estação Pinheiros como ponto inicial); achados de build e de precisão registrados em `docs/riscos-dia1.md`.

### 5. Risco (d): VM Ubuntu 24.04 em QEMU com WHPX (Task 5 da fundação)

> Executar a Task 5 do plano de fundação: escrever `infra/spike/verificar-vm.sh` (QEMU e qemu-img, SHA-256 da imagem, WHPX sem erro, login na serial em 300 s, SSH com chave imprimindo `ampara-vm`, cloud-init done, poweroff), ver falhar, instalar o QEMU pelo scoop e baixar a imagem cloud do Ubuntu 24.04 depois do ok do Pedro, criar `run-vm.sh`, `user-data.tpl` e `meta-data` com seed NoCloud por HTTP, ver passar e registrar `d-vm` e `VM` em `docs/riscos-dia1.md`.

Resultado: VM sobe com QEMU+WHPX, login em cerca de 62 s, SSH em `localhost:2222`, `VM: QEMU+WHPX`; imagem, disco e chaves ficam fora do git em `infra/vm/`.

### 6. Amostra real do chaveiro e fechamento do dia 1 (Task 6 da fundação)

> Executar a Task 6 do plano de fundação: escrever `qa/spikes/mqtt/chaveiro_real.py` com testes primeiro (`validar_evento` com os 8 campos do contrato e `main` que assina só o deviceId, valida o evento, manda `ack` e confere 15 s sem retransmissão), rodar contra o Wokwi do Vitor ou, se ele estiver indisponível, gravar `e-wokwi` = PULADO e agendar a prova real para o plano 08; depois rodar o fechamento do dia 1.

Resultado: validador e CLI em `qa/spikes/mqtt/` (4 testes passando), `e-wokwi` = PULADO com a prova real agendada para o plano 08 e seção `## Amostra real do chaveiro` criada em `docs/riscos-dia1.md`; `main` exercitado só com publicação sintética no HiveMQ público.

### 7. Solution, projetos e fábrica de testes da API (Task 1 do plano da API)

> Executar a Task 1 do plano da API (`2026-11-14-02-api`): escrever primeiro o `SmokeTests` (`/openapi/v1.json` responde 200 e lista `paths`), ver falhar, criar `api/` com global.json, Directory.Build.props, a solution com Domain, Application, Infrastructure, Api e Tests, `Program.cs` (OpenAPI, Scalar em `/scalar`, URL padrão `http://localhost:5080`, CORS por `Cors:Origens`) e a `AmparaFactory` (configuração falsa em memória, `FakeTimeProvider`, sem `IHostedService` de `Ampara.*`), e ver passar.

Resultado: solution `api/Ampara.sln` em net11.0 com 5 projetos, EF Core 10 e Npgsql 10 (sem estável para EF 11, registrado em `api/README.md`), teste de fumaça passando; `launchSettings.json` alinhado à porta 5080 na correção da revisão.

### 8. Erros em problem+json, correlação e contratos do plano 03 (Task 2 do plano da API)

> Executar a Task 2 do plano da API (`2026-11-14-02-api`): escrever primeiro o `ErrosTests` (500 sem vazar valor, mapeamento de status das exceções, 429 com Retry-After, `X-Correlation-Id` ecoado ou gerado, no-ops de taint e acesso indevido, enums e `EventoSeguranca` do contrato), ver falhar, e implementar exceções, enums, `EventoSeguranca`, as quatro interfaces do plano 03, os dois no-ops, `CorrelacaoMiddleware`, `PiiRequestMiddleware` e `ProblemaHandler` com o pipeline combinado.

Resultado: erros em `application/problem+json` com `title` fixo por exceção e só o tipo no log; 15 testes passando.

### 9. Primitivas de domínio da API (Task 3 do plano da API)

> Executar a Task 3 do plano da API (`2026-11-14-02-api`): escrever primeiro o `PrimitivasTests` (IMEI com Luhn, área do mapa e limites do contrato, faixa e dia em hora de São Paulo, vetores de `DeviceHash`, distância haversine, cifra AES-GCM e `NoopImeiRevelador`), ver falhar, e implementar `Imei`, `AreaMapa`, `FusoBrasil`, `Geo`, `DeviceHash`, `ICifrador`, `CifradorAesGcm`, `NoopImeiRevelador` e o registro na DI (`AMPARA_CRYPTO_KEY` ausente ou diferente de 32 bytes derruba a subida).

Resultado: primitivas em `api/Ampara.Domain/Comum`, cifra em `api/Ampara.Infrastructure/Cripto`; correção da revisão com teste de adulteração por byte (nonce, tag e ciphertext) e teste da falha de subida da chave.

### 10. Banco, usuário e autenticação JWT (Task 4 do plano da API)

> Executar a Task 4 do plano da API (`2026-11-14-02-api`): escrever primeiro o `AuthTests` (registro 201 com e-mail normalizado e 409 no duplicado, 401 idêntico para senha errada e e-mail desconhecido, 422 para senha curta e nome vazio, registro nunca cria admin, claims e validade de 8 h, segredo curto derruba a subida), ver falhar, e implementar `Usuario`, `IAmparaDb`, `AmparaDbContext` (datas UTC, enums como texto), hasher PBKDF2-SHA256, `TokenService`, `AuthService`, rotas `/api/v1/auth`, JWT Bearer com políticas, `--migrar`, a migration `Inicial` (dotnet-ef como ferramenta local) e a fábrica de testes com SQLite em memória.

Resultado: 8 testes de auth passando; migration aplicada no PostgreSQL local (tabela `Usuarios`).

### 11. Código de emergência com limite de tentativas (Task 5 do plano da API)

> Executar a Task 5 do plano da API (`2026-11-14-02-api`): escrever primeiro o `EmergenciaTests` (definir código de 6 a 10 dígitos e palavra de ao menos 4 caracteres, entrar sem diferenciar caixa, 422 nos valores inválidos, 5 erros na janela de 15 min bloqueiam com 429 e `Retry-After` inclusive para o código certo, e-mail inexistente conta e responde 401 igual, token de emergência barrado nas rotas de usuário, `GET /me`), ver falhar, e implementar `TentativaEmergencia`, `DefinirEmergenciaAsync`/`LoginEmergenciaAsync`, `PUT /me/emergencia`, `POST /auth/emergencia`, `GET /me`, o spy de `IAcessoIndevido` na fábrica e a migration `Emergencia`.

Resultado: 6 testes de emergência passando (43 na suíte); migration aplicada no PostgreSQL local.

### 12. Aparelhos com IMEI cifrado e consentimento da rota (Task 6 do plano da API)

> Executar a Task 6 do plano da API (`2026-11-14-02-api`): escrever primeiro o `AparelhoTests` (criar aparelho com IMEI normalizado e cifrado, IMEI inválido 422 `imei-invalido` sem gravar, 401 sem token e 422 com marca vazia, `PUT /me/consentimento-rota` grava e revoga, listagem só do dono com `imeiMascarado` de 11 asteriscos mais os 4 últimos dígitos), ver falhar, e implementar `Aparelho`, `IAparelhoService`/`AparelhoService` (inclui `ImeiCifradoMaisRecenteAsync` para o BO), `POST/GET /aparelhos`, `PUT /me/consentimento-rota`, `Aparelhos` no `IAmparaDb` e a migration `Aparelhos`.

Resultado: 6 testes de aparelho passando (52 na suíte); migration gerada e `--migrar` aplicado no PostgreSQL local (porta 5436, ampara_dev); tabela `Aparelhos` conferida com psql.

### 13. Catálogo curado de contas e contas vinculadas (Task 7 do plano da API)

> Executar a Task 7 do plano da API (`2026-11-14-02-api`): `CatalogoConta` e `ContaVinculada` (slug cifrado), seed curado de 10 bancos e 3 operadoras com telefones e links conferidos nos sites oficiais no dia (sem copiar de memória; o que não foi confirmado fica `null`), `CatalogoSeeder` idempotente, rotas `GET /api/v1/contas/catalogo` (anônima), `POST /api/v1/contas` (404 desconhecida, 409 `conta-ja-vinculada` comparando decifrado) e `GET /api/v1/contas` só do dono, fontes em `docs/fontes.md`.

Resultado: testes de conta e de seed passando; migration `Contas` aplicada no PostgreSQL local (5436, ampara_dev) com 13 linhas em `Catalogo`; só Nubank e Inter tiveram telefone confirmado, o resto ficou com link e `telefone: null`.

### 14. Guardiões e convites (Task 8 do plano da API)

> Executar a Task 8 do plano da API (`2026-11-14-02-api`): escrever primeiro o `GuardiaoTests` (convite de 6 caracteres do alfabeto sem ambíguos, aceite que vira guardião com ordem, 404 `convite-invalido` para inexistente ou já usado, 410 `convite-vencido` após 25 h, 409 `limite-guardioes`, aceitar o próprio convite 422, quarto convite com três guardiões 409, reordenação que exige permutação exata e `PodeEscalar`), ver falhar, e implementar `Convite`, `Guardiao`, `IGuardiaoService`/`GuardiaoService` (código com `RandomNumberGenerator`, trava por vítima), `GuardiaoEndpoints`, `Convites`/`Guardioes` no `IAmparaDb`, o helper `VincularGuardiaoAsync` na fábrica e a migration `Guardioes`.

Resultado: testes de guardião passando (69 na suíte); migration `Guardioes` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabelas `Convites` e `Guardioes` e seus índices únicos conferidos com psql.

> Executar a Task 9 do plano da API (`2026-11-14-02-api`): escrever primeiro o `ChaveiroTests` (pareia, lista e envia find; deviceId inválido 422 e já pareado 409; comando em chaveiro alheio 403 com registro de acesso indevido; status preserva a bateria e marca bateria baixa; comando serializa no formato do contrato MQTT), ver falhar, e implementar `Chaveiro`, `ComandoChaveiro`, `IChaveiroGateway` (gateway por interface, desconectado até a T15), `ChaveiroService`, `ChaveiroEndpoints`, `FakeChaveiroGateway` na fábrica e a migration `Chaveiros`.

Resultado: testes de chaveiro passando; migration `Chaveiros` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabela e índice único em `DeviceId` conferidos com psql.

<!-- Acrescente aqui os próximos prompts usados pela equipe. -->
