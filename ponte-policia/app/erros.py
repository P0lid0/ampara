"""Erros da API e seus handlers. Nenhuma resposta ecoa o valor enviado pelo cliente."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.dominio import ErroTransicaoInvalida, OcorrenciaNaoEncontrada
from app.pii import AchadoPii, _chave_segura

logger = logging.getLogger(__name__)

_CHAVE_OCULTA = "<chave>"

# Tipos de erro do pydantic cuja mensagem pode citar um trecho do valor recebido.
_MSG_GENERICA = "Valor inválido."
_TIPOS_QUE_ECOAM = ("uuid_parsing", "datetime_parsing", "datetime_from_date_parsing",
                    "date_parsing", "date_from_datetime_parsing", "time_parsing", "url_parsing")


class ErroPii(Exception):
    def __init__(self, achados: list[AchadoPii]):
        super().__init__("Payload contém dado pessoal.")
        self.achados = achados


def _loc_sem_eco(erro: dict) -> list:
    """O `loc` de um campo extra traz a chave escolhida pelo remetente: troca por <chave>.
    Os demais segmentos são nomes do schema ou índices; os que não parecem identificador
    curto também viram <chave>."""
    loc = list(erro["loc"])
    if erro["type"] == "extra_forbidden" and loc and isinstance(loc[-1], str):
        loc[-1] = _CHAVE_OCULTA
    return [s if not isinstance(s, str) or s == _CHAVE_OCULTA or _chave_segura(s) else _CHAVE_OCULTA
            for s in loc]


def registrar_handlers(app: FastAPI) -> None:
    @app.exception_handler(ErroPii)
    async def _pii(request: Request, exc: ErroPii) -> JSONResponse:
        logger.warning("payload rejeitado por PII: achados=%s",
                       [(a.campo, a.classe) for a in exc.achados])
        return JSONResponse(status_code=422, content={
            "detail": "Payload contém dado pessoal e foi rejeitado.",
            "achados": [{"campo": a.campo, "classe": a.classe} for a in exc.achados],
        })

    @app.exception_handler(RequestValidationError)
    async def _validacao(request: Request, exc: RequestValidationError) -> JSONResponse:
        detalhes = [{"loc": _loc_sem_eco(e),
                     "msg": _MSG_GENERICA if e["type"] in _TIPOS_QUE_ECOAM else e["msg"]}
                    for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": detalhes})

    @app.exception_handler(OcorrenciaNaoEncontrada)
    async def _nao_encontrada(request: Request, exc: OcorrenciaNaoEncontrada) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": "Protocolo não encontrado."})

    @app.exception_handler(ErroTransicaoInvalida)
    async def _transicao(request: Request, exc: ErroTransicaoInvalida) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": "Transição de status não permitida."})
