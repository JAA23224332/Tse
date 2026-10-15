"""Gera deploy/private/mapa.html e painel/mapa.html: mapa dos 5.570 municípios, com modo de bolhas,
locais de votação ao aproximar, divisas estaduais, busca, ranking lateral e comparação com 2022.

Malha: IBGE (dados/brutos/geo/municipios_br.geojson, qualidade mínima), coordenadas arredondadas.
Dados: estrategia_municipio.csv, presidente_2022_municipio.csv (margem de 2022) e locais_votacao_2026.csv
(escolas, gravadas por UF em deploy/private/locais/ e painel/locais/ e carregadas sob demanda).
"""

import json
import os
from collections import defaultdict

import pandas as pd

from identidade import CSS, FONTS

T = "dados/tratados"

with open("dados/brutos/geo/municipios_br.geojson", encoding="utf-8") as f:
    geo = json.load(f)

mun = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";", dtype={"cd_tse": str, "cd_ibge": str})
mun["cd_tse"] = mun.cd_tse.str.zfill(5)

# margem de 2022 (1º turno, Lula − Bolsonaro, em pontos dos válidos)
p22 = pd.read_csv(f"{T}/presidente_2022_municipio.csv", sep=";", dtype={"cd_tse": str})
p22 = p22[p22.turno == 1].copy()
p22["cd_tse"] = p22.cd_tse.str.zfill(5)
cands = [c for c in p22.columns if "(" in c]
val22 = p22[cands].sum(axis=1)
p22["m22"] = (100 * (p22["LULA (PT)"] - p22["JAIR BOLSONARO (PL)"]) / val22).round(1)
mun = mun.merge(p22[["cd_tse", "m22"]], on="cd_tse", how="left").rename(columns={"LULA (PT)": "lula", "FLAVIO BOLSONARO (PL)": "flavio"})
mun = mun.set_index("cd_ibge")

COLS = ["uf", "municipio", "eleitorado", "pct_lula", "pct_flavio", "margem_lula", "pct_abstencao", "pct_lula_22t1",
        "eliminados", "ganho_total", "ganho_mobilizar", "saldo_liquido", "ganho_persuadir", "territorio", "acao",
        "m22", "cd_tse", "capital", "lula", "flavio", "validos", "cen"]


def arred(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 2), round(coords[1], 2)]
    return [arred(c) for c in coords]


def centroide(anel):
    """Centroide (fórmula do cadarço) de um anel [[lon,lat],...]; cai na média se a área for ~0."""
    a = cx = cy = 0.0
    n = len(anel)
    for i in range(n):
        x0, y0 = anel[i]
        x1, y1 = anel[(i + 1) % n]
        cr = x0 * y1 - x1 * y0
        a += cr
        cx += (x0 + x1) * cr
        cy += (y0 + y1) * cr
    if abs(a) < 1e-9:
        return [round(sum(p[0] for p in anel) / n, 3), round(sum(p[1] for p in anel) / n, 3)]
    a *= 0.5
    return [round(cx / (6 * a), 3), round(cy / (6 * a), 3)]


def area(anel):
    return abs(sum(anel[i][0] * anel[(i + 1) % len(anel)][1] - anel[(i + 1) % len(anel)][0] * anel[i][1] for i in range(len(anel)))) / 2


feats, dados, sem = [], {}, 0
arestas = defaultdict(set)  # aresta (ponto, ponto) -> UFs que a usam; usada para as divisas estaduais
for f in geo["features"]:
    cd = f["properties"]["codarea"]
    if cd not in mun.index:
        sem += 1
        continue
    g = f["geometry"]
    coords = arred(g["coordinates"])
    poligonos = [coords] if g["type"] == "Polygon" else coords
    feats.append({"c": cd, "t": "P" if g["type"] == "Polygon" else "M", "g": coords})
    r = mun.loc[cd]
    maior = max((pg[0] for pg in poligonos), key=area)
    vals = [None if pd.isna(v) else (v.item() if hasattr(v, "item") else v) for v in (r[c] for c in COLS if c != "cen")]
    vals.append(centroide(maior))
    dados[cd] = vals
    for pg in poligonos:
        anel = pg[0]
        for i in range(len(anel)):
            p0, p1 = tuple(anel[i]), tuple(anel[(i + 1) % len(anel)])
            if p0 != p1:
                arestas[(p0, p1) if p0 < p1 else (p1, p0)].add(r.uf)
# divisas interestaduais: arestas compartilhadas por municípios de UFs diferentes
divisas = [[list(a), list(b)] for (a, b), ufs in arestas.items() if len(ufs) > 1]
print(f"{len(feats)} municípios no mapa, {sem} sem dados, {len(divisas)} segmentos de divisa estadual")

# locais de votação por UF, em arquivos separados (carregados quando o mapa se aproxima)
loc = pd.read_csv(f"{T}/locais_votacao_2026.csv", sep=";", dtype={"cd_tse": str})
loc = loc[loc.lat.notna() & loc.lon.notna()]
loc = loc[(loc.lat.between(-35, 6)) & (loc.lon.between(-75, -32))]  # descarta coordenadas fora do Brasil
LCOLS = ["lat", "lon", "aptos", "pct_lula", "pct_flavio", "pct_abstencao", "ganho_total", "local", "bairro", "cd_tse"]
for pasta in ["deploy/private/locais", "painel/locais"]:
    os.makedirs(pasta, exist_ok=True)
tot_kb = 0
for uf, g in loc.groupby("uf"):
    g = g.sort_values("aptos", ascending=False)
    linhas = [[round(r.lat, 4), round(r.lon, 4), int(r.aptos), r.pct_lula, r.pct_flavio, r.pct_abstencao, round(r.ganho_total),
               str(r.local).title()[:60], ("" if pd.isna(r.bairro) else str(r.bairro).title()[:40]), r.cd_tse] for r in g.itertuples()]
    s = json.dumps(linhas, ensure_ascii=False, separators=(",", ":"))
    tot_kb += len(s) // 1024
    for pasta in ["deploy/private/locais", "painel/locais"]:
        with open(f"{pasta}/{uf}.json", "w", encoding="utf-8") as f:
            f.write(s)
print(f"{len(loc)} locais de votação em 27 arquivos ({tot_kb} KB)")

HTML = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa · 2º Turno 2026</title>
__FONTS__
<style>
__BASE__
.wrap{max-width:1360px;padding:20px 16px 48px;gap:14px}
.topo{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 24px;align-items:end}@media(max-width:900px){.topo{grid-template-columns:1fr}}
.busca{position:relative;min-width:280px}.busca input{width:100%;padding-left:34px}.busca svg{position:absolute;left:10px;top:50%;translate:0 -50%;width:16px;height:16px;fill:none;stroke:var(--ink-3);stroke-width:2}
.ctrl{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center}
.seg{display:inline-flex;border:1px solid var(--line-2);border-radius:999px;padding:2px;gap:2px}.seg button{border:0;background:transparent;color:var(--ink-2);padding:5px 12px;border-radius:999px;cursor:pointer;font-size:13px}
.seg button[aria-pressed=true]{background:var(--ink);color:var(--bg)}
.lay{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}@media(max-width:900px){.lay{grid-template-columns:1fr}}
.mapbox{position:relative}
svg#mapa{width:100%;height:auto;display:block;background:var(--surface);border-radius:var(--rp);touch-action:none;outline-offset:-2px}
#areas path{stroke:#0c1412;stroke-width:calc(.12px*var(--k,1));cursor:pointer}#areas path:hover,#areas path.hi{stroke:#fff;stroke-width:calc(.7px*var(--k,1))}#areas path.sel{stroke:var(--ouro);stroke-width:calc(1px*var(--k,1))}
#areas.apagado path{fill-opacity:.35}#areas.apagado path.uf{fill-opacity:1}#areas.fundo path{fill-opacity:.28!important}
#divisas{fill:none;stroke:#0c1412;stroke-opacity:.9;stroke-width:calc(1px*var(--ks,1));pointer-events:none;stroke-linejoin:round}
#bolhas circle{stroke:#0c1412;stroke-width:calc(.4px*var(--k,1));cursor:pointer;fill-opacity:.9}#bolhas circle:hover,#bolhas circle.hi{stroke:#fff}#bolhas circle.sel{stroke:var(--ouro);stroke-width:calc(1px*var(--k,1))}
#escolas circle{stroke:#0c1412;stroke-width:calc(.6px*var(--k,1));cursor:pointer;fill-opacity:.95}#escolas circle:hover{stroke:#fff;stroke-width:calc(1.2px*var(--k,1))}#escolas circle.sel{stroke:var(--ouro);stroke-width:calc(1.6px*var(--k,1))}
#rotulos{pointer-events:none}#rotulos text{font:700 13px var(--fb);fill:#fff;paint-order:stroke;stroke:#0c1412;stroke-width:3px;stroke-opacity:.75;text-anchor:middle}#rotulos text.pc{font-weight:500;font-size:12px;fill-opacity:.92}#rotulos rect.q{stroke:#0c1412;stroke-width:.6}
#rotulos .caixa rect{rx:5}#rotulos .caixa text{text-anchor:start;stroke:none;font-size:12.5px}#rotulos .caixa line{stroke:#aab7b0;stroke-opacity:.6;stroke-width:.8}
.sobre{position:absolute;left:12px;bottom:12px;display:grid;gap:6px;pointer-events:none}
.sobre .aviso{pointer-events:auto;background:rgba(12,20,18,.85);backdrop-filter:blur(6px);border-radius:var(--r);padding:6px 10px;font-size:12.5px;color:var(--ink-2)}
.zoom{position:absolute;right:12px;top:12px;display:grid;gap:6px}.zoom button{font-size:16px;width:34px;height:34px;border:1px solid var(--line-2);background:rgba(12,20,18,.8);backdrop-filter:blur(6px);border-radius:var(--r);cursor:pointer;color:var(--ink)}
.zoom button.txt{width:auto;padding:0 10px;font-size:12.5px}
.legenda{display:grid;gap:6px;font-size:12px;color:var(--ink-2)}
.legenda .ramp{position:relative;height:10px;border-radius:3px}.legenda .ticks{display:flex;justify-content:space-between;font-variant-numeric:tabular-nums;color:var(--ink-3)}
.legenda svg{width:100%;height:34px;display:block}.legenda rect{fill:var(--ink-3);fill-opacity:.6}.legenda .cat{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.legenda .cat i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}.legenda .cat b{color:var(--ink)}.legenda .degr i{margin-right:2px}.legenda .degr .sep{display:inline-block;width:6px}
aside.lado{display:grid;gap:12px;position:sticky;top:60px}
.panel{padding:16px;display:grid;gap:10px}
.resumo{display:grid;gap:8px}.resumo h2{font-size:24px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}.resumo h2 small{font-family:var(--fb);font-size:13px;color:var(--ink-3)}
.resumo .duo{display:grid;grid-template-columns:1fr 1fr;gap:8px}.resumo .duo b{font-family:var(--fd);font-weight:500;font-size:30px;line-height:1;letter-spacing:-.02em;font-variant-numeric:lining-nums tabular-nums;font-variation-settings:"opsz" 144}
.resumo .duo span{display:block;font-size:12.5px;color:var(--ink-2);margin-top:3px}.resumo .duo .d{text-align:right}
.kv{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--ink-2)}.kv b{color:var(--ink);font-variant-numeric:tabular-nums;font-weight:600}
.det{display:grid;gap:4px;font-size:13.5px}.det h3{font-family:var(--fd);font-weight:500;font-size:22px;letter-spacing:-.01em}.det .row{display:flex;justify-content:space-between;gap:8px}.det b{font-weight:600;font-variant-numeric:lining-nums tabular-nums}
.det .tag{justify-self:start}.det .fechar{justify-self:end;font-size:12px;background:none;border:0;color:var(--ink-3);cursor:pointer;text-decoration:underline;padding:0}
.rank{display:grid;gap:2px}.rank h3{margin-bottom:4px}.rank button{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:8px;align-items:center;width:100%;text-align:left;border:0;background:transparent;color:var(--ink);padding:6px 8px;border-radius:var(--r);cursor:pointer;font-size:13px}
.rank button:hover,.rank button.hi{background:var(--surface-2)}.rank button[aria-pressed=true]{background:var(--surface-3)}
.rank .i{color:var(--ink-3);font-variant-numeric:tabular-nums;font-size:12px}.rank .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank .nm small{color:var(--ink-3)}
.rank .v{font-variant-numeric:tabular-nums;color:var(--ouro);font-weight:600}
.rank .barra{grid-column:2/4;height:3px;background:var(--surface-3);border-radius:2px;margin-top:-2px}.rank .barra i{display:block;height:100%;background:var(--ouro);border-radius:2px}
kbd{font:11px var(--fb);border:1px solid var(--line-2);border-radius:3px;padding:0 4px;color:var(--ink-2)}
</style>
</head>
<body>
<div class="wrap">
  <header class="topo">
    <div class="head">
      <h1>Mapa dos municípios</h1>
      <p class="muted">Áreas mostram a cor da medida; bolhas mostram onde estão os eleitores. Aproxime uma cidade para ver as escolas, cada uma colorida pelo resultado da urna. Passe o mouse para ver, clique para fixar.</p>
    </div>
    <label class="busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="busca" list="muns" placeholder="Buscar município" aria-label="Buscar município" autocomplete="off"><datalist id="muns"></datalist></label>
  </header>
  <div class="ctrl">
    <div class="chips" id="medidas" role="group" aria-label="Medida"></div>
    <div class="seg" role="group" aria-label="Modo"><button type="button" data-modo="area" aria-pressed="true">Áreas</button><button type="button" data-modo="bolha" aria-pressed="false">Bolhas por eleitorado</button></div>
    <div class="seg" id="anos" role="group" aria-label="Ano" hidden><button type="button" data-ano="2022" aria-pressed="false">2022</button><button type="button" data-ano="2026" aria-pressed="true">2026</button></div>
    <select id="ufsel" aria-label="Estado"><option value="">Brasil inteiro</option></select>
  </div>
  <div class="lay">
    <div style="display:grid;gap:10px">
      <div class="mapbox">
        <svg id="mapa" viewBox="0 0 1000 900" role="img" aria-label="Mapa dos municípios do Brasil" tabindex="0">
          <g id="areas"></g><path id="divisas"/><g id="bolhas"></g><g id="escolas"></g><g id="rotulos"></g>
        </svg>
        <div class="zoom"><button type="button" id="zin" aria-label="Aproximar">+</button><button type="button" id="zout" aria-label="Afastar">−</button><button type="button" id="zreset" class="txt">Brasil</button></div>
        <div class="sobre"><div class="aviso" id="aviso" hidden></div></div>
      </div>
      <div class="legenda" id="leg"></div>
      <p class="faint small">Arraste para mover; roda, pinça ou <kbd>+</kbd> <kbd>−</kbd> para aproximar; setas movem o mapa. Com a medida de margem, <kbd>A</kbd> alterna 2022 e 2026. O endereço da página guarda o recorte atual, para compartilhar.</p>
    </div>
    <aside class="lado">
      <div class="panel resumo" id="resumo"></div>
      <div class="panel det" id="det" hidden></div>
      <div class="panel rank" id="rank"></div>
    </aside>
  </div>
  <footer class="credito"><span>Desenvolvido por <b>Juliane Alves</b></span><a href="mailto:julianealvesdoc@gmail.com">julianealvesdoc@gmail.com</a></footer>
</div>
<div id="tip" hidden></div>
<script>
const F = __FEATS__, D = __DADOS__, C = __COLS__, DIV = __DIVISAS__;
const ci = Object.fromEntries(C.map((c,i)=>[c,i])), get = (cd,k) => D[cd]?.[ci[k]];
const fmt = n => Math.round(n).toLocaleString("pt-BR"), pc = n => n==null?"—":(+n).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
const pp = n => (n>0?"+":"")+(+n).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
const mi = n => (n/1e6).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" mi";
const tit = s => String(s).toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das)\b/g,w=>w.toLowerCase());
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const $ = id => document.getElementById(id);
const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;

// projeção equiretangular ajustada à latitude média do Brasil; cabe em 1000x1000
const LON0=-74, LON1=-27, LAT1=6, K=Math.cos(-14*Math.PI/180), W=1000, ASP=0.9, sx=W/(LON1-LON0);
const vbox=(x,y,w)=>({x,y,w,h:w*ASP});
const px = lon => (lon-LON0)*sx, py = lat => (LAT1-lat)*sx*K;
const ring = r => r.map((p,i)=>(i?"L":"M")+px(p[0]).toFixed(1)+","+py(p[1]).toFixed(1)).join("")+"Z";
const svg = $("mapa"), NS = "http://www.w3.org/2000/svg";
const paths = {}, bbox = {}, cen = {};
(function desenhar(){
  const frag = document.createDocumentFragment();
  for (const f of F){
    const pts = f.t==="P" ? f.g.flat() : f.g.flat(2); let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for (const p of pts){ const x=px(p[0]), y=py(p[1]); if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    bbox[f.c] = {x0,y0,x1,y1};
    const c = get(f.c,"cen"); cen[f.c] = [px(c[0]), py(c[1])];
    const d = f.t==="P" ? f.g.map(ring).join("") : f.g.map(pg=>pg.map(ring).join("")).join("");
    const p = document.createElementNS(NS,"path"); p.setAttribute("d",d); p.dataset.c=f.c; paths[f.c]=p; frag.appendChild(p);
  }
  $("areas").appendChild(frag);
  $("divisas").setAttribute("d", DIV.map(([a,b])=>`M${px(a[0]).toFixed(1)},${py(a[1]).toFixed(1)}L${px(b[0]).toFixed(1)},${py(b[1]).toFixed(1)}`).join(""));
})();
const CDS = Object.keys(D);
const UFS = [...new Set(CDS.map(cd=>get(cd,"uf")))].sort();
const porUF = {}; for (const cd of CDS) (porUF[get(cd,"uf")] ??= []).push(cd);
// caixa e rótulo de cada UF (centro ponderado pelo eleitorado)
const box = {}, rot = {};
for (const uf of UFS){ const b = box[uf] = {x0:1e9,y0:1e9,x1:-1e9,y1:-1e9}; let sx_=0, sy_=0, se=0;
  for (const cd of porUF[uf]){ const q=bbox[cd]; if(q.x0<b.x0)b.x0=q.x0; if(q.x1>b.x1)b.x1=q.x1; if(q.y0<b.y0)b.y0=q.y0; if(q.y1>b.y1)b.y1=q.y1; const e=get(cd,"eleitorado"); sx_+=cen[cd][0]*e; sy_+=cen[cd][1]*e; se+=e; }
  rot[uf] = [sx_/se, sy_/se]; }
const AGG = {}; for (const uf of UFS){ const a = AGG[uf] = {lula:0,flavio:0,validos:0,el:0}; for (const cd of porUF[uf]){ a.lula+=get(cd,"lula")||0; a.flavio+=get(cd,"flavio")||0; a.validos+=get(cd,"validos")||0; a.el+=get(cd,"eleitorado"); } a.pl=100*a.lula/a.validos; a.pf=100*a.flavio/a.validos; }
const CAIXAS = {RN:0,PB:1,PE:2,AL:3,SE:4,ES:6,RJ:7,DF:9};  // estados pequenos: rótulo em caixa à direita, com linha até o estado
function rotulos(){
  const k = Math.sqrt(vb.w/W), fs = 13*k, s = v => (v*k).toFixed(1);  // tamanho quase constante na tela
  if (vb.w < 300) { $("rotulos").innerHTML = ""; return; }  // de perto, os rótulos atrapalham
  let h = "";
  for (const uf of UFS){ const a = AGG[uf], lider = a.pl>=a.pf, cor = lider?LULA:FLAVIO, pct = Math.round(Math.max(a.pl,a.pf))+"%";
    const [x,y] = rot[uf];
    if (uf in CAIXAS){ const i = CAIXAS[uf], bx = 905, by = 300 + i*36, bw = 82, bh = 26;
      h += `<g class="caixa"><line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${bx}" y2="${by+bh/2}"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${cor}"/><text x="${bx+9}" y="${by+17.5}" font-weight="700">${uf}</text><text x="${bx+bw-9}" y="${by+17.5}" style="text-anchor:end">${pct}</text></g>`;
    } else {
      h += `<text x="${x.toFixed(1)}" y="${(y-2*k).toFixed(1)}" style="font-size:${s(13)}px">${uf}</text><rect class="q" x="${(x-20*k).toFixed(1)}" y="${(y+4*k).toFixed(1)}" width="${s(8)}" height="${s(8)}" fill="${cor}"/><text class="pc" x="${(x+5*k).toFixed(1)}" y="${(y+11.5*k).toFixed(1)}" style="font-size:${s(12)}px">${pct}</text>`;
    }
  }
  $("rotulos").innerHTML = h;
}

// ---------- cores e medidas
const hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)), mix=(a,b,t)=>{const A=hex(a),B=hex(b);t=Math.max(0,Math.min(1,t));return `rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")})`;};
const NEUTRO="#66716d", LULA="#dc342f", FLAVIO="#3a5fe6", OURO="#e9c46a", VERDE="#5fd39a", CLARO="#e9ecea", BASE="#23332e";
const DL=["#f0918d","#ea5f5b","#dc342f","#a8151b"], DF_=["#93a7f3","#6683ee","#3a5fe6","#1f3cbf"];
const degrau=(a,lim)=>a<=lim[0]?0:a<=lim[1]?1:a<=lim[2]?2:3;
const passo=(v,lim)=>v==null?"#1a2824":(v>=0?DL:DF_)[degrau(Math.abs(v),lim)];
const div = (v, esc=1) => v==null ? "#1a2824" : v>=0 ? mix(NEUTRO, LULA, v/esc) : mix(NEUTRO, FLAVIO, -v/esc);
const seqO = t => mix(BASE, OURO, t), seqC = t => mix(BASE, CLARO, t);
const GANHOS = CDS.map(cd=>get(cd,"ganho_total")||0).sort((a,b)=>a-b);
const perc = v => { let lo=0, hi=GANHOS.length; while(lo<hi){const m=(lo+hi)>>1; if(GANHOS[m]<v) lo=m+1; else hi=m;} return lo/GANHOS.length; };
const margem = cd => get(cd,"pct_lula")-get(cd,"pct_flavio");
const ramp = (...cs) => `linear-gradient(90deg,${cs.join(",")})`;
const MED = {
  margem: {rot:"Margem (p.p.)", anos:true, val: cd => ano===2022 ? get(cd,"m22") : margem(cd), cor: v => passo(v,[10,25,45]), degraus:{lim:[10,25,45], rot:["até 10","25","45","mais pontos"]}, dom:[-50,50],
    escola: l => passo(l[3]-l[4],[10,25,45]), txt: v => v==null?"sem dado":(v>=0?"Lula":"Flávio")+" "+pp(Math.abs(v))+" p.p."},
  votos: {rot:"Margem em votos", val: cd => get(cd,"margem_lula"), cor: v => passo(v,[2000,20000,200000]), degraus:{lim:[2000,20000,200000], rot:["até 2 mil","20 mil","200 mil","mais votos"]}, dom:[-300000,300000],
    escola: l => passo((l[3]-l[4])/100*l[2],[50,200,800]), txt: v => (v>=0?"Lula":"Flávio")+" +"+fmt(Math.abs(v))+" votos"},
  ganho: {rot:"Votos a ganhar (Lula)", val: cd => get(cd,"ganho_total")||0, cor: v => seqO(perc(v)), ramp: ramp(BASE,OURO), ticks:["menos","por percentil","mais"], dom:[0,1], perc:true,
    escola: l => seqO(Math.min(1, l[6]/(l[2]*0.05))), txt: v => fmt(v)+" votos a ganhar"},
  abst: {rot:"Abstenção", val: cd => get(cd,"pct_abstencao"), cor: v => seqC((v-10)/25), ramp: ramp(BASE,CLARO), ticks:["10%","22,5%","35%"], dom:[10,35],
    escola: l => seqC((l[5]-10)/25), txt: v => pc(v)+" de abstenção"},
  mudanca: {rot:"Mudança de Lula desde 2022 (p.p.)", val: cd => get(cd,"pct_lula_22t1")==null?null:get(cd,"pct_lula")-get(cd,"pct_lula_22t1"), cor: v => v==null?"#1a2824":v<0?mix(NEUTRO,"#ff6f69",-v/15):mix(NEUTRO,VERDE,v/15), ramp: ramp("#ff6f69",NEUTRO,VERDE), ticks:["caiu 15","igual","subiu 15"], dom:[-15,15],
    escola: l => passo(l[3]-l[4],[10,25,45]), txt: v => v==null?"sem 2022":(v<0?"caiu ":"subiu ")+pp(Math.abs(v)).replace("+","")+" p.p."},
  terr: {rot:"Território", val: cd => get(cd,"territorio"), cor: v => ({"Reduto de Lula":LULA,"Disputado":"#8a968f","Reduto de Flávio":FLAVIO})[v]||BASE, cat:[["Reduto de Lula",LULA],["Disputado","#8a968f"],["Reduto de Flávio",FLAVIO]],
    escola: l => passo(l[3]-l[4],[10,25,45]), txt: v => v},
};
let medida="margem", modo="area", ano=2026, ufAtual="", fixo=null, fixoEscola=null;

function pintar(){
  const M = MED[medida];
  for (const cd of CDS){ const v = M.val(cd); paths[cd].setAttribute("fill", M.cor(v)); }
  $("areas").classList.toggle("apagado", modo==="bolha");
  for (const cd of CDS) paths[cd].classList.toggle("uf", false);
  $("anos").hidden = !M.anos;
  legenda(); bolhas(); escolas();
}
function legenda(){
  const M = MED[medida];
  if (M.cat){ $("leg").innerHTML = `<div class="cat">${M.cat.map(([n,c])=>`<span><i style="background:${c}"></i>${n}</span>`).join("")}</div>`; return; }
  if (M.degraus){ const cds = ufAtual ? porUF[ufAtual] : CDS; let nl=0, nf=0; for (const cd of cds){ const v=M.val(cd); if(v==null) continue; if(v>=0) nl++; else nf++; }
    $("leg").innerHTML = `<div class="cat"><span><i style="background:${FLAVIO}"></i><b>PL</b> ${fmt(nf)}</span><span><i style="background:${LULA}"></i><b>PT</b> ${fmt(nl)} municípios${medida==="margem"?" em "+ano:""}</span>
      <span class="degr">${DF_.map(c=>`<i style="background:${c}"></i>`).join("")}<span class="sep"></span>${DL.map(c=>`<i style="background:${c}"></i>`).join("")} ${M.degraus.rot.join(" · ")}</span></div>`; return; }
  // histograma da distribuição entre os municípios do recorte
  const cds = ufAtual ? porUF[ufAtual] : CDS, vals = cds.map(M.val).filter(v=>v!=null);
  const [d0,d1] = M.dom, NB=40, bins = new Array(NB).fill(0);
  for (const v of vals){ let t = M.perc ? perc(v) : M.sqrt ? (Math.sign(v)*Math.sqrt(Math.abs(v))/Math.sqrt(d1)+1)/2 : (v-d0)/(d1-d0); bins[Math.max(0,Math.min(NB-1,Math.floor(t*NB)))]++; }
  const mx = Math.max(...bins,1);
  $("leg").innerHTML = `<svg viewBox="0 0 ${NB*10} 34" preserveAspectRatio="none" aria-hidden="true">${bins.map((b,i)=>`<rect x="${i*10+1}" y="${34-32*b/mx}" width="8" height="${32*b/mx}"/>`).join("")}</svg>
    <div class="ramp" style="background:${M.ramp}"></div><div class="ticks"><span>${M.ticks[0]}</span><span>${M.ticks[1]}</span><span>${M.ticks[2]}</span></div>
    <span class="faint">Barras: quantos municípios ${ufAtual?"de "+ufAtual:"do país"} caem em cada trecho da escala${medida==="margem"?` · ano ${ano}`:""}.</span>`;
}

// ---------- bolhas (raio em pixels quase constante, cresce um pouco com o zoom)
let vb = vbox(0,0,W);
const unidadePx = () => vb.w / svg.getBoundingClientRect().width;
function bolhas(){
  const g = $("bolhas"); if (modo!=="bolha"){ g.innerHTML=""; return; }
  const M = MED[medida], u = unidadePx(), k = Math.pow(W/vb.w, .35);
  const cds = CDS.filter(cd => { const [x,y]=cen[cd]; return x>vb.x-20&&x<vb.x+vb.w+20&&y>vb.y-20&&y<vb.y+vb.h+20; }).sort((a,b)=>get(b,"eleitorado")-get(a,"eleitorado"));
  g.innerHTML = cds.map(cd => { const r = (1.6 + 30*Math.sqrt(get(cd,"eleitorado")/9.2e6)*k)*u; const [x,y]=cen[cd]; return `<circle data-c="${cd}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${M.cor(M.val(cd))}" class="${fixo===cd?"sel":""}"/>`; }).join("");
}

// ---------- escolas (locais de votação), carregadas por UF quando o mapa se aproxima
const LOC = {}, pedindo = {};
const LIMIAR = 70;  // largura do viewBox (em unidades de 1000) abaixo da qual as escolas aparecem
const urlLocais = uf => /\.html?$/.test(location.pathname) ? `locais/${uf}.json` : `/api/locais/${uf}`;
async function carregar(uf){
  if (LOC[uf] || pedindo[uf]) return; pedindo[uf]=true;
  try { const r = await fetch(urlLocais(uf)); if(!r.ok) throw 0; LOC[uf] = await r.json(); escolas(); }
  catch { LOC[uf] = null; aviso(location.protocol==="file:" ? "As escolas só carregam na versão publicada do painel (este arquivo abriu direto do computador)." : `Não foi possível carregar as escolas de ${uf}.`); }
}
let avisoT; function aviso(t){ const a=$("aviso"); a.textContent=t; a.hidden=!t; clearTimeout(avisoT); if(t) avisoT=setTimeout(()=>a.hidden=true, 6000); }
function escolas(){
  const g = $("escolas");
  $("areas").classList.toggle("fundo", vb.w <= LIMIAR);
  if (vb.w > LIMIAR){ g.innerHTML=""; return; }
  const ufs = UFS.filter(uf => { const b=box[uf]; return b.x1>vb.x && b.x0<vb.x+vb.w && b.y1>vb.y && b.y0<vb.y+vb.h; });
  ufs.forEach(carregar);
  const M = MED[medida], u = unidadePx(), vis = [];
  for (const uf of ufs) for (const l of (LOC[uf]||[])){ const x=px(l[1]), y=py(l[0]); if (x>vb.x&&x<vb.x+vb.w&&y>vb.y&&y<vb.y+vb.h) vis.push([x,y,l]); if (vis.length>=6000) break; }
  g.innerHTML = vis.map(([x,y,l],i) => `<circle data-i="${i}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${((2+9*Math.sqrt(l[2]/6000))*u).toFixed(3)}" fill="${M.escola(l)}" class="${fixoEscola===l?"sel":""}"/>`).join("");
  g._vis = vis;
  if (vis.length) aviso(`${fmt(vis.length)} locais de votação à vista · tamanho = eleitores aptos`);
}

// ---------- painel lateral
function resumo(){
  const cds = ufAtual ? porUF[ufAtual] : CDS, s = k => cds.reduce((a,cd)=>a+(get(cd,k)||0),0);
  const el = s("eleitorado"), lu = s("lula"), fl = s("flavio"), va = s("validos") || 1;
  const marg = lu - fl, ganho = s("ganho_total"), elim = s("eliminados");
  const abst = cds.reduce((a,cd)=>a+get(cd,"pct_abstencao")/100*get(cd,"eleitorado"),0);
  const nome = ufAtual || "Brasil", lider = marg>=0?"Lula":"Flávio";
  $("resumo").innerHTML = `<h2>${nome} <small>${cds.length===1?"1 município":fmt(cds.length)+" municípios"}</small></h2>
    <div class="duo"><div><b class="lula">${pc(100*lu/va)}</b><span>Lula · ${fmt(lu)} votos</span></div><div class="d"><b class="flavio">${pc(100*fl/va)}</b><span>Flávio · ${fmt(fl)} votos</span></div></div>
    <div class="split" aria-hidden="true"><span style="flex:${lu};background:var(--lula)"></span><span style="flex:${fl};background:var(--flavio)"></span></div>
    <div class="kv"><span>${lider} à frente por <b>${Math.abs(marg)>=1e6?mi(Math.abs(marg)):fmt(Math.abs(marg))}</b></span><span>Votos a ganhar <b style="color:var(--ouro)">${ganho>=1e6?mi(ganho):fmt(ganho)}</b></span><span>Eleitores <b>${mi(el)}</b></span><span>Abstenção <b>${pc(100*abst/el)}</b></span><span>Eliminados <b>${elim>=1e6?mi(elim):fmt(elim)}</b></span></div>`;
}
let rankCds = [];
function ranking(){
  const cds = (ufAtual ? porUF[ufAtual] : CDS).slice().sort((a,b)=>(get(b,"ganho_total")||0)-(get(a,"ganho_total")||0)).slice(0,15);
  rankCds = cds; const mx = get(cds[0],"ganho_total")||1;
  $("rank").innerHTML = `<h3>Onde há mais votos a ganhar${ufAtual?" em "+ufAtual:""}</h3>` + cds.map((cd,i)=>`<button type="button" data-c="${cd}" aria-pressed="${fixo===cd}"><span class="i">${i+1}</span><span class="nm">${esc(tit(get(cd,"municipio")))} <small>${get(cd,"uf")}</small></span><span class="v">${fmt(get(cd,"ganho_total"))}</span><span class="barra"><i style="width:${100*get(cd,"ganho_total")/mx}%"></i></span></button>`).join("");
  $("rank").querySelectorAll("button").forEach(b => { const cd=b.dataset.c;
    b.onclick = () => { fixar(cd); voar(bbox[cd], 2.2); };
    b.onmouseenter = () => realcar(cd, true); b.onmouseleave = () => realcar(cd, false); b.onfocus = () => realcar(cd, true); b.onblur = () => realcar(cd, false); });
}
function realcar(cd, on){ paths[cd]?.classList.toggle("hi", on); $("bolhas").querySelector(`[data-c="${cd}"]`)?.classList.toggle("hi", on); $("rank").querySelector(`[data-c="${cd}"]`)?.classList.toggle("hi", on); }
function detalhe(cd){
  const g = k => get(cd,k); const marg = g("margem_lula"), lider = marg>=0?"Lula":"Flávio", m22 = g("m22");
  $("det").hidden = false;
  $("det").innerHTML = `<button type="button" class="fechar" id="fechar">fechar</button><h3>${tit(g("municipio"))} <span class="muted" style="font-size:14px;font-family:var(--fb)">${g("uf")}${g("capital")===true||g("capital")==="True"?" · capital":""}</span></h3><span class="tag ${g("territorio").includes("Lula")?"lula":g("territorio").includes("Flávio")?"flavio":""}">${g("territorio")}</span>
    <div class="row"><span>Eleitorado</span><b>${fmt(g("eleitorado"))}</b></div>
    <div class="row"><span>Lula</span><b class="lula">${pc(g("pct_lula"))}</b></div><div class="row"><span>Flávio Bolsonaro</span><b class="flavio">${pc(g("pct_flavio"))}</b></div>
    <div class="row"><span>Margem</span><b>${lider} +${fmt(Math.abs(marg))} (${pp(Math.abs(margem(cd)))} p.p.)</b></div>
    <div class="row"><span>Margem em 2022 (1º t.)</span><b>${m22==null?"—":(m22>=0?"Lula":"Bolsonaro")+" "+pp(Math.abs(m22))+" p.p."}</b></div>
    <div class="row"><span>Lula em 2022 (1º t.)</span><b>${pc(g("pct_lula_22t1"))}</b></div>
    <div class="row"><span>Abstenção</span><b>${pc(g("pct_abstencao"))}</b></div>
    <div class="row"><span>Votos de eliminados</span><b>${fmt(g("eliminados"))}</b></div>
    <div class="row" style="margin-top:6px"><span><b style="font-weight:600">Votos a ganhar</b></span><b style="color:var(--ouro)">${fmt(g("ganho_total"))}</b></div>
    <div class="row"><span>mobilizar</span><b>${fmt(g("ganho_mobilizar"))}</b></div><div class="row"><span>saldo líquido</span><b>${fmt(g("saldo_liquido"))}</b></div><div class="row"><span>persuadir</span><b>${fmt(g("ganho_persuadir"))}</b></div>
    <p class="small muted" style="margin-top:6px">${g("acao")}</p>`;
  $("fechar").onclick = () => fixar(null);
}
function detalheEscola(l){
  const [lat,lon,aptos,pl,pa,pab,ganho,nome,bairro,cd] = l, m = pl-pa;
  $("det").hidden = false;
  $("det").innerHTML = `<button type="button" class="fechar" id="fechar">fechar</button><span class="eyebrow">Local de votação</span><h3 style="font-size:19px">${esc(nome)}</h3><span class="small muted">${esc(bairro)}${bairro?" · ":""}${esc(tit(D[Object.keys(D).find(k=>get(k,"cd_tse")===cd)||""]?.[ci.municipio]||""))}</span>
    <div class="row"><span>Eleitores aptos</span><b>${fmt(aptos)}</b></div>
    <div class="row"><span>Lula</span><b class="lula">${pc(pl)}</b></div><div class="row"><span>Flávio Bolsonaro</span><b class="flavio">${pc(pa)}</b></div>
    <div class="row"><span>Margem</span><b>${m>=0?"Lula":"Flávio"} ${pp(Math.abs(m))} p.p.</b></div>
    <div class="row"><span>Abstenção</span><b>${pc(pab)}</b></div>
    <div class="row"><span>Votos a ganhar</span><b style="color:var(--ouro)">${fmt(ganho)}</b></div>`;
  $("fechar").onclick = () => { fixoEscola=null; $("det").hidden=true; escolas(); };
}
function fixar(cd){
  if (fixo) { paths[fixo].classList.remove("sel"); }
  fixo = cd; fixoEscola = null;
  if (fixo){ paths[fixo].classList.add("sel"); detalhe(fixo); } else $("det").hidden = true;
  $("rank").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.c===fixo));
  bolhas(); hash();
}

// ---------- interação com o mapa
const tip = $("tip");
function moverTip(e){ tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8)+"px"; tip.style.top=Math.max(8,e.clientY-tip.offsetHeight-12)+"px"; }
let hover = null;
svg.addEventListener("mousemove", e => {
  const t = e.target, M = MED[medida];
  if (t.dataset?.i != null && t.parentNode.id==="escolas"){ const l = $("escolas")._vis[+t.dataset.i][2]; tip.hidden=false; tip.innerHTML = `<b>${esc(l[7])}</b><br>${esc(l[8])}<br>${fmt(l[2])} aptos · Lula ${pc(l[3])} · Flávio ${pc(l[4])} · abst. ${pc(l[5])}`; moverTip(e); return; }
  const cd = t.dataset?.c; if (!cd||!D[cd]) { tip.hidden=true; if(hover){realcar(hover,false);hover=null;} return; }
  if (hover!==cd){ if(hover) realcar(hover,false); hover=cd; realcar(cd,true); }
  tip.hidden=false; tip.innerHTML = `<b>${tit(get(cd,"municipio"))}</b> ${get(cd,"uf")}<br>${M.txt(M.val(cd))}<br>Lula ${pc(get(cd,"pct_lula"))} · Flávio ${pc(get(cd,"pct_flavio"))} · ${fmt(get(cd,"eleitorado"))} eleitores`; moverTip(e);
});
svg.addEventListener("mouseleave", ()=>{ tip.hidden=true; if(hover){realcar(hover,false);hover=null;} });
let moveu = false;
svg.addEventListener("click", e => {
  if (moveu) return; const t = e.target;
  if (t.dataset?.i != null && t.parentNode.id==="escolas"){ fixoEscola = $("escolas")._vis[+t.dataset.i][2]; if(fixo){paths[fixo].classList.remove("sel"); fixo=null;} detalheEscola(fixoEscola); escolas(); return; }
  const cd = t.dataset?.c; if (!cd) return; fixar(fixo===cd?null:cd);
});

// zoom, arrasto e pinça (viewBox)
const aplicar = () => { svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); svg.style.setProperty("--k", (vb.w/W).toFixed(4)); svg.style.setProperty("--ks", Math.sqrt(vb.w/W).toFixed(4)); rotulos(); agendar(); };
let raf=0; function agendar(){ cancelAnimationFrame(raf); raf = requestAnimationFrame(()=>{ bolhas(); escolas(); hash(); }); }
function zoom(f, cx=vb.x+vb.w/2, cy=vb.y+vb.h/2){ const w=Math.max(4,Math.min(W*1.5,vb.w*f)); vb = vbox(cx-(cx-vb.x)*w/vb.w, cy-(cy-vb.y)*w/vb.h, w); aplicar(); }
function voar(b, folga=1.15){ const w=Math.max(Math.max(b.x1-b.x0,(b.y1-b.y0)/ASP)*folga, 4); vb=vbox((b.x0+b.x1)/2-w/2, (b.y0+b.y1)/2-w*ASP/2, w); aplicar(); }
$("zin").onclick=()=>zoom(0.6); $("zout").onclick=()=>zoom(1.6); $("zreset").onclick=()=>{ $("ufsel").value=""; escolherUF(""); };
svg.addEventListener("wheel", e => { e.preventDefault(); const r=svg.getBoundingClientRect(); zoom(e.deltaY>0?1.25:0.8, vb.x+(e.clientX-r.left)/r.width*vb.w, vb.y+(e.clientY-r.top)/r.height*vb.h); }, {passive:false});
const ponteiros = new Map(); let drag=null, pinca=null;
svg.addEventListener("pointerdown", e => { ponteiros.set(e.pointerId, e); svg.setPointerCapture(e.pointerId); moveu=false;
  if (ponteiros.size===1) drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y};
  else if (ponteiros.size===2){ const [a,b]=[...ponteiros.values()]; pinca={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY), w:vb.w}; drag=null; } });
svg.addEventListener("pointermove", e => { if(!ponteiros.has(e.pointerId)) return; ponteiros.set(e.pointerId, e); const r=svg.getBoundingClientRect();
  if (pinca && ponteiros.size===2){ const [a,b]=[...ponteiros.values()]; const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); const mx=(a.clientX+b.clientX)/2, my=(a.clientY+b.clientY)/2; const cx=vb.x+(mx-r.left)/r.width*vb.w, cy=vb.y+(my-r.top)/r.height*vb.h; const w=Math.max(4,Math.min(W*1.5,pinca.w*pinca.d/d)); vb=vbox(cx-(cx-vb.x)*w/vb.w, cy-(cy-vb.y)*w/vb.h, w); aplicar(); moveu=true; return; }
  if (!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if (Math.abs(dx)+Math.abs(dy)>3) moveu=true; vb.x=drag.vx-dx/r.width*vb.w; vb.y=drag.vy-dy/r.height*vb.h; aplicar(); });
const solta = e => { ponteiros.delete(e.pointerId); if (ponteiros.size<2) pinca=null; if (ponteiros.size===0) drag=null; else if (ponteiros.size===1){ const p=[...ponteiros.values()][0]; drag={x:p.clientX,y:p.clientY,vx:vb.x,vy:vb.y}; } };
svg.addEventListener("pointerup", solta); svg.addEventListener("pointercancel", solta);
svg.addEventListener("keydown", e => { const passo = vb.w*0.1; const k = e.key;
  if (k==="ArrowLeft"){vb.x-=passo;} else if (k==="ArrowRight"){vb.x+=passo;} else if (k==="ArrowUp"){vb.y-=passo;} else if (k==="ArrowDown"){vb.y+=passo;}
  else if (k==="+"||k==="="){zoom(0.7);return;} else if (k==="-"){zoom(1.4);return;} else if (k==="a"||k==="A"){ if(MED[medida].anos){ setAno(ano===2022?2026:2022);} return;} else if (k==="Escape"){fixar(null);return;} else return;
  e.preventDefault(); aplicar(); });

// ---------- controles
$("medidas").innerHTML = Object.entries(MED).map(([k,m])=>`<button class="chip" type="button" aria-pressed="${k===medida}" data-k="${k}">${m.rot}</button>`).join("");
$("medidas").querySelectorAll("button").forEach(b=>b.onclick=()=>{ medida=b.dataset.k; $("medidas").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); pintar(); hash(); });
document.querySelectorAll("[data-modo]").forEach(b=>b.onclick=()=>{ modo=b.dataset.modo; document.querySelectorAll("[data-modo]").forEach(x=>x.setAttribute("aria-pressed",x===b)); pintar(); hash(); });
function setAno(a){ ano=a; document.querySelectorAll("[data-ano]").forEach(x=>x.setAttribute("aria-pressed",+x.dataset.ano===ano)); pintar(); hash(); }
document.querySelectorAll("[data-ano]").forEach(b=>b.onclick=()=>setAno(+b.dataset.ano));
$("ufsel").innerHTML += UFS.map(u=>`<option>${u}</option>`).join("");
function escolherUF(uf){ ufAtual = uf; for (const cd of CDS) paths[cd].classList.toggle("uf", !!uf && get(cd,"uf")===uf);
  if (!uf) vb=vbox(0,0,W), aplicar(); else voar(box[uf]); resumo(); ranking(); legenda(); hash(); }
$("ufsel").onchange = () => escolherUF($("ufsel").value);
// busca
const NOMES = CDS.map(cd => ({cd, n: `${tit(get(cd,"municipio"))} (${get(cd,"uf")})`}));
$("muns").innerHTML = NOMES.map(o=>`<option value="${esc(o.n)}">`).join("");
$("busca").addEventListener("change", () => { const q = norm($("busca").value.trim()); if(!q) return;
  const o = NOMES.find(o=>norm(o.n)===q) || NOMES.find(o=>norm(o.n).startsWith(q)) || NOMES.find(o=>norm(o.n).includes(q));
  if (!o){ aviso("Município não encontrado."); return; }
  const uf = get(o.cd,"uf"); if (uf!==ufAtual){ $("ufsel").value=uf; ufAtual=uf; for (const cd of CDS) paths[cd].classList.toggle("uf", get(cd,"uf")===uf); resumo(); ranking(); legenda(); }
  fixar(o.cd); voar(bbox[o.cd], 2.5); });

// ---------- estado na URL
let lendo = true;
function hash(){ if (lendo) return; const p = new URLSearchParams({m:medida, modo, uf:ufAtual, v:[vb.x,vb.y,vb.w].map(n=>n.toFixed(1)).join(",")}); if (fixo) p.set("cd",fixo); if (medida==="margem") p.set("ano",ano); history.replaceState(null,"","#"+p.toString()); }
(function lerHash(){ const p = new URLSearchParams(location.hash.slice(1));
  if (p.get("m") && MED[p.get("m")]) { medida=p.get("m"); $("medidas").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.k===medida)); }
  if (p.get("modo")==="bolha"){ modo="bolha"; document.querySelectorAll("[data-modo]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.modo===modo)); }
  if (p.get("ano")==="2022"){ ano=2022; document.querySelectorAll("[data-ano]").forEach(x=>x.setAttribute("aria-pressed",+x.dataset.ano===ano)); }
  const uf = p.get("uf"); if (uf && box[uf]){ $("ufsel").value=uf; ufAtual=uf; for (const cd of CDS) paths[cd].classList.toggle("uf", get(cd,"uf")===uf); }
  const v = (p.get("v")||"").split(",").map(Number); if (v.length===3 && v.every(Number.isFinite) && v[2]>0){ vb=vbox(v[0],v[1],v[2]); } else if (ufAtual) { const b=box[ufAtual], w=Math.max(b.x1-b.x0,(b.y1-b.y0)/ASP)*1.15; vb=vbox((b.x0+b.x1)/2-w/2,(b.y0+b.y1)/2-w*ASP/2,w); }
  const cd = p.get("cd"); if (cd && D[cd]) { fixo=cd; paths[cd].classList.add("sel"); detalhe(cd); }
})();
pintar(); resumo(); ranking(); aplicar(); lendo = false; hash();
addEventListener("resize", agendar);
</script>
</body>
</html>
"""
dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html = (HTML.replace("__FEATS__", dump(feats)).replace("__DADOS__", dump(dados)).replace("__COLS__", dump(COLS)).replace("__DIVISAS__", dump(divisas))
        .replace("__BASE__", CSS).replace("__FONTS__", FONTS))
for destino in ["deploy/private/mapa.html", "painel/mapa.html"]:
    with open(destino, "w", encoding="utf-8") as f:
        f.write(html)
    print(destino, "gerado", f"({len(html)//1024} KB)")
