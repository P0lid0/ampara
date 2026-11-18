#!/usr/bin/env bash
# Teste de estrutura do verifica-vm.sh (Tarefa 4). As checagens em si só rodam
# dentro da VM; aqui se prova --lista, os códigos de saída, a sintaxe e que
# cada critério e cada exigência do plano estão escritos.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ALVO="$RAIZ/infra/vm/verifica-vm.sh"

falhou() {
  echo "FALHOU: $1"
  exit 1
}

assert_igual() { # <esperado> <obtido> <msg>
  [[ $1 == "$2" ]] || falhou "$3 (esperado '$1', obtido '$2')"
}

assert_arquivo_contem() { # <fixo> <msg>
  grep -qF -- "$1" "$ALVO" || falhou "$2 (faltou: $1)"
}

[[ -f $ALVO ]] || falhou "infra/vm/verifica-vm.sh não existe"

# --- --lista: exatamente 6 linhas, nesta ordem, somando 10 pontos
esperado=$'infra 2\napp 2\nmonitor 2\ntolerante 1\nlogs 1\ncompleto 2'
obtido="$(bash "$ALVO" --lista)" || falhou "--lista saiu com código diferente de 0"
assert_igual "$esperado" "$obtido" "--lista imprime os 6 critérios na ordem da rubrica"
soma="$(awk '{ s += $2 } END { print s }' <<<"$obtido")"
assert_igual "10" "$soma" "a soma dos pontos do --lista é 10"

# --- argumento inválido e critério desconhecido (antes de exigir root)
rc=0
bash "$ALVO" --criterio nao-existe >/dev/null 2>&1 || rc=$?
assert_igual "64" "$rc" "critério desconhecido sai com 64"
rc=0
bash "$ALVO" --bobagem >/dev/null 2>&1 || rc=$?
assert_igual "64" "$rc" "argumento desconhecido sai com 64"

# --- fora de root, as checagens recusam (77) em vez de rodar
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  rc=0
  bash "$ALVO" --criterio infra >/dev/null 2>&1 || rc=$?
  assert_igual "77" "$rc" "sem root, --criterio infra sai com 77"
fi

# --- forma do arquivo
[[ "$(head -n 1 "$ALVO")" == '#!/usr/bin/env bash' ]] || falhou "primeira linha não é o shebang"
grep -qF 'set -euo pipefail' "$ALVO" || falhou "falta set -euo pipefail"
if grep -qU $'\r' "$ALVO"; then falhou "verifica-vm.sh tem CR (precisa ser LF)"; fi
bash -n "$ALVO" || falhou "bash -n acusou erro de sintaxe"
if grep -qE '^[[:space:]]*set[[:space:]]+-[a-z]*x' "$ALVO"; then falhou "set -x vazaria segredo"; fi
if grep -qE '(^|[[:space:];])eval[[:space:]]' "$ALVO"; then falhou "não pode usar eval"; fi

# --- cada critério tem checagens escritas
for id in infra app monitor tolerante logs completo; do
  grep -qE "^[[:space:]]+checa $id " "$ALVO" || falhou "nenhuma checa do critério $id"
done

# --- cloudflared e MQTT só como aviso (a Tarefa 10 foi cortada)
if grep -E '^[[:space:]]+checa .*cloudflared' "$ALVO" >/dev/null; then
  falhou "cloudflared não pode ser checagem bloqueante"
fi
grep -qE '^[[:space:]]+avisa completo .*cloudflared' "$ALVO" || falhou "falta o aviso de cloudflared"
grep -qE '^[[:space:]]+avisa completo .*mqtt' "$ALVO" || falhou "falta o aviso de MQTT"

# --- exigências do plano que não podem sumir
assert_arquivo_contem '10.0.2.15/24' "IP fixo"
assert_arquivo_contem 'via 10\.0\.2\.2' "gateway"
assert_arquivo_contem '/etc/netplan/60-ampara.yaml' "arquivo do netplan"
assert_arquivo_contem '/usr/sbin/nologin' "shell de ampara"
assert_arquivo_contem '1883' "regra ufw do MQTT"
assert_arquivo_contem 'NTPSynchronized' "sincronização de hora"
assert_arquivo_contem 'Microsoft\.AspNetCore\.App' "runtime do .NET"
assert_arquivo_contem 'root:ampara' "dono do ampara.env"
assert_arquivo_contem 'PONTE_CHAVE_POLICIA' "chave da polícia"
assert_arquivo_contem 'ANTHROPIC_MODEL' "modelo do Claude"
# shellcheck disable=SC2016
assert_arquivo_contem 'systemctl show -p "$prop" --value' "ordem das units por systemctl show"
assert_arquivo_contem 'ampara-migrations.service' "unit de migrations"
assert_arquivo_contem 'AMPARA_CPU_LIMITE' "alerta forçado de CPU"
assert_arquivo_contem 'AMPARA_MEM_LIMITE' "alerta forçado de memória"
assert_arquivo_contem 'AMPARA_DISCO_LIMITE' "alerta forçado de disco"
assert_arquivo_contem 'WatchdogUSec' "watchdog do monitor"
assert_arquivo_contem 'StartLimitIntervalUSec' "sem limite de reinício"
assert_arquivo_contem '01-infra.sh 02-app.sh 03-monitor.sh 04-auditoria.sh' "scripts no execucao.log"
assert_arquivo_contem 'auditctl -l' "regras do auditd"
assert_arquivo_contem '.teste-auditoria' "evento de auditoria de teste"
assert_arquivo_contem 'logrotate -d' "logrotate em modo de teste"
assert_arquivo_contem 'const API_BASE = "/ponte";' "prefixo do painel da polícia"
assert_arquivo_contem 'X-Chave-Policia' "chave da polícia no hotspots"
assert_arquivo_contem '/painel-risco/' "assets do painel de risco"
assert_arquivo_contem 'status: done' "cloud-init concluído"

# --- shellcheck, se estiver instalado (o executor geral também roda)
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck -x "$ALVO" || falhou "shellcheck acusou avisos em verifica-vm.sh"
fi

echo "PASSOU: teste-verifica-estrutura"
