#!/usr/bin/env bash
# Refaz toda a base e o painel do 2º turno 2026.
# Os ZIPs grandes em dados/brutos/ só são baixados se ainda não existirem.
set -euo pipefail
cd "$(dirname "$0")"
B=https://cdn.tse.jus.br/estatistica/sead/odsele
mkdir -p dados/brutos/secao dados/tratados
for f in perfil_eleitorado/perfil_eleitorado_2026.zip \
         votacao_candidato_munzona/votacao_candidato_munzona_2022.zip \
         detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip; do
  [ -f "dados/brutos/$(basename $f)" ] || curl -fsS -C - -o "dados/brutos/$(basename $f)" "$B/$f"
done
python3 coleta_resultados_2026.py
python3 perfil_eleitorado_2026.py
python3 historico_2022.py
python3 analise_2turno.py > /dev/null
python3 gerar_painel.py
python3 estrategia.py > /dev/null
# votos por seção (arquivo _BR, ~140 MB) e cadastro de locais de votação
[ -f dados/brutos/secao/votacao_secao_2026_BR.zip ] || curl -fsS -C - -o dados/brutos/secao/votacao_secao_2026_BR.zip "$B/votacao_secao/votacao_secao_2026_BR.zip"
[ -f dados/brutos/eleitorado_local_votacao_2026.zip ] || curl -fsS -C - -o dados/brutos/eleitorado_local_votacao_2026.zip "$B/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip"
python3 locais_votacao.py
python3 secoes_2026.py
python3 gerar_estrategia_html.py
python3 gerar_mapa_html.py
python3 gerar_regioes_html.py
python3 carregar_neon.py

# Publica no Vercel (com login) se pedir: ./atualizar.sh --publicar
if [ "${1:-}" = "--publicar" ]; then
  (cd deploy && vercel deploy --prod --yes)
fi
