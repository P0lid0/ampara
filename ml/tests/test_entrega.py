"""Checagem final da entrega: arquivos, versoes fixadas, README dos dados, contrato do risco.csv."""
import csv
import re
import subprocess
from pathlib import Path

import pytest

from ampara_ml.config import CLASSES
from ampara_ml.exportar import CABECALHO_RISCO

RAIZ = Path(__file__).resolve().parents[1]
REPO = RAIZ.parent
MB = 1024 * 1024


def _git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, encoding="utf-8")


def test_arquivos_obrigatorios():
    for p in ("README.md", "RELATORIO_ML.md", "ROTEIRO_VIDEO.md", "requirements.txt", "dados/README.md",
              "notebooks/ampara_ml.ipynb", "saida/risco.csv", "saida/metricas.json"):
        assert (RAIZ / p).exists(), p


def test_requirements_fixados():
    linhas = [l.strip() for l in (RAIZ / "requirements.txt").read_text(encoding="utf-8").splitlines() if l.strip()]
    assert linhas
    for l in linhas:
        assert "==" in l and ">=" not in l, l
    nomes = {l.split("==")[0].lower() for l in linhas}
    for obrigatorio in ("xgboost", "scikit-learn", "pandas", "numpy", "geopandas", "nbformat"):
        assert obrigatorio in nomes, obrigatorio


def test_dados_readme_tem_fonte_link_periodo():
    t = (RAIZ / "dados/README.md").read_text(encoding="utf-8")
    for fonte in ("SSP", "GeoSampa", "Open-Meteo", "IBGE"):
        bloco = t.split(f"## {fonte}", 1)[1].split("\n## ", 1)[0]
        assert "http" in bloco, fonte
        assert re.search(r"20\d\d", bloco), fonte
        assert "Acesso" in bloco, fonte
        assert "Período" in bloco, fonte


def test_readme_ml():
    t = (RAIZ / "README.md").read_text(encoding="utf-8")
    for termo in ("Integrantes", "pytest", "nbconvert", "risco.csv"):
        assert termo in t, termo
    nomes = (REPO / "integrantes.txt").read_text(encoding="utf-8")
    for nome in ("Pedro Martins", "Vitor Cesarino Marchese"):
        assert nome in nomes, nome
        assert nome in t, nome


def test_risco_csv_versionado():
    assert _git("ls-files", "ml/saida/risco.csv").stdout.strip() == "ml/saida/risco.csv"
    assert _git("check-ignore", "-q", "ml/saida/risco.csv").returncode == 1


def test_tamanhos():
    assert (RAIZ / "saida/risco.csv").stat().st_size <= 15 * MB
    assert (RAIZ / "notebooks/ampara_ml.ipynb").stat().st_size <= 10 * MB
    for rel in _git("ls-files", "ml").stdout.splitlines():
        arq = REPO / rel
        if arq.exists():
            assert arq.stat().st_size <= 15 * MB, rel


def test_risco_csv_contrato():
    with open(RAIZ / "saida/risco.csv", encoding="utf-8", newline="") as f:
        leitor = csv.reader(f)
        assert ",".join(next(leitor)) == CABECALHO_RISCO == "area_id,lat,lng,dia_semana,faixa,classe,prob_alto"
        primeira = next(leitor)
        assert re.fullmatch(r"g\d{3}_\d{3}", primeira[0]), primeira
        assert re.fullmatch(r"-?\d+\.\d+", primeira[1]) and re.fullmatch(r"-?\d+\.\d+", primeira[2])
        assert re.fullmatch(r"[0-6]", primeira[3]) and re.fullmatch(r"[0-7]", primeira[4])
        assert primeira[5] in CLASSES
        assert re.fullmatch(r"(0|1|0\.\d{1,4})", primeira[6]), primeira
        classes = {primeira[5]}
        for linha in leitor:
            assert len(linha) == 7
            classes.add(linha[5])
        assert classes <= set(CLASSES)
