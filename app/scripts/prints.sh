#!/usr/bin/env bash
# Tira os prints do README a partir do emulador, uma tela por vez.
# Uso: bash app/scripts/prints.sh [serial]   (padrão: emulator-5554)
# Para cada tela, navegue até ela no emulador e tecle Enter; "p" pula a tela.
# Use só contas e dados sintéticos: confira cada print antes de commitar.
set -euo pipefail

SERIAL="${1:-${ADB_SERIAL:-emulator-5554}}"
DESTINO="$(cd "$(dirname "$0")/.." && pwd)/docs/prints"
mkdir -p "$DESTINO"

if ! adb -s "$SERIAL" get-state >/dev/null 2>&1; then
  echo "Emulador $SERIAL não encontrado. Veja os aparelhos com: adb devices" >&2
  exit 1
fi

TELAS=(
  "01-entrar|tela de entrada (Entrar e Estou sem meu celular)"
  "02-conta|onboarding: criar conta"
  "03-imei-erro|IMEI com um dígito errado (erro de Luhn)"
  "04-imei|IMEI conferido"
  "05-contas|bancos e operadora"
  "06-convite-qr|convite de guardião com QR"
  "07-chaveiro|chaveiro pareado"
  "08-consentimento-rota|consentimento da rota"
  "09-codigo-emergencia|código de emergência"
  "10-inicio|aba Início"
  "11-alarme|alarme em tela cheia no guardião"
  "12-passo-a-passo|passo a passo do guardião com horários"
  "13-rota|linha do tempo da rota e marcar o momento"
  "14-historico|Histórico"
  "15-bo|BO com Copiar texto e Enviar à polícia"
  "16-mapa|mapa de risco com legenda"
  "17-relato|relato com aviso de não descrever pessoas"
  "18-checklist|checklist de prevenção"
  "19-ajustes|Ajustes (não bloqueia o seu celular)"
  "20-fonte-grande|uma tela com a fonte do sistema no máximo"
)

for item in "${TELAS[@]}"; do
  nome="${item%%|*}"
  descricao="${item#*|}"
  read -r -p "Navegue até: ${descricao}. Enter para salvar, p para pular: " resposta
  if [[ "$resposta" == "p" ]]; then
    echo "  pulada"
    continue
  fi
  adb -s "$SERIAL" exec-out screencap -p > "$DESTINO/$nome.png"
  echo "  salvo docs/prints/$nome.png"
done

echo "Pronto. Abra cada imagem e confira que não há dado real antes do commit."
