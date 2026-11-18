#!/usr/bin/env bash
# Testa infra/vm/lib.sh: log de execução, espera e campo de string de conexão.
set -euo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
LIB="$RAIZ/infra/vm/lib.sh"
# shellcheck source=lib-teste.sh
source "$RAIZ/infra/tests/lib-teste.sh"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export AMPARA_LOG_DIR="$TMP/log"

if [ ! -f "$LIB" ]; then
  echo "FALHOU: infra/vm/lib.sh nao existe"
  exit 1
fi

faz_script() { # <nome> <corpo>
  cat > "$TMP/$1" <<SCRIPT
#!/usr/bin/env bash
set -euo pipefail
source "$LIB"
ampara_iniciar_execucao "\$(basename "\$0")"
$2
SCRIPT
}

faz_script 99-ok.sh 'true'
faz_script 98-falha.sh 'false'
faz_script 97-saida3.sh 'exit 3'

bash "$TMP/99-ok.sh"
rc=0; bash "$TMP/98-falha.sh" || rc=$?
assert_igual 1 "$rc" "script com set -e deve sair 1"
rc=0; bash "$TMP/97-saida3.sh" || rc=$?
assert_igual 3 "$rc" "script com exit 3 deve sair 3"

LOG="$AMPARA_LOG_DIR/execucao.log"
assert_contem "$LOG" '\| 99-ok\.sh \| INICIO \| usuario=[^ ]+ pid=[0-9]+' "INICIO do 99-ok.sh"
assert_contem "$LOG" '\| 99-ok\.sh \| FIM \| codigo=0 duracao=[0-9]+s' "FIM codigo=0 do 99-ok.sh"
assert_contem "$LOG" '\| 98-falha\.sh \| FIM \| codigo=1 ' "trap preserva codigo=1"
assert_contem "$LOG" '\| 97-saida3\.sh \| FIM \| codigo=3 ' "trap preserva codigo=3"
assert_contem "$LOG" '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+[+-][0-9:]+ \| 99-ok\.sh \| INICIO' "data ISO-8601 com fuso"

# gancho de limpeza opcional chamado no EXIT sem trocar o codigo de saida
faz_script 96-limpeza.sh 'ampara_limpeza() { echo limpou > "'"$TMP"'/limpou"; }; exit 4'
rc=0; bash "$TMP/96-limpeza.sh" || rc=$?
assert_igual 4 "$rc" "gancho de limpeza nao troca o codigo"
assert_igual limpou "$(cat "$TMP/limpou")" "ampara_limpeza foi chamada"
assert_contem "$LOG" '\| 96-limpeza\.sh \| FIM \| codigo=4 ' "FIM codigo=4 com gancho"

# funcoes soltas
# shellcheck source=../vm/lib.sh
source "$LIB"
assert_igual "$AMPARA_LOG_DIR" "$(ampara_log_dir)" "ampara_log_dir usa AMPARA_LOG_DIR"
assert_igual "/var/log/ampara" "$(AMPARA_LOG_DIR='' ampara_log_dir)" "ampara_log_dir padrao"

saida=$(ampara_info "ola" 2>&1 >/dev/null)
if ! [[ $saida =~ ^\[[0-9T:+-]+\]\ \[INFO\]\ ola$ ]]; then echo "FALHOU: formato de ampara_info ($saida)"; exit 1; fi
saida=$(ampara_erro "deu ruim" 2>&1 >/dev/null)
if ! [[ $saida =~ ^\[[0-9T:+-]+\]\ \[ERRO\]\ deu\ ruim$ ]]; then echo "FALHOU: formato de ampara_erro ($saida)"; exit 1; fi

if [ "$(id -u)" -ne 0 ]; then
  rc=0; ( ampara_exige_root ) 2>/dev/null || rc=$?
  assert_igual 77 "$rc" "ampara_exige_root sai 77 fora do root"
fi

ampara_espera_ate 2 true && rc=0 || rc=$?
assert_igual 0 "$rc" "espera_ate com comando que passa"
ini=$(date +%s)
ampara_espera_ate 2 false && rc=0 || rc=$?
fim=$(date +%s)
assert_igual 1 "$rc" "espera_ate com comando que falha"
if [ $((fim - ini)) -lt 2 ]; then echo "FALHOU: espera_ate 2 false voltou em menos de 2 s"; exit 1; fi

assert_igual "abc123" "$(ampara_campo_conexao 'Host=localhost;Database=ampara;Username=ampara;Password=abc123' Password)" "campo Password"
assert_igual "ampara" "$(ampara_campo_conexao 'Host=localhost;Database=ampara;Username=u;Password=abc123' Database)" "campo Database"
assert_igual "a=b" "$(ampara_campo_conexao 'Host=h;Password=a=b' Password)" "valor com ="
assert_igual "" "$(ampara_campo_conexao 'Host=h;Database=d' Password)" "campo ausente"

echo "PASSOU teste-lib"
