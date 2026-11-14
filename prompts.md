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

> Executar a Task 5 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_retorno_status` e `test_listagem`, ver falhar, e implementar `GET /ocorrencias/{protocolo}/retorno`, `PATCH /ocorrencias/{protocolo}/status` e `GET /ocorrencias?status=` com schemas, serviço e repositório.

Resultado: 163 testes passando e 1 ignorado na suíte da Ponte Polícia; migration 0002 amplia `retornos.mensagem` de 280 para 500 caracteres.

> Executar a Task 6 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_hotspots`, ver falhar, e implementar `GET /hotspots?janela_min=` (chave da polícia, janela de 1 a 10080 minutos, padrão 60) com `contar_por_area` no repositório, `HotspotService`, `risco_por_total` e `HotspotResposta`.

Resultado: hotspots calculados na leitura, sem tabela nova e sem migration; descartadas e área fora da grade não entram.

> Executar a Task 7 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_painel` e implementar a página `GET /policia` (Jinja2 + Leaflet 1.9.4) com mapa de hotspots, tabela de ocorrências clicável e formulário de mudança de status, sem embutir chave nem dados.

Resultado: painel conferido no navegador com 3 ocorrências sintéticas (2 círculos, 2 hotspots, 3 linhas, PATCH com "Status atualizado"); sem migration.

> Executar a Task 9 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever primeiro `test_seed` e implementar `scripts/seed_demo.py` com `gerar_payloads` determinístico (3 focos sintéticos, `uuid5`, `device_hash` derivado, trilha de 2 pontos) e `main()` que posta na Ponte com `PONTE_CHAVE_SERVICO` e imprime o resumo por código. Correção da rodada 1: registrar este prompt, tratar timeout, validar `--n` e cobrir os campos do brief e o `main()` nos testes.

Resultado: seed sintético validado contra o schema e sem PII; sem migration.

> Executar a Task 10 do plano da Ponte Polícia (`2026-11-14-04-ponte-policia`): escrever o README da pasta (ficha da CitizenTech, arquitetura, execução, rotas, privacidade, testes, mapa da rubrica de SOA) e gerar as evidências em `ponte-policia/evidencias/` (pytest, Alembic, requisições reais, OpenAPI e prints do Swagger e do painel).

Resultado: 208 testes passando (mais 1 de migração no PostgreSQL), Alembic até `0002 (head)` e evidências geradas com o serviço no ar e dados sintéticos; sem migration nova.

<!-- Acrescente aqui os próximos prompts usados pela equipe. -->
