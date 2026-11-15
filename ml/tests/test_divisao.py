import numpy as np
import pandas as pd
import pytest

from ampara_ml.divisao import cv_temporal, dividir_temporal, inicio_teste_padrao, periodo_de, proximo_periodo


def test_periodo_de():
    datas = pd.Series(pd.to_datetime(["2024-03-31", "2024-04-01", "2025-12-31"]))
    assert periodo_de(datas).tolist() == ["2024T1", "2024T2", "2025T4"]


def test_proximo():
    assert proximo_periodo("2024T4") == "2025T1"
    assert proximo_periodo("2024T2") == "2024T3"


def test_inicio_teste_padrao():
    p = ["2024T3", "2024T4", "2025T1", "2025T2", "2025T3", "2025T4"]
    assert inicio_teste_padrao(p) == "2025T1"
    assert inicio_teste_padrao(p[:4]) == "2024T3"  # só 2 períodos de 2025 -> plano B: 4 últimos


def test_dividir_temporal():
    per = [f"2024T{i}" for i in (1, 2, 3, 4)] + ["2025T1", "2025T2"]
    painel = pd.DataFrame({"periodo": np.repeat(per, 3), "x": range(18)})  # SINTETICO
    treino, teste = dividir_temporal(painel, "2025T1")
    assert treino.periodo.max() < teste.periodo.min()
    assert len(treino) + len(teste) == len(painel)
    with pytest.raises(ValueError):
        dividir_temporal(painel, "2025T3")
    with pytest.raises(ValueError):
        dividir_temporal(painel, "2024T1")


def test_cv_temporal():
    per = pd.Series(np.repeat([f"2024T{i}" for i in (1, 2, 3, 4)] + [f"2025T{i}" for i in (1, 2, 3, 4)], 5))
    splits = cv_temporal(per, 3)
    assert len(splits) == 3
    for tr, va in splits:
        assert set(per.iloc[tr]).isdisjoint(set(per.iloc[va])) and max(per.iloc[tr]) < min(per.iloc[va])
    assert sorted(set(per.iloc[splits[0][0]])) == ["2024T1", "2024T2"]
    assert sorted(set(per.iloc[splits[0][1]])) == ["2024T3", "2024T4"]


def test_cv_temporal_linhas_embaralhadas():
    per = pd.Series(["2024T2", "2024T1", "2024T4", "2024T3", "2024T1", "2024T4"])
    for tr, va in cv_temporal(per, 2):
        assert max(per.iloc[tr]) < min(per.iloc[va])
