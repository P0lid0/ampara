"""Confere que o relatorio de 2 paginas e o roteiro do video batem com os resultados do notebook."""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
RELATORIO = RAIZ / "RELATORIO_ML.md"
ROTEIRO = RAIZ / "ROTEIRO_VIDEO.md"
METRICAS = RAIZ / "saida" / "metricas.json"

SECOES = ["1. Problema e dados", "2. Modelo escolhido", "3. Preparação e divisão",
          "4. Treino e hiperparâmetros", "5. Resultados", "6. Conclusão e leitura para o cidadão"]


def test_relatorio():
    t = RELATORIO.read_text(encoding="utf-8")
    m = json.loads(METRICAS.read_text(encoding="utf-8"))
    assert all(s in t for s in SECOES) and 3 <= t.count("![") <= 4 and 700 <= len(re.findall(r"\w+", t)) <= 1200
    for modelo in ("xgb", "rf"):  # numeros do relatorio = numeros do notebook
        for k in ("f1_macro_treino", "f1_macro_teste"):
            assert f"{m[modelo][k]:.3f}" in t
    assert all(Path(RELATORIO.parent, p).exists() for p in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", t))


def test_roteiro_ate_5_minutos():
    linhas = re.findall(r"\|\s*(\d+):(\d{2})\s*[–-]\s*(\d+):(\d{2})\s*\|", ROTEIRO.read_text(encoding="utf-8"))
    ini = [int(a) * 60 + int(b) for a, b, _, _ in linhas]
    fim = [int(c) * 60 + int(d) for _, _, c, d in linhas]
    assert len(linhas) >= 6 and ini[0] == 0 and fim[-1] <= 300 and all(i == f for i, f in zip(ini[1:], fim[:-1]))
