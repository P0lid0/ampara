#!/usr/bin/env python3
"""Publica um evento `alert` do chaveiro e espera o ack da API em .../cmd (ate 15 s).

Uso: python api/tools/publicar_alerta.py <deviceId>
Variaveis: MQTT_HOST (padrao broker.hivemq.com), MQTT_PORT (padrao 1883).
Saida: 0 se chegar {"cmd":"ack","eventId":<o enviado>}; 1 caso contrario.
"""
import json
import os
import sys
import threading
import time
import uuid

import paho.mqtt.client as mqtt

ESPERA_S = 15


def main() -> int:
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        print("uso: publicar_alerta.py <deviceId>", file=sys.stderr)
        return 2
    device = sys.argv[1].strip()
    host = os.environ.get("MQTT_HOST") or "broker.hivemq.com"
    porta = int(os.environ.get("MQTT_PORT") or 1883)
    event_id = f"{device}-{uuid.uuid4().hex[:8]}"
    topico_cmd = f"citizentech/chaveiro/{device}/cmd"
    topico_evt = f"citizentech/chaveiro/{device}/events"
    ack = threading.Event()
    assinado = threading.Event()

    def ao_conectar(c, _u, _f, rc, _p=None):
        if rc != 0:
            print(f"falha ao conectar: {rc}", file=sys.stderr)
            return
        c.subscribe(topico_cmd, qos=1)

    def ao_assinar(_c, _u, _mid, _granted, _p=None):
        assinado.set()

    def ao_mensagem(_c, _u, msg):
        try:
            d = json.loads(msg.payload.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return
        if isinstance(d, dict) and d.get("cmd") == "ack" and d.get("eventId") == event_id:
            ack.set()

    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"ampara-script-{uuid.uuid4().hex[:6]}")
    c.on_connect = ao_conectar
    c.on_subscribe = ao_assinar
    c.on_message = ao_mensagem
    c.connect(host, porta, keepalive=30)
    c.loop_start()
    try:
        if not assinado.wait(10):
            print("nao conseguiu assinar o topico de comandos", file=sys.stderr)
            return 1
        evento = {
            "eventId": event_id, "type": "alert", "deviceId": device,
            "ts": int(time.time()), "ageMs": 0, "battery": 80,
        }
        c.publish(topico_evt, json.dumps(evento), qos=1).wait_for_publish(10)
        print(f"evento publicado: {event_id}")
        if ack.wait(ESPERA_S):
            print("ack recebido")
            return 0
        print(f"sem ack em {ESPERA_S} s", file=sys.stderr)
        return 1
    finally:
        c.loop_stop()
        c.disconnect()


if __name__ == "__main__":
    sys.exit(main())
