#!/usr/bin/env bash
# Healthcheck da API: sai 0 quando /health responde 200 com "status":"ok" ou "degradado"
# dentro do prazo (broker MQTT fora = degradado, e isso nao impede a subida).
# Uso: ampara-healthcheck.sh [timeout_s=120]
# Variaveis: HEALTH_URL (de vm.conf) e HEALTH_CMD (para testes).
set -euo pipefail

CONF="${AMPARA_VM_CONF:-/etc/ampara/vm.conf}"
if [[ -z "${HEALTH_URL:-}" && -r "$CONF" ]]; then
  # shellcheck disable=SC1090
  source "$CONF"
fi
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5080/health}"
export HEALTH_URL

PRAZO="${1:-120}"
if ! [[ "$PRAZO" =~ ^[0-9]+$ ]]; then
  echo "Uso: ampara-healthcheck.sh [timeout_s]" >&2
  exit 64
fi
CMD="${HEALTH_CMD:-curl -fsS --max-time 3 \"\$HEALTH_URL\"}"

saudavel() {
  [[ "$1" =~ \"status\"[[:space:]]*:[[:space:]]*\"(ok|degradado)\" ]]
}

corpo=""
inicio=$SECONDS
while true; do
  # curl -f falha em 503 (banco fora); o corpo so e aceito se o comando passou.
  if corpo="$(bash -c "$CMD" 2>/dev/null)" && saudavel "$corpo"; then
    echo "API saudavel: $corpo"
    exit 0
  fi
  if (( SECONDS - inicio >= PRAZO )); then
    break
  fi
  sleep 1
done

echo "API nao ficou saudavel em ${PRAZO}s em ${HEALTH_URL}. Ultimo corpo: ${corpo:-<vazio>}"
exit 1
