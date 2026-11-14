"""Valida o contrato do evento do chaveiro (iot/docs/contrato-mqtt.md). Offline, sem broker."""
from chaveiro_real import validar_evento

AMOSTRA = {"eventId": "chaveiro-ampara-ab12cd-1", "type": "alert", "deviceId": "chaveiro-ampara-ab12cd",
           "alertId": "chaveiro-ampara-ab12cd-1", "ts": 1763089200, "ageMs": 140, "attempt": 1, "battery": 82, "fw": "1.0.0"}


def test_evento_valido_nao_tem_problemas():            assert validar_evento(AMOSTRA) == []
def test_ts_nulo_e_aceito():                           assert validar_evento({**AMOSTRA, "ts": None}) == []
def test_falta_event_id():                             assert validar_evento({k: v for k, v in AMOSTRA.items() if k != "eventId"}) == ["falta eventId"]
def test_tipo_desconhecido():                          assert validar_evento({**AMOSTRA, "type": "foo"}) == ["type inválido: foo"]
