#!/usr/bin/env bash
# Verifica a fundacao do monorepo. Uso: bash qa/verificar-fundacao.sh [--final]
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
falhas=0
checa() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "OK    $desc"; else echo "FALHA $desc"; falhas=$((falhas+1)); fi
}

# pastas e READMEs (iot/ e do Vitor: so precisa existir)
for d in app web-emergencia api ponte-policia ml infra cyber qa docs; do checa "README em $d" test -s "$ROOT/$d/README.md"; done
checa "infra/evidencias" test -d "$ROOT/infra/evidencias"
checa "iot e submodulo" bash -c 'out="$(git -C "$0" submodule status iot)"; [ -n "$out" ] && [ "${out:0:1}" != "-" ]' "$ROOT"
# README raiz: ficha antes de qualquer outra secao, com os campos da secao 0 e os ODS
checa "ficha no topo" awk '/^\| Campo \| Valor \|/{f=1; ok=(NR<=12); exit} END{exit !(f && ok)}' "$ROOT/README.md"
for c in "Nome" "Cidade e bairro" "Cidadão beneficiado" "Problema, em uma frase" "Como funciona" \
         "O que cada parte faz" "Link do repositório" "Indicador de impacto" "ODS conectados"; do
  checa "ficha: $c" grep -q "| $c |" "$ROOT/README.md"; done
checa "tagline" grep -qF "Levaram seu celular. Não levam o resto." "$ROOT/README.md"
for o in "11.2" "11.7" "10.2" "9.c" "16.1" "16.6"; do checa "ODS meta $o" grep -q "$o" "$ROOT/README.md"; done
# integrantes e prompts
checa "integrantes Pedro" grep -q "Pedro" "$ROOT/integrantes.txt"
checa "docs/ods.md cita as metas" bash -c 'for o in 11.2 11.7 10.2 9.c 16.1 16.6; do grep -q "$o" "$0" || exit 1; done' "$ROOT/docs/ods.md"
checa "docs/rascunhos existe" test -d "$ROOT/docs/rascunhos"
checa "integrantes Vitor" grep -q "Vitor Cesarino Marchese" "$ROOT/integrantes.txt"
checa "prompts do Vitor copiados (bloco inteiro)" bash -c 'grep -v "^[[:space:]]*$" "$0/iot/prompts.md" | while IFS= read -r l; do grep -qxF -- "$l" "$0/prompts.md" || exit 1; done' "$ROOT"
# o que NAO pode ir para o git
for p in .env .env.local app/node_modules/x ml/dados/brutos/ssp/ssp.xlsx infra/vm/imagens/a.img x.qcow2 \
         cyber/relatorio.pdf entrega/cyber/ampara-cyber.pdf entrega/testing/ampara-testing.pdf qa/.venv/x qa/spikes/gps-background/android/x; do
  checa "ignora $p" git -C "$ROOT" check-ignore -q "$p"; done
for p in .env.example ml/saida/risco.csv infra/evidencias/print.png; do
  checa "NAO ignora $p" bash -c '! git -C "$0" check-ignore -q "$1"' "$ROOT" "$p"; done
# .env.example: 14 variaveis; segredos vazios; padroes do contrato
for v in AMPARA_DB AMPARA_JWT_SECRET AMPARA_CRYPTO_KEY AMPARA_DEMO RISCO_CSV MQTT_HOST MQTT_PORT PONTE_URL \
         PONTE_CHAVE_SERVICO PONTE_CHAVE_POLICIA PONTE_DB ANTHROPIC_API_KEY ANTHROPIC_MODEL EXPO_PUBLIC_API_URL; do
  checa "var $v" grep -q "^$v=" "$ROOT/.env.example"; done
for v in AMPARA_JWT_SECRET AMPARA_CRYPTO_KEY ANTHROPIC_API_KEY PONTE_CHAVE_SERVICO PONTE_CHAVE_POLICIA; do
  checa "segredo $v vazio" grep -qx "$v=" "$ROOT/.env.example"; done
checa "sem chave real" bash -c '! grep -Eq "sk-ant|Password=[^;[:space:]]" "$0"' "$ROOT/.env.example"
checa "MQTT_HOST padrao" grep -qx "MQTT_HOST=broker.hivemq.com" "$ROOT/.env.example"
checa "modelo padrao" grep -qx "ANTHROPIC_MODEL=claude-haiku-5-5" "$ROOT/.env.example"
# fim de linha LF em scripts e cloud-init
for f in qa/x.sh infra/spike/user-data.tpl infra/spike/meta-data qa/spikes/x.py; do
  checa "eol=lf $f" bash -c '[ "$(git -C "$0" check-attr eol -- "$1" | sed "s/.*: //")" = "lf" ]' "$ROOT" "$f"; done
# .NET e git
checa "global.json fixa 11.0.100" grep -q '"version": "11.0.100"' "$ROOT/global.json"
checa "dotnet do scoop e 11.0.x" bash -c 'cd "$0" && "$HOME/scoop/apps/dotnet-sdk/current/dotnet.exe" --version | grep -q "^11\.0\."' "$ROOT"
checa "branch main" test "$(git -C "$ROOT" branch --show-current)" = "main"
# docs
checa "entrevistas: 2 modelos" test "$(grep -c '^## Entrevista ' "$ROOT/docs/entrevistas.md")" -ge 2
checa "entrevistas: aviso de anonimato" grep -qi "não identifique" "$ROOT/docs/entrevistas.md"
checa "fontes: cabecalho" grep -qF "| Fonte | Link | Data de acesso | Usado para |" "$ROOT/docs/fontes.md"
for id in net-target a-emulador-gps b-mqtt c-ssp d-vm e-wokwi; do checa "riscos: $id" grep -q "| $id |" "$ROOT/docs/riscos-dia1.md"; done
# --final: nenhuma linha de risco pode continuar PENDENTE
if [ "${1:-}" = "--final" ]; then
  checa "sem PENDENTE (tabela)" bash -c '! grep -q "| PENDENTE |" "$0"' "$ROOT/docs/riscos-dia1.md"
  checa "sem PENDENTE (chave: valor)" bash -c '! grep -Eq "^(TargetFramework|ExpoSDK|SSP_VEREDITO|SSP_CELULAR|MQTT_HOST_EFETIVO|VM): *PENDENTE" "$0"' "$ROOT/docs/riscos-dia1.md"
  checa "integrantes sem RM_____ (preencher)" bash -c '! grep -q "RM_____" "$0"' "$ROOT/integrantes.txt"
fi

echo "falhas: $falhas"
[ "$falhas" -eq 0 ] || exit 1
