"""Testes de graficos.py (SINTETICO: dados inventados so para exercitar o desenho)."""
import pandas as pd

from ampara_ml.graficos import (grafico_busca, grafico_curva_aprendizado, grafico_importancia,
                                grafico_matriz_confusao, grafico_treino_teste)


def _ok(p):
    assert p.exists() and p.stat().st_size > 1000


def test_matriz_confusao(tmp_path):
    _ok(grafico_matriz_confusao([[50, 10, 2], [8, 40, 9], [1, 7, 30]], tmp_path / "m.png", "Teste"))


def test_treino_teste(tmp_path):
    m = {"XGBoost": {"treino": 0.8, "cv": 0.6, "teste": 0.55}, "Random Forest": {"treino": 0.9, "cv": 0.58, "teste": 0.5}}
    _ok(grafico_treino_teste(m, tmp_path / "t.png"))


def test_curva(tmp_path):
    c = pd.DataFrame({"fracao": [.2, .4, .6, .8, 1.0], "n_treino": [20, 40, 60, 80, 100],
                      "f1_treino": [.9, .85, .8, .78, .77], "f1_teste": [.4, .45, .5, .52, .53]})
    _ok(grafico_curva_aprendizado(c, tmp_path / "c.png"))


def test_importancia(tmp_path):
    _ok(grafico_importancia(pd.Series({"cont_ant_1": .4, "lat": .2, "faixa": .1, "clima_chuva_mm": .05}), tmp_path / "i.png"))


def test_busca(tmp_path):
    t = pd.DataFrame({"max_depth": [3, 5, 7], "learning_rate": [.1, .1, .3], "f1_macro_cv": [.5, .6, .55]})
    _ok(grafico_busca(t, tmp_path / "b.png"))
