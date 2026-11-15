"""Integracao com os dados reais (ml/dados/brutos). Rodar com: python -m pytest tests/test_pipeline_dados.py -m dados -v"""
import numpy as np
import pytest

from ampara_ml.divisao import proximo_periodo
from ampara_ml.pipeline import preparar_dados


@pytest.mark.dados
def test_preparar_dados_real():
    ds, info = preparar_dados()
    assert len(ds.X_treino) > 0 and len(ds.X_teste) > 0 and ds.p_treino.max() < ds.inicio_teste <= ds.p_teste.min()
    assert set(np.unique(ds.y_treino)) <= {0, 1, 2} and ds.cortes[0] < ds.cortes[1]
    assert info["n_areas"] >= 100 and len(ds.X_treino) + len(ds.X_teste) <= 2_000_000
    assert set(np.unique(ds.y_treino)) == {0, 1, 2}  # as tres classes existem no treino
    assert info["periodo_previsto"] == proximo_periodo(info["periodos"][-1])  # risco.csv = trimestre seguinte ao ultimo completo
    assert ds.chave_futuro.groupby("area_id").size().eq(56).all()  # cada area ativa x 56 combinacoes
