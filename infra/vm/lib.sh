#!/usr/bin/env bash
# Utilitários comuns dos scripts da VM. Para ser lido com `source`; não executa nada.
#
# ampara_log_dir               diretório dos logs (AMPARA_LOG_DIR ou /var/log/ampara)
# ampara_iniciar_execucao <n>  grava INICIO e arma o trap de EXIT que grava FIM
# ampara_info / ampara_erro    mensagens com data em stderr
# ampara_exige_root            sai com 77 se não for root
# ampara_espera_ate <s> <cmd>  0 se o comando passar dentro do prazo, 1 se não
# ampara_campo_conexao <s> <C> valor de um campo de string de conexão do Npgsql
#
# Gancho opcional: se o script definir a função `ampara_limpeza`, ela roda no EXIT
# (depois de gravar o FIM) sem alterar o código de saída.

ampara_log_dir() {
  printf '%s\n' "${AMPARA_LOG_DIR:-/var/log/ampara}"
}

ampara__ts() {
  date -Iseconds
}

ampara__grava_execucao() { # <linha completa>
  local linha=$1
  printf '%s\n' "$linha" >> "$(ampara_log_dir)/execucao.log" || true
  if command -v logger >/dev/null 2>&1; then
    logger -t ampara-exec -- "$linha" || true
  fi
}

ampara__fim_execucao() {
  local rc=$?
  local dur=$((SECONDS - ${AMPARA_EXEC_INICIO:-$SECONDS}))
  ampara__grava_execucao "$(ampara__ts) | ${AMPARA_EXEC_NOME:-?} | FIM | codigo=$rc duracao=${dur}s"
  if declare -F ampara_limpeza >/dev/null 2>&1; then
    ampara_limpeza || true
  fi
  return "$rc"
}

ampara_iniciar_execucao() {
  local nome=${1:?uso: ampara_iniciar_execucao <nome_do_script>}
  mkdir -p "$(ampara_log_dir)"
  AMPARA_EXEC_NOME=$nome
  AMPARA_EXEC_INICIO=$SECONDS
  ampara__grava_execucao "$(ampara__ts) | $nome | INICIO | usuario=$(id -un) pid=$$"
  trap ampara__fim_execucao EXIT
}

ampara_info() {
  printf '[%s] [INFO] %s\n' "$(ampara__ts)" "$*" >&2
}

ampara_erro() {
  printf '[%s] [ERRO] %s\n' "$(ampara__ts)" "$*" >&2
}

ampara_exige_root() {
  if [ "$(id -u)" -ne 0 ]; then
    ampara_erro "Precisa de root: rode com sudo."
    exit 77
  fi
}

ampara_espera_ate() {
  local limite=${1:?uso: ampara_espera_ate <timeout_s> <comando...>}
  shift
  local i
  for ((i = 0; i <= limite; i++)); do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    if [ "$i" -lt "$limite" ]; then
      sleep 1
    fi
  done
  return 1
}

ampara_campo_conexao() {
  local conexao=$1 campo=$2 parte chave
  local -a partes
  IFS=';' read -r -a partes <<< "$conexao"
  for parte in "${partes[@]}"; do
    chave=${parte%%=*}
    chave=${chave// /}
    if [ "${chave,,}" = "${campo,,}" ] && [[ $parte == *=* ]]; then
      printf '%s\n' "${parte#*=}"
      return 0
    fi
  done
  printf '\n'
}
