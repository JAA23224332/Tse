export const NOME = "2º Turno 2026";
export const DESCRICAO = "Resultados oficiais do TSE por estado, município e escola, estratégia de campanha, mapa, apuração ao vivo e o Raio-X Eleitoral.";

// Ordem do dia da eleição (25/10): o que importa hoje vem primeiro; as ferramentas de planejamento ficam depois.
export const PAGINAS = [
  ["/", "Apuração ao vivo"],
  ["/urna", "Sua urna"],
  ["/analista", "Raio-X Eleitoral"],
  ["/painel", "Painel 1º turno"],
  ["/estrategia", "Estratégia"],
  ["/mapa", "Mapa"],
  ["/regioes", "Bairros"],
  ["/secoes", "Seções"],
] as const;

const FONTES =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap">';

/** Faixa do dia da eleição, logo abaixo da barra: leva ao que importa hoje. */
export function faixaHojeHtml() {
  return `<style>
#hoje{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;padding:12px 16px;background:#121d1a;border-bottom:1px solid #243530;font:14px/1.3 "Schibsted Grotesk",system-ui,sans-serif;color:#aab7b0}
#hoje b{color:#eef2ee;font-weight:600}#hoje a{display:inline-block;padding:9px 14px;border-radius:999px;text-decoration:none;font-weight:600;font-size:13.5px}
#hoje a.ap{background:#e9c46a;color:#1a1200}#hoje a.ur{background:#1a2824;color:#eef2ee;border:1px solid #34483f}
</style><div id="hoje"><b>Hoje é o 2º turno.</b><a class="ap" href="/">Apuração ao vivo a partir das 17h</a><a class="ur" href="/urna">Por quantos votos a sua urna foi decidida?</a></div>`;
}

/** Barra de navegação em HTML puro, injetada nas páginas servidas como arquivo e usada pelas páginas React. */
export function navHtml(atual: string, email: string | null, admin: boolean, comFontes = false) {
  const links = PAGINAS.map(([h, t]) =>
    `<a href="${h}" ${h === atual ? 'aria-current="page"' : ""}>${t}</a>`).join("");
  return `${comFontes ? FONTES : ""}<style>
#navig{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;gap:2px 6px;align-items:center;padding:0 16px;min-height:48px;background:rgba(12,20,18,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid #243530;color:#aab7b0;font:13.5px/1 "Schibsted Grotesk",system-ui,sans-serif}
#navig .marca{font:500 17px/1 "Fraunces",Georgia,serif;font-variant-numeric:lining-nums;color:#eef2ee;text-decoration:none;margin-right:14px;letter-spacing:-.01em;padding:14px 0}
#navig .marca i{font-style:italic;color:#e9c46a}
#navig a:not(.marca){color:#aab7b0;text-decoration:none;padding:16px 8px;border-bottom:2px solid transparent;margin-bottom:-1px}
#navig a:not(.marca):hover{color:#eef2ee}#navig a[aria-current=page]{color:#eef2ee;border-color:#e9c46a}
#navig .r{margin-left:auto;display:flex;gap:4px;align-items:center;color:#73847c}#navig .r a{padding:16px 8px}
#navig .ao{display:inline-block;width:7px;height:7px;border-radius:50%;background:#e9c46a;margin-right:6px;vertical-align:1px}
#navig #aovivo{order:0;display:inline-flex;align-items:center;gap:7px;margin:8px 12px 8px 0;padding:6px 10px;border:1px solid #2c3f39;border-radius:999px;color:#eef2ee;font-variant-numeric:tabular-nums;white-space:nowrap;text-decoration:none}
#navig #aovivo[hidden]{display:none}
#navig #aovivo::before{content:"";width:7px;height:7px;border-radius:50%;background:#e9c46a;flex:none}
#navig #aovivo.vivo{border-color:#e9c46a}#navig #aovivo.vivo::before{background:#ff5c45;animation:aovivo 1.6s ease-in-out infinite}
#navig #aovivo.espera{color:#aab7b0}
@keyframes aovivo{50%{opacity:.25}}@media(prefers-reduced-motion:reduce){#navig #aovivo.vivo::before{animation:none}}
@media(max-width:700px){#navig{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;gap:0;padding:0 12px}#navig::-webkit-scrollbar{display:none}#navig a{white-space:nowrap;flex:none}#navig .marca{margin-right:8px}#navig .r{margin-left:12px;flex:none}#navig .r span{display:none}}
</style><nav id="navig" aria-label="Páginas"><a class="marca" href="/">2º Turno <i>2026</i></a><a id="aovivo" href="/apuracao" hidden></a>${links}<span class="r">${email ? `<span>${email.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))}</span>${admin ? '<a href="/admin">Acessos</a>' : ""}<a href="/sair">Sair</a>` : ""}</span></nav><script src="/aovivo.js" defer></script>`;
}
