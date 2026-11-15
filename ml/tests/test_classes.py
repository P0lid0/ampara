import numpy as np
import pytest

from ampara_ml.classes import calcular_cortes, rotular

CONT = np.array([0] * 90 + list(range(1, 11)))  # SINTETICO


def test_cortes():
    assert calcular_cortes(CONT) == (6, 9)


def test_zeros_nao_mexem_nos_cortes():
    assert calcular_cortes(np.concatenate([CONT, np.zeros(1000)])) == (6, 9)


def test_c2_maior_que_c1():
    assert calcular_cortes(np.array([0, 0, 1, 1, 1])) == (1, 2)


def test_sem_positivos():
    with pytest.raises(ValueError, match="sem ocorrências"):
        calcular_cortes(np.zeros(10))


def test_rotular():
    r = rotular(np.array([0, 6, 7, 9, 10]), (6, 9))
    assert r.tolist() == [0, 0, 1, 1, 2]
    assert r.dtype == np.int8
