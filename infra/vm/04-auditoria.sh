#!/usr/bin/env bash
# Etapa 4: auditd com regras do Ampara (substituicao do arquivo = idempotente).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

REGRAS_ORIGEM="$SCRIPT_DIR/config/auditd-ampara.rules"
REGRAS_DESTINO=/etc/audit/rules.d/ampara.rules

instala_auditd() {
  if [[ ! -r "$REGRAS_ORIGEM" ]]; then
    ampara_erro "Falta $REGRAS_ORIGEM."
    return 1
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y auditd
  # Os caminhos vigiados precisam existir antes de carregar as regras.
  install -d -m 0755 /etc/ampara /opt/ampara/src/infra/vm /usr/local/sbin
  # Substitui o arquivo inteiro: rodar de novo nao duplica regra.
  install -m 0640 -o root -g root "$REGRAS_ORIGEM" "$REGRAS_DESTINO"
  augenrules --load
  systemctl enable --now auditd
  ampara_info "auditd ativo com as regras do Ampara."
}

main() {
  ampara_exige_root
  ampara_iniciar_execucao "$(basename "$0")"
  instala_auditd
  ampara_info "04-auditoria concluido."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
