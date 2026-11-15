"""Fixtures compartilhadas (SINTETICO: dados inventados so para testes)."""
import pandas as pd
import pytest


@pytest.fixture
def oc_sintetico() -> pd.DataFrame:
    """Area g001_001; segundas as 7h (faixa 2) com 1,2,3,4,10 ocorrencias em 2024T1..2025T1,
    mais 6 ocorrencias numa terca as 1h (dia 1, faixa 0) em 2024T1. SINTETICO."""
    linhas = []
    for data, n in [("2024-01-08", 1), ("2024-04-08", 2), ("2024-07-08", 3),
                    ("2024-10-07", 4), ("2025-01-06", 10)]:
        linhas += [(data, 7, "g001_001")] * n
    linhas += [("2024-01-09", 1, "g001_001")] * 6
    df = pd.DataFrame(linhas, columns=["data", "hora", "area_id"])
    df["data"] = pd.to_datetime(df["data"])
    return df
