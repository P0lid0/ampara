#!/usr/bin/env bash
# teste-evidencias-sem-segredo.sh
#   <dir_evidencias> <arquivo_env>  confere: falha (exit 1) se algum VALOR secreto do env
#                                   aparecer em qualquer arquivo do diretorio (a chave pode aparecer).
#   (sem argumentos)                autoteste com fixtures falsas em mktemp -d (caso que passa e casos que falham);
#                                   e o modo que o rodar-todos.sh executa.
# Nunca imprime valor de segredo: so o nome da chave e o arquivo.
# Valores nao secretos (host do broker, porta, modelo, ...) e valores com menos de 6 caracteres
# nao entram na checagem: apareceriam por motivos legitimos (ex.: a porta 1883 no ufw).
set -euo pipefail

CHAVES_PUBLICAS="AMPARA_DEMO RISCO_CSV MQTT_HOST MQTT_PORT PONTE_URL ANTHROPIC_MODEL"
TAMANHO_MINIMO=6

# Imprime "CHAVE<TAB>valor" para cada valor a vigiar (valor inteiro e, em strings de
# conexao, a senha embutida).
lista_segredos() {
  local arq=$1 linha chave valor pw
  local re_linha='^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
  local re_dupla='^"(.*)"$'
  local re_simples="^'(.*)'\$"
  local re_senha_kv='[Pp]assword=([^;]+)'
  local re_senha_url='://[^:/@]+:([^@]+)@'
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
    if ((${#valor} >= TAMANHO_MINIMO)); then
      printf '%s\t%s\n' "$chave" "$valor"
    fi
    if [[ "$valor" =~ $re_senha_kv ]] || [[ "$valor" =~ $re_senha_url ]]; then
      pw=${BASH_REMATCH[1]}
      if ((${#pw} >= TAMANHO_MINIMO)); then
        printf '%s\t%s\n' "${chave}(senha)" "$pw"
      fi
    fi
  done <"$arq"
}

# 0 = limpo, 1 = vazou, 2 = uso incorreto
confere() {
  local dir=$1 env=$2 chave valor achados vazou=0 total=0
  if [[ ! -d "$dir" ]]; then
    echo "FALHOU: diretorio de evidencias inexistente: $dir" >&2
    return 2
  fi
  if [[ ! -f "$env" ]]; then
    echo "FALHOU: arquivo env inexistente: $env" >&2
    return 2
  fi
  while IFS=$'\t' read -r chave valor; do
    total=$((total + 1))
    if achados=$(grep -rFla -e "$valor" -- "$dir" 2>/dev/null) && [[ -n "$achados" ]]; then
      while IFS= read -r arq; do
        echo "FALHOU: o valor de $chave aparece em $arq"
      done <<<"$achados"
      vazou=1
    fi
  done < <(lista_segredos "$env")
  if ((total == 0)); then
    echo "FALHOU: nenhum valor secreto encontrado em $env (arquivo errado?)" >&2
    return 2
  fi
  if ((vazou)); then
    return 1
  fi
  echo "PASSOU: nenhum dos $total valores secretos aparece em $dir"
  return 0
}

autoteste() {
  local tmp rc saida falhas=0
  tmp=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT
  local env="$tmp/ampara.env"
  cat >"$env" <<'EOF'
# env de mentira para o autoteste
AMPARA_JWT_SECRET=Zk3q9XbN7pL2vR8sT1wY4cH6
AMPARA_CRYPTO_KEY="aGVsbG8tdGVzdGUtY2hhdmUtZmFrZS0zMmJ5dGVzISE="
AMPARA_DB="Host=127.0.0.1;Port=5432;Database=ampara;Username=ampara;Password=pgSenhaFalsa99"
PONTE_DB=postgresql+psycopg://ponte:pontePwFalsa77@127.0.0.1:5432/ponte
PONTE_CHAVE_POLICIA=0123456789abcdef0123456789abcdef
MQTT_HOST=broker.hivemq.com
MQTT_PORT=1883
AMPARA_DEMO=true
EOF

  espera() { # <rc_esperado> <descricao> <dir> [saida_nao_contem]
    local esperado=$1 desc=$2 dir=$3
    set +e
    saida=$(bash "$0" "$dir" "$env" 2>&1)
    rc=$?
    set -e
    if ((rc != esperado)); then
      echo "FALHOU: $desc (exit $rc, esperado $esperado)"
      falhas=$((falhas + 1))
    elif [[ "$saida" == *Zk3q9XbN7pL2vR8sT1wY4cH6* || "$saida" == *pgSenhaFalsa99* || "$saida" == *pontePwFalsa77* ]]; then
      echo "FALHOU: $desc (a saida imprimiu um valor de segredo)"
      falhas=$((falhas + 1))
    else
      echo "OK: $desc"
    fi
  }

  # caso que passa: chaves e valores publicos aparecem, valores secretos nao
  mkdir -p "$tmp/limpo/sub"
  {
    echo "AMPARA_JWT_SECRET presente e nao vazia"
    echo "AMPARA_DB com Password=*** (oculta)"
    echo "MQTT_HOST=broker.hivemq.com porta 1883 ALLOW OUT"
  } >"$tmp/limpo/01-verifica-vm.txt"
  echo "[OK] app: ampara.env com modo 640" >"$tmp/limpo/sub/outro.txt"
  espera 0 "diretorio limpo passa" "$tmp/limpo"

  # casos que falham
  mkdir -p "$tmp/ruim1/sub"
  echo "log: segredo Zk3q9XbN7pL2vR8sT1wY4cH6 vazou" >"$tmp/ruim1/sub/09-cloud-init-output.log"
  espera 1 "valor do JWT em subpasta falha" "$tmp/ruim1"

  mkdir -p "$tmp/ruim2"
  echo "conexao: Host=x;Password=pgSenhaFalsa99;" >"$tmp/ruim2/02-execucao.log"
  espera 1 "senha embutida na string do banco falha" "$tmp/ruim2"

  mkdir -p "$tmp/ruim3"
  echo "url postgresql://ponte:pontePwFalsa77@h/ponte" >"$tmp/ruim3/03-alertas.log"
  espera 1 "senha embutida na URL da Ponte falha" "$tmp/ruim3"

  mkdir -p "$tmp/ruim4"
  echo "chave 0123456789abcdef0123456789abcdef" >"$tmp/ruim4/04.txt"
  espera 1 "chave hex da policia falha" "$tmp/ruim4"

  espera 2 "diretorio inexistente e erro de uso" "$tmp/nao-existe"

  if ((falhas > 0)); then
    echo "FALHOU: $falhas caso(s) do autoteste"
    return 1
  fi
  echo "PASSOU: autoteste de teste-evidencias-sem-segredo"
}

main() {
  if (($# == 0)) || [[ "${1:-}" == "--autoteste" ]]; then
    autoteste
  elif (($# == 2)); then
    confere "$1" "$2"
  else
    echo "Uso: $0 <dir_evidencias> <arquivo_env> | $0 [--autoteste]" >&2
    return 2
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
