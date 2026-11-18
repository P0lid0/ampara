#!/usr/bin/env bash
# Orquestra os scripts NN-*.sh da VM, em ordem numerica.
# Uso: provisiona.sh [NN ...]   (sem argumentos: todos os existentes)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ETC_AMPARA=/etc/ampara

instala_base() {
  install -d -m 0755 "$ETC_AMPARA"
  install -m 0644 "$SCRIPT_DIR/lib.sh" "$ETC_AMPARA/lib.sh"
  if [[ -e "$ETC_AMPARA/vm.conf" ]]; then
    ampara_info "vm.conf ja existe em $ETC_AMPARA; mantido como esta."
  else
    install -m 0644 "$SCRIPT_DIR/config/vm.conf" "$ETC_AMPARA/vm.conf"
    ampara_info "vm.conf instalado em $ETC_AMPARA."
  fi
}

# Imprime os scripts a executar, um por linha, em ordem numerica.
lista_scripts() {
  local nn arquivo achou
  if [[ $# -eq 0 ]]; then
    for arquivo in "$SCRIPT_DIR"/[0-9][0-9]-*.sh; do
      if [[ -e "$arquivo" ]]; then
        printf '%s\n' "$arquivo"
      fi
    done
    return 0
  fi
  for nn in "$@"; do
    if [[ ! "$nn" =~ ^[0-9]{1,2}$ ]]; then
      ampara_erro "Numero de etapa invalido: $nn (use 01, 02, ...)."
      return 2
    fi
    nn="$(printf '%02d' "$((10#$nn))")"
    achou=0
    for arquivo in "$SCRIPT_DIR/$nn"-*.sh; do
      if [[ -e "$arquivo" ]]; then
        printf '%s\n' "$arquivo"
        achou=1
      fi
    done
    if [[ $achou -eq 0 ]]; then
      ampara_erro "Nao existe script para a etapa $nn em $SCRIPT_DIR."
      return 2
    fi
  done
}

main() {
  ampara_exige_root
  ampara_iniciar_execucao "$(basename "$0")"
  local lista scripts=() arquivo rc
  lista="$(lista_scripts "$@")" || return $?
  while IFS= read -r arquivo; do
    if [[ -n "$arquivo" ]]; then
      scripts+=("$arquivo")
    fi
  done < <(printf '%s\n' "$lista" | sort)
  if [[ ${#scripts[@]} -eq 0 ]]; then
    ampara_erro "Nenhum script NN-*.sh encontrado em $SCRIPT_DIR."
    return 1
  fi
  instala_base
  for arquivo in "${scripts[@]}"; do
    ampara_info "Executando $(basename "$arquivo")"
    rc=0
    bash "$arquivo" || rc=$?
    if [[ $rc -ne 0 ]]; then
      ampara_erro "$(basename "$arquivo") falhou com codigo $rc; provisionamento interrompido."
      return "$rc"
    fi
  done
  ampara_info "Provisionamento concluido."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
