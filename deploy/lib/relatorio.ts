/**
 * Relatório imprimível (PDF) de uma conversa com o Raio-X Eleitoral.
 * Gera um documento HTML independente, claro e simples, a partir das mensagens do chat.
 */

type Parte =
  | { type: "text"; text: string }
  | { type: "tool-consultar_sql"; state: string; input?: { sql?: string; motivo?: string }; output?: { linhas?: Record<string, unknown>[]; erro?: string } }
  | { type: "tool-grafico"; state: string; output?: { titulo: string; unidade: string; itens: { rotulo: string; valor: number }[] } }
  | { type: string; [k: string]: unknown };
export type MensagemRelatorio = { role: "user" | "assistant" | "system"; parts: Parte[] };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fmt = (v: unknown) =>
  typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })) : v == null ? "—" : String(v);
const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>");

/** Markdown simples (títulos, listas, tabelas, parágrafos) para HTML. */
export function markdownParaHtml(md: string): string {
  const linhas = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  const ehTabela = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); i++; continue; }
    if (ehTabela(l)) {
      const rows: string[][] = [];
      while (i < linhas.length && ehTabela(linhas[i])) {
        const cels = linhas[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cels.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cels);
        i++;
      }
      if (rows.length) {
        const [cab, ...corpo] = rows;
        out.push(`<table><thead><tr>${cab.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td class="${/^[+−\-]?\d[\d.,]*\s*(%|pp|p\.p\.)?$/.test(c) ? "n" : ""}">${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      }
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordenada = /^\s*\d+[.)]\s+/.test(l);
      const itens: string[] = [];
      while (i < linhas.length && /^\s*([-*•]|\d+[.)])\s+/.test(linhas[i])) { itens.push(linhas[i].replace(/^\s*([-*•]|\d+[.)])\s+/, "")); i++; }
      out.push(`<${ordenada ? "ol" : "ul"}>${itens.map((t) => `<li>${inline(t)}</li>`).join("")}</${ordenada ? "ol" : "ul"}>`);
      continue;
    }
    const par: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !ehTabela(linhas[i]) && !/^\s*(#{1,4}\s|([-*•]|\d+[.)])\s)/.test(linhas[i])) { par.push(linhas[i]); i++; }
    const texto = par.join(" ");
    out.push(/^fonte:/i.test(texto.trim()) ? `<p class="fonte">${inline(texto)}</p>` : `<p>${inline(texto)}</p>`);
  }
  return out.join("\n");
}

function parteHtml(p: Parte): string {
  if (p.type === "text") return markdownParaHtml((p as { text: string }).text);
  if (p.type === "tool-consultar_sql") {
    const q = p as Extract<Parte, { type: "tool-consultar_sql" }>;
    if (q.state !== "output-available" || !q.output || q.output.erro || !q.output.linhas?.length) return "";
    const cols = Object.keys(q.output.linhas[0]);
    return `<details class="consulta"><summary>Dados consultados${q.input?.motivo ? `: ${esc(q.input.motivo)}` : ""} (${q.output.linhas.length} linhas)</summary>
<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${q.output.linhas.slice(0, 60).map((r) => `<tr>${cols.map((c) => `<td class="${typeof r[c] === "number" ? "n" : ""}">${esc(fmt(r[c]))}</td>`).join("")}</tr>`).join("")}</tbody></table>
${q.output.linhas.length > 60 ? `<p class="nota">Mostrando 60 de ${q.output.linhas.length} linhas.</p>` : ""}</details>`;
  }
  if (p.type === "tool-grafico") {
    const g = p as Extract<Parte, { type: "tool-grafico" }>;
    if (g.state !== "output-available" || !g.output) return "";
    const max = Math.max(...g.output.itens.map((x) => Math.abs(x.valor)), 1);
    return `<figure><figcaption>${esc(g.output.titulo)}</figcaption>${g.output.itens.map((x) => `<div class="barra"><span>${esc(x.rotulo)}</span><i style="width:${(100 * Math.abs(x.valor)) / max}%"></i><b>${esc(fmt(x.valor))} ${esc(g.output!.unidade)}</b></div>`).join("")}</figure>`;
  }
  return "";
}

export function relatorioHtml(mensagens: MensagemRelatorio[], titulo = "Raio-X Eleitoral"): string {
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const blocos = mensagens.filter((m) => m.role !== "system").map((m) => {
    if (m.role === "user") {
      const t = m.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join(" ");
      return `<section class="pergunta"><span class="rotulo">Pergunta</span><h2>${esc(t)}</h2></section>`;
    }
    // texto e gráficos primeiro; as consultas ao banco vão ao fim, como anexo
    const principais = m.parts.filter((p) => p.type !== "tool-consultar_sql").map(parteHtml);
    const consultas = m.parts.filter((p) => p.type === "tool-consultar_sql").map(parteHtml).filter(Boolean);
    return `<section class="resposta"><span class="rotulo">Resposta do Raio-X Eleitoral</span>${principais.join("\n")}${consultas.length ? `<div class="anexo"><span class="rotulo">Dados consultados</span>${consultas.join("\n")}</div>` : ""}</section>`;
  });
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} · relatório</title>
<style>
@page{margin:18mm 16mm}
*{box-sizing:border-box}
body{margin:0;padding:24px;font:11pt/1.5 Georgia,"Times New Roman",serif;color:#111;background:#fff;max-width:820px;margin-inline:auto}
header{border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:22px;display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap}
header h1{font:700 20pt/1.1 Georgia,serif;margin:0}header .sub{font:9.5pt system-ui,sans-serif;color:#555}
section{margin:0 0 18px;break-inside:avoid}
.rotulo{display:block;font:600 8pt system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#777;margin-bottom:4px}
.pergunta h2{font:600 13pt/1.3 system-ui,sans-serif;margin:0;padding:10px 12px;background:#f2f2f2;border-left:4px solid #111}
.resposta{padding-left:16px;border-left:1px solid #ddd}
.resposta h2,.resposta h3,.resposta h4,.resposta h5{font:700 12pt/1.3 system-ui,sans-serif;margin:14px 0 6px}
p{margin:0 0 8px}ul,ol{margin:0 0 8px;padding-left:22px}li{margin:0 0 3px}
code{font:9.5pt ui-monospace,monospace;background:#f2f2f2;padding:0 3px}
table{border-collapse:collapse;width:100%;margin:6px 0 10px;font:9.5pt system-ui,sans-serif}
th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f2f2f2;font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.fonte{font:9pt system-ui,sans-serif;color:#555;border-top:1px dashed #bbb;padding-top:6px;margin-top:10px}
details.consulta{margin:8px 0 10px;font:9.5pt system-ui,sans-serif}details.consulta summary{color:#555;cursor:pointer}
pre{font:8.5pt ui-monospace,monospace;color:#444;white-space:pre-wrap;background:#f7f7f7;padding:6px 8px;border:1px solid #e3e3e3}
.nota{font-size:9pt;color:#777}
.anexo{margin-top:12px;padding-top:8px;border-top:1px solid #ddd}
figure{margin:8px 0 12px;font:9.5pt system-ui,sans-serif}figcaption{font-weight:600;margin-bottom:6px}
.barra{display:grid;grid-template-columns:160px 1fr auto;gap:8px;align-items:center;margin:0 0 4px}
.barra i{display:block;height:10px;background:#555;border-radius:0 3px 3px 0}.barra b{font-weight:500;white-space:nowrap}
footer{margin-top:28px;border-top:1px solid #ccc;padding-top:8px;font:8.5pt system-ui,sans-serif;color:#777;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media print{body{padding:0}details.consulta{break-inside:avoid}details.consulta[open] summary{list-style:none}}
</style></head>
<body>
<header><div><h1>${esc(titulo)}</h1><div class="sub">Agente de IA sobre os dados oficiais do TSE · Painel do 2º Turno 2026</div></div><div class="sub">${esc(agora)}</div></header>
${blocos.join("\n")}
<footer><span>Fontes: TSE (resultados do 1º turno de 2026 por seção e município, resultados de 2022, perfil do eleitorado, locais de votação). Estimativas de "votos a ganhar" dependem de premissas.</span><span>segundoturno.blog</span></footer>
<script>document.querySelectorAll("details").forEach(d=>d.open=true);</script>
</body></html>`;
}
