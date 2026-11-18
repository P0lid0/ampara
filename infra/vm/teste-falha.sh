#!/usr/bin/env bash
# Roteiro do vídeo: teste de falha. Mata serviços e confere que o systemd reinicia e o
# monitor registra; no cenário mqtt, bloqueia o broker e confere a degradação sem travar.
#   teste-falha.sh [api|monitor|mqtt|todos]
# Precisa de root, da pilha provisionada (provisiona.sh 01..04) e do ufw ativo.
#
# Para ser lido com `source` (testes): só define funções, não executa nada.
# Atenção: dentro das funções cenario_* o `set -e` não vale (são chamadas com `||`);
# por isso cada passo é conferido explicitamente.
set -euo pipefail

_FALHA_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
for _lib in "$_FALHA_DIR/lib.sh" /etc/ampara/lib.sh; do
  if [ -r "$_lib" ]; then
    # shellcheck source=lib.sh
    source "$_lib"
    break
  fi
done

TF_FALHAS=0
TF_REGRA_MQTT=0
TF_HTTP_CODIGO=""
TF_HTTP_CORPO=""

tf_ok() { echo "[OK] $*"; }
tf_aviso() { echo "[AVISO] $*"; }
tf_falha() {
  echo "[FALHA] $*"
  TF_FALHAS=$((TF_FALHAS + 1))
}

# Chamada pelo trap de EXIT da lib (inclusive Ctrl+C): nunca deixa a regra de bloqueio do MQTT.
ampara_limpeza() {
  if [ "$TF_REGRA_MQTT" -eq 1 ]; then
    ufw --force delete deny out 1883/tcp >/dev/null 2>&1 || true
    TF_REGRA_MQTT=0
  fi
}

tf_alertas_log() {
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

tf_health_url() {
  local conf=${AMPARA_VM_CONF:-/etc/ampara/vm.conf}
  (
    HEALTH_URL=http://127.0.0.1:5080/health
    if [ -r "$conf" ]; then
      # shellcheck disable=SC1090
      source "$conf"
    fi
    printf '%s\n' "$HEALTH_URL"
  )
}

tf_conta() { # <texto-fixo> -> quantas linhas do alertas.log o contêm
  local arq
  arq=$(tf_alertas_log)
  if [ -f "$arq" ]; then
    grep -cF -- "$1" "$arq" || true
  else
    echo 0
  fi
}

tf_ultima_linha() { # <texto-fixo> -> número da última linha do alertas.log que o contém (0 se nenhuma)
  local arq n
  arq=$(tf_alertas_log)
  if [ ! -f "$arq" ]; then
    echo 0
    return 0
  fi
  n=$(grep -nF -- "$1" "$arq" | tail -n 1 | cut -d: -f1 || true)
  echo "${n:-0}"
}

tf_contagem_maior() { # <texto-fixo> <base>
  [ "$(tf_conta "$1")" -gt "$2" ]
}

tf_main_pid() { # <unit>
  systemctl show -p MainPID --value "$1"
}

tf_novo_pid() { # <unit> <pid-antigo>: novo MainPID > 0 e unit ativa
  local pid
  pid=$(tf_main_pid "$1")
  [ "${pid:-0}" -gt 0 ] && [ "$pid" -ne "$2" ] && systemctl is-active --quiet "$1"
}

# tf_health_http: consulta o health e deixa o resultado em TF_HTTP_CODIGO / TF_HTTP_CORPO.
tf_health_http() {
  local url saida
  url=$(tf_health_url)
  saida=$(curl -sS --max-time 3 -w '\n%{http_code}' "$url" 2>/dev/null) || return 1
  TF_HTTP_CODIGO=${saida##*$'\n'}
  TF_HTTP_CORPO=${saida%$'\n'*}
}

tf_health_ok() { # 200 com status ok ou degradado
  tf_health_http && [ "$TF_HTTP_CODIGO" = "200" ] &&
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"(ok|degradado)"' <<< "$TF_HTTP_CORPO"
}

tf_health_degradado_sem_mqtt() {
  tf_health_http && [ "$TF_HTTP_CODIGO" = "200" ] &&
    grep -Eq '"mqtt"[[:space:]]*:[[:space:]]*false' <<< "$TF_HTTP_CORPO" &&
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"degradado"' <<< "$TF_HTTP_CORPO"
}

tf_health_mqtt_ok() {
  tf_health_http && [ "$TF_HTTP_CODIGO" = "200" ] &&
    grep -Eq '"mqtt"[[:space:]]*:[[:space:]]*true' <<< "$TF_HTTP_CORPO" &&
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<< "$TF_HTTP_CORPO"
}

cenario_api() {
  local unit=ampara-api antes depois base_in base_rec ln_in ln_rec
  antes=$(tf_main_pid "$unit")
  if [ "${antes:-0}" -le 0 ]; then
    tf_falha "api: $unit nao esta rodando (MainPID=${antes:-vazio}); rode provisiona.sh 02 antes"
    return 1
  fi
  base_in=$(tf_conta "| ALERTA | SERVICO_INATIVO | $unit")
  base_rec=$(tf_conta "| INFO | SERVICO_RECUPERADO | $unit")
  ampara_info "api: matando $unit (MainPID=$antes) com SIGKILL"
  if ! systemctl kill -s KILL "$unit"; then
    tf_falha "api: systemctl kill falhou"
    return 1
  fi
  if ! ampara_espera_ate 60 tf_novo_pid "$unit" "$antes"; then
    tf_falha "api: o systemd nao reiniciou $unit em 60 s"
    return 1
  fi
  depois=$(tf_main_pid "$unit")
  tf_ok "api: systemd reiniciou $unit (MainPID $antes -> $depois)"

  if ! ampara_espera_ate 60 tf_contagem_maior "| ALERTA | SERVICO_INATIVO | $unit" "$base_in"; then
    tf_falha "api: o monitor nao registrou SERVICO_INATIVO | $unit (cooldown de 60 s de um teste anterior?)"
    return 1
  fi
  if ! ampara_espera_ate 60 tf_contagem_maior "| INFO | SERVICO_RECUPERADO | $unit" "$base_rec"; then
    tf_falha "api: o monitor nao registrou SERVICO_RECUPERADO | $unit"
    return 1
  fi
  ln_in=$(tf_ultima_linha "| ALERTA | SERVICO_INATIVO | $unit")
  ln_rec=$(tf_ultima_linha "| INFO | SERVICO_RECUPERADO | $unit")
  if [ "$ln_in" -lt "$ln_rec" ]; then
    tf_ok "api: alertas.log tem SERVICO_INATIVO e depois SERVICO_RECUPERADO de $unit"
  else
    tf_falha "api: SERVICO_RECUPERADO veio antes de SERVICO_INATIVO no alertas.log"
    return 1
  fi

  if ampara_espera_ate 60 tf_health_ok; then
    tf_ok "api: /health voltou a responder 200 (${TF_HTTP_CORPO})"
  else
    tf_falha "api: /health nao voltou a 200 com status ok ou degradado em 60 s"
    return 1
  fi
}

cenario_monitor() {
  local unit=ampara-monitor antes depois base
  antes=$(tf_main_pid "$unit")
  if [ "${antes:-0}" -le 0 ]; then
    tf_falha "monitor: $unit nao esta rodando (MainPID=${antes:-vazio}); rode provisiona.sh 03 antes"
    return 1
  fi
  base=$(tf_conta "| INFO | MONITOR_INICIADO |")
  ampara_info "monitor: matando $unit (MainPID=$antes) com SIGKILL"
  if ! systemctl kill -s KILL "$unit"; then
    tf_falha "monitor: systemctl kill falhou"
    return 1
  fi
  if ! ampara_espera_ate 60 tf_novo_pid "$unit" "$antes"; then
    tf_falha "monitor: o systemd nao reiniciou $unit em 60 s"
    return 1
  fi
  depois=$(tf_main_pid "$unit")
  tf_ok "monitor: systemd reiniciou $unit (MainPID $antes -> $depois)"
  if ampara_espera_ate 30 tf_contagem_maior "| INFO | MONITOR_INICIADO |" "$base"; then
    tf_ok "monitor: novo MONITOR_INICIADO registrado no alertas.log"
  else
    tf_falha "monitor: nenhum MONITOR_INICIADO novo no alertas.log"
    return 1
  fi
}

cenario_mqtt() {
  local base rc=0 conta_1883
  base=$(tf_conta "| ALERTA | MQTT |")
  ampara_info "mqtt: bloqueando a saida 1883 no ufw e reiniciando a API"
  if ! ufw insert 1 deny out 1883/tcp >/dev/null; then
    tf_falha "mqtt: nao consegui inserir a regra de bloqueio no ufw"
    return 1
  fi
  TF_REGRA_MQTT=1
  if ! systemctl restart ampara-api; then
    tf_falha "mqtt: systemctl restart ampara-api falhou"
    ampara_limpeza
    return 1
  fi

  if ampara_espera_ate 90 tf_health_degradado_sem_mqtt; then
    tf_ok "mqtt: com o broker bloqueado a API segue de pe: HTTP 200, status degradado, mqtt false"
  else
    tf_falha "mqtt: /health nao ficou em 200 com status degradado e mqtt false em 90 s (corpo: ${TF_HTTP_CORPO:-sem resposta})"
    rc=1
  fi
  if [ "$rc" -eq 0 ]; then
    if ampara_espera_ate 20 tf_contagem_maior "| ALERTA | MQTT |" "$base"; then
      tf_ok "mqtt: o monitor registrou ALERTA MQTT em ate 20 s"
    else
      tf_falha "mqtt: nenhum ALERTA MQTT novo em 20 s (cooldown de 60 s de um teste anterior?)"
      rc=1
    fi
  fi

  ampara_info "mqtt: removendo a regra de bloqueio"
  ampara_limpeza
  conta_1883=$(ufw status | grep -c '1883' || true)
  if [ "$conta_1883" -eq 1 ]; then
    tf_ok "mqtt: ufw voltou ao normal (uma unica regra 1883, a de saida liberada)"
  else
    tf_falha "mqtt: depois da limpeza o ufw tem $conta_1883 regra(s) com 1883 (esperado 1)"
    rc=1
  fi

  if ampara_espera_ate 90 tf_health_mqtt_ok; then
    tf_ok "mqtt: broker liberado, /health voltou a mqtt true e status ok"
  else
    ampara_info "mqtt: API nao reconectou sozinha; reiniciando uma vez"
    systemctl restart ampara-api || true
    if ampara_espera_ate 60 tf_health_mqtt_ok; then
      tf_ok "mqtt: depois de reiniciar a API, /health voltou a mqtt true e status ok"
    else
      tf_aviso "mqtt: /health nao voltou a mqtt true (broker publico fora do ar?); nao e falha da infra"
    fi
  fi
  return "$rc"
}

main() {
  local alvo=${1:-todos} rc=0
  ampara_exige_root
  ampara_iniciar_execucao "$(basename "$0")"
  trap 'exit 130' INT
  trap 'exit 143' TERM
  case $alvo in
    api) cenario_api || rc=1 ;;
    monitor) cenario_monitor || rc=1 ;;
    mqtt) cenario_mqtt || rc=1 ;;
    todos)
      cenario_api || rc=1
      cenario_monitor || rc=1
      cenario_mqtt || rc=1
      ;;
    *)
      ampara_erro "Uso: teste-falha.sh [api|monitor|mqtt|todos]"
      exit 2
      ;;
  esac
  if [ "$TF_FALHAS" -gt 0 ]; then
    rc=1
  fi
  if [ "$rc" -eq 0 ]; then
    echo "TESTE DE FALHA: todas as etapas OK"
  else
    echo "TESTE DE FALHA: $TF_FALHAS etapa(s) com FALHA"
  fi
  exit "$rc"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
