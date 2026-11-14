import hashlib
import re
from datetime import datetime, timedelta
from uuid import NAMESPACE_URL, uuid5

import pytest

from tests.fabrica import AGORA, CHAVE_SERVICO
from scripts import seed_demo
from scripts.seed_demo import gerar_payloads
from app.schemas import OcorrenciaCriar
from app.pii import detectar_pii


def test_payloads_validam_no_schema_e_sem_pii():
    ps = gerar_payloads(12, AGORA, CHAVE_SERVICO)
    assert len(ps) == 12
    for p in ps:
        assert OcorrenciaCriar(**p) and detectar_pii(p) == []


def test_ids_sao_estaveis_e_ha_ao_menos_3_areas():
    a, b = gerar_payloads(12, AGORA, CHAVE_SERVICO), gerar_payloads(12, AGORA, CHAVE_SERVICO)
    assert [p["origem_id"] for p in a] == [p["origem_id"] for p in b]
    assert len({p["area_id"] for p in a}) >= 3
    assert len({p["origem_id"] for p in a}) == 12


def test_campos_conforme_o_brief():
    ps = gerar_payloads(12, AGORA, CHAVE_SERVICO)
    for i, p in enumerate(ps):
        assert p["origem_id"] == str(uuid5(NAMESPACE_URL, f"ampara-seed-{i}"))
        esperado = hashlib.sha256((f"chaveiro-ampara-seed{i:03d}" + CHAVE_SERVICO).encode()).hexdigest()
        assert p["device_hash"] == esperado and re.fullmatch(r"[0-9a-f]{64}", p["device_hash"])
        ts = datetime.strptime(p["ts"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=AGORA.tzinfo)
        assert timedelta(minutes=1) <= AGORA - ts <= timedelta(minutes=50)
        assert len(p["trilha"]) == 2


def test_main_resume_por_codigo(monkeypatch, capsys):
    monkeypatch.setenv("PONTE_CHAVE_SERVICO", CHAVE_SERVICO)
    codigos = iter([201, 201, 200])
    monkeypatch.setattr(seed_demo, "_postar", lambda base, chave, p: next(codigos))
    assert seed_demo.main(["--n", "3"]) == 0
    assert "200 x1, 201 x2" in capsys.readouterr().out


def test_main_sem_chave_sai_com_2(monkeypatch):
    monkeypatch.delenv("PONTE_CHAVE_SERVICO", raising=False)
    assert seed_demo.main(["--n", "1"]) == 2


@pytest.mark.parametrize("n", ["0", "-3"])
def test_main_rejeita_n_invalido(monkeypatch, n):
    monkeypatch.setenv("PONTE_CHAVE_SERVICO", CHAVE_SERVICO)
    assert seed_demo.main(["--n", n]) == 2


def test_main_timeout_sai_com_1(monkeypatch):
    monkeypatch.setenv("PONTE_CHAVE_SERVICO", CHAVE_SERVICO)

    def estoura(*a):
        raise TimeoutError("lido")

    monkeypatch.setattr(seed_demo, "_postar", estoura)
    assert seed_demo.main(["--n", "1"]) == 1
