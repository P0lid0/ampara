# Ataques automatizados (suite Ampara.Cyber.Ataques)

Cada linha e um ataque contra a API real (so banco, Claude e rede sao falsos). Valores sinteticos.
Este arquivo e regravado a cada execucao de `dotnet test cyber/Ampara.Cyber.Ataques`.

| id | vetor | esperado | resultado |
|---|---|---|---|
| A01 | CPF em JSON ecoado por endpoint anonimo | 500 problem+json, CPF ausente, evento HttpNaoAutenticada/Bloqueado | OK: bloqueado com 500 problem+json, 1 evento, CPF ausente do corpo e do log |
| A02 | CPF ofuscado (fullwidth, NBSP, zero-width, hifen suave, travessao, marca de direcao, digitos arabe-indicos, escape unicode no JSON) | todas as formas bloqueadas, nenhum digito na resposta | OK: 10 formas ofuscadas, todas bloqueadas com 500 problem+json |
| A03 | CPF em cabecalho, query string e formulario, registrados por um endpoint de depuracao | nenhuma linha de log contem o CPF | OK: 3 linhas de log do endpoint, CPF ausente de todas |
| A04 | excecao com laudo e CPF na mensagem | 500 problem+json com frase humana, sem 'Error 500', sem stack, sem CPF | OK: 500 problem+json com detalheCidadao em linguagem simples; eventos Erro/Bloqueado de CPF e Saude |
| A05 | mensagem MQTT do chaveiro com CPF no campo livre | o servico recebe o payload com o CPF mascarado; deviceId e eventId intactos | OK: payload entregue com ***.982.***-25, evento Mqtt/Banco/Mascarado, CPF ausente do log |
| A06 | senha ecoada em resposta publica (JSON e texto puro) | 500 problem+json, senha ausente, evento Senha/Bloqueado | OK: bloqueado nas duas formas, senha ausente do corpo e do log |
| A07 | IMEI no BO: dono, anonimo e outro usuario autenticado | so o dono ve o IMEI; o intruso leva 403 e vira acesso indevido (peso 40) para a vitima | OK: dono recebe; anonimo 401; intruso 403; 1 acesso indevido de peso 40 para a vitima; IMEI fora do log |
| A08 | prompt enviado ao Claude depois de eventos com CPF, senha, laudo e acesso indevido | o corpo enviado so tem categoria, sink e tipo: sem digitos longos nem pedacos do CPF | OK: 7 prompts capturados, nenhum com valor |
| A09 | payload para a Ponte Policia com e-mail do cidadao | a chamada e barrada antes da rede; payload do contrato passa | OK: payload do contrato saiu (1 pedido); com e-mail e com CPF foram barrados, 0 pedidos extras na rede |
| A10 | frame SignalR com CPF (puro e em fullwidth) saindo do hub | o frame vira TaintBloqueado, sem o CPF | OK: 2 frames sujos trocados por TaintBloqueado, eventos SignalR/Cpf |
| A11 | flag Cyber:TaintAtivo=false (so vale com AMPARA_DEMO=true) | antes: log e resposta vazam o CPF; depois: bloqueiam; sem AMPARA_DEMO a flag e ignorada | OK: antes: 200 com CPF na resposta e no log; depois: 500 bloqueado e log limpo; sem demo a flag e ignorada |
| A12 | 50 POSTs simultaneos em /eco anonimo, CPFs distintos | 50 respostas bloqueadas, 50 eventos com 50 CorrelationIds distintos, sem mistura | OK: 50 respostas 500 problem+json, 50 eventos, 50 CorrelationIds distintos e casados com as respostas |
| A13 | JSON com 200 niveis, corpo de 2 MiB (com e sem Content-Length), JSON invalido | 400, 413, 413, 400; passagem do JSON normal; nenhum 500 nem texto tecnico | OK: profundo 400, gigante 413, gigante sem tamanho 413, invalido 400, normal 401 |
