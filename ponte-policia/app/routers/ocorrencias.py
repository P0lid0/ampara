import logging

from fastapi import APIRouter, Depends, Response

from app.dominio import StatusOcorrencia
from app.deps import get_ocorrencia_service
from app.schemas import (ERRO_422_CORPO, ErroSimples, ErroValidacao, OcorrenciaCriar, OcorrenciaResumo,
                         ProtocoloResposta, RetornoResposta, StatusAtualizar)
from app.security import exigir_chave_policia, exigir_chave_servico, rejeitar_pii
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
        200: {"model": ProtocoloResposta, "description": "origem_id já registrado: devolve o protocolo existente."},
        401: {"model": ErroSimples, "description": "Chave de serviço inválida ou ausente."},
        422: {**ERRO_422_CORPO, "description": "Payload inválido (ErroValidacao), com dado pessoal (ErroPii) "
                                               "ou corpo que não é JSON (ErroSimples)."},
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


@router.get(
    "/ocorrencias",
    response_model=list[OcorrenciaResumo],
    summary="Lista ocorrências para o painel da polícia",
    description="Mais recentes primeiro; filtro opcional por status. Não expõe device_hash nem trilha.",
    dependencies=[Depends(exigir_chave_policia)],
    responses={401: {"model": ErroSimples, "description": "Chave da polícia inválida ou ausente."},
               422: {"model": ErroValidacao, "description": "Status desconhecido."}},
)
def listar_ocorrencias(
    status: StatusOcorrencia | None = None,
    servico: OcorrenciaService = Depends(get_ocorrencia_service),
) -> list[OcorrenciaResumo]:
    return servico.listar(status)


@router.get(
    "/ocorrencias/{protocolo}/retorno",
    response_model=RetornoResposta,
    summary="Retorno atual ao cidadão",
    description=("Devolve o status e a mensagem mais recentes da ocorrência, para a API da Ampara "
                 "repassar ao cidadão pelo protocolo."),
    dependencies=[Depends(exigir_chave_servico)],
    responses={401: {"model": ErroSimples, "description": "Chave de serviço inválida ou ausente."},
               404: {"model": ErroSimples, "description": "Protocolo não encontrado."},
               422: {"model": ErroValidacao, "description": "Parâmetro inválido."}},
)
def obter_retorno(protocolo: str, servico: OcorrenciaService = Depends(get_ocorrencia_service)
                  ) -> RetornoResposta:
    return servico.obter_retorno(protocolo)


@router.patch(
    "/ocorrencias/{protocolo}/status",
    response_model=RetornoResposta,
    summary="Muda o status e registra a mensagem de retorno",
    description=("Usado pela polícia: aceita em_analise, atendida ou descartada, respeitando as transições "
                 "permitidas. A mensagem não pode conter dado pessoal."),
    dependencies=[Depends(exigir_chave_policia), Depends(rejeitar_pii)],
    responses={401: {"model": ErroSimples, "description": "Chave da polícia inválida ou ausente."},
               404: {"model": ErroSimples, "description": "Protocolo não encontrado."},
               409: {"model": ErroSimples, "description": "Transição de status não permitida."},
               422: {**ERRO_422_CORPO, "description": "Payload inválido (ErroValidacao), com dado pessoal "
                                                      "(ErroPii) ou corpo que não é JSON (ErroSimples)."}},
)
def atualizar_status(protocolo: str, dados: StatusAtualizar,
                     servico: OcorrenciaService = Depends(get_ocorrencia_service)) -> RetornoResposta:
    retorno = servico.atualizar_status(protocolo, dados.status, dados.mensagem)
    logger.info("ocorrencia protocolo=%s status=%s", protocolo, retorno.status.value)
    return retorno
