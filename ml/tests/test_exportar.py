"""Testes de exportar.py (SINTETICO: modelo e dados inventados)."""
import re

import numpy as np
import pandas as pd
import pytest

from ampara_ml.area import centro
from ampara_ml.exportar import CABECALHO_RISCO, gerar_risco, salvar_risco


class _FakeModelo:
    def __init__(self, classes=(0, 1, 2)):
        self.classes_ = np.array(classes)

    def predict_proba(self, X):
        if len(self.classes_) == 3:
            return np.array([[.7, .2, .1], [.1, .2, .7]])[: len(X)]
        return np.array([[.7, .3], [.4, .6]])[: len(X)]


X2 = pd.DataFrame({"f": [1.0, 2.0]})
CHAVE2 = pd.DataFrame({"area_id": ["g051_026", "g053_044"], "lat": [0.0, 0.0], "lng": [0.0, 0.0],
                       "dia_semana": [0, 1], "faixa": [2, 3]})


def _area(area_id: str, prob_base: float = 0.1) -> pd.DataFrame:
    lat, lng = centro(area_id)
    linhas = []
    for dia in range(7):
        for faixa in range(8):
            p = min(1.0, prob_base + 0.01 * faixa)
            classe = "alto" if p > 0.5 else "baixo"
            linhas.append((area_id, lat, lng, dia, faixa, classe, p))
    return pd.DataFrame(linhas, columns=CABECALHO_RISCO.split(","))


@pytest.fixture
def df_ok() -> pd.DataFrame:
    return _area("g051_026")


def test_gerar_risco():
    r = gerar_risco(_FakeModelo(), X2, CHAVE2)
    assert r.classe.tolist() == ["baixo", "alto"] and r.prob_alto.tolist() == [0.1, 0.7]
    assert r.columns.tolist() == CABECALHO_RISCO.split(",")


def test_gerar_risco_sem_classe_alto():
    with pytest.raises(ValueError):
        gerar_risco(_FakeModelo(classes=(0, 1)), X2, CHAVE2)


def test_salvar_risco_formato(tmp_path, df_ok):
    p = salvar_risco(df_ok, tmp_path / "risco.csv")
    b = p.read_bytes()
    assert b.decode("utf-8").splitlines()[0] == CABECALHO_RISCO
    assert b"\r\n" not in b and not b.startswith(b"\xef\xbb\xbf")
    linhas = b.decode().splitlines()[1:]
    assert len(linhas) == 56
    assert all(re.fullmatch(r"\d\.\d{4}", l.split(",")[-1]) for l in linhas)
    assert all(re.fullmatch(r"-\d+\.\d{5}", l.split(",")[1]) and re.fullmatch(r"-\d+\.\d{5}", l.split(",")[2])
               for l in linhas)


def test_salvar_risco_exige_56_combinacoes_por_area(tmp_path, df_ok):
    with pytest.raises(ValueError):
        salvar_risco(df_ok.iloc[:-1], tmp_path / "a.csv")
    duas = pd.concat([df_ok, _area("g053_044")], ignore_index=True)
    p = salvar_risco(duas, tmp_path / "b.csv")
    assert len(p.read_text(encoding="utf-8").splitlines()) == 113


def _muda(col, valor):
    def f(df):
        df = df.copy()
        df[col] = df[col].astype(object)
        df.loc[df.index[5], col] = valor
        return df
    return f


def _duplica(df):
    df = df.copy()
    df.loc[df.index[5], ["dia_semana", "faixa"]] = df.loc[df.index[6], ["dia_semana", "faixa"]].to_numpy()
    return df


@pytest.mark.parametrize("ruim", [
    _muda("area_id", "x"), _muda("dia_semana", 7), _muda("faixa", 8), _muda("classe", "critico"),
    _muda("prob_alto", 1.2), _muda("prob_alto", np.nan), _duplica, _muda("lat", -23.0),
], ids=["area", "dia", "faixa", "classe", "prob", "nan", "duplicada", "lat"])
def test_salvar_risco_rejeita(tmp_path, df_ok, ruim):
    with pytest.raises(ValueError):
        salvar_risco(ruim(df_ok), tmp_path / "r.csv")


def test_salvar_risco_rejeita_colunas_fora_de_ordem(tmp_path, df_ok):
    with pytest.raises(ValueError):
        salvar_risco(df_ok[list(reversed(df_ok.columns))], tmp_path / "r.csv")
