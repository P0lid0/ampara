#!/usr/bin/env bash
# Zera o rastro do usuario de demonstracao antes de gravar o video ou tirar os prints:
# apaga os eventos de seguranca dele e o indice volta a 0 (farol verde).
# Uso: bash cyber/scripts/zerar-demo.sh [email]        (padrao: vitima@ampara.demo)
# Nunca apaga o rastro de outros usuarios.
# Le a conexao de AMPARA_DB (variavel de ambiente ou .env na raiz); a senha nunca e impressa.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_conexao.sh"
psqlc() { psql -h "${H:-localhost}" -p "${PORTA:-5432}" -U "$U" -d "$BANCO" -v ON_ERROR_STOP=1 -tA "$@"; }

EMAIL="${1:-vitima@ampara.demo}"
# o e-mail vira literal SQL: so aceita o formato de e-mail comum (sem aspas)
printf '%s' "$EMAIL" | grep -Eq '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$' || { echo "E-mail invalido: $EMAIL" >&2; exit 1; }
ID="$(psqlc -c "SELECT \"Id\" FROM \"Usuarios\" WHERE \"Email\" = '$EMAIL'")"
[ -n "$ID" ] || { echo "Usuario '$EMAIL' nao existe em $BANCO (suba a API com AMPARA_DEMO=true)." >&2; exit 1; }
n=$(psqlc -c "WITH d AS (DELETE FROM evento_seguranca WHERE \"UsuarioAlvoId\" = '$ID' RETURNING 1) SELECT count(*) FROM d")
echo "Demo zerada para $EMAIL: $n evento(s) apagado(s). O indice volta a 0."
