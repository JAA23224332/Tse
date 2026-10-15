"use client";
import { useEffect, useState } from "react";
import type { Resposta } from "@/lib/coletor";
import { Credito } from "@/app/credito";
import "./apuracao.css";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pc = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
type Ponto = { t: string; pst: number; lula: number | null; projLula: number | null; faixa: number | null };

export default function Page() {
  const [d, setD] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [hist, setHist] = useState<Ponto[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      try {
        const r = await fetch("/api/apuracao", { cache: "no-store" });
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok) { setErro(j.erro ?? "Sem dados no momento."); return; }
        setErro(""); setD(j);
      } catch { if (vivo) setErro("Sem conexão com o servidor. Verifique a internet; a página tenta de novo sozinha."); }
      finally { if (vivo) setCarregando(false); }
    };
    const historico = async () => {
      try { const r = await fetch("/api/apuracao/historico", { cache: "no-store" }); const j = await r.json(); if (vivo && j.pontos) setHist(j.pontos); } catch {}
    };
    buscar(); historico();
    const id = setInterval(() => { buscar(); historico(); }, 60_000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  const b = d?.brasil;
  const semVotos = !b || b.lula + b.flavio === 0;
  const contLula = b ? 100 * b.lula / (b.lula + b.flavio || 1) : 0;
  const temProj = !!b && b.projLula != null && b.projFlavio != null && b.projLula + b.projFlavio > 0;
  const projLula = temProj ? 100 * b!.projLula! / (b!.projLula! + b!.projFlavio!) : 0;
  const faixa = b?.faixa ?? null;
  const empate = temProj && faixa != null && Math.abs(projLula - 50) < faixa;
  const ufs = d ? [...d.ufs].sort((x, y) => y.eleitorado - x.eleitorado) : [];
  const velho = d && d.idade > 180;

  return (
    <main className="ap">
      <header>
        <span className="eyebrow"><span className="ao" aria-hidden="true" />Atualiza a cada minuto · dados oficiais do TSE</span>
        <h1>Apuração ao vivo</h1>
        <p className="muted">A projeção corrige a ordem de apuração: usa o resultado do 1º turno de cada município para estimar o que ainda falta contar, com uma margem (±) que diminui conforme a contagem avança.</p>
      </header>

      {carregando && !d && <p className="muted" aria-live="polite">Carregando a contagem…</p>}
      {d?.modo === "aguardando" && <div className="alerta">O TSE já publicou os arquivos do 2º turno ({b ? fmt(b.secoesTot) : "—"} seções). Aguardando as primeiras seções totalizadas; os números aparecem assim que a contagem começar.</div>}
      {d?.modo === "demonstracao" && <div className="alerta">Modo de demonstração: mostra o 1º turno (100% apurado) para você conhecer a tela. Na noite de 25/10, a partir das 17h, ela passa sozinha para o 2º turno.</div>}
      {erro && <div className="alerta">{erro}</div>}
      {velho && <div className="alerta">Os dados mostrados são de {hora(d!.atualizado)} (há {Math.round(d!.idade / 60)} min). O TSE ou o coletor não respondeu; a página continua tentando. Fonte oficial: <a href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">resultados.tse.jus.br</a>.</div>}

      {b && !semVotos && (
        <>
          <div className="grid2">
            <div className="card panel">
              <h2>Contado até agora · {pc(b.pst)} das seções</h2>
              <div className="duo">
                <div><b className="lula">{pc(contLula)}</b><span>Lula · {fmt(b.lula)} votos</span></div>
                <div style={{ textAlign: "right" }}><b className="flavio">{pc(100 - contLula)}</b><span>Flávio Bolsonaro · {fmt(b.flavio)} votos</span></div>
              </div>
              <div className="bar"><i style={{ flex: b.lula }} /><i style={{ flex: b.flavio }} /></div>
              <div className="kv"><span>Diferença <b>{fmt(Math.abs(b.lula - b.flavio))}</b></span><span>Brancos <b>{fmt(b.brancos)}</b></span><span>Nulos <b>{fmt(b.nulos)}</b></span><span>Abstenção <b>{b.eleitorado ? pc(100 * (1 - b.comparecimento / b.eleitorado)) : "—"}</b></span></div>
              <p className="muted small">Percentuais sobre os votos dos dois candidatos (sem brancos e nulos). TSE {b.dh}.</p>
            </div>
            <div className="card panel proj">
              <h2>Projeção do resultado final{faixa != null ? ` · margem ±${faixa.toLocaleString("pt-BR")} pontos` : ""}</h2>
              {temProj ? (
                <>
                  <div className="duo">
                    <div><b className="lula">{pc(projLula)}</b><span>Lula</span></div>
                    <div style={{ textAlign: "right" }}><b className="flavio">{pc(100 - projLula)}</b><span>Flávio Bolsonaro</span></div>
                  </div>
                  <div className="bar"><i style={{ flex: projLula }} /><i style={{ flex: 100 - projLula }} /></div>
                  <p className={empate ? "destaque" : "muted"}>
                    {empate ? "Empate técnico: a diferença projetada está dentro da margem." : b.pst < 30 ? "Projeção ainda instável: poucas seções apuradas." : b.pst < 80 ? "Projeção com base sólida." : "Projeção próxima do resultado final."}
                    {" "}Atualizado {hora(d!.atualizado)}.
                  </p>
                </>
              ) : <p className="muted">A projeção aparece quando as primeiras seções forem totalizadas.</p>}
            </div>
          </div>

          {hist.length > 1 && (
            <div className="card panel">
              <h2>Evolução da noite · % de Lula (contado × projetado, com a margem)</h2>
              <Linha hist={hist} />
            </div>
          )}

          <div className="tbl"><table>
            <thead><tr><th>UF</th><th>Apurado</th><th className="n">Lula</th><th className="n">Flávio</th><th className="n">% Lula contado</th><th className="n">% Lula projetado</th><th className="n">Mudança desde o 1º turno</th><th>Atualizado</th></tr></thead>
            <tbody>{ufs.map((u) => {
              const c = 100 * u.lula / (u.lula + u.flavio || 1), p = 100 * u.projLula / (u.projLula + u.projFlavio || 1);
              return <tr key={u.uf} className={u.desatualizada ? "faint" : ""}><td><b>{u.uf}</b>{u.desatualizada ? " ⚠" : ""}</td><td><span className="prog"><i style={{ width: `${u.pst}%` }} /></span>{pc(u.pst, 0)}</td>
                <td className="n">{fmt(u.lula)}</td><td className="n">{fmt(u.flavio)}</td><td className="n">{u.lula + u.flavio ? pc(c) : "—"}</td><td className="n"><b>{u.lula + u.flavio ? pc(p) : "—"}</b></td>
                <td className={u.swing > 0 ? "n lula" : u.swing < 0 ? "n flavio" : "n"}>{u.lula + u.flavio ? (100 * u.swing > 0 ? "+" : "") + (100 * u.swing).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " pontos" + (u.swingConfiavel ? "" : " *") : "—"}</td><td>{u.dh}</td></tr>;
            })}</tbody>
          </table></div>
          <p className="muted small">"Mudança desde o 1º turno": quantos pontos a vantagem de Lula mudou nos municípios já apurados da UF; é o que a projeção aplica ao que falta. * = ainda com pouca apuração, usando a tendência nacional. ⚠ = UF sem resposta do TSE nesta atualização (dado anterior).</p>
          {d!.falhas.length > 0 && <p className="muted small">Sem resposta do TSE para: {d!.falhas.join(", ").toUpperCase()}.</p>}
        </>
      )}
      <Credito />
    </main>
  );
}

function Linha({ hist }: { hist: Ponto[] }) {
  const W = 800, H = 220, L = 36, R = 10, T = 10, B = 24;
  const pts = hist.filter((h) => h.lula != null);
  if (pts.length < 2) return null;
  const ys = pts.flatMap((h) => [h.lula!, h.projLula ?? h.lula!]);
  const y0 = Math.floor(Math.min(...ys, 48) - 1), y1 = Math.ceil(Math.max(...ys, 52) + 1);
  const x = (i: number) => L + (W - L - R) * (i / (pts.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const path = (f: (h: Ponto) => number | null) => pts.map((h, i) => { const v = f(h); return v == null ? "" : `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; }).join("");
  const banda = pts.filter((h) => h.projLula != null && h.faixa != null);
  const area = banda.length > 1
    ? banda.map((h, i) => `${i ? "L" : "M"}${x(pts.indexOf(h)).toFixed(1)},${y(Math.min(y1, h.projLula! + h.faixa!)).toFixed(1)}`).join("") +
      [...banda].reverse().map((h) => `L${x(pts.indexOf(h)).toFixed(1)},${y(Math.max(y0, h.projLula! - h.faixa!)).toFixed(1)}`).join("") + "Z"
    : "";
  const ticks = []; for (let v = y0; v <= y1; v += 1) ticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Evolução do percentual de Lula ao longo da noite">
      {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 50 ? "#73847c" : "#243530"} /><text x={L - 6} y={y(v) + 3} textAnchor="end">{v}%</text></g>)}
      {area && <path d={area} fill="#ff5c45" opacity="0.18" />}
      <path d={path((h) => h.lula)} fill="none" stroke="#7d8b85" strokeWidth="2" />
      <path d={path((h) => h.projLula)} fill="none" stroke="#ff5c45" strokeWidth="2.5" />
      {[0, Math.floor(pts.length / 2), pts.length - 1].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{hora(pts[i].t)} · {pc(pts[i].pst, 0)}</text>)}
      <text x={W - R} y={T + 10} textAnchor="end" fill="#ff8f7d">projeção (faixa sombreada)</text><text x={W - R} y={T + 22} textAnchor="end">contado</text>
    </svg>
  );
}
