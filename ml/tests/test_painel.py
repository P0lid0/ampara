import numpy as np
import pandas as pd

from ampara_ml.painel import montar_painel, periodos_completos, selecionar_areas

PER = ["2024T1", "2024T2", "2024T3", "2024T4", "2025T1"]


def _slot(p):
    return p[(p.dia_semana == 0) & (p.faixa == 2)].set_index("periodo")


def test_defasagens(oc_sintetico):
    p = montar_painel(oc_sintetico, ["g001_001"], PER)
    s = _slot(p)
    assert s.index.tolist() == ["2024T2", "2024T3", "2024T4", "2025T1", "2025T2"]
    assert s.cont_ant_1.tolist() == [1, 2, 3, 4, 10]
    assert s.cont_ant_4.tolist() == [1.0, 1.5, 2.0, 2.5, 4.75]
    assert s.contagem.iloc[:4].tolist() == [2, 3, 4, 10] and np.isnan(s.contagem.iloc[4])


def test_area_ant_4_usa_todos_os_slots(oc_sintetico):
    s = _slot(montar_painel(oc_sintetico, ["g001_001"], PER))
    assert s.area_ant_4.loc["2024T2"] == 7.0 and s.area_ant_4.loc["2025T1"] == 4.0


def test_produto_completo_com_zeros(oc_sintetico):
    p = montar_painel(oc_sintetico, ["g001_001"], PER)
    assert len(p) == 56 * 5 and (p.loc[p.periodo == "2024T2", "contagem"] >= 0).all()
    assert p.columns.tolist() == ["area_id", "periodo", "ano", "trimestre", "dia_semana", "faixa",
                                  "contagem", "cont_ant_1", "cont_ant_4", "area_ant_4"]
    ordem = p.sort_values(["periodo", "area_id", "dia_semana", "faixa"], kind="stable")
    assert ordem.index.equals(p.index)


def test_features_nao_enxergam_o_proprio_alvo(oc_sintetico):
    extra = pd.concat([oc_sintetico, oc_sintetico[oc_sintetico.data == "2025-01-06"].iloc[[0] * 50]])
    a, b = (montar_painel(x, ["g001_001"], PER) for x in (oc_sintetico, extra))
    cols = ["cont_ant_1", "cont_ant_4", "area_ant_4"]
    ate = a.periodo <= "2025T1"
    pd.testing.assert_frame_equal(a.loc[ate, cols], b.loc[ate, cols])
    assert not a.loc[a.periodo == "2025T1", "contagem"].equals(b.loc[b.periodo == "2025T1", "contagem"])


def test_sem_futuro(oc_sintetico):
    p = montar_painel(oc_sintetico, ["g001_001"], PER, incluir_futuro=False)
    assert not p["contagem"].isna().any()
    assert p["periodo"].nunique() == 4


def test_ignora_areas_e_periodos_fora(oc_sintetico):
    fora = oc_sintetico.assign(area_id="g009_009")
    p = montar_painel(pd.concat([oc_sintetico, fora]), ["g001_001"], PER[:3], incluir_futuro=False)
    assert set(p.area_id) == {"g001_001"} and p.periodo.max() == "2024T3"
    assert p.contagem.sum() == 2 + 3


def test_selecionar_areas():
    d = pd.Timestamp("2024-01-01")
    oc = pd.DataFrame({"data": [d] * 44, "hora": 1,
                       "area_id": ["g001_001"] * 25 + ["g001_002"] * 19})
    assert selecionar_areas(oc, min_ocorrencias=20) == ["g001_001"]


def test_periodos_completos_descarta_parcial():
    d = pd.Series(pd.date_range("2024-01-01", "2025-02-10"))
    assert periodos_completos(d) == ["2024T1", "2024T2", "2024T3", "2024T4"]
    d2 = pd.Series(pd.date_range("2024-01-01", "2025-03-28"))
    assert periodos_completos(d2)[-1] == "2025T1"
