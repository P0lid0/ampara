import logging

from fastapi import APIRouter, Depends, Response

from app.deps import get_ocorrencia_service
from app.schemas import OcorrenciaCriar, ProtocoloResposta
from app.security import exigir_chave_servico, rejeitar_pii
from app.services.ocorrencia_service import OcorrenciaService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ocorrencias"])


@router.post(
    "/ocorrencias",
    status_code=201,
    response_model=ProtocoloResposta,
    summary="Registra uma ocorrência (idempotente por origem_id)",
    description=("Recebe a ocorrência enviada pela API da Ampara. Reenviar o mesmo origem_id devolve "
                 "200 com o protocolo já existente. Payload com dado pessoal é rejeitado com 422."),
    dependencies=[Depends(exigir_chave_servico), Depends(rejeitar_pii)],
    responses={
        200: {"description": "origem_id já registrado: devolve o protocolo existente."},
        401: {"description": "Chave de serviço inválida ou ausente."},
        422: {"description": "Payload inválido ou com dado pessoal."},
    },
)
def criar_ocorrencia(
    dados: OcorrenciaCriar,
    response: Response,
    servico: OcorrenciaService = Depends(get_ocorrencia_service),
) -> ProtocoloResposta:
    oc, criada = servico.registrar(dados)
    if not criada:
        response.status_code = 200
    logger.info("ocorrencia protocolo=%s criada=%s", oc.protocolo, criada)
    return ProtocoloResposta(protocolo=oc.protocolo, status=oc.status)
