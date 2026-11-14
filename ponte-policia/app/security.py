"""Autenticação por chave de cabeçalho e barreira de PII."""
import hmac

from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader

from app.config import get_settings
from app.erros import ErroPii
from app.pii import detectar_pii

esquema_servico = APIKeyHeader(name="X-Chave-Servico", scheme_name="ChaveServico", auto_error=False)
esquema_policia = APIKeyHeader(name="X-Chave-Policia", scheme_name="ChavePolicia", auto_error=False)

_NEGADO = "Chave inválida ou ausente."


def _conferir(recebida: str | None, configurada: str) -> None:
    # Falha fechado: chave configurada vazia nunca autentica, nem com cabeçalho vazio.
    if not configurada or not recebida:
        raise HTTPException(status_code=401, detail=_NEGADO)
    if not hmac.compare_digest(recebida.encode("utf-8"), configurada.encode("utf-8")):
        raise HTTPException(status_code=401, detail=_NEGADO)


def exigir_chave_servico(chave: str | None = Depends(esquema_servico)) -> None:
    _conferir(chave, get_settings().chave_servico)


def exigir_chave_policia(chave: str | None = Depends(esquema_policia)) -> None:
    _conferir(chave, get_settings().chave_policia)


async def rejeitar_pii(request: Request) -> None:
    """Lê o JSON bruto (antes da validação tipada) e rejeita qualquer dado pessoal."""
    try:
        dados = await request.json()
    except ValueError:
        raise HTTPException(status_code=422, detail="Corpo não é um JSON válido.")
    try:
        achados = detectar_pii(dados)
    except ValueError:
        raise HTTPException(status_code=422, detail="Payload aninhado demais.")
    if achados:
        raise ErroPii(achados)
