"""Detector de PII proprio da Ponte Policia.

Modulo puro: percorre um payload JSON e informa ONDE ha dado pessoal e de que
classe, sem nunca devolver o valor encontrado (o resultado vai para log/erro).
"""
import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class AchadoPii:
    campo: str
    classe: str  # "Cpf" | "Email" | "Telefone" | "Imei" | "Nome"


_UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_DATA_ISO = re.compile(
    r"^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$"
)
_AREA_ID = re.compile(r"^(g\d{3}_\d{3}|fora)$")

_CHAVES = {
    "cpf": "Cpf",
    "email": "Email",
    "e_mail": "Email",
    "telefone": "Telefone",
    "celular": "Telefone",
    "fone": "Telefone",
    "imei": "Imei",
    "nome": "Nome",
    "nome_completo": "Nome",
    "name": "Nome",
    "vitima": "Nome",
    "proprietario": "Nome",
    "cidadao": "Nome",
}

_CANDIDATO = re.compile(r"(?<!\d)\d[\d.\-\s()+]{8,20}\d(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_NOME_TEXTO = re.compile(
    r"(?i:\bmeu nome é|\bme chamo|\bsr\.|\bsra\.|\bdona\b|\bsenhor\b|\bsenhora\b)\s+[A-ZÀ-Ý]"
)

_DDDS = frozenset(
    [11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28]
    + [31, 32, 33, 34, 35, 37, 38]
    + list(range(41, 50))
    + [51, 53, 54, 55]
    + list(range(61, 70))
    + [71, 73, 74, 75, 77, 79]
    + list(range(81, 90))
    + list(range(91, 100))
)


def luhn_valido(digitos: str) -> bool:
    if not digitos or not digitos.isdigit():
        return False
    soma = 0
    for i, c in enumerate(reversed(digitos)):
        d = int(c)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        soma += d
    return soma % 10 == 0


def cpf_valido(digitos: str) -> bool:
    if len(digitos) != 11 or not digitos.isdigit() or len(set(digitos)) == 1:
        return False
    for n in (9, 10):
        soma = sum(int(digitos[i]) * (n + 1 - i) for i in range(n))
        dv = (soma * 10) % 11 % 10
        if dv != int(digitos[n]):
            return False
    return True


def _telefone(d: str) -> bool:
    if len(d) in (11, 12) and d.startswith("0"):  # zero de tronco: 011 91234-5678
        d = d[1:]
    if len(d) in (12, 13) and d.startswith("55"):
        d = d[2:]
    if len(d) == 11:
        ok = d[2] == "9"
    elif len(d) == 10:
        ok = d[2] in "2345"
    else:
        return False
    return ok and int(d[:2]) in _DDDS


def _estruturado(s: str) -> bool:
    return bool(_UUID.match(s) or _HEX64.match(s) or _DATA_ISO.match(s) or _AREA_ID.match(s))


def _classe_numerica(d: str) -> str | None:
    if len(d) == 15 and luhn_valido(d):
        return "Imei"
    if len(d) == 11 and cpf_valido(d):
        return "Cpf"
    if _telefone(d):
        return "Telefone"
    return None


def _classe_do_candidato(cand: str) -> str | None:
    """Classifica o candidato inteiro; se falhar, tenta janelas de grupos
    separados por espaco (longas primeiro), para nao perder um telefone
    colado a numeros vizinhos ("apto 12 11 91234-5678")."""
    achada = _classe_numerica(re.sub(r"\D", "", cand))
    if achada:
        return achada
    grupos = cand.split()
    n = len(grupos)
    for tam in range(n - 1, 0, -1):
        for ini in range(n - tam + 1):
            achada = _classe_numerica(re.sub(r"\D", "", " ".join(grupos[ini:ini + tam])))
            if achada:
                return achada
    return None


def _classes_do_valor(s: str) -> list[str]:
    if _estruturado(s):
        return []
    classes: list[str] = []
    for m in _CANDIDATO.finditer(s):
        achada = _classe_do_candidato(m.group(0))
        if achada:
            classes.append(achada)
    if _EMAIL.search(s):
        classes.append("Email")
    if _NOME_TEXTO.search(s):
        classes.append("Nome")
    return classes


_CHAVE_SEGURA = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,39}$")
_PROFUNDIDADE_MAX = 32


def _norm_chave(k: str) -> str:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFKD", k) if not unicodedata.combining(c)
    )
    return re.sub(r"[\s\-]+", "_", sem_acento.strip().lower())


def _chave_segura(k: str) -> bool:
    """Chave que pode aparecer no caminho: so identificador curto, sem sequencia
    longa de digitos e sem PII. A chave e controlada pelo remetente."""
    return (
        bool(_CHAVE_SEGURA.match(k))
        and not re.search(r"\d{6,}", k)
        and len(re.findall(r"\d", k)) <= 4
        and not _classes_do_valor(k.replace("_", " "))
        and not _classes_do_valor(k)
    )


def detectar_pii(dados: object) -> list[AchadoPii]:
    """Levanta ValueError se o payload passar de _PROFUNDIDADE_MAX niveis."""
    achados: list[AchadoPii] = []
    vistos: set[tuple[str, str]] = set()

    def add(campo: str, classe: str) -> None:
        if (campo, classe) not in vistos:
            vistos.add((campo, classe))
            achados.append(AchadoPii(campo, classe))

    def vazio(v: object) -> bool:
        return v is None or (isinstance(v, str) and not v.strip())

    def visitar(v: object, caminho: str, chave: str | None, herdada: str | None, nivel: int) -> None:
        if nivel > _PROFUNDIDADE_MAX:
            raise ValueError("payload aninhado demais")
        classe_chave = _CHAVES.get(_norm_chave(chave)) if chave is not None else None
        classe_chave = classe_chave or herdada
        if isinstance(v, dict):
            for k, sub in v.items():
                ks = str(k)
                if _chave_segura(ks):
                    seg = ks
                else:
                    seg = "<chave>"
                    for c in _classes_do_valor(ks):
                        add(f"{caminho}.{seg}" if caminho else seg, c)
                visitar(sub, f"{caminho}.{seg}" if caminho else seg, ks, classe_chave, nivel + 1)
            return
        if isinstance(v, (list, tuple)):
            for i, sub in enumerate(v):
                visitar(sub, f"{caminho}[{i}]", chave, classe_chave, nivel + 1)
            return
        if isinstance(v, bool) or isinstance(v, float) or vazio(v):
            return
        if not isinstance(v, (str, int)):
            return
        if classe_chave:
            add(caminho, classe_chave)
        for classe in _classes_do_valor(str(v)):
            add(caminho, classe)

    visitar(dados, "", None, None, 0)
    return achados
