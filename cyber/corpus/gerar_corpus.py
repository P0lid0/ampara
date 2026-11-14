"""Gera cyber/corpus/corpus.csv, o corpus sintetico de PII do Ampara.

SINTETICO: todo CPF, IMEI, telefone, e-mail, placa, RG e senha aqui nasce de um gerador com semente fixa (42).
Nenhum dado pessoal real. Saida deterministica: rodar de novo produz o mesmo arquivo.

Uso: python cyber/corpus/gerar_corpus.py
Colunas: id,chave,valor,esperado   (esperado = classes separadas por '|'; vazio = negativo)
"""
import base64
import csv
import hashlib
import json
import random
import uuid
from pathlib import Path

SEMENTE = 42
rng = random.Random(SEMENTE)
ZWSP = chr(0x200B)
NBSP = chr(0x00A0)

linhas = []  # (chave, valor, esperado)


def add(chave, valor, esperado=""):
    linhas.append((chave, valor, esperado))


def digitos(n):
    return "".join(rng.choice("0123456789") for _ in range(n))


# ---- geradores sinteticos ------------------------------------------------------------------------------------

def dv_cpf(base):
    for n in (9, 10):
        soma = sum(int(base[i]) * (n + 1 - i) for i in range(n))
        r = soma * 10 % 11
        base += str(0 if r == 10 else r)
    return base


def cpf_valido():
    while True:
        b = digitos(9)
        if len(set(b)) > 1:
            return dv_cpf(b)


def cpf_valido_ou_none(c):
    return len(c) == 11 and len(set(c)) > 1 and dv_cpf(c[:9]) == c


def cpf_fmt(c):
    return f"{c[:3]}.{c[3:6]}.{c[6:9]}-{c[9:]}"


def cpf_invalido(terceiro_nao_nove=False):
    while True:
        c = digitos(11)
        if cpf_valido_ou_none(c) or len(set(c)) == 1:
            continue
        if terceiro_nao_nove and c[2] == "9":
            continue
        return c


def luhn_dv(corpo):
    soma = 0
    for i, ch in enumerate(reversed(corpo)):
        d = int(ch)
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        soma += d
    return str((10 - soma % 10) % 10)


def imei_valido():
    corpo = digitos(14)
    return corpo + luhn_dv(corpo)


def imei_invalido():
    v = imei_valido()
    return v[:14] + str((int(v[14]) + rng.randint(1, 9)) % 10)


def telefone_celular():
    while True:
        ddd = rng.randint(11, 99)
        num = "9" + digitos(8)
        d = f"{ddd}{num}"
        if not cpf_valido_ou_none(d):
            return str(ddd), num


def telefones_formatados():
    ddd, n = telefone_celular()
    return [
        f"({ddd}) {n[:5]}-{n[5:]}",
        f"+55 {ddd} {n[:5]}-{n[5:]}",
        f"{ddd} {n[:5]}-{n[5:]}",
        f"({ddd}){n[:5]}-{n[5:]}",
        f"+55 ({ddd}) {n[:5]} {n[5:]}",
        f"({ddd}) {rng.choice('2345')}{digitos(3)}-{digitos(4)}",
    ]


NOMES = ["ana.souza", "joao_lima", "maria.s", "pedro.h", "lucia-m", "carla.dias", "rafael99", "bia.santos"]
DOMINIOS = ["exemplo.com", "teste.org", "mail.exemplo.com.br", "ampara.test", "dominio.com.br"]


def email():
    return f"{rng.choice(NOMES)}@{rng.choice(DOMINIOS)}"


def placa_mercosul():
    return "".join(rng.choice("ABCDEFGHJKLMNPRSTUVXZ") for _ in range(3)) + digitos(1) + rng.choice("ABCDEFGHJ") + digitos(2)


def placa_antiga():
    return "".join(rng.choice("ABCDEFGHJKLMNPRSTUVXZ") for _ in range(3)) + digitos(4)


def rg_fmt():
    return f"{digitos(2)}.{digitos(3)}.{digitos(3)}-{rng.choice('0123456789X')}"


def segredo():
    return rng.choice(["Abc12345!", "s3nh4Forte", "Qwerty#2026", "tr0ca-ja", "Zx9!kLm2", "minhaSenha77", "p4ssw0rd?"])


CHAVES_NEUTRAS = ["texto", "observacao", "descricao", "mensagem", "campo", "id", "codigo", "protocolo", "valor", "detalhe"]


def neutra():
    return rng.choice(CHAVES_NEUTRAS)


def frase(modelos, valor):
    return rng.choice(modelos).format(v=valor)


# ---- positivos -----------------------------------------------------------------------------------------------

FR_CPF = ["meu cpf e {v}, pode confirmar?", "CPF: {v}", "titular {v} ligou hoje", "documento do titular: {v}.",
          "registrar o cpf {v} no atendimento", "o numero {v} pertence ao pai"]
for _ in range(6):
    add(neutra(), cpf_fmt(cpf_valido()), "Cpf")
for _ in range(5):
    add(neutra(), cpf_valido(), "Cpf")
for _ in range(6):
    v = cpf_valido()
    add(neutra(), frase(FR_CPF, rng.choice([cpf_fmt(v), v])), "Cpf")
for ch in ["cpf", "documento", "CPF_Titular", "cpfUsuario", "documento_fiscal", "Documento"]:
    add(ch, rng.choice(["***.456.***-00", "nao informado", "12345"]), "Cpf")
fw = str.maketrans("0123456789", "".join(chr(0xFF10 + i) for i in range(10)))
v = cpf_valido()
add(neutra(), cpf_fmt(v).translate(fw), "Cpf")
add(neutra(), "cpf " + v.translate(fw), "Cpf")
v = cpf_valido()
add(neutra(), v[:3] + ZWSP + "." + v[3:6] + "." + v[6:9] + "-" + v[9:], "Cpf")
v = cpf_valido()
add(neutra(), f"{v[:3]}{NBSP}{v[3:6]}{NBSP}{v[6:9]}{NBSP}{v[9:]}", "Cpf")

FR_IMEI = ["roubaram o aparelho, imei {v}", "IMEI: {v}", "o chaveiro esta no celular de imei {v}.",
           "numero de serie {v} informado no BO"]
for _ in range(4):
    v = imei_valido()
    add(neutra(), f"{v[:2]}-{v[2:8]}-{v[8:14]}-{v[14]}", "Imei")
for _ in range(2):
    v = imei_valido()
    add(neutra(), f"{v[:8]} {v[8:14]} {v[14]}", "Imei")
for _ in range(7):
    add(neutra(), imei_valido(), "Imei")
for _ in range(5):
    add(neutra(), frase(FR_IMEI, imei_valido()), "Imei")
for ch in ["imei", "IMEI", "imei_aparelho", "ImeiCifrado", "imeiOriginal"]:
    add(ch, rng.choice(["3569", "enc:v1:abc", "desconhecido"]), "Imei")

FR_TEL = ["me liga no {v} depois das 18h", "telefone para contato: {v}", "WhatsApp {v}.", "o numero e {v}, fale com a Ana",
          "ligar para {v}"]
for _ in range(8):
    add(neutra(), rng.choice(telefones_formatados()), "Telefone")
for _ in range(5):
    ddd, n = telefone_celular()
    add(neutra(), ddd + n, "Telefone")
for _ in range(5):
    add(neutra(), frase(FR_TEL, rng.choice(telefones_formatados())), "Telefone")
for ch in ["telefone", "celular", "fone", "whatsapp", "telefone_contato", "foneResidencial"]:
    add(ch, rng.choice(["1140028922", "sem numero", "n/d"]), "Telefone")

FR_RG = ["RG {v}", "identidade numero {v}", "meu rg e {v} e preciso corrigir", "registro geral {v}."]
for _ in range(8):
    add(neutra(), rg_fmt(), "Rg")
for _ in range(5):
    add(neutra(), frase(FR_RG, rg_fmt()), "Rg")
for ch, val in [("rg", "123456789"), ("RG", "MG-12.345.678"), ("identidade", "1234567"), ("rg", "SSP 998877"),
                ("identidade", "N/D"), ("rg", "12345678X"), ("identidade", "9876543")]:
    add(ch, val, "Rg")

FR_EMAIL = ["escreva para {v} com o comprovante", "email: {v}", "contato {v}.", "meu e-mail e {v}, obrigado"]
for _ in range(8):
    add(neutra(), email(), "Email")
for _ in range(6):
    add(neutra(), frase(FR_EMAIL, email()), "Email")
for ch in ["email", "Email", "email_contato", "emailPrincipal", "e-mail", "E_Mail"]:
    add(ch, rng.choice(["ana", "sem email", "n/d"]), "Email")

FR_PLACA = ["o carro de placa {v} estava parado", "placa {v}", "veiculo {v}.", "anotei {v} do carro suspeito"]
for _ in range(6):
    add(neutra(), placa_mercosul(), "Placa")
for _ in range(4):
    v = placa_antiga()
    add(neutra(), v[:3] + "-" + v[3:], "Placa")
for _ in range(3):
    add(neutra(), placa_antiga(), "Placa")
for _ in range(5):
    add(neutra(), frase(FR_PLACA, rng.choice([placa_mercosul(), placa_antiga()])), "Placa")
for ch in ["placa", "Placa", "placa_veiculo", "placaMoto"]:
    add(ch, rng.choice(["ABC", "sem placa", "n/d"]), "Placa")

for _ in range(6):
    add(neutra(), f"senha: {segredo()}", "Senha")
for _ in range(4):
    add(neutra(), f"password={segredo()}", "Senha")
add(neutra(), f"pwd: {segredo()}", "Senha")
add(neutra(), f"SENHA = {segredo()}", "Senha")
add(neutra(), f"minha senha é {segredo()}", "Senha")
add(neutra(), f"login ana, senha:{segredo()} (nao compartilhar)", "Senha")
for ch, val in [("senha", "x"), ("password", "abc"), ("Authorization", "Bearer abc.def"), ("cookie", "sid=abc"),
                ("X-Chave-Servico", "chave"), ("palavraSecreta", "lua"), ("xApiKey", "k"), ("segredo", "s"),
                ("passwd", "p"), ("pwd", "p"), ("X-Chave-Policia", "chave")]:
    add(ch, val, "Senha")

FR_SAUDE = ["o laudo do medico saiu ontem", "paciente com diagnostico de diabetes", "preciso do prontuario dele",
            "apresentou atestado medico por 3 dias", "sofre de depressão há anos", "tratamento oncologico em andamento",
            "tem hipertensão e ansiedade", "internacao de 5 dias", "receita medica anexada", "resultado de HIV positivo",
            "fez acompanhamento psiquiátrico", "historico de esquizofrenia na familia", "diagnóstico de câncer"]
for f in FR_SAUDE:
    add(neutra(), f, "Saude")
for c in ["CID F32", "CID-F32", "cid z00", "diagnostico CID A15 confirmado", "CIDJ45"]:
    add(neutra(), c, "Saude")
for ch, val in [("laudo", "ok"), ("diagnostico", "n/d"), ("saude", "regular"), ("cid", "F32"), ("prontuario", "123"),
                ("medicamento", "A"), ("doenca", "sim"), ("Diagnóstico", "x")]:
    add(ch, val, "Saude")

# varias classes numa linha
for _ in range(2):
    add(neutra(), f"cpf {cpf_fmt(cpf_valido())} e email {email()}", "Cpf|Email")
add(neutra(), f"ligue {rng.choice(telefones_formatados())}, carro placa {placa_mercosul()}", "Telefone|Placa")
add(neutra(), f"imei {imei_valido()} do paciente com laudo", "Imei|Saude")
add(neutra(), f"RG {rg_fmt()} senha: {segredo()}", "Rg|Senha")
add(neutra(), f"{email()} / {cpf_valido()} / {rng.choice(telefones_formatados())}", "Email|Cpf|Telefone")
add("telefone", f"{email()}", "Telefone|Email")

# ---- negativos -----------------------------------------------------------------------------------------------
# neutros e dificeis: nada aqui deve ser detectado.

for _ in range(8):
    add("lat", f"-23.{digitos(7)}")
    add("lng", f"-46.{digitos(7)}")
for _ in range(4):
    add("latitude", f"-23.{digitos(11)}")
    add("longitude", f"-46.{digitos(11)}")
for _ in range(8):
    add("ts", f"2026-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}T{rng.randint(0, 23):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}Z")
for _ in range(8):
    add("id", str(uuid.UUID(int=rng.getrandbits(128), version=4)))
for _ in range(5):
    cab = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    cor = base64.urlsafe_b64encode(json.dumps({"sub": digitos(11), "n": digitos(6)}).encode()).decode().rstrip("=")
    assi = base64.urlsafe_b64encode(hashlib.sha256(digitos(8).encode()).digest()).decode().rstrip("=")
    add("jwt", f"{cab}.{cor}.{assi}")
for _ in range(6):
    add("hash", hashlib.sha256(digitos(12).encode()).hexdigest())
for _ in range(2):
    add("hash", hashlib.md5(digitos(12).encode()).hexdigest())
for _ in range(8):
    add(neutra(), cpf_fmt(cpf_invalido()))
for _ in range(4):
    add(neutra(), cpf_invalido(terceiro_nao_nove=True))
add(neutra(), "111.111.111-11")
add(neutra(), "00000000000")
for _ in range(4):
    add(neutra(), digitos(14))
for ch, v in [("cartao", "4111111111111111"), ("cartao", "5555555555554444"), ("cartao", "4111 1111 1111 1111"),
              ("cartao", "6011111111111117")]:
    add(ch, v)
for _ in range(4):
    add(neutra(), digitos(rng.choice([12, 13])))
for _ in range(3):
    add(neutra(), digitos(rng.choice([8, 9])))
for _ in range(4):
    add("serie", imei_invalido())
for _ in range(4):
    b = digitos(8) + "0001"
    soma1 = sum(int(b[i]) * ([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2][i]) for i in range(12))
    d1 = 0 if soma1 % 11 < 2 else 11 - soma1 % 11
    b += str(d1)
    soma2 = sum(int(b[i]) * ([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2][i]) for i in range(13))
    d2 = 0 if soma2 % 11 < 2 else 11 - soma2 % 11
    b += str(d2)
    add("cnpj", f"{b[:2]}.{b[2:5]}.{b[5:8]}/{b[8:12]}-{b[12:]}")
add("cnpj", "11.222.333/0001-81")
for _ in range(4):
    add("cep", f"{digitos(5)}-{digitos(3)}")
add("cep", "01310-100")
for _ in range(4):
    add("valor", f"R$ {rng.randint(1, 99)}.{digitos(3)},{digitos(2)}")
add("valor", "R$ 1.234,56")
for v in ["1.2.3", "v2.14.7", "3.11.4", "10.0.2"]:
    add("versao", v)
for _ in range(4):
    add("protocolo", f"PP-2026-{rng.randint(1, 999999):06d}")
for _ in range(4):
    add("chaveiro", f"chaveiro-ampara-{digitos(2)}{rng.choice('abcdef')}{digitos(1)}{rng.choice('abcdef')}{digitos(1)}")
for _ in range(3):
    add("device", f"g{digitos(3)}_{digitos(3)}")
add("device", "g051_026")
for _ in range(4):
    add("convite", "".join(rng.choice("ABCDEFGHJKMNPQRSTUVWXYZ23456789") for _ in range(6)))
add("convite", "K7M2QX")
for v in ["saúde", "Saúde", "saude", "SAÚDE"]:
    add(neutra(), v)
add("titulo", "Saúde e bem-estar")
for v in ["192.168.0.10", "10.0.0.254", "127.0.0.1"]:
    add("ip", v)
for _ in range(3):
    add("ts", str(rng.randint(1700000000, 1799999999)))
    add("ts", str(rng.randint(1700000000000, 1799999999999)))
for v in ["14/11/2026 as 10h30", "15/11/2026", "12:45:10", "ate 17h", "dia 14"]:
    add("data", v)
for v in ["Obrigado pelo atendimento", "esqueci minha senha", "Rua das Flores, 123, apto 45", "chaveiro perdido perto do metro",
          "o aparelho tocou por 10 minutos", "preciso de ajuda urgente", "Av. Paulista, 1578 - Bela Vista",
          "alerta de proximidade sem som", "bateria em 15%", "sinal fraco no bairro", "nao consegui logar no app",
          "o codigo de emergencia nao funcionou", "recebi o aviso as 14h", "bom dia, tudo bem?", "ok",
          "temperatura 36.5 graus", "12 pessoas na fila", "pedido numero 4521", "fila 100 200 300 40",
          "a receita do bolo estava otima", "laudos"]:
    add(neutra(), v)
add("descricao", "tratamento de dados conforme a lei")

# ---- saida ---------------------------------------------------------------------------------------------------

destino = Path(__file__).resolve().parent / "corpus.csv"
with open(destino, "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["id", "chave", "valor", "esperado"])
    for i, (chave, valor, esperado) in enumerate(linhas, 1):
        w.writerow([f"c{i:03d}", chave, valor, esperado])

pos = sum(1 for _, _, e in linhas if e)
print(f"{destino}: {len(linhas)} linhas ({pos} positivas, {len(linhas) - pos} negativas)")
