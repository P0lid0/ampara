"""Amostra real do chaveiro (Wokwi do Vitor): recebe 1 evento, valida, manda ack e confere que a retransmissao para.

Uso: python qa/spikes/mqtt/chaveiro_real.py --device-id chaveiro-ampara-ab12cd --esperar 120
Assina SO os topicos desse deviceId (nunca coringa + ou #): o broker e publico.
"""
import argparse
import json
import queue
import sys
import time

from test_hivemq import ESPERA, assinar, conectar, desligar, novo_cliente, topico

OBRIGATORIOS = ("eventId", "type", "deviceId", "ts", "ageMs", "attempt", "battery", "fw")
TIPOS = {"alert", "cancel", "test", "low_battery"}
SEM_RETRANSMISSAO_S = 15  # o firmware reenvia a cada 5 s ate o ack


def validar_evento(ev: dict) -> list[str]:
    """Lista de problemas do evento; vazia = valido. `ts` pode ser None."""
    problemas = [f"falta {c}" for c in OBRIGATORIOS if c not in ev]
    if "type" in ev and ev["type"] not in TIPOS:
        problemas.append(f"type inválido: {ev['type']}")
    return problemas


def _proximo_evento(c, timeout: float):
    try:
        return json.loads(c.mensagens.get(timeout=timeout).payload)
    except queue.Empty:
        return None


def main(device_id: str, esperar_s: int = 120) -> int:
    c = conectar(novo_cliente())
    try:
        assinar(c, topico(device_id, "events"))
        print(f"aguardando evento de {device_id} por {esperar_s}s...", flush=True)
        ev = _proximo_evento(c, esperar_s)
        if ev is None:
            print("FALHOU: nenhum evento recebido", file=sys.stderr)
            return 1
        print(json.dumps(ev, ensure_ascii=False, indent=2))
        problemas = validar_evento(ev)
        if problemas:
            print("FALHOU: evento inválido: " + "; ".join(problemas), file=sys.stderr)
            return 1
        id_evento = ev["eventId"]
        c.publish(topico(device_id, "cmd"), json.dumps({"cmd": "ack", "eventId": id_evento}),
                  qos=1).wait_for_publish(ESPERA)
        fim = time.time() + SEM_RETRANSMISSAO_S
        while (restante := fim - time.time()) > 0:
            outro = _proximo_evento(c, restante)
            if outro is not None and outro.get("eventId") == id_evento:
                print("FALHOU: o eventId voltou depois do ack", file=sys.stderr)
                return 1
        print("OK: evento válido, ack enviado e sem retransmissão")
        return 0
    finally:
        desligar(c)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--device-id", required=True)
    p.add_argument("--esperar", type=int, default=120)
    a = p.parse_args()
    sys.exit(main(a.device_id, a.esperar))
