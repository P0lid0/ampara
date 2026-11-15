#!/usr/bin/env bash
# Confere se todas as evidencias das entregas do professor de Cyber existem.
# Sai com 1 e lista o que falta; sai com 0 quando esta tudo no lugar.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EV="$RAIZ/cyber/evidencias"
falta=()

for f in precisao-recall.md ataques.md; do
  [ -s "$EV/$f" ] || falta+=("cyber/evidencias/$f")
done

n=$(find "$EV/prints" -maxdepth 1 -name 'codigo-*.png' -size +0 2>/dev/null | wc -l)
[ "$n" -ge 8 ] || falta+=("prints de codigo: $n de 8 (cyber/evidencias/prints/codigo-*.png)")

for p in painel-verde painel-amarelo painel-vermelho painel-executiva; do
  [ -s "$EV/prints/$p.png" ] || falta+=("cyber/evidencias/prints/$p.png")
done

DOC="$RAIZ/cyber/documentacao.md"
if [ ! -s "$DOC" ]; then
  falta+=("cyber/documentacao.md")
else
  for t in "Parsing PII" "Taint Analysis" "IA na remediação" "Painel Risco Cidadão"; do
    grep -q "^#.*$t" "$DOC" || falta+=("titulo '$t' em cyber/documentacao.md")
  done
fi

if [ "${#falta[@]}" -gt 0 ]; then
  echo "FALHA: faltam evidencias:"
  printf ' - %s\n' "${falta[@]}"
  exit 1
fi
echo "OK: todas as evidencias estao presentes."
