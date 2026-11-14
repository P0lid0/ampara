# Ponte Polícia (Python/FastAPI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Ponte Polícia: serviço FastAPI que recebe ocorrências minimizadas do Ampara (idempotente, sem PII), calcula pontos quentes, devolve o andamento ao cidadão e oferece um painel HTML `/policia` para a polícia (simulada) ver hotspots e mudar o status.

**Architecture:** Camadas `routers → services → repositories → models`, com `schemas` (Pydantic) nas bordas e o domínio (estados, regras) em `dominio.py` e nos métodos de `models.py`. Banco próprio `ponte` (PostgreSQL local) via SQLAlchemy 2 + psycopg 3, esquema versionado por Alembic. Os testes unitários rodam em SQLite em memória; um teste marcado `postgres` prova as migrações no PostgreSQL real. Hotspot é um objeto de leitura calculado na hora (sem tabela, não fica velho).

**Tech Stack:** Python 3.13, FastAPI, Uvicorn, SQLAlchemy 2, psycopg 3 (`psycopg[binary]`), Alembic, Jinja2, Leaflet (CDN, igual ao plano 05), pytest + httpx.

**Spec:** `docs/superpowers/specs/2026-11-14-ampara-design.md` (seções 6.1 linha Ponte, 7.2, 9, 11) e contratos em `docs/superpowers/plans/2026-11-14-00-indice-e-contratos.md` (**fonte única** de rotas, nomes, formatos, variáveis e portas; vence em divergência). Briefing: PDF p.27 (SOA e Web Services).

**Ordem e tempo (segunda 16/11):** T1–T4 manhã (~3 h), T5–T8 tarde (~3 h), T9 se sobrar tempo (P2), T10 fecha o dia ou terça de manhã. Cada tarefa termina verde e commitada.

## Global Constraints

- Ponte = "FastAPI + SQLAlchemy + Alembic, banco `ponte`; camadas routers/services/repositories/schemas; pytest (unitário + contrato)" (spec 6.1). Pasta do código: `ponte-policia/` na raiz do monorepo.
- Estados da ocorrência: `recebida → em_analise → atendida/descartada`; idempotência pelo identificador de origem (nos contratos: `origem_id`); "Regras: rejeita payload com PII; só aceita chamadas com chave de serviço" (spec 7.2).
- Rotas, campos, enums e códigos exatamente como na seção "Ponte Polícia — rotas" do arquivo de contratos: `GET /health`, `POST /ocorrencias`, `GET /ocorrencias?status=` (rodada 2: lista para o painel), `GET /ocorrencias/{protocolo}/retorno`, `PATCH /ocorrencias/{protocolo}/status`, `GET /hotspots?janela_min=60`, `GET /policia`. Protocolo no formato `PP-2026-000001`. Nenhuma outra rota ou campo novo. Datas em ISO-8601 UTC com `Z`. Erros: chave ausente ou errada 401; protocolo inexistente 404; transição inválida 409; PII 422 `{detail, achados: [{campo, classe}]}` (a Ponte também detecta `Nome`, classe só dela).
- `device_hash = sha256(deviceId + PONTE_CHAVE_SERVICO)` em hex minúsculo (64 caracteres), calculado pela API. Área = grade de ~500 m dos contratos (mesma função do C#): `area_id(-23.5672490, -46.7019515) == "g051_026"`.
- Cabeçalhos: `X-Chave-Servico` (API → Ponte) e `X-Chave-Policia` (papel polícia). Variáveis: `PONTE_DB` (`postgresql+psycopg://ponte:...@localhost:5432/ponte`), `PONTE_CHAVE_SERVICO`, `PONTE_CHAVE_POLICIA`, porta 8000. Atrás do nginx (plano 07): `location /ponte/` → Ponte; `location /policia` → Ponte com `proxy_set_header X-Forwarded-Prefix /ponte`; o painel monta as URLs com esse prefixo.
- Anti-objetivo da spec: nunca vazar CPF, telefone, IMEI, e-mail ou nome para logs, respostas de erro ou para a Ponte. A Ponte **nunca grava, loga nem ecoa o valor** de um dado pessoal detectado.
- Rubrica SOA (PDF p.27, 10 pts): estruturação do domínio 3,0 · conexão com banco 3,0 · migrações 1,5 · documentação automática (Swagger/OpenAPI) 1,5 · testes automatizados 1,0. Entregáveis: README com instruções de execução, descrição da solução e **nomes dos integrantes** (Pedro e Vitor Cesarino Marchese), documentação dos endpoints, evidências.
- Textos de interface e mensagens em português do Brasil, linguagem simples. Identidade visual do painel: petróleo `#0F4C4A`, esmeralda `#14B88A`, areia `#F4EFE6`, alarme `#E5484D`; fonte Manrope; botões ≥ 48 px; estado nunca só por cor.
- Nada de dado pessoal real: tudo sintético, marcado `# SINTETICO`. Segredos só em variável de ambiente; `.env` no `.gitignore`; `.env.example` sem valores.
- Ambiente: Windows 11 + Git Bash, Python 3.13, PostgreSQL local (sem Docker). Comandos abaixo partem da raiz do repositório; ative o venv com `source ponte-policia/.venv/Scripts/activate`.
- Commits pequenos, só depois de rodar a verificação da tarefa; cada commit inclui o prompt usado em `prompts.md` (raiz).
- Prioridades da spec seção 11: Ponte com painel é **P1**; P2 = demonstração com seed; P3 = nada neste plano.

## Review Focus

Entradas e condições que a spec implica, nenhuma tarefa exercitaria sozinha e que mais provavelmente quebram a demo (cada uma tem seu teste na tarefa dona):

1. **Eco de PII em erro e log.** O 422 padrão do FastAPI devolve o valor enviado (`input`), e um log descuidado grava o corpo. Esperado: respostas de erro e logs sem o valor, só campo e classe. (T4)
2. **Falso positivo de PII em campos estruturados.** Um `device_hash` (64 hex) ou um UUID pode conter 11 dígitos seguidos que parecem CPF/telefone; o payload legítimo da própria API não pode ser recusado. (T3)
3. **Chave não configurada.** Com `PONTE_CHAVE_SERVICO`/`PONTE_CHAVE_POLICIA` vazias ou ausentes, o cabeçalho vazio (ou com acento) não pode autenticar nem causar 500; deve falhar fechado com 401. (T4)
4. **Corrida na idempotência.** Duas entregas simultâneas do mesmo `origem_id` não podem gerar 500 nem dois registros: o perdedor devolve o protocolo do vencedor. (T4)
5. **Janela de tempo e fuso.** `ts` com offset (`-03:00`), borda exata da janela, `janela_min` zero/negativo/absurdo, e ocorrência descartada ou fora da grade no mapa de hotspots. (T6)

---

## Estrutura de arquivos

```
ponte-policia/
  README.md  requirements.txt  requirements-dev.txt  pytest.ini  alembic.ini  .env.example  .gitignore
  alembic/env.py  alembic/script.py.mako  alembic/versions/0001_inicial.py
  app/__init__.py
  app/main.py            create_app(), registra routers e handlers
  app/config.py          Settings lidas do ambiente
  app/db.py              Base, UTCDateTime, get_engine, get_session
  app/dominio.py         enums, TRANSICOES, exceções, Hotspot, mensagem padrão
  app/area.py            area_id / centro / area_valida (grade dos contratos)
  app/models.py          Ocorrencia, TrilhaPosRoubo, Retorno (com comportamento)
  app/pii.py             detectar_pii (CPF, e-mail, telefone, IMEI, nome)
  app/security.py        exigir_chave_servico, exigir_chave_policia, rejeitar_pii
  app/erros.py           handlers (PII, validação sem eco, 404, 409)
  app/deps.py            get_agora, get_ocorrencia_service, get_hotspot_service
  app/schemas.py         contratos Pydantic
  app/repositories/ocorrencia_repository.py
  app/services/ocorrencia_service.py   app/services/hotspot_service.py
  app/routers/health.py  ocorrencias.py  hotspots.py  painel.py
  app/templates/policia.html
  scripts/seed_demo.py   (P2)
  tests/ fabrica.py conftest.py test_dominio.py test_area.py test_modelos.py test_migracao_postgres.py
         test_pii.py test_ocorrencias_api.py test_auth.py test_retorno_status.py test_listagem.py test_hotspots.py
         test_painel.py test_contrato.py test_seed.py  contrato/contrato.json  contrato/exemplo_da_api.json (gravado pelo plano 02)
  evidencias/
```

---

### Task 1: Esqueleto, domínio e área (P1)

**Files:**
- Create: `ponte-policia/requirements.txt`, `ponte-policia/requirements-dev.txt`, `ponte-policia/pytest.ini`, `ponte-policia/.gitignore`, `ponte-policia/.env.example`
- Create: `ponte-policia/app/__init__.py`, `ponte-policia/app/dominio.py`, `ponte-policia/app/area.py`
- Test: `ponte-policia/tests/test_dominio.py`, `ponte-policia/tests/test_area.py`

**Interfaces:**
- Consumes: nada.
- Produces (`app/dominio.py`): `StatusOcorrencia(str, Enum)` = `RECEBIDA="recebida"`, `EM_ANALISE="em_analise"`, `ATENDIDA="atendida"`, `DESCARTADA="descartada"`; `TipoOcorrencia` = `ROUBO_CELULAR="roubo_celular"`, `FURTO_CELULAR="furto_celular"`; `OrigemGatilho` = `CHAVEIRO="chaveiro"`, `WEB="web"`, `GUARDIAO="guardiao"`, `IMPACTO="impacto"`; `TRANSICOES: dict[StatusOcorrencia, frozenset[StatusOcorrencia]]`; `pode_transitar(de, para) -> bool`; `ErroDeDominio(Exception)`, `ErroTransicaoInvalida(ErroDeDominio)` (atributos `de`, `para`), `OcorrenciaNaoEncontrada(ErroDeDominio)` (atributo `protocolo`); `@dataclass(frozen=True) Hotspot(area_id: str, lat: float, lng: float, total: int, risco_previsto: str)`; `MENSAGEM_PADRAO_RECEBIDA = "Ocorrência recebida pela polícia."`.
- Produces (`app/area.py`): `area_id(lat: float, lng: float) -> str`, `centro(area_id: str) -> tuple[float, float] | None`, `area_valida(area_id: str) -> bool`.

- [ ] **Step 1: Preparar o ambiente**

`requirements.txt`: `fastapi>=0.115`, `uvicorn[standard]>=0.32`, `sqlalchemy>=2.0`, `psycopg[binary]>=3.2`, `alembic>=1.14`, `jinja2>=3.1`. `requirements-dev.txt`: `-r requirements.txt`, `pytest>=8`, `httpx>=0.27`. `pytest.ini`: `testpaths = tests`, `pythonpath = .`, marcador `postgres`. `.gitignore`: `.venv/`, `.env`, `__pycache__/`, `.pytest_cache/`. `.env.example`: `PONTE_DB=`, `PONTE_CHAVE_SERVICO=`, `PONTE_CHAVE_POLICIA=`, `PONTE_DB_TEST=` (todas sem valor).
Run: `cd ponte-policia && python -m venv .venv && source .venv/Scripts/activate && pip install -r requirements-dev.txt`
Expected: instala sem erro; `python -c "import fastapi, sqlalchemy, psycopg, alembic, jinja2"` sai com código 0.

- [ ] **Step 2: Escrever os testes que falham**

```python
# tests/test_area.py
import pytest
from app.area import area_id, centro, area_valida

def test_area_id_estacao_pinheiros():
    assert area_id(-23.5672490, -46.7019515) == "g051_026"

def test_area_id_canto_inferior_esquerdo():
    assert area_id(-23.80, -46.83) == "g000_000"

@pytest.mark.parametrize("lat,lng", [(-23.34, -46.60), (-23.90, -46.60), (-23.55, -46.30), (-23.55, -46.90),
                                     (-23.35, -46.60), (-23.55, -46.36)])   # limites superiores são exclusivos (contratos)
def test_fora_dos_limites(lat, lng):
    assert area_id(lat, lng) == "fora"

def test_limite_inferior_e_inclusivo_e_logo_abaixo_do_superior_ainda_e_area():
    assert area_id(-23.80, -46.83) == "g000_000"
    assert area_id(-23.3501, -46.3601) == "g099_095"

def test_centro_de_pinheiros():
    lat, lng = centro("g051_026")
    assert lat == pytest.approx(-23.56825) and lng == pytest.approx(-46.70015)

@pytest.mark.parametrize("a", ["fora", "g100_000", "g000_096", "xyz", "G051_026", "g51_26", ""])
def test_centro_invalido_ou_fora_e_none(a):
    assert centro(a) is None

@pytest.mark.parametrize("a", ["g000_000", "g051_026", "g099_095"])
def test_centro_volta_para_a_mesma_area(a):
    assert area_id(*centro(a)) == a

def test_area_valida():
    assert area_valida("g051_026") and area_valida("fora")
    assert not area_valida("g100_000") and not area_valida("g000_096") and not area_valida("lixo")
```
```python
# tests/test_dominio.py
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_area.py tests/test_dominio.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.area'`.

- [ ] **Step 4: Implementar `app/dominio.py` e `app/area.py`**

`area.py`: constantes dos contratos (limites lat −23.80…−23.35, lng −46.83…−46.36; célula 0.0045 × 0.0049); `area_id` usa limites semiabertos (`min <= v < max`) antes de calcular `floor`; `centro` e `area_valida` aceitam só `^g\d{3}_\d{3}$` com linha ≤ 99 e coluna ≤ 95 (ou `"fora"` em `area_valida`); `centro("fora")` é `None`. `dominio.py`: conforme Interfaces.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests/test_area.py tests/test_dominio.py -q`
Expected: todos passam, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): esqueleto, dominio e grade de area"
```

---

### Task 2: Banco — modelos, comportamento e migração Alembic (P1)

**Files:**
- Create: `ponte-policia/app/config.py`, `app/db.py`, `app/models.py`
- Create: `ponte-policia/alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/0001_inicial.py`
- Create: `ponte-policia/tests/fabrica.py`, `tests/conftest.py`
- Test: `ponte-policia/tests/test_modelos.py`, `ponte-policia/tests/test_migracao_postgres.py`

**Interfaces:**
- Consumes: Task 1 (`dominio.py`).
- Produces: `Settings(db_url: str, chave_servico: str, chave_policia: str)` e `get_settings() -> Settings` (lê `PONTE_DB`, `PONTE_CHAVE_SERVICO`, `PONTE_CHAVE_POLICIA` do ambiente a cada chamada, vazio se ausente); `db.Base` (DeclarativeBase); `db.UTCDateTime` (TypeDecorator: grava em UTC, naive vira UTC; devolve sempre aware UTC); `db.get_engine() -> Engine` (cache; usa `settings.db_url`); `db.get_session() -> Iterator[Session]` (dependência FastAPI, `expire_on_commit=False`).
- Produces (`models.py`): `Ocorrencia(id, protocolo|None, origem_id: UUID, area_id, ts, tipo, origem_gatilho, device_hash, status, recebida_em, trilha: list[TrilhaPosRoubo], retornos: list[Retorno])`, `TrilhaPosRoubo(id, ocorrencia_id, ordem, lat, lng, em)`, `Retorno(id, ocorrencia_id, status, mensagem, criado_em)`; métodos: `Ocorrencia.receber(*, origem_id: UUID, area_id: str, ts: datetime, tipo: TipoOcorrencia, origem_gatilho: OrigemGatilho, device_hash: str, trilha: list[tuple[float, float, datetime]], agora: datetime) -> Ocorrencia`; `atribuir_protocolo(self) -> None` (`PP-{recebida_em.year}-{id:06d}`, exige `id`); `mudar_status(self, novo: StatusOcorrencia, mensagem: str, agora: datetime) -> Retorno` (levanta `ErroTransicaoInvalida`, nada muda em caso de erro); `retorno_atual(self) -> tuple[StatusOcorrencia, str, datetime]` (último `Retorno`, ou `(RECEBIDA, MENSAGEM_PADRAO_RECEBIDA, recebida_em)`).
- Produces (testes): `tests/fabrica.py` com `AGORA = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)`, `CHAVE_SERVICO = "chave-servico-teste"`, `CHAVE_POLICIA = "chave-policia-teste"`, `payload_valido(**sobrescritas) -> dict` (origem_id novo, `area_id "g051_026"`, `ts "2026-11-16T11:30:00Z"`, `tipo "roubo_celular"`, `origem_gatilho "chaveiro"`, `device_hash = sha256("chaveiro-ampara-abc123" + CHAVE_SERVICO).hexdigest()`, `trilha []`); `conftest.py` com fixtures `engine` (SQLite em memória, `StaticPool`, `check_same_thread=False`, `Base.metadata.create_all`) e `session`.

- [ ] **Step 1: Criar os bancos (uma vez)**

No `psql` do PostgreSQL local (superusuário), com a senha vinda de variável de ambiente, nunca escrita em arquivo: `CREATE ROLE ponte LOGIN PASSWORD '<senha local>'; CREATE DATABASE ponte OWNER ponte; CREATE DATABASE ponte_test OWNER ponte;`. Exporte `PONTE_DB` e `PONTE_DB_TEST` (`postgresql+psycopg://ponte:<senha>@localhost:5432/ponte` e `.../ponte_test`). Não mexa em nenhum outro banco da máquina.
Expected: `psql "<url sem o +psycopg>" -c "select 1"` retorna uma linha.

- [ ] **Step 2: Escrever os testes que falham**

```python
# tests/test_modelos.py
from datetime import timedelta
from uuid import uuid4
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.dominio import *
from app.models import Ocorrencia
from tests.fabrica import AGORA

def nova(origem_id=None, trilha=()):
    return Ocorrencia.receber(origem_id=origem_id or uuid4(), area_id="g051_026", ts=AGORA,
        tipo=TipoOcorrencia.ROUBO_CELULAR, origem_gatilho=OrigemGatilho.CHAVEIRO,
        device_hash="a" * 64, trilha=list(trilha), agora=AGORA)

def test_receber_cria_recebida_com_trilha_ordenada():
    oc = nova(trilha=[(-23.56, -46.70, AGORA), (-23.57, -46.71, AGORA)])
    assert oc.status == StatusOcorrencia.RECEBIDA and oc.recebida_em == AGORA
    assert [p.ordem for p in oc.trilha] == [0, 1] and oc.protocolo is None

def test_retorno_atual_sem_retornos_usa_o_padrao():
    assert nova().retorno_atual() == (StatusOcorrencia.RECEBIDA, MENSAGEM_PADRAO_RECEBIDA, AGORA)

def test_mudar_status_registra_retorno():
    oc, t = nova(), AGORA + timedelta(minutes=1)
    r = oc.mudar_status(StatusOcorrencia.EM_ANALISE, "Em análise", t)
    assert oc.status == StatusOcorrencia.EM_ANALISE and r.status == StatusOcorrencia.EM_ANALISE
    assert oc.retorno_atual() == (StatusOcorrencia.EM_ANALISE, "Em análise", t)

def test_mudar_status_invalido_levanta_e_nao_altera():
    oc = nova()
    with pytest.raises(ErroTransicaoInvalida):
        oc.mudar_status(StatusOcorrencia.ATENDIDA, "x", AGORA)
    assert oc.status == StatusOcorrencia.RECEBIDA and oc.retornos == []

def test_atribuir_protocolo_usa_ano_e_id(session):
    oc = nova(); session.add(oc); session.flush(); oc.atribuir_protocolo()
    assert oc.protocolo == f"PP-2026-{oc.id:06d}"

def test_roundtrip_devolve_utc_aware_e_enum(session):
    oc = nova(); session.add(oc); session.commit(); session.expire_all()
    lido = session.get(Ocorrencia, oc.id)
    assert lido.ts == AGORA and lido.ts.tzinfo is not None
    assert lido.status is StatusOcorrencia.RECEBIDA

def test_banco_guarda_o_valor_do_enum_e_nao_o_nome(session):
    session.add(nova()); session.commit()
    assert session.execute(text("select status, tipo, origem_gatilho from ocorrencias")).one() == ("recebida", "roubo_celular", "chaveiro")

def test_origem_id_e_unico(session):
    o = uuid4(); session.add(nova(o)); session.commit()
    session.add(nova(o))
    with pytest.raises(IntegrityError):
        session.commit()
```
```python
# tests/test_migracao_postgres.py  (marcado @pytest.mark.postgres; skip se PONTE_DB_TEST ausente)
def test_upgrade_cria_tabelas_e_downgrade_remove(monkeypatch):
    # PONTE_DB := PONTE_DB_TEST; Config(raiz/"alembic.ini") com script_location absoluto
    # upgrade head -> inspect(engine).get_table_names() == {"ocorrencias","trilha_pos_roubo","retornos","alembic_version"}
    # downgrade base -> só "alembic_version" sobra
```
Escreva o corpo do segundo teste com `alembic.command.upgrade/downgrade` e `sqlalchemy.inspect`; comparar `set(...)` exatamente com os nomes acima.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_modelos.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.models'`.

- [ ] **Step 4: Implementar config, db, models e fabrica/conftest**

`models.py`: SQLAlchemy 2 tipado (`Mapped`/`mapped_column`). Colunas de enum com `Enum(Classe, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e])` (sem isso o banco grava o *nome*, `RECEBIDA`). `origem_id`: `Uuid`, único. `protocolo`: `String(20)`, único, anulável (preenchido após o `flush`). Índice composto `ix_ocorrencias_area_ts (area_id, ts)`. `trilha`: `relationship(order_by=ordem, cascade="all, delete-orphan")`; `retornos`: `relationship(order_by=(criado_em, id), cascade=...)`. Datas com `UTCDateTime`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests/test_modelos.py -q`
Expected: 8 passed.

- [ ] **Step 6: Gerar e aplicar a migração**

Configure `alembic/env.py` para ler `PONTE_DB` do ambiente e usar `Base.metadata` (`import app.models`). Run: `cd ponte-policia && alembic revision --autogenerate --rev-id 0001 -m inicial`, revise o arquivo gerado (3 tabelas, FK, únicos de `origem_id` e `protocolo`, índice `ix_ocorrencias_area_ts`, `downgrade` remove tudo) e renomeie para `0001_inicial.py`.
Run: `alembic upgrade head && alembic current`
Expected: imprime `0001 (head)`; `psql ... -c "\dt"` lista `ocorrencias`, `trilha_pos_roubo`, `retornos`, `alembic_version`.

- [ ] **Step 7: Provar as migrações no PostgreSQL**

Run: `cd ponte-policia && python -m pytest tests/test_migracao_postgres.py -m postgres -v`
Expected: 1 passed (com `PONTE_DB_TEST` definido).

- [ ] **Step 8: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): modelos, comportamento de dominio e migracao 0001"
```

---

### Task 3: Detector de PII próprio (P1)

**Files:**
- Create: `ponte-policia/app/pii.py`
- Test: `ponte-policia/tests/test_pii.py`

**Interfaces:**
- Consumes: nada (módulo puro).
- Produces: `@dataclass(frozen=True) AchadoPii(campo: str, classe: str)` com `classe ∈ {"Cpf","Email","Telefone","Imei","Nome"}`; `detectar_pii(dados: object) -> list[AchadoPii]` (percorre dict/list aninhados; `campo` é o caminho `a.b[0].c`; sem duplicar `(campo, classe)`; **nunca devolve o valor**); `cpf_valido(digitos: str) -> bool`; `luhn_valido(digitos: str) -> bool`.

- [ ] **Step 1: Escrever os testes que falham**

```python
# tests/test_pii.py
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_pii.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'app.pii'`.

- [ ] **Step 3: Implementar `app/pii.py`**

Algoritmo (a assinatura e os testes não o determinam):
1. **Valores estruturados são ignorados**: uma string que casa *por inteiro* com UUID, 64 hex minúsculos, data ISO-8601 ou `area_id` (`^(g\d{3}_\d{3}|fora)$`) não é escaneada (é por formato, não por nome de campo, para o atacante não esconder PII num campo com nome "seguro").
2. **Por chave**: chave normalizada (`lower()`) em `cpf→Cpf`, `email|e_mail→Email`, `telefone|celular|fone→Telefone`, `imei→Imei`, `nome|nome_completo|name|vitima|proprietario|cidadao→Nome` com valor não vazio (str ou número) gera achado sem olhar o valor.
3. **Por valor** (str e `int`, nunca `float`/`bool`): extrair candidatos numéricos com `(?<!\d)\d[\d.\-\s()+]{8,20}\d(?!\d)`, reduzir a dígitos e classificar nesta ordem: 15 dígitos com Luhn → `Imei`; 11 dígitos com `cpf_valido` (dígitos verificadores, rejeitando todos iguais) → `Cpf`; telefone = 10 ou 11 dígitos (11 exige o 3º dígito `9`; 10 exige 3º dígito 2–5) ou 12–13 dígitos começando em `55`, **com DDD no conjunto válido** (11–19, 21, 22, 24, 27, 28, 31–35, 37, 38, 41–49, 51, 53, 54, 55, 61–69, 71, 73, 74, 75, 77, 79, 81–89, 91–99).
4. **E-mail**: regex simples `[\w.+-]+@[\w-]+(\.[\w-]+)+`. **Nome em texto livre**: gatilhos `Meu nome é|me chamo|Sr.|Sra.|Dona|Senhor|Senhora` (maiúscula ou minúscula no gatilho) seguidos de palavra iniciada em maiúscula.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests/test_pii.py -q`
Expected: todos passam, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): detector de PII (CPF, e-mail, telefone, IMEI, nome)"
```

---

### Task 4: `POST /ocorrencias` idempotente, autenticação, 422 de PII e `GET /health` (P1)

**Files:**
- Create: `ponte-policia/app/schemas.py`, `app/security.py`, `app/erros.py`, `app/deps.py`, `app/main.py`
- Create: `ponte-policia/app/repositories/__init__.py`, `app/repositories/ocorrencia_repository.py`
- Create: `ponte-policia/app/services/__init__.py`, `app/services/ocorrencia_service.py`
- Create: `ponte-policia/app/routers/__init__.py`, `app/routers/health.py`, `app/routers/ocorrencias.py`
- Modify: `ponte-policia/tests/conftest.py` (fixture `client`, `chaves`)
- Test: `ponte-policia/tests/test_ocorrencias_api.py`, `ponte-policia/tests/test_auth.py`

**Interfaces:**
- Consumes: Tasks 1–3 (`dominio`, `area_valida`, `models.Ocorrencia`, `get_session`, `get_settings`, `detectar_pii`).
- Produces (`schemas.py`): `TrilhaPonto(lat: float [-90,90], lng: float [-180,180], em: datetime)`; `OcorrenciaCriar` (`extra="forbid"`: `origem_id: UUID`, `area_id: str` validado por `area_valida`, `ts: datetime`, `tipo: TipoOcorrencia`, `origem_gatilho: OrigemGatilho`, `device_hash: str` com padrão `^[0-9a-f]{64}$`, `trilha: list[TrilhaPonto]` padrão `[]`, máx. 500); `ProtocoloResposta(protocolo: str, status: StatusOcorrencia)`.
- Produces (`security.py`): `esquema_servico = APIKeyHeader(name="X-Chave-Servico", scheme_name="ChaveServico", auto_error=False)`, `esquema_policia = APIKeyHeader(name="X-Chave-Policia", scheme_name="ChavePolicia", auto_error=False)`; `exigir_chave_servico(chave: str | None = Depends(esquema_servico)) -> None` e `exigir_chave_policia(...)` (compara com `hmac.compare_digest` sobre bytes UTF-8; chave configurada vazia ou cabeçalho ausente/vazio/errado → 401 `{"detail": "Chave inválida ou ausente."}`); `rejeitar_pii(request: Request) -> None` (dependência: lê o JSON bruto, levanta `ErroPii` se houver achados; JSON inválido → 422).
- Produces (`erros.py`): `ErroPii(Exception)` com `achados: list[AchadoPii]`; `registrar_handlers(app)`: `ErroPii` → 422 `{"detail": "Payload contém dado pessoal e foi rejeitado.", "achados": [{"campo", "classe"}]}`; `RequestValidationError` → 422 `{"detail": [{"loc": [...], "msg": "..."}]}` **sem `input` nem `ctx`**; `OcorrenciaNaoEncontrada` → 404 `{"detail": "Protocolo não encontrado."}`; `ErroTransicaoInvalida` → 409 `{"detail": "Transição de status não permitida."}`.
- Produces (`repositories`): `OcorrenciaRepository(session)` com `buscar_por_origem(origem_id: UUID) -> Ocorrencia | None`, `buscar_por_protocolo(protocolo: str) -> Ocorrencia | None`, `adicionar(oc) -> None` (add + flush), `commit() -> None`, `rollback() -> None`.
- Produces (`services`): `OcorrenciaService(repo, agora: Callable[[], datetime])` com `registrar(dados: OcorrenciaCriar) -> tuple[Ocorrencia, bool]` (`bool` = criada agora).
- Produces (`deps.py`): `get_agora() -> Callable[[], datetime]` (UTC real), `get_ocorrencia_service(...)`. `main.create_app() -> FastAPI` e `app = create_app()`; título "Ponte Polícia — Ampara", versão "1.0.0".

- [ ] **Step 1: Escrever os testes que falham**

Fixture `client` (em `conftest.py`): `monkeypatch.setenv` de `PONTE_CHAVE_SERVICO`/`PONTE_CHAVE_POLICIA` com as constantes de `fabrica`; `create_app()` com `dependency_overrides` de `get_session` (sessão da fixture `engine`) e `get_agora` (`lambda: AGORA`); `TestClient`. `HS = {"X-Chave-Servico": CHAVE_SERVICO}`.

```python
# tests/test_ocorrencias_api.py
import logging, pytest
from datetime import datetime, timezone
from sqlalchemy import select, func
from app.models import Ocorrencia, TrilhaPosRoubo
from tests.fabrica import payload_valido, HS

def total(session): return session.scalar(select(func.count()).select_from(Ocorrencia))

def test_post_valido_retorna_201_e_protocolo(client):
    r = client.post("/ocorrencias", json=payload_valido(), headers=HS)
    assert r.status_code == 201
    assert r.json() == {"protocolo": "PP-2026-000001", "status": "recebida"}

def test_mesmo_origem_id_retorna_200_e_o_mesmo_protocolo(client, session):
    p = payload_valido()
    a = client.post("/ocorrencias", json=p, headers=HS)
    b = client.post("/ocorrencias", json=p, headers=HS)
    assert (a.status_code, b.status_code) == (201, 200) and a.json() == b.json()
    assert total(session) == 1

def test_origens_diferentes_geram_protocolos_sequenciais(client):
    client.post("/ocorrencias", json=payload_valido(), headers=HS)
    r = client.post("/ocorrencias", json=payload_valido(), headers=HS)
    assert r.json()["protocolo"] == "PP-2026-000002"

def test_trilha_gravada_em_ordem(client, session):
    t = [{"lat": -23.56 - i / 1000, "lng": -46.70, "em": "2026-11-16T11:3%d:00Z" % i} for i in range(3)]
    client.post("/ocorrencias", json=payload_valido(trilha=t), headers=HS)
    pontos = session.scalars(select(TrilhaPosRoubo).order_by(TrilhaPosRoubo.ordem)).all()
    assert [p.ordem for p in pontos] == [0, 1, 2]

def test_ts_com_offset_gravado_em_utc(client, session):
    client.post("/ocorrencias", json=payload_valido(ts="2026-11-16T08:30:00-03:00"), headers=HS)
    assert session.scalars(select(Ocorrencia)).one().ts == datetime(2026, 11, 16, 11, 30, tzinfo=timezone.utc)

INVALIDOS = [{"tipo": "outro"}, {"origem_gatilho": "sms"}, {"device_hash": "abc"}, {"device_hash": "A" * 64},
             {"area_id": "xyz"}, {"area_id": "g999_999"}, {"origem_id": "nao-e-uuid"}, {"ts": "ontem"},
             {"foo": "bar"}, {"trilha": [{"lat": 91, "lng": 0, "em": "2026-11-16T11:30:00Z"}]},
             {"trilha": [{"lat": -23.5, "lng": -46.7, "em": "2026-11-16T11:30:00Z"}] * 501}]
@pytest.mark.parametrize("troca", INVALIDOS)
def test_payload_invalido_retorna_422(client, session, troca):
    assert client.post("/ocorrencias", json=payload_valido(**troca), headers=HS).status_code == 422
    assert total(session) == 0

def test_campo_obrigatorio_ausente_retorna_422(client):
    p = payload_valido(); del p["device_hash"]
    assert client.post("/ocorrencias", json=p, headers=HS).status_code == 422

def test_json_invalido_retorna_422(client):
    r = client.post("/ocorrencias", content="{", headers={**HS, "Content-Type": "application/json"})
    assert r.status_code == 422

def test_422_de_validacao_nao_ecoa_o_valor_enviado(client):                       # Review Focus 1
    r = client.post("/ocorrencias", json=payload_valido(tipo="valor-secreto-xyz"), headers=HS)
    assert r.status_code == 422 and "valor-secreto-xyz" not in r.text

PII = [("observacao", "CPF 529.982.247-25", "Cpf", "529.982.247-25"),
       ("contato", "(11) 91234-5678", "Telefone", "91234-5678"),
       ("aparelho", "490154203237518", "Imei", "490154203237518"),
       ("email", "fulano@exemplo.com", "Email", "fulano@exemplo.com"),
       ("nome", "Maria Souza", "Nome", "Maria Souza")]
@pytest.mark.parametrize("campo,valor,classe,segredo", PII)
def test_pii_em_campo_extra_retorna_422_sem_ecoar(client, session, campo, valor, classe, segredo):   # Review Focus 1
    r = client.post("/ocorrencias", json=payload_valido(**{campo: valor}), headers=HS)
    assert r.status_code == 422
    assert r.json()["achados"] == [{"campo": campo, "classe": classe}]
    assert segredo not in r.text and total(session) == 0

def test_pii_dentro_de_campo_estruturado_tambem_e_barrada(client):
    r = client.post("/ocorrencias", json=payload_valido(area_id="fulano@exemplo.com"), headers=HS)
    assert r.status_code == 422 and r.json()["achados"][0]["classe"] == "Email"

def test_pii_na_trilha_e_barrada(client):
    t = [{"lat": -23.5, "lng": -46.7, "em": "2026-11-16T11:30:00Z", "obs": "liga 11 91234-5678"}]
    r = client.post("/ocorrencias", json=payload_valido(trilha=t), headers=HS)
    assert r.json()["achados"] == [{"campo": "trilha[0].obs", "classe": "Telefone"}]

def test_log_nao_contem_o_valor_da_pii(client, caplog):                            # Review Focus 1
    with caplog.at_level(logging.DEBUG):
        client.post("/ocorrencias", json=payload_valido(observacao="529.982.247-25"), headers=HS)
    assert "529.982.247-25" not in caplog.text and "Cpf" in caplog.text

def test_corrida_na_idempotencia_devolve_o_vencedor(session):                      # Review Focus 4
    from app.repositories.ocorrencia_repository import OcorrenciaRepository
    from app.services.ocorrencia_service import OcorrenciaService
    from app.schemas import OcorrenciaCriar
    from tests.fabrica import AGORA
    dados = OcorrenciaCriar(**payload_valido())
    repo = OcorrenciaRepository(session)
    servico = OcorrenciaService(repo, lambda: AGORA)
    vencedor, criada = servico.registrar(dados)
    assert criada is True
    original = repo.buscar_por_origem
    chamadas = iter([None])                       # a 1ª consulta "não vê" o vencedor
    repo.buscar_por_origem = lambda oid: next(chamadas, None) or original(oid)
    perdedor, criada2 = servico.registrar(dados)
    assert criada2 is False and perdedor.protocolo == vencedor.protocolo and total(session) == 1
```
```python
# tests/test_auth.py
import pytest
from tests.fabrica import payload_valido, CHAVE_SERVICO, CHAVE_POLICIA

def test_health_sem_chave(client):
    r = client.get("/health"); assert r.status_code == 200 and r.json() == {"status": "ok"}

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": ""}, {"X-Chave-Servico": "errada"},
                                 {"X-Chave-Servico": "chavé-ç"}, {"X-Chave-Policia": CHAVE_POLICIA}])
def test_post_sem_chave_de_servico_valida_retorna_401(client, cab):
    r = client.post("/ocorrencias", json=payload_valido(), headers=cab)
    assert r.status_code == 401 and r.json() == {"detail": "Chave inválida ou ausente."}

@pytest.mark.parametrize("var", ["PONTE_CHAVE_SERVICO"])
def test_chave_nao_configurada_falha_fechado(client, monkeypatch, var):             # Review Focus 3
    monkeypatch.setenv(var, "")
    for cab in ({"X-Chave-Servico": ""}, {}):
        assert client.post("/ocorrencias", json=payload_valido(), headers=cab).status_code == 401
    monkeypatch.delenv(var)
    assert client.post("/ocorrencias", json=payload_valido(), headers={"X-Chave-Servico": ""}).status_code == 401
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_ocorrencias_api.py tests/test_auth.py -q`
Expected: FAIL (erro de coleta: `No module named 'app.main'` / fixture `client` ausente).

- [ ] **Step 3: Implementar schemas, segurança, erros, repositório, serviço, deps e rotas**

- `OcorrenciaService.registrar`: consulta `buscar_por_origem`; se existe devolve `(existente, False)`; senão `Ocorrencia.receber(...)`, `adicionar`, `atribuir_protocolo()`, `commit()`; em `IntegrityError` faz `rollback()`, consulta de novo e devolve `(existente, False)` (se ainda for `None`, relança).
- `routers/ocorrencias.py`: `POST /ocorrencias` com `dependencies=[Depends(exigir_chave_servico), Depends(rejeitar_pii)]`, corpo tipado `OcorrenciaCriar`, `status_code=201`; devolve 200 quando `criada` é falso (injete `Response`). A dependência `rejeitar_pii` roda antes da validação do corpo (por isso o campo extra com PII dá 422 com `achados`, e não o erro de campo extra). Se um teste mostrar que a validação do corpo vem antes, mova a checagem de PII para dentro do handler de `RequestValidationError` consultando o JSON bruto.
- Logs: `logger.warning("payload rejeitado por PII: achados=%s", [(a.campo, a.classe) ...])` e `logger.info("ocorrencia protocolo=%s criada=%s")`. Nenhum log recebe o corpo.
- Toda rota declara `summary`, `description` e `responses={401: ..., 422: ...}` (alimenta a documentação, T8).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests -q`
Expected: todos passam, 0 failed (testes das tarefas 1–4).

- [ ] **Step 5: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): POST /ocorrencias idempotente com chave de servico e rejeicao de PII"
```

---

### Task 5: Retorno ao cidadão, mudança de status e listagem para o painel (P1)

**Files:**
- Modify: `ponte-policia/app/schemas.py`, `app/services/ocorrencia_service.py`, `app/routers/ocorrencias.py`
- Test: `ponte-policia/tests/test_retorno_status.py`, `ponte-policia/tests/test_listagem.py`
- Modify também: `ponte-policia/app/repositories/ocorrencia_repository.py`

**Interfaces:**
- Consumes: Task 4 (`OcorrenciaService`, `OcorrenciaRepository.buscar_por_protocolo`, `exigir_chave_policia`, `rejeitar_pii`, handlers 404/409); Task 2 (`Ocorrencia.mudar_status`, `retorno_atual`).
- Produces: `RetornoResposta(protocolo: str, status: StatusOcorrencia, mensagem: str, atualizado_em: datetime)`; `StatusAtualizar` (`extra="forbid"`: `status: Literal[EM_ANALISE, ATENDIDA, DESCARTADA]`, `mensagem: str` com 1–500 caracteres); `OcorrenciaService.obter_retorno(protocolo: str) -> RetornoResposta` e `atualizar_status(protocolo: str, novo: StatusOcorrencia, mensagem: str) -> RetornoResposta` (levantam `OcorrenciaNaoEncontrada`/`ErroTransicaoInvalida`, `commit` ao final); rotas `GET /ocorrencias/{protocolo}/retorno` (`X-Chave-Servico`) e `PATCH /ocorrencias/{protocolo}/status` (`X-Chave-Policia`, 200).
- Produces (rota nova dos contratos): `OcorrenciaResumo(protocolo: str, area_id: str, ts: datetime, tipo: TipoOcorrencia, status: StatusOcorrencia, origem_gatilho: OrigemGatilho)` (sem `device_hash`, sem trilha); `OcorrenciaRepository.listar(status: StatusOcorrencia | None, limite: int = 200) -> list[Ocorrencia]` (ordem `ts` decrescente, desempate por `id` decrescente); `OcorrenciaService.listar(status: StatusOcorrencia | None) -> list[OcorrenciaResumo]`; rota `GET /ocorrencias?status=` (`X-Chave-Policia`; `status` opcional, um de `recebida|em_analise|atendida|descartada`; valor desconhecido → 422; resposta é lista JSON, vazia se não houver).

- [ ] **Step 1: Escrever os testes que falham**

```python
# tests/test_retorno_status.py
import pytest
from datetime import datetime
from tests.fabrica import payload_valido, HS, CHAVE_POLICIA, CHAVE_SERVICO, AGORA
from app.dominio import MENSAGEM_PADRAO_RECEBIDA

HP = {"X-Chave-Policia": CHAVE_POLICIA}

@pytest.fixture
def protocolo(client):
    return client.post("/ocorrencias", json=payload_valido(), headers=HS).json()["protocolo"]

def patch(client, proto, status, msg="Equipe acionada.", headers=HP):
    return client.patch(f"/ocorrencias/{proto}/status", json={"status": status, "mensagem": msg}, headers=headers)

def test_retorno_inicial_e_recebida_com_mensagem_padrao(client, protocolo):
    r = client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS)
    j = r.json()
    assert r.status_code == 200 and j["protocolo"] == protocolo and j["status"] == "recebida"
    assert j["mensagem"] == MENSAGEM_PADRAO_RECEBIDA
    assert datetime.fromisoformat(j["atualizado_em"]) == AGORA and j["atualizado_em"].endswith("Z")   # UTC com Z

def test_protocolo_inexistente_retorna_404(client):
    assert client.get("/ocorrencias/PP-2026-999999/retorno", headers=HS).status_code == 404
    assert patch(client, "PP-2026-999999", "em_analise").status_code == 404

def test_fluxo_completo_ate_atendida(client, protocolo):
    r = patch(client, protocolo, "em_analise", "Em análise pela equipe.")
    assert r.status_code == 200 and r.json()["status"] == "em_analise"
    assert patch(client, protocolo, "atendida", "Atendida. Obrigado.").status_code == 200
    j = client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS).json()
    assert (j["status"], j["mensagem"]) == ("atendida", "Atendida. Obrigado.")

def test_em_analise_pode_ser_descartada(client, protocolo):
    patch(client, protocolo, "em_analise")
    assert patch(client, protocolo, "descartada").status_code == 200

@pytest.mark.parametrize("sequencia", [["atendida"], ["descartada"], ["em_analise", "em_analise"],
                                       ["em_analise", "atendida", "descartada"], ["em_analise", "descartada", "atendida"]])
def test_transicao_invalida_retorna_409_e_nao_muda_o_status(client, protocolo, sequencia):
    for s in sequencia[:-1]:
        assert patch(client, protocolo, s).status_code == 200
    assert patch(client, protocolo, sequencia[-1]).status_code == 409
    assert client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS).json()["status"] == (sequencia[-2] if len(sequencia) > 1 else "recebida")

def test_status_recebida_nao_e_aceito_no_patch(client, protocolo):
    assert patch(client, protocolo, "recebida").status_code == 422

@pytest.mark.parametrize("msg", ["", "x" * 501])
def test_mensagem_fora_do_limite_retorna_422(client, protocolo, msg):
    assert patch(client, protocolo, "em_analise", msg).status_code == 422

def test_mensagem_com_acentos_e_emoji_e_aceita(client, protocolo):
    assert patch(client, protocolo, "em_analise", "Equipe a caminho — obrigado 🙏").status_code == 200

def test_mensagem_com_pii_retorna_422_sem_ecoar(client, protocolo):
    r = patch(client, protocolo, "em_analise", "Ligue para (11) 91234-5678")
    assert r.status_code == 422 and "91234-5678" not in r.text
    assert client.get(f"/ocorrencias/{protocolo}/retorno", headers=HS).json()["status"] == "recebida"

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": CHAVE_SERVICO}, {"X-Chave-Policia": "errada"}])
def test_patch_exige_chave_da_policia(client, protocolo, cab):
    assert patch(client, protocolo, "em_analise", headers=cab).status_code == 401

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Policia": CHAVE_POLICIA}])
def test_get_retorno_exige_chave_de_servico(client, protocolo, cab):
    assert client.get(f"/ocorrencias/{protocolo}/retorno", headers=cab).status_code == 401
```

Teste da listagem (rota `GET /ocorrencias?status=`):

```python
# tests/test_listagem.py
import pytest
from datetime import timedelta
from tests.fabrica import payload_valido, HS, AGORA, CHAVE_POLICIA, CHAVE_SERVICO

HP = {"X-Chave-Policia": CHAVE_POLICIA}
def enviar(client, minutos_atras=10, **extra):
    ts = (AGORA - timedelta(minutes=minutos_atras)).isoformat()
    return client.post("/ocorrencias", json=payload_valido(ts=ts, **extra), headers=HS).json()["protocolo"]

def test_lista_vazia_sem_ocorrencias(client):
    r = client.get("/ocorrencias", headers=HP)
    assert r.status_code == 200 and r.json() == []

def test_lista_traz_os_campos_do_contrato_e_nada_alem(client):
    p = enviar(client)
    item = client.get("/ocorrencias", headers=HP).json()[0]
    assert set(item) == {"protocolo", "area_id", "ts", "tipo", "status", "origem_gatilho"}
    assert item["protocolo"] == p and item["status"] == "recebida" and item["ts"].endswith("Z")

def test_ordem_e_do_mais_recente_para_o_mais_antigo(client):
    a = enviar(client, minutos_atras=30); b = enviar(client, minutos_atras=5)
    assert [i["protocolo"] for i in client.get("/ocorrencias", headers=HP).json()] == [b, a]

def test_filtro_por_status(client):
    a = enviar(client); b = enviar(client)
    client.patch(f"/ocorrencias/{b}/status", json={"status": "em_analise", "mensagem": "ok"}, headers=HP)
    assert [i["protocolo"] for i in client.get("/ocorrencias", params={"status": "em_analise"}, headers=HP).json()] == [b]
    assert [i["protocolo"] for i in client.get("/ocorrencias", params={"status": "recebida"}, headers=HP).json()] == [a]
    assert len(client.get("/ocorrencias", headers=HP).json()) == 2

def test_status_desconhecido_retorna_422(client):
    assert client.get("/ocorrencias", params={"status": "foo"}, headers=HP).status_code == 422

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": CHAVE_SERVICO}, {"X-Chave-Policia": "errada"}])
def test_listagem_exige_chave_da_policia(client, cab):
    assert client.get("/ocorrencias", headers=cab).status_code == 401

def test_listagem_nao_vaza_device_hash(client):
    enviar(client)
    assert "device_hash" not in client.get("/ocorrencias", headers=HP).text
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_retorno_status.py tests/test_listagem.py -q`
Expected: FAIL (`404`/`405` nas rotas ainda inexistentes).

- [ ] **Step 3: Implementar schemas, serviço e rotas**

`atualizar_status` busca pelo protocolo, chama `oc.mudar_status(novo, mensagem, self.agora())`, `commit` e devolve `RetornoResposta` a partir de `retorno_atual()`. O `PATCH` usa `dependencies=[Depends(exigir_chave_policia), Depends(rejeitar_pii)]`. `GET /ocorrencias` usa `dependencies=[Depends(exigir_chave_policia)]`, parâmetro `status: StatusOcorrencia | None = None` (o FastAPI devolve 422 sem eco para valor desconhecido) e `response_model=list[OcorrenciaResumo]`; declará-la no mesmo router do `POST /ocorrencias`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests -q`
Expected: todos passam, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): retorno ao cidadao, mudanca de status e listagem para o painel"
```

---

### Task 6: Hotspots por janela (P1)

**Files:**
- Create: `ponte-policia/app/services/hotspot_service.py`, `app/routers/hotspots.py`
- Modify: `ponte-policia/app/schemas.py`, `app/repositories/ocorrencia_repository.py`, `app/deps.py`, `app/main.py`
- Test: `ponte-policia/tests/test_hotspots.py`

**Interfaces:**
- Consumes: Task 4 (`OcorrenciaRepository`, `get_agora`); Task 1 (`Hotspot`, `centro`); Task 4 (`exigir_chave_policia`).
- Também produz `risco_por_total(total: int) -> str` em `hotspot_service.py` (função pura usada por `listar` e pelo teste de contrato).
- Produces: `OcorrenciaRepository.contar_por_area(desde: datetime) -> list[tuple[str, int]]` (conta ocorrências com `ts >= desde` e `status != descartada`, agrupadas por `area_id`); `HotspotService(repo, agora).listar(janela_min: int) -> list[Hotspot]` (exclui `"fora"`; ordena por `total` decrescente e `area_id`; `lat, lng = centro(area_id)`; `risco_previsto`: total ≥ 5 → `"alto"`, 2–4 → `"medio"`, 1 → `"baixo"`, constantes `LIMIAR_MEDIO = 2`, `LIMIAR_ALTO = 5`); `HotspotResposta(area_id: str, lat: float, lng: float, total: int, risco_previsto: str)`; rota `GET /hotspots?janela_min=60` (`X-Chave-Policia`; `janela_min` inteiro de 1 a 10080, padrão 60).

- [ ] **Step 1: Escrever os testes que falham**

Helper do teste: `enviar(client, area="g051_026", minutos_atras=10, **extra)` posta `payload_valido(area_id=area, ts=(AGORA - timedelta(minutes=minutos_atras)).isoformat(), **extra)` com `HS`.

```python
# tests/test_hotspots.py
import pytest
from datetime import timedelta
from tests.fabrica import payload_valido, HS, AGORA, CHAVE_POLICIA, CHAVE_SERVICO
from app.area import centro

HP = {"X-Chave-Policia": CHAVE_POLICIA}
def enviar(client, area="g051_026", minutos_atras=10, **extra):
    ts = (AGORA - timedelta(minutes=minutos_atras)).isoformat()
    return client.post("/ocorrencias", json=payload_valido(area_id=area, ts=ts, **extra), headers=HS)
def hot(client, **params): return client.get("/hotspots", params=params, headers=HP)

def test_sem_dados_retorna_lista_vazia(client):
    assert hot(client).json() == []

def test_agrupa_por_area_ordena_e_calcula_centro_e_risco(client):
    for _ in range(3): enviar(client, "g051_026")
    enviar(client, "g052_031")
    j = hot(client).json()
    assert [(h["area_id"], h["total"], h["risco_previsto"]) for h in j] == [("g051_026", 3, "medio"), ("g052_031", 1, "baixo")]
    assert (j[0]["lat"], j[0]["lng"]) == pytest.approx(centro("g051_026"))
    assert set(j[0]) == {"area_id", "lat", "lng", "total", "risco_previsto"}

def test_cinco_ocorrencias_sao_risco_alto(client):
    for _ in range(5): enviar(client)
    assert hot(client).json()[0]["risco_previsto"] == "alto"

def test_borda_da_janela_inclui_exato_e_exclui_um_minuto_a_mais(client):         # Review Focus 5
    enviar(client, minutos_atras=60); enviar(client, "g052_031", minutos_atras=61)
    assert [h["area_id"] for h in hot(client, janela_min=60).json()] == ["g051_026"]
    assert len(hot(client, janela_min=120).json()) == 2

def test_janela_padrao_e_60_minutos(client):
    enviar(client, minutos_atras=61)
    assert hot(client).json() == []

def test_ts_com_offset_conta_no_mesmo_instante(client):                          # Review Focus 5
    client.post("/ocorrencias", headers=HS, json=payload_valido(ts="2026-11-16T08:30:00-03:00"))  # = 11:30Z, 30 min antes de AGORA
    assert hot(client, janela_min=45).json()[0]["total"] == 1

@pytest.mark.parametrize("valor", ["0", "-5", "abc", "10081", ""])
def test_janela_invalida_retorna_422(client, valor):                              # Review Focus 5
    assert client.get("/hotspots", params={"janela_min": valor}, headers=HP).status_code == 422

def test_descartada_nao_conta(client):                                           # Review Focus 5
    p = enviar(client).json()["protocolo"]
    for s in ("em_analise", "descartada"):
        client.patch(f"/ocorrencias/{p}/status", json={"status": s, "mensagem": "ok"}, headers=HP)
    assert hot(client).json() == []

def test_area_fora_da_grade_nao_aparece(client):                                  # Review Focus 5
    enviar(client, "fora"); enviar(client, "g051_026")
    assert [h["area_id"] for h in hot(client).json()] == ["g051_026"]

@pytest.mark.parametrize("cab", [{}, {"X-Chave-Servico": CHAVE_SERVICO}])
def test_hotspots_exige_chave_da_policia(client, cab):
    assert client.get("/hotspots", headers=cab).status_code == 401
```
- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_hotspots.py -q`
Expected: FAIL (`404` em `/hotspots`).

- [ ] **Step 3: Implementar repositório, serviço, schema e rota**

`desde = agora() - timedelta(minutes=janela_min)`; sem limite superior (tolera relógio adiantado da API). Sem tabela de hotspot (leitura calculada). Registrar o router em `main.py`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests -q`
Expected: todos passam, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): hotspots por janela configuravel"
```

---

### Task 7: Painel HTML `/policia` (Jinja2 + Leaflet) (P1)

**Files:**
- Create: `ponte-policia/app/routers/painel.py`, `app/templates/policia.html`
- Modify: `ponte-policia/app/main.py`
- Test: `ponte-policia/tests/test_painel.py`

**Interfaces:**
- Consumes: Task 6 (`GET /hotspots`), Task 5 (`GET /ocorrencias?status=` e `PATCH /ocorrencias/{protocolo}/status`).
- Produces: rota `GET /policia` (`HTMLResponse`, sem autenticação, `include_in_schema=False`) que renderiza `policia.html` com a variável `api_base` (do cabeçalho `X-Forwarded-Prefix`, aceito só se casar `^(/[A-Za-z0-9_-]+)*$`, senão `""`). **A página não embute dados nem chave**: tudo vem por `fetch` com o cabeçalho `X-Chave-Policia` digitado pela pessoa (guardado só em `sessionStorage`).

Conteúdo da página (ids fixos para o teste): `#campo-chave` + `#btn-entrar`; `#janela` (15, 60, 240, 1440 minutos; padrão 60); `#mapa` (Leaflet via unpkg `leaflet@1.9.4`, centro São Paulo `[-23.55, -46.63]`, zoom 11, tiles OSM; um `L.circle` por hotspot com raio `250 + 60 × total` m e cor por risco: baixo esmeralda, médio âmbar, alto alarme); `#tabela-hotspots` com colunas Área · Ocorrências · Risco (texto, não só cor), linha clicável centraliza o mapa; `#filtro-status` (`todos`, `recebida`, `em_analise`, `atendida`, `descartada`; padrão `recebida`) e `#tabela-ocorrencias` com colunas Protocolo · Área · Tipo · Status · Origem · Quando (lista de `GET /ocorrencias?status=`, **linha clicável** que preenche `#protocolo` e leva o foco ao formulário); `#form-status` com `#protocolo` (texto, preenchido ao clicar na lista ou digitado), `#novo-status` (`em_analise`, `atendida`, `descartada`), `#mensagem` (máx. 500, pré-preenchida por status) e botão "Atualizar status"; `#aviso` (`role="status"`) mostra sucesso ou erro (401 "Chave inválida", 404 "Protocolo não encontrado", 409 "Mudança de status não permitida", 422 "A mensagem não pode ter dado pessoal"). Atualiza hotspots e a lista de ocorrências a cada 30 s e logo depois de um `PATCH` bem-sucedido; horários exibidos em `America/Sao_Paulo` (a API traz UTC com `Z`). Todo texto vindo da API entra com `textContent` (nunca `innerHTML`). A constante JS `const API_BASE = "{{ api_base }}";` prefixa as chamadas.

- [ ] **Step 1: Escrever os testes que falham**

```python
# tests/test_painel.py
from tests.fabrica import payload_valido, HS, CHAVE_POLICIA

def test_painel_e_html_com_os_elementos_do_contrato(client):
    r = client.get("/policia")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/html")
    for marca in ('id="mapa"', 'id="tabela-hotspots"', 'id="tabela-ocorrencias"', 'id="filtro-status"',
                  'id="form-status"', 'id="campo-chave"', "leaflet@1.9.4"):
        assert marca in r.text

def test_painel_nao_embute_chave_nem_dados(client):
    protocolo = client.post("/ocorrencias", json=payload_valido(), headers=HS).json()["protocolo"]
    r = client.get("/policia")
    assert CHAVE_POLICIA not in r.text and protocolo not in r.text and "g051_026" not in r.text

def test_painel_nao_usa_innerhtml(client):
    assert "innerHTML" not in client.get("/policia").text

def test_api_base_vem_do_prefixo_encaminhado(client):
    assert 'const API_BASE = "/ponte";' in client.get("/policia", headers={"X-Forwarded-Prefix": "/ponte"}).text
    assert 'const API_BASE = "";' in client.get("/policia").text

def test_prefixo_malicioso_e_ignorado(client):
    r = client.get("/policia", headers={"X-Forwarded-Prefix": '";alert(1);//'})
    assert 'const API_BASE = "";' in r.text and "alert(1)" not in r.text

def test_painel_fora_do_openapi(client):
    assert "/policia" not in client.get("/openapi.json").json()["paths"]
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_painel.py -q`
Expected: FAIL (`404` em `/policia`).

- [ ] **Step 3: Implementar router e template**

`Jinja2Templates(directory=<app>/templates)`; autoescape ligado (padrão). Estilo inline com os tokens de cor; Manrope via Google Fonts (`<link>`); `<html lang="pt-BR">`; foco visível; rótulos em todos os campos.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests -q`
Expected: todos passam, 0 failed.

- [ ] **Step 5: Conferir no navegador (verificação visual)**

Suba o servidor em janela própria (PowerShell `Start-Process`, porta 8000, `PONTE_DB`/chaves exportadas, `alembic upgrade head` já aplicado), poste 3 ocorrências sintéticas com `curl` (uma em `g051_026` ×2, uma em `g052_031`), abra `http://localhost:8000/policia`, digite a chave, confira círculos no mapa, linhas na tabela de hotspots, **3 linhas na lista de ocorrências**, clique numa linha (o protocolo aparece em `#protocolo`) e faça uma mudança de status que aparece em `#aviso` e tira a linha do filtro `recebida`. Pare só o processo do `uvicorn` que você iniciou.
Expected: mapa com 2 círculos, tabela de hotspots com 2 linhas, lista de ocorrências com 3 linhas clicáveis, `PATCH` mostra "Status atualizado".

- [ ] **Step 6: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): painel /policia com hotspots, lista clicavel e mudanca de status"
```

---

### Task 8: Teste de contrato e documentação automática (P1)

**Files:**
- Create: `ponte-policia/tests/contrato/contrato.json`, `ponte-policia/tests/test_contrato.py`
- Modify: `ponte-policia/app/main.py`, `app/routers/*.py` (apenas `summary`/`description`/`responses` que faltarem)

**Interfaces:**
- Consumes: todos os schemas e rotas das tarefas 4–7.
- Produces: `contrato.json` (transcrição da seção "Ponte Polícia — rotas" dos contratos; é o artefato que o teste compara com o código) e o arquivo `ponte-policia/tests/contrato/exemplo_da_api.json`: o cliente da Ponte no plano 02 grava ali um exemplo serializado do corpo que envia (decisão da rodada 2); o teste de contrato o valida contra o schema, contra o detector de PII e contra o próprio `POST /ocorrencias`. Enquanto o plano 02 não gravar o arquivo, o teste dá skip (aceito só até o plano 02 terminar; a verificação final do plano 08 exige que ele exista).

- [ ] **Step 1: Criar `tests/contrato/contrato.json`**

```json
{
  "rotas": [["GET","/health"],["POST","/ocorrencias"],["GET","/ocorrencias"],["GET","/ocorrencias/{protocolo}/retorno"],
            ["PATCH","/ocorrencias/{protocolo}/status"],["GET","/hotspots"]],
  "seguranca": {"ChaveServico": "X-Chave-Servico", "ChavePolicia": "X-Chave-Policia"},
  "POST /ocorrencias": {
    "campos": ["origem_id","area_id","ts","tipo","origem_gatilho","device_hash","trilha"],
    "obrigatorios": ["origem_id","area_id","ts","tipo","origem_gatilho","device_hash"],
    "tipo": ["roubo_celular","furto_celular"],
    "origem_gatilho": ["chaveiro","web","guardiao","impacto"],
    "trilha_campos": ["lat","lng","em"],
    "resposta": ["protocolo","status"]},
  "retorno": ["protocolo","status","mensagem","atualizado_em"],
  "PATCH status": {"campos": ["status","mensagem"], "status": ["em_analise","atendida","descartada"]},
  "hotspot": ["area_id","lat","lng","total","risco_previsto"],
  "risco_previsto": ["baixo","medio","alto"],
  "resumo": ["protocolo","area_id","ts","tipo","status","origem_gatilho"],
  "exemplo": {"origem_id": "3f2b8c1e-5a4d-4e7b-9c1a-0d2e4f6a8b10", "area_id": "g051_026",
              "ts": "2026-11-16T11:30:00Z", "tipo": "roubo_celular", "origem_gatilho": "chaveiro",
              "device_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
              "trilha": [{"lat": -23.567249, "lng": -46.7019515, "em": "2026-11-16T11:31:00Z"}]}
}
```

- [ ] **Step 2: Escrever os testes que falham**

```python
# tests/test_contrato.py
import json, pathlib, pytest
from app.schemas import (OcorrenciaCriar, TrilhaPonto, ProtocoloResposta, RetornoResposta, StatusAtualizar,
                         HotspotResposta, OcorrenciaResumo)
from app.pii import detectar_pii

DIR = pathlib.Path(__file__).parent / "contrato"
C = json.loads((DIR / "contrato.json").read_text(encoding="utf-8"))

def props(m): return set(m.model_json_schema()["properties"])

def test_schema_do_post_igual_ao_contrato():
    s = OcorrenciaCriar.model_json_schema()
    assert set(s["properties"]) == set(C["POST /ocorrencias"]["campos"])
    assert set(s["required"]) == set(C["POST /ocorrencias"]["obrigatorios"])
    assert s["additionalProperties"] is False
    assert s["$defs"]["TipoOcorrencia"]["enum"] == C["POST /ocorrencias"]["tipo"]
    assert s["$defs"]["OrigemGatilho"]["enum"] == C["POST /ocorrencias"]["origem_gatilho"]
    assert props(TrilhaPonto) == set(C["POST /ocorrencias"]["trilha_campos"])

def test_schemas_de_resposta_iguais_ao_contrato():
    assert props(ProtocoloResposta) == set(C["POST /ocorrencias"]["resposta"])
    assert props(RetornoResposta) == set(C["retorno"])
    assert props(HotspotResposta) == set(C["hotspot"])
    assert props(OcorrenciaResumo) == set(C["resumo"])
    assert props(StatusAtualizar) == set(C["PATCH status"]["campos"])

def test_patch_aceita_so_os_tres_status_do_contrato():
    enum = StatusAtualizar.model_json_schema()["properties"]["status"]["enum"]
    assert enum == C["PATCH status"]["status"]

def test_rotas_do_openapi_iguais_ao_contrato(client):
    paths = client.get("/openapi.json").json()["paths"]
    achadas = {(m.upper(), p) for p, ops in paths.items() for m in ops}
    assert achadas == {tuple(r) for r in C["rotas"]}

def test_esquemas_de_seguranca_usam_os_cabecalhos_do_contrato(client):
    esq = client.get("/openapi.json").json()["components"]["securitySchemes"]
    assert {k: v["name"] for k, v in esq.items()} == C["seguranca"]
    assert all(v["in"] == "header" for v in esq.values())

def test_exemplo_do_contrato_e_aceito_e_sem_pii(client):
    from tests.fabrica import HS
    assert OcorrenciaCriar(**C["exemplo"]) and detectar_pii(C["exemplo"]) == []
    assert client.post("/ocorrencias", json=C["exemplo"], headers=HS).status_code == 201

def test_exemplo_gerado_pela_api_valida_no_schema(client):
    from tests.fabrica import HS
    arq = DIR / "exemplo_da_api.json"          # gravado pelo cliente da Ponte do plano 02
    if not arq.exists():
        pytest.skip("plano 02 ainda não gravou exemplo_da_api.json")
    ex = json.loads(arq.read_text(encoding="utf-8"))
    OcorrenciaCriar(**ex)
    assert detectar_pii(ex) == []
    assert client.post("/ocorrencias", json=ex, headers=HS).status_code in (200, 201)

def test_risco_previsto_so_assume_os_valores_do_contrato():
    from app.services.hotspot_service import risco_por_total
    assert [risco_por_total(n) for n in (1, 2, 4, 5, 9)] == ["baixo", "medio", "medio", "alto", "alto"]
    assert set(map(risco_por_total, range(1, 20))) == set(C["risco_previsto"])

def test_documentacao_automatica_completa(client):
    doc = client.get("/openapi.json").json()
    assert doc["info"]["title"] == "Ponte Polícia — Ampara" and doc["info"]["version"] == "1.0.0"
    for caminho, ops in doc["paths"].items():
        for metodo, op in ops.items():
            assert op.get("summary") and op.get("description"), f"{metodo} {caminho} sem summary/description"
            if caminho != "/health":
                assert "401" in op["responses"], f"{metodo} {caminho} sem resposta 401 documentada"
    assert client.get("/docs").status_code == 200
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_contrato.py -q`
Expected: pelo menos `test_documentacao_automatica_completa` ou `test_esquemas_de_seguranca...` falha se faltar `summary`/`description`/`responses`; os demais passam.

- [ ] **Step 4: Ajustar o que faltar na documentação**

Completar `summary`, `description` (em português) e `responses` (401, 404, 409, 422 conforme a rota) nas rotas; `description` do app com uma frase sobre o papel da Ponte e a regra "sem dado pessoal".

- [ ] **Step 5: Rodar a suíte inteira**

Run: `cd ponte-policia && python -m pytest tests -q`
Expected: todos passam (1 skip aceito: `exemplo_gerado_pela_api` enquanto o plano 02 não gravar `tests/contrato/exemplo_da_api.json`), 0 failed.

- [ ] **Step 6: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "test(ponte): contrato contra os schemas e documentacao OpenAPI completa"
```

---

### Task 9: Seed de demonstração sintético (P2)

**Files:**
- Create: `ponte-policia/scripts/seed_demo.py`
- Test: `ponte-policia/tests/test_seed.py`

**Interfaces:**
- Consumes: `app.area.area_id`, `app.schemas.OcorrenciaCriar`, `app.pii.detectar_pii`.
- Produces: `gerar_payloads(n: int, agora: datetime, chave_servico: str) -> list[dict]` (determinístico: `origem_id = uuid5(NAMESPACE_URL, f"ampara-seed-{i}")`, `device_hash = sha256(f"chaveiro-ampara-seed{i:03d}" + chave_servico)`, 3 focos sintéticos `# SINTETICO` — Pinheiros (−23.5672490, −46.7019515), Lapa (−23.5214, −46.7027), Brás (−23.5445, −46.6165) — com pequena dispersão, `ts` nos 50 min anteriores a `agora`, `trilha` de 2 pontos); `main()` (`python scripts/seed_demo.py --base http://localhost:8000 --n 12`, lê `PONTE_CHAVE_SERVICO` do ambiente, posta cada payload e imprime o resumo `201`/`200`).

- [ ] **Step 1: Escrever o teste que falha**

```python
# tests/test_seed.py
from tests.fabrica import AGORA, CHAVE_SERVICO
from scripts.seed_demo import gerar_payloads
from app.schemas import OcorrenciaCriar
from app.pii import detectar_pii

def test_payloads_validam_no_schema_e_sem_pii():
    ps = gerar_payloads(12, AGORA, CHAVE_SERVICO)
    assert len(ps) == 12
    for p in ps:
        assert OcorrenciaCriar(**p) and detectar_pii(p) == []

def test_ids_sao_estaveis_e_ha_ao_menos_3_areas():
    a, b = gerar_payloads(12, AGORA, CHAVE_SERVICO), gerar_payloads(12, AGORA, CHAVE_SERVICO)
    assert [p["origem_id"] for p in a] == [p["origem_id"] for p in b]
    assert len({p["area_id"] for p in a}) >= 3
    assert len({p["origem_id"] for p in a}) == 12
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd ponte-policia && python -m pytest tests/test_seed.py -q`
Expected: FAIL com `ModuleNotFoundError: No module named 'scripts'`.

- [ ] **Step 3: Implementar `scripts/seed_demo.py`**

Usar só biblioteca padrão para o POST (`urllib.request`) e `app.area.area_id` para calcular a área.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd ponte-policia && python -m pytest tests -q`
Expected: todos passam, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "feat(ponte): seed sintetico para a demonstracao"
```

---

### Task 10: README da pasta e evidências (P1)

**Files:**
- Create: `ponte-policia/README.md`
- Create: `ponte-policia/evidencias/openapi-docs.png`, `evidencias/painel-policia.png`, `evidencias/pytest.txt`, `evidencias/alembic.txt`, `evidencias/requisicoes.txt`, `evidencias/openapi.json`

**Interfaces:**
- Consumes: tudo das tarefas 1–8 (e a 9, se feita).
- Produces: os arquivos acima, referenciados pelo README e pelo PDF/vídeo do plano 08 (SOA).

- [ ] **Step 1: Escrever o README**

Seções, nesta ordem: (1) **Ficha da CitizenTech**: copiar a tabela da seção 0 da spec, sem alterar (o campo "Link do repositório" fica "(preencher ao publicar)"); (2) **O que é a Ponte Polícia** (3 frases: recebe ocorrência minimizada, mostra pontos quentes, devolve o andamento); (3) **Integrantes**: nomes completos do Pedro e do Vitor Cesarino Marchese (IoT, repositório em `iot/`) copiados do `integrantes.txt` da raiz (plano 01; não inventar, não deixar "preencher"); (4) **Arquitetura**: árvore de camadas e onde está o domínio (`dominio.py`, `models.py`); (5) **Como executar**: criar venv e instalar `requirements-dev.txt`; criar bancos `ponte`/`ponte_test`; variáveis `PONTE_DB`, `PONTE_CHAVE_SERVICO`, `PONTE_CHAVE_POLICIA` (cabeçalho `X-Chave-Policia`), `PONTE_DB_TEST` (descrição de cada uma, sem valores); `alembic upgrade head`; `uvicorn app.main:app --port 8000`; URLs `/docs`, `/openapi.json`, `/policia`; seed opcional; (6) **Rotas** (tabela dos contratos, com `GET /ocorrencias?status=`, erros 401/404/409/422 e a nota sobre `X-Forwarded-Prefix /ponte` atrás do nginx) e **estados** (`recebida → em_analise → atendida/descartada`); (7) **Privacidade**: o que a Ponte rejeita (CPF, e-mail, telefone, IMEI, nome) e que nunca grava nem loga o valor; (8) **Testes**: `python -m pytest tests -q` e `-m postgres`; (9) **Mapa da rubrica SOA** (estruturação do domínio → `models.py`/`dominio.py`; conexão com banco → `db.py`, `repositories/`; migrações → `alembic/versions/0001_inicial.py`; documentação automática → `/docs`; testes → `tests/`); (10) **Evidências** com links relativos para `evidencias/`.

- [ ] **Step 2: Gerar as evidências de texto**

Run (da pasta `ponte-policia`, com o venv ativo e as variáveis exportadas):
`python -m pytest tests -v > evidencias/pytest.txt 2>&1` e `python -m pytest tests -m postgres -v >> evidencias/pytest.txt 2>&1`; `alembic downgrade base && alembic upgrade head && alembic history && alembic current > evidencias/alembic.txt 2>&1`.
Expected: `evidencias/pytest.txt` termina com `passed` (sem `failed`); `evidencias/alembic.txt` mostra `0001 (head)`.

- [ ] **Step 3: Gerar as evidências do serviço no ar**

Suba o `uvicorn` em janela própria (PowerShell `Start-Process`, porta 8000) com `PONTE_DB`, `PONTE_CHAVE_SERVICO` e `PONTE_CHAVE_POLICIA` exportadas. Com o seed (`python scripts/seed_demo.py --n 12`) ou três `curl`, grave em `evidencias/requisicoes.txt` a saída de: `POST /ocorrencias` duas vezes (201 e depois 200 com o mesmo protocolo); `POST` com campo extra contendo CPF sintético (422 sem eco); `POST` sem chave (401); `GET /ocorrencias?status=recebida`; `PATCH` `em_analise` e `atendida`; `PATCH` inválido (409); `GET /hotspots`. Salve `curl -s http://localhost:8000/openapi.json > evidencias/openapi.json`.
Expected: `requisicoes.txt` contém `201`, `200`, `422`, `401` e `409` e a lista de `GET /ocorrencias`; nenhum CPF/telefone literal aparece em respostas.

- [ ] **Step 4: Gerar os prints**

No navegador do app (ferramenta Playwright/Browser do Claude), abra `http://localhost:8000/docs`, expanda `POST /ocorrencias` e salve `evidencias/openapi-docs.png`; abra `/policia`, entre com a chave, e salve `evidencias/painel-policia.png` mostrando mapa, tabela e um `#aviso` de status atualizado. Pedro tira um print do terminal com o `pytest -v` final (anexa ao PDF do plano 08). Pare o `uvicorn` (só o PID iniciado por você).
Expected: duas imagens não vazias (> 20 KB cada); o painel mostra pelo menos 2 círculos.

- [ ] **Step 5: Conferir o README**

Run: `cd ponte-policia && grep -c "Vitor Cesarino Marchese" README.md && grep -c "PONTE_CHAVE_SERVICO" README.md && grep -c "alembic upgrade head" README.md && grep -c "evidencias/" README.md`
Expected: cada contagem ≥ 1. Confirme também que o README não contém senhas nem chaves.

- [ ] **Step 6: Commit**

```bash
git add ponte-policia prompts.md
git commit -m "docs(ponte): README, evidencias de OpenAPI, painel, testes e migracoes"
```

---

## Auto-revisão

**Cobertura da spec (6.1, 7.2, 9) e do briefing (PDF p.27):** camadas routers/services/repositories/schemas → T2, T4–T7; SQLAlchemy 2 + psycopg + Alembic, banco `ponte` → T2; estados da ocorrência → T1, T2, T5; idempotência por `origem_id` → T4; rejeição de PII (422) com detector próprio → T3, T4; hotspots por janela → T6; retorno → T5; `X-Chave-Servico` e `X-Chave-Policia` → T4–T6; painel `/policia` (Jinja2 + Leaflet, mudar status) → T7; pytest unitário + contrato → T3–T8; OpenAPI/Swagger → T8; README com execução, variáveis e integrantes + evidências → T10; `TrilhaPosRoubo` → T2, T4; `device_hash` → T4 (validação de formato) e `fabrica.py`. Rubrica: domínio (T1–T2), banco (T2), migrações (T2, T10), documentação (T8), testes (todas).

**Tipos e nomes conferidos entre tarefas:** `Ocorrencia.receber/atribuir_protocolo/mudar_status/retorno_atual` (T2) são usados por `OcorrenciaService.registrar/atualizar_status/obter_retorno` (T4, T5); `exigir_chave_servico/exigir_chave_policia/rejeitar_pii` (T4) são usados em T5–T6; `Hotspot`, `centro` (T1) e `contar_por_area` (T6); `RetornoResposta`, `StatusAtualizar`, `HotspotResposta` (T5, T6) são os mesmos nomes de `test_contrato.py` (T8).

**Proporção:** a spec define a Ponte em ~10 linhas; o plano cresce porque decide sozinho nomes, assinaturas, testes e valores que o executor não pode inventar. Os blocos de código são testes; nenhum corpo de produção foi escrito.

## Lacunas de contrato (fechadas na rodada 2 do arquivo de contratos)

1. **Variável da chave da polícia:** `PONTE_CHAVE_POLICIA` (cabeçalho `X-Chave-Policia`) agora consta nos contratos; entra no `.env.example` (plano 01) e na VM (plano 07).
2. **Listagem para o painel:** `GET /ocorrencias?status=` (`X-Chave-Policia`) → `[{protocolo, area_id, ts, tipo, status, origem_gatilho}]` está nos contratos; a Task 5 implementa e a Task 7 usa na lista clicável.
3. **`risco_previsto` em `/hotspots`:** `baixo|medio|alto` pelo total na janela (1 = baixo, 2–4 = medio, ≥ 5 = alto); área `fora` não aparece. Implementado em `risco_por_total` (Task 6) e conferido na Task 8.
4. **Erros:** chave ausente ou errada 401; protocolo inexistente 404; transição inválida 409; PII 422 `{detail, achados: [{campo, classe}]}` (a Ponte também detecta `Nome`, classe só dela).
5. **Prefixo do nginx para o painel:** `location /ponte/` → Ponte; `location /policia` → Ponte com `proxy_set_header X-Forwarded-Prefix /ponte`; o painel monta as URLs com esse prefixo (Task 7). O plano 07 configura o nginx.
6. **Fixture compartilhada API → Ponte:** o cliente da Ponte (plano 02) grava o exemplo serializado em `ponte-policia/tests/contrato/exemplo_da_api.json`; a Task 8 o valida.
7. **Grade:** limites superiores exclusivos (`lat >= -23.35` ou `lng >= -46.36` → `fora`), igual em C# e Python; testado na Task 1.
