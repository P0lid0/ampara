"""Risco (b): MQTT no broker publico. Publica so type "test" com dados sinteticos."""
import json
import os
import queue
import secrets
import threading
import time

import paho.mqtt.client as mqtt
import pytest

HOST = os.environ.get("MQTT_HOST", "broker.hivemq.com")
PORT = int(os.environ.get("MQTT_PORT", "1883"))
ESPERA = 10  # segundos por espera


def novo_cliente() -> mqtt.Client:
    """Cliente paho 2.x com fila de mensagens e eventos de conexao/assinatura."""
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                    client_id="ampara-qa-" + secrets.token_hex(4))
    c.mensagens = queue.Queue()
    c.conectado = threading.Event()
    c.reason_connect = None
    c.sub_codes = {}
    c.sub_eventos = {}

    def on_connect(client, userdata, flags, reason_code, properties):
        client.reason_connect = reason_code
        client.conectado.set()

    def on_subscribe(client, userdata, mid, reason_codes, properties):
        client.sub_codes[mid] = [rc.value for rc in reason_codes]
        client.sub_eventos.setdefault(mid, threading.Event()).set()

    def on_message(client, userdata, msg):
        client.mensagens.put(msg)

    c.on_connect = on_connect
    c.on_subscribe = on_subscribe
    c.on_message = on_message
    return c


def conectar(c: mqtt.Client) -> mqtt.Client:
    c.connect(HOST, PORT, keepalive=30)
    c.loop_start()
    assert c.conectado.wait(ESPERA), "sem CONNACK em %ds" % ESPERA
    assert c.reason_connect == 0, f"CONNACK recusado: {c.reason_connect}"
    return c


def assinar(c: mqtt.Client, topico: str):
    res, mid = c.subscribe(topico, qos=1)
    assert res == mqtt.MQTT_ERR_SUCCESS
    ev = c.sub_eventos.setdefault(mid, threading.Event())
    assert ev.wait(ESPERA), "sem SUBACK para " + topico
    assert all(code < 128 for code in c.sub_codes[mid]), c.sub_codes[mid]


def desligar(c: mqtt.Client):
    c.loop_stop()
    c.disconnect()


def topico(device_id: str, sufixo: str) -> str:
    return f"citizentech/chaveiro/{device_id}/{sufixo}"


@pytest.fixture
def device_id():
    return "chaveiro-ampara-" + secrets.token_hex(3)


@pytest.fixture
def cliente():
    c = conectar(novo_cliente())
    yield c
    desligar(c)


def test_conecta_ao_broker():
    c = novo_cliente()
    try:
        conectar(c)
    finally:
        desligar(c)


def test_assina_topicos_do_chaveiro(cliente, device_id):
    assinar(cliente, topico(device_id, "events"))
    assinar(cliente, topico(device_id, "status"))


def test_ida_e_volta_do_evento(cliente, device_id):
    t = topico(device_id, "events")
    assinar(cliente, t)
    enviado = {"eventId": f"{device_id}-1", "type": "test", "deviceId": device_id,
               "ts": int(time.time()), "ageMs": 0, "attempt": 1, "battery": 82,
               "fw": "1.0.0"}  # SINTETICO
    cliente.publish(t, json.dumps(enviado), qos=1).wait_for_publish(ESPERA)
    msg = cliente.mensagens.get(timeout=ESPERA)
    assert json.loads(msg.payload) == enviado


def test_status_retido_chega_a_quem_assina_depois(cliente, device_id):
    t = topico(device_id, "status")
    status = {"deviceId": device_id, "online": True, "battery": 82, "fw": "1.0.0"}
    outro = None
    try:
        cliente.publish(t, json.dumps(status), qos=1, retain=True).wait_for_publish(ESPERA)
        outro = conectar(novo_cliente())
        assinar(outro, t)
        msg = outro.mensagens.get(timeout=ESPERA)
        assert msg.retain is True
        assert json.loads(msg.payload) == status
    finally:
        cliente.publish(t, b"", qos=1, retain=True).wait_for_publish(ESPERA)
        if outro is not None:
            desligar(outro)


def test_comando_ack_chega_em_cmd(cliente, device_id):
    t = topico(device_id, "cmd")
    outro = conectar(novo_cliente())
    try:
        assinar(outro, t)
        cmd = {"cmd": "ack", "eventId": f"{device_id}-1"}
        cliente.publish(t, json.dumps(cmd), qos=1).wait_for_publish(ESPERA)
        msg = outro.mensagens.get(timeout=ESPERA)
        assert json.loads(msg.payload) == cmd
    finally:
        desligar(outro)
