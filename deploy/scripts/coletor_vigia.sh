#!/usr/bin/env bash
# Mantém o coletor da apuração rodando; se cair, volta em 10 s. Para parar: pkill -f coletor_vigia.sh; pkill -f coletor_apuracao.mjs
cd "$(dirname "$0")/.."
while true; do
  node --env-file=.env.local --experimental-strip-types scripts/coletor_apuracao.mjs
  echo "$(date '+%H:%M:%S') coletor saiu (código $?); reiniciando em 10 s"
  sleep 10
done
