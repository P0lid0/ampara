# Precisão e recall dos detectores de PII

Corpus sintético `cyber/corpus/corpus.csv` (semente 42, gerado por `cyber/corpus/gerar_corpus.py`).
Linhas: 387 (220 positivas, 167 negativas). Cada linha prevê a união das classes
achadas pelos detectores no valor normalizado e pelas chaves indicadas no nome do campo.

| Classe | Positivos | TP | FP | FN | Precisão | Recall |
|---|---:|---:|---:|---:|---:|---:|
| Cpf | 49 | 49 | 0 | 0 | 100,0% | 100,0% |
| Rg | 22 | 22 | 0 | 0 | 100,0% | 100,0% |
| Imei | 25 | 25 | 0 | 0 | 100,0% | 100,0% |
| Telefone | 30 | 30 | 0 | 0 | 100,0% | 100,0% |
| Email | 24 | 24 | 0 | 0 | 100,0% | 100,0% |
| Placa | 23 | 23 | 0 | 0 | 100,0% | 100,0% |
| Senha | 26 | 26 | 0 | 0 | 100,0% | 100,0% |
| Saude | 29 | 29 | 0 | 0 | 100,0% | 100,0% |
| **Global** | 228 | 228 | 0 | 0 | 100,0% | 100,0% |

Metas: precisão global ≥ 95 %, recall global ≥ 90 %, por classe recall ≥ 85 % e precisão ≥ 90 %.

## Limitações conhecidas
- O corpus é sintético e foi escrito junto com os detectores: os números medem regressão, não o desempenho em dado real.
- Por chave, a regra do plano casa prefixo/sufixo de termos de 3 letras: um campo chamado `cidade` indicaria Saúde (`cid`).
- Por valor, 10 dígitos soltos não são telefone (confundiriam com data Unix); com DDD entre parênteses ou `+55` são.
- 11 dígitos soltos com 3º dígito 9 e DV de CPF inválido contam como telefone (desempate da spec).
