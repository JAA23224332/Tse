"""Identidade visual compartilhada pelas páginas geradas (painel, estratégia, mapa, bairros) e pelo app Next.

Importado pelos geradores; `escrever_globals()` grava a mesma base em deploy/app/globals.css para as
páginas React (apuração, analista, login, acessos).

Conceito: sala de apuração à noite. Fundo verde-noite profundo (neutro entre o vermelho de Lula e o
azul de Flávio), Fraunces para títulos e números grandes, Schibsted Grotesk para texto e tabelas,
teclas da urna como marca dos candidatos e o Brasil em azulejos como assinatura do painel.
"""

FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1'
    '&family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap">'
)

CSS = r"""
:root{
  --bg:#0c1412;--surface:#121d1a;--surface-2:#1a2824;--surface-3:#23332e;--line:#243530;--line-2:#34483f;
  --ink:#eef2ee;--ink-2:#aab7b0;--ink-3:#8a9a92;
  --lula:#e4322e;--lula-2:#ff6f69;--lula-dim:#4a1a18;--flavio:#2f5be8;--flavio-2:#86a2f7;--flavio-dim:#182a66;
  --neutral:#7d8b85;--ouro:#e9c46a;--verde:#5fd39a;--erro:#ff8a80;--focus:#e9c46a;
  --a:var(--flavio);--b:var(--lula);--bar-muted:#34483f;
  --fd:"Fraunces",Georgia,"Times New Roman",serif;--fb:"Schibsted Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-display:var(--fd);--font-body:var(--fb);--font-mono:var(--fb);--fm:var(--fb);
  --r:4px;--rp:10px;color-scheme:dark;
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--fb);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
h1,h2,h3,h4{margin:0;text-wrap:balance}
h1,h2{font-family:var(--fd);font-weight:400;letter-spacing:-.015em;font-variant-numeric:lining-nums;font-variation-settings:"SOFT" 40,"WONK" 0}
h1{font-size:clamp(34px,5.5vw,58px);line-height:1;font-weight:300}
h2{font-size:27px;line-height:1.15}
h3{font-size:17px;font-weight:600;letter-spacing:-.005em}
h4{font-size:13px;font-weight:600;color:var(--ink-2)}
p{margin:0;max-width:68ch}
a{color:var(--ink)}
.muted{color:var(--ink-2)}.faint{color:var(--ink-3)}.small{font-size:13px}
.num,.n,.mono,td.n{font-variant-numeric:lining-nums tabular-nums}
.big{font-family:var(--fd);font-weight:500;letter-spacing:-.02em;font-variant-numeric:lining-nums tabular-nums;font-variation-settings:"opsz" 144,"SOFT" 20}
.eyebrow{font-size:13px;color:var(--ink-3)}
.lula{color:var(--lula-2)}.flavio{color:var(--flavio-2)}
::selection{background:var(--ouro);color:#1a1200}

section{display:grid;gap:16px;min-width:0}
.head{display:grid;gap:10px}
.wrap{max-width:1200px;margin:0 auto;padding:28px 20px 72px;display:grid;gap:44px}
.panel{background:var(--surface);border-radius:var(--rp);padding:20px;min-width:0}
.panel.outline{background:transparent;border:1px solid var(--line-2)}

/* teclas da urna: fundo preto, dígito claro */
.tecla{display:inline-grid;place-items:center;min-width:1.6em;height:1.6em;padding:0 .3em;border-radius:.22em;background:#050807;color:#fff;
  font-family:var(--fd);font-weight:600;font-variant-numeric:lining-nums;font-variation-settings:"opsz" 144;line-height:1;box-shadow:inset 0 -2px 0 #2a2f2d,0 0 0 1px #2a2f2d}
.tecla.lula{color:var(--lula-2)}.tecla.flavio{color:var(--flavio-2)}

/* indicadores */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px 20px}
.stat{display:grid;gap:3px;padding-left:12px;border-left:2px solid var(--line-2)}
.stat b{font-family:var(--fd);font-weight:500;font-size:28px;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:lining-nums tabular-nums;font-variation-settings:"opsz" 144,"SOFT" 20}
.stat span{font-size:13px;color:var(--ink-2)}
.stat.lula{border-color:var(--lula)}.stat.flavio{border-color:var(--flavio)}.stat.ouro{border-color:var(--ouro)}
.stat.pos b{color:var(--verde)}.stat.neg b{color:var(--erro)}
.split{height:8px;display:flex;gap:2px;border-radius:4px;overflow:hidden}.split span,.split i{display:block;height:100%}

/* controles */
button,select,input{font:inherit;color:var(--ink)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line-2);background:transparent;padding:6px 12px;border-radius:999px;cursor:pointer;font-size:13px;color:var(--ink-2)}
.chip:hover{border-color:var(--ink-3);color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.btn{border:1px solid var(--line-2);background:var(--surface-2);padding:7px 13px;border-radius:var(--r);cursor:pointer;font-size:13px;color:var(--ink)}
.btn:hover{background:var(--surface-3)}
.btn.primary{background:var(--ouro);color:#1a1200;border-color:var(--ouro);font-weight:600}.btn.primary:hover{filter:brightness(1.08)}
.btn:disabled{opacity:.5;cursor:default}
select,input[type=search],input[type=text],input[type=email]{border:1px solid var(--line-2);background:var(--surface-2);border-radius:var(--r);padding:8px 10px;font-size:14px;color:var(--ink)}
select option{background:var(--surface-2)}
input::placeholder{color:var(--ink-3)}
input[type=range]{width:100%;accent-color:var(--ouro);background:transparent}
input.ra{accent-color:var(--flavio)}input.rb{accent-color:var(--lula)}
button:focus-visible,select:focus-visible,input:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.filters input[type=search]{flex:1 1 220px;min-width:0}

/* tabelas */
.tbl{overflow-x:auto;background:var(--surface);border-radius:var(--rp)}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-size:12px;font-weight:600;color:var(--ink-3);background:var(--surface);position:sticky;top:0;z-index:1}
th.sortable,th.s{cursor:pointer}th.sortable:hover,th.s:hover{color:var(--ink)}th[aria-sort]{color:var(--ouro)}
td.n,th.n{text-align:right}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:var(--surface-2)}
tr.exp td{background:var(--surface-2);white-space:normal}
tr.exp .tbl{background:var(--surface)}
.tag{font-size:11.5px;font-weight:500;padding:2px 7px;border-radius:999px;border:1px solid var(--line-2);color:var(--ink-2);white-space:nowrap}
.tag.lula{border-color:transparent;background:var(--lula-dim);color:var(--lula-2)}.tag.flavio{border-color:transparent;background:var(--flavio-dim);color:var(--flavio-2)}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px;vertical-align:0}
#tip{position:fixed;pointer-events:none;z-index:40;background:var(--ink);color:var(--bg);font-size:12.5px;padding:7px 10px;border-radius:var(--r);max-width:280px;line-height:1.4}

/* Brasil em azulejos */
.azulejos{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;max-width:330px}
.azulejos .az{aspect-ratio:1;border-radius:5px;display:grid;align-content:space-between;padding:5px 6px;font-size:11px;line-height:1;cursor:pointer;
  background:var(--surface-2);color:var(--ink);border:0;text-align:left;position:relative}
.azulejos .az b{font-weight:700;letter-spacing:.02em}
.azulejos .az span{font-variant-numeric:lining-nums tabular-nums;font-size:10.5px;font-weight:500;opacity:.95;white-space:nowrap}
.azulejos .az:hover{outline:1.5px solid var(--ink);outline-offset:1px}
.azulejos .az[aria-pressed="true"]{outline:2px solid var(--ouro);outline-offset:1px}
.azulejos .az.gov::after{content:"";position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:var(--ouro)}
.azulejos .leg{grid-column:1/-1;font-size:12px;color:var(--ink-3);display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding-top:4px}
.azulejos .leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}

.credito{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:space-between;padding-top:16px;border-top:1px solid var(--line);font-size:13px;color:var(--ink-3)}
.credito a{color:var(--ink-2)}
code{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;background:var(--surface-2);padding:1px 5px;border-radius:3px}
[hidden]{display:none!important}
@media (max-width:480px){.wrap{padding-inline:16px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
"""

# Posição (coluna, linha) de cada UF no cartograma em azulejos; 6 colunas x 8 linhas.
TILES_JS = r"""
const TILES={RR:[1,0],AP:[2,0],AM:[1,1],PA:[2,1],MA:[3,1],CE:[4,1],RN:[5,1],AC:[0,2],RO:[1,2],TO:[2,2],PI:[3,2],PE:[4,2],PB:[5,2],
  MT:[1,3],GO:[2,3],BA:[3,3],SE:[4,3],AL:[5,3],MS:[1,4],DF:[2,4],MG:[3,4],ES:[4,4],PR:[1,5],SP:[2,5],RJ:[3,5],SC:[1,6],RS:[1,7]};
const _hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
function mistura(a,b,t){const A=_hex(a),B=_hex(b);t=Math.max(0,Math.min(1,t));return `rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")})`;}
/* cor de margem sobre fundo escuro: 0 = neutro, 1 = cor cheia */
/* margem baixa = tom acinzentado da cor do líder (misturar com o fundo escuro daria marrom) */
/* quatro degraus de margem (até 10, 25, 45, mais pontos), como nos mapas de apuração */
const DEGRAUS_LULA=["#f0918d","#ea5f5b","#dc342f","#a8151b"], DEGRAUS_FLAVIO=["#93a7f3","#6683ee","#3a5fe6","#1f3cbf"];
const degrau=m=>{const a=Math.abs(m);return a<=10?0:a<=25?1:a<=45?2:3;};
const corMargem=m=>(m>=0?DEGRAUS_LULA:DEGRAUS_FLAVIO)[degrau(m)];
const corOuro=t=>`rgba(233,196,106,${(0.18+0.82*Math.max(0,Math.min(1,t))).toFixed(2)})`;
/* el: container; itens: {UF:{cor,texto,titulo,gov}}; onClick(uf); legenda: html */
function azulejos(el,itens,{onClick,legenda,ativo}={}){
  el.classList.add("azulejos");
  el.innerHTML=Object.entries(TILES).map(([uf,[c,l]])=>{const d=itens[uf]||{};return `<button type="button" class="az${d.gov?" gov":""}" data-uf="${uf}" style="grid-column:${c+1};grid-row:${l+1};background:${d.cor||"var(--surface-2)"}" title="${(d.titulo||uf).replace(/"/g,"&quot;")}" aria-pressed="${ativo===uf}"><b>${uf}</b><span>${d.texto||""}</span></button>`;}).join("")
    +(legenda?`<div class="leg">${legenda}</div>`:"");
  if(onClick) el.querySelectorAll(".az").forEach(b=>b.onclick=()=>onClick(b.dataset.uf));
}
"""


def escrever_globals(caminho="deploy/app/globals.css"):
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("/* gerado por identidade.py; não editar à mão */\n" + CSS)
    print(caminho, "gerado")


if __name__ == "__main__":
    escrever_globals()
