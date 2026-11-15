# Dados do ml/

Os dados brutos ficam em `ml/dados/brutos/` e **não são versionados** (git-ignorados). Esta página registra de onde vêm e o que foi feito com eles.

## SSP (ocorrências criminais, SSP-SP)

- **Conjunto:** SPDadosCriminais (Boletins de Ocorrência, dados mensais da Secretaria da Segurança Pública do Estado de São Paulo).
- **Link:** https://www.ssp.sp.gov.br/estatistica/dados-mensais
- **Período:** 2022, 2023, 2024 e 2025 (`SPDadosCriminais_<ano>.xlsx`, duas abas por ano: JAN-JUN e JUL-DEZ, mais uma aba de dicionário que o leitor ignora).
- **Acesso em:** 14/11/2026.
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

## GeoSampa (WFS): estações, delegacias, distritos e iluminação

- **Fonte:** GeoSampa, Prefeitura de São Paulo (dado aberto).
- **Link:** https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/ows (WFS 2.0.0; o mesmo servidor responde em `/geoserver/wfs`; 488 camadas no `GetCapabilities`). Portal: https://geosampa.prefeitura.sp.gov.br
- **Período:** cadastro vigente na data do acesso (não é série histórica); os pontos de iluminação têm data de carga 21/10/2026, e as demais camadas não trazem data de atualização.
- **Acesso em:** 14/11/2026 (estações, delegacias) e 15/11/2026 (distritos, iluminação). As camadas não trazem data de atualização nos atributos; a defasagem é a do servidor da Prefeitura.
- **Coordenadas:** pedidas em `srsName=EPSG:4326`; `carregar_pontos` troca os eixos quando vêm invertidos e usa o centróide para polígonos e linhas.
- **Camadas** (`ampara_ml/geosampa.CAMADAS`):

| Chave | Camada | Feições | Situação |
|---|---|---|---|
| `estacao` | `geoportal:estacao_metro` + `geoportal:estacao_trem` | 94 + 109 = 203 (todas `OPERANDO`) | baixada |
| `delegacia` | `geoportal:equipamento_policia_civil` | 93 | baixada |
| `iluminacao` | `geoportal:iluminacao_publica` | 662.945 (`resultType=hits`) | baixada em 15/11/2026 como CSV enxuto (ver a seção "Distritos, população e iluminação") |
| `distrito` | `geoportal:distrito_municipal` | 96 (polígonos) | baixada (alimenta a densidade populacional; ver a seção "Distritos, população e iluminação") |

- **Delegacia:** `geoportal:delegacia_policia_civil` existe, mas é o polígono da área de cada DP, não o ponto da delegacia; por isso a feature usa `equipamento_policia_civil` (pontos), a mesma camada de `docs/fontes.md`.
- **Estações:** a camada de trem inclui estações fora da capital (lat até -23,195), o que é desejado: a distância à estação mais próxima de uma célula na borda da grade pode ser uma estação de fora. Intervalo real: lat -23,770 a -23,195, lng -46,984 a -46,185.
- **Delegacias:** lat -23,826 a -23,404, lng -46,796 a -46,397.
- Os arquivos baixados ficam em `ml/dados/brutos/geosampa/` (git-ignorado, ~200 KB); `baixar_camada` reaproveita o arquivo se já existir.
- **Features produzidas** (`features_celulas`): `dist_estacao_m` e `dist_delegacia_m`, distância haversine (raio 6.371.008,8 m) do centro da célula à feição mais próxima.

## Open-Meteo (clima histórico)

- **Fonte:** Open-Meteo Historical Weather API (dado aberto, sem chave).
- **Link:** https://archive-api.open-meteo.com/v1/archive (documentação: https://open-meteo.com/en/docs/historical-weather-api)
- **Acesso em:** 15/11/2026.
- **Período:** 01/01/2022 a 31/12/2025 (uma requisição por ano), série horária de `temperature_2m` e `precipitation` em `America/Sao_Paulo`: 35.064 linhas (4 anos, 1.461 dias × 24 h), sem nenhum valor ausente. Arquivo: `ml/dados/brutos/clima_horario.csv` (git-ignorado, ~0,9 MB); `baixar_clima` reaproveita o arquivo se já existir.
- **Ponto único:** a cidade inteira usa um ponto só (`LAT_CLIMA = -23.5505`, `LNG_CLIMA = -46.6333`, Sé). O clima não varia entre as áreas; só entre período, dia da semana e faixa. É uma limitação, registrada no relatório.
- **INMET não foi usado:** a API do INMET exige cadastro e a série horária das estações da capital tem lacunas; o Open-Meteo não pede chave e entrega a série horária completa.
- **Agregação** (`agregar_clima`): por `(periodo, dia_semana, faixa)`, `clima_temp_media` é a média das horas da faixa e `clima_chuva_mm` é a chuva total da faixa dividida pelo número de datas distintas do grupo (mm por dia). Resultado real: 896 linhas (16 trimestres × 7 dias × 8 faixas); temperatura média de 11,7 a 28,6 °C e chuva de 0 a 4,5 mm por dia.
- **Período futuro** (`juntar_clima`): o trimestre que ainda não aconteceu recebe o clima do mesmo trimestre do ano anterior; se esse também faltar, a função levanta `ValueError`.

## IBGE (Censo 2022: população por distrito)

- **Link:** https://apisidra.ibge.gov.br/values/t/9923/n10/in%20n6%203550308/p/2022 (SIDRA, tabela 9923; portal: https://sidra.ibge.gov.br)
- **Período:** Censo Demográfico 2022 (população residente em 2022).
- **Acesso em:** 15/11/2026.
- **Colunas usadas:** `cod_ibge`, `distrito`, `populacao`; o arquivo baixado fica em `ml/dados/brutos/ibge/populacao_distritos_2022.csv` (git-ignorado).
- Detalhes de junção e densidade na seção seguinte.

## Features urbanas: distritos, população e iluminação

Módulo `ampara_ml/urbano.py`; produz `densidade_pop_hab_km2` e `iluminacao_n` por célula (`features_urbanas`).

- **Distritos (GeoSampa):** camada `geoportal:distrito_municipal`, 96 polígonos (WFS, `srsName=EPSG:4326`, 4,1 MB). Propriedades usadas: `cd_distrito_municipal` (código) e `nm_distrito_municipal` (nome, já em maiúsculas e sem acento). Data de acesso: 15/11/2026.
- **População (IBGE):** Censo Demográfico 2022, população residente por distrito do município de São Paulo, situação do domicílio "Total". API do SIDRA, tabela 9923, nível territorial N10 (distrito): `https://apisidra.ibge.gov.br/values/t/9923/n10/in%20n6%203550308/p/2022`. Data de acesso: 15/11/2026. 96 linhas, soma 11.451.999 habitantes. As tabelas 4714, 9514 e outras do Censo 2022 não aceitam o nível distrito; a 9923 aceita. `baixar_populacao` grava `ml/dados/brutos/ibge/populacao_distritos_2022.csv` (`cod_ibge`, `distrito`, `populacao`; git-ignorado).
- **Junção por nome:** `normalizar_nome` (maiúsculas, sem acento nem pontuação). Os 96 nomes do GeoSampa casam com os 96 do IBGE sem nenhuma grafia diferente, então `ALIASES_DISTRITO` ficou vazio. Se uma fonte mudar a grafia, `densidade_populacional` falha com `ValueError: distritos sem populacao: ...` listando os nomes.
- **Densidade:** `populacao / área em km²`, com a área do polígono calculada em EPSG:31983. Resultado: 96 linhas sem NaN, de 55 a 25.378 hab/km² (mediana 10.773).
- **Distrito da célula:** ponto-no-polígono do centro da célula; se nenhum distrito contém o centro (bordas da grade, fora da capital), vale o distrito mais próximo (`sjoin_nearest` em EPSG:31983). Consequência: células fora da capital herdam a densidade do distrito mais próximo.
- **Iluminação pública (GeoSampa):** camada `geoportal:iluminacao_publica`, 662.945 pontos (um ponto por luminária; vários podem ter a mesma coordenada). O GeoJSON completo teria ~330 MB, acima do limite de download do projeto; por isso `baixar_iluminacao` pede o WFS como **CSV só com a geometria** (`outputFormat=csv`, `propertyName=ge_ponto`, ~57 MB transferidos), em páginas de 20.000 (o servidor corta em 30.000) ordenadas por `cd_identificador_iluminacao_publica`, e grava `ml/dados/brutos/geosampa/iluminacao_publica_pontos.csv` (`lat`, `lng`, ~25 MB, git-ignorado). Os 662.945 pontos baixados batem com a contagem do servidor. Data de acesso: 15/11/2026; os pontos têm data de carga 21/10/2026.
- **Contagem por célula** (`contar_iluminacao`): 648.537 pontos caem na grade e 4.228 das 9.600 células têm ao menos um (mediana 160, máximo 2.083); as demais valem 0. Pontos fora da grade são ignorados.
- **Limitações:** a população é a do distrito inteiro (todas as células do distrito recebem a mesma densidade); a iluminação é cadastro da Prefeitura (quantidade de luminárias, não o estado delas); a camada não cobre bem áreas fora da capital.
