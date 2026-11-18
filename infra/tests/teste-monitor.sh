#!/usr/bin/env bash
# Testes de unidade do monitor (infra/vm/ampara-monitor.sh): funções puras, cooldown,
# serviços e um ciclo completo com /proc, df e health falsos.
set -euo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
MON="$RAIZ/infra/vm/ampara-monitor.sh"
# shellcheck source=lib-teste.sh
source "$RAIZ/infra/tests/lib-teste.sh"

if [ ! -f "$MON" ]; then
  echo "FALHOU: infra/vm/ampara-monitor.sh nao existe"
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Isola o teste de qualquer configuração do ambiente.
unset AMPARA_CPU_LIMITE AMPARA_MEM_LIMITE AMPARA_DISCO_LIMITE HEALTH_CMD HEALTH_URL \
  SYSTEMCTL PROC_STAT PROC_MEMINFO DF_CMD CPU_LIMITE MEM_LIMITE DISCO_LIMITE \
  INTERVALO_S COOLDOWN_S CPU_AMOSTRA_S SERVICOS ALERTAS_LOG NOTIFY_SOCKET || true
export AMPARA_VM_CONF="$TMP/inexistente-vm.conf"
export AMPARA_MONITOR_CONF="$TMP/inexistente-monitor.conf"
export AMPARA_LOG_DIR="$TMP/log"

# shellcheck source=../vm/ampara-monitor.sh
source "$MON"

linhas() { # <arquivo> <texto-fixo>
  if [ -f "$1" ]; then grep -cF -- "$2" "$1" || true; else echo 0; fi
}

# 1. Funções puras
assert_igual 70 "$(calcula_cpu 1000 800 2000 1100)" "calcula_cpu 70%"
assert_igual 0 "$(calcula_cpu 1000 800 1000 800)" "calcula_cpu sem delta (sem divisao por zero)"
assert_igual 80 "$(calcula_mem 4000000 800000)" "calcula_mem 80%"
assert_igual 90 "$(calcula_mem 4000000 400000)" "calcula_mem 90%"
assert_igual 0 "$(calcula_mem 0 0)" "calcula_mem sem MemTotal"
assert_igual 87 "$(parse_pcent ' 87%')" "parse_pcent"

rc=0; excedeu 81 80 || rc=$?; assert_igual 0 "$rc" "81 excede 80"
rc=0; excedeu 80 80 || rc=$?; assert_igual 1 "$rc" "80 nao excede 80 (estrito)"
rc=0; excedeu 0 -1 || rc=$?; assert_igual 0 "$rc" "0 excede -1"

# 2. Configuração
( carrega_config
  assert_igual "80 80 85" "$CPU_LIMITE $MEM_LIMITE $DISCO_LIMITE" "limites padrao sem arquivos"
  assert_igual "5 60 1" "$INTERVALO_S $COOLDOWN_S $CPU_AMOSTRA_S" "demais padroes" ) || exit 1

printf 'CPU_LIMITE=50\nSERVICOS="x y"\n' > "$TMP/monitor.conf"
( AMPARA_MONITOR_CONF="$TMP/monitor.conf" carrega_config
  assert_igual 50 "$CPU_LIMITE" "monitor.conf muda CPU_LIMITE"
  assert_igual 80 "$MEM_LIMITE" "MEM_LIMITE continua no padrao"
  assert_igual "x y" "$SERVICOS" "SERVICOS vem do conf" ) || exit 1

printf 'DISCO_LIMITE=70\n' > "$TMP/vm.conf"
printf 'DISCO_LIMITE=75\n' > "$TMP/monitor2.conf"
( AMPARA_VM_CONF="$TMP/vm.conf" AMPARA_MONITOR_CONF="$TMP/monitor2.conf" carrega_config
  assert_igual 75 "$DISCO_LIMITE" "monitor.conf vence vm.conf" ) || exit 1

( AMPARA_MONITOR_CONF="$TMP/monitor.conf" AMPARA_CPU_LIMITE=-1 carrega_config
  assert_igual -1 "$CPU_LIMITE" "ambiente vence o arquivo" ) || exit 1

# 3. MQTT no corpo do health
rc=0; mqtt_conectado '{"status":"ok","mqtt":true,"db":true}' || rc=$?
assert_igual 0 "$rc" "mqtt true"
rc=0; mqtt_conectado '{"status":"ok", "mqtt": false}' || rc=$?
assert_igual 1 "$rc" "mqtt false"
rc=0; mqtt_conectado '' || rc=$?
assert_igual 1 "$rc" "corpo vazio"
rc=0; mqtt_conectado '{"mqtt" :  true}' || rc=$?
assert_igual 0 "$rc" "mqtt true com espacos"

# 4. Cooldown (Review Focus 5)
reset() { ALERTAS_LOG="$TMP/alertas.log"; : > "$ALERTAS_LOG"; ULTIMO_ALERTA=(); SERVICO_ESTADO=(); }
reset
COOLDOWN_S=60
registra_alerta CPU "valor=90%" || true
rc=0; registra_alerta CPU "valor=91%" || rc=$?
assert_igual 1 "$rc" "segundo alerta dentro do cooldown e suprimido"
assert_igual 1 "$(linhas "$ALERTAS_LOG" '| ALERTA | CPU |')" "1 linha com cooldown 60"
assert_contem "$ALERTAS_LOG" '^[0-9T:+-]+ \| ALERTA \| CPU \| valor=90%' "formato da linha"
registra_alerta MEMORIA "valor=95%" || true
assert_igual 1 "$(linhas "$ALERTAS_LOG" '| ALERTA | MEMORIA |')" "cooldown e por tipo"
reset
COOLDOWN_S=0
registra_alerta CPU "valor=90%" || true
registra_alerta CPU "valor=90%" || true
assert_igual 2 "$(linhas "$ALERTAS_LOG" '| ALERTA | CPU |')" "2 linhas com cooldown 0"
COOLDOWN_S=60

# 5. Serviços com systemctl falso
cat > "$TMP/systemctl-falso" <<SCRIPT
#!/usr/bin/env bash
# uso: systemctl-falso is-active --quiet <unit>
if grep -qx -- "\$3" "$TMP/caidas" 2>/dev/null; then exit 3; fi
exit 0
SCRIPT
chmod +x "$TMP/systemctl-falso"
SYSTEMCTL="$TMP/systemctl-falso"
SERVICOS="a b"
reset
echo b > "$TMP/caidas"
verifica_servicos
assert_contem "$ALERTAS_LOG" '\| ALERTA \| SERVICO_INATIVO \| b' "b caida gera alerta"
assert_nao_contem "$ALERTAS_LOG" '\| SERVICO_INATIVO \| a' "a no ar nao gera alerta"
assert_nao_contem "$ALERTAS_LOG" 'SERVICO_RECUPERADO' "ainda sem recuperacao"
: > "$TMP/caidas"
verifica_servicos
assert_contem "$ALERTAS_LOG" '\| INFO \| SERVICO_RECUPERADO \| b' "b voltou"
assert_igual 1 "$(linhas "$ALERTAS_LOG" 'SERVICO_RECUPERADO | b')" "recuperacao registrada uma vez"
verifica_servicos
assert_igual 1 "$(linhas "$ALERTAS_LOG" 'SERVICO_RECUPERADO | b')" "sem repetir a recuperacao"

# duas unidades caidas ao mesmo tempo: o cooldown de uma nao cala a outra
reset
printf 'a\nb\n' > "$TMP/caidas"
verifica_servicos
assert_contem "$ALERTAS_LOG" '\| SERVICO_INATIVO \| a' "a caida"
assert_contem "$ALERTAS_LOG" '\| SERVICO_INATIVO \| b' "b caida junto"
: > "$TMP/caidas"

# 6. Ciclo completo (memória 90%, disco 90%, MQTT fora, CPU parada)
printf 'cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 1 1 1 1 0 0 0 0 0 0\n' > "$TMP/stat"
printf 'MemTotal:        4000000 kB\nMemFree:          100000 kB\nMemAvailable:     400000 kB\n' > "$TMP/meminfo"
reset
COOLDOWN_S=60
PROC_STAT="$TMP/stat"
PROC_MEMINFO="$TMP/meminfo"
DF_CMD='printf "Use%%\n 90%%\n"'
CPU_AMOSTRA_S=0
SERVICOS=""
CPU_LIMITE=80 MEM_LIMITE=80 DISCO_LIMITE=85
HEALTH_CMD="printf '%s\n' '{\"status\":\"degradado\",\"mqtt\":false,\"db\":true}'"
ciclo
assert_contem "$ALERTAS_LOG" '\| ALERTA \| MEMORIA \|' "alerta de memoria"
assert_contem "$ALERTAS_LOG" '\| ALERTA \| DISCO \|' "alerta de disco"
assert_contem "$ALERTAS_LOG" '\| ALERTA \| MQTT \|' "alerta de MQTT"
assert_nao_contem "$ALERTAS_LOG" '\| ALERTA \| CPU \|' "sem alerta de CPU"
assert_nao_contem "$ALERTAS_LOG" 'API_HEALTH' "health respondeu: sem API_HEALTH"

# health que falha: alerta API_HEALTH, sem derrubar o ciclo
reset
HEALTH_CMD=false
ciclo
assert_contem "$ALERTAS_LOG" '\| ALERTA \| API_HEALTH \|' "alerta de health"

# leitor quebrado nao aborta o ciclo
reset
PROC_STAT="$TMP/nao-existe"
HEALTH_CMD="printf '%s\n' '{\"status\":\"ok\",\"mqtt\":true,\"db\":true}'"
ciclo
assert_contem "$ALERTAS_LOG" '\| ALERTA \| MEMORIA \|' "ciclo segue depois de falha na leitura de CPU"
assert_contem "$ALERTAS_LOG" '\| ERRO \| LEITURA \| cpu' "falha de leitura registrada"
PROC_STAT="$TMP/stat"

# main --uma-vez com limites forcados pelo ambiente
reset
SERVICOS="" HEALTH_CMD="printf '%s\n' '{\"status\":\"ok\",\"mqtt\":true}'"
AMPARA_CPU_LIMITE=-1 ALERTAS_LOG="$ALERTAS_LOG" main --uma-vez
assert_contem "$ALERTAS_LOG" '\| INFO \| MONITOR_INICIADO \| pid=[0-9]+' "MONITOR_INICIADO"
assert_contem "$ALERTAS_LOG" '\| ALERTA \| CPU \|' "CPU forcada acima do limite -1"

echo "PASSOU teste-monitor"
