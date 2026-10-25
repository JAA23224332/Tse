#!/usr/bin/env bash
# Noite de 25/10/2026: espera a apuração do 2º turno e atualiza o resto do app (painel, estratégia, mapa, banco do Raio-X).
#   1ª rodada: quando o TSE passar de 99% das seções (resultado praticamente definido)
#   2ª rodada: quando o TSE marcar a totalização como final (ou 100%), e encerra
# Cada rodada: ./atualizar.sh --turno 2 --parcial --sem-download --publicar (coleta por município, balanço, banco, deploy).
# Rodar em segundo plano: setsid nohup ./pos_apuracao.sh >> logs/pos_apuracao.log 2>&1 &
set -uo pipefail
cd "$(dirname "$0")"
URL=https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json
LIMITE=$(date -d "2026-10-26 18:00" +%s)   # desiste no fim da tarde de 26/10
FEITO_99=0

estado() {  # imprime "<pct> <final>" ou nada se o TSE não respondeu
  curl -fsS --max-time 20 "$URL" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(float(d["s"]["pstn"].replace(",",".")), d.get("tf","n"))' 2>/dev/null
}

rodada() {
  echo "$(date '+%d/%m %H:%M') == atualizando o app ($1)"
  if ./atualizar.sh --turno 2 --parcial --sem-download --publicar; then
    echo "$(date '+%d/%m %H:%M') == rodada $1 concluída e publicada"
  else
    echo "$(date '+%d/%m %H:%M') == rodada $1 FALHOU (código $?); o site continua com a versão anterior"
    return 1
  fi
}

while [ "$(date +%s)" -lt "$LIMITE" ]; do
  read -r PCT FINAL <<< "$(estado)"
  if [ -n "${PCT:-}" ]; then
    echo "$(date '+%H:%M') TSE: ${PCT}% das seções, final=${FINAL}"
    if [ "$FINAL" = "s" ] || python3 -c "import sys; sys.exit(0 if float('$PCT') >= 100 else 1)"; then
      rodada "final" && exit 0
      sleep 900; continue   # falhou: tenta de novo em 15 min
    fi
    if [ "$FEITO_99" = 0 ] && python3 -c "import sys; sys.exit(0 if float('$PCT') >= 99 else 1)"; then
      rodada "99%" && FEITO_99=1
    fi
  else
    echo "$(date '+%H:%M') TSE sem resposta"
  fi
  sleep 600
done
echo "$(date '+%d/%m %H:%M') prazo encerrado sem totalização final"
