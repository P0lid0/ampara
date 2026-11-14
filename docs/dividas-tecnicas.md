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
