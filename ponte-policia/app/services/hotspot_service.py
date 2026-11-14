"""Hotspots: ocorrências agrupadas por área numa janela de tempo (leitura calculada, sem tabela)."""
from collections.abc import Callable
from datetime import datetime, timedelta

from app.area import FORA, centro
from app.dominio import Hotspot
from app.repositories.ocorrencia_repository import OcorrenciaRepository

LIMIAR_MEDIO = 2
LIMIAR_ALTO = 5


def risco_por_total(total: int) -> str:
    if total >= LIMIAR_ALTO:
        return "alto"
    if total >= LIMIAR_MEDIO:
        return "medio"
    return "baixo"


class HotspotService:
    def __init__(self, repo: OcorrenciaRepository, agora: Callable[[], datetime]):
        self._repo = repo
        self._agora = agora

    def listar(self, janela_min: int) -> list[Hotspot]:
        # Sem limite superior: tolera relógio adiantado da API.
        desde = self._agora() - timedelta(minutes=janela_min)
        hotspots = []
        for area, total in self._repo.contar_por_area(desde):
            if area == FORA:
                continue
            lat, lng = centro(area)
            hotspots.append(Hotspot(area, lat, lng, total, risco_por_total(total)))
        hotspots.sort(key=lambda h: (-h.total, h.area_id))
        return hotspots
