#!/usr/bin/env bash
# Executor geral: shellcheck, cada teste-*.sh e, se existir, o teste PowerShell da VM.
set -uo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$RAIZ" || exit 1

falhas=0
SAIDA=$(mktemp)
trap 'rm -f "$SAIDA"' EXIT

roda() { # <rotulo> <comando...>
  local rotulo=$1
  shift
  if "$@" > "$SAIDA" 2>&1; then
    echo "OK $rotulo"
  else
    echo "FALHOU $rotulo"
    sed 's/^/    /' "$SAIDA"
    falhas=$((falhas + 1))
  fi
}

roda infra/tests/shellcheck.sh bash infra/tests/shellcheck.sh

for t in infra/tests/teste-*.sh; do
  [ -e "$t" ] || continue
  roda "$t" bash "$t"
done

if [ -f infra/tests/teste-criar-vm.ps1 ]; then
  ps=""
  if command -v powershell >/dev/null 2>&1; then
    ps=powershell
  elif command -v powershell.exe >/dev/null 2>&1; then
    ps=powershell.exe
  fi
  if [ -n "$ps" ]; then
    roda infra/tests/teste-criar-vm.ps1 "$ps" -NoProfile -File infra/tests/teste-criar-vm.ps1
  else
    echo "PULADO infra/tests/teste-criar-vm.ps1 (sem PowerShell neste ambiente)"
  fi
fi

if [ "$falhas" -ne 0 ]; then
  echo "TOTAL: $falhas falha(s)"
  exit 1
fi
echo "TOTAL: tudo OK"
