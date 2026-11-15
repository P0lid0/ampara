"""Cortes de classe (baixo/medio/alto) calculados so no treino e rotulagem das contagens."""
from __future__ import annotations

import numpy as np


def calcular_cortes(contagens_treino: np.ndarray, quantis: tuple[float, float] = (0.50, 0.85)) -> tuple[int, int]:
    """Quantis (method="higher") so das contagens > 0 do treino; garante c2 > c1."""
    c = np.asarray(contagens_treino)
    positivos = c[c > 0]
    if positivos.size == 0:
        raise ValueError("sem ocorrências no treino")
    c1, c2 = (int(v) for v in np.quantile(positivos, quantis, method="higher"))
    return c1, max(c2, c1 + 1)


def rotular(contagens: np.ndarray, cortes: tuple[int, int]) -> np.ndarray:
    """<= c1 -> 0 (baixo); c1 < x <= c2 -> 1 (medio); > c2 -> 2 (alto). Retorna int8."""
    c1, c2 = cortes
    x = np.asarray(contagens)
    return np.where(x <= c1, 0, np.where(x <= c2, 1, 2)).astype(np.int8)
