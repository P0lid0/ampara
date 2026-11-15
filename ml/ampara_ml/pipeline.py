"""Encadeia os modulos do pacote sobre os dados reais (ml/dados/brutos) e devolve o Dataset de modelagem.

Sem logica nova: cada passo e uma funcao ja testada. Os `print` de contagem aparecem no notebook.
"""
from __future__ import annotations

import pickle
import re
from pathlib import Path

import pandas as pd

from ampara_ml.clima import agregar_clima, baixar_clima
from ampara_ml.config import DIR_BRUTOS, MIN_OCORR_CELULA, RAIZ_ML
from ampara_ml.dataset import Dataset, montar_dataset
from ampara_ml.divisao import inicio_teste_padrao, periodo_de, proximo_periodo
from ampara_ml.geosampa import carregar_grupo, features_celulas
from ampara_ml.painel import montar_painel, periodos_completos, selecionar_areas
from ampara_ml.ssp import carregar_ssp
from ampara_ml.urbano import (carregar_distritos, carregar_iluminacao, carregar_populacao, contar_iluminacao,
                              densidade_populacional, features_urbanas)

RISCOS_DIA1 = RAIZ_ML.parent / "docs" / "riscos-dia1.md"
DIR_CACHE = RAIZ_ML / "dados" / "cache"


def ler_decisao(chave: str, arquivo: Path = RISCOS_DIA1) -> str:
    """Valor de `<CHAVE>: valor` em docs/riscos-dia1.md (as decisoes do dia 1)."""
    m = re.search(rf"^{re.escape(chave)}:\s*(\S+)\s*$", arquivo.read_text(encoding="utf-8"), re.MULTILINE)
    if m is None:
        raise ValueError(f"{chave} nao encontrada em {arquivo}")
    return m.group(1)


def _ssp_com_cache(caminhos: list[Path], proxy: bool) -> tuple[pd.DataFrame, dict]:
    """A leitura das 4 planilhas leva horas: o resultado limpo fica em ml/dados/cache (git-ignorado)
    e so e refeito se alguma planilha for mais nova que ele."""
    cache = DIR_CACHE / ("ssp_limpo.pkl" if proxy else "ssp_limpo_sem_proxy.pkl")
    if cache.exists() and cache.stat().st_mtime >= max(c.stat().st_mtime for c in caminhos):
        with open(cache, "rb") as f:
            return pickle.load(f)
    resultado = carregar_ssp(caminhos, proxy=proxy)
    DIR_CACHE.mkdir(parents=True, exist_ok=True)
    with open(cache, "wb") as f:
        pickle.dump(resultado, f)
    return resultado


def _janela_das_planilhas(oc: pd.DataFrame, caminhos: list[Path]) -> pd.DataFrame:
    """Cada planilha traz fatos antigos registrados tarde (desde 2000) e do ano seguinte. O modelo usa so os
    fatos dentro dos anos das planilhas (01/01 do primeiro a 31/12 do ultimo), a mesma janela do clima."""
    anos = sorted(int(m.group(1)) for c in caminhos if (m := re.search(r"(\d{4})", c.stem)))
    d = pd.to_datetime(oc["data"])
    return oc[(d >= pd.Timestamp(anos[0], 1, 1)) & (d < pd.Timestamp(anos[-1] + 1, 1, 1))].reset_index(drop=True)


def ocorrencias_limpas(proxy: bool | None = None) -> tuple[pd.DataFrame, dict]:
    """Ocorrencias limpas da SSP na janela do modelo (mesmo cache de `preparar_dados`), para os graficos exploratorios."""
    if proxy is None:
        proxy = ler_decisao("SSP_CELULAR") == "PROXY"
    caminhos = sorted((DIR_BRUTOS / "ssp").glob("*.xlsx"))
    oc, resumo = _ssp_com_cache(caminhos, proxy)
    return _janela_das_planilhas(oc, caminhos), resumo


def preparar_dados(resolucao: str | None = None, usar_extras: bool = True,
                   ano_teste: int = 2025, proxy: bool | None = None) -> tuple[Dataset, dict]:
    if proxy is None:
        proxy = ler_decisao("SSP_CELULAR") == "PROXY"
    if resolucao is None:
        resolucao = "distrito" if ler_decisao("SSP_VEREDITO") == "DISTRITO" else "grade"
    if resolucao != "grade":
        raise NotImplementedError("resolucao por distrito depende da Tarefa 8 (plano B), que foi pulada: "
                                  "SSP_VEREDITO e GRADE_500M")

    caminhos = sorted((DIR_BRUTOS / "ssp").glob("*.xlsx"))
    if not caminhos:
        raise FileNotFoundError(f"sem planilhas da SSP em {DIR_BRUTOS / 'ssp'}")
    oc, resumo_ssp = _ssp_com_cache(caminhos, proxy)
    oc = _janela_das_planilhas(oc, caminhos)
    print(f"SSP: {resumo_ssp['linhas_lidas']:,} linhas lidas -> {len(oc):,} ocorrencias usadas".replace(",", "."))

    periodos = periodos_completos(oc["data"])
    inicio_teste = inicio_teste_padrao(periodos, ano_teste)
    oc_treino = oc[periodo_de(oc["data"]) < inicio_teste]
    areas = selecionar_areas(oc_treino, MIN_OCORR_CELULA)
    print(f"periodos completos: {periodos[0]} a {periodos[-1]}; teste a partir de {inicio_teste}; "
          f"{len(areas)} areas com >= {MIN_OCORR_CELULA} ocorrencias no treino")

    painel = montar_painel(oc, areas, periodos)
    geo = features_celulas(areas, carregar_grupo("estacao"), carregar_grupo("delegacia"))
    horario = pd.read_csv(baixar_clima(f"{periodos[0][:4]}-01-01", f"{periodos[-1][:4]}-12-31"))
    clima = agregar_clima(horario)

    urbano = None
    if usar_extras:
        distritos = carregar_distritos(DIR_BRUTOS / "geosampa" / "geoportal_distrito_municipal.geojson")
        populacao = carregar_populacao(DIR_BRUTOS / "ibge" / "populacao_distritos_2022.csv")
        urbano = features_urbanas(areas, distritos, densidade_populacional(distritos, populacao),
                                  contar_iluminacao(carregar_iluminacao(
                                      DIR_BRUTOS / "geosampa" / "iluminacao_publica_pontos.csv")))

    ds = montar_dataset(painel, geo, clima, inicio_teste, urbano)
    info = {
        "resumo_ssp": resumo_ssp,
        "periodos": periodos,
        "inicio_teste": inicio_teste,
        "n_areas": len(areas),
        "n_treino": len(ds.X_treino),
        "n_teste": len(ds.X_teste),
        "cortes": ds.cortes,
        "contagem_treino": painel.loc[painel["periodo"] < inicio_teste, "contagem"].to_numpy(),
        "periodo_previsto": proximo_periodo(periodos[-1]),
    }
    print(f"treino: {info['n_treino']:,} linhas; teste: {info['n_teste']:,}; cortes de classe: {ds.cortes}".replace(",", "."))
    return ds, info
