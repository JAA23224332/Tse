#!/usr/bin/env bash
# Verificação da noite do 2º turno (rodar a cada 5 min). Imprime um resumo e corrige o que dá:
#   - reinicia coletor/vigias se caíram
#   - avisa (saída "ALERTA") quando o site está defasado, o TSE falha, o snapshot não avança ou as páginas erram
# Saída: linhas "OK ..." / "ALERTA ..." / "AÇÃO ..."; código 1 se houve algum ALERTA.
cd "$(dirname "$0")"
S=https://segundoturno.blog
ALERTAS=0
ok() { echo "OK    $*"; }
al() { echo "ALERTA $*"; ALERTAS=1; }
acao() { echo "AÇÃO  $*"; }
AGORA=$(date +%s); ABERTURA=$(date -d "2026-10-25 17:00" +%s)
echo "== $(date '+%d/%m %H:%M:%S')"

# 1) processos
if pgrep -f "coletor_apuracao\.mj[s]" >/dev/null; then ok "coletor rodando"; else
  al "coletor parado"; if ! pgrep -f "coletor_vigi[a]" >/dev/null; then (setsid nohup deploy/scripts/coletor_vigia.sh >> logs/coletor_2026-10-25.log 2>&1 < /dev/null &) ; acao "vigia do coletor religado"; fi; fi
if pgrep -f "pos_apuracao\.s[h]" >/dev/null; then ok "vigia da madrugada rodando"; else (setsid nohup ./pos_apuracao.sh >> logs/pos_apuracao.log 2>&1 < /dev/null &); acao "vigia da madrugada religado"; fi

# 2) coletor: última linha recente e sem erro
ULT=$(tail -1 logs/coletor_2026-10-25.log 2>/dev/null)
HORA_LOG=$(echo "$ULT" | grep -oE "^[0-9]{2}:[0-9]{2}:[0-9]{2}")
if [ -n "$HORA_LOG" ]; then
  T_LOG=$(date -d "$HORA_LOG" +%s); DIF=$((AGORA - T_LOG))
  if [ $DIF -le 180 ]; then ok "coletor atualizou há ${DIF}s: ${ULT:0:110}"; else al "coletor sem atualizar há ${DIF}s: ${ULT:0:110}"; pkill -f "coletor_apuracao\.mj[s]"; acao "coletor morto para o vigia reiniciar"; fi
else al "log do coletor sem horário: ${ULT:0:110}"; fi
echo "$ULT" | grep -qi "erro" && al "coletor com erro na última linha"

# 3) saúde do site
SAUDE=$(curl -s -m 25 $S/api/saude)
echo "$SAUDE" | grep -q '"ok":true' && ok "saúde: ${SAUDE:0:160}" || al "saúde: ${SAUDE:0:160}"

# 4) apuração servida × TSE
TMP=$(mktemp -d); curl -s -m 30 $S/api/apuracao > $TMP/ap.json; curl -s -m 20 https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json > $TMP/tse.json
AP=$(head -c 2000 $TMP/ap.json)
python3 - "$AGORA" "$ABERTURA" "$TMP" <<'EOF' | tee "$TMP/py.out"
import json, sys, os
agora, abertura, tmp = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
def ler(nome):
    try: return json.load(open(os.path.join(tmp, nome)))
    except Exception: return {}
ap, tse = ler("ap.json"), ler("tse.json")
def n(x): return float(str(x or "0").replace(",", ".") or 0)
b = ap.get("brasil") or {}
modo, fonte, idade = ap.get("modo"), ap.get("fonte"), ap.get("idade", 0)
print(f"OK    site: modo={modo} fonte={fonte} idade={idade}s pst={b.get('pst')} lula={b.get('lula')} flavio={b.get('flavio')} falhas={ap.get('falhas')}")
if tse:
    st = n(tse["s"]["st"]); pst = n(tse["s"]["pstn"])
    lula = flavio = 0
    for a in tse["carg"][0].get("agr", []):
        for p in a["par"]:
            for c in p["cand"]:
                if c["n"] == "13": lula += n(c["vap"])
                if c["n"] == "22": flavio += n(c["vap"])
    print(f"OK    TSE: pst={pst} seções={int(st)} lula={int(lula)} flavio={int(flavio)} {tse.get('dg')} {tse.get('hg')}")
    if st > 0:
        if modo != "oficial": print("ALERTA TSE já tem seções apuradas mas o site não está em modo oficial")
        if fonte not in ("neon", "memoria") and agora > abertura + 600: print("ALERTA site lendo o TSE por conta própria (coletor não está gravando?)")
        if idade > 300: print(f"ALERTA dado do site com {idade}s de idade")
        tot = (b.get("lula") or 0) + (b.get("flavio") or 0)
        # só compara quando os dois leram a mesma totalização (mesmo % apurado) e já há volume (>5%)
        if tot and lula + flavio and pst > 5 and abs(n(b.get("pst")) - pst) < 0.01 and abs(((b["lula"] - b["flavio"]) / tot) - ((lula - flavio) / (lula + flavio))) > 0.01:
            print("ALERTA margem do site difere do TSE na mesma totalização")
    else:
        if agora > abertura + 1800: print("ALERTA TSE ainda sem nenhuma seção 30 min depois das 17h (conferir portal do TSE)")
    if ap.get("falhas"): print(f"ALERTA UFs sem resposta na última varredura: {ap.get('falhas')}")
else:
    print("ALERTA arquivo nacional do TSE não respondeu")
EOF
echo "$AP" | grep -q '"erro"' && al "api/apuracao devolveu erro"
grep -q "^ALERTA" "$TMP/py.out" 2>/dev/null && ALERTAS=1; rm -rf "$TMP"

# 5) snapshots avançando (depois que a apuração começar)
SNAP=$(echo "$SAUDE" | grep -oE '"snapshots":[0-9]+' | grep -oE '[0-9]+')
ULTSNAP=$(echo "$SAUDE" | grep -oE '"ultimo_snapshot":"[^"]*"' | cut -d'"' -f4)
if [ -n "$ULTSNAP" ] && [ "$ULTSNAP" != "null" ]; then
  T_SNAP=$(date -d "$ULTSNAP" +%s 2>/dev/null || echo 0); DIFS=$((AGORA - T_SNAP))
  if [ $DIFS -le 240 ]; then ok "último snapshot há ${DIFS}s (total $SNAP)"; else al "último snapshot há ${DIFS}s (total $SNAP): coletor não grava"; fi
else ok "ainda sem snapshots (apuração não começou)"; fi

# 6) páginas e rotas
for p in / /urna /analista /apuracao /painel /api/apuracao/governadores /api/apuracao/historico /api/apuracao/uf/sp /aovivo.js; do
  C=$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$S$p"); [ "$C" = 200 ] && ok "página $p" || al "página $p respondeu $C"
done

# 7) madrugada e disco
tail -1 logs/pos_apuracao.log 2>/dev/null | sed 's/^/OK    madrugada: /'
LIVRE=$(df -BG / | awk 'NR==2{gsub("G","",$4);print $4}'); [ "${LIVRE:-0}" -gt 5 ] && ok "disco ${LIVRE}G livres" || al "disco quase cheio (${LIVRE}G)"

[ $ALERTAS = 0 ] && echo "== tudo certo" || echo "== HÁ ALERTAS"
exit $ALERTAS
