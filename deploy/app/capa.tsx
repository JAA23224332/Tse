"use client";
import { useEffect, useState } from "react";
import type { Resposta } from "@/lib/coletor";
import type { Governadores } from "@/lib/governadores";
import { Credito } from "@/app/credito";
import { Linha, type Ponto } from "@/app/apuracao/linha";
import resumo from "@/app/sign-in/resumo.json";
import { CidadesAoVivo, MunicipiosUF, type Cidade } from "@/app/cidades";
import "./capa.css";

/** Capa do site na noite do 2º turno: placar ao vivo, Brasil em azulejos, governadores, evolução e atalhos. */
const ABERTURA = Date.parse("2026-10-25T20:00:00Z"); // 17h de Brasília
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pc = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const TILES: Record<string, [number, number]> = { RR: [1, 0], AP: [2, 0], AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1], AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
  MT: [1, 3], GO: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3], MS: [1, 4], DF: [2, 4], MG: [3, 4], ES: [4, 4], PR: [1, 5], SP: [2, 5], RJ: [3, 5], SC: [1, 6], RS: [1, 7] };
const DEGRAUS_LULA = ["#f0918d", "#ea5f5b", "#dc342f", "#a8151b"], DEGRAUS_FLAVIO = ["#93a7f3", "#6683ee", "#3a5fe6", "#1f3cbf"];
const corMargem = (m: number) => { const a = Math.abs(m); return (m >= 0 ? DEGRAUS_LULA : DEGRAUS_FLAVIO)[a <= 10 ? 0 : a <= 25 ? 1 : a <= 45 ? 2 : 3]; };
const NOME_UF: Record<string, string> = { AC: "Acre", AM: "Amazonas", DF: "Distrito Federal", ES: "Espírito Santo", RN: "Rio Grande do Norte", TO: "Tocantins" };
const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());

export function Capa() {
  const [d, setD] = useState<Resposta | null>(null);
  const [g, setG] = useState<Governadores | null>(null);
  const [hist, setHist] = useState<Ponto[]>([]);
  const [erro, setErro] = useState("");
  const [agora, setAgora] = useState(0);
  const [ufAtiva, setUfAtiva] = useState("");
  const [fixar, setFixar] = useState<Cidade | null>(null); // cidade escolhida na lista da UF → vai para "Cidades ao vivo"
  const [demo, setDemo] = useState(false); // ?demo=1: mostra o 1º turno como se fosse a contagem, para conferir o visual
  const [telao, setTelao] = useState(false); // modo telão: sem barra, tudo maior, para a sala de apuração
  useEffect(() => {
    document.body.classList.toggle("telao", telao);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setTelao(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.classList.remove("telao"); window.removeEventListener("keydown", esc); };
  }, [telao]);

  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      try {
        const r = await fetch("/api/apuracao", { cache: "no-store" }); const j = await r.json();
        if (!vivo) return;
        if (!r.ok) { setErro(j.erro ?? "Sem dados no momento."); return; }
        setErro(""); setD(j);
      } catch { if (vivo) setErro("Sem conexão com o servidor. A página tenta de novo sozinha."); }
      try { const r = await fetch("/api/apuracao/governadores", { cache: "no-store" }); if (r.ok) { const j = await r.json(); if (vivo && j.ufs) setG(j); } } catch {}
      try { const r = await fetch("/api/apuracao/historico", { cache: "no-store" }); const j = await r.json(); if (vivo && j.pontos) setHist(j.pontos); } catch {}
    };
    const q = new URLSearchParams(window.location.search);
    setDemo(q.get("demo") === "1");
    const ufQ = (q.get("uf") ?? "").toUpperCase(); if (/^[A-Z]{2}$/.test(ufQ)) setUfAtiva(ufQ); // ?uf=GO abre o estado
    buscar();
    const id = setInterval(buscar, 60_000);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    setAgora(Date.now());
    return () => { vivo = false; clearInterval(id); clearInterval(relogio); };
  }, []);

  const oficial = d?.modo === "oficial" || (demo && !!d && d.brasil.lula + d.brasil.flavio > 0);
  const b = oficial ? d!.brasil : null;
  const tot = b ? b.lula + b.flavio : 0;
  const contLula = tot ? 100 * b!.lula / tot : 0;
  const temProj = !!b && b.projLula != null && b.projFlavio != null && b.projLula + b.projFlavio > 0;
  const projLula = temProj ? 100 * b!.projLula! / (b!.projLula! + b!.projFlavio!) : 0;
  const faixa = b?.faixa ?? null;
  const empate = temProj && faixa != null && Math.abs(projLula - 50) < faixa;
  const fim = !!b && b.pst >= 100;
  const faltam = Math.max(0, ABERTURA - agora);
  const hh = Math.floor(faltam / 3600e3), mm = Math.floor((faltam % 3600e3) / 60e3), ss = Math.floor((faltam % 60e3) / 1000);
  const ufs = oficial ? d!.ufs : [];
  const ativa = ufs.find((u) => u.uf === ufAtiva);
  const r1 = resumo.brasil;
  const pct1Flavio = 100 * r1.flavio / r1.validos, pct1Lula = 100 * r1.lula / r1.validos;
  const relogioBR = agora ? new Date(agora).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const idadeS = d && agora ? Math.max(0, Math.round((agora - Date.parse(d.atualizado)) / 1000)) : null;
  const pendentes = oficial ? [...ufs].filter((u) => u.pst < 99).sort((a, b) => b.eleitorado - a.eleitorado).slice(0, 6) : [];
  let manchete = "";
  if (b && tot) {
    const lider = b.lula > b.flavio ? "Lula" : "Flávio Bolsonaro", vant = Math.abs(b.lula - b.flavio);
    manchete = fim
      ? `${lider} vence com ${pc(Math.max(contLula, 100 - contLula))} dos votos válidos entre os dois, ${fmt(vant)} votos de vantagem.`
      : `${lider} lidera por ${fmt(vant)} votos com ${pc(b.pst)} das urnas apuradas` + (temProj ? (empate ? "; a projeção indica empate técnico." : `; a projeção indica ${projLula >= 50 ? "Lula" : "Flávio Bolsonaro"} com ${pc(Math.max(projLula, 100 - projLula))} (±${faixa?.toLocaleString("pt-BR")}).`) : ".");
  }

  return (
    <main className="capa">
      <section className="hero">
        <div className="hero-txt">
          <div className="topo">
            <span className="eyebrow"><span className="ao" aria-hidden="true" />{oficial ? `Apuração oficial do TSE · ${fim ? "totalização concluída" : idadeS != null ? `atualizado há ${idadeS} s` : "atualiza a cada minuto"}` : "2º turno · 25 de outubro de 2026"}</span>
            <span className="hora" aria-label="Horário de Brasília"><b>{relogioBR}</b> Brasília</span>
            <button type="button" className="btn telao-btn" onClick={() => setTelao(!telao)} title="Tela cheia para projetar (Esc sai)">{telao ? "Sair do telão" : "Modo telão"}</button>
          </div>
          {!oficial && (
            <>
              <h1>{agora && agora < ABERTURA ? <>A apuração começa <i>às 17h</i></> : <>Aguardando as <i>primeiras urnas</i></>}</h1>
              {agora > 0 && agora < ABERTURA && <div className="relogio" aria-live="off"><b>{String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</b><span>para o fechamento das urnas em todo o país</span></div>}
              {agora >= ABERTURA && <p className="muted">As urnas fecharam. O TSE libera os primeiros resultados em instantes; esta página atualiza sozinha.</p>}
              <p className="muted ref">No 1º turno: Flávio Bolsonaro {pc(pct1Flavio, 2)} × Lula {pc(pct1Lula, 2)}, diferença de {fmt(r1.flavio - r1.lula)} votos.</p>
            </>
          )}
          {oficial && b && (
            <>
              <h1>{fim ? <>Resultado <i>do 2º turno</i></> : <><i>{pc(b.pst, b.pst >= 99.95 ? 2 : 1)}</i> das urnas apuradas</>}</h1>
              <div className="placar">
                <div className="cand lula"><b>{pc(contLula)}</b><span><strong>Lula</strong> · {fmt(b.lula)} votos</span></div>
                <div className="cand flavio"><b>{pc(100 - contLula)}</b><span><strong>Flávio Bolsonaro</strong> · {fmt(b.flavio)} votos</span></div>
              </div>
              <div className="bar"><i style={{ flex: b.lula || 1 }} /><i style={{ flex: b.flavio || 1 }} /></div>
              <div className="kv"><span>Diferença <b>{fmt(Math.abs(b.lula - b.flavio))}</b> votos</span><span>Abstenção <b>{(b.abstencao != null && b.abstencao + b.comparecimento > 0 ? pc(100 * b.abstencao / (b.abstencao + b.comparecimento)) : "—")}</b></span><span>Brancos e nulos <b>{fmt(b.brancos + b.nulos)}</b></span><span>TSE <b>{b.dh}</b></span></div>
              {manchete && <p className="manchete">{manchete}</p>}
              {temProj && !fim && (
                <div className={"proj" + (empate ? " empate" : "")}>
                  <span className="rot">Projeção do resultado final · margem ±{faixa?.toLocaleString("pt-BR")} pontos</span>
                  <div className="pl"><b className="lula">{pc(projLula)}</b><span>Lula</span><span className="sep" /><span>Flávio</span><b className="flavio">{pc(100 - projLula)}</b></div>
                  <Medidor valor={projLula} faixa={faixa ?? 0} contado={contLula} />
                  <span className="muted small">{empate ? "Empate técnico: a diferença projetada está dentro da margem." : b.pst < 30 ? "Projeção ainda instável: poucas seções apuradas." : b.pst < 80 ? "Projeção com base sólida." : "Projeção próxima do resultado final."} Atualizado {hora(d!.atualizado)}.</span>
                </div>
              )}
            </>
          )}
          {pendentes.length > 0 && !fim && (
            <div className="faltam"><span className="rot">Ainda por apurar</span>{pendentes.map((u) => <span key={u.uf} className="chip"><b>{u.uf}</b> {pc(u.pst, 0)}</span>)}</div>
          )}
          {erro && <p className="alerta">{erro}</p>}
          <div className="atalhos">
            <a className="btn primary" href="/urna">Por quantos votos a sua urna foi decidida?</a>
            <a className="btn" href="/analista">Perguntar ao Raio-X Eleitoral</a>
            {oficial && <a className="btn" href="/apuracao">Tabela por estado</a>}
          </div>
        </div>

        <div className="hero-mapa">
          <div className="azulejos">
            {Object.entries(TILES).map(([uf, [c, l]]) => {
              const u = ufs.find((x) => x.uf === uf);
              const t = u ? u.lula + u.flavio : 0;
              const m = t ? 100 * (u!.lula - u!.flavio) / t : 0;
              return (
                <button key={uf} type="button" className={"az" + (g?.ufs.some((x) => x.uf === uf) ? " gov" : "")} aria-pressed={ufAtiva === uf}
                  style={{ gridColumn: c + 1, gridRow: l + 1, background: t ? corMargem(m) : "var(--surface-2)", color: t ? "#0c1412" : "var(--ink-2)", opacity: t ? 0.55 + 0.45 * Math.min(1, (u?.pst ?? 0) / 100) : 1 }}
                  title={u ? `${uf}: ${pc(u.pst, 0)} apurado · Lula ${t ? pc(100 * u.lula / t) : "—"}` : uf} onClick={() => setUfAtiva(ufAtiva === uf ? "" : uf)}>
                  <b>{uf}</b><span>{t ? `${m >= 0 ? "+" : "−"}${Math.abs(m).toFixed(0)}` : u ? pc(u.pst, 0) : ""}</span>
                </button>
              );
            })}
            <div className="leg">
              {oficial ? <><i style={{ background: DEGRAUS_LULA[2] }} />Lula à frente <i style={{ background: DEGRAUS_FLAVIO[2] }} />Flávio à frente <span>· número = vantagem em pontos · mais claro = menos apurado</span></> : <span>Os estados ganham cor assim que a contagem começar. Ponto dourado = também elege governador hoje.</span>}
            </div>
          </div>
          {ativa && (
            <div className="uf-card">
              <b>{ativa.uf}</b> <span className="muted small">{pc(ativa.pst, 0)} das seções{ativa.desatualizada ? " · dado anterior" : ""}</span>
              <div className="duo small"><span className="lula">Lula {ativa.lula + ativa.flavio ? pc(100 * ativa.lula / (ativa.lula + ativa.flavio)) : "—"}</span><span className="flavio">Flávio {ativa.lula + ativa.flavio ? pc(100 * ativa.flavio / (ativa.lula + ativa.flavio)) : "—"}</span></div>
              {ativa.projLula + ativa.projFlavio > 0 && <span className="muted small">Projeção: Lula {pc(100 * ativa.projLula / (ativa.projLula + ativa.projFlavio))}{ativa.swingConfiavel ? "" : " (tendência nacional)"}</span>}
            </div>
          )}
          {ufAtiva && ufAtiva !== "ZZ" && (
            <div className="uf-card muns-card">
              <b>Municípios de {ufAtiva}</b>
              <MunicipiosUF uf={ufAtiva} onFixar={(c) => { setFixar(c); document.getElementById("cidades")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            </div>
          )}
        </div>
      </section>

      <div id="cidades"><CidadesAoVivo inicial={fixar} /></div>

      {g && g.ufs.length > 0 && (
        <section className="govs">
          <h2>Governadores no 2º turno</h2>
          <div className="gov-grid">
            {[...g.ufs].sort((a, b) => a.uf.localeCompare(b.uf)).map((u) => {
              const [a, c] = u.candidatos, t = (a?.votos ?? 0) + (c?.votos ?? 0), pa = t ? 100 * a.votos / t : 0;
              return (
                <div key={u.uf} className="gov">
                  <span className="gov-uf">{NOME_UF[u.uf] ?? u.uf} <span className="muted small">· {u.secoes ? `${pc(u.pst, 0)} apurado` : "aguardando"}{u.final ? " · final" : ""}</span></span>
                  {[a, c].filter(Boolean).map((k) => <span key={k.numero} className="gov-l"><span>{titulo(k.nome)} <span className="muted small">{k.partido}</span>{k.eleito && <b className="eleito"> eleito</b>}</span><b>{t ? pc(100 * k.votos / t) : "—"}</b></span>)}
                  {t > 0 && <div className="bar gbar"><i style={{ flex: pa }} /><i style={{ flex: 100 - pa }} /></div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hist.length > 1 && (
        <section className="evo">
          <h2>A noite, minuto a minuto · % de Lula contado × projetado</h2>
          <div className="panel"><Linha hist={hist} /></div>
        </section>
      )}

      <section className="mais">
        <a href="/painel"><b>Painel do 1º turno</b><span>Resultado por estado e município, perfil do eleitorado, 2022 e simulador.</span></a>
        <a href="/secoes"><b>Seções eleitorais</b><span>Busca por zona, seção e local de votação, com exportação.</span></a>
        <a href="/apuracao"><b>Apuração detalhada</b><span>Tabela por estado com mudança desde o 1º turno e projeção.</span></a>
      </section>
      <Credito />
    </main>
  );
}

/** Régua de 40% a 60%: faixa da projeção (sombreada), ponto projetado e marca do contado. */
function Medidor({ valor, faixa, contado }: { valor: number; faixa: number; contado: number }) {
  const W = 600, H = 34, L = 20, R = 20, a = 40, z = 60;
  const x = (v: number) => L + (W - L - R) * (Math.max(a, Math.min(z, v)) - a) / (z - a);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="medidor" role="img" aria-label={`Projeção de Lula ${valor.toFixed(1)}% com margem de ${faixa} pontos; contado ${contado.toFixed(1)}%`}>
      <line x1={L} x2={W - R} y1={16} y2={16} stroke="#34483f" strokeWidth="2" />
      <line x1={x(50)} x2={x(50)} y1={4} y2={28} stroke="#aab7b0" strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x={x(valor - faixa)} y={10} width={Math.max(2, x(valor + faixa) - x(valor - faixa))} height={12} rx={6} fill="#e9c46a" opacity="0.28" />
      <circle cx={x(contado)} cy={16} r={4} fill="none" stroke="#aab7b0" strokeWidth="1.5" />
      <circle cx={x(valor)} cy={16} r={6} fill={valor >= 50 ? "#ff6f69" : "#86a2f7"} stroke="#0c1412" strokeWidth="2" />
      {[40, 45, 50, 55, 60].map((v) => <text key={v} x={x(v)} y={H - 2} textAnchor="middle">{v}%</text>)}
      <text x={L} y={8} fill="#86a2f7">◀ Flávio</text><text x={W - R} y={8} textAnchor="end" fill="#ff6f69">Lula ▶</text>
    </svg>
  );
}
