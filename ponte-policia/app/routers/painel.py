"""Painel HTML da polícia: só entrega a página; dados e chave vêm por fetch no navegador."""
import re
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["painel"])
_templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "templates"))
_PREFIXO_OK = re.compile(r"(/[A-Za-z0-9_-]+)*")


def _api_base(request: Request) -> str:
    prefixo = request.headers.get("X-Forwarded-Prefix", "")
    return prefixo if _PREFIXO_OK.fullmatch(prefixo) else ""


@router.get("/policia", response_class=HTMLResponse, include_in_schema=False)
def painel(request: Request) -> HTMLResponse:
    return _templates.TemplateResponse(request, "policia.html", {"api_base": _api_base(request)})
