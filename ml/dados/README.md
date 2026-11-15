# Dados do ml/

Os dados brutos ficam em `ml/dados/brutos/` e **não são versionados** (git-ignorados). Esta página registra de onde vêm e o que foi feito com eles.

## SSP-SP (ocorrências criminais)

- **Conjunto:** SPDadosCriminais (Boletins de Ocorrência, dados mensais da Secretaria da Segurança Pública do Estado de São Paulo).
- **Link:** https://www.ssp.sp.gov.br/estatistica/dados-mensais
- **Anos cobertos:** 2022, 2023, 2024 e 2025 (`SPDadosCriminais_<ano>.xlsx`, duas abas por ano: JAN-JUN e JUL-DEZ, mais uma aba de dicionário que o leitor ignora). Data de acesso: 14/11/2026.
- **Proxy de celular (`SSP_CELULAR: PROXY`):** a planilha mistura todas as naturezas e **não tem coluna de celular**. Por isso `carregar_ssp(..., proxy=True)` mantém **roubo e furto em via pública** (`RUBRICA` contém ROUBO ou FURTO e o tipo/subtipo do local contém VIA PUBLICA). É uma aproximação: inclui roubo e furto de qualquer bem. Dizer isso no `RELATORIO_ML.md`.
- **Colunas usadas** (nomes variam entre anos, o mapeamento em `ampara_ml/ssp.py` aceita os candidatos):

| Uso | Coluna real | Observação |
|---|---|---|
| data | `DATA_OCORRENCIA_BO` | data do fato (pode ser anterior ao ano do arquivo) |
| hora | `HORA_OCORRENCIA_BO` | muitas linhas com `NULL` |
| latitude / longitude | `LATITUDE` / `LONGITUDE` | 0 quando não geocodificada |
| município | `NOME_MUNICIPIO` (2023 a 2025), `CIDADE` (2022) | 2022 grafa `S.PAULO` |
| natureza | `RUBRICA` | |
| local | `DESCR_TIPOLOCAL` (2025), `DESCR_SUBTIPOLOCAL` (2022 a 2024) | só o 2025 tem `DESCR_TIPOLOCAL` |

### Carga real (proxy, capital, grade de ~500 m)

`carregar_ssp(<4 planilhas>, proxy=True)`, rodada por ano (o resumo soma por chave):

| Ano | lidas | fora da capital | fora do proxy | data inválida | hora inválida | sem coordenada | fora da grade | **usadas** |
|---|---|---|---|---|---|---|---|---|
| 2022 | 1.198.114 | 711.250 | 150.565 | 202 | 107.779 | 16.292 | 623 | **211.403** |
| 2023 | 1.241.919 | 740.420 | 160.600 | 154 | 109.823 | 15.211 | 706 | **215.005** |
| 2024 | 1.191.814 | 714.901 | 157.396 | 0 | 102.504 | 14.297 | 769 | **201.947** |
| 2025 | 1.161.137 | 693.233 | 152.831 | 0 | 99.952 | 14.066 | 792 | **200.263** |
| **Total** | 4.792.984 | 2.859.804 | 621.392 | 356 | 420.058 | 59.866 | 2.890 | **828.618** |

- Intervalo de datas das linhas usadas: de 2000 a 03/2026 (cada arquivo traz fatos anteriores ao seu ano, registrados depois; o corte de janela de treino é da Task 3). Datas com ano antes de 2000 (erro de digitação, como `0202`) entram em "data inválida".
- **Decisão `decidir_resolucao`:** a base é `lidas − fora da capital − fora do proxy − sem data − sem hora` = 4.792.984 − 2.859.804 − 621.392 − 356 − 420.058 = 891.374; `usadas / base` = 828.618 / 891.374 = **93,0 %**, acima de `COORD_MIN_FRACAO = 0,70`, e `usadas` é 40 vezes `MIN_USADAS`, então a função devolve `"grade"` (GRADE_500M). A primeira versão contava as linhas sem hora na base e dava 63,2 % (`"distrito"`), um artefato da métrica: hora `NULL` nada tem a ver com coordenada.
- **Ressalva:** as 420.058 linhas com hora `NULL` (cerca de 32 % das linhas da capital com o proxy) ficam fora do modelo, porque não têm como entrar numa faixa horária. O risco estimado vale para os boletins com hora registrada.
- Custo da leitura: ~20 a 30 minutos por planilha (openpyxl somente leitura, 4 processos em paralelo), pico de ~1,2 GB de memória no 2023.
