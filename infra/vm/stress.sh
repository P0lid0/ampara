#!/usr/bin/env bash
# Roteiro do vídeo: provoca cada alerta do monitor com carga real e confere o alertas.log.
#   stress.sh [cpu|mem|disco|todos] [duracao_s=40]
# Precisa de root e do pacote stress-ng (instalado pelo 03-monitor.sh).
#
# Atenção: o monitor repete o mesmo tipo de alerta só depois do COOLDOWN_S (60 s).
# Rodar a mesma carga duas vezes seguidas dentro desse prazo pode dar [FALHA] falso.
#
# Para ser lido com `source` (testes): só define funções, não executa nada.
set -euo pipefail

_STRESS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
for _lib in "$_STRESS_DIR/lib.sh" /etc/ampara/lib.sh; do
  if [ -r "$_lib" ]; then
    # shellcheck source=lib.sh
    source "$_lib"
    break
  fi
done

ARQUIVO_ENCHIMENTO=/var/tmp/ampara-enchimento.bin
ALVO_DISCO=${AMPARA_DISCO_ALVO:-85}

# bytes_para_alvo <total_kb> <usado_kb> <alvo_pct>
# Bytes a alocar para o uso chegar a alvo_pct + 1 %; 0 se já estiver nesse nível ou acima.
bytes_para_alvo() {
  local total=$1 usado=$2 alvo=$3
  local meta=$((total * (alvo + 1) / 100))
  local falta=$((meta - usado))
  if [ "$falta" -le 0 ]; then
    echo 0
    return 0
  fi
  echo $((falta * 1024))
}

# Chamada pelo trap de EXIT da lib (também em Ctrl+C): nunca deixa o enchimento para trás.
ampara_limpeza() {
  rm -f -- "$ARQUIVO_ENCHIMENTO"
}

st_alertas_log() {
  if [ -n "${ALERTAS_LOG:-}" ]; then
    printf '%s\n' "$ALERTAS_LOG"
    return 0
  fi
  local conf=${AMPARA_MONITOR_CONF:-/etc/ampara/monitor.conf}
  (
    ALERTAS_LOG="$(ampara_log_dir)/alertas.log"
    if [ -r "$conf" ]; then
      # shellcheck disable=SC1090
      source "$conf"
    fi
    printf '%s\n' "$ALERTAS_LOG"
  )
}

st_conta_alertas() { # <TIPO>
  local arq
  arq=$(st_alertas_log)
  if [ -f "$arq" ]; then
    grep -cF -- "| ALERTA | $1 |" "$arq" || true
  else
    echo 0
  fi
}

st_confere() { # <rotulo> <TIPO> <contagem-antes>
  local rotulo=$1 tipo=$2 antes=$3 depois
  depois=$(st_conta_alertas "$tipo")
  if [ "$depois" -gt "$antes" ]; then
    echo "[OK] $rotulo: alerta $tipo registrado em $(st_alertas_log)"
    return 0
  fi
  echo "[FALHA] $rotulo: nenhum alerta $tipo novo em $(st_alertas_log) (cooldown de 60 s ainda ativo, ou monitor parado?)"
  return 1
}

st_exige_stress_ng() {
  if ! command -v stress-ng >/dev/null 2>&1; then
    ampara_erro "stress-ng nao instalado (apt install stress-ng, ou rode provisiona.sh 03)."
    return 1
  fi
}

carga_cpu() { # <duracao_s>
  local d=$1 antes pid
  st_exige_stress_ng || return 1
  antes=$(st_conta_alertas CPU)
  ampara_info "CPU: stress-ng --cpu 0 --cpu-load 95 por ${d}s"
  stress-ng --cpu 0 --cpu-load 95 --timeout "${d}s" >/dev/null 2>&1 &
  pid=$!
  wait "$pid" || ampara_info "stress-ng terminou com erro (seguindo para a conferencia)"
  st_confere "stress cpu" CPU "$antes"
}

carga_mem() { # <duracao_s>
  local d=$1 antes pid
  st_exige_stress_ng || return 1
  antes=$(st_conta_alertas MEMORIA)
  ampara_info "Memoria: stress-ng --vm 1 --vm-bytes 90% por ${d}s"
  stress-ng --vm 1 --vm-bytes 90% --vm-keep --timeout "${d}s" >/dev/null 2>&1 &
  pid=$!
  wait "$pid" || ampara_info "stress-ng terminou com erro (seguindo para a conferencia)"
  st_confere "stress memoria" MEMORIA "$antes"
}

carga_disco() { # <duracao_s>
  local d=$1 antes usado livre bytes
  antes=$(st_conta_alertas DISCO)
  read -r usado livre < <(df -k --output=used,avail / | tail -n 1)
  bytes=$(bytes_para_alvo $((usado + livre)) "$usado" "$ALVO_DISCO")
  if [ "$bytes" -gt 0 ]; then
    ampara_info "Disco: fallocate de $bytes bytes em $ARQUIVO_ENCHIMENTO por ${d}s"
    if ! fallocate -l "$bytes" "$ARQUIVO_ENCHIMENTO"; then
      echo "[FALHA] stress disco: fallocate nao conseguiu criar $ARQUIVO_ENCHIMENTO"
      return 1
    fi
  else
    ampara_info "Disco: ja esta acima de ${ALVO_DISCO}%, nada a alocar"
  fi
  sleep "$d"
  local rc=0
  st_confere "stress disco" DISCO "$antes" || rc=1
  ampara_limpeza
  return "$rc"
}

main() {
  local alvo=${1:-todos} d=${2:-40} rc=0
  ampara_exige_root
  ampara_iniciar_execucao "$(basename "$0")"
  trap 'exit 130' INT
  trap 'exit 143' TERM
  if [[ ! $d =~ ^[0-9]+$ ]] || [ "$d" -lt 10 ]; then
    ampara_erro "Duracao invalida: use um numero de segundos >= 10 (o monitor olha a cada 5 s)."
    exit 2
  fi
  case $alvo in
    cpu) carga_cpu "$d" || rc=1 ;;
    mem) carga_mem "$d" || rc=1 ;;
    disco) carga_disco "$d" || rc=1 ;;
    todos)
      carga_cpu "$d" || rc=1
      carga_mem "$d" || rc=1
      carga_disco "$d" || rc=1
      ;;
    *)
      ampara_erro "Uso: stress.sh [cpu|mem|disco|todos] [duracao_s]"
      exit 2
      ;;
  esac
  exit "$rc"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
