#!/usr/bin/env bash
# Le a conexao do banco (AMPARA_DB do ambiente ou do .env na raiz) e define H, PORTA, BANCO, U e PGPASSWORD.
# Uso: source "$(dirname "${BASH_SOURCE[0]}")/_conexao.sh"   (a senha nunca e impressa)
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONEXAO="${AMPARA_DB:-}"
if [ -z "$CONEXAO" ] && [ -f "$RAIZ/.env" ]; then
  CONEXAO="$(grep -E '^AMPARA_DB=' "$RAIZ/.env" | head -1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]\$//")"
fi
[ -n "$CONEXAO" ] || { echo "AMPARA_DB nao definida (variavel de ambiente ou .env)." >&2; exit 1; }
campo() { printf '%s' "$CONEXAO" | tr ';' '\n' | grep -i "^$1=" | head -1 | cut -d= -f2-; }
export PGPASSWORD="$(campo Password)"
H="$(campo Host)"; PORTA="$(campo Port)"; BANCO="$(campo Database)"; U="$(campo Username)"
