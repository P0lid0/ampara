"""Clima historico (Open-Meteo): URL, agregacao por periodo/dia/faixa e juncao com o painel."""
from urllib.parse import parse_qs, urlparse

import pandas as pd
import pytest

from ampara_ml.clima import agregar_clima, baixar_clima, juntar_clima, url_open_meteo


def test_url_open_meteo():
    u = urlparse(url_open_meteo("2025-01-01", "2025-12-31"))
    qs = parse_qs(u.query)
    assert u.netloc == "archive-api.open-meteo.com" and qs["latitude"] == ["-23.5505"]
    assert qs["longitude"] == ["-46.6333"] and qs["hourly"] == ["temperature_2m,precipitation"]
    assert qs["timezone"] == ["America/Sao_Paulo"] and qs["start_date"] == ["2025-01-01"]
    assert qs["end_date"] == ["2025-12-31"]


def test_agregar_clima():
    # SINTETICO: duas segundas (2025-01-06 e 2025-01-13), horas 0, 1, 2
    h = pd.DataFrame({
        "time": [f"2025-01-06T0{i}:00" for i in range(3)] + [f"2025-01-13T0{i}:00" for i in range(3)],
        "temperature_2m": [20] * 3 + [24] * 3,
        "precipitation": [1.0] * 3 + [0.0] * 3,
    })
    r = agregar_clima(h).iloc[0]
    assert (r.periodo, r.dia_semana, r.faixa) == ("2025T1", 0, 0)
    assert r.clima_temp_media == 22.0
    assert r.clima_chuva_mm == 1.5  # (3 mm + 0) / 2 dias


def test_juntar_clima_futuro_usa_ano_anterior():
    painel = pd.DataFrame({"periodo": ["2025T1", "2026T1"], "dia_semana": [0, 0], "faixa": [0, 0]})
    clima = pd.DataFrame({"periodo": ["2025T1"], "dia_semana": [0], "faixa": [0],
                          "clima_temp_media": [22.0], "clima_chuva_mm": [1.5]})
    assert juntar_clima(painel, clima).clima_temp_media.tolist() == [22.0, 22.0]


def test_juntar_clima_sem_ano_anterior():
    painel = pd.DataFrame({"periodo": ["2027T1"], "dia_semana": [0], "faixa": [0]})
    clima = pd.DataFrame({"periodo": ["2025T1"], "dia_semana": [0], "faixa": [0],
                          "clima_temp_media": [22.0], "clima_chuva_mm": [1.5]})
    with pytest.raises(ValueError):
        juntar_clima(painel, clima)


@pytest.mark.rede
def test_baixar_clima_curto(tmp_path):
    destino = baixar_clima("2025-01-01", "2025-01-03", tmp_path / "clima_horario.csv")
    assert len(pd.read_csv(destino)) == 72
