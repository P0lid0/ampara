"""Extrai as camadas do mapa do WFS do GeoSampa (Prefeitura de Sao Paulo).

Descobre as camadas pelo GetCapabilities e grava, em api/Ampara.Api/Dados/:
  delegacias.json  [{nome, endereco, lat, lng}]  (usado pelo BO e pela camada publica)
  estacoes.json    [{nome, lat, lng}]            (metro + trem operando)
  pm.json          [{nome, lat, lng}]            (equipamentos da Policia Militar)

So biblioteca padrao. Uso (a partir da raiz do repositorio):
  python api/tools/extrair_camadas.py            # grava os tres JSONs
  python api/tools/extrair_camadas.py --so-listar # so lista as camadas candidatas

Dado aberto; nao ha dado pessoal. Registre URL e data de acesso em docs/fontes.md (o script imprime as linhas).
"""
import argparse
import datetime
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs"
CAPS = "https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/wfs?service=WFS&request=GetCapabilities"
SAIDA = Path(__file__).resolve().parents[1] / "Ampara.Api" / "Dados"

# Caixa da grade do contrato (AreaMapa): lat -23.80..-23.35, lng -46.83..-46.36.
LAT_MIN, LAT_MAX, LNG_MIN, LNG_MAX = -23.80, -23.35, -46.83, -46.36

# camada -> nomes candidatos no GeoSampa (o primeiro que existir no GetCapabilities vale)
CANDIDATAS = {
    "delegacias": ["geoportal:equipamento_policia_civil"],
    "pm": ["geoportal:equipamento_policia_militar"],
    "estacoes": ["geoportal:estacao_metro", "geoportal:estacao_trem"],
}


def baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "ampara-extrair-camadas/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def camadas_do_servidor() -> set[str]:
    xml = baixar(CAPS).decode("utf-8", "replace")
    return set(re.findall(r"<Name>(geoportal:[^<]+)</Name>", xml))


def url_feature(camada: str) -> str:
    q = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": camada,
        "outputFormat": "application/json", "srsName": "EPSG:4326",
    }
    return BASE + "?" + urllib.parse.urlencode(q, safe=":/")


def dentro_de_sp(lat: float, lng: float) -> bool:
    return LAT_MIN <= lat < LAT_MAX and LNG_MIN <= lng < LNG_MAX


def pontos(camada: str):
    dados = json.loads(baixar(url_feature(camada)).decode("utf-8"))
    for f in dados.get("features", []):
        g = f.get("geometry") or {}
        if g.get("type") != "Point":
            continue
        lng, lat = g["coordinates"][:2]   # GeoJSON: lng, lat
        yield f.get("properties") or {}, round(lat, 7), round(lng, 7)


def limpo(texto) -> str:
    return re.sub(r"\s+", " ", (texto or "")).strip()


LIGACOES = {"da", "de", "do", "das", "dos", "e"}
SIGLAS = {"cptm", "dp", "bpm", "cia", "sp", "aacd"}


def titulo(texto: str) -> str:
    """Caixa de titulo para nomes em maiusculas, com 'da/de/dos' em minuscula e siglas conhecidas em maiuscula."""
    saida = []
    for i, palavra in enumerate(limpo(texto).lower().split(" ")):
        if i > 0 and palavra in LIGACOES:
            saida.append(palavra)
        elif palavra.strip(".,") in SIGLAS:
            saida.append(palavra.upper())
        else:
            saida.append(palavra[:1].upper() + palavra[1:])
    return " ".join(saida)


def extrair(tipo: str, camadas: list[str]) -> list[dict]:
    saida, vistos = [], set()
    for camada in camadas:
        for p, lat, lng in pontos(camada):
            if not dentro_de_sp(lat, lng):
                continue
            if tipo == "estacoes":
                if limpo(p.get("tx_situacao_metro_trem")).upper() != "OPERANDO":
                    continue
                empresa = titulo(p.get("nm_empresa_metro_trem"))
                nome = titulo(p.get("nm_estacao_metro_trem"))
                nome = f"Estação {nome}" + (f" ({empresa})" if empresa else "")
                item = {"nome": nome, "lat": lat, "lng": lng}
            else:
                nome = limpo(p.get("nm_equipamento"))
                if not nome:
                    continue
                item = {"nome": nome, "lat": lat, "lng": lng}
                if tipo == "delegacias":
                    end = limpo(p.get("tx_endereco_equipamento"))
                    if not end:
                        continue   # o BO nao mostra delegacia sem endereco
                    bairro = limpo(p.get("nm_bairro_equipamento"))
                    item = {"nome": nome, "endereco": titulo(end) + (f" - {titulo(bairro)}" if bairro else "") + ", São Paulo/SP",
                            "lat": lat, "lng": lng}
            chave = (item["nome"], item["lat"], item["lng"])
            if chave not in vistos:
                vistos.add(chave)
                saida.append(item)
    return sorted(saida, key=lambda i: i["nome"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--so-listar", action="store_true")
    args = ap.parse_args()

    existentes = camadas_do_servidor()
    print(f"GetCapabilities: {len(existentes)} camadas em geoportal")
    faltando = [c for lista in CANDIDATAS.values() for c in lista if c not in existentes]
    if faltando:
        print("Camadas nao encontradas no servidor:", ", ".join(faltando), file=sys.stderr)
        for c in sorted(existentes):
            if re.search(r"policia|metro|trem|delegacia", c):
                print("  candidata:", c, file=sys.stderr)
        return 2
    if args.so_listar:
        for t, l in CANDIDATAS.items():
            print(t, "->", ", ".join(l))
        return 0

    SAIDA.mkdir(parents=True, exist_ok=True)
    hoje = datetime.date.today().isoformat()
    for tipo, camadas in CANDIDATAS.items():
        itens = extrair(tipo, camadas)
        (SAIDA / f"{tipo}.json").write_text(json.dumps(itens, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"{tipo}.json: {len(itens)} itens")
        for c in camadas:
            print(f"  fonte ({hoje}): {url_feature(c)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
