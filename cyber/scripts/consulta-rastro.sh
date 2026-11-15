#!/usr/bin/env bash
# Mostra o rastro de seguranca (evento_seguranca) e prova que nenhuma coluna guarda o valor do dado.
# Uso: bash cyber/scripts/consulta-rastro.sh [trecho-do-valor ...]   (cada trecho e procurado no rastro inteiro; o esperado e 0)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_conexao.sh"
export PGCLIENTENCODING=UTF8
BANCO="$(campo Database)"
P() { psql -h "$(campo Host)" -p "$(campo Port)" -U "$(campo Username)" -d "$BANCO" "$@"; }

echo "\$ psql -d $BANCO -c 'SELECT \"Source\",\"Campo\",\"Classe\",\"Sink\",\"Decisao\",\"CorrelationId\" FROM evento_seguranca ORDER BY \"Em\"'"
P -c 'SELECT "Source","Campo","Classe","Sink","Decisao","CorrelationId" FROM evento_seguranca ORDER BY "Em"'
echo
echo "\$ psql -d $BANCO -c 'colunas de evento_seguranca'   (nenhuma guarda o valor)"
P -c "SELECT column_name AS coluna, data_type AS tipo FROM information_schema.columns WHERE table_name = 'evento_seguranca' ORDER BY ordinal_position"
for t in "$@"; do
  n=$(P -At -c 'SELECT t::text FROM evento_seguranca t' | grep -c -F -- "$t" || true)
  echo "ocorrencias de '$t' no rastro inteiro: $n"
done
