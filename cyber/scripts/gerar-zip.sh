#!/usr/bin/env bash
# Gera cyber/saida/ampara-cyber-codigo.zip so com o que esta versionado em HEAD (sem node_modules, .env, saida ou PDF)
# e confere o resultado. Sai com 1 se achar PDF, node_modules, .env ou "sk-ant-" no conteudo.
# Importante: o ZIP e do commit HEAD; commite antes para incluir mudancas recentes.
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"
mkdir -p cyber/saida
ZIP="cyber/saida/ampara-cyber-codigo.zip"
rm -f "$ZIP"

git archive --format=zip -o "$ZIP" HEAD api cyber web-painel-risco .env.example

# 1) lista: nada de PDF, node_modules nem .env (so .env.example)
LISTA="$(unzip -Z1 "$ZIP")"
ruins="$(printf '%s\n' "$LISTA" | grep -ciE '\.pdf$|node_modules|(^|/)\.env$' || true)"
echo "arquivos no ZIP: $(printf '%s\n' "$LISTA" | grep -vc '/$')"
echo "itens proibidos (pdf, node_modules, .env): $ruins"
[ "$ruins" = "0" ] || { echo "FALHA: o ZIP tem itens proibidos." >&2; exit 1; }

# 2) conteudo extraido: nenhuma chave da Anthropic
TMP="$(mktemp -d "$RAIZ/cyber/saida/zipcheck.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"
if grep -rIl "sk-ant-" "$TMP" >/dev/null 2>&1; then
  echo "FALHA: 'sk-ant-' encontrado no conteudo do ZIP:" >&2
  grep -rIl "sk-ant-" "$TMP" >&2
  exit 1
fi
echo "grep -r sk-ant- no conteudo extraido: vazio"
echo "ok $ZIP ($(du -h "$ZIP" | cut -f1))"
