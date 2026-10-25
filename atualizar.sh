#!/usr/bin/env bash
# Refaz toda a base e as páginas do 2º turno 2026.
#   ./atualizar.sh                1º turno (padrão)
#   ./atualizar.sh --turno 2      após 25/10: coleta o 2º turno e gera o balanço 1º × 2º turno
#   ./atualizar.sh --publicar     publica no Vercel ao final (pode combinar com --turno 2)
#   ./atualizar.sh --parcial      aceita apuração incompleta do turno pedido
#   ./atualizar.sh --sem-download não consulta o TSE/IBGE por ZIPs novos (usa os arquivos locais)
# NÃO rodar durante a apuração de 25/10: baixa centenas de MB, faz milhares de pedidos ao TSE do mesmo IP do coletor
# e pode recarregar a tabela de seções no Neon. A página de apuração não depende deste script.
# Arquivos do TSE são baixados só se o servidor tiver versão mais nova (curl -z); downloads vão para .part
# e só viram o arquivo final quando terminam, então uma interrupção nunca deixa ZIP quebrado.
set -euo pipefail
cd "$(dirname "$0")"
TURNO=1; PUBLICAR=0; PARCIAL=""; DOWNLOAD=1
while [ $# -gt 0 ]; do
  case "$1" in
    --turno) TURNO="$2"; shift 2 ;;
    --publicar) PUBLICAR=1; shift ;;
    --parcial) PARCIAL="--parcial"; shift ;;
    --sem-download) DOWNLOAD=0; shift ;;
    *) echo "opção desconhecida: $1"; exit 1 ;;
  esac
done
export TURNO
B=https://cdn.tse.jus.br/estatistica/sead/odsele
mkdir -p dados/brutos/secao dados/brutos/geo dados/tratados deploy/private

baixar() {  # baixar <destino> <url>: só se o remoto for mais novo; nunca deixa arquivo parcial; falha vira aviso se já há arquivo local
  local dest="$1" url="$2" ok=1
  local opts=(-fsS --connect-timeout 20 --max-time 3600 --retry 3 --retry-delay 10 --retry-all-errors)
  if [ -f "$dest" ]; then
    curl "${opts[@]}" -z "$dest" -o "$dest.part" "$url" || ok=0
    if [ -s "$dest.part" ]; then mv "$dest.part" "$dest"; echo "  baixado: $dest"; else rm -f "$dest.part"; fi
    [ $ok = 1 ] || echo "  aviso: não foi possível conferir $url; usando o arquivo local"
  else
    curl "${opts[@]}" -o "$dest.part" "$url" && mv "$dest.part" "$dest" && echo "  baixado: $dest"
  fi
}

if [ "$DOWNLOAD" = 1 ]; then
  echo "== downloads do TSE e IBGE (só o que mudou)"
  baixar dados/brutos/perfil_eleitorado_2026.zip "$B/perfil_eleitorado/perfil_eleitorado_2026.zip"
  baixar dados/brutos/votacao_candidato_munzona_2022.zip "$B/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip"
  baixar dados/brutos/detalhe_votacao_munzona_2022.zip "$B/detalhe_votacao_munzona/detalhe_votacao_munzona_2022.zip"
  baixar dados/brutos/secao/votacao_secao_2026_BR.zip "$B/votacao_secao/votacao_secao_2026_BR.zip"
  baixar dados/brutos/eleitorado_local_votacao_2026.zip "$B/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip"
  [ -s dados/brutos/geo/municipios_br.geojson ] || curl -fsS --connect-timeout 20 --max-time 900 --retry 3 -o dados/brutos/geo/municipios_br.geojson.part \
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=municipio&qualidade=minima" \
    && mv dados/brutos/geo/municipios_br.geojson.part dados/brutos/geo/municipios_br.geojson
else
  echo "== sem download: usando os arquivos locais"
fi

# o 1º turno está totalizado e guardado em cache: só volta ao TSE se faltar o CSV ou a coleta não for a final
if [ -f dados/tratados/presidente_1t_2026_municipio.csv ] && python3 -c "import json,sys; sys.exit(0 if json.load(open('dados/tratados/coleta_1t_meta.json')).get('totalizacao_final') else 1)" 2>/dev/null; then
  echo "== resultados por município (1º turno): já coletados e finais"
else
  echo "== resultados por município (1º turno)"
  python3 coleta_resultados_2026.py --turno 1
fi
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

# seções e locais: o ZIP de seções só traz o 2º turno dias depois da eleição; os scripts saem com código 3 nesse caso
rodar_turno() {
  local rc=0
  python3 "$1" || rc=$?
  if [ $rc = 3 ] && [ "$TURNO" = 2 ]; then echo "  aviso: $1 pulado (o TSE ainda não publicou o 2º turno nesse ZIP; os arquivos do 1º turno continuam valendo)"; return 0; fi
  return $rc
}
echo "== seções e locais de votação (turno $TURNO)"
rodar_turno locais_votacao.py
rodar_turno secoes_2026.py
rodar_turno gerar_urna.py   # dados estáticos da página Sua urna (sai com 3 se o CSV do turno não existe)

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
  echo "== testes antes de publicar"
  python3 -m pytest testes -q
  echo "== publicando: commit dos dados gerados e push (o Vercel constrói a partir do GitHub, se o projeto estiver ligado)"
  git add -A deploy/public/urna/data deploy/app/analista/resumo.json deploy/app/sign-in/resumo.json dados/tratados/.secoes_carregadas 2>/dev/null || true
  git commit -qm "Dados atualizados em $(date '+%d/%m/%Y %H:%M') (turno $TURNO)" || echo "  nada novo para commitar"
  git push -q origin master || echo "  aviso: push falhou"
  # CLI como segunda via: o plano gratuito limita a 5 mil arquivos enviados por dia; o pacote único reduz isso
  (cd deploy && vercel deploy --prod --yes --archive=tgz) || echo "  aviso: deploy pela CLI falhou (cota do plano gratuito?); se o projeto está ligado ao GitHub, o push acima já publica"
fi
echo "concluído"
