"use client";
/** Gráfico da noite: % de Lula contado × projetado, com a faixa de incerteza. Usado na capa e na página de apuração. */
export type Ponto = { t: string; pst: number; lula: number | null; projLula: number | null; faixa: number | null };
const pc = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function Linha({ hist }: { hist: Ponto[] }) {
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
