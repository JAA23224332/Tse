"use client";
import { useEffect, useState } from "react";
import type { Apuracao } from "@/lib/apuracao";
import { Credito } from "@/app/credito";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pc = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";

export default function Page() {
  const [d, setD] = useState<(Apuracao & { modo?: "oficial" | "aguardando" | "demonstracao" }) | null>(null);
  const [erro, setErro] = useState("");
  const [hist, setHist] = useState<{ t: number; lula: number; projLula: number; pst: number }[]>([]);

  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      try {
        const r = await fetch("/api/apuracao", { cache: "no-store" });
        const j = await r.json();
        if (!vivo) return;
        if (!r.ok) { setErro(j.erro ?? "Sem dados."); return; }
        setErro(""); setD(j);
        const b = j.brasil, pl = 100 * b.lula / (b.lula + b.flavio || 1), pp = 100 * b.projLula / (b.projLula + b.projFlavio || 1);
        setHist((h) => (h.length && h[h.length - 1].pst === b.pst ? h : [...h, { t: Date.now(), lula: pl, projLula: pp, pst: b.pst }]).slice(-400));
      } catch (e) { if (vivo) setErro((e as Error).message); }
    };
    buscar();
    const id = setInterval(buscar, 30_000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  const b = d?.brasil;
  const semVotos = !b || b.lula + b.flavio === 0;
  const contLula = b ? 100 * b.lula / (b.lula + b.flavio || 1) : 0;
  const projLula = b ? 100 * b.projLula / (b.projLula + b.projFlavio || 1) : 0;
  const ufs = d ? [...d.ufs].sort((x, y) => y.eleitorado - x.eleitorado) : [];

  return (
    <main className="ap">
      <style>{`
        .ap{max-width:1100px;margin:0 auto;padding:28px 20px 64px;display:grid;gap:28px}
        .ap header{display:grid;gap:10px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.grid2{grid-template-columns:1fr}}
        .card{display:grid;gap:12px}.card h2{font-family:var(--fb);font-size:13px;font-weight:600;color:var(--ink-3)}
        .card.proj{box-shadow:inset 0 0 0 1px var(--ouro)}
        .duo{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end}.duo b{font-family:var(--fd);font-weight:500;font-size:clamp(36px,5vw,56px);line-height:1;letter-spacing:-.02em;font-variant-numeric:lining-nums tabular-nums;font-variation-settings:"opsz" 144}
        .duo span{display:block;font-size:13px;color:var(--ink-2);margin-top:6px}
        .bar{height:9px;display:flex;gap:2px;border-radius:4px;overflow:hidden}.bar i{display:block;height:100%}.bar i:first-child{background:var(--lula)}.bar i:last-child{background:var(--flavio)}
        .kv{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--ink-2)}.kv b{color:var(--ink);font-variant-numeric:tabular-nums}
        .prog{display:inline-block;width:70px;height:7px;background:var(--surface-3);border-radius:4px;vertical-align:middle;margin-right:6px}.prog i{display:block;height:100%;background:var(--ouro);border-radius:4px}
        .alerta{background:var(--surface);border-left:3px solid var(--ouro);border-radius:var(--r);padding:12px 14px;font-size:14px;color:var(--ink-2)}
        .ao{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ouro);margin-right:8px;vertical-align:1px}
        svg text{font:10.5px var(--fb);fill:var(--ink-3)}
      `}</style>
      <header>
        <span className="eyebrow"><span className="ao" aria-hidden="true" />Atualiza a cada 30 segundos</span>
        <h1>Apuração ao vivo</h1>
        <p className="muted">Lê os arquivos oficiais do TSE. A projeção corrige o viés da ordem de apuração: usa o resultado do 1º turno de cada município para estimar o que ainda falta contar.</p>
      </header>

      {d?.modo === "aguardando" && <div className="alerta">O TSE já publicou os arquivos do 2º turno ({b ? fmt(b.secoesTot) : "—"} seções). Aguardando as primeiras seções totalizadas; os números aparecem assim que a contagem começar.</div>}
      {d?.modo === "demonstracao" && <div className="alerta">Modo de demonstração: o TSE ainda não publicou os arquivos do 2º turno, então a página mostra o 1º turno (100% apurado) para você conhecer a tela. Na noite de 25/10 ela passa sozinha para o 2º turno.</div>}
      {erro && <div className="alerta">{erro}. No dia 25/10, a partir das 17h, esta página passa a mostrar a contagem em tempo real.</div>}

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
            </div>
            <div className="card panel proj">
              <h2>Projeção do resultado final</h2>
              <div className="duo">
                <div><b className="lula">{pc(projLula)}</b><span>Lula · ≈ {fmt(b.projLula)} votos</span></div>
                <div style={{ textAlign: "right" }}><b className="flavio">{pc(100 - projLula)}</b><span>Flávio · ≈ {fmt(b.projFlavio)} votos</span></div>
              </div>
              <div className="bar"><i style={{ flex: b.projLula }} /><i style={{ flex: b.projFlavio }} /></div>
              <p className="muted">{b.pst < 1 ? "Aguardando as primeiras seções." : b.pst < 30 ? "Projeção ainda instável: poucas seções apuradas." : b.pst < 80 ? "Projeção com base sólida." : "Projeção próxima do resultado final."} Atualizado {new Date(d!.atualizado).toLocaleTimeString("pt-BR")}.</p>
            </div>
          </div>

          {hist.length > 1 && (
            <div className="card panel">
              <h2>Evolução da noite · % de Lula sobre os dois (contado × projetado)</h2>
              <Linha hist={hist} />
            </div>
          )}

          <div className="tbl"><table>
            <thead><tr><th>UF</th><th>Apurado</th><th className="n">Lula</th><th className="n">Flávio</th><th className="n">% Lula contado</th><th className="n">% Lula projetado</th><th className="n">Swing vs 1º t.</th><th>Atualizado</th></tr></thead>
            <tbody>{ufs.map((u) => {
              const c = 100 * u.lula / (u.lula + u.flavio || 1), p = 100 * u.projLula / (u.projLula + u.projFlavio || 1);
              return <tr key={u.uf}><td><b>{u.uf}</b></td><td><span className="prog"><i style={{ width: `${u.pst}%` }} /></span>{pc(u.pst, 0)}</td>
                <td className="n">{fmt(u.lula)}</td><td className="n">{fmt(u.flavio)}</td><td className="n">{pc(c)}</td><td className="n"><b>{pc(p)}</b></td>
                <td className={u.swing > 0 ? "n lula" : u.swing < 0 ? "n flavio" : "n"}>{(100 * u.swing > 0 ? "+" : "") + (100 * u.swing).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.</td><td>{u.dh}</td></tr>;
            })}</tbody>
          </table></div>
          {d!.falhas.length > 0 && <p className="muted">Sem resposta do TSE para: {d!.falhas.join(", ").toUpperCase()}.</p>}
          <p className="muted">Swing: quanto a margem de Lula (em pontos) mudou em relação ao 1º turno nos municípios já apurados; é o que a projeção aplica ao restante da UF. Votos do exterior (ZZ) entram no total nacional sem projeção.</p>
        </>
      )}
          <Credito />
    </main>
  );
}

function Linha({ hist }: { hist: { t: number; lula: number; projLula: number; pst: number }[] }) {
  const W = 800, H = 200, L = 36, R = 10, T = 10, B = 24;
  const ys = hist.flatMap((h) => [h.lula, h.projLula]);
  const y0 = Math.floor(Math.min(...ys, 48) - 1), y1 = Math.ceil(Math.max(...ys, 52) + 1);
  const x = (i: number) => L + (W - L - R) * (hist.length > 1 ? i / (hist.length - 1) : 0);
  const y = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const path = (k: "lula" | "projLula") => hist.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(h[k]).toFixed(1)}`).join("");
  const ticks = []; for (let v = y0; v <= y1; v += 1) ticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Evolução do percentual de Lula">
      {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 50 ? "#73847c" : "#243530"} /><text x={L - 6} y={y(v) + 3} textAnchor="end">{v}%</text></g>)}
      <path d={path("lula")} fill="none" stroke="#7d8b85" strokeWidth="2" />
      <path d={path("projLula")} fill="none" stroke="#ff5c45" strokeWidth="2.5" />
      {[0, Math.floor(hist.length / 2), hist.length - 1].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{pc(hist[i].pst, 0)} apurado</text>)}
      <text x={W - R} y={T + 10} textAnchor="end" fill="#ff8f7d">projeção</text><text x={W - R} y={T + 22} textAnchor="end">contado</text>
    </svg>
  );
}
