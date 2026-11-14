import pytest
from app.pii import detectar_pii, AchadoPii, cpf_valido, luhn_valido

def A(campo, classe): return AchadoPii(campo, classe)

@pytest.mark.parametrize("valor", ["529.982.247-25", "52998224725", "cpf 529.982.247-25 ok"])
def test_cpf_valido_e_detectado(valor):
    assert detectar_pii({"obs": valor}) == [A("obs", "Cpf")]

@pytest.mark.parametrize("valor", ["111.111.111-11", "123.456.789-00", "52998224726"])
def test_cpf_com_digito_errado_nao_e_cpf(valor):
    assert detectar_pii({"obs": valor}) == []

@pytest.mark.parametrize("valor", ["(11) 91234-5678", "11912345678", "+55 11 91234-5678", "(11) 3456-7890"])
def test_telefone_detectado(valor):
    assert detectar_pii({"obs": valor}) == [A("obs", "Telefone")]

def test_imei_luhn_valido_detectado_e_invalido_nao():
    assert detectar_pii({"x": "490154203237518"}) == [A("x", "Imei")]
    assert detectar_pii({"x": "49-015420-323751-8"}) == [A("x", "Imei")]
    assert detectar_pii({"x": "490154203237519"}) == []
    assert luhn_valido("490154203237518") and not luhn_valido("490154203237519")
    assert cpf_valido("52998224725") and not cpf_valido("11111111111")

def test_imei_numero_json():
    assert A("imei", "Imei") in detectar_pii({"imei": 490154203237518})

def test_email_detectado():
    assert detectar_pii({"area_id": "fulano@exemplo.com"}) == [A("area_id", "Email")]

@pytest.mark.parametrize("chave", ["nome", "nome_completo", "vitima", "Proprietario"])
def test_nome_por_chave(chave):
    assert detectar_pii({chave: "Maria Souza"}) == [A(chave, "Nome")]

@pytest.mark.parametrize("texto", ["Meu nome é Maria Souza", "me chamo Joao", "falar com Sra. Ana"])
def test_nome_em_texto_livre(texto):
    assert detectar_pii({"mensagem": texto}) == [A("mensagem", "Nome")]

def test_chave_pii_com_valor_vazio_nao_conta():
    assert detectar_pii({"cpf": "", "nome": None}) == []

def test_percorre_listas_e_objetos_aninhados():
    dados = {"trilha": [{"lat": -23.5, "lng": -46.7, "em": "2026-11-16T10:00:00Z", "obs": "liga 11 91234-5678"}]}
    assert detectar_pii(dados) == [A("trilha[0].obs", "Telefone")]

def test_payload_legitimo_da_api_nao_tem_achados():
    ok = {"origem_id": "3f2b8c1e-5a4d-4e7b-9c1a-0d2e4f6a8b10", "area_id": "g051_026",
          "ts": "2026-11-16T11:30:00Z", "tipo": "roubo_celular", "origem_gatilho": "chaveiro",
          "device_hash": "a" * 64,
          "trilha": [{"lat": -23.5672490, "lng": -46.7019515, "em": "2026-11-16T11:31:00-03:00"}]}
    assert detectar_pii(ok) == []

def test_hash_e_uuid_com_digitos_seguidos_nao_geram_falso_positivo():          # Review Focus 2
    h_cpf = "52998224725" + "a" * 53
    h_imei = "490154203237518" + "b" * 49
    u = "12345678-9012-4345-8789-012345678901"
    assert detectar_pii({"device_hash": h_cpf, "origem_id": u}) == []
    assert detectar_pii({"device_hash": h_imei}) == []

def test_resultado_nunca_contem_o_valor():
    achados = detectar_pii({"obs": "529.982.247-25"})
    assert "529" not in repr(achados)
