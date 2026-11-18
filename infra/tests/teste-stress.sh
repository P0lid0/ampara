#!/usr/bin/env bash
# Testa a lógica pura de infra/vm/stress.sh (o resto roda só dentro da VM).
set -euo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
STRESS="$RAIZ/infra/vm/stress.sh"
FALHA="$RAIZ/infra/vm/teste-falha.sh"
# shellcheck source=lib-teste.sh
source "$RAIZ/infra/tests/lib-teste.sh"

if [ ! -f "$STRESS" ]; then
  echo "FALHOU: infra/vm/stress.sh nao existe"
  exit 1
fi

# shellcheck source=../vm/stress.sh
source "$STRESS"

assert_igual 368640000 "$(bytes_para_alvo 1000000 500000 85)" "bytes para chegar a 86% de 1000000 kB com 500000 usados"
assert_igual 0 "$(bytes_para_alvo 1000000 900000 85)" "ja acima do alvo: 0 bytes"
assert_igual 0 "$(bytes_para_alvo 1000000 860000 85)" "exatamente em alvo+1: 0 bytes"
assert_igual 1024 "$(bytes_para_alvo 1000000 859999 85)" "falta 1 kB"

# source nao executa nada, nem do teste-falha.sh
if [ -f "$FALHA" ]; then
  # shellcheck source=../vm/teste-falha.sh
  source "$FALHA"
  if ! declare -F cenario_api >/dev/null; then
    echo "FALHOU: teste-falha.sh deve definir cenario_api"
    exit 1
  fi
else
  echo "FALHOU: infra/vm/teste-falha.sh nao existe"
  exit 1
fi

echo "PASSOU teste-stress"
