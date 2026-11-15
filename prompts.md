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

### 15. Chaveiros: pareamento e comandos (Task 9 do plano da API)

> Executar a Task 9 do plano da API (`2026-11-14-02-api`): escrever primeiro o `ChaveiroTests` (pareia, lista e envia find; deviceId inválido 422 e já pareado 409; comando em chaveiro alheio 403 com registro de acesso indevido; status preserva a bateria e marca bateria baixa; comando serializa no formato do contrato MQTT), ver falhar, e implementar `Chaveiro`, `ComandoChaveiro`, `IChaveiroGateway` (gateway por interface, desconectado até a T15), `ChaveiroService`, `ChaveiroEndpoints`, `FakeChaveiroGateway` na fábrica e a migration `Chaveiros`.

Resultado: testes de chaveiro passando; migration `Chaveiros` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabela e índice único em `DeviceId` conferidos com psql.

### 16. Rota dos últimos 7 dias (Task 10 do plano da API)

> Executar a Task 10 do plano da API (`2026-11-14-02-api`): escrever primeiro o `RotaTests` (lote válido vira 202 e a consulta devolve só a janela em ordem crescente; lote com ponto inválido rejeita tudo sem gravar; futuro, antigo e lote de 501 viram 422; retransmissão não duplica; sem consentimento 403; purga só do que passou de 7 dias; revogar consentimento apaga a rota; emergência vê só a rota do dono), ver falhar, e implementar `PontoRota`, `IRotaService`/`RotaService`, `RotaEndpoints`, `RetencaoWorker`, `Pontos` no `IAmparaDb` com índice único `(UsuarioId, Em)`, a ligação da revogação em `MeEndpoints` e a migration `Rota`.

Resultado: testes de rota passando (92 na suíte); migration `Rota` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabela `Pontos` e índice único `(UsuarioId, Em)` conferidos com psql.

### 17. Ocorrências e gatilhos (Task 11 do plano da API)

> Executar a Task 11 do plano da API (`2026-11-14-02-api`): escrever primeiro `OcorrenciaDominioTests` (cinco passos pendentes, cancelar duas vezes conflita, momento inválido, passo idempotente, gatilho do chaveiro limita o início a agora) e `OcorrenciaApiTests` (201/200 ao reaproveitar a Aberta, vítima sem guardiões, índice único parcial, 422/403 de origem, guardião sem momento, detalhe no formato do contrato, cancelar com resolve ao chaveiro, comando resolve), ver falhar, e implementar `Ocorrencia`/`PassoOcorrencia`, os gatilhos `IGatilho`, `IOcorrenciaService`/`OcorrenciaService`, `OcorrenciaEndpoints`, o `resolve` no `ChaveiroService` e a migration `Ocorrencias` com índice único parcial em `UsuarioId` onde `Estado = 'Aberta'`.

Resultado: 108 testes passando; migration `Ocorrencias` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), índice parcial `UX_Ocorrencias_UmaAbertaPorUsuario` conferido com psql.

### 18. Hub do guardião em tempo real (SignalR) (Task 12 do plano da API)

> Executar a Task 12 do plano da API (`2026-11-14-02-api`): escrever primeiro o `HubTests` (sem token não conecta, token de emergência não conecta, `AlertaDisparado` chega só ao guardião destinatário, e `AlertaEscalado`/`AlertaEncerrado`/`PassoAtualizado` com os nomes e o JSON camelCase do contrato), ver falhar, e implementar os records de `Mensagens`, `IGuardiaoNotificador`, o `GuardiaoHub` (política `Usuario`, grupo `g-{usuarioId}`, sem métodos cliente→servidor) e o `SignalRGuardiaoNotificador` sobre `IHubContext`, com `AddSignalR` e `MapHub("/hubs/guardiao")`.

Resultado: 114 testes passando na suíte; sem migration.

### 19. Alerta e escalada para os guardiões, passos de bloqueio (Task 13 do plano da API)

> Executar a Task 13 do plano da API (`2026-11-14-02-api`): escrever primeiro `EscaladaTests` (disparo alerta o guardião 1 com o nome da vítima, escalada só aos 60 s e um guardião por vez com `AlertaEscalado` para os já acionados, ciente para a escalada e encerra os outros, ciente repetido 204 e de outro guardião 403, alertas ativos, alertas no detalhe da ocorrência, cancelar encerra com motivo `cancelado`) e `PassosTests` (conclusão notifica todos os guardiões, passo inválido 422, dono 403, repetição idempotente, cinco passos encerram a ocorrência e publicam o resolve do chaveiro), ver falhar, e implementar `Alerta`, `IEscalonamento`/`Escalonamento` (trava por ocorrência), `OpcoesEscalonamento`, `EscalonamentoWorker` (5 s), `AlertaEndpoints`, `ConcluirPassoAsync` e a rota dos passos, `Alertas` no `IAmparaDb` e a migration `Alertas`.

Resultado: 127 testes passando na suíte; migration `Alertas` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabela e índices conferidos com psql.

### 20. Eventos do chaveiro por MQTT com idempotência (Task 14 do plano da API)

> Executar a Task 14 do plano da API (`2026-11-14-02-api`): escrever primeiro `ChaveiroEventoTests` (alert cria ocorrência de chaveiro e responde ack, mesmo eventId cinco vezes gera uma ocorrência e cinco acks, cancel com alerta desconhecido, test, low_battery sem ack, chaveiro não pareado só recebe ack, payloads malformados descartados, falha no ack não desfaz a ação, status e última vontade), ver falhar, e implementar `EventoRecebido` (índice único em `EventId`), `MensagemChaveiro`, `IChaveiroEventoService`/`ChaveiroEventoService`, `EventosRecebidos` no `IAmparaDb`, `TransacaoAsync` reentrante e a migration `EventosRecebidos`.

Resultado: 144 testes passando na suíte; migration `EventosRecebidos` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabela e índice único conferidos com psql.

### 21. Cliente MQTT, /health e script de alerta (Task 15 do plano da API)

> Executar a Task 15 do plano da API (`2026-11-14-02-api`): escrever primeiro `MqttTopicoTests` (lê `citizentech/chaveiro/{deviceId}/{events|status}`, recusa `/cmd`, segmento vazio, curinga e nível extra; monta o tópico de comando; raízes de assinatura) e `SaudeTests` (`/health` anônimo: 200 ok, 200 degradado com o MQTT fora, 503 com o banco fora, sem texto de exceção), ver falhar, e implementar `TopicoChaveiro`, o `MqttChaveiroGateway` (MQTTnet, `BackgroundService` e `IChaveiroGateway` na mesma instância, QoS 1, reconexão de 1 s a 30 s, escopo de DI por mensagem, comando sem conexão vira `mqtt-indisponivel`), `ISondaSaude`/`SondaSaude`, `SaudeEndpoints` e `api/tools/publicar_alerta.py`.

Resultado: 164 testes passando na suíte (165 depois da correção da revisão, que fez o gateway reconectar quando a assinatura falha); sem migration; verificação ao vivo no broker.hivemq.com com o PostgreSQL local (5436, ampara_dev): `/health` ok, o script recebeu o ack e a ocorrência de origem chaveiro apareceu na listagem (`api/evidencias/t15-mqtt-ao-vivo.txt`).

### 22. BO, delegacia mais próxima e camadas do mapa (Task 16 do plano da API)

> Executar a Task 16 do plano da API (`2026-11-14-02-api`): escrever primeiro `DelegaciaTests` (delegacia mais próxima de Pinheiros num fixture sintético, arquivo real com pelo menos 10 delegacias dentro de São Paulo), `CamadaTests` (camadas públicas só com nome, lat e lng; tipo desconhecido 404 `camada-desconhecida`) e `BoTests` (texto com IMEI, hora de Brasília e delegacia; sem aparelho diz IMEI não informado; sem momento 409; guardião e estranho 403 com registro; emergência do dono gera; rascunho cifrado e um por ocorrência; IMEI sempre pelo `IImeiRevelador`), ver falhar, e implementar `BoRascunho`, `IBoGenerator`/`BoGenerator`, `IDelegaciaLocator`/`DelegaciaJsonLocator` (haversine), `CamadasMapa`, `BoEndpoints`, `CamadaEndpoints`, o `ImeiReveladorSpy` de teste, `api/tools/extrair_camadas.py` (WFS do GeoSampa) com os três JSONs reais e a migration `Bo`.

Resultado: testes de BO, delegacia e camada passando; migration `Bo` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabela `BosRascunho` e índice único em `OcorrenciaId` conferidos com psql; JSONs reais do GeoSampa (92 delegacias, 162 estações, 158 da PM).

### 23. Risco por área e horário (Task 17 do plano da API)

> Executar a Task 17 do plano da API (`2026-11-14-02-api`): escrever primeiro o `RiscoTests` (importa e consulta por bbox, dia e faixa; CSV com cabeçalho errado, classe fora do conjunto, prob_alto acima de 1, area_id inválido, dia/faixa fora da faixa e chave repetida falha sem trocar o snapshot; rota anônima em camelCase; 422 para bbox ausente ou invertida e faixa fora do intervalo; sem dia/faixa usa agora em hora de São Paulo), ver falhar, e implementar `IRiscoService`/`RiscoService` (snapshot imutável trocado por `Interlocked.Exchange`), `RiscoCelulaDto`, `RiscoInicializador` (importa `RISCO_CSV`, arquivo ausente ou inválido só avisa), `RiscoEndpoints` e o fixture sintético `risco-teste.csv` (o `ml/saida/risco.csv` real ainda não existe).

Resultado: 204 testes passando na suíte; sem migration.

### 24. Ponte Polícia: compartilhar e acompanhar (Task 18 do plano da API)

> Executar a Task 18 do plano da API (`2026-11-14-02-api`): cliente da Ponte Polícia (`IPontePoliciaClient`/`PontePoliciaClient`, POST /ocorrencias e GET retorno, chave `X-Chave-Servico`, timeout 5 s, falha vira `ponte-indisponivel`), `PoliciaService` (compartilhar com consentimento, device_hash, trilha só com consentimento de rota, taint guard no sink Ponte, retorno, acompanhamento do BO e da recuperação que nunca vai para a Ponte), rotas, `FakePontePoliciaClient`, migration `Acompanhamento` e o exemplo `ponte-policia/tests/contrato/exemplo_da_api.json` gravado pelo teste.

Resultado: 225 testes passando na suíte; migration `Acompanhamento` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), colunas `BoNumero`, `BoStatus` e `Recuperacao` e a linha em `__EFMigrationsHistory` conferidas com psql.

### 25. Relatos com visibilidade e anti-abuso (Task 19 do plano da API)

> Executar a Task 19 do plano da API (`2026-11-14-02-api`): escrever primeiro o `RelatoTests` (relato sozinho em area baixa fica oculto e com a 2a confirmacao aparece, lista com exatamente id/tipo/lat/lng/em/confirmacoes, area de risco alto aparece sozinho, confirmar duas vezes ou o autor nao soma, expira em 2 h e a purga remove, em invalido ou fora do mapa 422, 6o relato na hora 429, texto livre nao gravado), ver falhar, e implementar `Relato`/`RelatoConfirmacao`, `IRelatoService`/`RelatoService`, `ModeradorTextoDescartado` (Singleton, devolve sempre null ate o plano 03), `RelatoEndpoints`, purga no `RetencaoWorker` e a migration `Relatos`.

Resultado: 239 testes passando na suite; migration `Relatos` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), tabelas `Relatos` e `RelatoConfirmacoes` e o indice unico (RelatoId, UsuarioId) conferidos com psql.

### 26. Gatilho de impacto com janela de cancelamento (Task 20 do plano da API)

> Executar a Task 20 do plano da API (`2026-11-14-02-api`): escrever primeiro o `ImpactoTests` (impacto não alerta dentro dos 10 s, cancel na janela nunca chega a alertar, passada a janela o primeiro `ProcessarVencidosAsync` alerta o guardião 1), ver falhar, e implementar `GatilhoImpacto`, `Ocorrencia.AlertasLiberadosEm`, o evento `impact` no `ChaveiroEventoService`/`MensagemChaveiro`, a liberação dos alertas no `Escalonamento` e a migration `Impacto`.

Resultado: 242 testes passando na suíte; migration `Impacto` aplicada com `--migrar` no PostgreSQL local (5436, ampara_dev), coluna `AlertasLiberadosEm` (timestamptz, nula) e a linha em `__EFMigrationsHistory` conferidas com psql.

### 27. Seed de demonstração, README e evidências (Task 21 do plano da API)

> Executar a Task 21 do plano da API (`2026-11-14-02-api`): escrever primeiro o `DemoSeedTests` (semear duas vezes dá 4 usuários, 1 aparelho e 2 guardiões em ordem, admin com claim `role=admin`, login do guardião 1, `AMPARA_DEMO=false` não semeia nada), ver falhar, e implementar o `DemoSeeder` idempotente (chamado no `--migrar` e na subida só com `AMPARA_DEMO=true`), o `api/README.md` com a ficha da CitizenTech e as evidências em `api/evidencias/` (testes, migrations, fluxo pela API, rotas no Scalar, ack do MQTT).

Resultado: 245 testes passando na suíte; `--migrar` com seed de demonstração no PostgreSQL local (5436, ampara_dev), `/health` ok e fluxo login, gatilho e listagem conferidos contra a API real.

### 28. Revisão final do plano da API (branch inteiro, 0d8a383..e7d42a8)

> Revisão final do plano 02 (API C#/.NET em `api/`), como único corretor: corrigir todos os achados confirmados Critical/Important com teste que falharia sem a correção, e os Minor triviais e seguros; o resto vira dívida. Fontes de verdade: índice e contratos (rodada 2 vence), spec, plano da API (Global Constraints e Review Focus), `global-constraints.md` e `riscos-dia1.md`. Commits pequenos na main, suíte completa antes de cada um.

Resultado: corrigidos os três Important — o gateway MQTT passou a despachar o payload original em vez do texto do sink `Log` do taint (com o guard do plano 03, o `ts` de 10 dígitos casaria Telefone e quebraria o JSON; o plano 03, Tarefa 13, foi ajustado para ligar o `IMqttPiiFilter` no ponto marcado), `GET /rota` deixou de devolver ao dono a posição do aparelho depois do roubo (anti-objetivo da spec) e o alert do chaveiro que reaproveita uma ocorrência aberta pela web passou a gravar deviceId e alertId (cancel do chaveiro, resolve no cancelamento pelo app e resolve manual voltaram a funcionar). Minors corrigidos: formato do `X-Correlation-Id`, deviceId do tópico validado e fora do log, trilha da Ponte limitada à validade do token do aparelho roubado, seeder de demo sem promover conta de terceiro, retenção de 24 h das tentativas de emergência e testes de normalização do login, teto de 2048 bytes, expiração dos tokens e modelo EF × migrations. 266 testes passando na suíte; sem migration (o modelo EF não mudou).

### 29. Ponte Polícia: esqueleto, domínio e área (Task 1 do plano 04)

> Executar a Task 1 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): preparar o ambiente em `ponte-policia/` (requirements, pytest.ini, .gitignore, .env.example), escrever primeiro os testes de `dominio` e `area`, ver falhar, e implementar `app/dominio.py` (enums, matriz de transições, erros de domínio, `Hotspot`) e `app/area.py` (grade de ~500 m com limites superiores exclusivos, `centro` e `area_valida`). Correção da rodada 1: registrar este prompt, travar a borda superior da grade com `min` e cobrir NaN/infinito, `TRANSICOES`, erros e `Hotspot` nos testes.

Resultado: 47 testes passando na suíte da Ponte Polícia; sem migration.

### 30. Ponte Polícia: modelos, comportamento e migração (Task 2 do plano 04)

> Executar a Task 2 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_modelos` (receber, retorno atual, mudar status, protocolo, roundtrip UTC, valor do enum no banco, origem_id único) e o teste de migração no PostgreSQL, ver falhar, e implementar `config`, `db` (`UTCDateTime`, engine, sessão), `models` (`Ocorrencia`, `TrilhaPosRoubo`, `Retorno`), Alembic e a migração `0001_inicial`.

Resultado: testes da Ponte passando; migração 0001 aplicada no PostgreSQL local (5436, banco ponte) e provada em ponte_test (upgrade e downgrade).

### 31. Ponte Polícia: detector de PII próprio (Task 3 do plano 04)

> Executar a Task 3 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_pii` (CPF com dígito verificador, telefone com DDD válido, IMEI com Luhn, e-mail, nome por chave e em texto livre, percurso de listas e objetos aninhados, hash/UUID sem falso positivo, resultado sem o valor), ver falhar, e implementar `app/pii.py` com `AchadoPii`, `detectar_pii`, `cpf_valido` e `luhn_valido`.

Resultado: 41 testes do detector passando; 96 passando e 1 ignorado na suíte da Ponte Polícia; sem migration.

### 32. Ponte Polícia: POST /ocorrencias idempotente, autenticação, 422 de PII e /health (Task 4 do plano 04)

> Executar a Task 4 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_ocorrencias_api` e `test_auth` (201 com protocolo, reenvio do mesmo `origem_id` dá 200 com o mesmo protocolo, trilha em ordem, `ts` gravado em UTC, payloads inválidos e PII em campo extra dão 422 sem ecoar o valor, chave ausente, vazia, errada ou com acento dá 401, chave configurada vazia falha fechado, corrida na idempotência devolve o vencedor), ver falhar, e implementar `schemas`, `security` (chaves por cabeçalho com `hmac.compare_digest`, `rejeitar_pii` antes da validação tipada), `erros` (handlers sem `input`/`ctx`), repositório, serviço, `deps`, `main`, `GET /health` e `POST /ocorrencias`.

Resultado: 133 testes passando e 1 ignorado (PostgreSQL sem `PONTE_DB_TEST`) na suíte da Ponte Polícia; acrescentado um teste que viola a unicidade de verdade na corrida; sem migration. (Entrada registrada na revisão final do plano 04.)

### 33. Ponte Polícia: retorno ao cidadão, mudança de status e listagem (Task 5 do plano 04)

> Executar a Task 5 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_retorno_status` e `test_listagem`, ver falhar, e implementar `GET /ocorrencias/{protocolo}/retorno`, `PATCH /ocorrencias/{protocolo}/status` e `GET /ocorrencias?status=` com schemas, serviço e repositório.

Resultado: 163 testes passando e 1 ignorado na suíte da Ponte Polícia; migration 0002 amplia `retornos.mensagem` de 280 para 500 caracteres.

### 34. Ponte Polícia: hotspots por janela de tempo (Task 6 do plano 04)

> Executar a Task 6 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_hotspots`, ver falhar, e implementar `GET /hotspots?janela_min=` (chave da polícia, janela de 1 a 10080 minutos, padrão 60) com `contar_por_area` no repositório, `HotspotService`, `risco_por_total` e `HotspotResposta`.

Resultado: hotspots calculados na leitura, sem tabela nova e sem migration; descartadas e área fora da grade não entram.

### 35. Ponte Polícia: painel /policia (Task 7 do plano 04)

> Executar a Task 7 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_painel` e implementar a página `GET /policia` (Jinja2 + Leaflet 1.9.4) com mapa de hotspots, tabela de ocorrências clicável e formulário de mudança de status, sem embutir chave nem dados.

Resultado: painel conferido no navegador com 3 ocorrências sintéticas (2 círculos, 2 hotspots, 3 linhas, PATCH com "Status atualizado"); sem migration.

### 36. Ponte Polícia: teste de contrato e documentação automática (Task 8 do plano 04)

> Executar a Task 8 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): criar `tests/contrato/contrato.json` (transcrição da seção "Ponte Polícia — rotas" dos contratos) e `test_contrato` (campos e enums dos schemas iguais ao contrato, rotas e esquemas de segurança do OpenAPI, exemplo gravado pela API C# em `exemplo_da_api.json` aceito pelo schema, pelo detector de PII e pelo `POST /ocorrencias`, `risco_previsto` só com os valores do contrato, toda rota com summary, description e 401 documentado), ver falhar, e completar só os `summary`/`description`/`responses` que faltarem nas rotas.

Resultado: faltavam as descriptions de `GET /ocorrencias/{protocolo}/retorno` e `PATCH .../status`; 199 testes passando e 1 ignorado na suíte da Ponte Polícia; sem migration. (Entrada registrada na revisão final do plano 04.)

### 37. Ponte Polícia: seed sintético para a demonstração (Task 9 do plano 04)

> Executar a Task 9 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_seed` e implementar `scripts/seed_demo.py` com `gerar_payloads` determinístico (3 focos sintéticos, `uuid5`, `device_hash` derivado, trilha de 2 pontos) e `main()` que posta na Ponte com `PONTE_CHAVE_SERVICO` e imprime o resumo por código. Correção da rodada 1: registrar este prompt, tratar timeout, validar `--n` e cobrir os campos do brief e o `main()` nos testes.

Resultado: seed sintético validado contra o schema e sem PII; sem migration.

### 38. Ponte Polícia: README e evidências (Task 10 do plano 04)

> Executar a Task 10 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever o README da pasta (ficha da CitizenTech, arquitetura, execução, rotas, privacidade, testes, mapa da rubrica de SOA) e gerar as evidências em `ponte-policia/evidencias/` (pytest, Alembic, requisições reais, OpenAPI e prints do Swagger e do painel).

Resultado: 208 testes passando (mais 1 de migração no PostgreSQL), Alembic até `0002 (head)` e evidências geradas com o serviço no ar e dados sintéticos; sem migration nova.

### 39. Revisão final do plano 04 (Ponte Polícia, branch inteiro, 1157760..ac99018)

> Revisão final do plano 04 (Ponte Polícia em `ponte-policia/`), como único corretor: corrigir todos os achados confirmados Critical/Important com teste que falharia sem a correção, e os Minor triviais e seguros; o resto vira dívida. Fontes de verdade: índice e contratos (seção "Ponte Polícia — rotas" e decisões da rodada 2 vencem), spec, plano 04 (Global Constraints, Review Focus, rubrica de SOA) e `global-constraints.md`; compatibilidade com o cliente da API C# sem editar `api/`. Commits pequenos na main, suíte completa antes de cada um.

Resultado: nenhum Critical ou Important. Minors corrigidos: varredura de PII em tempo linear (a regex de e-mail era quadrática num texto longo sem "@") e fora do event loop; CPF e telefone com separador "/", "_" ou contrabarra passam a ser detectados; o 422 de validação não ecoa mais a chave extra do remetente; corpo aninhado demais sem Content-Type JSON dá 422 em vez de 500; `PATCH /status` trava a linha com `SELECT ... FOR UPDATE` (dois agentes simultâneos não reabrem um estado terminal, provado no PostgreSQL com duas threads); OpenAPI com os corpos de erro reais (`ErroSimples`, `ErroPii`, `ErroValidacao`), 200 idempotente documentado e `risco_previsto` como enum; teste PostgreSQL compara migrações e models (`compare_metadata`) e só roda em banco `*_test`; falha fechado testada nas duas chaves; `exemplo_da_api.json` obrigatório; etiqueta Review Focus 4 no teste certo; vetores marcados SINTETICO; testes de PATCH com campo extra e sem status; dependências fixadas, suíte sem avisos, entradas 32 e 36 deste arquivo e cabeçalhos das tarefas 5 a 10. 225 testes passando (2 no PostgreSQL); sem migration (o modelo não mudou).

### 40. Cyber: Sensitive<T>, atributos, índice e farol (Task 1 do plano 03)

> Executar a Task 1 do plano 03 (Cyber): escrever primeiro os testes de `Sensitive<T>` (ToString e JSON sempre `[PII:Classe]`), dos atributos e do `IndiceRisco` (pesos 10/25/40, janela de 24 h do dono, teto 100, limites do farol 30 e 70) e implementar em `Ampara.Domain/Cyber`, sem recriar os enums nem `EventoSeguranca` do plano 02.

Resultado: 14 testes novos passando; sem migration.

### 41. Cyber: detectores por classe, corpus sintético e precisão/recall (Task 3 do plano 03)

> Executar a Task 3 do plano 03 (Cyber): escrever primeiro os testes dos detectores (CPF com DV, IMEI com Luhn, telefone, RG, e-mail, placa, senha, saúde, bordas contra decimais, GUID e JWT, chave indicando classe) e do corpus; implementar `Normalizador`, `Chaves`, `IPiiDetector` e os oito detectores, gerar `cyber/corpus/corpus.csv` com `gerar_corpus.py` (semente 42, só dado sintético) e a evidência `cyber/evidencias/precisao-recall.md` pelo teste.

Resultado: corpus de 357 linhas (194 positivas, 163 negativas), precisão e recall de 100 % no corpus sintético (metas: 95 % e 90 % globais); limitações conhecidas listadas na evidência; sem migration.

### 42. Cyber: correção da rodada 1 da revisão da Task 3 (plano 03)

> Corrigir os achados Important da revisão da Task 3: `SaudeDetector` e `Normalizador` não podem lançar com emoji nem surrogate solto (surrogate solto vira U+FFFD), e as bordas dos detectores deixam de esconder CPF, telefone, IMEI e RG em listas separadas por vírgula ou ponto sem espaço, sem voltar a casar decimais. Cobrir com testes e linhas de corpus; registrar o contrato de timeout na interface.

Resultado: testes novos de "nunca lança" e de listas sem espaço; corpus com 376 linhas; sem migration.

### 43. Cyber: correção da rodada 2 da revisão da Task 3 (plano 03)

> Corrigir o achado Important da rodada 2: a guarda de decimal das bordas (`Validacao.Ini/Fim`) apagava CPF, telefone, IMEI e RG colados por vírgula a número curto ou texto curto (`id,cpf`, `cpf,quantidade`). A vírgula só vale como decimal com sinal (`-23,56724901234`); o ponto continua valendo como decimal.

Resultado: teste novo `Documento_ao_lado_de_numero_curto_ou_texto_em_csv_continua_detectado`; corpus com 387 linhas (220 positivas, 167 negativas), 100 % de precisão e recall; sem migration.

### 44. Cyber: PiiScanner e TaintScope (Task 5 do plano 03)

> Executar a Task 5 do plano 03 (Cyber): escrever primeiro os testes do `PiiScanner` (JSON aninhado e arrays com caminho `a.b[1].c`, raiz array, 60 níveis, pares de form/query/header, texto livre com posição, escapes unicode) e do `TaintScope` (só valores com 4 ou mais caracteres, comparação sensível a caixa); implementar o percurso iterativo com pilha explícita, achado por chave e valor virando um só, falha fechada no timeout de regex. Rodada 1 da revisão: registrar este prompt, cobrir a falha fechada por timeout e a deduplicação/nulo do `TaintScope`, e avisar na interface que `AchadoPii.Valor` é PII em claro.

Resultado: 11 testes do scanner e do taint passando; sem migration.

### 45. Cyber: PiiRequestMiddleware e correlação (Task 6 do plano 03)

> Executar a Task 6 do plano 03 (Cyber): escrever primeiro os testes do pipeline de entrada (JSON, form, query e header marcados com a origem certa, multipart sem ler arquivo, código de emergência como senha só nas rotas configuradas, cadastro intacto no endpoint, entrada hostil com 413/400 em problem+json, correlation id válido reaproveitado e inválido trocado); implementar `ICorrelacao`, `CyberOptions`, `AddCyber`/`UseCyber` e o `PiiRequestMiddleware` que marca no `ITaintScope`, rebobina o corpo e não bloqueia a requisição.

Resultado: 8 testes novos passando, suíte inteira com 324 aprovados; sem migration.

### 46. Cyber: TaintGuard, política por sink e flag de demonstração (Task 7 do plano 03)

> Executar a Task 7 do plano 03 (Cyber): escrever primeiro os testes do `TaintGuard` (Log bloqueia CPF e grava rastro sem o valor, valor marcado sem padrão também é bloqueado, Banco mascara CPF e cifra IMEI, sem PII devolve a mesma string, valor repetido gera um evento, HttpAutenticada passa, falha do rastro não libera nem derruba, flag `Cyber__TaintAtivo=false` só vale com `AMPARA_DEMO=true`); implementar `TaintGuard`, `PoliticaTaint` e `TaintBloqueadoException` e registrar o guard Scoped no `AddCyber` no lugar do `NoopTaintGuard`.

Resultado: 11 testes novos do guard passando; o teste do no-op em `ErrosTests` passou a afirmar o guard real; sem migration.

### 47. Cyber: tradutor de risco com a Claude API (Task 8 do plano 03)

> Executar a Task 8 do plano 03 (Cyber): escrever primeiro os testes do `ITradutorRisco` com `HttpMessageHandler` falso (prompt só com categoria, sink e tipo; valor no tipo nunca sai; sem chave, 401, 500, lentidão e JSON inválido caem na frase padrão em até 5 s; resposta vazia, curta ou longa demais usa a frase padrão; cache de 1 h só para respostas da IA; worker preenche `MensagemCidadao` antes de persistir); implementar `ClaudeTradutorRisco` (Messages API, prompt passando pelo `ITaintGuard` no sink Llm) e registrar `AddHttpClient("anthropic")`, `AddMemoryCache` e o tradutor no `AddCyber`.

Resultado: 24 testes novos passando, suíte inteira com 359 aprovados; sem migration; a chave `ANTHROPIC_API_KEY` ainda não existe, então a chamada real não foi exercitada.

### 48. Cyber: sink de log protegido (Task 9 do plano 03)

> Executar a Task 9 do plano 03 (Cyber): escrever primeiro os testes do logger protegido (CPF no template não chega ao provedor, exceção com PII sanitizada, `Sensitive<T>` aparece como `[PII:Classe]`, mensagem limpa passa igual com nível e `EventId`, antes/depois com a flag de demonstração, senha do corpo de um cadastro não vai ao log); implementar `GuardedLoggerFactory` e `GuardedLogger` e trocar o `ILoggerFactory` no `AddCyber` por um que embrulha o original e resolve o guard da requisição a cada linha.

Resultado: 8 testes novos passando, suíte inteira com 367 aprovados; sem migration.


### 49. Cyber: sink de resposta HTTP não autenticada (Task 10 do plano 03)

> Executar a Task 10 do plano 03 (Cyber): escrever primeiro os testes do sink de resposta não autenticada (CPF e senha na resposta viram `application/problem+json` com `detalheCidadao`, resposta autenticada passa, erro 400 que ecoa o valor continua 400 sem o dado, catálogo com telefone passa com evento `Permitido` e com CPF é bloqueado, login com JWT passa, binário e `/hubs` ignorados, corpo acima de 4x o limite bloqueado); implementar `RespostaNaoAutenticadaMiddleware` após o `PiiRequestMiddleware` e marcar `GET /api/v1/contas/catalogo` com `[PiiPermitida(Telefone)]`.

Resultado: 8 testes novos passando, suíte inteira com 376 aprovados (os testes que ecoam a entrada passaram a rodar como usuário autenticado); sem migration.


### 50. Cyber: caso permitido do IMEI no BO do dono (Task 14 do plano 03)

> Executar a Task 14 do plano 03 (Cyber): escrever primeiro os testes do `ImeiRevelador` (dono recebe o IMEI e fica `Imei/HttpAutenticada/Permitido` no rastro com `bo.imei`; outro usuário vira acesso indevido de peso 40 para o dono e leva 403), do BO pela API (dono vê o IMEI, intruso 403, anônimo 401), de que o IMEI nunca sai em resposta anônima nem em log e de que fica cifrado no banco (`enc:v1:`); implementar `ImeiRevelador` no lugar do `NoopImeiRevelador`, a `CyberApiFactory` (InMemory, tradutor falso, rastro síncrono) com o helper `CriarVitimaComOcorrenciaAsync` só com rotas do contrato, e habilitar o teste de API da Tarefa 11.

Resultado: 17 testes do filtro `ImeiNoBoTests` e `ExceptionHandlerTests` passando, suíte inteira com 408 aprovados; sem migration.

### 51. Cyber: índice, farol, rotas de segurança e simulador de ataque (Task 15 do plano 03)

> Executar a Task 15 do plano 03 (Cyber): escrever primeiro os testes de `GET /api/v1/seguranca/meu-risco` (soma de pesos, farol, só eventos do próprio usuário nas últimas 24 h, no máximo 50, `mensagemCidadao` sempre preenchida, sem `usuarioAlvoId`), de `GET /api/v1/seguranca/executivo` (política `Admin`, 8 classes e 8 sinks sempre presentes, `porHora` com 24 posições, `Permitido` fora da conta) e de `POST /api/v1/seguranca/simular-ataque` (202, 404 com `AMPARA_DEMO` desligado, 422 para cenário desconhecido, farol 40, 65, 75 e 85 na sequência da demonstração, nenhum valor de PII na resposta); implementar `IndiceRiscoService`, `SegurancaEndpoints` e `SimuladorDeAtaque`, que roda o fluxo real com valores sintéticos.

Resultado: 7 testes novos passando, suíte inteira com 415 aprovados; sem migration.

### 52. Cyber: Painel Risco Cidadão, base e visão do cidadão (Task 16 do plano 03)

> Executar a Task 16 do plano 03 (Cyber): escrever primeiro os testes do painel (farol com palavra, ícone e `{indice}/100`, mensagens do cidadão em ordem e com rótulos em português, atualização a cada 5 s com o intervalo limpo ao desmontar, falha de rede com frase amigável mantendo os dados, 401 voltando ao login, token só em sessionStorage com try/catch); implementar `web-painel-risco` em React 18.3.1 + Vite 5.4 (`base /painel-risco/`, porta 5174, proxy `/api` para 5080) com `api.ts`, `rotulos.ts`, `Farol`, `Mensagens`, `VisaoCidadao` e `Login`.

Resultado: 14 testes do painel passando e build sem erro; sem migration; tela conferida com Playwright contra uma API simulada (print em `cyber/evidencias/painel-cidadao-vermelho.png`).

### 53. Cyber: Painel Risco Cidadão, visão executiva e simulador de ataque (Task 17 do plano 03)

> Executar a Task 17 do plano 03 (Cyber): escrever primeiro os testes da visão executiva (total das 24 h, barras por classe e por sink com número ao lado, 24 barras por hora com `role="img"` e `aria-label` "Há N horas: X eventos", 403 com aviso de administrador, atualização a cada 5 s) e do simulador (4 botões com o cenário do contrato, 404 com "Demonstração desligada neste servidor.", altura mínima de 48 px); implementar `VisaoExecutiva`, `Simulador` e `Abas` (`role="tablist"`), ligar as abas "Meu risco" e "Visão executiva" no `App.tsx` e separar 403, 404 e 422 em `api.ts`.

Resultado: 33 testes do painel passando e build sem erro; sem migration; conferência no navegador contra a API real não feita nesta rodada.

### 54. Cyber: sink SignalR via protocolo de hub protegido (Task 18 do plano 03)

> Executar a Task 18 do plano 03 (Cyber): escrever primeiro os testes do sink SignalR (alerta do contrato sai byte a byte igual e sem evento, mensagem com CPF vira `TaintBloqueado` com evento `SignalR/Bloqueado/Cpf`, CPF escrito com escape unicode também é pego); implementar `TaintHubProtocol`, que embrulha o `JsonHubProtocol`, varre os argumentos já decodificados e troca a mensagem suja, e registrá-lo no `AddCyber` no lugar do `IHubProtocol` padrão.

Resultado: 6 testes do `SignalRSinkTests` passando, suíte inteira com 421 aprovados (o cenário de alerta ao vivo do plano 02 segue verde); sem migration.

### 55. Cyber: moderação do texto livre dos relatos (Task 18b do plano 03)

> Executar a Task 18b do plano 03 (Cyber): escrever primeiro os testes do `ClaudeModeradorRelato` com Claude falso (texto neutro volta limpo, CPF e telefone viram `[dado removido]` antes de sair e no texto aprovado, resposta ABUSIVO vira `relato-abusivo` 422, fallback sem texto em 6 cenários de falha dentro de 5 s, vazio não chama a API e texto longo é cortado em 280); implementar o moderador (scrub de PII, prompt de classificação, `max_tokens` 5) e registrá-lo no `AddCyber` no lugar do `ModeradorTextoDescartado`.

Resultado: 16 testes do `ModeradorRelatoTests` passando, suíte inteira com 440 aprovados; sem migration; sem `ANTHROPIC_API_KEY` o relato é aceito sem texto.

### 56. Cyber: suíte de testes de ataque (Task 19 do plano 03)

> Executar a Task 19 do plano 03 (Cyber): criar `cyber/Ampara.Cyber.Ataques` com 13 ataques automatizados contra a API real (CPF ecoado em endpoint anônimo, CPF ofuscado em fullwidth/NBSP/escape unicode, PII em cabeçalho/query/formulário no log, exceção com laudo e CPF, MQTT, senha na resposta, IMEI de outro usuário, prompt ao Claude, payload da Ponte, frame SignalR, flag de demonstração antes/depois, 50 requisições paralelas e entrada hostil), só com banco, Claude e rede falsos; a fixture grava `cyber/evidencias/ataques.md` (id, vetor, esperado, resultado). Se um ataque revelar vazamento real, corrigir o sink, não o teste.

Resultado: 13 ataques passando. O A02, com escape unicode de verdade, revelou um vazamento real: respostas JSON com o CPF escrito em escapes passavam pelo guard de resposta anônima. O `RespostaNaoAutenticadaMiddleware` passou a varrer também nomes e valores decodificados (mascarando os valores de classes permitidas por contrato), com 2 testes novos em `RespostaNaoAutenticadaTests`; suíte da API com 445 aprovados e a de ataques com 13; sem migration. Dígitos soltos separados por espaço (`5 2 9 ...`) não são detectados por desenho do `CpfDetector` e ficaram de fora do A02.

### 57. Cyber: entregas do professor, PDF, ZIP e roteiro do vídeo (Task 20 do plano 03)

> Executar a Task 20 do plano 03 (Cyber): começar pelo `evidencias.sh`, que falha enquanto faltar qualquer print de código (8 ou mais), print do painel (verde, amarelo, vermelho, executiva) ou título obrigatório da documentação; depois gerar os prints de código com `highlight.js` e `playwright-core` usando o Edge já instalado (sem baixar navegador), rodar a API em modo demonstração e o painel para tirar os prints do farol (0, 40, 65, 75) e da visão executiva, escrever `cyber/documentacao.md` com os 4 pontos do professor, gerar o PDF em `cyber/saida/` e o ZIP só com o código versionado (sem PDF, `node_modules`, `.env` nem chave), e escrever o roteiro de 2 a 3 minutos do vídeo do painel.

Resultado: `evidencias.sh` falhou antes e passou depois; PDF de 30 páginas e ZIP gerados fora do git; 445 testes da API e 13 ataques passando. Sem `ANTHROPIC_API_KEY`, as frases do painel nos prints são as frases padrão (regravar com a chave se quiser a frase da IA).

### 58. Cyber: persistência e fila do rastro (Task 2 do plano 03)

> Executar a Task 2 do plano 03 (Cyber): escrever primeiro os testes do rastro (`Registrar` nunca lança com a fila cheia e guarda no máximo 1000 eventos, o worker sobrevive à falha do banco e registra só id, classe e sink, a tabela `evento_seguranca` não tem coluna de valor); implementar `IRastroSeguranca`, `IEventoSegurancaRepository`, `EventoSegurancaConfig` (índice `UsuarioAlvoId, Em`), `RastroSeguranca` (Channel de 1000, `DropOldest`) e `RastroSegurancaWorker`, com a migration `AdicionarEventoSeguranca`.

Resultado: 4 testes do `RastroSegurancaTests` passando, suíte inteira com 284 aprovados; migration `AdicionarEventoSeguranca` aplicada no `ampara_dev` (porta 5436), com 10 colunas e o índice, nenhuma de valor. (Entrada registrada na revisão final do plano 03.)

### 59. Cyber: protetor, máscara e cifra AES-GCM (Task 4 do plano 03)

> Executar a Task 4 do plano 03 (Cyber): escrever primeiro os testes do `PiiProtetor` (máscaras da spec por classe, incluindo o exemplo do professor `***.456.***-00`; cifra de ida e volta com nonce aleatório e prefixo `enc:v1:`; adulteração lança `CryptographicException`; chave ausente ou inválida falha na subida sem ecoar a chave; formato antigo do `CifradorAesGcm` continua legível); implementar `IPiiProtetor` e `PiiProtetor`, que também passa a ser o `ICifrador` registrado.

Resultado: 6 testes do `PiiProtetorTests` passando, suíte inteira com 305 aprovados; sem migration; IMEI e contas gravados a partir daqui saem com `enc:v1:`. (Entrada registrada na revisão final do plano 03.)

### 60. Cyber: sink Erro, handler global de exceções e acesso indevido (Task 11 do plano 03)

> Executar a Task 11 do plano 03 (Cyber): escrever primeiro os testes do `TaintExceptionHandler` (exceção com laudo e CPF vira 500 `problem+json` com frase humana, sem `Exception.Message`, stack nem nome de tipo, e eventos `Erro/Bloqueado` por classe; tradutor chamado só com categoria, sink e tipo; tradutor que estoura ainda devolve 500 amigável; exceção de domínio continua com o status do plano 02 e ganha `detalheCidadao`) e do `AcessoIndevido` (evento `Senha/HttpNaoAutenticada/Bloqueado` para o dono, peso 40); implementar os dois, registrar o handler antes do `ProblemaHandler` e trocar o `NoopAcessoIndevido`.

Resultado: 10 testes do `ExceptionHandlerTests` passando e 1 ignorado (o teste de API ficou para a Task 14), suíte inteira com 387 aprovados; sem migration. (Entrada registrada na revisão final do plano 03.)

### 61. Cyber: sinks Ponte, Claude API e Banco (Task 12 do plano 03)

> Executar a Task 12 do plano 03 (Cyber): escrever primeiro os testes do `TaintHttpHandler` (payload válido da Ponte passa; CPF no corpo para a Ponte ou para `api.anthropic.com` lança `TaintBloqueadoException` antes do envio) e do `TaintSaveChangesInterceptor` (`[TextoLivre]` gravado mascarado, `[PiiCifrado]` em texto puro cifrado com evento `Banco/Cifrado`, já cifrado fica como está); implementar os dois, registrar o handler em todos os `HttpClient` e o interceptor no `AmparaDbContext`, e marcar `Relato.Texto` e `Aparelho.ImeiCifrado`.

Resultado: 6 testes do `SinksPonteLlmBancoTests` passando, suíte inteira com 393 aprovados e 1 ignorado; sem migration (atributos não mudam o esquema). O relatório da tarefa registra que a implementação veio antes da primeira execução dos testes. (Entrada registrada na revisão final do plano 03.)

### 62. Cyber: filtro de PII das mensagens MQTT (Task 13 do plano 03)

> Executar a Task 13 do plano 03 (Cyber): escrever primeiro os testes do `MqttPiiFilter` (CPF no campo livre sai mascarado com rastro `mqtt`, payload limpo volta como a mesma string, JSON inválido vira `[payload inválido]` sem lançar, `deviceId`, `type`, `eventId`, `ts` e `battery` intactos); implementar o filtro com a política `Banco` (mascara; IMEI cifra) e ligá-lo no `DespacharAsync` do `MqttChaveiroGateway` antes de logar ou despachar, nunca com o texto do sink `Log`.

Resultado: 8 testes do `MqttPiiFilterTests` passando (os 4 do brief, `ts` Unix de 10 dígitos intacto, array aninhado, senha só pela chave e IMEI cifrado), suíte inteira com 401 aprovados e 1 ignorado; sem migration. (Entrada registrada na revisão final do plano 03.)

### 63. Revisão final do plano 03 (Cyber, branch inteiro, 3f49f58..29b665d)

> Revisão final do plano 03 (Cyber: motor de PII, `Sensitive<T>`, taint com sinks reais, tradutor de risco, moderação, índice e farol, rotas `/seguranca/*`, simulador, Painel Risco Cidadão, suíte de ataques e entregas em `cyber/`), como único corretor: corrigir todos os achados confirmados Critical/Important com teste que falharia sem a correção, e os Minor triviais e seguros; o resto vira dívida. Fontes de verdade: índice e contratos (rodada 2 vence), spec, plano 03 (Global Constraints e Review Focus) e `global-constraints.md`. Commits pequenos na main, suíte completa antes de cada um.

Resultado: corrigidos os cinco Important. O `Normalizador` passou a descartar todo caractere de formatação (hífen suave, marcas e overrides de direção, separadores invisíveis, tags), seletores de variação, a trocar traços Unicode e o sinal de menos por `-` e dígitos de outras escritas por ASCII: um CPF com hífen suave, travessão curto ou dígitos árabe-índicos passava por todos os sinks (17 casos novos nos detectores e 4 formas novas no A02, que agora tem 10). As recusas de regra (4xx de domínio) deixaram de receber "algo deu errado do nosso lado, tente em alguns minutos": o `ProblemaHandler` manda ao tradutor `EventoTecnico.Recusa(codigo)` e o tradutor devolve uma frase fixa por código (senha errada, convite inválido ou vencido, limite de guardiões, relato barrado, limite de tentativas), sem chamar a IA; só o 5xx segue como falha do sistema (teste novo pelo host real). O `TaintGuard` passou a ler o dono pela claim `sub`, que é a que o `TokenService` emite (antes eventos Log, Erro, Ponte, Llm e Banco de sessões autenticadas ficavam sem `UsuarioAlvoId` e fora do `/seguranca/meu-risco`). A legenda do gráfico por hora do painel subiu para 16 px (teste que varre o CSS). Este registro ganhou as entradas 58 a 62, que faltavam. Minors corrigidos: `VITE_API_URL`/`EXPO_PUBLIC_API_URL` no painel, aviso de sessão encerrada em região `aria-live` com foco no título, hora das mensagens em `America/Sao_Paulo`, texto do simulador ("fluxo real de proteção com dados sintéticos", no lugar de "de mentira"), exemplos da suíte de ataque com `correlationId` fixo (a suíte não suja mais a árvore), `Microsoft.EntityFrameworkCore.Relational` 10.0.15 na suíte de ataques (fim do MSB3277), README do `web-painel-risco`, fala do vídeo para o caso sem chave, explicação de "senha / resposta pública" no acesso indevido, export do `.env` na seção de execução, seta e textos do diagrama, print simulado da Task 16 removido e marcadores `SINTETICO`. Suítes: 475 testes da API, 14 da suíte de ataques (13 ataques + 1 do exemplo versionado) e 36 do painel, build do painel sem erro; sem migration (o modelo EF não mudou). Os prints do painel e o PDF precisam ser regravados (`node cyber/scripts/prints-painel.mjs` e `gerar-pdf.mjs`) para mostrar o texto novo do simulador.

### 64. ML: esqueleto, ambiente e funções de área, faixa e dia da semana (Task 1 do plano 06)

> Executar a Task 1 do plano 06 (ML): criar `ml/requirements.txt`, `ml/pytest.ini`, o venv e `ampara_ml/config.py`; escrever primeiro os testes de `area_id` (Pinheiros `g051_026`, canto `g000_000`, limites superiores exclusivos como `fora`, centro da célula, vetorizado igual ao escalar, `faixa` e `dia_semana`, CSV de referência para paridade com o C#); implementar `area.py` com uma única regra vetorizada e acertar o `.gitignore`.

Resultado: testes de `test_area.py` passando (16 do brief mais NaN e limite superior em ponto flutuante na correção da revisão); sem migration. (Entrada acrescentada na correção da rodada 1 da revisão.)

### 65. ML: mapeamento de colunas da SSP, carga limpa e decisão grade × distrito (Task 2 do plano 06)

> Executar a Task 2 do plano 06 (ML): escrever primeiro os testes de `ssp.py` (normalização de texto e coluna, mapeamento com `ColunaAusente`, `parse_coordenada`, `parse_hora`, carga com resumo por motivo de descarte, proxy de roubo/furto em via pública, CSV latin-1 com ponto e vírgula, `decidir_resolucao`); implementar `ssp.py`, mapear as colunas reais das planilhas SSP 2022 a 2025, rodar a carga real e registrar resumo e decisão em `ml/dados/README.md`.

Resultado: 12 testes de `test_ssp.py` passando; carga real das planilhas 2022 a 2025: 828.618 linhas usadas (proxy de roubo e furto em via pública, capital, dentro da grade), 63,2 % da base, o que faz `decidir_resolucao` devolver `distrito` por causa de linhas com hora `NULL`, não de coordenada (93 % válidas entre as com data e hora). Decisão pendente do controlador; plano B não executado. Sem migration.

> Executar a Task 3 do plano 06 (ML): escrever primeiro os testes de `classes.py` e `divisao.py` (cortes de classe só com contagens positivas do treino, rótulos 0/1/2, período trimestral, início do teste, divisão temporal e CV temporal por período único); implementar os dois módulos e cachear a carga limpa das planilhas SSP em `ml/dados/cache/` (git-ignorado).

Resultado: 11 testes novos passando (43 na suíte de `ml/`); cortes calculados só no treino, CV de janela expansiva que nunca parte um período. Sem migration.

> Executar a Task 4 do plano 06 (ML): escrever primeiro os testes de `painel.py` (defasagens `cont_ant_1`, `cont_ant_4` e `area_ant_4` com dados sintéticos, produto cartesiano com zeros, período futuro, anti-vazamento do próprio alvo, seleção de áreas só no treino, descarte do trimestre parcial); implementar `periodos_completos`, `selecionar_areas` e `montar_painel`.

Resultado: 8 testes novos em `test_painel.py` passando; defasagens calculadas por `shift` + janela de 4 dentro de cada grupo, antes de remover o primeiro período. Sem migration.

### 66. ML: features do GeoSampa, distância à estação e à delegacia (Task 5 do plano 06)

> Executar a Task 5 do plano 06 (ML): escrever primeiro os testes de `geosampa.py` (parse do GetCapabilities, URL do GetFeature paginada, centróide e correção de eixos invertidos, distância mínima haversine, alvo vazio, features por célula); descobrir as camadas do WFS, implementar `geosampa.py`, baixar estações e delegacias e registrar camadas, contagens e a camada de iluminação não baixada em `ml/dados/README.md`.

Resultado: 8 testes de `test_geosampa.py` passando mais o de rede; 203 estações e 93 delegacias baixadas; iluminação (662.945 feições) mapeada e não baixada, à espera do ok do Pedro. Sem migration.

### 67. ML: clima histórico do Open-Meteo (Task 6 do plano 06)

> Executar a Task 6 do plano 06 (ML): escrever primeiro os testes de `clima.py` (URL da API de arquivo, agregação por período, dia e faixa com chuva dividida pelas datas distintas, junção com o painel usando o mesmo trimestre do ano anterior para o futuro, erro sem ano anterior); implementar o módulo, baixar 2022 a 2025 e registrar fonte, período, ponto único e o porquê de não usar o INMET em `ml/dados/README.md`.

Resultado: 4 testes passando mais o de rede (72 linhas em 3 dias); 35.064 linhas horárias baixadas sem valores ausentes, agregadas em 896 linhas. Sem migration.

### 68. ML: população IBGE por distrito e iluminação por célula (Task 7 do plano 06)

> Executar a Task 7 do plano 06 (ML): escrever primeiro os testes de `urbano.py` (normalização de nomes, densidade em EPSG:31983, erro listando distritos sem população, distrito de cada célula com fallback ao mais próximo, contagem de iluminação, features urbanas sem NaN); baixar distritos do GeoSampa, população do Censo 2022 (SIDRA) e a iluminação pública, e registrar fontes, links e datas em `ml/dados/README.md`.

Resultado: 6 testes de `test_urbano.py` passando; 96 distritos com população (11.451.999 hab.) e densidade sem NaN e sem aliases; 662.945 pontos de iluminação baixados em CSV enxuto (~25 MB) e contados por célula. Sem migration.

### 69. ML: dataset de modelagem com cortes só no treino e X_futuro (Task 9 do plano 06)

> Executar a Task 9 do plano 06 (ML): escrever primeiro os testes de `dataset.py` (features base e extra, divisão temporal com X_futuro de 56 linhas, cortes de classe só do treino, erro "sem feature" para NaN, ausência de NaN e inf); implementar `montar_dataset` juntando clima, GeoSampa e dados urbanos ao painel.

Resultado: 5 testes de `test_dataset.py` passando. Sem migration.

### 70. ML: modelos XGBoost e Random Forest com busca e avaliação (Task 10 do plano 06)

> Executar a Task 10 do plano 06 (ML): escrever primeiro os testes de `modelos.py` (grades, busca com CV temporal só no treino, limite ao tamanho da grade, avaliação com classe ausente, treino determinístico, curva de aprendizado); implementar XGBoost com 12 combinações sorteadas, Random Forest como baseline, F1 macro e matriz de confusão.

Resultado: 9 testes de `test_modelos.py` passando. Sem migration.

### 71. Página de apresentação e IA mais barata (Pedro, 15/11)

> faça uma web page que apresente o sistema, quero algum front para poder apresentar, subi a api key tb ja faça o que precisa usando a ia mais barata

Resultado: `apresentacao/` (página estática com indicador ao vivo dos serviços, capturas reais com dados sintéticos e fotos de acervo aberto com crédito), revisada em fatos, visual e acessibilidade. Ao testar a IA, o `claude-haiku-5-5` (modelo mais barato) gastava os 200 tokens pensando e a API caía sempre na frase padrão; o pedido passou a desligar o `thinking` e o sistema ganhou o contexto do Ampara (commit 440871b). O Scalar abria em branco com `AMPARA_DEMO` porque o bundle estourava a varredura de resposta anônima (commit d71abd3).

### 72. Pastas de entrega por disciplina (Pedro, 15/11)

> além disso verifique o que cada entrega de cada materia solicita e crie uma pasta com cada entrega completa para eu so enviar

Resultado: levantamento das 8 disciplinas no PDF da GS e na explicação de Cyber, conferido contra o plano 08, e uma pasta por disciplina em `entrega/` (fora do git) com o que enviar, o texto pronto e o que ainda falta.

### 71. ML: exportação do risco.csv validado e gráficos (Task 11 do plano 06)

> Executar a Task 11 do plano 06 (ML): escrever primeiro os testes de `exportar.py` (gerar_risco com a classe alto localizada por `classes_`, formato do CSV em UTF-8 sem BOM com LF e 4 casas em `prob_alto`, 56 combinações exatas por área, rejeição de linhas inválidas) e de `graficos.py` (matriz de confusão, F1 por conjunto, curva de aprendizado, importância e busca); implementar os dois módulos e gerar o primeiro `ml/saida/risco.csv` real com XGBoost.

Resultado: 18 testes novos passando; primeiro `ml/saida/risco.csv` real (XGBoost 200 árvores, 1.949 áreas ativas × 56 = 109.144 linhas, 5 MB, 0 linhas inválidas); `MIN_OCORR_CELULA` subiu de 20 para 120 para o painel caber em 2 milhões de linhas. Sem migration.

### 73. ML: pipeline real e notebook executado com saídas (Task 12 do plano 06)

> Executar a Task 12 do plano 06 (ML): escrever primeiro o teste de integração de `preparar_dados` com os dados reais; implementar `pipeline.py` encadeando SSP, painel, GeoSampa, clima e variáveis urbanas; montar o notebook `ampara_ml.ipynb` (seções 00 a 04), executá-lo com saídas, gravar `metricas.json`, as figuras e o `risco.csv` do modelo final; testar o notebook entregue.

Resultado: `pipeline.py` (1 teste de integração com os dados reais, 9 min) e notebook `ml/notebooks/ampara_ml.ipynb` executado de ponta a ponta (35 células, 0 erros, 12 combinações XGBoost e 4 de Random Forest, cerca de 1h30); 1.949 áreas, 1.200.584 linhas de treino e 436.576 de teste (2025); F1 macro no teste 0,440 (XGBoost) e 0,466 (Random Forest); `metricas.json`, 8 figuras e `risco.csv` final (109.144 linhas, trimestre 2026T1). Duas correções no caminho: a janela da SSP passou a ser a dos anos das planilhas (fatos de 2000 em diante quebravam o clima) e a escolha dos melhores parâmetros por coluna (a linha inteira virava float). Sem migration.

### 74. ML: relatório de 2 páginas e roteiro do vídeo (Task 13 do plano 06)

> Executar a Task 13 do plano 06 (ML): escrever primeiro o teste que confere o `RELATORIO_ML.md` (seis seções, 3 a 4 figuras, 700 a 1.200 palavras, F1 de treino e teste iguais aos do `metricas.json`) e o roteiro do vídeo (intervalos contíguos, até 5 minutos); depois escrever o relatório e o roteiro com os números reais do notebook e conferir que o relatório cabe em 2 páginas A4.

Resultado: `ml/RELATORIO_ML.md` (cerca de 780 palavras, 3 figuras, 2 páginas A4 conferidas em PDF) dizendo com todas as letras que o Random Forest venceu o XGBoost no teste (0.466 contra 0.440) e que o `risco.csv` usa o XGBoost por decisão do projeto; `ml/ROTEIRO_VIDEO.md` com 7 blocos de 0:00 a 4:55; 2 testes novos passando (109 na suíte do ml). Sem migration.

### 75. ML: fechamento da entrega (Task 14 do plano 06)

> Executar a Task 14 do plano 06 (ML): escrever primeiro `ml/tests/test_entrega.py` (arquivos obrigatórios, requirements com versões exatas, `dados/README.md` com link, período e data de acesso para SSP, GeoSampa, Open-Meteo e IBGE, README do ml com os integrantes, `risco.csv` versionado e dentro do contrato, tamanhos); ver falhar; fixar as versões do ambiente real, escrever o `ml/README.md` e revisar o `dados/README.md`; rodar a suíte inteira e a de dados.

Resultado: `ml/README.md` (pergunta, F1 de teste do XGBoost e do Random Forest, integrantes, como rodar, semântica do `risco.csv`), `ml/requirements.txt` com as 13 versões instaladas, `dados/README.md` com seções `## SSP`, `## GeoSampa`, `## Open-Meteo` e `## IBGE`. Verificação com a API pendente (a API exige Postgres); o plano 08 repete.

<!-- Acrescente aqui os próximos prompts usados pela equipe. -->
