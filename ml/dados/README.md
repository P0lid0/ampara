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

## GeoSampa (WFS): distância à estação e à delegacia

- **Fonte:** GeoSampa, Prefeitura de São Paulo (dado aberto). WFS 2.0.0 em `https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/ows` (o mesmo servidor responde em `/geoserver/wfs`; 488 camadas no `GetCapabilities`). Data de acesso: 14/11/2026. As camadas não trazem data de atualização nos atributos; a defasagem é a do servidor da Prefeitura.
- **Coordenadas:** pedidas em `srsName=EPSG:4326`; `carregar_pontos` troca os eixos quando vêm invertidos e usa o centróide para polígonos e linhas.
- **Camadas** (`ampara_ml/geosampa.CAMADAS`):

| Chave | Camada | Feições | Situação |
|---|---|---|---|
| `estacao` | `geoportal:estacao_metro` + `geoportal:estacao_trem` | 94 + 109 = 203 (todas `OPERANDO`) | baixada |
| `delegacia` | `geoportal:equipamento_policia_civil` | 93 | baixada |
| `iluminacao` | `geoportal:iluminacao_publica` | 662.945 (`resultType=hits`) | **não baixada**: passa de 500 mil feições e o plano manda pedir o ok do Pedro antes |
| `distrito` | `geoportal:distrito_municipal` | 96 (polígonos) | mapeada, não baixada (só serve ao plano B por distrito, pulado) |

- **Delegacia:** `geoportal:delegacia_policia_civil` existe, mas é o polígono da área de cada DP, não o ponto da delegacia; por isso a feature usa `equipamento_policia_civil` (pontos), a mesma camada de `docs/fontes.md`.
- **Estações:** a camada de trem inclui estações fora da capital (lat até -23,195), o que é desejado: a distância à estação mais próxima de uma célula na borda da grade pode ser uma estação de fora. Intervalo real: lat -23,770 a -23,195, lng -46,984 a -46,185.
- **Delegacias:** lat -23,826 a -23,404, lng -46,796 a -46,397.
- Os arquivos baixados ficam em `ml/dados/brutos/geosampa/` (git-ignorado, ~200 KB); `baixar_camada` reaproveita o arquivo se já existir.
- **Feature de iluminação:** fica de fora até o Pedro autorizar o download (Tarefa 9 trata a ausência).
- **Features produzidas** (`features_celulas`): `dist_estacao_m` e `dist_delegacia_m`, distância haversine (raio 6.371.008,8 m) do centro da célula à feição mais próxima.

## Clima histórico (Open-Meteo)

- **Fonte:** Open-Meteo Historical Weather API (dado aberto, sem chave), `https://archive-api.open-meteo.com/v1/archive`; documentação em `https://open-meteo.com/en/docs/historical-weather-api`. Data de acesso: 15/11/2026.
- **Período baixado:** 01/01/2022 a 31/12/2025 (uma requisição por ano), série horária de `temperature_2m` e `precipitation` em `America/Sao_Paulo`: 35.064 linhas (4 anos, 1.461 dias × 24 h), sem nenhum valor ausente. Arquivo: `ml/dados/brutos/clima_horario.csv` (git-ignorado, ~0,9 MB); `baixar_clima` reaproveita o arquivo se já existir.
- **Ponto único:** a cidade inteira usa um ponto só (`LAT_CLIMA = -23.5505`, `LNG_CLIMA = -46.6333`, Sé). O clima não varia entre as áreas; só entre período, dia da semana e faixa. É uma limitação, registrada no relatório.
- **INMET não foi usado:** a API do INMET exige cadastro e a série horária das estações da capital tem lacunas; o Open-Meteo não pede chave e entrega a série horária completa.
- **Agregação** (`agregar_clima`): por `(periodo, dia_semana, faixa)`, `clima_temp_media` é a média das horas da faixa e `clima_chuva_mm` é a chuva total da faixa dividida pelo número de datas distintas do grupo (mm por dia). Resultado real: 896 linhas (16 trimestres × 7 dias × 8 faixas); temperatura média de 11,7 a 28,6 °C e chuva de 0 a 4,5 mm por dia.
- **Período futuro** (`juntar_clima`): o trimestre que ainda não aconteceu recebe o clima do mesmo trimestre do ano anterior; se esse também faltar, a função levanta `ValueError`.
