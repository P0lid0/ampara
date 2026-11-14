# Ampara — documento de design

GS CitizenTech · FIAP · Engenharia de Software, 3º ano Fev · 2º semestre de 2026
Versão 3 · 14/11/2026 · Entrega: **19/11/2026, 23h55** (Teams/Portal, uma tarefa por disciplina; 16–19/11 é semana de orientação; 20/11 é feriado)
Equipe: **Pedro** e **Vitor Cesarino Marchese** (só os dois [Pedro]). Vitor: IoT (repositório próprio, incluído em `iot/`). Pedro: todas as outras partes. Claude como copiloto de código (tudo em `prompts.md`).

> Marcações: **[Pedro]** decidido pelo Pedro · **[Claude]** decisão do Claude, corrigível · **[PDF p.X]** exigência literal do briefing · **[Prof]** documento extra do professor de Cyber · **[Vitor]** vem do repositório de IoT.
> v3 incorpora a segunda verificação das 8 matérias (4 avaliadores independentes) e o repositório de IoT do Vitor.

---

## 0. Ficha da CitizenTech (idêntica no início do README de todos os repositórios [PDF p.20])

| Campo | Valor |
|---|---|
| Nome | **Ampara** — "Levaram seu celular. Não levam o resto." [Pedro] |
| Cidade e bairro | São Paulo, capital: eixo da CPTM Linha 9-Esmeralda (Pinheiros como estação crítica) e corredores de quebra-vidro (ex.: Av. do Estado) |
| Cidadão beneficiado | Quem anda com o celular em SP (passageiro de trem/metrô, motorista parado no trânsito) e o **guardião** (parente ou amigo que age por ele na hora) |
| Problema, em uma frase | Depois de um roubo de celular, a vítima fica de 30 a 90 minutos sem aparelho e em choque até chegar em casa ou no trabalho, e é nessa janela que os criminosos entram no banco e nas contas. |
| Como funciona | Antes: o app guarda o que a vítima não lembraria na hora (IMEI, bancos, operadora, guardiões) e a rota dos últimos 7 dias. Durante: um clique no chaveiro (ESP32) ou um código digitado em outro aparelho dispara um alarme insistente no celular do guardião, que segue um passo a passo de bloqueio enquanto a vítima ainda está a caminho. Depois: por outro aparelho, a vítima marca na rota onde e quando foi roubada e o Ampara gera o BO com o IMEI; a ocorrência, minimizada e com consentimento, vai para um painel da polícia (simulado), e o andamento volta ao cidadão. Um mapa mostra o risco previsto por um modelo treinado com dados da SSP-SP e relatos das últimas 2 horas com proteção contra abuso. O Ampara não bloqueia o celular: avisa quem pode bloquear contas e linha. |
| O que cada parte faz | **App** (Expo): cadastro, guardiões, alarme, mapa, histórico de rota, BO. **Página de emergência** (web): acesso por outro aparelho. **API Ampara** (C#/.NET): regras, dados, tempo real, escuta do chaveiro por MQTT, motor PII e taint. **Ponte Polícia** (Python/FastAPI): recebe ocorrências minimizadas e mostra pontos quentes à polícia. **ML** (Python): risco por área e horário. **Chaveiro** (ESP32/Wokwi, Vitor): botão de pânico que fala por MQTT com a API. **VM Linux**: provisiona e mantém tudo no ar. **Painel Risco Cidadão**: bloqueios de segurança traduzidos por IA. |
| Link do repositório | (preencher ao publicar) |
| Indicador de impacto | minutos entre o roubo e o primeiro bloqueio confirmado pelo guardião; % de BOs gerados com IMEI válido; tempo para gerar o BO |
| ODS conectados | **11, 10, 9** (na lista do briefing) e **16** (adicional, fora da lista do briefing) — explicação por meta na seção 13 [Claude] |

---

## 1. Intenção e o porquê

Casos reais (entrevistas exigidas pela etapa 2 [PDF p.19]; registrar em `docs/entrevistas.md` sem identificar as pessoas):
- **Amigo do Pedro:** celular roubado dentro do trem da Linha 9; aparelho ainda sendo pago; medo do acesso às contas.
- **Mãe do Pedro:** quebra-vidro; no susto não lembrou senhas nem o que fazer; os criminosos entraram no banco.

Ponto comum: **os dois só conseguiram agir ao chegar ao destino**. Ninguém age por eles nessa janela, e as soluções existentes estão espalhadas (Celular Seguro, banco, operadora, BO eletrônico que exige IMEI e não deixa acompanhar).

Evidência (fonte e data de acesso em `docs/fontes.md`): ~24 mil furtos de celular em trens e metrô em 2025 (SSP via imprensa); Av. do Estado com 314 quebra-vidros em 2025, >20% entre 18h e 21h; Banco Central (API Olinda, testada): abr/2025 com ~1,39 mi de Pix contestados e ~R$ 334 mi não devolvidos por saldo insuficiente; Waze lançou e suspendeu (ago/2026) o alerta de roubo por abuso; ViaMobilidade sem canal de denúncia.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**: (1) encurtar a janela roubo → bloqueio com um guardião agindo; (2) tirar da memória da vítima o que ela não lembra em choque; (3) gerar o BO com local, hora e IMEI corretos por outro aparelho; (4) mostrar risco por área e horário com dados reais e relatos recentes com anti-abuso; (5) polícia nas duas direções (informação minimizada para a polícia, retorno ao cidadão) [Pedro]; (6) proteger os dados pessoais do próprio sistema de ponta a ponta; (7) 8 entregas coerentes e robustas [Pedro].

**Não-objetivos**: lojas e iOS; integração real com polícia, bancos, operadoras, Celular Seguro ou Anatel; bloquear banco ou celular automaticamente; ler o IMEI automaticamente.

**Anti-objetivos**: incentivar perseguição (vítima e guardião nunca veem a posição do aparelho depois do roubo; essa trilha vai só para a Ponte Polícia, com consentimento); estigmatizar bairros ou pessoas; vazar rota, IMEI, CPF, telefone para mapa público, logs, respostas não autenticadas, Ponte Polícia ou LLM; repetir o erro do Waze; usar dado pessoal real; prometer no pitch o que o protótipo não faz (ex.: "bloqueia o celular").

## 3. Restrições

- Prazo curto; equipe pequena; cada integrante precisa saber explicar o projeto inteiro [PDF p.21]; um envio por disciplina, por um integrante [PDF p.23].
- iPhone sem Mac nem Apple Developer → **Android primeiro, em emulador no Windows** (AVDs vítima e guardião, WHPX ok). O iPhone entra como "outro aparelho" na página de emergência [Pedro].
- Mobile exige **Expo + TypeScript + Expo Router** [PDF p.34]; Flutter descartado.
- Ambiente: Windows 11, 32 GB; .NET SDK 11.0.100 (scoop; o `dotnet` do PATH aponta para um runtime antigo, scripts usam o caminho do scoop); Node 24, Python 3.13, PostgreSQL local, JDK 17, Android SDK + emulador. Sem Docker.
- ML só com dados reais e públicos [PDF p.31]. Cyber: PDF separado do código [Prof].
- LLM: **Anthropic (Claude API)**, chave só em variável de ambiente [Pedro].
- Chaveiro: firmware do Vitor fala **MQTT** com `broker.hivemq.com` (público, só protótipo) [Vitor]; o design se adapta ao contrato dele sem mudar o firmware.

## 4. Abordagens consideradas

| | Abordagem | Decisão |
|---|---|---|
| A | Guardião: pós-roubo no centro, mapa como apoio | **Escolhida** [Pedro], com polícia nas duas direções e histórico de rota [Pedro] |
| B | Mapa no centro | Vira camada de A |
| C | Dispositivo no carro | Vira sensor de impacto opcional (seção 5.2) |

Descartados: localização do aparelho roubado para o cidadão; Telegram ("ninguém vai ver" [Pedro]); Flutter; Firebase para o alarme [Claude]; WSL2 como VM (o PDF exige VM [PDF p.36]); "Modo bloqueado" e contatos por SMS da especificação de app do Vitor (o celular da vítima foi levado; ver 6.6).

## 5. Jornadas

### 5.1 Antes (cadastro)
1. Conta (e-mail e senha) e consentimento explícito e revogável para a rota de 7 dias [Claude].
2. **IMEI com passo a passo completo e explicado** [Pedro] (por que; como obter: código de barras da caixa/nota, `*#06#`, Ajustes; leitura por câmera; dígito Luhn).
3. Bancos e operadora de uma lista curada (telefone/link oficial e data de conferência).
4. Guardiões: até 3, em ordem de escalada, convidados por código/QR [Claude]; o guardião instala o app e aceita.
5. **Parear o chaveiro** (QR com o `deviceId` ou digitado) [Vitor]. Na demonstração, `deviceId` com sufixo aleatório (`chaveiro-ampara-xxxxxx`) para não receber eventos de outras equipes no broker público.
6. Checklist de prevenção (proteção contra roubo do sistema, limite noturno do Pix, senhas não salvas).
7. Código de emergência + palavra secreta (limite de tentativas, sessão curta).

### 5.2 Durante (gatilhos do "modo roubo")
- **Chaveiro, 1 clique** → evento MQTT `alert` [Vitor]. Segurar 3 s com alerta ativo → `cancel` ("alarme falso": fecha a ocorrência e avisa o guardião). Segurar 3 s sem alerta → `test` (não aciona ninguém). `low_battery` → aviso no app.
- **Sensor de impacto (MPU6050)**: **opcional**, depende do Vitor topar acrescentar ao circuito um evento `impact` (janela de 10 s para cancelar). A rubrica de IoT não tem pontuação por sensor [PDF p.38]; o design não o trata como obrigatório.
- **Página de emergência** em outro aparelho (código + palavra secreta).
- **O próprio guardião**, se a vítima ligar de um telefone emprestado.
- No chaveiro e na vítima o alerta é **silencioso**; insistente só no guardião [Vitor + Pedro].

### 5.3 O guardião é acionado
- **Alarme insistente**: tela cheia, sirene, vibração, repetido até "Estou ciente" [Pedro]. Anúncio para leitor de tela.
- **Dois "ciente" diferentes** [Claude]: o `ack` MQTT (máquina: a API confirma ao chaveiro que recebeu e despachou; LED vermelho fixo) ≠ o "Estou ciente" do guardião (humano: para a escalada).
- **Escalada**: sem "Estou ciente" em 60 s, passa ao próximo guardião. Horários gravados (indicador de impacto).
- **Passo a passo** com botões de ligar/abrir: banco(s) → Celular Seguro → operadora → senhas de e-mail e contas → BO. Cada passo com horário.

### 5.4 Depois: histórico de rota → BO
1. Vítima entra pela página de emergência ou pelo app num aparelho emprestado.
2. Linha do tempo da semana no mapa; toca no trecho e na hora do roubo.
3. O Ampara gera o **texto do BO** (local, data, hora, descrição, aparelho, IMEI), botão copiar, abre a Delegacia Eletrônica; delegacia mais próxima (GeoSampa).
4. **Retorno ao cidadão**: status do BO e da recuperação (atualizado pela pessoa e pelo retorno simulado da Ponte), orientação sobre o SP Mobile.
5. **Polícia recebe** (com consentimento): ocorrência minimizada (sem CPF, nome, IMEI; `deviceId` em hash) e a trilha pós-roubo, só para a Ponte.

### 5.5 Mapa de risco
- Risco previsto (ML) por área e faixa horária; relatos das últimas 2 h (tipo, local, hora; sem descrição de pessoas; agregados; expiram); anti-abuso (mais de uma confirmação ou coincidência com risco alto; texto livre passa pelo scrub de PII e depois pelo Claude para barrar abuso); camadas GeoSampa (delegacias, PM, estações).

## 6. Componentes

```
[Chaveiro ESP32/Wokwi (Vitor)] --MQTT 1883--> [broker.hivemq.com] <--MQTT (MQTTnet)-- [API Ampara .NET] <--> [PostgreSQL ampara]
                                                                                    |   \__ SignalR --> [App do guardião]
[App Expo (Android)] ---------------------------------------------------------------+
[Página de emergência (web)] --HTTPS via túnel Cloudflare--> nginx --> API
                                                                                    |-- REST + chave de serviço --> [Ponte Polícia FastAPI] <--> [PostgreSQL ponte]
                                                                                    |                                   \__ painel da polícia (web)
                                                                                    |-- eventos de segurança (sem valores) --> [Claude API] --> [Painel Risco Cidadão]
[ML notebook] -- tabela de risco --> API
[VM Ubuntu 24.04 (QEMU+WHPX)] provisiona e roda: PostgreSQL, API, Ponte, nginx, páginas web, monitor, auditd, túnel
```
O túnel serve só à página de emergência e ao iPhone; o chaveiro não depende dele.

### 6.1 Por disciplina

| Parte | Tecnologia [Claude] | Disciplina | Visível na entrega |
|---|---|---|---|
| App | Expo + TS + Expo Router; dev build Android + **APK pronto** no README; expo-location + expo-task-manager (rota em segundo plano); notifee (tela cheia, sirene); expo-camera; expo-sqlite; mapa **MapLibre** com tiles OSM (sem chave de API) | Mobile [PDF p.34] | telas e navegação (6.6); consumo da API; SQLite (7.3); acessibilidade (6.6); aderência; README com ficha, como rodar, prints; vídeo ≤ 3 min |
| Página de emergência | React + Vite + Leaflet, servida pelo nginx | apoio | funciona no iPhone |
| API Ampara | Solution com `Ampara.Domain`, `Ampara.Application`, `Ampara.Infrastructure`, `Ampara.Api`, `Ampara.Tests`; `global.json` fixando o SDK; target net10.0 (LTS) se o SDK 11 compilar, senão net11.0; EF Core + Npgsql + migrations; LINQ; async; JWT; SignalR; MQTTnet (`IHostedService`); Scalar/OpenAPI; xUnit | C# [PDF p.30] | POO com modelo de objetos (7.1), interfaces e DI explícitas; Web API; EF Core + LINQ; async; qualidade; **evidências**: prints do Scalar, testes passando, migrations aplicadas |
| Motor PII + taint + IA + painel | Dentro da API (6.3) | Cyber [PDF p.28-29, Prof] | PDF separado + código (ZIP/GitHub) + vídeo do painel |
| Ponte Polícia | FastAPI + SQLAlchemy + Alembic, banco `ponte`; camadas routers/services/repositories/schemas; pytest (unitário + contrato) | SOA [PDF p.27] | domínio (7.2), banco, migrations, OpenAPI, testes; README da pasta com execução e integrantes; evidências |
| ML | `ml/` (6.4) | IA & ML [PDF p.31-33] | notebook executado, `ml/dados/README.md`, `requirements.txt`, `RELATORIO_ML.md`, vídeo ≤ 5 min (YouTube não listado) |
| Chaveiro | Repositório do Vitor como submódulo em `iot/` (firmware MQTT, circuito, contrato) [Vitor] | Physical Computing [PDF p.38] | link do Wokwi; vídeo ≤ 4 min mostrando a **cadeia real** (botão → MQTT → API → alarme no guardião); `integrantes.txt` com todos |
| VM Linux | 6.5 | SO [PDF p.35-37] | scripts, evidências em `infra/evidencias/`, vídeo ≤ 7 min |
| Qualidade | Azure Boards (6.7) | Testing [PDF p.39] | features 50%; test cases 50%; PDF com prints; pitch ≤ 4 min |

### 6.2 Alarme do guardião sem Firebase [Claude]
SignalR dentro de serviço em primeiro plano no app do guardião; evento → notificação de importância máxima com tela cheia e sirene (notifee). Permissão de tela cheia concedida manualmente no emulador (Android 14+). Plano B: heads-up de importância máxima com som e vibração repetidos.

### 6.3 Cybersecurity [PDF p.28-29 + Prof]
- **Parsing PII (3 pts, robustez)**: middleware no pipeline da API que intercepta JSON, formulário (`x-www-form-urlencoded`, `multipart`), query string, cabeçalhos e **mensagens MQTT**; percorre objetos aninhados e arrays; detecta por **chave** (`senha`, `documento`, `cpf`…) e por **valor** em qualquer campo; classes: CPF (dígitos verificadores, com e sem pontuação), RG, IMEI (Luhn; desempate com CPF/telefone por tamanho e validação), telefone, e-mail, placa, senha/credencial, termos de saúde/laudo. Regras por classe via `IPiiDetector`. CPF mascarado no formato do professor (`***.456.***-00`); IMEI e contas **cifrados**; o resto mascarado. **Corpus sintético rotulado** com medida de precisão e recall e tabela antes/depois no PDF.
- **Taint (3 pts, eficácia)**: fonte (requisição, formulário, MQTT) → marcação (`Sensitive<T>`) → **sinks**: logger, respostas HTTP não autenticadas, mensagens de erro, Ponte Polícia, SignalR **e a Claude API**. Regra condicional bloqueia variável marcada. Cada decisão grava `{source, campo, classe, sink, decisão (bloqueado/mascarado/permitido), correlationId}`. Evidências: **antes/depois** (flag só de demonstração desliga o módulo e o CPF vaza no log; ligado, é bloqueado) e um **caso permitido** (IMEI decifrado só no BO do dono autenticado). Suíte de "ataque" automatizada.
- **IA na remediação (2 pts)**: evento técnico (bloqueio **ou falha do sistema**, via handler global de exceções) → prompt dinâmico ao Claude **só com categoria, sink e tipo, nunca o valor** → 2 frases: o que aconteceu + o que fazer. Mensagem padrão se a API cair. O app mostra a frase no lugar de "Error 500".
- **Painel Risco Cidadão (2 pts)**: visão do cidadão (farol + índice 0–100 + mensagens; só eventos ligados a ele) e **visão executiva** agregada (eventos por classe e sink nas 24 h, tendência). Índice: soma ponderada nas 24 h do dono do dado-alvo (log bloqueado 10; resposta não autenticada bloqueada 25; acesso indevido = código de emergência errado ou acesso a recurso de outro usuário 40; teto 100; verde < 30, amarelo 30–69, vermelho ≥ 70). Botão/script **"simular ataque"** gera atividade ao vivo para o vídeo e os prints (antes e depois).
- **Entrega [Prof]**: (1) PDF avulso com prints de código e evidências dos 4 pontos; (2) código em ZIP próprio (sem `node_modules`, sem segredos) ou link do GitHub, **sem misturar com o PDF**; (3) vídeo do painel em atividade.

### 6.4 ML [Claude, sobre PDF p.31-33]
- **Pergunta**: "em que áreas e horários de SP o risco de roubo/furto de celular é alto?" — classificação em 3 classes por área × faixa horária × dia da semana.
- **Dados**: SSP-SP (conferir colunas no dia 1; SPSafe como apoio), GeoSampa, clima (INMET/Open-Meteo), IBGE. Área: grade ~500 m se lat/long confiável; senão distrito.
- **Sem vazamento**: cortes das classes calculados só no treino; contagens do mesmo período não viram feature (só variáveis defasadas ou estruturais).
- **Divisão**: temporal (treino até 2024, teste 2025; plano B: últimos 12 meses disponíveis); CV temporal só no treino.
- **Modelo principal XGBoost** (justificativa: tabular, desbalanceado, importância de variáveis) com **baseline Random Forest**. Hiperparâmetros XGBoost: `n_estimators`, `max_depth`, `learning_rate` (≥ 10 combinações, tabela com F1 de CV); RF: `n_estimators`, `max_depth`, `min_samples_leaf`.
- **Métricas**: F1 macro, matriz de confusão, curva de aprendizado, gráficos treino × teste, discussão de overfitting, leitura para o cidadão. Semente fixa; notebook executado com saídas.
- **Relatório**: 2 páginas cheias (atende "2 a 4" da p.31 e "2" da p.33).

### 6.5 VM Linux [PDF p.35-37, verificado]
- **Exigência literal**: "provisionado de forma automática (dentro da VM)" [PDF p.36]; script de "redes, DNS, IP" (2 pts) [PDF p.37]; "rede, dns, hostname, monitoramento, auditoria" [PDF p.36]. WSL2 descartado.
- **Escolha**: Ubuntu Server 24.04 em **QEMU + WHPX** (sem administrador, conta ou custo). Planos B: Hyper-V (Pedro ativa) ou VM Azure for Students.
- **Provisionamento automático**: cloud-init (NoCloud) no primeiro boot baixa o repositório e roda os scripts.
- `01-infra.sh`: hostname, IP fixo/gateway/DNS por netplan, usuários, ufw (inclui saída 1883 para o MQTT).
- `02-app.sh`: dependências, variáveis, build/publicação; **orquestração** explícita PostgreSQL → migrations → API → Ponte → nginx (units systemd com `After=`/`Requires=`) e healthcheck que só conclui com `/health` respondendo.
- `03-monitor.sh` + serviço systemd tolerante a falhas: CPU > 80%, memória > 80%, disco > 85% (limites em arquivo de configuração), saúde dos serviços (incluindo a conexão MQTT da API); alertas em `/var/log/ampara/alertas.log` e no journald; `stress-ng` no vídeo dispara cada alerta.
- **Auditoria**: `auditd` com regras sobre `/etc/ampara`, os scripts e `sudo`; log de execução de cada script (início, fim, código de saída).
- **Teste de falha** roteirizado (matar API e monitor → systemd reinicia → monitor registra).
- **Evidências** em `infra/evidencias/` (as mesmas do vídeo). Túnel `cloudflared` como serviço.

### 6.6 App: telas, acessibilidade e o que fica da especificação do Vitor
**Telas (Expo Router)** [Claude, base na estrutura do Vitor]: onboarding (conta, consentimento, IMEI, bancos/operadora, guardiões, chaveiro, código de emergência) · tabs **Início** (status do chaveiro e do guardião, último alerta) / **Mapa** (risco + relatos) / **Histórico** (ocorrências, linha do tempo) / **Ajustes** (dados, chaveiro, "achar chaveiro", modo demonstração) · `guardiao/alarme` (tela cheia) · `guardiao/passo-a-passo` · `rota` (linha do tempo da semana) · `bo` · `relato`.
**Acessibilidade (critérios testáveis)** [Vitor]: texto ≥ 16 pt sem travar `allowFontScaling`; contraste 4.5:1; alvos ≥ 48 dp; estado nunca só por cor; `accessibilityLabel`/`Role` em tudo; `announceForAccessibility` no alarme; linguagem simples.
**Aproveitado do Vitor**: contrato MQTT, idempotência por `eventId`, eventos `alert/cancel/test/low_battery`, comandos `ack/resolve/find/ping`, status retido, **modo demonstração** (`handleEvent` único para MQTT e demo; o `simulador_app.py` vira ferramenta de teste), critérios de aceite da seção 13 dele, regras de acessibilidade.
**Substituído**: "app da vítima responde `ack`" → a **API** é o único componente que responde `ack` (a especificação dele permite: "o backend pode assumir o papel de ouvir o MQTT") [Claude]; "contatos por SMS/WhatsApp simulados" → guardiões com alarme e escalada; "Modo bloqueado / bloqueia o celular" → fora (o aparelho foi levado); "localização do celular para a polícia" → só trilha pós-roubo para a Ponte, com consentimento e minimização. A `especificacao-app.md` do Vitor fica como referência histórica, não como especificação do Ampara.

### 6.7 Testing & QA [PDF p.39, p.23]
- Pedro cria organização e projeto no Azure DevOps (pedir antes ao professor o e-mail institucional), convida o professor como **Admin** e confirma o aceite; link do projeto na primeira página do PDF.
- **Formato das features**: conferir o padrão da aula no material/professor antes de montar (Dado/Quando/Então é suposição); itens chamados literalmente "Feature".
- ~15–20 Features cobrindo app, API, Ponte, Cyber, IoT, ML e infra; **≥ 1 test case positivo e ≥ 1 negativo por Feature**, vinculados ("Tested By") e marcados (+/−); objetivo e preparação na descrição, passos com ação e resultado esperado; plano B se a conta não tiver Test Plans: itens com passos documentados na descrição.
- Negativos reais: PII mascarada, mesmo `eventId` 5 vezes = 1 ocorrência e 5 `ack`, código de emergência errado, relato abusivo barrado, broker fora do ar (modo demonstração).
- **PDF**: print da lista de Features, do detalhe de cada Feature, da definição de cada Test Case e da tela de membros com o professor Admin; nenhum dado real.
- **Pitch** ≤ 4 min no YouTube (não listado), link na tarefa de Testing: problema → solução funcionando (guardião, chaveiro, BO, painel Risco Cidadão, VM) → quem ajuda.

## 7. Modelo de dados

### 7.1 API Ampara (modelo de objetos, POO)
Entidades com comportamento: `Usuario`; `Aparelho` (IMEI cifrado); `Guardiao` (ordem; `PodeEscalar()`); `ContaVinculada`; `Chaveiro` (`deviceId`, usuário, bateria, online); `PontoRota` (retenção 7 dias); `Ocorrencia` (`Iniciar()`, `MarcarMomento()`, `Cancelar()`, `Encerrar()`; estados); `Alerta` (`Confirmar()`); `AcaoGuardiao`; `BoRascunho`; `Relato`; `EventoRecebido` (`eventId` único: idempotência); `EventoSeguranca` (rastro do taint).
Polimorfismo: `IGatilho` com `GatilhoChaveiro`, `GatilhoImpacto` (opcional), `GatilhoWeb`, `GatilhoGuardiao`. Serviços por interface com DI: `IOcorrenciaService`, `IEscalonamento`, `IBoGenerator`, `IRotaService`, `IRiscoService`, `IPiiDetector` (uma implementação por classe de PII), `ITaintGuard`, `ITradutorRisco` (Claude), `IPontePoliciaClient`, `IChaveiroGateway` (MQTT).
Onde o IMEI é decifrado: só no BO para o dono autenticado; declarado ao taint como saída permitida.

### 7.2 Ponte Polícia (domínio próprio)
`Ocorrencia` (estados recebida → em_analise → atendida/descartada; idempotência por `ocorrencia_id` de origem); `TrilhaPosRoubo`; `Hotspot` (agregado por área e hora, janela configurável); `Retorno` (andamento devolvido ao Ampara). Regras: rejeita payload com PII; só aceita chamadas com chave de serviço.
**Contrato API → Ponte** [Claude]: `POST /ocorrencias` (`origem_id`, área, `ts`, tipo, `device_hash`, trilha opcional) → `201 {protocolo, status}`; `GET /ocorrencias/{protocolo}/retorno`; autenticação por cabeçalho com chave de serviço; teste de contrato contra o schema real da API.

### 7.3 SQLite do app
`sessao`, `guardiao` (cache), `chaveiro` (cache de status), `ocorrencia` e `passo` (linha do tempo local), `evento_recebido` (quando em modo demonstração), `rota_pendente` (fila offline de pontos), `relato_pendente`.

## 8. Dados públicos (todos reais)
SSP-SP (planilhas anuais; SPSafe), GeoSampa WFS, INMET/Open-Meteo, IBGE, Banco Central Olinda (pitch), lista curada de bloqueio. Fontes, links e datas em `docs/fontes.md`.

## 9. Segurança e privacidade do desenho
Consentimento revogável; retenção de 7 dias; IMEI e contas cifrados; rota só do dono; código de emergência com limite; minimização na Ponte; chave da Claude API só em variável de ambiente; motor PII e taint sobre o próprio sistema, inclusive mensagens MQTT. **Broker público**: qualquer um publica no tópico; mitigação no protótipo: payload sem dado pessoal (só `deviceId`, tipo, hora, bateria) [Vitor], `deviceId` não adivinhável, vínculo chaveiro↔usuário só no backend, idempotência; no produto: broker próprio com TLS, credencial por chaveiro e ACL [Vitor].

## 10. Repositório [Claude]
Monorepo: `app/`, `web-emergencia/`, `api/` (C#), `ponte-policia/` (Python), `ml/`, `iot/` (**submódulo** do repositório do Vitor, preserva autoria e histórico), `infra/` (+ `infra/evidencias/`), `cyber/` (só código e testes de ataque; **o PDF de Cyber não entra no repositório**), `qa/` (roteiros, matriz Feature × TC, ferramentas como o simulador do Vitor), `docs/` (fontes, entrevistas, fotos de rascunhos em papel [PDF p.19], ODS). Um `prompts.md` na raiz com os prompts de todos (incluindo os do Vitor). `integrantes.txt` na raiz e em `iot/` com todos. README por pasta com como rodar e integrantes. Cada tarefa do Teams recebe o link apontando para a pasta da disciplina.

## 11. Prioridades
1. **Base e demonstração**: API + banco + MQTT; app (cadastro/IMEI, guardião com alarme e escalada, histórico → BO, rota em segundo plano); página de emergência; motor PII + taint + IA + painel; Ponte com painel; ML completo; VM provisionada; Azure Boards.
2. **Importante**: relatos de 2 h com anti-abuso; retorno ao cidadão; checklist de prevenção; camadas GeoSampa.
3. **Se sobrar tempo**: sensor de impacto, status das linhas, reputação, iOS.

Dia 1 = matar riscos: emulador com rota simulada; conexão API ↔ HiveMQ e Wokwi em paralelo; VM QEMU; túnel; colunas da SSP.

## 12. Riscos
SSP com colunas inesperadas (plano B distrito/SPSafe) · rota em segundo plano no emulador (plano B app de GPX) · tela cheia no Android 14+ (permissão manual; plano B 6.2) · QEMU instável (Hyper-V/Azure) · **HiveMQ público fora do ar ou lotado** (modo demonstração injeta o mesmo `handleEvent`; vídeos carregam a prova) · túnel fora do ar (só afeta a página de emergência) · escopo × equipe (prioridades; dividir envios e gravações) · margem curta para gravar e subir os 6 vídeos (roteiros prontos junto com cada parte).

## 13. ODS (como contribui para as metas) [Claude]
- **11 — metas 11.2 e 11.7**: transporte e espaços públicos mais seguros (mapa de risco, relatos, recorte da Linha 9).
- **10 — meta 10.2**: o transporte coletivo concentra os furtos e atende quem tem menos alternativa; app gratuito e acessível.
- **9 — meta 9.c**: tecnologia acessível e dados abertos aplicados a um problema urbano.
- **16 — metas 16.1 e 16.6** (adicional, fora da lista do briefing, mantido por ser o mais aderente): BO com dados corretos, ocorrência minimizada para a polícia, retorno ao cidadão.
O Vitor troca, na ficha do repositório dele, os ODS 11, 3, 10 por esta lista.

## 14. O que fica para o construtor
Bibliotecas de UI; tamanho exato da área no mapa; modelo exato do Claude; desenho visual (petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D`; Manrope); texto do BO; nomes de endpoints.

## 15. Combinados com pessoas

**Pedro faz pessoalmente**: chave da Claude API (variável de ambiente); conta Azure DevOps + convite do professor; conferir o padrão de Features da aula; registrar entrevistas e fotografar um rascunho em papel; gravar vídeos; fazer os envios (ou dividir com a equipe).

**Combinar com o Vitor** (é dono do `iot/`):
1. A API passa a ser o único componente que responde `ack` (o firmware não muda).
2. Atualizar a ficha e os ODS do README dele para os desta seção 0/13; tirar as frases "bloqueia o celular" e "localização para rastrear"; marcar `especificacao-app.md` como referência histórica.
3. Salvar o projeto no Wokwi e colocar o link no README.
4. Vídeo ≤ 4 min com a cadeia real (botão → MQTT → API → alarme no guardião), não só o simulador.
5. `integrantes.txt` com todos.
6. (Opcional) acrescentar o MPU6050 e o evento `impact`.
7. Usar um `deviceId` não adivinhável na demonstração.

**Equipe definida** [Pedro]: Pedro e Vitor. Vitor entrega Physical Computing (Wokwi, vídeo, `integrantes.txt`); Pedro envia as outras 7 disciplinas e grava os vídeos delas; os dois aparecem no pitch e os dois precisam saber explicar o projeto inteiro [PDF p.21].
