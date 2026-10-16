export const NOME = "2º Turno 2026";
export const DESCRICAO = "Resultados oficiais do TSE por estado, município e escola, estratégia de campanha, mapa, apuração ao vivo e o Raio-X Eleitoral.";

export const PAGINAS = [
  ["/", "Painel"],
  ["/estrategia", "Estratégia"],
  ["/mapa", "Mapa"],
  ["/regioes", "Bairros"],
  ["/secoes", "Seções"],
  ["/apuracao", "Apuração ao vivo"],
  ["/analista", "Raio-X Eleitoral"],
] as const;

const FONTES =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap">';

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
@media(max-width:700px){#navig{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;gap:0;padding:0 12px}#navig::-webkit-scrollbar{display:none}#navig a{white-space:nowrap;flex:none}#navig .marca{margin-right:8px}#navig .r{margin-left:12px;flex:none}#navig .r span{display:none}}
</style><nav id="navig" aria-label="Páginas"><a class="marca" href="/">2º Turno <i>2026</i></a>${links}<span class="r">${email ? `<span>${email.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))}</span>${admin ? '<a href="/admin">Acessos</a>' : ""}<a href="/sair">Sair</a>` : '<a href="/sign-in">Entrar</a>'}</span></nav>`;
}
