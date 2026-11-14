"""Ponte Polícia — serviço FastAPI que recebe ocorrências da API da Ampara."""
from fastapi import FastAPI

from app.erros import registrar_handlers
from app.routers import health, hotspots, ocorrencias


def create_app() -> FastAPI:
    app = FastAPI(
        title="Ponte Polícia — Ampara",
        version="1.0.0",
        description="Recebe ocorrências sem dado pessoal da API da Ampara e devolve o retorno da polícia.",
    )
    registrar_handlers(app)
    app.include_router(health.router)
    app.include_router(ocorrencias.router)
    app.include_router(hotspots.router)
    return app


app = create_app()
