from fastapi import APIRouter

router = APIRouter(tags=["saude"])


@router.get("/health", summary="Verifica se a Ponte está no ar",
            description="Não exige chave e não consulta o banco; serve ao healthcheck do nginx/compose.")
def health() -> dict[str, str]:
    return {"status": "ok"}
