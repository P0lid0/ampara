# Ponte Polícia (Ampara)

## 1. Ficha da CitizenTech

| Campo | Valor |
|---|---|
| Nome | **Ampara** — "Levaram seu celular. Não levam o resto." [Pedro] |
| Cidade e bairro | São Paulo, capital: eixo da CPTM Linha 9-Esmeralda (Pinheiros como estação crítica) e corredores de quebra-vidro (ex.: Av. do Estado) |
| Cidadão beneficiado | Quem anda com o celular em SP (passageiro de trem/metrô, motorista parado no trânsito) e o **guardião** (parente ou amigo que age por ele na hora) |
| Problema, em uma frase | Depois de um roubo de celular, a vítima fica de 30 a 90 minutos sem aparelho e em choque até chegar em casa ou no trabalho, e é nessa janela que os criminosos entram no banco e nas contas. |
| Como funciona | Antes: o app guarda o que a vítima não lembraria na hora (IMEI, bancos, operadora, guardiões) e a rota dos últimos 7 dias. Durante: um clique no chaveiro (ESP32) ou um código digitado em outro aparelho dispara um alarme insistente no celular do guardião, que segue um passo a passo de bloqueio enquanto a vítima ainda está a caminho. Depois: por outro aparelho, a vítima marca na rota onde e quando foi roubada e o Ampara gera o BO com o IMEI; a ocorrência, minimizada e com consentimento, vai para um painel da polícia (simulado), e o andamento volta ao cidadão. Um mapa mostra o risco previsto por um modelo treinado com dados da SSP-SP e relatos das últimas 2 horas com proteção contra abuso. O Ampara não bloqueia o celular: avisa quem pode bloquear contas e linha. |
| O que cada parte faz | **App** (Expo): cadastro, guardiões, alarme, mapa, histórico de rota, BO. **Página de emergência** (web): acesso por outro aparelho. **API Ampara** (C#/.NET): regras, dados, tempo real, escuta do chaveiro por MQTT, motor PII e taint. **Ponte Polícia** (Python/FastAPI): recebe ocorrências minimizadas e mostra pontos quentes à polícia. **ML** (Python): risco por área e horário. **Chaveiro** (ESP32/Wokwi, Vitor): botão de pânico que fala por MQTT com a API. **VM Linux**: provisiona e mantém tudo no ar. **Painel Risco Cidadão**: bloqueios de segurança traduzidos por IA. |
| Link do repositório | (preencher ao publicar) |
| Indicador de impacto | minutos entre o roubo e o primeiro bloqueio confirmado pelo guardião; % de BOs gerados com IMEI válido; tempo para gerar o BO |
| ODS conectados | **11, 10, 9** (na lista do briefing) e **16** (adicional, fora da lista do briefing) — explicação por meta na seção 13 [Claude] |

## 2. O que é a Ponte Polícia

A Ponte Polícia é um serviço FastAPI separado da API da Ampara, com banco próprio (`ponte`). Ela recebe a ocorrência já minimizada (área da grade de ~500 m, horário, tipo, `device_hash` e, com consentimento, a trilha), sem nenhum dado pessoal, e mostra à polícia os pontos quentes em um painel web (`/policia`). Depois a polícia muda o status e escreve uma mensagem, e a API da Ampara lê esse retorno pelo protocolo e o repassa ao cidadão.

## 3. Integrantes

- Pedro Martins (RM_____, pendente)
- Vitor Cesarino Marchese (RM_____, pendente), responsável pelo IoT (repositório em `iot/`)

## 4. Arquitetura

```
ponte-policia/
├── app/
│   ├── main.py             # create_app(): registra handlers e routers
│   ├── routers/            # HTTP: ocorrencias, hotspots, painel (/policia), health
│   ├── services/           # regras de aplicação: OcorrenciaService, HotspotService
│   ├── repositories/       # acesso ao banco (SQLAlchemy): ocorrencia_repository
│   ├── schemas.py          # contratos de entrada e saída (Pydantic)
│   ├── dominio.py          # DOMÍNIO: status, tipo, origem, transições, erros, Hotspot
│   ├── models.py           # DOMÍNIO persistido: Ocorrencia, TrilhaPosRoubo, Retorno
│   ├── area.py             # grade de ~500 m (area_id, centro, area_valida)
│   ├── pii.py              # detector de dado pessoal próprio da Ponte
│   ├── security.py         # chaves X-Chave-Servico / X-Chave-Policia e rejeição de PII
│   ├── db.py, config.py    # engine, sessão e variáveis de ambiente
│   └── templates/policia.html
├── alembic/versions/       # migrações 0001_inicial e 0002_mensagem_500
├── scripts/seed_demo.py    # seed sintético para a demonstração
├── tests/                  # pytest (unitário, API, contrato, PostgreSQL)
└── evidencias/             # saídas reais dos testes, migração, requisições e prints
```

Fluxo: `routers` recebem e validam, `services` aplicam a regra, `repositories` falam com o banco e `dominio.py`/`models.py` guardam as regras do negócio (por exemplo, `Ocorrencia.mudar_status` consulta a matriz de transições).

## 5. Como executar

Pré-requisitos: Python 3.13 e um PostgreSQL.

```bash
cd ponte-policia
python -m venv .venv
source .venv/Scripts/activate        # Windows (Git Bash); no Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
```

Crie os bancos `ponte` e `ponte_test` (usuário com permissão de criar tabelas) e defina as variáveis de ambiente. Nenhum valor fica no repositório (modelo em `.env.example`):

| Variável | Para que serve |
|---|---|
| `PONTE_DB` | URL SQLAlchemy do banco da Ponte, no formato `postgresql+psycopg://usuario:senha@host:porta/ponte` |
| `PONTE_CHAVE_SERVICO` | Chave que a API da Ampara envia em `X-Chave-Servico` para criar ocorrência e ler o retorno |
| `PONTE_CHAVE_POLICIA` | Chave da polícia, enviada em `X-Chave-Policia` (listar, mudar status, hotspots) e digitada no painel |
| `PONTE_DB_TEST` | URL do banco `ponte_test`, usado só pelos testes marcados `postgres` |

```bash
alembic upgrade head                      # cria as tabelas
uvicorn app.main:app --port 8000          # sobe o serviço
```

URLs: `http://localhost:8000/docs` (Swagger), `http://localhost:8000/openapi.json` e `http://localhost:8000/policia` (painel; peça a chave da polícia ao responsável pela implantação).

Seed opcional, com dados sintéticos (o banco deve estar recém-criado, porque o horário é relativo ao momento da execução):

```bash
python scripts/seed_demo.py --base http://localhost:8000 --n 12
```

## 6. Rotas e estados

| Método e rota | Chave | Para que serve | Respostas |
|---|---|---|---|
| `GET /health` | nenhuma | Verifica se a Ponte está no ar | 200 |
| `POST /ocorrencias` | `X-Chave-Servico` | Registra a ocorrência, idempotente por `origem_id` | 201 (nova), 200 (já existia, mesmo protocolo), 401, 422 |
| `GET /ocorrencias?status=` | `X-Chave-Policia` | Lista para o painel (mais recentes primeiro, filtro opcional) | 200, 401, 422 |
| `GET /ocorrencias/{protocolo}/retorno` | `X-Chave-Servico` | Status e mensagem atuais, para repassar ao cidadão | 200, 401, 404 |
| `PATCH /ocorrencias/{protocolo}/status` | `X-Chave-Policia` | Muda o status e grava a mensagem | 200, 401, 404, 409, 422 |
| `GET /hotspots?janela_min=60` | `X-Chave-Policia` | Áreas mais ativas na janela (1 a 10080 min), com `risco_previsto` | 200, 401, 422 |
| `GET /policia` | nenhuma (a chave é pedida no navegador) | Painel HTML com mapa, tabelas e formulário | 200 |

Erros: 401 chave ausente ou errada; 404 protocolo inexistente; 409 transição de status não permitida; 422 payload inválido ou com dado pessoal (`{detail, achados: [{campo, classe}]}`, sem o valor encontrado).

Atrás do nginx da VM, `/ponte/` aponta para a Ponte e `/policia` também, com `X-Forwarded-Prefix /ponte`; o painel usa esse prefixo para montar as URLs das chamadas.

Estados da ocorrência: `recebida → em_analise → atendida` ou `descartada`. Não há volta, e `atendida` e `descartada` são finais.

## 7. Privacidade

A Ponte rejeita com 422 qualquer payload (e qualquer mensagem de retorno) que contenha CPF, e-mail, telefone, IMEI ou nome, inclusive em campos extras. A resposta informa só o campo e a classe do achado, e a Ponte nunca grava nem escreve em log o valor encontrado. O `device_hash` é um SHA-256 (64 hex) e não aparece na listagem nem nos hotspots.

## 8. Testes

```bash
python -m pytest tests -q                 # suíte completa (os testes de PostgreSQL ficam ignorados sem PONTE_DB_TEST)
python -m pytest tests -m postgres -v     # migração real no PostgreSQL (exige PONTE_DB_TEST)
```

## 9. Mapa da rubrica de SOA

| Item da rubrica | Onde está |
|---|---|
| Estruturação do domínio | `app/models.py`, `app/dominio.py` (e `app/area.py`) |
| Conexão com banco de dados | `app/db.py`, `app/repositories/` |
| Migrações | `alembic/versions/0001_inicial.py` (mais `0002_mensagem_500.py`) |
| Documentação automática | `/docs` e `/openapi.json` (cópia em `evidencias/openapi.json`) |
| Testes | `tests/` |

## 10. Evidências

- [Swagger com `POST /ocorrencias` expandido](evidencias/openapi-docs.png)
- [Painel `/policia` com mapa, tabelas e aviso de status atualizado](evidencias/painel-policia.png)
- [Saída do pytest (suíte completa e testes PostgreSQL)](evidencias/pytest.txt)
- [Migração Alembic: downgrade, upgrade e histórico](evidencias/alembic.txt)
- [Requisições reais (201, 200, 422, 401, 409, listagem, hotspots)](evidencias/requisicoes.txt)
- [OpenAPI gerado pelo serviço no ar](evidencias/openapi.json)

Todas as evidências usam dados sintéticos e não registram chaves nem valores do `.env`.
