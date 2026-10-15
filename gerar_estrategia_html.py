"""Gera deploy/private/estrategia.html e painel/estrategia.html: a página de estratégia da campanha.

Lê dados/tratados/estrategia_dados.json (de estrategia.py) e, se existir, locais_votacao_2026.csv
(de locais_votacao.py) para a lista de locais de votação prioritários por município.
"""

import json

import pandas as pd

from identidade import CSS, FONTS, TILES_JS

T = "dados/tratados"

with open(f"{T}/estrategia_dados.json", encoding="utf-8") as f:
    dados = json.load(f)

# locais de votação: só os 25 melhores de cada um dos 300 municípios de maior ganho, para a página ficar leve
locais = {}
try:
    loc = pd.read_csv(f"{T}/locais_votacao_2026.csv", sep=";", dtype={"cd_tse": str})
    est = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";", dtype={"cd_tse": str})
    top_mun = set(est[est.uf != "ZZ"].nlargest(300, "ganho_total").cd_tse)
    loc = loc[loc.cd_tse.isin(top_mun)].sort_values("ganho_total", ascending=False)
    for cd, g in loc.groupby("cd_tse"):
        locais[cd] = g.head(25)[["local", "bairro", "aptos", "pct_lula", "pct_abstencao", "ganho_mobilizar", "ganho_persuadir", "ganho_total", "territorio"]].fillna("").values.tolist()
    print(f"locais de votação: {len(loc)} em {len(locais)} municípios")
except FileNotFoundError:
    print("locais_votacao_2026.csv ainda não existe; página sai sem locais")
dados["locais"] = locais
dados["locais_colunas"] = ["local", "bairro", "aptos", "pct_lula", "pct_abstencao", "ganho_mobilizar", "ganho_persuadir", "ganho_total", "territorio"]

HTML = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Estratégia · 2º Turno 2026</title>
__FONTS__
<style>
__BASE__
.wrap{gap:40px}
.sim{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px;align-items:start}@media(max-width:860px){.sim{grid-template-columns:1fr}}
.srow{display:grid;gap:4px;padding:10px 0;border-bottom:1px solid var(--line)}.srow:last-child{border:0}.srow .lbl{display:flex;justify-content:space-between;gap:10px;font-size:14px}
.v{font-weight:600;color:var(--ink)}
.alav{display:grid;gap:8px}.alav .row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;font-size:14px}
.alav .bar{height:9px;background:var(--surface-3);border-radius:0 4px 4px 0;grid-column:1/3}.alav .bar i{display:block;height:100%;background:var(--lula);border-radius:0 4px 4px 0}
.alav .bar.c i{background:var(--flavio)}
.terr{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.terr .panel{display:grid;gap:6px}.terr .t{font-family:var(--fd);font-weight:500;font-size:22px;font-variant-numeric:lining-nums}
.hb{display:inline-flex;width:90px;height:8px;background:var(--surface-3);border-radius:0 4px 4px 0;vertical-align:middle;margin-right:6px}.hb i{display:block;height:100%;background:var(--ouro);border-radius:0 4px 4px 0}
.ufs2{display:grid;grid-template-columns:auto minmax(0,1fr);gap:28px;align-items:start}@media(max-width:860px){.ufs2{grid-template-columns:1fr}}
.uf{display:grid;grid-template-columns:36px 1fr 90px;gap:8px;align-items:center;font-size:13px;padding:4px 0}.uf .t{height:12px;display:flex;gap:2px}.uf .t i{display:block;height:100%}
.capa{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px 48px;align-items:start}@media(max-width:900px){.capa{grid-template-columns:1fr}}
.deficit{display:grid;gap:4px;justify-items:end;text-align:right}.deficit b{font-family:var(--fd);font-weight:500;font-size:clamp(40px,6vw,72px);line-height:1;letter-spacing:-.02em;color:var(--flavio-2);font-variant-numeric:lining-nums tabular-nums;font-variation-settings:"opsz" 144}
.deficit span{color:var(--ink-2);font-size:13px;max-width:26ch}

/* seletores com opções longas não podem alargar a página no celular */
select{max-width:100%;min-width:0}.filters{min-width:0}.filters select{flex:0 1 auto;min-width:0;max-width:100%}
</style>
</head>
<body>
<div class="wrap">
  <header class="capa">
    <div class="head">
      <span class="eyebrow">Campanha Lula, 2º turno em 25 de outubro de 2026</span>
      <h1>Onde buscar os votos</h1>
      <p class="muted">Esta página mostra, com dados oficiais por município e por local de votação, quanto cada caminho pode render e onde concentrar esforço. As premissas são ajustáveis: o que você vê é o resultado das suas hipóteses.</p>
    </div>
    <div class="deficit"><b class="num" id="deficit"></b><span>votos de vantagem de Flávio Bolsonaro no 1º turno. É o que falta virar.</span></div>
  </header>

  <section id="virada">
    <div class="head"><h2>Caminho da virada</h2><p class="muted">Duas alavancas (mobilizar e persuadir), contadas em votos líquidos: o que Lula ganha menos o que Flávio ganha com o mesmo movimento. Mexa nas hipóteses e veja o resultado em três cenários.</p></div>
    <div class="sim">
      <div class="panel" id="premissas"></div>
      <div style="display:grid;gap:14px">
        <div class="panel alav" id="alavancas"></div>
        <div class="stats" id="saldo"></div>
      </div>
    </div>
  </section>

  <section id="territorios">
    <div class="head"><h2>Três tipos de território</h2><p class="muted">A margem local define a tática. Em reduto, o que rende é tirar gente de casa; em território disputado, é convencer; em reduto adversário, é limitar a perda e buscar os votos de eliminados.</p></div>
    <div class="terr" id="terr"></div>
  </section>

  <section id="ufs">
    <div class="head"><h2>Por estado</h2><p class="muted">Ganho potencial com as premissas atuais. No mapa, quanto mais dourado, mais votos a ganhar. Nas barras, a composição: mobilizar (vermelho), persuadir (cinza).</p></div>
    <div class="ufs2"><div id="ufaz"></div><div class="panel" id="ufchart"></div></div>
  </section>

  <section id="municipios">
    <div class="head"><h2>Municípios prioritários</h2><p class="muted">Clique numa linha para ver os locais de votação (escolas) onde o esforço rende mais naquele município. Disponível para os 300 municípios de maior ganho.</p></div>
    <div class="filters">
      <input type="search" id="busca" placeholder="Buscar município" aria-label="Buscar município">
      <select id="ufsel" aria-label="Estado"><option value="">Todos os estados</option></select>
      <select id="terrsel" aria-label="Território"><option value="">Todos os territórios</option><option>Reduto de Lula</option><option>Disputado</option><option>Reduto de Flávio</option></select>
      <select id="ordsel" aria-label="Ordenar por"><option value="ganho_total">Maior ganho total</option><option value="ganho_mobilizar">Maior ganho por mobilização</option><option value="perda_vs_2022_votos">Maior perda desde 2022 (para recuperar)</option><option value="saldo_liquido">Maior saldo líquido</option><option value="ganho_persuadir">Maior ganho por persuasão</option><option value="ganho_por_mil_eleitores">Mais eficiente (ganho por mil eleitores)</option><option value="eleitorado">Maior eleitorado</option></select>
    </div>
    <div class="tbl" id="muntbl"></div>
    <div class="filters"><button class="btn" id="mais" type="button">Mostrar mais 50</button><span class="small muted" id="muncount"></span></div>
  </section>

  <section id="metodo">
    <div class="head"><h2>Como os números são calculados</h2></div>
    <ul class="small muted" style="margin:0;padding-left:18px;display:grid;gap:4px;max-width:80ch">
      <li><b>Mobilizar</b>: se a abstenção cair X pontos num município, os novos votantes seguem a proporção local. Rende onde Lula lidera e custa onde Flávio lidera, porque o adversário também mobiliza. A queda é uma hipótese por tipo de território.</li>
      <li><b>Persuadir</b>: para cada candidato eliminado, uma fração vai para Lula e outra para Flávio (o resto fica em casa); brancos e nulos idem. O que conta no placar é a diferença entre as duas.</li>
      <li><b>Potencial × saldo</b>: "votos a ganhar" é o que Lula pode conquistar num lugar (orienta onde ir); "saldo líquido" desconta o que Flávio ganha com o mesmo movimento (é o que muda o placar nacional).</li>
      <li><b>Cenários</b>: pessimista, base e otimista multiplicam as hipóteses (menos/mais transferência para Lula, menos/mais mobilização). Nenhum é previsão: são tetos para raciocinar.</li>
      <li><b>Perda vs 2022</b>: diferença entre o % de Lula no 1º turno de 2022 e no de 2026, no mesmo município. Não é somada ao ganho (esses eleitores já estão nos eliminados ou na abstenção); serve para apontar onde recuperar.</li>
      <li>Fonte: TSE, resultado oficial do 1º turno por seção, resultado de 2022 e perfil do eleitorado. Locais de votação: votos por seção agregados por local, com aptos do cadastro.</li>
    </ul>
  </section>
  <footer class="credito"><span>Desenvolvido por <b>Juliane Alves</b></span><a href="mailto:julianealvesdoc@gmail.com">julianealvesdoc@gmail.com</a></footer>
</div>
<script>
__TILES_JS__
const D = __DADOS__;
const fmt = n => Math.round(n).toLocaleString("pt-BR"), pc = (n,d=1) => n.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d})+"%";
const mi = n => (n/1e6).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" mi";
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tit = s => String(s).toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g,w=>w.toLowerCase());
const $ = id => document.getElementById(id);
const DEFICIT = D.virada.deficit; $("deficit").textContent = fmt(DEFICIT);
const C = D.colunas; const M = D.municipios.map(r => Object.fromEntries(C.map((c,i)=>[c,r[i]])));
const ECOLS = D.eliminados_cols, TERRS = ["Reduto de Lula","Disputado","Reduto de Flávio"];
const P = JSON.parse(JSON.stringify(D.premissas));
const ELIM = ECOLS.map(c => [c, D.eliminados_brasil[c]]).sort((a,b)=>b[1]-a[1]);
const nome = s => s.replace(/\s*\([^)]*\)$/,""), partido = s => (s.match(/\(([^)]*)\)$/)||[,""])[1];

// mesma fórmula do motor em Python (estrategia.py), por município, com as premissas atuais
function recalc(prem = P){
  for (const m of M){
    const margem = m.pct_lula - m.pct_flavio;
    const queda = prem.queda_abstencao[m.territorio] ?? 0;
    m.mob_liq = m.eleitorado*queda/100*margem/100;
    m.g_mob = Math.max(0, m.mob_liq);
    let el = 0, ef = 0; for (const c of ECOLS){ const v = m[c]||0, f = prem.eliminados[c]; el += v*f.lula; ef += v*f.flavio; }
    const bn = m.brancos + m.nulos;
    m.g_eli = el; m.g_bn = bn*prem.brancos_nulos.lula; m.f_eli = ef; m.f_bn = bn*prem.brancos_nulos.flavio;
    m.g_per = m.g_eli + m.g_bn; m.per_liq = m.g_per - m.f_eli - m.f_bn;
    m.g_tot = m.g_mob + m.g_per; m.saldo = m.mob_liq + m.per_liq; m.g_mil = 1000*m.g_tot/m.eleitorado;
  }
}
function cenario(prem, c){ // multiplicadores do cenário sobre as premissas (lula+flavio ≤ 1)
  const m = D.cenarios[c], par = x => { let l = Math.min(1, x.lula*m.lula), f = Math.min(1, x.flavio*m.flavio); if (l+f>1) f = 1-l; return {lula:l, flavio:f}; };
  return { eliminados: Object.fromEntries(ECOLS.map(k=>[k, par(prem.eliminados[k])])), brancos_nulos: par(prem.brancos_nulos),
    queda_abstencao: {"Reduto de Lula": prem.queda_abstencao["Reduto de Lula"]*m.mob_lula, "Disputado": prem.queda_abstencao["Disputado"]*(m.mob_lula+m.mob_flavio)/2, "Reduto de Flávio": prem.queda_abstencao["Reduto de Flávio"]*m.mob_flavio} };
}
function totais(prem){ recalc(prem); const t = {mob:0, el:0, ef:0, bl:0, bf:0, saldo:0}; for (const m of M){ t.mob+=m.mob_liq; t.el+=m.g_eli; t.ef+=m.f_eli; t.bl+=m.g_bn; t.bf+=m.f_bn; t.saldo+=m.saldo; } return t; }

function renderPremissas(){
  const slider = (id, rot, val, max, step, cls) => `<label class="sl ${cls}"><span>${rot} <b class="v" id="v_${id}">${val}</b></span><input type="range" id="${id}" min="0" max="${max}" step="${step}" value="${val}" aria-label="${rot}"></label>`;
  let h = `<h3>Hipóteses</h3><p class="small muted" style="margin:4px 0 8px">Para cada eliminado: quanto dos votos vai para Lula e quanto vai para Flávio (o resto fica em casa).</p>`;
  for (const [c,v] of ELIM){
    const f = P.eliminados[c];
    h += `<div class="srow" data-c="${esc(c)}"><div class="lbl"><b>${esc(tit(nome(c)))} <span class="tag">${esc(partido(c))}</span></b><span class="num muted">${fmt(v)} votos</span></div><div class="pair">${slider("l_"+ECOLS.indexOf(c), "→ Lula", Math.round(f.lula*100)+"%", 100, 5, "ra")}${slider("f_"+ECOLS.indexOf(c), "→ Flávio", Math.round(f.flavio*100)+"%", 100, 5, "rb")}</div></div>`;
  }
  h += `<div class="srow"><div class="lbl"><b>Brancos e nulos que passam a votar</b></div><div class="pair">${slider("bn_l", "→ Lula", Math.round(P.brancos_nulos.lula*100)+"%", 50, 5, "ra")}${slider("bn_f", "→ Flávio", Math.round(P.brancos_nulos.flavio*100)+"%", 50, 5, "rb")}</div></div>`;
  h += `<div class="srow"><div class="lbl"><b>Queda da abstenção (pontos do eleitorado)</b></div><div class="pair tri">${TERRS.map((t,i)=>slider("q_"+i, t, P.queda_abstencao[t].toLocaleString("pt-BR"), 8, 0.5, "")).join("")}</div></div>`;
  h += `<div class="filters" style="margin-top:8px"><button class="btn" type="button" id="reset">Voltar às hipóteses iniciais</button></div>`;
  $("premissas").innerHTML = h;
  $("premissas").querySelectorAll("input[type=range]").forEach(i => i.oninput = () => {
    const id = i.id, v = +i.value;
    if (id.startsWith("l_")||id.startsWith("f_")){ const c = ECOLS[+id.slice(2)], lado = id[0]==="l"?"lula":"flavio", outro = lado==="lula"?"flavio":"lula"; P.eliminados[c][lado] = v/100; if (P.eliminados[c].lula + P.eliminados[c].flavio > 1){ P.eliminados[c][outro] = 1 - v/100; const o = $((outro==="lula"?"l_":"f_")+id.slice(2)); o.value = Math.round(P.eliminados[c][outro]*100); $("v_"+o.id).textContent = o.value+"%"; } $("v_"+id).textContent = v+"%"; }
    else if (id==="bn_l"||id==="bn_f"){ P.brancos_nulos[id==="bn_l"?"lula":"flavio"] = v/100; $("v_"+id).textContent = v+"%"; }
    else if (id.startsWith("q_")){ P.queda_abstencao[TERRS[+id.slice(2)]] = v; $("v_"+id).textContent = v.toLocaleString("pt-BR"); }
    tudo();
  });
  $("reset").onclick = () => { Object.assign(P, JSON.parse(JSON.stringify(D.premissas))); renderPremissas(); tudo(); };
}

function renderAlavancas(){
  const cen = {}; for (const c of Object.keys(D.cenarios)) cen[c] = totais(cenario(P, c));
  const t = totais(P);  // deixa M com o cenário base (o das suas hipóteses)
  const max = Math.max(Math.abs(t.mob), t.el, t.ef, t.bl, t.bf, DEFICIT, 1);
  const row = (l, v, cls) => `<div class="row"><span>${l}</span><b class="num">${v<0?"−":""}${fmt(Math.abs(v))}</b></div><div class="bar ${cls}"><i style="width:${100*Math.abs(v)/max}%"></i></div>`;
  $("alavancas").innerHTML = `<h3>Com as suas hipóteses (cenário base)</h3>`
    + row("Mobilização: saldo líquido (Lula − Flávio)", t.mob, t.mob>=0?"":"c")
    + row("Eliminados → Lula", t.el, "") + row("Eliminados → Flávio", t.ef, "c")
    + row("Brancos e nulos → Lula", t.bl, "") + row("Brancos e nulos → Flávio", t.bf, "c")
    + `<div class="row" style="margin-top:6px"><span><b>Saldo líquido para Lula</b></span><b class="num">${t.saldo<0?"−":"+"}${fmt(Math.abs(t.saldo))}</b></div>`
    + row("Déficit do 1º turno (com exterior)", DEFICIT, "c");
  const res = c => cen[c].saldo - DEFICIT;
  $("saldo").innerHTML = ["pessimista","base","otimista"].map(c => { const r = res(c); return `<div class="stat ${r>=0?"pos":"neg"}"><b>${r>=0?"+":"−"}${fmt(Math.abs(r))}</b><span>cenário ${c}: ${r>=0?"Lula passa à frente":"ainda falta"}</span></div>`; }).join("");
  $("saldo").insertAdjacentHTML("beforeend", `<p class="small muted" style="grid-column:1/-1;margin:0">Resultado = saldo líquido − déficit. Pessimista e otimista multiplicam as suas hipóteses (transferência para Lula ×${D.cenarios.pessimista.lula}/×${D.cenarios.otimista.lula}; para Flávio ×${D.cenarios.pessimista.flavio}/×${D.cenarios.otimista.flavio}; mobilização idem). Nenhum é previsão.</p>`);
}

function renderTerr(){
  $("terr").innerHTML = D.territorios.map(t => {
    const cor = t.territorio.includes("Lula")?"lula":t.territorio.includes("Flávio")?"flavio":"";
    const tat = t.territorio==="Reduto de Lula" ? "Tática: mobilizar. Cada ponto a menos de abstenção é voto líquido." : t.territorio==="Disputado" ? "Tática: persuadir. Eliminados, brancos e nulos decidem." : "Tática: limitar perdas e buscar eliminados que não gostam do adversário.";
    const ms = M.filter(m=>m.territorio===t.territorio), ganho = ms.reduce((s,m)=>s+m.g_tot,0), saldo = ms.reduce((s,m)=>s+m.saldo,0);
    return `<div class="panel"><span class="tag ${cor}">${esc(t.territorio)}</span><span class="t">${fmt(t.n)} municípios</span><span class="small muted">${mi(t.eleitorado)} eleitores · Lula ${pc(100*t.lula/(t.lula+t.flavio))} dos dois · abstenção ${pc(100*t.abstencao/t.eleitorado)}</span><span class="small"><b class="num">${fmt(ganho)}</b> votos a ganhar · saldo líquido <b class="num">${saldo<0?"−":"+"}${fmt(Math.abs(saldo))}</b></span><span class="small muted">${tat}</span></div>`;
  }).join("");
}

function renderUF(){
  const g = {}; for (const m of M){ if (m.uf==="ZZ") continue; const u = g[m.uf] ??= {mob:0,per:0,saldo:0,el:0}; u.mob+=m.g_mob; u.per+=m.g_per; u.saldo+=m.saldo; u.el+=m.eleitorado; }
  const rows = Object.entries(g).map(([uf,u])=>({uf,...u,tot:u.mob+u.per})).sort((a,b)=>b.tot-a.tot); const max = rows[0].tot;
  $("ufchart").innerHTML = `<h3 style="margin-bottom:8px">Ganho potencial por estado</h3>` + rows.map(r => `<div class="uf"><b>${r.uf}</b><div class="t" title="mobilizar ${fmt(r.mob)} · persuadir ${fmt(r.per)} · saldo líquido ${fmt(r.saldo)}"><i style="flex:${r.mob};background:var(--lula)"></i><i style="flex:${r.per};background:var(--neutral)"></i><i style="flex:${max-r.tot};background:transparent"></i></div><span class="num" style="text-align:right">${fmt(r.tot)}</span></div>`).join("");
  const itens = {}; for (const r of rows) itens[r.uf] = { cor: corOuro(r.tot/max), texto: r.tot>=1e6 ? (r.tot/1e6).toLocaleString("pt-BR",{maximumFractionDigits:1})+" mi" : Math.round(r.tot/1e3)+" mil", titulo: `${r.uf}: ${fmt(r.tot)} votos a ganhar (mobilizar ${fmt(r.mob)}, persuadir ${fmt(r.per)}); saldo líquido ${fmt(r.saldo)}` };
  azulejos($("ufaz"), itens, { legenda: `<span>mais dourado, mais votos a ganhar</span>`, onClick: uf => { $("ufsel").value = uf; limite = 50; aberto = null; renderMun(); $("municipios").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); } });
}

let limite = 50, aberto = null;
function filtra(){
  const q = $("busca").value.trim().normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase(), uf=$("ufsel").value, te=$("terrsel").value, ord=$("ordsel").value;
  const k = {ganho_total:"g_tot",ganho_mobilizar:"g_mob",saldo_liquido:"saldo",ganho_persuadir:"g_per",ganho_por_mil_eleitores:"g_mil",eleitorado:"eleitorado",perda_vs_2022_votos:"perda_vs_2022_votos"}[ord];
  return M.filter(m => m.uf!=="ZZ").filter(m => (!uf||m.uf===uf) && (!te||m.territorio===te) && (!q||m.municipio.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().includes(q))).sort((a,b)=>b[k]-a[k]);
}
function renderMun(){
  const r = filtra(), vis = r.slice(0,limite), max = Math.max(...vis.map(m=>m.g_tot),1);
  $("muncount").textContent = `${fmt(Math.min(limite,r.length))} de ${fmt(r.length)} municípios`; $("mais").hidden = r.length<=limite;
  $("muntbl").innerHTML = `<table><thead><tr><th>Município</th><th>Território</th><th class="n">Eleitorado</th><th class="n">% Lula</th><th class="n">Abst.</th><th class="n">Lula 2022</th><th>Votos a ganhar</th><th class="n">Mobilizar</th><th class="n">Persuadir</th><th class="n">Saldo líquido</th><th class="n">Perda vs 2022</th><th class="n">p/ mil</th></tr></thead><tbody>${vis.map((m,i)=>{
    const cor = m.territorio.includes("Lula")?"lula":m.territorio.includes("Flávio")?"flavio":"";
    return `<tr data-i="${i}" tabindex="0" style="cursor:pointer" aria-expanded="${aberto===m}"><td><b>${esc(tit(m.municipio))}</b> <span class="small muted">${m.uf}</span>${D.locais[m.cd_tse]?' <span class="tag">locais</span>':''}</td><td><span class="tag ${cor}">${esc(m.territorio)}</span></td><td class="n">${fmt(m.eleitorado)}</td><td class="n">${pc(m.pct_lula)}</td><td class="n">${pc(m.pct_abstencao)}</td><td class="n">${m.pct_lula_22t1==null?"—":pc(m.pct_lula_22t1)}</td><td><span class="hb"><i style="width:${100*m.g_tot/max}%"></i></span><span class="num">${fmt(m.g_tot)}</span></td><td class="n">${fmt(m.g_mob)}</td><td class="n">${fmt(m.g_per)}</td><td class="n ${m.saldo<0?"flavio":"lula"}">${m.saldo<0?"−":"+"}${fmt(Math.abs(m.saldo))}</td><td class="n">${fmt(m.perda_vs_2022_votos||0)}${m.caiu_vs_2022?" ▼":""}</td><td class="n">${m.g_mil.toLocaleString("pt-BR",{maximumFractionDigits:1})}</td></tr>${aberto===m?locaisRow(m):""}`;
  }).join("")}</tbody></table>`;
  $("muntbl").querySelectorAll("tr[data-i]").forEach(tr => { const t=()=>{const m=vis[+tr.dataset.i]; aberto = aberto===m?null:m; renderMun();}; tr.onclick=t; tr.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();t();}}; });
}
function locaisRow(m){
  const L = D.locais[m.cd_tse];
  if (!L) return `<tr class="exp"><td colspan="12"><span class="small muted">Locais de votação disponíveis só para os 300 municípios de maior ganho.</span></td></tr>`;
  const ci = Object.fromEntries(D.locais_colunas.map((c,i)=>[c,i]));
  return `<tr class="exp"><td colspan="12"><div style="display:grid;gap:6px"><b>Locais de votação onde o esforço rende mais em ${esc(tit(m.municipio))}</b><div class="tbl"><table><thead><tr><th>Local</th><th>Bairro</th><th class="n">Aptos</th><th class="n">% Lula</th><th class="n">Abst.</th><th>Território</th><th class="n">Mobilizar</th><th class="n">Persuadir</th><th class="n">Ganho</th></tr></thead><tbody>${L.map(l=>`<tr><td>${esc(tit(l[ci.local]))}</td><td>${esc(tit(l[ci.bairro]||""))}</td><td class="n">${fmt(l[ci.aptos])}</td><td class="n">${pc(l[ci.pct_lula])}</td><td class="n">${pc(l[ci.pct_abstencao])}</td><td><span class="tag ${String(l[ci.territorio]).includes("Lula")?"lula":String(l[ci.territorio]).includes("Flávio")?"flavio":""}">${esc(l[ci.territorio])}</span></td><td class="n">${fmt(l[ci.ganho_mobilizar])}</td><td class="n">${fmt(l[ci.ganho_persuadir])}</td><td class="n"><b>${fmt(l[ci.ganho_total])}</b></td></tr>`).join("")}</tbody></table></div><span class="small muted">Ganhos calculados com as hipóteses iniciais (não mudam com os controles acima).</span></div></td></tr>`;
}

function tudo(){ recalc(); renderAlavancas(); renderTerr(); renderUF(); renderMun(); }
$("ufsel").innerHTML += [...new Set(M.map(m=>m.uf))].sort().map(u=>`<option>${u}</option>`).join("");
["busca","ufsel","terrsel","ordsel"].forEach(id=>$(id).addEventListener("input",()=>{limite=50;aberto=null;renderMun();}));
$("mais").onclick=()=>{limite+=50;renderMun();};
renderPremissas(); tudo();
</script>
</body>
</html>
"""

html = (HTML.replace("__DADOS__", json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
        .replace("__BASE__", CSS).replace("__FONTS__", FONTS).replace("__TILES_JS__", TILES_JS))
for destino in ["deploy/private/estrategia.html", "painel/estrategia.html"]:
    with open(destino, "w", encoding="utf-8") as f:
        f.write(html)
    print(destino, "gerado", f"({len(html)//1024} KB)")
