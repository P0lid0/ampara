"""Prepara as fontes e os prints da página de apresentação.

Rode da raiz do repositório:  py -3 apresentacao/scripts/preparar-midia.py

- Fontes: Manrope 400, 600, 700 e 800 (de app/node_modules/@expo-google-fonts/manrope) viram woff2 em fonts/.
- Prints: os PNG reais do app em app/docs/prints (e, para o mapa e o histórico, app/docs/design/antes) são
  recortados (sem a barra de status do Android no alto e sem a barra de gestos embaixo) e gravados como
  webp em img/app-*.webp. Rode de novo quando os prints do app forem refeitos.
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
APR = RAIZ / "apresentacao"
APP_FONTES = RAIZ / "app" / "node_modules" / "@expo-google-fonts" / "manrope"
PRINTS = RAIZ / "app" / "docs" / "prints"
ANTES = RAIZ / "app" / "docs" / "design" / "antes"

FONTES = {
    "400Regular/Manrope_400Regular.ttf": "manrope-400.woff2",
    "600SemiBold/Manrope_600SemiBold.ttf": "manrope-600.woff2",
    "700Bold/Manrope_700Bold.ttf": "manrope-700.woff2",
    "800ExtraBold/Manrope_800ExtraBold.ttf": "manrope-800.woff2",
}

# nome de saída -> (arquivo, [(y0, y1), ...]) em pixels do print de 1080x2400. Cada faixa começa e termina em fronteira
# de bloco (entre cartões ou em fundo liso), e as faixas são coladas em sequência: no alarme, o vermelho liso entre o
# texto e o botão sai, e o que sobra do print é texto e botão em vez de uma massa vermelha.
TELAS = {
    "app-alarme": ("11-alarme.png", [(130, 290), (700, 1560), (2040, 2330)]),
    "app-inicio": ("10-inicio.png", [(130, 2330)]),
    "app-passo-a-passo": ("12-passo-a-passo.png", [(130, 1865)]),
    "app-chaveiro": ("07-chaveiro.png", [(1296, 2105)]),
    "app-rota-consentimento": ("08-consentimento-rota.png", [(130, 2330)]),
    "app-contas": ("05-contas.png", [(320, 1545)]),
    "app-convite": ("06-convite-qr.png", [(130, 2330)]),
    "app-checklist": ("18-checklist.png", [(130, 2330)]),
    "app-mapa": ("16-mapa.png", [(130, 1560)]),
}

# recortes dos prints web que já estão em img/: nome de saída -> (arquivo, caixa x0, y0, x1, y1)
RECORTES_WEB = {
    "web-rota.webp": ("web-rota-cheio.webp", (0, 0, 780, 1935)),
    "web-policia-mapa.webp": ("painel-policia.png", (55, 150, 1225, 715)),
    "web-api-grupos.webp": ("scalar-rotas.png", (15, 120, 590, 1395)),
}


def main():
    (APR / "fonts").mkdir(exist_ok=True)
    (APR / "img").mkdir(exist_ok=True)
    for origem, destino in FONTES.items():
        f = TTFont(APP_FONTES / origem)
        f.flavor = "woff2"
        f.save(APR / "fonts" / destino)
        print("fonte", destino)
    for nome, (arq, faixas) in TELAS.items():
        p = PRINTS / arq
        if not p.exists():
            p = ANTES / arq
        if not p.exists():
            print("sem print:", arq, file=sys.stderr)
            continue
        im = Image.open(p).convert("RGB")
        w, h = im.size
        pedacos = [im.crop((0, y0, w, y1)) for y0, y1 in faixas]
        im = Image.new("RGB", (w, sum(c.height for c in pedacos)))
        y = 0
        for c in pedacos:
            im.paste(c, (0, y))
            y += c.height
        im = im.resize((720, round(im.height * 720 / w)), Image.LANCZOS)
        im.save(APR / "img" / f"{nome}.webp", "WEBP", quality=86, method=6)
        print("tela", nome, im.size)

    # página de emergência (web-emergencia): captura real em 390 px; usa "depois" se já existir
    web = RAIZ / "web-emergencia" / "docs" / "design"
    for pasta in ("antes", "depois"):  # "antes" é a página inteira; "depois" é só a janela de 390x844 com o rodapé fixo
        arq = web / pasta / "6-marcado-390.png"
        if arq.exists():
            im = Image.open(arq).convert("RGB")
            im = im.resize((780, round(im.height * 2)), Image.LANCZOS) if im.width < 500 else im
            im.save(APR / "img" / "web-rota-cheio.webp", "WEBP", quality=86, method=6)
            print("web-rota de", pasta, im.size)
            break

    for saida, (arq, caixa) in RECORTES_WEB.items():
        origem = APR / "img" / arq
        if not origem.exists():
            continue
        Image.open(origem).convert("RGB").crop(caixa).save(APR / "img" / saida, "WEBP", quality=88, method=6)
        print("recorte", saida)
    (APR / "img" / "web-rota-cheio.webp").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
