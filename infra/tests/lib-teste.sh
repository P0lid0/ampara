#!/usr/bin/env bash
# Asserções simples para os testes da infra. Para ser lido com `source`.
# Cada falha imprime "FALHOU: <msg>" e encerra com exit 1.

assert_igual() {
  local esperado=$1 obtido=$2 msg=$3
  if [ "$esperado" != "$obtido" ]; then
    echo "FALHOU: $msg (esperado='$esperado' obtido='$obtido')"
    exit 1
  fi
}

assert_contem() {
  local arquivo=$1 regex=$2 msg=$3
  if [ ! -f "$arquivo" ] || ! grep -Eq -- "$regex" "$arquivo"; then
    echo "FALHOU: $msg (nao achei /$regex/ em $arquivo)"
    exit 1
  fi
}

assert_nao_contem() {
  local arquivo=$1 regex=$2 msg=$3
  if [ -f "$arquivo" ] && grep -Eq -- "$regex" "$arquivo"; then
    echo "FALHOU: $msg (achei /$regex/ em $arquivo)"
    exit 1
  fi
}
