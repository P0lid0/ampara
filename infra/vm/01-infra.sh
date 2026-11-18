#!/usr/bin/env bash
# Etapa 1: hostname, rede (netplan), usuarios, firewall (ufw) e hora.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

NETPLAN_ARQ=/etc/netplan/60-ampara.yaml
NETPLAN_CLOUD=/etc/netplan/50-cloud-init.yaml

carrega_vm_conf() {
  local conf="${AMPARA_VM_CONF:-/etc/ampara/vm.conf}"
  if [[ ! -r "$conf" ]]; then
    conf="$SCRIPT_DIR/config/vm.conf"
  fi
  if [[ -r "$conf" ]]; then
    # shellcheck source=config/vm.conf
    source "$conf"
  fi
  VM_HOSTNAME="${VM_HOSTNAME:-ampara-vm}"
  VM_IP="${VM_IP:-10.0.2.15/24}"
  VM_GATEWAY="${VM_GATEWAY:-10.0.2.2}"
  VM_DNS="${VM_DNS:-10.0.2.3 1.1.1.1}"
}

configura_hostname() {
  hostnamectl set-hostname "$VM_HOSTNAME"
  # O cloud-init nao deve reescrever o hostname nem o /etc/hosts nos proximos boots.
  install -d -m 0755 /etc/cloud/cloud.cfg.d
  printf 'preserve_hostname: true\nmanage_etc_hosts: false\n' \
    > /etc/cloud/cloud.cfg.d/99-ampara-hostname.cfg
  if grep -qE "^127\.0\.1\.1[[:space:]]+${VM_HOSTNAME}([[:space:]]|\$)" /etc/hosts; then
    :
  elif grep -qE '^127\.0\.1\.1[[:space:]]' /etc/hosts; then
    sed -i -E "s/^127\.0\.1\.1[[:space:]].*/127.0.1.1 ${VM_HOSTNAME}/" /etc/hosts
  else
    printf '127.0.1.1 %s\n' "$VM_HOSTNAME" >> /etc/hosts
  fi
  ampara_info "Hostname: $VM_HOSTNAME"
}

# Imprime o YAML do netplan (funcao pura, testavel).
gera_netplan_yaml() {
  local ns_lista="" item
  for item in $VM_DNS; do
    ns_lista+="${ns_lista:+, }${item}"
  done
  cat <<YAML
network:
  version: 2
  renderer: networkd
  ethernets:
    ampara-nic:
      match:
        name: "en*"
      dhcp4: false
      dhcp6: false
      addresses: [${VM_IP}]
      routes:
        - to: default
          via: ${VM_GATEWAY}
      nameservers:
        addresses: [${ns_lista}]
YAML
}

configura_rede() {
  local novo backup="" mudou=0
  install -d -m 0755 /etc/cloud/cloud.cfg.d
  printf 'network: {config: disabled}\n' > /etc/cloud/cloud.cfg.d/99-ampara-rede.cfg

  novo="$(mktemp)"
  gera_netplan_yaml > "$novo"
  if [[ ! -f "$NETPLAN_ARQ" ]] || ! cmp -s "$novo" "$NETPLAN_ARQ"; then
    mudou=1
  fi
  if [[ -e "$NETPLAN_CLOUD" ]]; then
    mudou=1
  fi
  if [[ $mudou -eq 0 ]]; then
    rm -f "$novo"
    chmod 600 "$NETPLAN_ARQ"
    ampara_info "Rede ja configurada; nada a aplicar."
    return 0
  fi

  if [[ -e "$NETPLAN_CLOUD" ]]; then
    backup="$(mktemp)"
    mv "$NETPLAN_CLOUD" "$backup"
  fi
  install -m 0600 "$novo" "$NETPLAN_ARQ"
  rm -f "$novo"

  # Valida antes de aplicar: se falhar, desfaz e nao toca na rede em uso.
  if ! netplan generate; then
    ampara_erro "netplan generate falhou; rede NAO aplicada (configuracao anterior restaurada)."
    rm -f "$NETPLAN_ARQ"
    if [[ -n "$backup" ]]; then
      mv "$backup" "$NETPLAN_CLOUD"
    fi
    return 1
  fi
  if [[ -n "$backup" ]]; then
    rm -f "$backup"
  fi
  netplan apply
  ampara_info "Rede aplicada: $VM_IP via $VM_GATEWAY, DNS $VM_DNS"
}

cria_usuarios() {
  if ! id ampara >/dev/null 2>&1; then
    useradd --system --user-group --home-dir /var/lib/ampara --shell /usr/sbin/nologin ampara
    ampara_info "Usuario de sistema ampara criado."
  fi
  install -d -m 0750 -o ampara -g ampara /var/lib/ampara
  if ! id operador >/dev/null 2>&1; then
    ampara_info "Usuario operador ausente (o cloud-init nao o criou); criando."
    useradd --create-home --shell /bin/bash --groups sudo operador
  fi
  usermod -aG sudo operador
}

instala_ufw() {
  if ! command -v ufw >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
  fi
}

configura_ufw() {
  instala_ufw
  # Sem IPv6 no ufw: cada regra aparece uma unica vez em "ufw status".
  if [[ -f /etc/default/ufw ]]; then
    sed -i -E 's/^IPV6=.*/IPV6=no/' /etc/default/ufw
  fi
  ufw --force reset >/dev/null
  ufw default deny incoming
  ufw default deny outgoing
  # Entrada: SSH e nginx.
  ufw allow in 22/tcp
  ufw allow in 80/tcp
  # Saida liberada ANTES de habilitar: DNS, HTTP/HTTPS, NTP, MQTT e 7844 (reservado).
  ufw allow out 53/tcp
  ufw allow out 53/udp
  ufw allow out 80/tcp
  ufw allow out 443/tcp
  ufw allow out 123/udp
  ufw allow out 1883/tcp
  ufw allow out 7844/tcp
  ufw allow out 7844/udp
  ufw --force enable
  ampara_info "ufw ativo: deny incoming/outgoing com as liberacoes do Ampara."
}

ntp_sincronizado() {
  [[ "$(timedatectl show -p NTPSynchronized --value)" == "yes" ]]
}

configura_hora() {
  local i
  timedatectl set-timezone America/Sao_Paulo
  timedatectl set-ntp true
  for ((i = 0; i < 60; i++)); do
    if ntp_sincronizado; then
      ampara_info "Hora sincronizada por NTP."
      return 0
    fi
    sleep 1
  done
  ampara_info "Aviso: NTP ainda nao sincronizou (pode levar alguns minutos)."
}

main() {
  ampara_exige_root
  ampara_iniciar_execucao "$(basename "$0")"
  carrega_vm_conf
  configura_hostname
  configura_rede
  cria_usuarios
  configura_ufw
  configura_hora
  ampara_info "01-infra concluido."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
