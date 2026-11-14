from fastapi import APIRouter, Depends, Query

from app.deps import get_hotspot_service
from app.schemas import HotspotResposta
from app.security import exigir_chave_policia
from app.services.hotspot_service import HotspotService

router = APIRouter(tags=["hotspots"])


@router.get(
    "/hotspots",
    response_model=list[HotspotResposta],
    summary="Hotspots por janela de tempo",
    description=("Ocorrências não descartadas agrupadas por área (grade de ~500 m) nos últimos "
                 "janela_min minutos, da área mais ativa para a menos ativa. Áreas fora da grade não entram."),
    dependencies=[Depends(exigir_chave_policia)],
    responses={401: {"description": "Chave da polícia inválida ou ausente."},
               422: {"description": "janela_min fora de 1 a 10080."}},
)
def listar_hotspots(
    janela_min: int = Query(60, ge=1, le=10080, description="Janela em minutos (1 a 10080)."),
    servico: HotspotService = Depends(get_hotspot_service),
) -> list[HotspotResposta]:
    return [HotspotResposta(area_id=h.area_id, lat=h.lat, lng=h.lng, total=h.total,
                            risco_previsto=h.risco_previsto)
            for h in servico.listar(janela_min)]
