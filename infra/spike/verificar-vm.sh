#!/usr/bin/env bash
# Risco (d): VM Ubuntu 24.04 em QEMU + WHPX ate o login, SSH e cloud-init.
# Uso: bash infra/spike/verificar-vm.sh
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"
VM="$RAIZ/infra/vm"
IMG="$VM/imagens/noble-server-cloudimg-amd64.img"
SUMS="$VM/imagens/SHA256SUMS"
SERIAL="$VM/serial.log"
QLOG="$VM/qemu.log"
PIDF="$VM/qemu.pid"
SSH_OPTS=(-i "$VM/chaves/ampara" -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ConnectTimeout=5 -o LogLevel=ERROR)

limpar() { bash "$RAIZ/infra/spike/run-vm.sh" parar >/dev/null 2>&1 || true; }
falha() { echo "FALHOU asserção $1: $2"; exit 1; }
ok() { echo "OK asserção $1: $2"; }
trap limpar EXIT

vivo() { tasklist //FI "PID eq $1" 2>/dev/null | grep -q " $1 "; }
ssh_vm() { ssh "${SSH_OPTS[@]}" ampara@127.0.0.1 "$@"; }

# 1
qemu-system-x86_64 --version >/dev/null 2>&1 || falha 1 "qemu-system-x86_64 ausente"
qemu-img --version >/dev/null 2>&1 || falha 1 "qemu-img ausente"
ok 1 "$(qemu-system-x86_64 --version | head -1)"

# 2
[ -f "$IMG" ] || falha 2 "imagem ausente em $IMG"
[ -f "$SUMS" ] || falha 2 "SHA256SUMS ausente"
esperado="$(grep -F 'noble-server-cloudimg-amd64.img' "$SUMS" | grep -v 'unified' | head -1 | awk '{print $1}')"
real="$(sha256sum "$IMG" | awk '{print $1}')"
[ -n "$esperado" ] && [ "$esperado" = "$real" ] || falha 2 "sha256 difere (esperado=$esperado real=$real)"
ok 2 "sha256 confere"

# 3
grep -q "accel whpx" "$RAIZ/infra/spike/run-vm.sh" || falha 3 "run-vm.sh nao usa -accel whpx"
limpar
sleep 2
# disco novo a cada execucao: o cloud-init so aplica o seed uma vez por instance-id
( cd "$VM/imagens" && rm -f disco.qcow2 && qemu-img create -q -f qcow2 -b noble-server-cloudimg-amd64.img -F qcow2 disco.qcow2 20G ) || falha 3 "nao criou disco.qcow2"
inicio=$(date +%s)
bash "$RAIZ/infra/spike/run-vm.sh" subir || falha 3 "run-vm.sh subir falhou"
sleep 3
if grep -qi "failed to initialize whpx" "$QLOG" 2>/dev/null; then falha 3 "WHPX recusado: $(head -3 "$QLOG")"; fi
ok 3 "WHPX no comando, sem erro no qemu.log"

# 4
login=0
while [ $(( $(date +%s) - inicio )) -lt 300 ]; do
  if grep -q "ampara-vm login:" "$SERIAL" 2>/dev/null; then login=1; break; fi
  sleep 3
done
[ "$login" = 1 ] || falha 4 "sem 'ampara-vm login:' em 300 s"
ok 4 "login em $(( $(date +%s) - inicio )) s"

# 5
pid="$(tr -d '[:space:]' < "$PIDF" 2>/dev/null)"
[ -n "$pid" ] && vivo "$pid" || falha 5 "processo do qemu.pid ($pid) morto"
ok 5 "qemu vivo (PID $pid)"

# 6
nome=""
t0=$(date +%s)
while [ $(( $(date +%s) - t0 )) -lt 120 ]; do
  nome="$(ssh_vm hostname 2>/dev/null | tr -d '\r')"
  [ "$nome" = "ampara-vm" ] && break
  sleep 4
done
[ "$nome" = "ampara-vm" ] || falha 6 "ssh hostname = '$nome'"
ok 6 "ssh imprime ampara-vm"

# 7
st="$(ssh_vm cloud-init status --wait 2>&1)"
echo "$st" | grep -q "done" || falha 7 "cloud-init: $st"
ok 7 "cloud-init done"

# 8
ssh_vm sudo poweroff >/dev/null 2>&1 || true
t0=$(date +%s)
morreu=0
while [ $(( $(date +%s) - t0 )) -lt 60 ]; do
  if ! vivo "$pid"; then morreu=1; break; fi
  sleep 2
done
[ "$morreu" = 1 ] || falha 8 "PID $pid ainda vivo 60 s apos poweroff"
ok 8 "VM desligou"
echo "TUDO OK (login em $(( $(date +%s) - inicio )) s desde o subir)"
