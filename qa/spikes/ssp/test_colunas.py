import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from colunas import (achar_cabecalho, classificar_colunas, escrever_markdown,  # noqa: E402
                     perfil_planilha, validar_coordenadas, veredito)


def criar_xlsx(caminho, cabecalho, linha):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Aba1"
    ws.append(cabecalho)
    ws.append(linha)
    wb.save(caminho)
    return caminho


def test_achar_cabecalho_pula_linhas_de_titulo():
    linhas = [("Relatorio SSP",) + (None,) * 11, (None,) * 12, tuple(f"COL{i}" for i in range(12)), (1,) * 12]
    assert achar_cabecalho(linhas) == 2


def test_validar_coordenadas_aceita_virgula_decimal():
    r = validar_coordenadas(["-23,5672490"], ["-46,7019515"])  # SINTETICO (estacao Pinheiros)
    assert r["validos_pct"] == 100.0 and r["n"] == 1


def test_validar_coordenadas_descarta_zero_e_fora_da_capital():
    r = validar_coordenadas([0, -22.9, None, "x"], [0, -43.2, None, "y"])
    assert r["validos_pct"] == 0.0


def test_classificar_colunas_ignora_caixa_e_acento():
    m = classificar_colunas(["LATITUDE", "LONGITUDE", "DATA_OCORRENCIA_BO", "HORA_OCORRENCIA_BO", "RUBRICA",
                             "NOME_MUNICIPIO", "BAIRRO", "LOGRADOURO", "Descrição do Objeto Celular"])
    assert m["latitude"] == "LATITUDE" and m["rubrica"] == "RUBRICA" and m["objeto_celular"] == "Descrição do Objeto Celular"
    assert classificar_colunas(["A", "B"])["latitude"] is None


def test_veredito_depende_das_coordenadas_validas():
    ok = {"latitude": "LAT", "longitude": "LNG", "municipio": "M", "bairro": "B"}
    assert veredito(ok, {"validos_pct": 80.0}) == "GRADE_500M"
    assert veredito(ok, {"validos_pct": 49.9}) == "DISTRITO"
    assert veredito({**ok, "latitude": None}, {"validos_pct": 99.0}) == "DISTRITO"


def test_markdown_nao_copia_valores_de_celula(tmp_path):
    seg = "FULANO DE TAL 123.456.789-00"  # SINTETICO: PII ficticia plantada numa celula
    xlsx = criar_xlsx(tmp_path / "t.xlsx", cabecalho=[f"C{i}" for i in range(10)], linha=[seg] + [1] * 9)
    p = perfil_planilha(xlsx)
    destino = tmp_path / "saida.md"
    escrever_markdown(p, classificar_colunas(["C0"]), {"validos_pct": 0.0}, "DISTRITO", destino)
    assert seg not in destino.read_text(encoding="utf-8") and "123.456.789" not in destino.read_text(encoding="utf-8")


def test_data_do_fato_vence_data_de_registro():
    m = classificar_colunas(["DATA_REGISTRO", "DATA_OCORRENCIA_BO"])
    assert m["data_fato"] == "DATA_OCORRENCIA_BO"
