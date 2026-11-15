"""Constantes do pipeline de ML (contratos do projeto: grade de ~500 m sobre a capital)."""
from pathlib import Path

SEED = 42

# Limites da grade (graus). Intervalo fechado embaixo, aberto em cima.
LAT_MIN = -23.80
LAT_MAX = -23.35
LNG_MIN = -46.83
LNG_MAX = -46.36
PASSO_LAT = 0.0045
PASSO_LNG = 0.0049

CLASSES = ("baixo", "medio", "alto")

RAIZ_ML = Path(__file__).resolve().parent.parent
DIR_BRUTOS = RAIZ_ML / "dados" / "brutos"
DIR_SAIDA = RAIZ_ML / "saida"

# Celulas com menos ocorrencias que isto no treino nao entram no risco.csv (120 mantem o painel abaixo de 2 milhoes de linhas).
MIN_OCORR_CELULA = 120
