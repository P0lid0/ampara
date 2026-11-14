"""Grade de ~500 m do contrato (mesma função do C#, AreaMapa.cs). Limites superiores exclusivos."""
import math
import re

LAT_MIN, LAT_MAX = -23.80, -23.35
LNG_MIN, LNG_MAX = -46.83, -46.36
PASSO_LAT, PASSO_LNG = 0.0045, 0.0049
FORA = "fora"
LINHA_MAX, COLUNA_MAX = 99, 95

_PADRAO = re.compile(r"g(\d{3})_(\d{3})", re.ASCII)


def area_id(lat: float, lng: float) -> str:
    if (math.isnan(lat) or math.isnan(lng)
            or not (LAT_MIN <= lat < LAT_MAX) or not (LNG_MIN <= lng < LNG_MAX)):
        return FORA
    # min(): o arredondamento de ponto flutuante nao pode empurrar a borda superior para fora da grade
    linha = min(math.floor((lat - LAT_MIN) / PASSO_LAT), LINHA_MAX)
    coluna = min(math.floor((lng - LNG_MIN) / PASSO_LNG), COLUNA_MAX)
    return f"g{linha:03d}_{coluna:03d}"


def _celula(a: str) -> tuple[int, int] | None:
    m = _PADRAO.fullmatch(a) if isinstance(a, str) else None
    if not m:
        return None
    linha, coluna = int(m.group(1)), int(m.group(2))
    if linha > LINHA_MAX or coluna > COLUNA_MAX:
        return None
    return linha, coluna


def centro(a: str) -> tuple[float, float] | None:
    c = _celula(a)
    if c is None:
        return None
    linha, coluna = c
    return LAT_MIN + (linha + 0.5) * PASSO_LAT, LNG_MIN + (coluna + 0.5) * PASSO_LNG


def area_valida(a: str) -> bool:
    return a == FORA or _celula(a) is not None
