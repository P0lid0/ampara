#!/usr/bin/env bash
# Review Focus 1: nenhum arquivo da infra pode ter CR (CRLF quebra bash e #cloud-config).
set -euo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$RAIZ"

# O CR vem de printf: $'\r' dentro de $(...) vira padrao vazio no bash do Git for Windows.
CR=$(printf '\r')
ruins=$(grep -rlU "$CR" infra --exclude-dir=.vm --exclude-dir=evidencias || true)
if [ -n "$ruins" ]; then
  echo "FALHOU: arquivos com CR (CRLF) em infra/:"
  echo "$ruins"
  exit 1
fi
echo "PASSOU teste-eol"
