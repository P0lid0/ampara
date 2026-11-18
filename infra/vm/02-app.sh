#!/usr/bin/env bash
# 02-app.sh: dependencias, variaveis, build/publicacao, units systemd em ordem, nginx e healthcheck.
# Orquestracao: PostgreSQL -> migrations -> API -> Ponte -> nginx (After=/Requires= nas units).
# Idempotente: reexecutar nao troca segredos ja gerados em /etc/ampara/ampara.env.
# Nunca use `set -x` aqui: vazaria segredo. Nenhuma funcao imprime valores do ampara.env.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$DIR/lib.sh"

ENV_FILE=/etc/ampara/ampara.env
SEGREDOS_FILE=/etc/ampara/segredos.env
DEST_API=/opt/ampara/api
DEST_PONTE=/opt/ampara/ponte
DEST_DADOS=/opt/ampara/dados
DEST_WEB=/var/www/ampara
DOTNET_DIR=/usr/share/dotnet
TMP_DIR=""

# Remove o diretorio temporario no EXIT (gancho da lib.sh, roda depois de gravar o FIM).
ampara_limpeza() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

carrega_conf() {
  local conf="${AMPARA_VM_CONF:-/etc/ampara/vm.conf}"
  if [[ ! -r "$conf" ]]; then
    conf="$DIR/config/vm.conf"
  fi
  # shellcheck source=config/vm.conf
  source "$conf"
  SRC_DIR="${SRC_DIR:-$(cd "$DIR/../.." && pwd)}"
  NODE_VERSION="${NODE_VERSION:-22.12.0}"
  DEMO="${DEMO:-true}"
  # O root precisa de HOME gravavel para npm, nuget e dotnet (o cloud-init pode nao definir).
  export HOME=/root
  export DOTNET_CLI_HOME=/root
  export DOTNET_CLI_TELEMETRY_OPTOUT=1
  export DOTNET_NOLOGO=1
  export DEBIAN_FRONTEND=noninteractive
  export PATH="/usr/local/bin:$DOTNET_DIR:$PATH"
  cd /
  TMP_DIR="$(mktemp -d /var/tmp/ampara-02.XXXXXX)"
}

# ---------------------------------------------------------------------------
# Fontes: aborta cedo (antes de instalar qualquer coisa) se faltar artefato do repositorio.
# ---------------------------------------------------------------------------
exige_arquivo() { # <caminho relativo a SRC_DIR> <mensagem de dica>
  if [[ ! -e "$SRC_DIR/$1" ]]; then
    ampara_erro "Falta $1: $2"
    exit 66
  fi
}

confere_fontes() {
  local -a achados
  exige_arquivo api/global.json "o codigo da API nao esta no repositorio (plano 02); commite e sincronize."
  mapfile -t achados < <(find "$SRC_DIR/api" -name Ampara.Api.csproj -not -path '*/obj/*' -not -path '*/bin/*')
  if [[ ${#achados[@]} -eq 0 ]]; then
    ampara_erro "Falta Ampara.Api.csproj em api/: o codigo da API nao esta no repositorio (plano 02); commite e sincronize."
    exit 66
  fi
  CSPROJ="${achados[0]}"
  exige_arquivo ponte-policia/requirements.txt "o codigo da Ponte nao esta no repositorio (plano 03); commite e sincronize."
  exige_arquivo ponte-policia/alembic.ini "o codigo da Ponte nao esta no repositorio (plano 03); commite e sincronize."
  exige_arquivo web-emergencia "a pagina de emergencia nao esta no repositorio; commite e sincronize."
  exige_arquivo web-painel-risco "o painel Risco Cidadao nao esta no repositorio; commite e sincronize."
  exige_arquivo ml/saida/risco.csv "rode o ML (plano 06) e commite"
  ampara_info "Fontes conferidas em $SRC_DIR."
}

# ---------------------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------------------
instala_pacotes_apt() {
  local icu
  apt-get -o DPkg::Lock::Timeout=300 update -qq
  apt-get -o DPkg::Lock::Timeout=300 install -y -qq --no-install-recommends \
    postgresql nginx python3 python3-venv python3-pip curl ca-certificates unzip jq openssl xz-utils
  # O .NET precisa do ICU (globalizacao); o nome do pacote muda com a versao do Ubuntu.
  icu="$(apt-cache search --names-only '^libicu[0-9]+$' | awk '{print $1}' | sort -V | tail -n1)"
  if [[ -n "$icu" ]]; then
    apt-get -o DPkg::Lock::Timeout=300 install -y -qq --no-install-recommends "$icu"
  fi
}

sdk_dotnet_instalado() { # <versao>
  local lista
  if [[ ! -x "$DOTNET_DIR/dotnet" ]]; then
    return 1
  fi
  lista="$("$DOTNET_DIR/dotnet" --list-sdks 2>/dev/null || true)"
  [[ "$lista" == "$1 "* || "$lista" == *$'\n'"$1 "* ]]
}

# Versao do framework de destino (ex.: 11.0), de Directory.Build.props ou do csproj.
tfm_da_api() {
  local arq tfm=""
  for arq in "$SRC_DIR/api/Directory.Build.props" "$CSPROJ"; do
    if [[ -r "$arq" ]]; then
      tfm="$(sed -n 's:.*<TargetFramework>net\([0-9][0-9.]*\)</TargetFramework>.*:\1:p' "$arq")"
      tfm="${tfm%%$'\n'*}"
      if [[ -n "$tfm" ]]; then
        break
      fi
    fi
  done
  printf '%s\n' "$tfm"
}

instala_dotnet() {
  local versao tfm runtimes
  versao="$(jq -r '.sdk.version' "$SRC_DIR/api/global.json")"
  if [[ -z "$versao" || "$versao" == "null" ]]; then
    ampara_erro "api/global.json sem sdk.version."
    exit 65
  fi
  curl -fsSL --retry 3 https://dot.net/v1/dotnet-install.sh -o "$TMP_DIR/dotnet-install.sh"
  if sdk_dotnet_instalado "$versao"; then
    ampara_info ".NET SDK $versao ja instalado."
  else
    ampara_info "Instalando .NET SDK $versao em $DOTNET_DIR."
    bash "$TMP_DIR/dotnet-install.sh" --version "$versao" --install-dir "$DOTNET_DIR" --no-path
  fi
  ln -sfn "$DOTNET_DIR/dotnet" /usr/local/bin/dotnet

  # O runtime ASP.NET do framework de destino precisa existir para a unit (dotnet Ampara.Api.dll).
  tfm="$(tfm_da_api)"
  if [[ -n "$tfm" ]]; then
    runtimes="$(dotnet --list-runtimes 2>/dev/null || true)"
    if [[ "$runtimes" != *"Microsoft.AspNetCore.App ${tfm}."* ]]; then
      ampara_info "Instalando runtime ASP.NET $tfm."
      bash "$TMP_DIR/dotnet-install.sh" --runtime aspnetcore --channel "$tfm" --install-dir "$DOTNET_DIR" --no-path
    fi
  fi
  runtimes="$(dotnet --list-runtimes 2>/dev/null || true)"
  if [[ "$runtimes" != *"Microsoft.AspNetCore.App"* ]]; then
    ampara_erro "Runtime Microsoft.AspNetCore.App ausente depois da instalacao do .NET."
    exit 1
  fi
}

instala_node() {
  local atual="" arch base arq
  if command -v node >/dev/null 2>&1; then
    atual="$(node --version)"
  fi
  if [[ "$atual" == "v$NODE_VERSION" ]]; then
    ampara_info "Node $NODE_VERSION ja instalado."
    return 0
  fi
  case "$(dpkg --print-architecture)" in
    amd64) arch=x64 ;;
    arm64) arch=arm64 ;;
    *)
      ampara_erro "Arquitetura sem tarball oficial do Node: $(dpkg --print-architecture)."
      exit 1
      ;;
  esac
  base="https://nodejs.org/dist/v${NODE_VERSION}"
  arq="node-v${NODE_VERSION}-linux-${arch}.tar.xz"
  ampara_info "Baixando Node $NODE_VERSION (tarball oficial)."
  curl -fsSL --retry 3 -o "$TMP_DIR/$arq" "$base/$arq"
  curl -fsSL --retry 3 -o "$TMP_DIR/SHASUMS256.txt" "$base/SHASUMS256.txt"
  (cd "$TMP_DIR" && grep " ${arq}\$" SHASUMS256.txt | sha256sum -c --quiet -)
  tar -xJf "$TMP_DIR/$arq" -C /usr/local --strip-components=1 --no-same-owner \
    --exclude="node-v${NODE_VERSION}-linux-${arch}/CHANGELOG.md" \
    --exclude="node-v${NODE_VERSION}-linux-${arch}/LICENSE" \
    --exclude="node-v${NODE_VERSION}-linux-${arch}/README.md"
  hash -r
  atual="$(node --version)"
  if [[ "$atual" != "v$NODE_VERSION" ]]; then
    ampara_erro "Node instalado ($atual) difere do esperado (v$NODE_VERSION)."
    exit 1
  fi
}

instala_dependencias() {
  instala_pacotes_apt
  instala_dotnet
  instala_node
}

garante_usuario_ampara() {
  if ! id ampara >/dev/null 2>&1; then
    useradd --system --user-group --create-home --home-dir /var/lib/ampara --shell /usr/sbin/nologin ampara
  fi
}

# ---------------------------------------------------------------------------
# Variaveis: ampara.env so ganha chaves ausentes; as existentes nunca sao trocadas.
# ---------------------------------------------------------------------------
env_valor() { # <chave> -> valor sem aspas (vazio se ausente)
  local linha
  linha="$(grep -m1 "^$1=" "$ENV_FILE" || true)"
  linha="${linha#*=}"
  linha="${linha%\"}"
  linha="${linha#\"}"
  printf '%s' "$linha"
}

# env_garante <chave> <comando que imprime o valor...>: o comando so roda se a chave faltar ou estiver vazia.
env_garante() {
  local chave=$1 valor
  shift
  if [[ -n "$(env_valor "$chave")" ]]; then
    return 0
  fi
  sed -i "/^${chave}=/d" "$ENV_FILE"
  if [[ -s "$ENV_FILE" && -n "$(tail -c1 "$ENV_FILE")" ]]; then
    printf '\n' >> "$ENV_FILE"
  fi
  valor="$("$@")"
  printf '%s="%s"\n' "$chave" "$valor" >> "$ENV_FILE"
  ampara_info "ampara.env: chave $chave adicionada."
}

valor_fixo() { printf '%s' "$1"; }
gera_conexao_ampara() {
  printf 'Host=127.0.0.1;Port=5432;Database=ampara;Username=ampara;Password=%s' "$(openssl rand -hex 16)"
}
gera_conexao_ponte() {
  printf 'postgresql+psycopg://ponte:%s@127.0.0.1:5432/ponte' "$(openssl rand -hex 16)"
}
gera_jwt() { # 80 caracteres alfanumericos (sem pipe que feche cedo: pipefail)
  local s
  s="$(openssl rand -base64 300 | tr -dc 'A-Za-z0-9')"
  printf '%s' "${s:0:80}"
}
gera_chave_cripto() { openssl rand -base64 32; }
gera_hex32() { openssl rand -hex 32; }

gera_env() {
  garante_usuario_ampara
  install -d -m 0755 /etc/ampara
  if [[ ! -e "$ENV_FILE" ]]; then
    install -m 0640 -o root -g ampara /dev/null "$ENV_FILE"
  fi
  chown root:ampara "$ENV_FILE"
  chmod 0640 "$ENV_FILE"

  env_garante AMPARA_DB gera_conexao_ampara
  env_garante AMPARA_JWT_SECRET gera_jwt
  env_garante AMPARA_CRYPTO_KEY gera_chave_cripto
  env_garante AMPARA_DEMO valor_fixo "$DEMO"
  env_garante RISCO_CSV valor_fixo "$DEST_DADOS/risco.csv"
  env_garante MQTT_HOST valor_fixo broker.hivemq.com
  env_garante MQTT_PORT valor_fixo 1883
  env_garante PONTE_URL valor_fixo http://127.0.0.1:8000
  env_garante PONTE_CHAVE_SERVICO gera_hex32
  env_garante PONTE_CHAVE_POLICIA gera_hex32
  env_garante PONTE_DB gera_conexao_ponte
  env_garante ANTHROPIC_MODEL valor_fixo claude-haiku-5-5
  ampara_info "ampara.env conferido (0640 root:ampara)."
}

cria_segredos_vazio() {
  if [[ ! -e "$SEGREDOS_FILE" ]]; then
    install -m 0640 -o root -g ampara /dev/null "$SEGREDOS_FILE"
    printf '%s\n' '# ANTHROPIC_API_KEY=... (preencher por ssh; nunca versionar)' > "$SEGREDOS_FILE"
  fi
  chown root:ampara "$SEGREDOS_FILE"
  chmod 0640 "$SEGREDOS_FILE"
}

# ---------------------------------------------------------------------------
# Bancos: as senhas vem do ampara.env (fonte unica); o ALTER ROLE mantem as duas pontas iguais.
# ---------------------------------------------------------------------------
cria_papel_e_banco() { # <papel> <banco> <senha>; a senha entra por stdin, nunca por argumento
  local papel=$1 banco=$2 senha=$3
  {
    printf '%s\n' "\\set pw '$senha'"
    cat <<SQL
SELECT format('CREATE ROLE %I LOGIN', '$papel') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$papel') \gexec
ALTER ROLE $papel WITH LOGIN PASSWORD :'pw';
SELECT format('CREATE DATABASE %I OWNER %I', '$banco', '$papel') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$banco') \gexec
SQL
  } | runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1
}

cria_bancos() {
  local senha_ampara url_ponte senha_ponte
  systemctl enable --now postgresql
  if ! ampara_espera_ate 90 pg_isready -q; then
    ampara_erro "PostgreSQL nao ficou pronto em 90 s."
    exit 1
  fi
  senha_ampara="$(ampara_campo_conexao "$(env_valor AMPARA_DB)" Password)"
  url_ponte="$(env_valor PONTE_DB)"
  senha_ponte="${url_ponte#*://}"
  senha_ponte="${senha_ponte#*:}"
  senha_ponte="${senha_ponte%%@*}"
  if [[ -z "$senha_ampara" || -z "$senha_ponte" ]]; then
    ampara_erro "Nao consegui ler as senhas dos bancos no ampara.env."
    exit 1
  fi
  cria_papel_e_banco ampara ampara "$senha_ampara"
  cria_papel_e_banco ponte ponte "$senha_ponte"
  ampara_info "Roles e bancos ampara e ponte conferidos."
}

# ---------------------------------------------------------------------------
# Build e publicacao
# ---------------------------------------------------------------------------
copia_risco() {
  install -d -m 0755 -o ampara -g ampara "$DEST_DADOS"
  install -m 0644 -o ampara -g ampara "$SRC_DIR/ml/saida/risco.csv" "$DEST_DADOS/risco.csv"
}

publica_api() {
  ampara_info "dotnet publish ($CSPROJ)."
  install -d -m 0755 "$DEST_API"
  dotnet publish "$CSPROJ" -c Release -o "$DEST_API" --nologo -v minimal
  if [[ ! -f "$DEST_API/Ampara.Api.dll" ]]; then
    ampara_erro "dotnet publish nao gerou $DEST_API/Ampara.Api.dll."
    exit 1
  fi
  install -d -m 0755 -o ampara -g ampara /var/lib/ampara
  chown -R ampara:ampara "$DEST_API"
}

publica_ponte() {
  local origem="$SRC_DIR/ponte-policia"
  ampara_info "Publicando a Ponte em $DEST_PONTE."
  install -d -m 0755 "$DEST_PONTE"
  # Codigo novo por cima do velho (sem apagar o venv); remove o que saiu do repositorio.
  rm -rf "$DEST_PONTE/app" "$DEST_PONTE/alembic"
  tar -C "$origem" \
    --exclude=__pycache__ --exclude=.pytest_cache --exclude=venv --exclude=.venv \
    --exclude=tests --exclude=evidencias \
    -cf - . | tar -C "$DEST_PONTE" --no-same-owner -xf -
  if [[ ! -x "$DEST_PONTE/venv/bin/python" ]]; then
    python3 -m venv "$DEST_PONTE/venv"
  fi
  "$DEST_PONTE/venv/bin/pip" install --disable-pip-version-check -q -r "$DEST_PONTE/requirements.txt"
  if [[ ! -x "$DEST_PONTE/venv/bin/uvicorn" || ! -x "$DEST_PONTE/venv/bin/alembic" ]]; then
    ampara_erro "uvicorn/alembic ausentes no venv da Ponte (conferir requirements.txt)."
    exit 1
  fi
  chown -R ampara:ampara "$DEST_PONTE"
}

# Constroi uma pagina e a copia para $DEST_WEB/<destino>. Mesma origem: a URL da API fica vazia
# (o cliente concatena /api/v1).
constroi_pagina() { # <pasta no repositorio> <destino em /var/www/ampara>
  local pasta="$SRC_DIR/$1" destino="$DEST_WEB/$2" saida
  if [[ -f "$pasta/package.json" ]]; then
    ampara_info "Build de $1 (npm ci + npm run build)."
    (
      cd "$pasta"
      npm ci --no-audit --no-fund --loglevel=error
      EXPO_PUBLIC_API_URL="" VITE_API_URL="" npm run build
    )
    saida="$pasta/dist"
  else
    ampara_info "$1 sem package.json: copiando os arquivos como estao."
    saida="$pasta"
  fi
  if [[ ! -f "$saida/index.html" ]]; then
    ampara_erro "$1 nao gerou index.html em $saida."
    exit 1
  fi
  rm -rf "${destino}.novo"
  install -d -m 0755 "${destino}.novo"
  cp -a "$saida/." "${destino}.novo/"
  rm -rf "$destino"
  mv "${destino}.novo" "$destino"
  chmod -R a+rX "$destino"
}

publica_web() {
  install -d -m 0755 "$DEST_WEB"
  constroi_pagina web-emergencia emergencia
  # O build do painel ja leva --base=/painel-risco/ (script do package.json e vite.config.ts);
  # repetir o flag viraria uma lista no vite. Conferimos o resultado em vez de repetir.
  constroi_pagina web-painel-risco painel-risco
  if ! grep -q '/painel-risco/' "$DEST_WEB/painel-risco/index.html"; then
    ampara_erro "O painel nao foi construido com --base=/painel-risco/ (os assets quebrariam atras do nginx)."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# nginx, units e saude
# ---------------------------------------------------------------------------
configura_nginx() {
  install -m 0644 "$DIR/config/nginx-ampara.conf" /etc/nginx/sites-available/ampara
  rm -f /etc/nginx/sites-enabled/default
  ln -sfn /etc/nginx/sites-available/ampara /etc/nginx/sites-enabled/ampara
  install -d -m 0755 /etc/systemd/system/nginx.service.d
  cat > /etc/systemd/system/nginx.service.d/ampara.conf <<'EOF'
[Unit]
After=ampara-ponte.service
Requires=ampara-ponte.service
EOF
  chmod 0644 /etc/systemd/system/nginx.service.d/ampara.conf
  nginx -t
}

instala_units() {
  local unit
  install -m 0755 "$DIR/ampara-migra.sh" /usr/local/sbin/ampara-migra.sh
  install -m 0755 "$DIR/ampara-healthcheck.sh" /usr/local/sbin/ampara-healthcheck.sh
  for unit in ampara-migrations ampara-api ampara-ponte; do
    install -m 0644 "$DIR/config/units/$unit.service" "/etc/systemd/system/$unit.service"
  done
  systemctl daemon-reload
  systemctl enable postgresql ampara-migrations ampara-api ampara-ponte nginx
  # Ordem explicita (e binarios novos): PostgreSQL -> migrations -> API -> Ponte -> nginx.
  systemctl start postgresql
  systemctl restart ampara-migrations
  systemctl restart ampara-api
  systemctl restart ampara-ponte
  nginx -t
  systemctl restart nginx
}

aguarda_saude() {
  if ! /usr/local/sbin/ampara-healthcheck.sh 120; then
    ampara_erro "A API nao ficou saudavel. Veja: journalctl -u ampara-migrations -u ampara-api -n 50 --no-pager"
    exit 1
  fi
}

main() {
  ampara_exige_root
  ampara_iniciar_execucao "$(basename "$0")"
  carrega_conf
  confere_fontes
  instala_dependencias
  gera_env
  cria_segredos_vazio
  cria_bancos
  copia_risco
  publica_api
  publica_ponte
  publica_web
  configura_nginx
  instala_units
  aguarda_saude
  ampara_info "02-app concluido."
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
