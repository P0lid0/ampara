"""Seed sintetico para a demonstracao da Ponte Policia.

Uso: PONTE_CHAVE_SERVICO=... python scripts/seed_demo.py --base http://localhost:8000 --n 12
Todos os dados sao SINTETICOS (focos ficticios, hashes derivados de um rotulo fixo).

Atencao: os ids sao fixos, mas o ts e relativo ao momento da execucao. Rodar de novo
sobre o mesmo banco devolve 200 (idempotente) e mantem os ts antigos, entao os hotspots
da janela de 60 min esvaziam. Antes da demonstracao, recrie o banco.
"""
import argparse
import hashlib
import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

if __package__ in (None, ""):  # execucao direta: scripts/seed_demo.py
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.area import area_id  # noqa: E402

# SINTETICO: focos de demonstracao (Pinheiros, Lapa, Bras)
FOCOS = [
    (-23.5672490, -46.7019515),
    (-23.5214, -46.7027),
    (-23.5445, -46.6165),
]
TIPOS = ["roubo_celular", "furto_celular"]
GATILHOS = ["chaveiro", "web", "guardiao", "impacto"]


def _iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def gerar_payloads(n: int, agora: datetime, chave_servico: str) -> list[dict]:
    """Gera n ocorrencias deterministicas (mesma entrada, mesma saida)."""
    rng = random.Random("ampara-seed")
    payloads = []
    for i in range(n):
        lat0, lng0 = FOCOS[i % len(FOCOS)]
        lat = lat0 + rng.uniform(-0.0012, 0.0012)
        lng = lng0 + rng.uniform(-0.0012, 0.0012)
        ts = agora - timedelta(minutes=rng.randint(1, 50))
        trilha = [
            {"lat": round(lat - 0.0003, 6), "lng": round(lng - 0.0003, 6), "em": _iso(ts - timedelta(seconds=30))},
            {"lat": round(lat, 6), "lng": round(lng, 6), "em": _iso(ts)},
        ]
        payloads.append({
            "origem_id": str(uuid5(NAMESPACE_URL, f"ampara-seed-{i}")),
            "area_id": area_id(lat, lng),
            "ts": _iso(ts),
            "tipo": TIPOS[i % len(TIPOS)],
            "origem_gatilho": GATILHOS[i % len(GATILHOS)],
            "device_hash": hashlib.sha256((f"chaveiro-ampara-seed{i:03d}" + chave_servico).encode()).hexdigest(),
            "trilha": trilha,
        })
    return payloads


def _postar(base: str, chave: str, payload: dict) -> int:
    req = urllib.request.Request(
        base.rstrip("/") + "/ocorrencias",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "X-Chave-Servico": chave},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--n", type=int, default=12)
    args = ap.parse_args(argv)
    if args.n < 1:
        print("--n deve ser maior ou igual a 1.", file=sys.stderr)
        return 2
    chave = os.environ.get("PONTE_CHAVE_SERVICO")
    if not chave:
        print("PONTE_CHAVE_SERVICO ausente no ambiente.", file=sys.stderr)
        return 2
    resumo: dict[int, int] = {}
    for p in gerar_payloads(args.n, datetime.now(timezone.utc), chave):
        try:
            codigo = _postar(args.base, chave, p)
        except urllib.error.URLError as e:
            print(f"Ponte inacessivel em {args.base}: {e.reason}", file=sys.stderr)
            return 1
        except OSError as e:  # TimeoutError e quedas de socket na leitura
            print(f"Ponte inacessivel em {args.base}: {e}", file=sys.stderr)
            return 1
        resumo[codigo] = resumo.get(codigo, 0) + 1
    print("Resumo:", ", ".join(f"{c} x{q}" for c, q in sorted(resumo.items())))
    return 0 if set(resumo) <= {200, 201} else 1


if __name__ == "__main__":
    raise SystemExit(main())
