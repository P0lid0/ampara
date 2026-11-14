#!/usr/bin/env bash
# Sobe ou para a VM Ubuntu 24.04 de demonstracao (QEMU + WHPX, seed cloud-init NoCloud por HTTP).
# Uso: bash infra/spike/run-vm.sh [subir|parar]
set -eu
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VM="$RAIZ/infra/vm"
SPIKE="$RAIZ/infra/spike"
QEMU_DIR="${QEMU_DIR:-$HOME/scoop/apps/qemu/current}"
export PATH="$PATH:$QEMU_DIR"

win() { cygpath -m "$1"; }

parar() {
  for f in "$VM/qemu.pid" "$VM/http.pid"; do
    if [ -f "$f" ]; then
      pid="$(tr -d '[:space:]' < "$f")"
      [ -n "$pid" ] && taskkill //PID "$pid" //F >/dev/null 2>&1 || true
      rm -f "$f"
    fi
  done
}

subir() {
  parar
  mkdir -p "$VM/seed"
  chave="$(cat "$VM/chaves/ampara.pub")"
  sed "s|__CHAVE_PUBLICA__|$chave|" "$SPIKE/user-data.tpl" > "$VM/seed/user-data"
  cp "$SPIKE/meta-data" "$VM/seed/meta-data"
  : > "$VM/serial.log"
  : > "$VM/qemu.log"

  # servidor HTTP do seed (NoCloud); PID tambem pelo PowerShell para ser o PID do Windows
  powershell.exe -NoProfile -Command "(Start-Process -FilePath python -ArgumentList '-m','http.server','8088','--bind','127.0.0.1','--directory','\"$(win "$VM/seed")\"' -PassThru -WindowStyle Hidden -RedirectStandardOutput '$(win "$VM/http.out")' -RedirectStandardError '$(win "$VM/http.log")').Id | Set-Content -NoNewline '$(win "$VM/http.pid")'" </dev/null >/dev/null 2>&1
  pid_http="$(cat "$VM/http.pid")"

  args="-accel whpx,kernel-irqchip=off -cpu ${QEMU_CPU:-qemu64} -m 4096 -smp 2 -display none"
  args="$args -serial file:\"$(win "$VM/serial.log")\""
  args="$args -drive file=\"$(win "$VM/imagens/disco.qcow2")\",if=virtio"
  args="$args -netdev user,id=n0,hostfwd=tcp::2222-:22,hostfwd=tcp::8081-:80 -device virtio-net-pci,netdev=n0"
  args="$args -smbios \"type=1,serial=ds=nocloud;s=http://10.0.2.2:8088/\""
  qexe="$(win "$QEMU_DIR/qemu-system-x86_64.exe")"
  powershell.exe -NoProfile -Command "(Start-Process -FilePath '$qexe' -ArgumentList '$(printf '%s' "$args" | sed "s/'/''/g")' -PassThru -WindowStyle Hidden -RedirectStandardOutput '$(win "$VM/qemu.out")' -RedirectStandardError '$(win "$VM/qemu.log")').Id | Set-Content -NoNewline '$(win "$VM/qemu.pid")'" </dev/null >/dev/null 2>&1
  pid_q="$(cat "$VM/qemu.pid")"
  echo "qemu PID $pid_q, http PID $pid_http"
}

case "${1:-}" in
  subir) subir ;;
  parar) parar ;;
  *) echo "uso: $0 [subir|parar]" >&2; exit 2 ;;
esac
