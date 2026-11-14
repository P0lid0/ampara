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
