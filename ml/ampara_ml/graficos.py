"""Graficos do relatorio e do notebook. Todos gravam PNG e devolvem o caminho."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

PETROLEO = "#0F4C4A"
ESMERALDA = "#14B88A"
ALARME = "#E5484D"
_ROTULOS_CLASSE = ["baixo", "médio", "alto"]
_COLUNAS_METRICA = {"f1_macro_cv", "f1_desvio_cv", "tempo_s"}


def _gravar(fig, destino: Path) -> Path:
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(destino, dpi=130, bbox_inches="tight")
    plt.close(fig)
    return destino


def grafico_matriz_confusao(matriz, destino: Path, titulo: str) -> Path:
    m = np.asarray(matriz, dtype=float)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    ax.imshow(m, cmap="Greens")
    ax.set_xticks(range(3), _ROTULOS_CLASSE)
    ax.set_yticks(range(3), _ROTULOS_CLASSE)
    ax.set_xlabel("Classe prevista")
    ax.set_ylabel("Classe real")
    ax.set_title(titulo, color=PETROLEO)
    teto = m.max() if m.size else 0
    for i in range(m.shape[0]):
        for j in range(m.shape[1]):
            ax.text(j, i, f"{int(m[i, j]):,}".replace(",", "."), ha="center", va="center",
                    color="white" if teto and m[i, j] > teto / 2 else PETROLEO)
    return _gravar(fig, destino)


def grafico_treino_teste(metricas: dict[str, dict[str, float]], destino: Path) -> Path:
    modelos = list(metricas)
    series = [("treino", "Treino", PETROLEO), ("cv", "Validação cruzada", ESMERALDA), ("teste", "Teste", ALARME)]
    x = np.arange(len(modelos))
    largura = 0.26
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    for k, (chave, rotulo, cor) in enumerate(series):
        valores = [metricas[m].get(chave, np.nan) for m in modelos]
        barras = ax.bar(x + (k - 1) * largura, valores, largura, label=rotulo, color=cor)
        ax.bar_label(barras, labels=[f"{v:.2f}" for v in valores], fontsize=8, padding=2)
    ax.set_xticks(x, modelos)
    ax.set_ylabel("F1 macro")
    ax.set_ylim(0, 1.05)
    ax.set_title("F1 macro por conjunto", color=PETROLEO)
    ax.legend(loc="lower right")
    return _gravar(fig, destino)


def grafico_curva_aprendizado(curva: pd.DataFrame, destino: Path) -> Path:
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    ax.plot(curva["n_treino"], curva["f1_treino"], marker="o", color=PETROLEO, label="Treino")
    ax.plot(curva["n_treino"], curva["f1_teste"], marker="o", color=ALARME, label="Teste")
    ax.set_xlabel("Linhas de treino")
    ax.set_ylabel("F1 macro")
    ax.set_title("Curva de aprendizado", color=PETROLEO)
    ax.grid(alpha=0.3)
    ax.legend()
    return _gravar(fig, destino)


def grafico_importancia(importancias: pd.Series, destino: Path) -> Path:
    s = importancias.sort_values()
    fig, ax = plt.subplots(figsize=(6.2, max(2.8, 0.38 * len(s) + 1)))
    ax.barh(s.index.astype(str), s.to_numpy(dtype=float), color=ESMERALDA)
    ax.set_xlabel("Importância")
    ax.set_title("Importância das variáveis", color=PETROLEO)
    return _gravar(fig, destino)


def grafico_busca(tabela: pd.DataFrame, destino: Path) -> Path:
    """`tabela` no formato de buscar_hiperparametros: uma coluna por hiperparametro mais f1_macro_cv."""
    cols = [c for c in tabela.columns if c not in _COLUNAS_METRICA]
    rotulos = [", ".join(f"{c}={r[c]}" for c in cols) for _, r in tabela.iterrows()]
    notas = tabela["f1_macro_cv"].to_numpy(dtype=float)
    ordem = np.argsort(notas)
    fig, ax = plt.subplots(figsize=(7.2, max(3.0, 0.4 * len(tabela) + 1.2)))
    cores = [ALARME if i == ordem[-1] else PETROLEO for i in ordem]
    ax.barh([rotulos[i] for i in ordem], notas[ordem], color=cores)
    ax.set_xlabel("F1 macro na validação cruzada")
    ax.set_title("Busca de hiperparâmetros", color=PETROLEO)
    ax.tick_params(axis="y", labelsize=7)
    return _gravar(fig, destino)
