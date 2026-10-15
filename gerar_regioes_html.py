"""Gera deploy/private/regioes.html e painel/regioes.html: votação das capitais por bairro.

O TSE trata cada capital como um único município; o que diferencia as regiões é o local de
votação, cujo cadastro traz o bairro. Esta página agrega dados/tratados/locais_votacao_2026.csv
(de locais_votacao.py) por bairro em cada capital. Em Brasília, os bairros do cadastro são
convertidos em regiões administrativas (Ceilândia, Samambaia, Taguatinga, Gama, ...).
"""

import json
import unicodedata

import pandas as pd

from identidade import CSS, FONTS

T = "dados/tratados"
CAMPOS_LOCAL = ["local", "endereco", "zona", "aptos", "pct_lula", "pct_flavio", "pct_abstencao", "ganho_total"]


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").upper().strip()


# Brasília: bairro do cadastro do TSE -> região administrativa (aproximação; Sol Nascente e Pôr do Sol
# ficam dentro de Ceilândia, e Arniqueira dentro de Águas Claras, porque o cadastro não os separa).
RA_DF = {
    "AGUAS CLARAS - TAGUATINGA SUL": "Águas Claras", "AREAL (AGUAS CLARAS)": "Águas Claras",
    "NORTE (AGUAS CLARAS)": "Águas Claras", "SUL (AGUAS CLARAS)": "Águas Claras",
    "ARAPOANGA": "Planaltina", "PLANALTINA": "Planaltina", "ESTANCIA MESTRE D'ARMAS": "Planaltina",
    "JARDIM RORIZ": "Planaltina", "VALE DO AMANHECER": "Planaltina",
    "SETOR RESIDENCIAL LESTE": "Planaltina", "SETOR RESIDENCIAL NORTE": "Planaltina",
    "SETOR CENTRAL": "Gama", "SETOR LESTE": "Gama", "SETOR OESTE": "Gama", "CIDADE NOVA": "Gama",
    "ENGENHO DAS LAJES": "Gama", "PONTE ALTA NORTE": "Gama",
    "SETOR SUL": "Gama", "SETOR NORTE": "Gama",  # os de Brazlândia são separados pela longitude, abaixo
    "SETOR TRADICIONAL": "Brazlândia", "SETOR VEREDAS": "Brazlândia", "VILA SAO JOSE": "Brazlândia",
    "BRAZLANDIA": "Brazlândia", "N.R.ALEX. GUSMAO": "Brazlândia",
    "ASA NORTE": "Asa Norte", "ASA SUL": "Asa Sul",
    "SETOR DE INDUSTRIAS GRAFICAS": "Plano Piloto (demais setores)", "SETOR MILITAR URBANO": "Plano Piloto (demais setores)",
    "SETOR MILITAR COMPLEMENTAR": "Plano Piloto (demais setores)", "GRANJA DO TORTO": "Plano Piloto (demais setores)",
    "AREA OCTOGONAL SUL": "Sudoeste/Octogonal", "SETOR SUDOESTE": "Sudoeste/Octogonal",
    "CANDANGOLANDIA": "Candangolândia", "CEILANDIA NORTE": "Ceilândia", "CEILANDIA SUL": "Ceilândia",
    "CIDADE ESTRUTURAL": "SCIA/Estrutural", "ZONA INDUSTRIAL": "SIA",
    "COLONIA AGRICOLA VICENTE PIRES": "Vicente Pires", "CRUZEIRO NOVO": "Cruzeiro", "CRUZEIRO VELHO": "Cruzeiro",
    "GUARA I": "Guará", "GUARA II": "Guará", "ITAPOA": "Itapoã",
    "JARDINS MANGUEIRAL": "Jardim Botânico", "SETOR HABITACIONAL JARDIM BOTANICO": "Jardim Botânico",
    "LAGO NORTE": "Lago Norte", "TAQUARI": "Lago Norte", "LAGO SUL": "Lago Sul",
    "NUCLEO BANDEIRANTE": "Núcleo Bandeirante", "NUCLEO RURAL CORREGO DO ARROZAL": "Sobradinho",
    "SOBRADINHO": "Sobradinho", "SOBRADINHO II": "Sobradinho II", "PARANOA": "Paranoá",
    "RECANTO DAS EMAS": "Recanto das Emas", "RESIDENCIAL SANTOS DUMONT": "Santa Maria", "SANTA MARIA": "Santa Maria",
    "RIACHO FUNDO": "Riacho Fundo", "RIACHO FUNDO II": "Riacho Fundo II",
    "SAMAMBAIA": "Samambaia", "SAMAMBAIA NORTE": "Samambaia", "SAMAMBAIA SUL": "Samambaia",
    "SAO BARTOLOMEU - SAO SEBASTIAO": "São Sebastião", "SAO SEBASTIAO": "São Sebastião",
    "SETOR DE MANSOES PARK WAY": "Park Way", "TAGUATINGA CENTRO": "Taguatinga", "TAGUATINGA NORTE": "Taguatinga",
    "TAGUATINGA SUL": "Taguatinga", "VARJAO": "Varjão", "ZONA RURAL": "Zona rural (diversas RAs)",
}


def regiao_df(linha):
    b = sem_acento(linha.bairro)
    if b in ("SETOR SUL", "SETOR NORTE") and pd.notna(linha.lon) and linha.lon < -48.15:
        return "Brazlândia"
    return RA_DF.get(b, linha.bairro.title())


def titulo(s):
    s = " ".join(w.capitalize() for w in str(s).lower().split())
    for p in ("De", "Da", "Do", "Dos", "Das", "E"):
        s = s.replace(f" {p} ", f" {p.lower()} ")
    return s


loc = pd.read_csv(f"{T}/locais_votacao_2026.csv", sep=";", dtype={"cd_tse": str})
mun = pd.read_csv(f"{T}/estrategia_municipio.csv", sep=";", dtype={"cd_tse": str})
capitais = mun[mun.capital.astype(str).str.lower().isin(["true", "1", "sim"])][["uf", "cd_tse", "municipio"]]
loc = loc[loc.cd_tse.isin(capitais.cd_tse)].copy()
loc["bairro"] = loc.bairro.fillna("Sem bairro no cadastro")

# nome da região: RA em Brasília; nos demais, o bairro do cadastro (variantes de acento unificadas)
loc["regiao"] = loc.apply(lambda r: regiao_df(r) if r.uf == "DF" else titulo(r.bairro), axis=1)
loc["chave"] = loc.regiao.map(sem_acento)
nome_regiao = loc.groupby(["cd_tse", "chave"]).regiao.agg(lambda s: s.value_counts().index[0])

cidades = []
for _, c in capitais.sort_values("municipio").iterrows():
    d = loc[loc.cd_tse == c.cd_tse]
    if d.empty:
        continue
    regioes = []
    for chave, g in d.groupby("chave"):
        validos, aptos = int(g.validos.sum()), int(g.aptos.sum())
        lula, flavio = int(g.lula.sum()), int(g.flavio.sum())
        pl, pf = 100 * lula / validos if validos else 0, 100 * flavio / validos if validos else 0
        locais = g.sort_values("aptos", ascending=False)[CAMPOS_LOCAL].fillna("")
        locais["local"] = locais.local.map(titulo)
        regioes.append({
            "regiao": nome_regiao[(c.cd_tse, chave)], "locais": len(g), "aptos": aptos, "lula": lula, "flavio": flavio,
            "brancos_nulos": int(g.brancos.sum() + g.nulos.sum()), "eliminados": int(g.eliminados.sum()),
            "abstencao": int(g.abstencao.sum()), "pct_lula": round(pl, 1), "pct_flavio": round(pf, 1),
            "pct_abstencao": round(100 * g.abstencao.sum() / aptos, 1) if aptos else 0,
            "ganho_mobilizar": round(float(g.ganho_mobilizar.sum())), "ganho_persuadir": round(float(g.ganho_persuadir.sum())),
            "ganho_total": round(float(g.ganho_total.sum())),
            "territorio": "Reduto de Flávio" if pl - pf < -15 else "Reduto de Lula" if pl - pf > 15 else "Disputado",
            "lista": locais.values.tolist(),
        })
    regioes.sort(key=lambda r: -r["aptos"])
    cidades.append({"uf": c.uf, "cd_tse": c.cd_tse, "municipio": titulo(c.municipio),
                    "unidade": "região administrativa" if c.uf == "DF" else "bairro", "regioes": regioes})
    print(f"{c.uf} {titulo(c.municipio)}: {len(d)} locais em {len(regioes)} regiões")

dados = {"campos_local": CAMPOS_LOCAL, "cidades": cidades}

HTML = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bairros · 2º Turno 2026</title>
__FONTS__
<style>
__BASE__
.wrap{gap:36px}
select#cidade{font-family:var(--fd);font-size:20px;font-weight:500;padding:8px 12px;font-variant-numeric:lining-nums}
.mg{display:inline-grid;grid-template-columns:60px 60px;height:9px;vertical-align:middle;margin-right:6px}.mg i{display:block;height:100%}
.mg .f{justify-self:end;background:var(--flavio);border-radius:4px 0 0 4px;box-shadow:1px 0 0 var(--ink-3)}.mg .l{background:var(--lula);border-radius:0 4px 4px 0}
.capa{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px 40px;align-items:end}@media(max-width:800px){.capa{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
  <header class="head">
    <span class="eyebrow">Campanha Lula, 2º turno em 25 de outubro de 2026</span>
    <h1 id="titulo">Brasília por região administrativa</h1>
    <p class="muted">O TSE trata cada capital como um único município. Aqui a votação do 1º turno para presidente é agregada por <span id="unidade">região administrativa</span>, a partir do bairro de cada local de votação. Clique numa linha para ver as escolas daquela região.</p>
  </header>

  <section>
    <div class="filters">
      <label for="cidade" class="small muted">Capital</label>
      <select id="cidade" aria-label="Capital"></select>
    </div>
    <div class="stats" id="stats"></div>
  </section>

  <section>
    <div class="filters">
      <input type="search" id="busca" placeholder="Buscar região ou bairro" aria-label="Buscar região ou bairro">
      <select id="terrsel" aria-label="Território"><option value="">Todos os territórios</option><option>Reduto de Lula</option><option>Disputado</option><option>Reduto de Flávio</option></select>
      <select id="ordsel" aria-label="Ordenar por"><option value="aptos">Maior eleitorado</option><option value="pct_lula">Maior % Lula</option><option value="pct_flavio">Maior % Flávio</option><option value="margem">Maior vantagem de Lula (votos)</option><option value="pct_abstencao">Maior abstenção</option><option value="ganho_total">Maior ganho potencial</option></select>
    </div>
    <div class="tbl" id="tbl"></div>
    <span class="small muted" id="count"></span>
  </section>

  <section>
    <div class="head"><h2>Como ler</h2></div>
    <ul class="small muted" style="margin:0;padding-left:18px;display:grid;gap:4px;max-width:80ch">
      <li>A região de cada escola é o bairro informado no cadastro de locais de votação do TSE, não o endereço do eleitor. Quem vota numa escola fora do bairro onde mora conta na região da escola.</li>
      <li>Em Brasília, os bairros do cadastro foram convertidos em regiões administrativas. É uma aproximação: o cadastro não separa Sol Nascente/Pôr do Sol de Ceilândia nem Arniqueira de Águas Claras; os setores do Gama e de Brazlândia foram distinguidos pela localização.</li>
      <li>Nas demais capitais, o nome do bairro vem como está no cadastro; um mesmo bairro pode aparecer com grafias distintas.</li>
      <li>% Lula e % Flávio são sobre os votos válidos. Abstenção é sobre os aptos. Território: Reduto quando a diferença entre os dois passa de 15 pontos.</li>
      <li>Ganho potencial: soma das estimativas por local da página Estratégia (mobilizar nos redutos de Lula + persuadir eliminados, brancos e nulos), com as premissas iniciais.</li>
      <li>Fonte: TSE, votação por seção do 1º turno de 2026 (presidente) e cadastro de eleitorado por local de votação.</li>
    </ul>
  </section>
  <footer class="credito"><span>Desenvolvido por <b>Juliane Alves</b></span><a href="mailto:julianealvesdoc@gmail.com">julianealvesdoc@gmail.com</a></footer>
</div>
<script>
const D = __DADOS__;
const fmt = n => Math.round(n).toLocaleString("pt-BR"), pc = (n,d=1) => (+n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d})+"%";
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const $ = id => document.getElementById(id);
const ci = Object.fromEntries(D.campos_local.map((c,i)=>[c,i]));
const corT = t => t.includes("Lula")?"lula":t.includes("Flávio")?"flavio":"";
let cidade = D.cidades.find(c=>c.uf==="DF") || D.cidades[0], aberto = null;

$("cidade").innerHTML = D.cidades.map(c=>`<option value="${c.cd_tse}" ${c===cidade?"selected":""}>${esc(c.municipio)} (${c.uf})</option>`).join("");
$("cidade").onchange = () => { cidade = D.cidades.find(c=>c.cd_tse===$("cidade").value); aberto=null; $("busca").value=""; render(); };
["busca","terrsel","ordsel"].forEach(id=>$(id).addEventListener("input",()=>{aberto=null;renderTbl();}));

function render(){
  const R = cidade.regioes, s = k => R.reduce((a,r)=>a+r[k],0);
  const validos = s("lula")+s("flavio")+s("eliminados"), aptos = s("aptos");
  $("titulo").textContent = `${cidade.municipio} por ${cidade.unidade}`;
  $("unidade").textContent = cidade.unidade;
  $("stats").innerHTML = `<div class="stat"><b>${fmt(aptos)}</b><span>eleitores aptos</span></div>
    <div class="stat lula"><b>${pc(100*s("lula")/validos)}</b><span>Lula · ${fmt(s("lula"))} votos</span></div>
    <div class="stat flavio"><b>${pc(100*s("flavio")/validos)}</b><span>Flávio · ${fmt(s("flavio"))} votos</span></div>
    <div class="stat"><b>${pc(100*s("abstencao")/aptos)}</b><span>abstenção · ${fmt(s("abstencao"))} eleitores</span></div>
    <div class="stat"><b>${fmt(R.length)}</b><span>${cidade.unidade=="bairro"?"bairros":"regiões"} · ${fmt(s("locais"))} locais de votação</span></div>`;
  renderTbl();
}
function renderTbl(){
  const q = norm($("busca").value.trim()), te = $("terrsel").value, ord = $("ordsel").value;
  for (const r of cidade.regioes) r.margem = r.lula - r.flavio;
  const R = cidade.regioes.filter(r => (!te||r.territorio===te) && (!q||norm(r.regiao).includes(q)||r.lista.some(l=>norm(l[ci.local]).includes(q)))).sort((a,b)=>b[ord]-a[ord]);
  const maxMg = Math.max(...cidade.regioes.map(r=>Math.abs(r.pct_lula-r.pct_flavio)),1);
  $("count").textContent = `${fmt(R.length)} de ${fmt(cidade.regioes.length)} ${cidade.unidade=="bairro"?"bairros":"regiões"}`;
  $("tbl").innerHTML = `<table><thead><tr><th>${cidade.unidade=="bairro"?"Bairro":"Região"}</th><th>Território</th><th class="n">Aptos</th><th class="n">% Lula</th><th class="n">% Flávio</th><th>Margem (pontos)</th><th class="n">Dif. votos</th><th class="n">Abst.</th><th class="n">Ganho pot.</th><th class="n">Locais</th></tr></thead><tbody>${R.map((r,i)=>{
    const mg = r.pct_lula - r.pct_flavio, w = 100*Math.abs(mg)/maxMg;
    return `<tr data-i="${i}" tabindex="0" style="cursor:pointer" aria-expanded="${aberto===r}"><td><b>${esc(r.regiao)}</b></td><td><span class="tag ${corT(r.territorio)}">${esc(r.territorio)}</span></td><td class="n">${fmt(r.aptos)}</td><td class="n">${pc(r.pct_lula)}</td><td class="n">${pc(r.pct_flavio)}</td><td><span class="mg axis"><i class="f" style="width:${mg<0?w:0}%"></i><i class="l" style="width:${mg>0?w:0}%"></i></span><span class="num">${mg>0?"+":""}${mg.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}</span></td><td class="n">${r.margem>0?"+":""}${fmt(r.margem)}</td><td class="n">${pc(r.pct_abstencao)}</td><td class="n">${fmt(r.ganho_total)}</td><td class="n">${r.locais}</td></tr>${aberto===r?locaisRow(r):""}`;
  }).join("")}</tbody></table>`;
  $("tbl").querySelectorAll("tr[data-i]").forEach(tr => { const t=()=>{const r=R[+tr.dataset.i]; aberto = aberto===r?null:r; renderTbl();}; tr.onclick=t; tr.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();t();}}; });
}
function locaisRow(r){
  return `<tr class="exp"><td colspan="10"><div style="display:grid;gap:6px"><b>Locais de votação em ${esc(r.regiao)}</b><div class="tbl"><table><thead><tr><th>Local</th><th>Endereço</th><th class="n">Zona</th><th class="n">Aptos</th><th class="n">% Lula</th><th class="n">% Flávio</th><th class="n">Abst.</th><th class="n">Ganho pot.</th></tr></thead><tbody>${r.lista.map(l=>`<tr><td>${esc(l[ci.local])}</td><td class="small muted">${esc(l[ci.endereco])}</td><td class="n">${l[ci.zona]}</td><td class="n">${fmt(l[ci.aptos])}</td><td class="n">${pc(l[ci.pct_lula])}</td><td class="n">${pc(l[ci.pct_flavio])}</td><td class="n">${pc(l[ci.pct_abstencao])}</td><td class="n">${fmt(l[ci.ganho_total])}</td></tr>`).join("")}</tbody></table></div></div></td></tr>`;
}
render();
</script>
</body>
</html>
"""

html = (HTML.replace("__DADOS__", json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
        .replace("__BASE__", CSS).replace("__FONTS__", FONTS))
for destino in ["deploy/private/regioes.html", "painel/regioes.html"]:
    with open(destino, "w", encoding="utf-8") as f:
        f.write(html)
    print(destino, "gerado", f"({len(html)//1024} KB)")
