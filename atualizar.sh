#!/usr/bin/env bash
# Refaz toda a base e as páginas do 2º turno 2026.
#   ./atualizar.sh              1º turno (padrão)
#   ./atualizar.sh --turno 2    após 25/10: coleta o 2º turno e gera o balanço 1º × 2º turno
#   ./atualizar.sh --publicar   publica no Vercel ao final (pode combinar com --turno 2)
#   ./atualizar.sh --parcial    aceita apuração incompleta do turno pedido
# Arquivos do TSE são baixados só se o servidor tiver versão mais nova (curl -z); downloads vão para .part
# e só viram o arquivo final quando terminam, então uma interrupção nunca deixa ZIP quebrado.
set -euo pipefail
cd "$(dirname "$0")"
TURNO=1; PUBLICAR=0; PARCIAL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --turno) TURNO="$2"; shift 2 ;;
    --publicar) PUBLICAR=1; shift ;;
    --parcial) PARCIAL="--parcial"; shift ;;
    *) echo "opção desconhecida: $1"; exit 1 ;;
  esac
done
export TURNO
B=https://cdn.tse.jus.br/estatistica/sead/odsele
mkdir -p dados/brutos/secao dados/brutos/geo dados/tratados deploy/private

baixar() {  # baixar <destino> <url>: só se o remoto for mais novo; nunca deixa arquivo parcial
  local dest="$1" url="$2"
  if [ -f "$dest" ]; then
    curl -fsS -z "$dest" -o "$dest.part" "$url" && { [ -s "$dest.part" ] && mv "$dest.part" "$dest" || rm -f "$dest.part"; }
  else
    curl -fsS -o "$dest.part" "$url" && mv "$dest.part" "$dest"
  fi
}

echo "== downloads do TSE e IBGE"
baixar dados/brutos/perfil_eleitorado_2026.zip "$B/perfil_eleitorado/perfil_eleitorado_2026.zip"
baixar dados/brutos/votacao_candidato_munzona_2022.zip "$B/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip"
baixar dados/brutos/detalhe_votacao_munzona_2022.zip "$B/detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip"
baixar dados/brutos/secao/votacao_secao_2026_BR.zip "$B/votacao_secao/votacao_secao_2026_BR.zip"
baixar dados/brutos/eleitorado_local_votacao_2026.zip "$B/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip"
[ -s dados/brutos/geo/municipios_br.geojson ] || curl -fsS -o dados/brutos/geo/municipios_br.geojson.part \
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=municipio&qualidade=minima" \
  && mv dados/brutos/geo/municipios_br.geojson.part dados/brutos/geo/municipios_br.geojson

echo "== resultados por município (1º turno)"
python3 coleta_resultados_2026.py --turno 1
if [ "$TURNO" = 2 ]; then
  echo "== resultados por município (2º turno)"
  python3 coleta_resultados_2026.py --turno 2 $PARCIAL
fi

echo "== perfil do eleitorado, histórico 2022, análise e painel"
python3 perfil_eleitorado_2026.py
python3 historico_2022.py
python3 analise_2turno.py
python3 gerar_painel.py
python3 gerar_base_apuracao.py
python3 estrategia.py

echo "== seções e locais de votação (turno $TURNO)"
python3 locais_votacao.py
python3 secoes_2026.py

if [ "$TURNO" = 2 ] && [ -f dados/tratados/presidente_2t_2026_municipio.csv ]; then
  echo "== balanço 1º × 2º turno"
  python3 analise_pos_2t.py
fi

echo "== páginas e banco"
python3 gerar_estrategia_html.py
python3 gerar_mapa_html.py
python3 gerar_regioes_html.py
python3 carregar_neon.py

if [ "$PUBLICAR" = 1 ]; then
  echo "== publicando no Vercel"
  (cd deploy && vercel deploy --prod --yes)
fi
echo "concluído"
