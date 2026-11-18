#!/usr/bin/env bash
# Monitor do Ampara: CPU, memória, disco, serviços e saúde da API (incluindo o MQTT).
# Roda como serviço systemd (ampara-monitor.service) e escreve alertas em
# /var/log/ampara/alertas.log e no journald (tag ampara-monitor).
#
# Para ser lido com `source` (testes): só define funções, não executa nada.
# Uso direto: ampara-monitor.sh [--uma-vez]
set -euo pipefail

_MON_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
for _lib in "$_MON_DIR/lib.sh" /etc/ampara/lib.sh; do
  if [ -r "$_lib" ]; then
    # shellcheck source=lib.sh
    source "$_lib"
    break
  fi
done
if ! declare -F ampara_log_dir >/dev/null 2>&1; then
  ampara_log_dir() { printf '%s\n' "${AMPARA_LOG_DIR:-/var/log/ampara}"; }
fi

# Estado entre ciclos: último alerta por chave (cooldown) e estado de cada serviço.
declare -gA ULTIMO_ALERTA=()
declare -gA SERVICO_ESTADO=()

# --- cálculos puros (inteiros) -------------------------------------------------

# calcula_cpu <total0> <idle0> <total1> <idle1> -> uso de CPU em % (0-100)
calcula_cpu() {
  local dt=$(($3 - $1)) di=$(($4 - $2))
  if [ "$dt" -le 0 ]; then
    echo 0
    return 0
  fi
  local uso=$(((dt - di) * 100 / dt))
  if [ "$uso" -lt 0 ]; then uso=0; fi
  if [ "$uso" -gt 100 ]; then uso=100; fi
  echo "$uso"
}

# calcula_mem <MemTotal_kB> <MemAvailable_kB> -> uso de memória em %
calcula_mem() {
  if [ "$1" -le 0 ]; then
    echo 0
    return 0
  fi
  echo $((($1 - $2) * 100 / $1))
}

# parse_pcent " 87%" -> 87
parse_pcent() {
  local v=${1//[^0-9]/}
  echo "${v:-0}"
}

# excedeu <valor> <limite> -> status 0 se valor > limite (estrito; aceita limite negativo)
excedeu() {
  if [[ ! $1 =~ ^-?[0-9]+$ || ! $2 =~ ^-?[0-9]+$ ]]; then
    return 1
  fi
  [ "$1" -gt "$2" ]
}

# mqtt_conectado <json> -> 0 se o corpo do health traz "mqtt": true
mqtt_conectado() {
  grep -Eq '"mqtt"[[:space:]]*:[[:space:]]*true' <<< "${1:-}"
}

# --- configuração --------------------------------------------------------------

carrega_config() {
  : "${CPU_LIMITE:=80}" "${MEM_LIMITE:=80}" "${DISCO_LIMITE:=85}"
  : "${INTERVALO_S:=5}" "${COOLDOWN_S:=60}" "${CPU_AMOSTRA_S:=1}"
  : "${SERVICOS:=}" "${HEALTH_URL:=http://127.0.0.1:5080/health}"
  : "${ALERTAS_LOG:=$(ampara_log_dir)/alertas.log}"

  local conf
  for conf in "${AMPARA_VM_CONF:-/etc/ampara/vm.conf}" "${AMPARA_MONITOR_CONF:-/etc/ampara/monitor.conf}"; do
    if [ -r "$conf" ]; then
      # shellcheck disable=SC1090
      source "$conf"
    fi
  done

  if [ -n "${AMPARA_CPU_LIMITE:-}" ]; then CPU_LIMITE=$AMPARA_CPU_LIMITE; fi
  if [ -n "${AMPARA_MEM_LIMITE:-}" ]; then MEM_LIMITE=$AMPARA_MEM_LIMITE; fi
  if [ -n "${AMPARA_DISCO_LIMITE:-}" ]; then DISCO_LIMITE=$AMPARA_DISCO_LIMITE; fi
  return 0
}

# --- registro ------------------------------------------------------------------

# registra_evento <NIVEL> <tipo> <detalhe>
registra_evento() {
  local nivel=$1 tipo=$2 detalhe=$3 linha prio=user.info
  linha="$(date -Iseconds) | $nivel | $tipo | $detalhe"
  mkdir -p "$(dirname "$ALERTAS_LOG")" 2>/dev/null || true
  printf '%s\n' "$linha" >> "$ALERTAS_LOG" || true
  if [ "$nivel" = "ALERTA" ]; then prio=user.warning; fi
  if command -v logger >/dev/null 2>&1; then
    logger -p "$prio" -t ampara-monitor -- "$linha" || true
  fi
  return 0
}

# registra_alerta <tipo> <detalhe> [chave-do-cooldown]
# Retorna 1 se suprimido pelo cooldown (a chave padrão é o tipo).
registra_alerta() {
  local tipo=$1 detalhe=$2 chave=${3:-$1} agora ultimo
  agora=$(date +%s)
  ultimo=${ULTIMO_ALERTA[$chave]:-}
  if [ -n "$ultimo" ] && [ $((agora - ultimo)) -lt "$COOLDOWN_S" ]; then
    return 1
  fi
  ULTIMO_ALERTA[$chave]=$agora
  registra_evento ALERTA "$tipo" "$detalhe"
}

# --- leitores ------------------------------------------------------------------

# le_cpu -> "<total> <idle>" da primeira linha de /proc/stat
le_cpu() {
  local u n s id io irq sirq st _resto
  read -r _ u n s id io irq sirq st _resto 2>/dev/null < "${PROC_STAT:-/proc/stat}" || return 1
  echo "$((u + n + s + id + io + irq + sirq + st)) $((id + io))"
}

# le_mem -> "<MemTotal_kB> <MemAvailable_kB>"
le_mem() {
  local k v _resto total="" avail=""
  while read -r k v _resto; do
    case $k in
      MemTotal:) total=$v ;;
      MemAvailable:) avail=$v ;;
      *) ;;
    esac
  done 2>/dev/null < "${PROC_MEMINFO:-/proc/meminfo}" || return 1
  [ -n "$total" ] && [ -n "$avail" ] || return 1
  echo "$total $avail"
}

# le_disco -> uso do / em %
le_disco() {
  local saida
  saida=$(eval "${DF_CMD:-df --output=pcent /}") || return 1
  parse_pcent "$(tail -n 1 <<< "$saida")"
}

# --- checagens -----------------------------------------------------------------

checa_cpu() {
  local t0 i0 t1 i1 uso
  read -r t0 i0 < <(le_cpu) || return 1
  sleep "$CPU_AMOSTRA_S"
  read -r t1 i1 < <(le_cpu) || return 1
  uso=$(calcula_cpu "$t0" "$i0" "$t1" "$i1")
  if excedeu "$uso" "$CPU_LIMITE"; then
    registra_alerta CPU "valor=${uso}% limite=${CPU_LIMITE}%" || true
  fi
}

checa_mem() {
  local total avail uso
  read -r total avail < <(le_mem) || return 1
  uso=$(calcula_mem "$total" "$avail")
  if excedeu "$uso" "$MEM_LIMITE"; then
    registra_alerta MEMORIA "valor=${uso}% limite=${MEM_LIMITE}%" || true
  fi
}

checa_disco() {
  local uso
  uso=$(le_disco) || return 1
  if excedeu "$uso" "$DISCO_LIMITE"; then
    registra_alerta DISCO "valor=${uso}% limite=${DISCO_LIMITE}%" || true
  fi
}

verifica_servicos() {
  local unit
  for unit in $SERVICOS; do
    if "${SYSTEMCTL:-systemctl}" is-active --quiet "$unit"; then
      if [ "${SERVICO_ESTADO[$unit]:-}" = "caido" ]; then
        registra_evento INFO SERVICO_RECUPERADO "$unit"
      fi
      SERVICO_ESTADO[$unit]=ativo
    else
      SERVICO_ESTADO[$unit]=caido
      registra_alerta SERVICO_INATIVO "$unit" "SERVICO_INATIVO:$unit" || true
    fi
  done
  return 0
}

verifica_saude() {
  local corpo rc=0
  if [ -n "${HEALTH_CMD:-}" ]; then
    corpo=$(eval "$HEALTH_CMD" 2>&1) || rc=$?
  else
    corpo=$(curl -fsS --max-time 3 "${HEALTH_URL:-http://127.0.0.1:5080/health}" 2>&1) || rc=$?
  fi
  if [ "$rc" -ne 0 ]; then
    registra_alerta API_HEALTH "health nao respondeu (codigo=$rc)" || true
    return 0
  fi
  if grep -Eq '"status"[[:space:]]*:[[:space:]]*"falha"' <<< "$corpo"; then
    registra_alerta API_HEALTH "health devolveu status=falha" || true
  fi
  if grep -Eq '"mqtt"[[:space:]]*:[[:space:]]*false' <<< "$corpo"; then
    registra_alerta MQTT "conexao MQTT da API fora (mqtt=false)" || true
  fi
  return 0
}

# ciclo: nenhuma checagem pode abortar o loop; falha de leitura vira evento ERRO.
ciclo() {
  checa_cpu || registra_evento ERRO LEITURA "cpu: nao consegui ler ${PROC_STAT:-/proc/stat}" || true
  checa_mem || registra_evento ERRO LEITURA "memoria: nao consegui ler ${PROC_MEMINFO:-/proc/meminfo}" || true
  checa_disco || registra_evento ERRO LEITURA "disco: nao consegui executar ${DF_CMD:-df --output=pcent /}" || true
  verifica_servicos || registra_evento ERRO LEITURA "servicos: falha ao consultar o systemctl" || true
  verifica_saude || registra_evento ERRO LEITURA "saude: falha ao consultar o health" || true
  return 0
}

main() {
  local uma_vez=0
  if [ "${1:-}" = "--uma-vez" ]; then uma_vez=1; fi
  carrega_config
  registra_evento INFO MONITOR_INICIADO "pid=$$"
  while true; do
    ciclo || true
    if [ "$uma_vez" -eq 1 ]; then
      break
    fi
    if [ -n "${NOTIFY_SOCKET:-}" ] && command -v systemd-notify >/dev/null 2>&1; then
      systemd-notify WATCHDOG=1 || true
    fi
    sleep "$INTERVALO_S"
  done
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
