"""Risco (c): descobre as colunas reais da planilha SSP-SP e decide a granularidade.

Modulo unico, sem importar irmaos. Nunca grava valores de celula na saida.
Uso: python -I colunas.py --entrada <xlsx> --saida <md>
"""
import argparse
import re
import sys
import unicodedata
from pathlib import Path

BBOX = {"lat_min": -23.80, "lat_max": -23.35, "lng_min": -46.83, "lng_max": -46.36}

PADROES = {
    "latitude": r"\blat",
    "longitude": r"\blon|\blng",
    "data_fato": r"\bdata",
    "hora_fato": r"\bhora",
    "rubrica": r"rubrica|natureza",
    "municipio": r"municipio|cidade",
    "bairro": r"bairro",
    "logradouro": r"logradouro|endereco",
    "objeto_celular": r"celular|objeto",
}


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return s.lower().replace("_", " ").strip()


def achar_cabecalho(linhas: list[tuple]) -> int:
    for i, linha in enumerate(linhas):
        cel = [c for c in linha if c not in (None, "")]
        if len(cel) >= 10 and sum(isinstance(c, str) for c in cel) > len(cel) / 2:
            return i
    return 0


def _num(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip().replace(",", "."))
        except ValueError:
            return None
    return None


def validar_coordenadas(lats: list, lngs: list) -> dict:
    n = max(len(lats), len(lngs))
    ok_lat, ok_lng = [], []
    for a, b in zip(lats, lngs):
        la, lo = _num(a), _num(b)
        if la is None or lo is None or la == 0 or lo == 0:
            continue
        if BBOX["lat_min"] <= la <= BBOX["lat_max"] and BBOX["lng_min"] <= lo <= BBOX["lng_max"]:
            ok_lat.append(la)
            ok_lng.append(lo)
    return {
        "validos_pct": round(100.0 * len(ok_lat) / n, 1) if n else 0.0,
        "n": n,
        "min_lat": min(ok_lat) if ok_lat else None,
        "max_lat": max(ok_lat) if ok_lat else None,
        "min_lng": min(ok_lng) if ok_lng else None,
        "max_lng": max(ok_lng) if ok_lng else None,
    }


def classificar_colunas(nomes: list[str]) -> dict[str, str | None]:
    mapa: dict[str, str | None] = {k: None for k in PADROES}
    for chave, rx in PADROES.items():
        # a data do fato (ocorrencia) vence a data de registro do BO
        regexes = [r"data.*ocorr"] + [rx] if chave == "data_fato" else [rx]
        for r in regexes:
            achou = next((n for n in nomes if n is not None and re.search(r, _norm(n))), None)
            if achou is not None:
                mapa[chave] = achou
                break
    return mapa


def veredito(mapa: dict, coords: dict) -> str:
    if mapa.get("latitude") and mapa.get("longitude") and (mapa.get("municipio") or mapa.get("bairro")) \
            and coords.get("validos_pct", 0.0) >= 50.0:
        return "GRADE_500M"
    return "DISTRITO"


def _tipo(valores: list) -> str:
    tipos = {type(v).__name__ for v in valores if v not in (None, "")}
    return "/".join(sorted(tipos)) if tipos else "vazio"


def _ler_aba(ws, max_linhas: int):
    """Devolve (nomes, linhas_de_dados) de uma aba, lendo no maximo max_linhas apos o cabecalho."""
    it = ws.iter_rows(values_only=True)
    buf = []
    for linha in it:
        buf.append(linha)
        if len(buf) >= 50:
            break
    if not buf:
        return [], []
    idx = achar_cabecalho(buf)
    cab = buf[idx]
    if sum(c not in (None, "") for c in cab) < 10:
        return [], []
    dados = list(buf[idx + 1:])
    for linha in it:
        if len(dados) >= max_linhas:
            break
        dados.append(linha)
    return ["" if c is None else str(c) for c in cab], dados[:max_linhas]


def _abrir_perfil(caminho: Path, max_linhas: int):
    import openpyxl
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    try:
        for ws in wb.worksheets:
            nomes, dados = _ler_aba(ws, max_linhas)
            yield ws.title, nomes, dados
    finally:
        wb.close()


def perfil_planilha(caminho: Path, max_linhas: int = 20000) -> dict[str, list[dict]]:
    perfil = {}
    for aba, nomes, dados in _abrir_perfil(Path(caminho), max_linhas):
        cols = []
        for j, nome in enumerate(nomes):
            vals = [r[j] if j < len(r) else None for r in dados]
            nulos = sum(v in (None, "") for v in vals)
            cols.append({"nome": nome, "pct_nulos": round(100.0 * nulos / len(vals), 1) if vals else 100.0,
                         "tipo": _tipo(vals)})
        perfil[aba] = cols
    return perfil


def coordenadas_da_planilha(caminho: Path, mapa_por_aba: dict, max_linhas: int = 20000) -> dict:
    """Valida lat/lng da aba que tem as duas colunas (a de maior volume)."""
    melhor = None
    for aba, nomes, dados in _abrir_perfil(Path(caminho), max_linhas):
        m = classificar_colunas(nomes)
        if m["latitude"] and m["longitude"]:
            ja, jo = nomes.index(m["latitude"]), nomes.index(m["longitude"])
            r = validar_coordenadas([row[ja] if ja < len(row) else None for row in dados],
                                    [row[jo] if jo < len(row) else None for row in dados])
            r["aba"] = aba
            if melhor is None or r["n"] > melhor["n"]:
                melhor = r
    return melhor or {"validos_pct": 0.0, "n": 0, "min_lat": None, "max_lat": None,
                      "min_lng": None, "max_lng": None, "aba": None}


def escrever_markdown(perfil: dict, mapa: dict, coords: dict, veredito: str, destino: Path) -> None:
    L = ["# Colunas da planilha SSP-SP", "",
         "Gerado por `qa/spikes/ssp/colunas.py`. Contem so nomes de coluna, % de nulos, tipo e limites de coordenadas; nunca valores de celula.", ""]
    for aba, cols in perfil.items():
        L += [f"## Aba `{aba}`", "", "| Coluna | % nulos | Tipo |", "|---|---|---|"]
        L += [f"| {c['nome']} | {c['pct_nulos']} | {c['tipo']} |" for c in cols] or ["| (sem cabecalho reconhecido) | | |"]
        L.append("")
    L += ["## Mapeamento das colunas logicas", "", "| Logica | Coluna real |", "|---|---|"]
    L += [f"| {k} | {v if v else 'AUSENTE'} |" for k, v in mapa.items()]
    L += ["", "## Coordenadas", "",
          f"- Aba analisada: {coords.get('aba')}", f"- Linhas: {coords.get('n')}",
          f"- Validas na capital (%): {coords.get('validos_pct')}",
          f"- Latitude min/max: {coords.get('min_lat')} / {coords.get('max_lat')}",
          f"- Longitude min/max: {coords.get('min_lng')} / {coords.get('max_lng')}",
          "", "## Veredito", "", f"SSP_VEREDITO: {veredito}",
          f"SSP_CELULAR: {mapa.get('objeto_celular') or 'PROXY'}", ""]
    Path(destino).write_text(chr(10).join(L), encoding="utf-8", newline=chr(10))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", required=True, type=Path)
    ap.add_argument("--saida", required=True, type=Path)
    ap.add_argument("--max-linhas", type=int, default=20000)
    a = ap.parse_args(argv)
    perfil = perfil_planilha(a.entrada, a.max_linhas)
    coords = coordenadas_da_planilha(a.entrada, {}, a.max_linhas)
    aba = coords.get("aba") or next(iter(perfil), None)
    nomes = [c["nome"] for c in perfil.get(aba, [])] if aba else []
    mapa = classificar_colunas(nomes)
    v = veredito(mapa, coords)
    escrever_markdown(perfil, mapa, coords, v, a.saida)
    print(f"SSP_VEREDITO={v}")
    print(f"SSP_CELULAR={mapa.get('objeto_celular') or 'PROXY'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
