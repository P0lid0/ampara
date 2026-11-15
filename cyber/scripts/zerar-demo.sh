#!/usr/bin/env bash
# Zera o rastro do usuario de demonstracao antes de gravar o video ou tirar os prints:
# apaga os eventos de seguranca dele e o indice volta a 0 (farol verde).
# Uso: bash cyber/scripts/zerar-demo.sh [email]        (padrao: vitima@ampara.demo)
#      bash cyber/scripts/zerar-demo.sh --tudo          (apaga o rastro de todos; so em banco de demonstracao)
# Le a conexao de AMPARA_DB (variavel de ambiente ou .env na raiz); a senha nunca e impressa.
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

CONEXAO="${AMPARA_DB:-}"
if [ -z "$CONEXAO" ] && [ -f "$RAIZ/.env" ]; then
  CONEXAO="$(grep -E '^AMPARA_DB=' "$RAIZ/.env" | head -1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]\$//")"
fi
[ -n "$CONEXAO" ] || { echo "AMPARA_DB nao definida (variavel de ambiente ou .env)." >&2; exit 1; }
campo() { printf '%s' "$CONEXAO" | tr ';' '\n' | grep -i "^$1=" | head -1 | cut -d= -f2-; }
export PGPASSWORD="$(campo Password)"
H="$(campo Host)"; PORTA="$(campo Port)"; BANCO="$(campo Database)"; U="$(campo Username)"
psqlc() { psql -h "${H:-localhost}" -p "${PORTA:-5432}" -U "$U" -d "$BANCO" -v ON_ERROR_STOP=1 -tA "$@"; }

if [ "${1:-}" = "--tudo" ]; then
  n=$(psqlc -c 'WITH d AS (DELETE FROM evento_seguranca RETURNING 1) SELECT count(*) FROM d')
  echo "Rastro inteiro de $BANCO zerado: $n evento(s) apagado(s)."
  exit 0
fi

EMAIL="${1:-vitima@ampara.demo}"
# o e-mail vira literal SQL: so aceita o formato de e-mail comum (sem aspas)
printf '%s' "$EMAIL" | grep -Eq '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$' || { echo "E-mail invalido: $EMAIL" >&2; exit 1; }
ID="$(psqlc -c "SELECT \"Id\" FROM \"Usuarios\" WHERE \"Email\" = '$EMAIL'")"
[ -n "$ID" ] || { echo "Usuario '$EMAIL' nao existe em $BANCO (suba a API com AMPARA_DEMO=true)." >&2; exit 1; }
n=$(psqlc -c "WITH d AS (DELETE FROM evento_seguranca WHERE \"UsuarioAlvoId\" = '$ID' RETURNING 1) SELECT count(*) FROM d")
echo "Demo zerada para $EMAIL: $n evento(s) apagado(s). O indice volta a 0."
