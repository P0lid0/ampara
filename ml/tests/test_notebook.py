"""Confere o notebook entregue (executado, com saidas) e o metricas.json que ele grava."""
import json

import nbformat

from ampara_ml.config import DIR_SAIDA, RAIZ_ML

NOTEBOOK = RAIZ_ML / "notebooks" / "ampara_ml.ipynb"
METRICAS = DIR_SAIDA / "metricas.json"


def test_notebook_executado_com_saidas():
    nb = nbformat.read(NOTEBOOK, as_version=4)
    codigo = [c for c in nb.cells if c.cell_type == "code" and c.source.strip()]
    assert codigo and all(c.execution_count is not None for c in codigo)
    assert not any(o.output_type == "error" for c in codigo for o in c.outputs)
    titulos = " ".join(c.source for c in nb.cells if c.cell_type == "markdown")
    assert all(s in titulos for s in ("## 01", "## 02", "## 03", "## 04"))


def test_metricas_json():
    m = json.loads(METRICAS.read_text(encoding="utf-8"))
    assert {"xgb", "rf", "cortes", "inicio_teste", "n_treino", "n_teste"} <= set(m) and m["n_combinacoes_xgb"] >= 10
    assert 0 <= m["xgb"]["f1_macro_teste"] <= 1 and 0 <= m["rf"]["f1_macro_teste"] <= 1
