#!/usr/bin/env bash
# 03-monitor.sh - instala o monitor do Ampara como servico systemd tolerante a falhas
# (CPU, memoria, disco, servicos e MQTT) e o logrotate dos logs. Idempotente.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$DIR/lib.sh"

ORIGEM_CONFIG="$DIR/config"
DESTINO_SBIN="/usr/local/sbin"
DESTINO_ETC="/etc/ampara"
DESTINO_UNITS="/etc/systemd/system"
LOG_DIR="$(ampara_log_dir)"

instala_pacotes() {
  ampara_info "Instalando stress-ng, jq e curl"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq stress-ng jq curl >/dev/null
}

instala_monitor() {
  if ! id ampara >/dev/null 2>&1; then
    ampara_erro "Usuario 'ampara' nao existe. Rode 01-infra.sh antes."
    return 1
  fi

  # O diretorio so e criado se faltar: o modo de /etc/ampara e decidido pelo 02-app.sh.
  [[ -d "$DESTINO_ETC" ]] || install -d -m 0755 -o root -g root "$DESTINO_ETC"

  install -d -m 0755 -o ampara -g ampara "$LOG_DIR"
  if [[ ! -e "$LOG_DIR/alertas.log" ]]; then
    install -m 0644 -o ampara -g ampara /dev/null "$LOG_DIR/alertas.log"
  fi

  install -m 0755 -o root -g root "$DIR/ampara-monitor.sh" "$DESTINO_SBIN/ampara-monitor.sh"

  # monitor.conf e lib.sh sem segredo, legiveis pelo usuario ampara (o monitor roda sem root).
  if [[ ! -e "$DESTINO_ETC/monitor.conf" ]]; then
    install -m 0644 -o root -g root "$ORIGEM_CONFIG/monitor.conf" "$DESTINO_ETC/monitor.conf"
  fi
  chmod 0644 "$DESTINO_ETC/monitor.conf"
  install -m 0644 -o root -g root "$DIR/lib.sh" "$DESTINO_ETC/lib.sh"
  if [[ -e "$DESTINO_ETC/vm.conf" ]]; then
    chmod 0644 "$DESTINO_ETC/vm.conf"
  fi
}

instala_unit() {
  install -m 0644 -o root -g root "$ORIGEM_CONFIG/units/ampara-monitor.service" \
    "$DESTINO_UNITS/ampara-monitor.service"
  systemctl daemon-reload
  systemctl enable ampara-monitor.service >/dev/null 2>&1
  systemctl restart ampara-monitor.service
  if ! ampara_espera_ate 20 systemctl is-active --quiet ampara-monitor.service; then
    ampara_erro "ampara-monitor nao ficou ativo em 20 s"
    systemctl status ampara-monitor.service --no-pager || true
    return 1
  fi
  ampara_info "ampara-monitor ativo"
}

configura_logrotate() {
  install -m 0644 -o root -g root "$ORIGEM_CONFIG/logrotate-ampara" /etc/logrotate.d/ampara
  if ! logrotate -d /etc/logrotate.d/ampara >/dev/null 2>&1; then
    ampara_erro "logrotate -d reprovou /etc/logrotate.d/ampara"
    return 1
  fi
  ampara_info "logrotate configurado para alertas.log, execucao.log e provisiona.log"
}

main() {
  ampara_exige_root
  ampara_iniciar_execucao "$(basename "$0")"
  instala_pacotes
  instala_monitor
  instala_unit
  configura_logrotate
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
