"""Testes de ssp.py. Todas as linhas abaixo sao SINTETICO (nenhum dado real)."""
import csv
import math

import pytest

from ampara_ml.ssp import (
    ColunaAusente,
    decidir_resolucao,
    carregar_ssp,
    mapear_colunas,
    normalizar_coluna,
    normalizar_texto,
    parse_coordenada,
    parse_hora,
)

CABECALHO = ["NUM_BO", "DATA_OCORRENCIA_BO", "HORA_OCORRENCIA_BO", "LATITUDE", "LONGITUDE", "NOME_MUNICIPIO", "OBJETO"]

LINHAS = [  # SINTETICO
    ("1", "14/03/2024", "14:35:10", "-23,5672", "-46,7019", "SAO PAULO", "CELULAR"),  # valida -> g051_026
    ("2", "2024-03-15", "7:05", "-23.5505", "-46.6333", "S.PAULO", "Telefone celular"),  # valida -> g055_040
    ("3", "14/03/2024", "10:00", "0", "0", "SAO PAULO", "CELULAR"),  # coord
    ("4", "14/03/2024", "25:00", "-23.5672", "-46.7019", "SAO PAULO", "CELULAR"),  # hora
    ("5", "14/03/2024", "10:00", "-22.9", "-46.7019", "SAO PAULO", "CELULAR"),  # fora da grade
    ("6", "14/03/2024", "10:00", "-23.5672", "-46.7019", "CAMPINAS", "CELULAR"),  # municipio
    ("7", "31/02/2024", "10:00", "-23.5672", "-46.7019", "SAO PAULO", "CELULAR"),  # data
    ("8", "14/03/2024", "10:00", "-23.5672", "-46.7019", "SAO PAULO", "VEICULO"),  # objeto
]
LINHA_ANO_ABSURDO = ("9", "04/08/0202", "10:00", "-23.5672", "-46.7019", "SAO PAULO", "CELULAR")  # data (erro de digitacao)


def _escrever(tmp_path, linhas, sep=",", enc="utf-8", cabecalho=CABECALHO, nome="s.csv"):
    caminho = tmp_path / nome
    with open(caminho, "w", newline="", encoding=enc) as f:
        w = csv.writer(f, delimiter=sep)
        w.writerow(cabecalho)
        w.writerows(linhas)
    return caminho


def test_normalizar():
    assert normalizar_coluna("Data Ocorrência BO") == "DATA_OCORRENCIA_BO"
    assert normalizar_texto("S.PAULO") == "S PAULO"
    assert normalizar_texto("  São   Paulo ") == "SAO PAULO"


def test_mapear_variantes():
    m = mapear_colunas(["NUM_BO", "DATA_OCORRENCIA_BO", "HORA_OCORRENCIA_BO", "LATITUDE", "LONGITUDE", "NOME_MUNICIPIO"])
    assert m["lat"] == "LATITUDE"
    assert m["data"] == "DATA_OCORRENCIA_BO"
    assert "objeto" not in m
    m2 = mapear_colunas(["Data Ocorrência BO", "Hora Ocorrência BO", "Latitude", "Longitude", "Nome Município"])
    assert m2["data"] == "Data Ocorrência BO" and m2["municipio"] == "Nome Município"


def test_mapear_faltando():
    with pytest.raises(ColunaAusente) as exc:
        mapear_colunas(["DATA_OCORRENCIA_BO", "HORA_OCORRENCIA_BO", "NOME_MUNICIPIO"])
    assert exc.value.faltando == ["lat", "lng"]


def test_parse_coordenada():
    assert parse_coordenada("-23,5672") == -23.5672
    assert parse_coordenada("-23.5672") == -23.5672
    for ruim in (0, "0", "", None, "abc", 999, "-999", float("nan")):
        assert math.isnan(parse_coordenada(ruim)), ruim


def test_parse_hora():
    assert parse_hora("14:35:10") == 14
    assert parse_hora("7:05") == 7
    assert parse_hora(9) == 9
    assert parse_hora(14.0) == 14
    for ruim in ("24:00", "", "NULL", "25:00", None):
        assert parse_hora(ruim) is None, ruim


def test_carregar_resumo(tmp_path):
    df, r = carregar_ssp([_escrever(tmp_path, LINHAS)])
    assert r["linhas_lidas"] == 8 and r["usadas"] == 2
    chaves = ("descartadas_coord", "descartadas_hora", "descartadas_fora_grade",
              "descartadas_municipio", "descartadas_data", "descartadas_objeto")
    assert [r[k] for k in chaves] == [1] * 6
    assert sorted(df.area_id) == ["g051_026", "g055_040"]
    assert sorted(df.hora) == [7, 14]
    assert str(df.data.dtype).startswith("datetime64")


def test_carregar_proxy_via_publica(tmp_path):
    cab = ["DATA_OCORRENCIA_BO", "HORA_OCORRENCIA_BO", "LATITUDE", "LONGITUDE", "NOME_MUNICIPIO", "RUBRICA", "DESCR_TIPOLOCAL"]
    linhas = [  # SINTETICO
        ("14/03/2024", "10:00", "-23.5672", "-46.7019", "SAO PAULO", "Roubo - Outros", "Via Pública"),
        ("14/03/2024", "10:00", "-23.5672", "-46.7019", "SAO PAULO", "Furto - Veículo", "Residência"),
        ("14/03/2024", "10:00", "-23.5672", "-46.7019", "SAO PAULO", "Lesão corporal", "Via Pública"),
    ]
    df, r = carregar_ssp([_escrever(tmp_path, linhas, cabecalho=cab)], proxy=True)
    assert r["descartadas_objeto"] == 2 and r["usadas"] == 1 and len(df) == 1


def test_carregar_csv_latin1_ponto_e_virgula(tmp_path):
    linhas = [("1", "14/03/2024", "14:35:10", "-23,5672", "-46,7019", "SÃO PAULO", "CELULAR")] + LINHAS[1:]
    df, r = carregar_ssp([_escrever(tmp_path, linhas, sep=";", enc="latin-1")])
    assert r["usadas"] == 2


def test_carregar_varios_arquivos_soma(tmp_path):
    a = _escrever(tmp_path, LINHAS, nome="a.csv")
    b = _escrever(tmp_path, LINHAS, nome="b.csv")
    df, r = carregar_ssp([a, b])
    assert r["linhas_lidas"] == 16 and r["usadas"] == 4 and len(df) == 4


def test_carregar_coluna_ausente(tmp_path):
    with pytest.raises(ColunaAusente):
        carregar_ssp([_escrever(tmp_path, [("1", "x")], cabecalho=["NUM_BO", "X"])])


def test_decidir_resolucao():
    assert decidir_resolucao({"linhas_lidas": 100000, "descartadas_municipio": 20000, "usadas": 60000}) == "grade"
    assert decidir_resolucao({"linhas_lidas": 100000, "descartadas_municipio": 20000, "usadas": 30000}) == "distrito"
    assert decidir_resolucao({"linhas_lidas": 15000, "usadas": 15000}) == "distrito"


def test_decidir_resolucao_hora_nula_nao_derruba_a_grade():
    # Caso real (SSP 2022-2025): 32 % da base com hora NULL; entre as datadas ~93 % tem coordenada.
    real = {"linhas_lidas": 4792984, "descartadas_municipio": 2859804, "descartadas_objeto": 621392,
            "descartadas_data": 356, "descartadas_hora": 420058, "descartadas_coord": 59866,
            "descartadas_grade": 2890, "usadas": 828618}
    assert decidir_resolucao(real) == "grade"


def test_decidir_resolucao_coordenada_insuficiente_entre_datadas_da_distrito():
    r = {"linhas_lidas": 200000, "descartadas_municipio": 40000, "descartadas_data": 100,
         "descartadas_hora": 50000, "descartadas_coord": 60000, "usadas": 49900}
    assert decidir_resolucao(r) == "distrito"


def test_data_com_ano_absurdo_conta_como_data(tmp_path):
    df, r = carregar_ssp([_escrever(tmp_path, [LINHAS[0], LINHA_ANO_ABSURDO])])
    assert r["linhas_lidas"] == 2 and r["usadas"] == 1 and r["descartadas_data"] == 1
