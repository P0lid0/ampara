#!/usr/bin/env bash
# verifica-vm.sh - a rubrica de SO (PDF p.37) escrita como asserções.
# Roda DENTRO da VM, como root, depois do provisiona.sh.
#
#   verifica-vm.sh [--lista] [--criterio <id>] [--saida <arquivo>]
#
# Sai 0 só se nenhuma checagem bloqueante (checa) falhar. Checagens de aviso
# (avisa) nunca bloqueiam. --lista não exige root e não toca no sistema.
# Nunca imprime o valor de um segredo: só nomes de chaves.
# As funções chk_*, roda_* e helpers são chamadas por nome (argv de checa/avisa).
# shellcheck disable=SC2329
set -euo pipefail

ARGS=("$@")

# ---------------------------------------------------------------- constantes
CRITERIOS=("infra 2" "app 2" "monitor 2" "tolerante 1" "logs 1" "completo 2")

ENV_FILE="${AMPARA_ENV_FILE:-/etc/ampara/ampara.env}"
VM_CONF="${AMPARA_VM_CONF:-/etc/ampara/vm.conf}"
MONITOR_CONF="${AMPARA_MONITOR_CONF:-/etc/ampara/monitor.conf}"
LOG_DIR="${AMPARA_LOG_DIR:-/var/log/ampara}"
MONITOR_BIN="/usr/local/sbin/ampara-monitor.sh"
CLOUD_INIT_LOG="/var/log/cloud-init-output.log"

CHAVES_ENV=(AMPARA_DB AMPARA_JWT_SECRET AMPARA_CRYPTO_KEY AMPARA_DEMO RISCO_CSV
  MQTT_HOST MQTT_PORT PONTE_URL PONTE_CHAVE_SERVICO PONTE_CHAVE_POLICIA
  PONTE_DB ANTHROPIC_MODEL)

# Estado do relatório.
FILTRO=""
LISTA=0
SAIDA=""
declare -A NCHECK=()
declare -A NFALHA=()
HTTP_CODIGO=""
HTTP_CORPO=""

# ------------------------------------------------------------------- uso/args
uso() {
  cat >&2 <<'EOF'
Uso: verifica-vm.sh [--lista] [--criterio <id>] [--saida <arquivo>]
  --lista             imprime os critérios e a pontuação de cada um (não exige root)
  --criterio <id>     roda só um critério: infra, app, monitor, tolerante, logs, completo
  --saida <arquivo>   repete toda a saída no arquivo
Precisa de root (sudo) para as checagens.
EOF
  exit "${1:-64}"
}

id_valido() {
  local item
  for item in "${CRITERIOS[@]}"; do
    [[ ${item%% *} == "$1" ]] && return 0
  done
  return 1
}

lista_criterios() {
  local item
  for item in "${CRITERIOS[@]}"; do
    printf '%s\n' "$item"
  done
}

# ------------------------------------------------------------ framework checa
quer_criterio() {
  [[ -z $FILTRO || $FILTRO == "$1" ]]
}

conta() { # <criterio> <falhou 0|1>
  NCHECK[$1]=$((${NCHECK[$1]:-0} + 1))
  NFALHA[$1]=$((${NFALHA[$1]:-0} + $2))
}

mostra_detalhe() { # imprime até 6 linhas da saída, indentadas
  local texto=$1 linha n=0
  while IFS= read -r linha; do
    [[ -n $linha ]] || continue
    printf '       %s\n' "$linha"
    n=$((n + 1))
    ((n < 6)) || break
  done <<<"$texto"
}

# checa <criterio> <descricao> <comando...>   (sem eval: executa o argv recebido)
checa() {
  local criterio=$1 desc=$2 saida rc=0
  shift 2
  quer_criterio "$criterio" || return 0
  saida=$("$@" 2>&1) || rc=$?
  if ((rc == 0)); then
    printf '[OK] %s: %s\n' "$criterio" "$desc"
    conta "$criterio" 0
  else
    printf '[FALHA] %s: %s\n' "$criterio" "$desc"
    mostra_detalhe "$saida"
    conta "$criterio" 1
  fi
  return 0
}

# avisa <criterio> <descricao> <comando...>   (nunca bloqueia)
avisa() {
  local criterio=$1 desc=$2 saida rc=0
  shift 2
  quer_criterio "$criterio" || return 0
  saida=$("$@" 2>&1) || rc=$?
  if ((rc == 0)); then
    printf '[OK] %s: %s\n' "$criterio" "$desc"
  else
    printf '[AVISO] %s: %s\n' "$criterio" "$desc"
    mostra_detalhe "$saida"
  fi
  return 0
}

# ---------------------------------------------------------- helpers de checagem
# Cada helper devolve 0/1 de forma explícita (rodam dentro de $(...), onde o
# errexit não vale) e só imprime detalhe que não seja segredo.

saida_igual() { # <esperado> <comando...>
  local esperado=$1 out
  shift
  out=$("$@" 2>&1) || { echo "$out"; return 1; }
  [[ $out == "$esperado" ]] || { echo "obtido: $out (esperado: $esperado)"; return 1; }
  return 0
}

saida_contem() { # <regex-ERE> <comando...>
  local re=$1 out
  shift
  out=$("$@" 2>&1) || { echo "$out"; return 1; }
  grep -Eq -- "$re" <<<"$out" || { echo "saída não casa com: $re"; return 1; }
  return 0
}

chk_modo() { # <arquivo> <modo> [dono:grupo]
  local arq=$1 modo_esperado=$2 dono_esperado=${3:-} modo dono
  [[ -e $arq ]] || { echo "ausente: $arq"; return 1; }
  modo=$(stat -c '%a' -- "$arq") || return 1
  [[ $modo == "$modo_esperado" ]] || { echo "$arq: modo $modo (esperado $modo_esperado)"; return 1; }
  if [[ -n $dono_esperado ]]; then
    dono=$(stat -c '%U:%G' -- "$arq") || return 1
    [[ $dono == "$dono_esperado" ]] || { echo "$arq: dono $dono (esperado $dono_esperado)"; return 1; }
  fi
  return 0
}

env_valor() { # <chave> -> valor sem aspas (vazio se ausente); falha se o arquivo não abre
  local chave=$1 linha valor
  [[ -r $ENV_FILE ]] || return 1
  linha=$(grep -m1 -E "^${chave}=" "$ENV_FILE" || true)
  valor=${linha#*=}
  valor=${valor#\"}
  valor=${valor%\"}
  valor=${valor#\'}
  valor=${valor%\'}
  printf '%s' "$valor"
}

health_url() { # HEALTH_URL de vm.conf; ausência é falha da checagem
  local url
  [[ -r $VM_CONF ]] || { echo "falta $VM_CONF" >&2; return 1; }
  # shellcheck source=/dev/null
  url=$(set +u; . "$VM_CONF" >/dev/null 2>&1; printf '%s' "${HEALTH_URL:-}") || true
  [[ -n $url ]] || { echo "HEALTH_URL ausente em $VM_CONF" >&2; return 1; }
  printf '%s' "$url"
}

http_get() { # <url> [args do curl...] -> define HTTP_CODIGO e HTTP_CORPO
  local url=$1 resp
  shift
  resp=$(curl -s --max-time 10 -w $'\n%{http_code}' "$@" "$url") || true
  HTTP_CODIGO=${resp##*$'\n'}
  HTTP_CORPO=${resp%$'\n'*}
  return 0
}

conta_linhas() { # <texto-fixo> <arquivo>
  local n
  n=$(grep -cF -- "$1" "$2" 2>/dev/null || true)
  printf '%s' "${n:-0}"
}

conta_journal() { # <texto-fixo> nas últimas mensagens do monitor
  local n
  n=$(journalctl -t ampara-monitor --since "-2 min" --no-pager -o cat 2>/dev/null | grep -cF -- "$1" || true)
  printf '%s' "${n:-0}"
}

# ---------------------------------------------------------------- infra
chk_netplan() {
  local arq=/etc/netplan/60-ampara.yaml
  chk_modo "$arq" 600 || return 1
  grep -qF -- '10.0.2.3' "$arq" || { echo "$arq não menciona o DNS 10.0.2.3"; return 1; }
  return 0
}

chk_shell_ampara() {
  local shell_atual
  shell_atual=$(getent passwd ampara | cut -d: -f7) || { echo "usuário ampara não existe"; return 1; }
  [[ $shell_atual == /usr/sbin/nologin ]] || { echo "shell de ampara: ${shell_atual:-vazio}"; return 1; }
  return 0
}

chk_ufw_padrao() {
  local out item
  out=$(ufw status verbose 2>&1) || { echo "ufw status verbose falhou: $out"; return 1; }
  for item in 'Status: active' 'deny (incoming)' 'deny (outgoing)'; do
    grep -qF -- "$item" <<<"$out" || { echo "faltou: $item"; return 1; }
  done
  return 0
}

chk_ufw_1883() {
  # Exatamente 1 regra para 1883, de saída. A linha espelho "(v6)" não conta:
  # o que importa é que a regra não esteja duplicada.
  local out
  local -a regras=()
  out=$(ufw status 2>&1) || { echo "ufw status falhou: $out"; return 1; }
  mapfile -t regras < <(grep -F -- '1883' <<<"$out" | grep -vF -- '(v6)' || true)
  ((${#regras[@]} == 1)) || { echo "regras 1883 (sem v6): ${#regras[@]} (esperado 1)"; return 1; }
  [[ ${regras[0]} == *'ALLOW OUT'* ]] || { echo "a regra 1883 não é ALLOW OUT: ${regras[0]}"; return 1; }
  return 0
}

# ---------------------------------------------------------------- app
chk_env_chaves() {
  local chave valor faltam=""
  [[ -r $ENV_FILE ]] || { echo "não consegui ler $ENV_FILE"; return 1; }
  for chave in "${CHAVES_ENV[@]}"; do
    valor=$(env_valor "$chave") || valor=""
    [[ -n $valor ]] || faltam+=" $chave"
  done
  [[ -z $faltam ]] || { echo "ausentes ou vazias:$faltam"; return 1; }
  return 0
}

chk_env_chaves_distintas() {
  local servico policia
  servico=$(env_valor PONTE_CHAVE_SERVICO) || { echo "não consegui ler $ENV_FILE"; return 1; }
  policia=$(env_valor PONTE_CHAVE_POLICIA) || { echo "não consegui ler $ENV_FILE"; return 1; }
  [[ -n $servico && -n $policia ]] || { echo "PONTE_CHAVE_SERVICO ou PONTE_CHAVE_POLICIA vazia"; return 1; }
  [[ $servico != "$policia" ]] || { echo "as duas chaves da Ponte são iguais"; return 1; }
  return 0
}

chk_jwt_tamanho() {
  local jwt
  jwt=$(env_valor AMPARA_JWT_SECRET) || { echo "não consegui ler $ENV_FILE"; return 1; }
  ((${#jwt} >= 64)) || { echo "AMPARA_JWT_SECRET com ${#jwt} caracteres (mínimo 64)"; return 1; }
  return 0
}

chk_crypto_32_bytes() {
  local chave bytes
  chave=$(env_valor AMPARA_CRYPTO_KEY) || { echo "não consegui ler $ENV_FILE"; return 1; }
  [[ -n $chave ]] || { echo "AMPARA_CRYPTO_KEY vazia"; return 1; }
  bytes=$(printf '%s' "$chave" | base64 -d 2>/dev/null | wc -c) || { echo "AMPARA_CRYPTO_KEY não é base64 válido"; return 1; }
  ((bytes == 32)) || { echo "AMPARA_CRYPTO_KEY decodifica para $bytes bytes (esperado 32)"; return 1; }
  return 0
}

chk_ordem() { # <unit> <dependencia>: dependência em After= e em Requires=
  local unit=$1 dep=$2 prop palavra achou
  local -a palavras=()
  for prop in After Requires; do
    palavras=()
    read -r -a palavras <<<"$(systemctl show -p "$prop" --value "$unit" 2>/dev/null)" || true
    achou=1
    for palavra in "${palavras[@]}"; do
      [[ $palavra == "$dep" ]] && achou=0
    done
    ((achou == 0)) || { echo "$unit: $prop= não inclui $dep"; return 1; }
  done
  return 0
}

chk_health() { # saúde da API: HTTP 200 com status ok ou degradado
  local url
  url=$(health_url) || return 1
  http_get "$url"
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} em $url"; return 1; }
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"(ok|degradado)"' <<<"$HTTP_CORPO" \
    || { echo "corpo sem \"status\":\"ok\" nem \"degradado\""; return 1; }
  return 0
}

chk_sem_segredos_nos_logs() {
  # Procura (texto fixo) cada segredo do ampara.env nos logs. Nunca imprime o valor.
  local chave valor vazaram="" db_valor
  local -a alvos=()
  [[ -r $ENV_FILE ]] || { echo "não consegui ler $ENV_FILE"; return 1; }
  [[ -d $LOG_DIR ]] || { echo "falta $LOG_DIR"; return 1; }
  alvos=("$LOG_DIR")
  [[ -e $CLOUD_INIT_LOG ]] && alvos+=("$CLOUD_INIT_LOG")
  for chave in AMPARA_JWT_SECRET AMPARA_CRYPTO_KEY PONTE_CHAVE_SERVICO PONTE_CHAVE_POLICIA; do
    valor=$(env_valor "$chave") || valor=""
    [[ -n $valor ]] || continue
    if grep -rqF -- "$valor" "${alvos[@]}" 2>/dev/null; then
      vazaram+=" $chave"
    fi
  done
  # Senhas embutidas nas strings de conexão.
  db_valor=$(env_valor AMPARA_DB) || db_valor=""
  valor=$(sed -n 's/.*[Pp]assword=\([^;"]*\).*/\1/p' <<<"$db_valor")
  if [[ -n $valor ]] && grep -rqF -- "$valor" "${alvos[@]}" 2>/dev/null; then
    vazaram+=" AMPARA_DB(senha)"
  fi
  db_valor=$(env_valor PONTE_DB) || db_valor=""
  valor=$(sed -nE 's#^[^:]+://[^:]+:([^@]+)@.*#\1#p' <<<"$db_valor")
  if [[ -n $valor ]] && grep -rqF -- "$valor" "${alvos[@]}" 2>/dev/null; then
    vazaram+=" PONTE_DB(senha)"
  fi
  [[ -z $vazaram ]] || { echo "segredos achados nos logs:$vazaram"; return 1; }
  return 0
}

# ---------------------------------------------------------------- monitor
chk_monitor_conf() {
  local linha
  [[ -r $MONITOR_CONF ]] || { echo "não consegui ler $MONITOR_CONF"; return 1; }
  for linha in CPU_LIMITE=80 MEM_LIMITE=80 DISCO_LIMITE=85; do
    grep -qxF -- "$linha" "$MONITOR_CONF" || { echo "$MONITOR_CONF não tem a linha $linha"; return 1; }
  done
  return 0
}

chk_alerta_forcado() { # <TIPO> <VARIAVEL_DE_LIMITE>
  local tipo=$1 var=$2 alvo antes depois j_antes j_depois
  alvo="$LOG_DIR/alertas.log"
  [[ -x $MONITOR_BIN ]] || { echo "falta $MONITOR_BIN executável"; return 1; }
  antes=$(conta_linhas "| ALERTA | $tipo |" "$alvo")
  j_antes=$(conta_journal "$tipo")
  env "${var}=-1" timeout 60 "$MONITOR_BIN" --uma-vez >/dev/null 2>&1 || true
  journalctl --sync >/dev/null 2>&1 || true
  sleep 1
  depois=$(conta_linhas "| ALERTA | $tipo |" "$alvo")
  j_depois=$(conta_journal "$tipo")
  ((depois > antes)) || { echo "alertas.log não cresceu para $tipo ($antes -> $depois) com $var=-1"; return 1; }
  ((j_depois > j_antes)) || { echo "journald não registrou $tipo ($j_antes -> $j_depois)"; return 1; }
  return 0
}

# ---------------------------------------------------------------- logs
chk_execucao() { # <script>: INICIO e FIM com código 0 em execucao.log
  local script=$1 arq="$LOG_DIR/execucao.log"
  [[ -r $arq ]] || { echo "não consegui ler $arq"; return 1; }
  grep -qF -- "| $script | INICIO |" "$arq" || { echo "sem INICIO de $script"; return 1; }
  grep -qF -- "| $script | FIM | codigo=0" "$arq" || { echo "sem FIM codigo=0 de $script"; return 1; }
  return 0
}

chk_regras_auditd() {
  local out chave
  out=$(auditctl -l 2>&1) || { echo "auditctl -l falhou: $out"; return 1; }
  for chave in ampara_config ampara_scripts ampara_sudo; do
    grep -qF -- "-k $chave" <<<"$out" || { echo "regra -k $chave ausente"; return 1; }
  done
  return 0
}

chk_evento_auditoria() {
  # Mexe em /etc/ampara e espera o ausearch enxergar; apaga o arquivo no fim.
  local arq=/etc/ampara/.teste-auditoria out achou=1
  [[ -d /etc/ampara ]] || { echo "falta /etc/ampara"; return 1; }
  touch "$arq" || return 1
  for _ in 1 2 3 4 5 6; do
    sleep 1
    out=$(ausearch -k ampara_config -i --start recent 2>&1 || true)
    if grep -qF -- '.teste-auditoria' <<<"$out"; then
      achou=0
      break
    fi
  done
  rm -f -- "$arq"
  ((achou == 0)) || { echo "ausearch -k ampara_config não achou o evento de $arq"; return 1; }
  return 0
}

# ---------------------------------------------------------------- completo
chk_http_200() { # <url>
  http_get "$1"
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} em $1"; return 1; }
  return 0
}

chk_nginx_health() {
  http_get http://127.0.0.1/health
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} em /health"; return 1; }
  grep -Eq '"db"[[:space:]]*:[[:space:]]*true' <<<"$HTTP_CORPO" || { echo "corpo sem \"db\":true"; return 1; }
  return 0
}

chk_ponte_health() {
  http_get http://127.0.0.1/ponte/health
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} em /ponte/health"; return 1; }
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$HTTP_CORPO" || { echo "corpo sem \"status\":\"ok\""; return 1; }
  return 0
}

chk_policia_prefixo() {
  http_get http://127.0.0.1/policia
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} em /policia"; return 1; }
  grep -qF -- 'const API_BASE = "/ponte";' <<<"$HTTP_CORPO" \
    || { echo 'a página não contém const API_BASE = "/ponte"; (X-Forwarded-Prefix)'; return 1; }
  return 0
}

chk_hotspots_sem_chave() {
  http_get http://127.0.0.1/ponte/hotspots
  [[ $HTTP_CODIGO == 401 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} sem chave (esperado 401)"; return 1; }
  return 0
}

chk_hotspots_com_chave() {
  # A chave vai por arquivo de configuração do curl (process substitution),
  # para não aparecer na lista de processos.
  local chave
  chave=$(env_valor PONTE_CHAVE_POLICIA) || { echo "não consegui ler $ENV_FILE"; return 1; }
  [[ -n $chave ]] || { echo "PONTE_CHAVE_POLICIA vazia"; return 1; }
  http_get http://127.0.0.1/ponte/hotspots -K <(printf 'header = "X-Chave-Policia: %s"\n' "$chave")
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} com X-Chave-Policia (esperado 200)"; return 1; }
  return 0
}

chk_painel_assets() {
  http_get http://127.0.0.1/painel-risco/
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} em /painel-risco/"; return 1; }
  grep -Eq '(src|href)="/painel-risco/[^"]+' <<<"$HTTP_CORPO" \
    || { echo "nenhum asset referenciado sob /painel-risco/"; return 1; }
  if grep -Eq '(src|href)="/assets/' <<<"$HTTP_CORPO"; then
    echo "há asset apontando para /assets/ (faltou --base=/painel-risco/)"
    return 1
  fi
  return 0
}

chk_health_mqtt_ok() {
  local url
  url=$(health_url) || return 1
  http_get "$url"
  [[ $HTTP_CODIGO == 200 ]] || { echo "HTTP ${HTTP_CODIGO:-vazio} em $url"; return 1; }
  grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$HTTP_CORPO" || { echo "status não é ok"; return 1; }
  grep -Eq '"mqtt"[[:space:]]*:[[:space:]]*true' <<<"$HTTP_CORPO" || { echo "mqtt não está true (broker fora?)"; return 1; }
  return 0
}

# ---------------------------------------------------------------- checagens
roda_infra() {
  checa infra "hostname estático é ampara-vm" saida_igual ampara-vm hostnamectl --static
  checa infra "IP 10.0.2.15/24 na interface" saida_contem '10\.0\.2\.15/24' ip -4 -o addr
  checa infra "rota padrão via 10.0.2.2" saida_contem 'via 10\.0\.2\.2' ip route show default
  checa infra "netplan 60-ampara.yaml (modo 600, DNS 10.0.2.3)" chk_netplan
  checa infra "DNS resolve archive.ubuntu.com" getent hosts archive.ubuntu.com
  checa infra "usuário ampara existe" id ampara
  checa infra "usuário operador existe" id operador
  checa infra "shell de ampara é /usr/sbin/nologin" chk_shell_ampara
  checa infra "ufw ativo com deny incoming e deny outgoing" chk_ufw_padrao
  checa infra "ufw tem exatamente 1 regra 1883 ALLOW OUT" chk_ufw_1883
  checa infra "hora sincronizada por NTP" saida_igual yes timedatectl show -p NTPSynchronized --value
}

roda_app() {
  checa app "dotnet tem o runtime Microsoft.AspNetCore.App" saida_contem 'Microsoft\.AspNetCore\.App' dotnet --list-runtimes
  checa app "python3 responde a --version" python3 --version
  checa app "psql responde a --version" psql --version
  checa app "nginx responde a --version" nginx -v
  checa app "node responde a --version" node --version
  checa app "ampara.env com modo 640 e dono root:ampara" chk_modo "$ENV_FILE" 640 root:ampara
  checa app "ampara.env tem as 12 chaves do contrato, não vazias" chk_env_chaves
  checa app "PONTE_CHAVE_SERVICO e PONTE_CHAVE_POLICIA diferentes" chk_env_chaves_distintas
  checa app "AMPARA_JWT_SECRET com 64 caracteres ou mais" chk_jwt_tamanho
  checa app "AMPARA_CRYPTO_KEY decodifica para 32 bytes" chk_crypto_32_bytes
  checa app "unit postgresql ativa" systemctl is-active --quiet postgresql
  checa app "unit ampara-api ativa" systemctl is-active --quiet ampara-api
  checa app "unit ampara-ponte ativa" systemctl is-active --quiet ampara-ponte
  checa app "unit nginx ativa" systemctl is-active --quiet nginx
  checa app "ampara-migrations terminou com Result=success" saida_igual success systemctl show -p Result --value ampara-migrations.service
  checa app "ordem: ampara-migrations depois de postgresql (After e Requires)" chk_ordem ampara-migrations.service postgresql.service
  checa app "ordem: ampara-api depois de ampara-migrations (After e Requires)" chk_ordem ampara-api.service ampara-migrations.service
  checa app "ordem: ampara-ponte depois de ampara-api (After e Requires)" chk_ordem ampara-ponte.service ampara-api.service
  checa app "ordem: nginx depois de ampara-ponte (After e Requires)" chk_ordem nginx.service ampara-ponte.service
  checa app "HEALTH_URL responde 200 com status ok ou degradado" chk_health
  checa app "nenhum segredo do ampara.env aparece nos logs" chk_sem_segredos_nos_logs
}

roda_monitor() {
  checa monitor "/usr/local/sbin/ampara-monitor.sh é executável" test -x "$MONITOR_BIN"
  checa monitor "monitor.conf tem CPU_LIMITE=80, MEM_LIMITE=80 e DISCO_LIMITE=85" chk_monitor_conf
  checa monitor "alerta CPU forçado (AMPARA_CPU_LIMITE=-1) vai para alertas.log e journald" chk_alerta_forcado CPU AMPARA_CPU_LIMITE
  checa monitor "alerta MEMORIA forçado (AMPARA_MEM_LIMITE=-1) vai para alertas.log e journald" chk_alerta_forcado MEMORIA AMPARA_MEM_LIMITE
  checa monitor "alerta DISCO forçado (AMPARA_DISCO_LIMITE=-1) vai para alertas.log e journald" chk_alerta_forcado DISCO AMPARA_DISCO_LIMITE
}

roda_tolerante() {
  checa tolerante "ampara-monitor ativo" systemctl is-active --quiet ampara-monitor
  checa tolerante "ampara-monitor habilitado no boot" systemctl is-enabled --quiet ampara-monitor
  checa tolerante "ampara-monitor com Restart=always" saida_igual always systemctl show -p Restart --value ampara-monitor.service
  checa tolerante "ampara-monitor com WatchdogUSec=1min" saida_igual 1min systemctl show -p WatchdogUSec --value ampara-monitor.service
  checa tolerante "ampara-monitor sem limite de reinício (StartLimitIntervalUSec=0)" saida_igual 0 systemctl show -p StartLimitIntervalUSec --value ampara-monitor.service
  checa tolerante "ampara-monitor roda como User=ampara" saida_igual ampara systemctl show -p User --value ampara-monitor.service
  checa tolerante "ampara-api com Restart=always" saida_igual always systemctl show -p Restart --value ampara-api.service
  checa tolerante "ampara-ponte com Restart=always" saida_igual always systemctl show -p Restart --value ampara-ponte.service
}

roda_logs() {
  local script
  for script in 01-infra.sh 02-app.sh 03-monitor.sh 04-auditoria.sh; do
    checa logs "execucao.log tem INICIO e FIM codigo=0 de $script" chk_execucao "$script"
  done
  checa logs "auditd ativo" systemctl is-active --quiet auditd
  checa logs "auditctl -l tem as regras ampara_config, ampara_scripts e ampara_sudo" chk_regras_auditd
  checa logs "alteração em /etc/ampara aparece no ausearch (-k ampara_config)" chk_evento_auditoria
  checa logs "/etc/logrotate.d/ampara existe" test -f /etc/logrotate.d/ampara
  checa logs "logrotate -d /etc/logrotate.d/ampara sai 0" logrotate -d /etc/logrotate.d/ampara
}

roda_completo() {
  checa completo "GET / responde 200 (página de emergência)" chk_http_200 http://127.0.0.1/
  checa completo "GET /painel-risco/ responde 200" chk_http_200 http://127.0.0.1/painel-risco/
  checa completo "GET /policia responde 200" chk_http_200 http://127.0.0.1/policia
  checa completo "GET /api/v1/risco responde 200" chk_http_200 http://127.0.0.1/api/v1/risco
  checa completo "GET /health (nginx) responde 200 com \"db\":true" chk_nginx_health
  checa completo "GET /ponte/health tem \"status\":\"ok\"" chk_ponte_health
  checa completo "/policia traz const API_BASE = \"/ponte\"; (X-Forwarded-Prefix)" chk_policia_prefixo
  checa completo "/ponte/hotspots sem chave devolve 401" chk_hotspots_sem_chave
  checa completo "/ponte/hotspots com X-Chave-Policia devolve 200" chk_hotspots_com_chave
  checa completo "/painel-risco/ referencia assets sob /painel-risco/" chk_painel_assets
  checa completo "cloud-init terminou (status: done)" saida_contem '^status: done$' cloud-init status
  avisa completo "health com \"mqtt\":true e \"status\":\"ok\" (broker alcançável)" chk_health_mqtt_ok
  avisa completo "cloudflared ativo (túnel público)" systemctl is-active --quiet cloudflared
}

# ---------------------------------------------------------------- relatório
resumo() {
  local item id pts total=0 bloqueou=0 falhas
  echo
  for item in "${CRITERIOS[@]}"; do
    id=${item%% *}
    pts=${item##* }
    quer_criterio "$id" || continue
    falhas=${NFALHA[$id]:-0}
    if ((falhas == 0)); then
      printf 'CRITERIO %s %s pts: OK\n' "$id" "$pts"
      total=$((total + pts))
    else
      printf 'CRITERIO %s %s pts: FALHA\n' "$id" "$pts"
      bloqueou=1
    fi
  done
  printf 'PONTOS: %s/10\n' "$total"
  return "$bloqueou"
}

principal() {
  local item id
  echo "Verificação da VM Ampara em $(date -Iseconds)"
  for item in "${CRITERIOS[@]}"; do
    id=${item%% *}
    quer_criterio "$id" || continue
    echo
    echo "== critério: $id =="
    "roda_$id"
  done
  resumo
}

# --------------------------------------------------------------------- main
while (($# > 0)); do
  case $1 in
    --lista) LISTA=1 ;;
    --criterio)
      (($# >= 2)) || uso 64
      FILTRO=$2
      shift
      ;;
    --saida)
      (($# >= 2)) || uso 64
      SAIDA=$2
      shift
      ;;
    -h | --help) uso 0 ;;
    *)
      echo "Argumento desconhecido: $1" >&2
      uso 64
      ;;
  esac
  shift
done

if [[ -n $FILTRO ]] && ! id_valido "$FILTRO"; then
  echo "Critério desconhecido: $FILTRO (use --lista)" >&2
  exit 64
fi

if ((LISTA == 1)); then
  lista_criterios
  exit 0
fi

if ((EUID != 0)); then
  echo "Execute como root: sudo bash $0 ${ARGS[*]}" >&2
  exit 77
fi

rc=0
if [[ -n $SAIDA ]]; then
  principal 2>&1 | tee -- "$SAIDA" || rc=${PIPESTATUS[0]}
else
  principal || rc=$?
fi
exit "$rc"
