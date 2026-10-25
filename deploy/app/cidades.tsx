"use client";
import { useEffect, useMemo, useState } from "react";

/**
 * Cidades ao vivo na capa: busca qualquer município, fixa os que interessam e acompanha a contagem do 2º turno
 * de cada um a cada minuto, lida direto do TSE pelo navegador (o portal libera CORS). Lista fica no navegador.
 */
export type Cidade = { uf: string; cd: string; nome: string };
type AoVivo = { pst: number; secoes: number; secoesTot: number; lula: number; flavio: number; brancos: number; nulos: number; comparecimento: number; aptos: number; dh: string };
type MunUF = { cd: string; nome: string; eleitorado: number; pst: number; secoes: number; secoesTot: number; lula1: number; flavio1: number };
type Indice = { ufs: { sg: string; nome: string; municipios: [string, string][] }[] };

const n = (x: unknown) => Number(String(x ?? "0").replace(",", ".")) || 0;
const fmt = (v: number) => Math.round(v).toLocaleString("pt-BR");
const pc = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
const sem = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(\/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
const CHAVE = "capa.cidades";

export async function lerAoVivo(uf: string, cd: string): Promise<AoVivo | null> {
  const u = uf.toLowerCase();
  const r = await fetch(`https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${u}/${u}${cd}-c0001-e006258-u.json`, { cache: "no-store" });
  if (!r.ok) return null;
  const d = await r.json();
  if (String(d.ele) !== "6258") return null;
  let lula = 0, flavio = 0;
  for (const a of d.carg?.[0]?.agr ?? []) for (const p of a.par ?? []) for (const c of p.cand ?? []) { if (c.n === "13") lula += n(c.vap); if (c.n === "22") flavio += n(c.vap); }
  return { pst: n(d.s?.pstn), secoes: n(d.s?.st), secoesTot: n(d.s?.ts), lula, flavio, brancos: n(d.v?.vb), nulos: n(d.v?.tvn), comparecimento: n(d.e?.c), aptos: n(d.e?.te), dh: `${d.dg ?? ""} ${d.hg ?? ""}`.trim() };
}

const cacheUF = new Map<string, Promise<MunUF[]>>();
export function municipiosDaUF(uf: string, forcar = false) {
  if (forcar || !cacheUF.has(uf)) cacheUF.set(uf, fetch(`/api/apuracao/uf/${uf.toLowerCase()}`, { cache: "no-store" }).then((r) => r.json()).then((j) => (j.municipios ?? []) as MunUF[]));
  return cacheUF.get(uf)!;
}

export function lerFixadas(): Cidade[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); } catch { return []; }
}
function gravarFixadas(c: Cidade[]) { try { localStorage.setItem(CHAVE, JSON.stringify(c.slice(0, 12))); } catch {} }

/** Cartão de uma cidade: contagem ao vivo + 1º turno para comparar. */
export function CartaoCidade({ c, onRemover }: { c: Cidade; onRemover?: () => void }) {
  const [v, setV] = useState<AoVivo | null>(null);
  const [t1, setT1] = useState<MunUF | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ler = () => lerAoVivo(c.uf, c.cd).then((r) => { if (vivo) { setV(r); setErro(!r); } }).catch(() => { if (vivo) setErro(true); });
    ler();
    municipiosDaUF(c.uf).then((ms) => { if (vivo) setT1(ms.find((m) => m.cd === c.cd) ?? null); }).catch(() => {});
    const id = setInterval(ler, 60_000);
    return () => { vivo = false; clearInterval(id); };
  }, [c.uf, c.cd]);
  const tot = v ? v.lula + v.flavio : 0;
  const t1tot = t1 ? t1.lula1 + t1.flavio1 : 0;
  const pl = tot ? 100 * v!.lula / tot : 0, pl1 = t1tot ? 100 * t1!.lula1 / t1tot : null;
  const swing = tot && pl1 != null ? pl - pl1 : null;
  return (
    <div className="cid">
      <div className="cid-topo"><b>{titulo(c.nome)} <span className="muted">{c.uf}</span></b>{onRemover && <button type="button" className="x" onClick={onRemover} aria-label={`Remover ${c.nome}`}>×</button>}</div>
      {v && tot > 0 ? (
        <>
          <div className="cid-pl"><b className="lula">{pc(pl)}</b><span className="muted small">{pc(v.pst, 0)} apurado</span><b className="flavio">{pc(100 - pl)}</b></div>
          <div className="bar"><i style={{ flex: v.lula }} /><i style={{ flex: v.flavio }} /></div>
          <span className="small muted">Lula {fmt(v.lula)} · Flávio {fmt(v.flavio)} · dif. {fmt(Math.abs(v.lula - v.flavio))}{v.aptos ? ` · abst. ${pc(100 * (1 - v.comparecimento / v.aptos), 0)}` : ""}</span>
          {swing != null && <span className={"small " + (swing > 0 ? "lula" : swing < 0 ? "flavio" : "muted")}>{swing > 0 ? "+" : ""}{swing.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pontos para Lula desde o 1º turno ({pc(pl1!)})</span>}
        </>
      ) : (
        <span className="small muted">{erro ? "Sem resposta do TSE agora." : v ? "Aguardando as primeiras urnas." : "Lendo o TSE…"}{t1tot ? ` No 1º turno: Lula ${pc(100 * t1!.lula1 / t1tot)} × Flávio ${pc(100 * t1!.flavio1 / t1tot)} (${fmt(t1!.eleitorado)} eleitores).` : ""}</span>
      )}
    </div>
  );
}

/** Busca de cidade (qualquer UF) + lista de cidades fixadas, guardada no navegador. */
export function CidadesAoVivo({ inicial }: { inicial?: Cidade | null }) {
  const [idx, setIdx] = useState<Indice | null>(null);
  const [q, setQ] = useState("");
  const [fixadas, setFixadas] = useState<Cidade[]>([]);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    // ?cidade=UF-CD (pode repetir): abre a capa já acompanhando essas cidades; o resto vem do navegador
    const q = new URLSearchParams(window.location.search).getAll("cidade").map((x) => x.split("-")).filter((p) => p.length === 2 && /^[A-Z]{2}$/.test(p[0]));
    const salvas = lerFixadas();
    const novas = q.filter(([uf, cd]) => !salvas.some((c) => c.uf === uf && c.cd === cd)).map(([uf, cd]) => ({ uf, cd, nome: cd }));
    setFixadas([...novas, ...salvas].slice(0, 12));
    fetch("/urna/data/index.json").then((r) => r.json()).then((i: Indice) => {
      setIdx(i);
      // completa o nome das cidades vindas do endereço
      setFixadas((f) => { const out = f.map((c) => c.nome === c.cd ? { ...c, nome: i.ufs.find((u) => u.sg === c.uf)?.municipios.find(([cd]) => cd === c.cd)?.[1] ?? c.cd } : c); gravarFixadas(out); return out; });
    }).catch(() => {});
  }, []);
  useEffect(() => { if (inicial) adicionar(inicial); }, [inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugestoes = useMemo(() => {
    if (!idx || q.length < 2) return [];
    const s = sem(q); const out: Cidade[] = [];
    for (const u of idx.ufs) for (const [cd, nome] of u.municipios) { if (sem(nome).includes(s)) { out.push({ uf: u.sg, cd, nome }); if (out.length >= 12) return out; } }
    return out;
  }, [idx, q]);
  function adicionar(c: Cidade) {
    setFixadas((f) => { if (f.some((x) => x.uf === c.uf && x.cd === c.cd)) return f; const novo = [c, ...f].slice(0, 12); gravarFixadas(novo); return novo; });
    setQ(""); setAberto(false);
  }
  function remover(c: Cidade) { setFixadas((f) => { const novo = f.filter((x) => !(x.uf === c.uf && x.cd === c.cd)); gravarFixadas(novo); return novo; }); }
  return (
    <section className="cidades">
      <div className="cid-cab">
        <h2>Cidades ao vivo</h2>
        <label className="busca">
          <input type="search" value={q} placeholder="Buscar cidade (ex.: Ipameri, Caruaru, Osasco)" onChange={(e) => { setQ(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter" && sugestoes.length) { e.preventDefault(); adicionar(sugestoes[0]); } }} />
          {aberto && sugestoes.length > 0 && <ul className="sug" role="listbox">{sugestoes.map((c) => <li key={c.uf + c.cd} role="option" aria-selected={false} onMouseDown={() => adicionar(c)}>{titulo(c.nome)} <span className="muted">{c.uf}</span></li>)}</ul>}
        </label>
      </div>
      {fixadas.length === 0
        ? <p className="muted small">Busque uma cidade para acompanhar a contagem dela minuto a minuto. As cidades ficam salvas neste navegador. Clique num estado no mapa para ver os municípios dele.</p>
        : <div className="cid-grid">{fixadas.map((c) => <CartaoCidade key={c.uf + c.cd} c={c} onRemover={() => remover(c)} />)}</div>}
    </section>
  );
}

/** Municípios de uma UF com % apurado e margem do 1º turno; clique fixa a cidade. */
export function MunicipiosUF({ uf, onFixar }: { uf: string; onFixar: (c: Cidade) => void }) {
  const [ms, setMs] = useState<MunUF[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let vivo = true; setMs(null);
    const ler = (f = false) => municipiosDaUF(uf, f).then((r) => { if (vivo) setMs(r); }).catch(() => { if (vivo) setMs([]); });
    ler();
    const id = setInterval(() => ler(true), 60_000);
    return () => { vivo = false; clearInterval(id); };
  }, [uf]);
  if (!ms) return <p className="small muted">Carregando municípios…</p>;
  const s = sem(q);
  const lista = (q ? ms.filter((m) => sem(m.nome).includes(s)) : ms).slice(0, q ? 30 : 15);
  const apurados = ms.filter((m) => m.secoes > 0).length;
  return (
    <div className="muns">
      <div className="muns-cab"><span className="small muted">{ms.length} municípios · {apurados} com urnas apuradas</span><input type="search" value={q} placeholder="Filtrar" onChange={(e) => setQ(e.target.value)} /></div>
      <ul>
        {lista.map((m) => {
          const t = m.lula1 + m.flavio1, m1 = t ? 100 * (m.lula1 - m.flavio1) / t : 0;
          return <li key={m.cd}><button type="button" onClick={() => onFixar({ uf, cd: m.cd, nome: m.nome })} title="Acompanhar ao vivo">
            <span className="nm">{titulo(m.nome)}</span><span className="el muted small">{fmt(m.eleitorado)}</span>
            <span className="prog"><i style={{ width: `${m.pst}%` }} /></span><span className="ps small">{pc(m.pst, 0)}</span>
            <span className={"m1 small " + (m1 > 0 ? "lula" : m1 < 0 ? "flavio" : "muted")}>{m1 > 0 ? "+" : ""}{m1.toFixed(0)}</span>
          </button></li>;
        })}
      </ul>
      <span className="small muted">Eleitorado · % apurado · margem de Lula no 1º turno (pontos). Clique para acompanhar a cidade ao vivo.</span>
    </div>
  );
}
