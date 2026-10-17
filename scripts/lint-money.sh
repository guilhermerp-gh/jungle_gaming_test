#!/usr/bin/env bash
# Falha se `number`/parseFloat for usado em campos monetários (amount/balance/money).
set -e
if grep -rnE "(amount|balance|money)[A-Za-z_]*\s*[:=]\s*number|parseFloat|Number\((amount|balance)" src; then
  echo "ERRO: uso de number para dinheiro detectado"; exit 1
fi
echo "lint:money OK"
