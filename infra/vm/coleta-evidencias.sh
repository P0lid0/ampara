#!/usr/bin/env bash
# coleta-evidencias.sh <diretorio_destino> - roda DENTRO da VM, como root.
# Grava as evidencias 01 a 09 da entrega de SO. NUNCA imprime nem copia ampara.env/segredos.env;
# no fim, ainda apaga de cada arquivo coletado qualquer valor desses env (rede de seguranca).
# O 10-tunel-url.txt nao existe: o tunel foi cortado do escopo.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$DIR/lib.sh"

ARQUIVOS_ENV=("/etc/ampara/ampara.env" "/etc/ampara/segredos.env")
# Chaves que nao sao segredo (aparecem nas evidencias por motivo legitimo).
CHAVES_PUBLICAS="AMPARA_DEMO RISCO_CSV MQTT_HOST MQTT_PORT PONTE_URL ANTHROPIC_MODEL"
STRESS_TXT="${AMPARA_STRESS_TXT:-/tmp/stress.txt}"
FALHA_TXT="${AMPARA_FALHA_TXT:-/tmp/falha.txt}"

# Valores a apagar das evidencias, um por linha (so o valor, nunca a chave).
valores_secretos() {
  local arq linha chave valor pw
  local re_linha='^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
  local re_dupla='^"(.*)"$'
  local re_simples="^'(.*)'\$"
  local re_senha_kv='[Pp]assword=([^;]+)'
  local re_senha_url='://[^:/@]+:([^@]+)@'
  for arq in "${ARQUIVOS_ENV[@]}"; do
    [[ -r "$arq" ]] || continue
    while IFS= read -r linha || [[ -n "$linha" ]]; do
      linha=${linha%$'\r'}
      linha=${linha#export }
      [[ "$linha" =~ $re_linha ]] || continue
      chave=${BASH_REMATCH[1]}
      valor=${BASH_REMATCH[2]}
      if [[ "$valor" =~ $re_dupla ]] || [[ "$valor" =~ $re_simples ]]; then
        valor=${BASH_REMATCH[1]}
      fi
      case " $CHAVES_PUBLICAS " in *" $chave "*) continue ;; esac
      if ((${#valor} >= 6)); then
        printf '%s\n' "$valor"
      fi
      if [[ "$valor" =~ $re_senha_kv ]] || [[ "$valor" =~ $re_senha_url ]]; then
        pw=${BASH_REMATCH[1]}
        if ((${#pw} >= 6)); then
          printf '%s\n' "$pw"
        fi
      fi
    done <"$arq"
  done
}

# Troca cada valor secreto por *** no arquivo (substituicao literal, sem regex).
redige_arquivo() {
  local arquivo=$1 valor
  [[ -s "$arquivo" ]] || return 0
  while IFS= read -r valor; do
    [[ -n "$valor" ]] || continue
    if grep -qFa -e "$valor" -- "$arquivo"; then
      V="$valor" awk 'BEGIN { v = ENVIRON["V"]; n = length(v) }
        { s = $0; out = ""
          while ((i = index(s, v)) > 0) { out = out substr(s, 1, i - 1) "***"; s = substr(s, i + n) }
          print out s }' "$arquivo" >"$arquivo.redigido"
      mv "$arquivo.redigido" "$arquivo"
    fi
  done < <(valores_secretos)
}

copia_ou_aviso() { # <origem> <destino> <como_gerar>
  if [[ -r "$1" ]]; then
    cp "$1" "$2"
  else
    printf '(arquivo ausente: %s)\nGere com: %s\n' "$1" "$3" >"$2"
  fi
}

coleta() {
  local dest=$1
  install -d -m 0755 "$dest"
  local logs
  logs="$(ampara_log_dir)"

  ampara_info "01 verifica-vm"
  bash "$DIR/verifica-vm.sh" >"$dest/01-verifica-vm.txt" 2>&1 || true

  ampara_info "02 execucao.log e 03 alertas.log"
  copia_ou_aviso "$logs/execucao.log" "$dest/02-execucao.log" "rode provisiona.sh"
  copia_ou_aviso "$logs/alertas.log" "$dest/03-alertas.log" "systemctl start ampara-monitor"

  ampara_info "04 teste de falha e 05 stress"
  copia_ou_aviso "$FALHA_TXT" "$dest/04-teste-falha.txt" "bash $DIR/teste-falha.sh todos | tee $FALHA_TXT"
  copia_ou_aviso "$STRESS_TXT" "$dest/05-stress.txt" "bash $DIR/stress.sh todos 40 | tee $STRESS_TXT"

  ampara_info "06 auditd"
  {
    echo "# auditctl -l"
    auditctl -l 2>&1 || true
    echo
    echo "# ausearch -k ampara_config -k ampara_sudo -i"
    ausearch -k ampara_config -k ampara_sudo -i 2>&1 || true
  } >"$dest/06-auditd.txt"

  ampara_info "07 systemctl status"
  local unidades=(postgresql ampara-migrations ampara-api ampara-ponte nginx ampara-monitor)
  # cloudflared so entra se a unit existir: o tunel e opcional e nao bloqueia nada.
  if systemctl cat cloudflared >/dev/null 2>&1; then
    unidades+=(cloudflared)
  fi
  systemctl status "${unidades[@]}" --no-pager >"$dest/07-systemctl-status.txt" 2>&1 || true

  ampara_info "08 rede e ufw"
  {
    echo "# ip -4 addr"
    ip -4 addr
    echo
    echo "# ip route"
    ip route
    echo
    echo "# /etc/netplan/60-ampara.yaml"
    cat /etc/netplan/60-ampara.yaml 2>&1 || true
    echo
    echo "# ufw status verbose"
    ufw status verbose 2>&1 || true
  } >"$dest/08-rede-ufw.txt"

  ampara_info "09 cloud-init-output.log"
  copia_ou_aviso /var/log/cloud-init-output.log "$dest/09-cloud-init-output.log" "cloud-init status --wait"

  local f
  for f in "$dest"/0[1-9]-*; do
    redige_arquivo "$f"
  done
  ampara_info "Evidencias gravadas em $dest"
}

main() {
  if (($# != 1)); then
    echo "Uso: $0 <diretorio_destino>" >&2
    return 2
  fi
  ampara_exige_root
  coleta "$1"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
