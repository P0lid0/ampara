# cyber

Código, testes de ataque e entregas do professor de Cyber. O PDF e o ZIP de entrega **não** entram no repositório (`cyber/saida/` é ignorado pelo git).

## Como rodar

Suíte de ataques (13 ataques contra a API real; só banco, Claude e rede são falsos, tudo sintético):

```bash
export PATH="$HOME/scoop/apps/dotnet-sdk/current:$PATH" DOTNET_ROOT="$HOME/scoop/apps/dotnet-sdk/current"
dotnet test cyber/Ampara.Cyber.Ataques
```

Passou = linha `Aprovado!  – Com falha: 0`. A cada execução a tabela `id | vetor | esperado | resultado`
é regravada em `cyber/evidencias/ataques.md` (usada no PDF), e as respostas reais dos ataques A01 e A04 em
`cyber/evidencias/exemplo-*.txt`. Um filtro (`--filter`) só troca as linhas dos ataques que rodaram.
O ataque A10 (frame SignalR) é de prioridade P2: `--filter "prioridade!=P2"` o deixa de fora.

Os testes do motor de PII, do taint e do painel estão em `api/Ampara.Tests` (`dotnet test api/Ampara.sln` roda tudo).

## Entregas do professor

| Entrega | Arquivo | Como gerar |
|---|---|---|
| PDF avulso (documentação) | `cyber/saida/Ampara-Cyber-Documentacao.pdf` (fora do git) | `cd cyber/scripts && npm ci && node gerar-pdf.mjs` |
| ZIP do código | `cyber/saida/ampara-cyber-codigo.zip` (fora do git) | `bash cyber/scripts/gerar-zip.sh` (usa o commit HEAD: commite antes) |
| Roteiro do vídeo do painel | `cyber/roteiro-video-painel.md` | já escrito; a gravação é do Pedro |

Fonte do PDF: `cyber/documentacao.md`, com os prints de `cyber/evidencias/prints/`. O PDF e os prints usam o **Edge já instalado** (ou o Chrome, se faltar); nenhum navegador é baixado.

### Scripts (`cyber/scripts/`)

| Script | Para que serve |
|---|---|
| `evidencias.sh` | confere se nada falta: `precisao-recall.md`, `ataques.md`, 8 ou mais `codigo-*.png`, os 4 prints do painel e os títulos da documentação; sai com 1 se faltar algo |
| `prints-codigo.mjs <arquivo> <ini> <fim> <saida.png>` | renderiza o trecho (linhas ini a fim) com `highlight.js` e tira o print |
| `prints-painel.mjs` | com API (`AMPARA_DEMO=true`) e painel no ar, zera o rastro, entra no painel, aciona os cenários e salva os prints (verde 0, amarelo 40 e 65, vermelho 75, executiva) |
| `gerar-pdf.mjs` | converte `documentacao.md` em PDF A4 (`marked` + `page.pdf`) |
| `gerar-zip.sh` | `git archive` de `api cyber web-painel-risco .env.example` e conferência (sem `.pdf`, `node_modules`, `.env`, nem chave da Anthropic) |
| `zerar-demo.sh [email]` | apaga os eventos de segurança do usuário de demonstração (padrão `vitima@ampara.demo`) |
| `consulta-rastro.sh [trecho...]` | mostra o `evento_seguranca` e procura trechos de valores no rastro inteiro (o esperado é 0) |

Os prints do painel de 15/11 têm as frases reais da IA (`claude-haiku-5-5`, chave definida no ambiente da API). Sem a chave, os cartões mostram a frase padrão.

## Onde está o módulo de proteção de dados (para o professor)

| Requisito | Onde |
|---|---|
| Parsing de PII (CPF, RG, IMEI, telefone, e-mail, placa, senha, saúde) | `api/Ampara.Infrastructure/Cyber/PiiScanner.cs`, `Detectores/`, `PiiProtetor.cs` (mascara ou cifra) |
| Interceptação na entrada (formulário e JSON) | `api/Ampara.Api/Middleware/PiiRequestMiddleware.cs` |
| Taint Analysis (marca o dado e bloqueia saída insegura) | `TaintScope.cs`, `TaintGuard.cs`, `PoliticaTaint.cs` em `api/Ampara.Infrastructure/Cyber/` |
| Saídas protegidas | log (`GuardedLogger.cs`), banco (`TaintSaveChangesInterceptor.cs`), HTTP de saída (`TaintHttpHandler.cs`), MQTT (`MqttPiiFilter.cs`), resposta anônima (`api/Ampara.Api/Cyber/RespostaNaoAutenticadaMiddleware.cs`), SignalR (`TaintHubProtocol.cs`) |
| Tradução por IA para o cidadão | `ClaudeTradutorRisco.cs`, `AnthropicMensagens.cs` |
| Indicador Risco Cidadão (farol) | `IndiceRiscoService.cs`, rotas em `api/Ampara.Api/Cyber/SegurancaEndpoints.cs`, tela em `web-painel-risco/` |
| Auditoria (ataques reais contra a API) | `cyber/Ampara.Cyber.Ataques/`, resultados em `cyber/evidencias/` |

## Integrantes

- Pedro Martins (RM_____)
- Vitor Cesarino Marchese (RM_____)
