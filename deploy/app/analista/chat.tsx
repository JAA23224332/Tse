"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import type { MensagemAnalista } from "@/lib/analista";
import { relatorioHtml, type MensagemRelatorio } from "@/lib/relatorio";
import type { Perfil } from "@/lib/acesso";
import { Pedido } from "./pedido";
import { Vitrine } from "./vitrine";
import { Credito } from "@/app/credito";
import resumo from "./resumo.json";
import "./analista.css";

const N_MUN = resumo.municipios.toLocaleString("pt-BR");
const N_LOC = resumo.locais ? `${Math.round(resumo.locais / 1000)} mil` : "milhares de";

const TEMAS: { tema: string; perguntas: string[] }[] = [
  { tema: "Onde ganhar", perguntas: [
    "Quais são os 15 municípios onde Lula tem mais votos a ganhar?",
    "Quais capitais têm mais votos de eliminados em disputa?",
    "Nos municípios com mais de 200 mil eleitores, quais estão empatados?",
  ] },
  { tema: "Abstenção", perguntas: [
    "Em quais estados a abstenção em redutos de Lula mais pesa?",
    "Onde a abstenção mais custa votos para Lula na Bahia?",
  ] },
  { tema: "Comparar com 2022", perguntas: [
    "Onde Lula mais caiu em relação a 2022?",
    "Compare o potencial de ganho por região.",
  ] },
  { tema: "Locais de votação", perguntas: [
    "Em Brasília, quais escolas têm mais abstenção em áreas onde Lula lidera?",
  ] },
];
const CARDS = [
  ["Onde ganhar", "Quais são os 15 municípios onde Lula tem mais votos a ganhar?"],
  ["Abstenção", "Em quais estados a abstenção em redutos de Lula mais pesa?"],
  ["Comparar com 2022", "Onde Lula mais caiu em relação a 2022?"],
  ["Regiões", "Compare o potencial de ganho por região."],
  ["Capitais", "Quais capitais têm mais votos de eliminados em disputa?"],
  ["Disputa apertada", "Nos municípios com mais de 200 mil eleitores, quais estão empatados?"],
];

const fmt = (v: unknown) =>
  typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }))
  : v == null ? "—" : String(v);

function Tabela({ linhas }: { linhas: Record<string, unknown>[] }) {
  if (!linhas.length) return <p className="muted small">A consulta não devolveu linhas.</p>;
  const cols = Object.keys(linhas[0]);
  return (
    <div className="tbl"><table>
      <thead><tr>{cols.map((c) => <th key={c} className={typeof linhas[0][c] === "number" ? "n" : ""}>{c.replace(/_/g, " ")}</th>)}</tr></thead>
      <tbody>{linhas.map((l, i) => <tr key={i}>{cols.map((c) => <td key={c} className={typeof l[c] === "number" ? "n" : ""}>{fmt(l[c])}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

function Grafico({ titulo, unidade, itens }: { titulo: string; unidade: string; itens: { rotulo: string; valor: number }[] }) {
  const max = Math.max(...itens.map((i) => Math.abs(i.valor)), 1);
  const misto = itens.some((i) => i.valor < 0) && itens.some((i) => i.valor > 0);
  return (
    <figure className="graf">
      <figcaption>{titulo}</figcaption>
      {itens.map((i) => (
        <div key={i.rotulo} className="hb">
          <span className="rot" title={i.rotulo}>{i.rotulo}</span>
          <span className="trk"><i style={{ width: `${(100 * Math.abs(i.valor)) / max}%`, background: misto ? (i.valor < 0 ? "var(--flavio)" : "var(--lula)") : undefined }} /></span>
          <span className="val">{fmt(i.valor)} {unidade}</span>
        </div>
      ))}
    </figure>
  );
}

const NUMERICO = /^[+\u2212\-]?\d[\d.,]*\s*(%|pp|p\.p\.)?$/;

function Inline({ s }: { s: string }) {
  // negrito **x**, itálico *x* e código `x`, sem biblioteca
  const partes = s.split(/(\*\*[^*]+\*\*|`[^`]+`|(?<![\w*])\*[^*\s][^*]*\*(?![\w*]))/g);
  return <>{partes.map((p, j) => {
    if (!p) return null;
    if (p.startsWith("**")) return <b key={j}>{p.slice(2, -2)}</b>;
    if (p.startsWith("`")) return <code key={j}>{p.slice(1, -1)}</code>;
    if (p.startsWith("*")) return <em key={j}>{p.slice(1, -1)}</em>;
    return p;
  })}</>;
}

function TabelaMd({ linhas }: { linhas: string[] }) {
  const celulas = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const cab = celulas(linhas[0]);
  const corpo = linhas.slice(1).filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(celulas);
  const alinhaDir = cab.map((_, i) => corpo.length > 0 && corpo.every((r) => !r[i] || NUMERICO.test(r[i])));
  return (
    <div className="tbl md"><table>
      <thead><tr>{cab.map((c, i) => <th key={i} className={alinhaDir[i] ? "n" : ""}><Inline s={c} /></th>)}</tr></thead>
      <tbody>{corpo.map((r, i) => <tr key={i}>{cab.map((_, j) => <td key={j} className={alinhaDir[j] ? "n" : ""}><Inline s={r[j] ?? ""} /></td>)}</tr>)}</tbody>
    </table></div>
  );
}

function Texto({ t }: { t: string }) {
  // Markdown leve: títulos, listas, tabelas, negrito; sem biblioteca
  const blocos: React.ReactNode[] = [];
  const linhas = t.split("\n");
  let i = 0;
  const k = () => `b${blocos.length}`;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    const titulo = /^\s*(#{1,6})\s+(.*)$/.exec(l);
    if (titulo) { blocos.push(titulo[1].length <= 3 ? <h3 key={k()}><Inline s={titulo[2]} /></h3> : <h4 key={k()}><Inline s={titulo[2]} /></h4>); i++; continue; }
    if (/^\s*\|/.test(l)) {
      const tab: string[] = [];
      while (i < linhas.length && /^\s*\|/.test(linhas[i])) tab.push(linhas[i++]);
      blocos.push(<TabelaMd key={k()} linhas={tab} />); continue;
    }
    if (/^\s*[-•*]\s+/.test(l)) {
      const itens: React.ReactNode[] = [];
      while (i < linhas.length && /^\s*[-•*]\s+/.test(linhas[i])) itens.push(<li key={i}><Inline s={linhas[i++].replace(/^\s*[-•*]\s+/, "")} /></li>);
      blocos.push(<ul key={k()}>{itens}</ul>); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const itens: React.ReactNode[] = [];
      while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) itens.push(<li key={i}><Inline s={linhas[i++].replace(/^\s*\d+[.)]\s+/, "")} /></li>);
      blocos.push(<ol key={k()}>{itens}</ol>); continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { blocos.push(<hr key={k()} />); i++; continue; }
    // parágrafo: junta linhas seguidas que não iniciam outro bloco
    const par: string[] = [l];
    i++;
    while (i < linhas.length && linhas[i].trim() && !/^\s*(#{1,6}\s|\||[-•*]\s|\d+[.)]\s|-{3,}\s*$)/.test(linhas[i])) par.push(linhas[i++]);
    blocos.push(<p key={k()}><Inline s={par.join(" ")} /></p>);
  }
  return <div className="txt">{blocos}</div>;
}

const IconeBanco = () => <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;

/** Texto simples de uma mensagem: resposta, tabelas consultadas e gráficos, para copiar. */
function mensagemTexto(m: MensagemAnalista): string {
  const blocos: string[] = [];
  for (const p of m.parts) {
    if (p.type === "text") blocos.push(p.text.trim());
    else if (p.type === "tool-consultar_sql" && p.state === "output-available" && !("erro" in p.output) && p.output.linhas.length) {
      const cols = Object.keys(p.output.linhas[0]);
      const linha = (r: Record<string, unknown>) => cols.map((c) => fmt(r[c])).join("\t");
      blocos.push(`[Consulta: ${p.input?.motivo ?? ""}]\n${cols.join("\t")}\n${p.output.linhas.map(linha).join("\n")}`);
    } else if (p.type === "tool-grafico" && p.state === "output-available") {
      blocos.push(`[${p.output.titulo}]\n${p.output.itens.map((i) => `${i.rotulo}: ${fmt(i.valor)} ${p.output.unidade}`).join("\n")}`);
    }
  }
  return blocos.filter(Boolean).join("\n\n");
}

type Props = { modo?: "completo" | "degustacao"; perfil?: Perfil; restantes?: number; email?: string | null };

export function Chat({ modo = "completo", perfil = "aprovado", restantes: restantesInicial = 0, email = null }: Props) {
  const degustacao = modo === "degustacao";
  const [restantes, setRestantes] = useState(restantesInicial);
  const [pedindo, setPedindo] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(perfil === "pendente");
  const esgotado = degustacao && restantes <= 0 && !pedidoEnviado;
  const CHAVE = "raiox_conversa";
  const { messages, sendMessage, status, error, stop, setMessages } = useChat<MensagemAnalista>({
    id: "raiox",
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [messages]);
  const ocupado = status === "submitted" || status === "streaming";
  const [toque, setToque] = useState(false);
  const [restaurado, setRestaurado] = useState(false);
  // depois de montar: detecta toque e restaura a conversa guardada nesta aba (sobrevive a trocar de página e voltar)
  useEffect(() => {
    setToque(matchMedia("(pointer: coarse)").matches);
    try { const b = sessionStorage.getItem(CHAVE); if (b) setMessages(JSON.parse(b) as MensagemAnalista[]); } catch {}
    setRestaurado(true);
  }, [setMessages]);
  // guarda a conversa; tabelas grandes são encurtadas para caber
  useEffect(() => {
    if (ocupado || !restaurado) return;
    try {
      const leve = messages.map((m) => ({ ...m, parts: m.parts.map((p) => p.type === "tool-consultar_sql" && p.state === "output-available" && "linhas" in p.output && (p.output.linhas?.length ?? 0) > 50 ? { ...p, output: { ...p.output, linhas: (p.output.linhas ?? []).slice(0, 50) } } : p) }));
      sessionStorage.setItem(CHAVE, JSON.stringify(leve));
    } catch {}
  }, [messages, ocupado, restaurado]);
  useEffect(() => { if (esgotado && !ocupado) setPedindo(true); }, [esgotado, ocupado]);
  const novaConversa = () => { setMessages([]); try { sessionStorage.removeItem(CHAVE); } catch {} };
  const erroTexto = (e: Error) => /fetch|network|load failed/i.test(e.message) ? "Sem conexão. Verifique a internet e tente de novo." : e.message;
  useEffect(() => { if (error && /aprovado|experiência/i.test(error.message) && degustacao) { setRestantes(0); setPedindo(true); } }, [error, degustacao]);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<string | null>(null);
  const quadro = useRef<HTMLIFrameElement>(null);
  /** Mostra o relatório sobre o chat (sem pop-up nem navegação: a conversa continua intacta). */
  const abrirPdf = (selecao: MensagemAnalista[]) => {
    const html = relatorioHtml(selecao as unknown as MensagemRelatorio[]);
    // iPhone/iPad: o Safari não imprime iframe; abre o relatório como página própria com o botão de imprimir dentro
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      const url = URL.createObjectURL(new Blob([html.replace("</body>", '<p style="text-align:center;margin:24px 0"><button onclick="window.print()" style="font:600 15px system-ui;padding:12px 18px;border:0;border-radius:8px;background:#111;color:#fff">Imprimir ou salvar em PDF</button></p></body>')], { type: "text/html" }));
      window.open(url, "_blank") || (window.location.href = url);
      return;
    }
    setRelatorio(html);
  };
  const salvarPdf = () => { const w = quadro.current?.contentWindow; if (w) { w.focus(); w.print(); } };
  useEffect(() => {
    if (!relatorio) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setRelatorio(null); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [relatorio]);
  const pdfDe = (m: MensagemAnalista) => {
    const i = messages.findIndex((x) => x.id === m.id);
    const anterior = messages[i - 1];
    abrirPdf(anterior?.role === "user" ? [anterior, m] : [m]);
  };

  async function copiar(texto: string, chave: string) {
    try { await navigator.clipboard.writeText(texto); }
    catch {
      const ta = document.createElement("textarea"); ta.value = texto; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setCopiado(chave); setTimeout(() => setCopiado(null), 1800);
  }
  const textoDe = (m: MensagemAnalista) => mensagemTexto(m);
  const conversaTexto = () => messages.map((m) => (m.role === "user" ? "PERGUNTA: " : "RAIO-X ELEITORAL: ") + textoDe(m)).join("\n\n");
  const perguntar = (texto: string) => {
    if (degustacao && restantes <= 0) { setPedindo(true); return; }
    if (texto.trim() && !ocupado) { if (degustacao) setRestantes((r) => r - 1); sendMessage({ text: texto.trim() }); setInput(""); if (campo.current) campo.current.style.height = ""; } };
  const ajustar = (el: HTMLTextAreaElement) => { el.style.height = ""; el.style.height = Math.min(160, el.scrollHeight) + "px"; };

  return (
    <main className="an">
      {relatorio && (
        <div className="relatorio" role="dialog" aria-modal="true" aria-label="Relatório para PDF">
          <div className="relatorio-barra">
            <div><b>Relatório</b><span className="small muted"> · confira e salve como PDF (na janela de impressão, destino "Salvar como PDF")</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setRelatorio(null)}>Voltar ao chat</button>
              <button type="button" className="btn primary" onClick={salvarPdf}>Salvar como PDF</button>
            </div>
          </div>
          <iframe ref={quadro} title="Relatório" srcDoc={relatorio} sandbox="allow-same-origin allow-modals" className="relatorio-quadro" />
        </div>
      )}
      <aside className="trilho" aria-label="Sugestões">
        <div>
          <h2>O que o Raio-X consulta</h2>
          <div className="fontes">
            <div className="fonte"><i /><span><b>{N_MUN} municípios</b>resultado do 1º turno, 2022, abstenção, perfil do eleitorado e votos a ganhar</span></div>
            <div className="fonte"><i /><span><b>27 estados</b>totais, margens e peso de cada um no ganho nacional</span></div>
            <div className="fonte"><i /><span><b>{N_LOC} locais de votação</b>escola por escola, com bairro, abstenção e margem</span></div>
          </div>
        </div>
        <div className="temas">
          {TEMAS.map((t) => (
            <div className="tema" key={t.tema}>
              <h2>{t.tema}</h2>
              {t.perguntas.map((p) => <button key={p} type="button" onClick={() => perguntar(p)}>{p}</button>)}
            </div>
          ))}
        </div>
      </aside>

      <section className="conversa" aria-live="polite">
        {degustacao && (
          <div className="faixa-degustacao">
            {pedidoEnviado ? <span><b>Pedido em análise.</b> Você recebe um aviso quando o acesso for liberado.</span>
              : restantes > 0 ? <span><b>Experimente:</b> você tem {restantes} pergunta{restantes === 1 ? "" : "s"} de cortesia. Gostou? Peça o acesso completo.</span>
              : <span><b>Suas perguntas de experiência acabaram.</b> Diga quem você é para continuar.</span>}
            {!pedidoEnviado && !pedindo && <button type="button" className="btn primary" onClick={() => setPedindo(true)}>Pedir acesso</button>}
          </div>
        )}
        {pedindo && !pedidoEnviado && <Pedido email={email} onEnviado={() => { setPedidoEnviado(true); setPedindo(false); window.location.assign("/analista"); }} onDepois={() => setPedindo(false)} />}
        {messages.length === 0 && degustacao && <Vitrine onPerguntar={restantes > 0 ? perguntar : undefined} />}
        {messages.length === 0 && !degustacao && (
          <div className="capa">
            <span className="eyebrow">Raio-X Eleitoral · agente de IA sobre os dados oficiais do TSE</span>
            <h1>Passe o <i>Raio-X</i> na eleição</h1>
            <p className="muted">Em português, como perguntaria a uma pessoa da equipe. O Raio-X Eleitoral consulta os resultados oficiais do TSE (1º turno de 2026, 2022, perfil do eleitorado e {N_LOC} locais de votação), mostra a consulta que fez e responde com números e uma recomendação.</p>
            <div className="cards">
              {CARDS.map(([tema, p]) => <button key={p} type="button" className="card" onClick={() => perguntar(p)}><small>{tema}</small>{p}</button>)}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="acoes-conversa">
            <button type="button" className="acao" onClick={() => copiar(conversaTexto(), "tudo")}>{copiado === "tudo" ? "Copiado" : "Copiar conversa"}</button>
            <button type="button" className="acao" onClick={() => abrirPdf(messages)} disabled={ocupado}>Gerar PDF da conversa</button>
          </div>
        )}

        <div className="fio">
          {messages.map((m) => m.role === "user" ? (
            <div key={m.id} className="turno u"><div className="balao">{m.parts.map((p, i) => p.type === "text" ? <span key={i}>{p.text}</span> : null)}</div></div>
          ) : (
            <div key={m.id} className="turno a">
              <div className="marca" aria-hidden="true">IA</div>
              <div className="corpo">
                {m.parts.map((p, i) => {
                  switch (p.type) {
                    case "text": {
                      const anterior = m.parts.slice(0, i).find((q) => q.type === "text" && q.text.trim() === p.text.trim());
                      return anterior ? null : <Texto key={i} t={p.text} />;
                    }
                    case "tool-consultar_sql": {
                      const pronto = p.state === "output-available";
                      return (
                        <details key={i} className="passo">
                          <summary><IconeBanco />{pronto ? <><span>Consultou os dados</span><span className="m">{p.input?.motivo ?? ""}</span><span className="abrir">ver dados usados</span></> : <span className="pensando">Consultando os dados <i /><i /><i /></span>}</summary>
                          {pronto && ("erro" in p.output ? <p className="erro">{p.output.erro}</p> : <Tabela linhas={p.output.linhas} />)}
                        </details>
                      );
                    }
                    case "tool-grafico":
                      return p.state === "output-available" ? <Grafico key={i} {...p.output} /> : null;
                    case "tool-apuracao_ao_vivo":
                      return <details key={i} className="passo"><summary><IconeBanco />{p.state === "output-available" ? <span>Consultou a apuração ao vivo</span> : <span className="pensando">Lendo a apuração <i /><i /><i /></span>}</summary></details>;
                    default: return null;
                  }
                })}
                {!(ocupado && m.id === messages[messages.length - 1].id) && (
                  <div className="acoes-resposta">
                    <button type="button" className="acao" onClick={() => copiar(textoDe(m), m.id)}>{copiado === m.id ? "Copiado" : "Copiar resposta"}</button>
                    <button type="button" className="acao" onClick={() => pdfDe(m)}>PDF desta resposta</button>
                  </div>
                )}
                {(() => {
                  // continuações: sempre no fim da resposta, só na última, e só quando ela terminou
                  if (ocupado || m.id !== messages[messages.length - 1].id) return null;
                  const sug = [...m.parts].reverse().find((p) => p.type === "tool-proximas_perguntas" && p.state === "output-available");
                  if (!sug || sug.type !== "tool-proximas_perguntas" || sug.state !== "output-available") return null;
                  return (
                    <div className="seguir" aria-label="Perguntas de continuidade">
                      <span>Continuar com</span>
                      {sug.output.perguntas.map((q) => <button key={q} type="button" onClick={() => perguntar(q)}>{q}</button>)}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
          {error && <p className="erro">Não foi possível responder: {erroTexto(error)}</p>}
          {ocupado && <div className="turno a"><div className="marca" aria-hidden="true">IA</div><div className="pensando">Analisando <i /><i /><i /> <button type="button" className="parar" onClick={stop}>parar</button></div></div>}
          <div ref={fim} />
        </div>

        <div className="caixa" hidden={degustacao && restantes <= 0}>
          <form onSubmit={(e) => { e.preventDefault(); perguntar(input); }}>
            <textarea ref={campo} id="pergunta" rows={1} value={input} placeholder="Ex.: onde a abstenção mais custa votos para Lula na Bahia?" aria-label="Pergunta"
              onChange={(e) => { setInput(e.target.value); ajustar(e.target); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !toque) { e.preventDefault(); perguntar(input); } }} />
            <button type="submit" className="enviar" aria-label="Perguntar" disabled={ocupado || !input.trim()}><svg viewBox="0 0 24 24"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg></button>
          </form>
          <p className="dica">{toque ? "Toque na seta para enviar." : "Enter envia, Shift+Enter quebra a linha."} As respostas vêm só dos dados oficiais do TSE. {messages.length > 0 && <button type="button" className="parar" onClick={novaConversa}>Nova conversa</button>}</p>
        </div>
      </section>
      <div style={{ gridColumn: "1 / -1" }}><Credito /></div>
    </main>
  );
}
