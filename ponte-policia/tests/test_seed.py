from tests.fabrica import AGORA, CHAVE_SERVICO
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
