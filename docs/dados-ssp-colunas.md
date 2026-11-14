# Colunas da planilha SSP-SP

Gerado por `qa/spikes/ssp/colunas.py`. Contem so nomes de coluna, % de nulos, tipo e limites de coordenadas; nunca valores de celula.

## Aba `CAMPOS_DA_TABELA_SPDADOS`

| Coluna | % nulos | Tipo |
|---|---|---|
| (sem cabecalho reconhecido) | | |

## Aba `JAN-JUN_2025`

| Coluna | % nulos | Tipo |
|---|---|---|
| NOME_DEPARTAMENTO | 0.0 | str |
| NOME_SECCIONAL | 0.0 | str |
| NOME_DELEGACIA | 0.0 | str |
| NOME_MUNICIPIO | 0.0 | str |
| NUM_BO | 0.0 | str |
| ANO_BO | 0.0 | int |
| DATA_REGISTRO | 0.0 | datetime |
| DATA_OCORRENCIA_BO | 0.0 | datetime |
| HORA_OCORRENCIA_BO | 0.0 | str/time |
| DESC_PERIODO | 0.0 | str |
| DESCR_TIPOLOCAL | 0.0 | str |
| DESCR_SUBTIPOLOCAL | 0.0 | str |
| BAIRRO | 0.6 | str |
| LOGRADOURO | 0.0 | str |
| NUMERO_LOGRADOURO | 14.6 | int |
| LATITUDE | 0.0 | float/int/str |
| LONGITUDE | 0.0 | float/int/str |
| NOME_DELEGACIA_CIRCUNCRIÇÃO | 0.0 | str |
| NOME_DEPARTAMENTO_CIRCUNCRIÇÃO | 0.0 | str |
| NOME_SECCIONAL_CIRCUNCRIÇÃO | 0.0 | str |
| NOME_MUNICIPIO_CIRCUNCRIÇÃO | 0.0 | str |
| RUBRICA | 0.0 | str |
| DESCR_CONDUTA | 0.0 | str |
| NATUREZA_APURADA | 0.0 | str |
| MES_ESTATISTICA | 0.0 | int |
| ANO_ESTATISTICA | 0.0 | int |
| CMD | 0.0 | str |
| BTL | 0.0 | str |
| CIA | 0.0 | str |
| CD_IBGE | 0.0 | int |

## Aba `JUL-DEZ_2025`

| Coluna | % nulos | Tipo |
|---|---|---|
| NOME_DEPARTAMENTO | 0.0 | str |
| NOME_SECCIONAL | 0.0 | str |
| NOME_DELEGACIA | 0.0 | str |
| NOME_MUNICIPIO | 0.0 | str |
| NUM_BO | 0.0 | str |
| ANO_BO | 0.0 | int |
| DATA_REGISTRO | 0.0 | datetime |
| DATA_OCORRENCIA_BO | 0.0 | datetime |
| HORA_OCORRENCIA_BO | 0.0 | str/time |
| DESC_PERIODO | 0.0 | str |
| DESCR_TIPOLOCAL | 0.0 | str |
| DESCR_SUBTIPOLOCAL | 0.0 | str |
| BAIRRO | 0.0 | str |
| LOGRADOURO | 0.0 | str |
| NUMERO_LOGRADOURO | 6.4 | int |
| LATITUDE | 0.0 | float/int/str |
| LONGITUDE | 0.0 | float/int/str |
| NOME_DELEGACIA_CIRCUNCRIÇÃO | 0.0 | str |
| NOME_DEPARTAMENTO_CIRCUNCRIÇÃO | 0.0 | str |
| NOME_SECCIONAL_CIRCUNCRIÇÃO | 0.0 | str |
| NOME_MUNICIPIO_CIRCUNCRIÇÃO | 0.0 | str |
| RUBRICA | 0.0 | str |
| DESCR_CONDUTA | 0.0 | str |
| NATUREZA_APURADA | 0.0 | str |
| MES_ESTATISTICA | 0.0 | int |
| ANO_ESTATISTICA | 0.0 | int |
| CMD | 0.0 | str |
| BTL | 0.0 | str |
| CIA | 0.0 | str |
| CD_IBGE | 0.0 | int |

## Mapeamento das colunas logicas

| Logica | Coluna real |
|---|---|
| latitude | LATITUDE |
| longitude | LONGITUDE |
| data_fato | DATA_OCORRENCIA_BO |
| hora_fato | HORA_OCORRENCIA_BO |
| rubrica | RUBRICA |
| municipio | NOME_MUNICIPIO |
| bairro | BAIRRO |
| logradouro | LOGRADOURO |
| objeto_celular | AUSENTE |

## Coordenadas

- Aba analisada: JAN-JUN_2025
- Linhas: 20000
- Validas na capital (%): 76.9
- Latitude min/max: -23.795498 / -23.3598599
- Longitude min/max: -46.812575244 / -46.3665597

## Veredito

SSP_VEREDITO: GRADE_500M
SSP_CELULAR: PROXY
