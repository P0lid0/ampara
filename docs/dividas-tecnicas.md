# Dívidas técnicas conhecidas

Itens que a revisão final do plano encontrou, verificou como reais e deixou de propósito para depois. Nenhum deles quebra a demonstração. Quando um item for resolvido, ele sai desta lista.

## API (plano 02, revisão final de 14/11/2026, até o commit 53f5798)

### Contrato com o app (plano 05 decide)

- **Gatilho pelo guardião** (contrato-3): o contrato prevê `POST /ocorrencias/gatilho {origem:"guardiao", vitimaId}`, mas o guardião não tem rota para listar quem ele protege. O plano 05 hoje só usa `origem:"web"`.
- **Lote de rota tudo-ou-nada** (contrato-4): basta um ponto fora da janela (mais de 7 dias, ou mais de 5 min no futuro) para o lote inteiro voltar 422. A fila do app precisa tirar esse lote da fila, senão ele reenvia para sempre.
- **Erros fora do problem+json** (contrato-5): 401, 404 e 405 de rota inexistente e 400 de binding saem sem `codigo`, `detalheCidadao` e `correlationId`.

### Concorrência (só aparece com requisições simultâneas na mesma ocorrência)

- **Dois últimos passos ao mesmo tempo** (correcao-2): não há trava nem token de concorrência ao concluir passos.
- **Alertas fora da trava** (correcao-3): só o worker pega a trava `escalada:{id}`. "Ciente", cancelar e concluir passo não pegam.
- **Corrida no índice de uma ocorrência aberta** (correcao-5): no caminho MQTT falta savepoint. O reenvio do chaveiro, 5 s depois, recupera.
- **Alertas encerrados em outro SaveChanges** (correcao-6): o encerramento dos alertas não fica no mesmo SaveChanges que muda o estado da ocorrência.
- **Janela sem alerta** (correcao-1): entre os dois SaveChanges do gatilho HTTP há alguns milissegundos sem alerta criado.
- **Corrida sem teste** (testes-5): os ramos que tratam `DbUpdateException` não têm teste, porque precisariam de um IAmparaDb que simule a linha concorrente.

### Endurecimento

- **Limite de tentativas** (seguranca-5): não há limite por IP em `/auth/*`, nem bloqueio do login por conta.
- **E-mail em claro** (seguranca-6): `TentativasEmergencia` grava o e-mail sem cifra. A retenção já é de 24 h, mas o certo seria guardar um HMAC.
- **Credenciais de demonstração** (seguranca-4): ficam versionadas e só valem com `AMPARA_DEMO=true`. O domínio `ampara.demo` não é reservado no cadastro.
- **Regex de deviceId com `$`** (re-revisão): em `TopicoChaveiro.cs` e `ChaveiroService.cs` o `$` também aceita `\n` no fim do texto. O certo é `\z`. O efeito é desprezível, porque o valor não vai mais para o log.

## Ponte Polícia (plano 04, revisão final de 14/11/2026, até o commit 742d3ae)

- **401 versus 422 com corpo malformado** (contrato-3): sem chave e com um corpo que não é JSON, a resposta é 422, não 401, porque o FastAPI lê o corpo antes de conferir a chave. O cliente C# sempre envia JSON válido.
- **Limite de tamanho do corpo** (seguranca-1, parcial): a regex quadrática foi corrigida e a varredura saiu do event loop. O limite (413) fica para o nginx da VM, com `client_max_body_size`, no plano 07.
- **Print do Swagger desatualizado**: `ponte-policia/evidencias/openapi-docs.png` é de antes dos modelos de erro. Recapturar antes de usar no PDF.
- **Miúdos sem cenário na demo**: o limite de 200 itens não aparece na descrição de `GET /ocorrencias`; um `area_id` malformado gravado fora da API vira 500; os enums não têm CHECK no banco; o nome em texto livre sem prefixo nem acento não é detectado; o painel não tem timeout no fetch; `_postar` do seed não tem teste.

## Cyber (plano 03, revisão final de 14/11/2026)

Lacunas sem caminho concreto hoje (nenhum endpoint, contrato ou mensagem atual as alcança):

- **Ponte/Llm sem decodificar escapes JSON** (vazamento-2): o `TaintHttpHandler` varre o corpo cru; com `JsonSerializerDefaults.Web`, `+` e não ASCII saem escapados e não casam. O caminho da URL não é varrido e `multipart`/`octet-stream` passam. O contrato da Ponte não tem texto livre e o Llm usa `UnsafeRelaxedJsonEscaping`.
- **Atalho do prefixo `enc:v1:`** (vazamento-3): `TaintGuard` (sink Banco) e `TaintSaveChangesInterceptor` pulam qualquer texto que comece com o prefixo, sem conferir se a cifra é válida. Exige entrada forjada (ex.: `nota` MQTT começando com `enc:v1:`).
- **Resposta anônima com tipo fora da lista** (vazamento-4): `RespostaNaoAutenticadaMiddleware` só varre text/json/xml/javascript; `octet-stream`, `x-www-form-urlencoded`, `yaml` e os cabeçalhos da resposta passam.
- **Nomes de propriedade no SignalR e no MQTT** (vazamento-5): `TaintHubProtocol` e `MqttPiiFilter` olham só os valores; um dicionário indexado por telefone passaria. As mensagens do hub são records fixos.
- **Chaves extras marcadas sem normalizar** (vazamento-6): `PiiRequestMiddleware.MarcarChavesExtras` guarda o valor cru; com dígitos de largura total o sink não acha o código. Nenhum caminho ecoa o código.

Entregas que dependem de rodar a API e o painel:

- **Prints e PDF a regravar**: os prints do painel (`cyber/evidencias/prints/painel-*.png`) ainda mostram o texto antigo do simulador ("de mentira") e o PDF, o diagrama antigo. Regravar com `node cyber/scripts/prints-painel.mjs` e `gerar-pdf.mjs`.
- **IMEI da evidência sem `enc:v1:`** (entrega-5): o aparelho da vítima foi semeado antes do prefixo. Ressemear no `ampara_dev` (5436), refazer `imei-cifrado-banco.txt` e o print e tirar a ressalva da seção 2.1.
- **Print do tradutor cortado** (entrega-10, parte): a assinatura da linha 35 sai cortada em `codigo-claude-tradutor-risco.png`.
- **Rótulo do acesso indevido no painel** (entrega-6): o cartão mostra "senha · resposta pública" porque o contrato grava assim; a documentação e o roteiro agora explicam, mas o painel não tem rótulo próprio (o `EventoCidadao` não traz o campo).
- **Corpus sem marcador** (entrega-12, parte): `cyber/corpus/corpus.csv` não tem a linha `SINTETICO` (só o gerador); acrescentar mudaria o leitor do corpus e a evidência de precisão/recall.
- **Teste intermitente sob carga**: em 2 de 3 execuções da suíte com a máquina carregada (48-59 s em vez de 25 s) caíram `LoggerProtegidoTests.Senha_no_corpo_nao_vai_ao_log` e um login 500 em `RelatoTests`; não reproduziu em 7 execuções sem carga (3 na base, 4 com as correções). Investigar antes de confiar na suíte em CI lento.

### Já aceitas antes da revisão final

- **CPF com digitos soltos separados por espaco** (cyber-19): `5 2 9 9 ...` nao e detectado pelo `CpfDetector` (aceita so `.`/espaco entre grupos de 3). Fica fora do A02; a suite de ataques nao cobre essa forma.
