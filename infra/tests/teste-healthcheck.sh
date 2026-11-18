#!/usr/bin/env bash
# Testa ampara-healthcheck.sh: so 200 com status ok/degradado conta como saudavel.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HC="$RAIZ/infra/vm/ampara-healthcheck.sh"

falhou() { echo "FALHOU: $1"; exit 1; }

# Roda o healthcheck sem vm.conf do sistema; devolve o codigo de saida em RC.
roda() {
  local cmd="$1" prazo="$2"
  RC=0
  AMPARA_VM_CONF=/nao/existe HEALTH_CMD="$cmd" bash "$HC" "$prazo" >/dev/null 2>&1 || RC=$?
}

[[ -f "$HC" ]] || falhou "ampara-healthcheck.sh nao existe"

roda "echo '{\"status\":\"degradado\",\"mqtt\":false,\"db\":true}'" 5
[[ "$RC" -eq 0 ]] || falhou "degradado (broker fora) deve sair 0, saiu $RC"

roda "echo '{\"status\":\"ok\",\"mqtt\":true,\"db\":true}'" 5
[[ "$RC" -eq 0 ]] || falhou "ok deve sair 0, saiu $RC"

roda "echo '{\"status\": \"ok\", \"mqtt\": true}'" 5
[[ "$RC" -eq 0 ]] || falhou "ok com espacos no JSON deve sair 0, saiu $RC"

inicio=$SECONDS
roda "false" 2
dur=$((SECONDS - inicio))
[[ "$RC" -eq 1 ]] || falhou "comando falhando deve sair 1, saiu $RC"
[[ "$dur" -ge 2 ]] || falhou "deveria esperar ao menos 2 s, esperou ${dur}s"

roda "echo '{\"status\":\"falha\",\"mqtt\":true,\"db\":false}'" 2
[[ "$RC" -eq 1 ]] || falhou "status falha deve sair 1, saiu $RC"

roda "echo 'qualquer coisa'" 1
[[ "$RC" -eq 1 ]] || falhou "corpo desconhecido deve sair 1, saiu $RC"

# Recupera no meio do prazo: falha 2 vezes e depois responde ok.
marca="$(mktemp)"
trap 'rm -f "$marca"' EXIT
roda "n=\$(wc -c < '$marca'); echo x >> '$marca'; if [ \"\$n\" -lt 2 ]; then exit 1; fi; echo '{\"status\":\"ok\"}'" 10
[[ "$RC" -eq 0 ]] || falhou "deve passar quando a API sobe dentro do prazo, saiu $RC"

echo "PASSOU: teste-healthcheck.sh"
