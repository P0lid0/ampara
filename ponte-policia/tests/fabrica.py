"""Dados de teste sintéticos da Ponte Polícia."""
import hashlib
from datetime import datetime, timezone
from uuid import uuid4

AGORA = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)
CHAVE_SERVICO = "chave-servico-teste"
CHAVE_POLICIA = "chave-policia-teste"


def payload_valido(**sobrescritas) -> dict:
    # SINTETICO
    base = {
        "origem_id": str(uuid4()),
        "area_id": "g051_026",
        "ts": "2026-11-16T11:30:00Z",
        "tipo": "roubo_celular",
        "origem_gatilho": "chaveiro",
        "device_hash": hashlib.sha256(("chaveiro-ampara-abc123" + CHAVE_SERVICO).encode()).hexdigest(),
        "trilha": [],
    }
    base.update(sobrescritas)
    return base


HS = {"X-Chave-Servico": CHAVE_SERVICO}
