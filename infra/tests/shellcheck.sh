#!/usr/bin/env bash
# Roda o shellcheck (sem avisos) em todos os scripts da infra.
set -euo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$RAIZ"

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "FALHOU: shellcheck nao instalado (scoop install shellcheck)"
  exit 1
fi

shellcheck -x -P SCRIPTDIR infra/vm/*.sh infra/tests/*.sh
echo "PASSOU shellcheck"
