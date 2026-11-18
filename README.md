# Ampara

*Levaram seu celular. Não levam o resto.*

| Campo | Valor |
|---|---|
| Nome | **Ampara** — "Levaram seu celular. Não levam o resto." |
| Cidade e bairro | São Paulo, capital: eixo da CPTM Linha 9-Esmeralda (Pinheiros como estação crítica) e corredores de quebra-vidro (ex.: Av. do Estado) |
| Cidadão beneficiado | Quem anda com o celular em SP (passageiro de trem/metrô, motorista parado no trânsito) e o **guardião** (parente ou amigo que age por ele na hora) |
| Problema, em uma frase | Depois de um roubo de celular, a vítima fica de 30 a 90 minutos sem aparelho e em choque até chegar em casa ou no trabalho, e é nessa janela que os criminosos entram no banco e nas contas. |
| Como funciona | Antes: o app guarda o que a vítima não lembraria na hora (IMEI, bancos, operadora, guardiões) e a rota dos últimos 7 dias. Durante: um clique no chaveiro (ESP32) ou um código digitado em outro aparelho dispara um alarme insistente no celular do guardião, que segue um passo a passo de bloqueio enquanto a vítima ainda está a caminho. Depois: por outro aparelho, a vítima marca na rota onde e quando foi roubada e o Ampara gera o BO com o IMEI; a ocorrência, minimizada e com consentimento, vai para um painel da polícia (simulado), e o andamento volta ao cidadão. Um mapa mostra o risco previsto por um modelo treinado com dados da SSP-SP e relatos das últimas 2 horas com proteção contra abuso. O Ampara não bloqueia o celular: avisa quem pode bloquear contas e linha. |
| O que cada parte faz | **App** (Expo): cadastro, guardiões, alarme, mapa, histórico de rota, BO. **Página de emergência** (web): acesso por outro aparelho. **API Ampara** (C#/.NET): regras, dados, tempo real, escuta do chaveiro por MQTT, motor PII e taint. **Ponte Polícia** (Python/FastAPI): recebe ocorrências minimizadas e mostra pontos quentes à polícia. **ML** (Python): risco por área e horário. **Chaveiro** (ESP32/Wokwi, Vitor): botão de pânico que fala por MQTT com a API. **VM Linux**: provisiona e mantém tudo no ar. **Painel Risco Cidadão**: bloqueios de segurança traduzidos por IA. |
| Link do repositório | https://github.com/P0lid0/ampara |
| Indicador de impacto | minutos entre o roubo e o primeiro bloqueio confirmado pelo guardião; % de BOs gerados com IMEI válido; tempo para gerar o BO |
| ODS conectados | **11, 10, 9** (na lista do briefing) e **16** (adicional, fora da lista do briefing) — explicação por meta em [docs/ods.md](docs/ods.md) |

## ODS

Detalhes por meta em [docs/ods.md](docs/ods.md).

- **11 — metas 11.2 e 11.7**: transporte e espaços públicos mais seguros (mapa de risco, relatos, recorte da Linha 9).
- **10 — meta 10.2**: o transporte coletivo concentra os furtos e atende quem tem menos alternativa; app gratuito e acessível.
- **9 — meta 9.c**: tecnologia acessível e dados abertos aplicados a um problema urbano.
- **16 — metas 16.1 e 16.6** (adicional, fora da lista do briefing, mantido por ser o mais aderente): BO com dados corretos, ocorrência minimizada para a polícia, retorno ao cidadão.

## Estrutura do repositório

| Pasta | O que é | Disciplina |
|---|---|---|
| `app/` | App Expo (Android): cadastro, guardiões, alarme, mapa, rota, BO | Mobile |
| `web-emergencia/` | Página de emergência (React + Vite), acesso por outro aparelho | Apoio |
| `api/` | API Ampara em C#/.NET, MQTT, SignalR, motor PII e taint | Engenharia de software (.NET) e Cyber |
| `ponte-policia/` | Ponte Polícia em Python/FastAPI | SOA |
| `ml/` | Modelo de risco por área e horário | IA & ML |
| `iot/` | Chaveiro ESP32/Wokwi (submódulo, repositório do Vitor) | Physical Computing |
| `infra/` | VM Linux, provisionamento e evidências (`infra/evidencias/`) | Infraestrutura |
| `cyber/` | Código e testes de ataque (o PDF não entra no repositório) | Cyber |
| `qa/` | Roteiros, matriz Feature × TC e ferramentas de teste | Testing |
| `docs/` | Fontes, entrevistas, rascunhos em papel, ODS, riscos do dia 1 | Todas |

## Como rodar

Cada pasta tem o seu `README.md` com os passos: [app](app/README.md), [web-emergencia](web-emergencia/README.md), [api](api/README.md), [ponte-policia](ponte-policia/README.md), [ml](ml/README.md), [infra](infra/README.md), [cyber](cyber/README.md), [qa](qa/README.md) e [iot](iot/README.md). Variáveis de ambiente: `.env.example`.

## Integrantes

Guilherme (RM 554962), Pedro Martins (RM 555556), Fabrício (RM 558216), Vitor Cesarino Marchese (RM 554893) e Matheus (RM 555447) (veja [integrantes.txt](integrantes.txt)). Prompts de IA em [prompts.md](prompts.md).
