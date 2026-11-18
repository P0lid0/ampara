#!/usr/bin/env bash
# Migrations da API (dotnet Ampara.Api.dll --migrar) e da Ponte (alembic upgrade head).
# Roda pela unit ampara-migrations (EnvironmentFile=/etc/ampara/ampara.env). Nao ha dotnet ef na VM.
# Fora do systemd, se AMPARA_DB nao estiver no ambiente, le o ampara.env (nunca imprime valores).
set -euo pipefail

DOTNET="${DOTNET_BIN:-/usr/local/bin/dotnet}"
API_DIR="${API_DIR:-/opt/ampara/api}"
PONTE_DIR="${PONTE_DIR:-/opt/ampara/ponte}"
ENV_FILE="${AMPARA_ENV_FILE:-/etc/ampara/ampara.env}"

if [[ -z "${AMPARA_DB:-}" && -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${AMPARA_DB:-}" || -z "${PONTE_DB:-}" ]]; then
  echo "AMPARA_DB e PONTE_DB nao definidos: rode pela unit ampara-migrations ou gere o ampara.env (02-app.sh)." >&2
  exit 78
fi

export DOTNET_ROOT="${DOTNET_ROOT:-/usr/share/dotnet}"
export DOTNET_NOLOGO=1

echo "Migrations da API..."
cd "$API_DIR"
"$DOTNET" "$API_DIR/Ampara.Api.dll" --migrar

echo "Migrations da Ponte..."
cd "$PONTE_DIR"
"$PONTE_DIR/venv/bin/alembic" upgrade head

echo "Migrations concluidas."
