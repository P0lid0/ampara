import itertools, pytest
from app.dominio import (StatusOcorrencia as S, TipoOcorrencia, OrigemGatilho, pode_transitar,
                         MENSAGEM_PADRAO_RECEBIDA)

PERMITIDAS = {(S.RECEBIDA, S.EM_ANALISE), (S.EM_ANALISE, S.ATENDIDA), (S.EM_ANALISE, S.DESCARTADA)}

@pytest.mark.parametrize("de,para", list(itertools.product(S, S)))
def test_matriz_de_transicoes(de, para):
    assert pode_transitar(de, para) is ((de, para) in PERMITIDAS)

def test_valores_dos_enums_seguem_os_contratos():
    assert [s.value for s in S] == ["recebida", "em_analise", "atendida", "descartada"]
    assert [t.value for t in TipoOcorrencia] == ["roubo_celular", "furto_celular"]
    assert [o.value for o in OrigemGatilho] == ["chaveiro", "web", "guardiao", "impacto"]
    assert MENSAGEM_PADRAO_RECEBIDA == "Ocorrência recebida pela polícia."


def test_transicoes_cobre_todos_os_status_e_bate_com_pode_transitar():
    from app.dominio import TRANSICOES
    assert set(TRANSICOES) == set(S)
    assert {(d, p) for d, ps in TRANSICOES.items() for p in ps} == PERMITIDAS


def test_erros_de_dominio_carregam_os_atributos_sem_dado_pessoal():
    from app.dominio import ErroDeDominio, ErroTransicaoInvalida, OcorrenciaNaoEncontrada
    e = ErroTransicaoInvalida(S.ATENDIDA, S.RECEBIDA)
    assert isinstance(e, ErroDeDominio) and e.de == S.ATENDIDA and e.para == S.RECEBIDA
    n = OcorrenciaNaoEncontrada("PP-123")
    assert isinstance(n, ErroDeDominio) and n.protocolo == "PP-123"


def test_hotspot_e_imutavel():
    import dataclasses
    from app.dominio import Hotspot
    h = Hotspot("g051_026", -23.5, -46.7, 3, "alto")
    with pytest.raises(dataclasses.FrozenInstanceError):
        h.total = 4
