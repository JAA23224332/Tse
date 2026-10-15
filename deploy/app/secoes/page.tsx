"use client";
import { useEffect, useMemo, useState } from "react";
import { Credito } from "@/app/credito";
import "./secoes.css";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
type Linha = Record<string, string | number | null>;
type Municipio = { cd_tse: string; municipio: string; eleitorado: number };
type Resposta = { linhas: Linha[]; totais: Record<string, number>; candidatos: { numero: string; nome: string }[]; truncado: boolean; limite: number; erro?: string };

const fmt = (v: unknown) => typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })) : v == null ? "—" : String(v);
const pc = (a: number, b: number) => (b ? (100 * a / b).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0,0") + "%";

const COLS: [string, string, boolean][] = [
  ["zona", "Zona", true], ["secao", "Seção", true], ["local", "Local de votação", false], ["bairro", "Bairro", false], ["endereco", "Endereço", false],
  ["aptos", "Aptos", true], ["comparecimento", "Compar.", true], ["abstencao", "Abst.", true], ["pct_abstencao", "Abst. %", true],
  ["lula", "Lula", true], ["flavio", "Flávio", true], ["pct_lula", "Lula %", true], ["pct_flavio", "Flávio %", true], ["margem_lula", "Margem Lula", true],
  ["eliminados", "Outros", true], ["brancos", "Brancos", true], ["nulos", "Nulos", true],
];
const EXTRA: [string, string, boolean][] = [["tipo_secao", "Tipo", false], ["secao_principal", "Seção principal", true], ["tipo_local", "Tipo do local", false], ["cep", "CEP", false], ["acessibilidade", "Acessibilidade", false], ["eleitores_secao", "Eleitores da seção", true]];

export default function Secoes() {
  const [uf, setUf] = useState("");
  const [muns, setMuns] = useState<Municipio[]>([]);
  const [mun, setMun] = useState("");
  const [zona, setZona] = useState("");
  const [secao, setSecao] = useState("");
  const [q, setQ] = useState("");
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [ordem, setOrdem] = useState<{ col: string; desc: boolean }>({ col: "secao", desc: false });
  const [detalhe, setDetalhe] = useState(false);
  const [filtroTabela, setFiltroTabela] = useState("");

  useEffect(() => {
    setMun(""); setMuns([]);
    if (!uf) return;
    fetch(`/api/secoes/municipios?uf=${uf}`).then((x) => x.json()).then(setMuns).catch(() => setMuns([]));
  }, [uf]);

  const params = () => { const p = new URLSearchParams({ uf }); if (mun) p.set("mun", mun); if (zona) p.set("zona", zona); if (secao) p.set("secao", secao); if (q) p.set("q", q); return p; };
  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!uf) { setErro("Escolha a UF."); return; }
    setCarregando(true); setErro("");
    try {
      const x = await fetch(`/api/secoes?${params()}`, { cache: "no-store" });
      const j: Resposta = await x.json();
      if (!x.ok) { setErro(j.erro ?? "Falha na busca."); setR(null); } else setR(j);
    } catch (err) { setErro((err as Error).message); }
    setCarregando(false);
  };

  const candCols = useMemo(() => (r?.candidatos ?? []).filter((c) => !["13", "22", "95", "96"].includes(c.numero)).map((c) => [`v${c.numero}`, `${c.numero} ${c.nome.split(" ")[0]}`, true] as [string, string, boolean]), [r]);
  const cols = detalhe ? [...COLS, ...EXTRA, ...candCols] : COLS;
  const linhas = useMemo(() => {
    if (!r) return [];
    const f = filtroTabela.trim().toLowerCase();
    const base = f ? r.linhas.filter((l) => ["local", "bairro", "endereco", "municipio"].some((c) => String(l[c] ?? "").toLowerCase().includes(f))) : r.linhas;
    const { col, desc } = ordem;
    return [...base].sort((a, b) => { const x = a[col], y = b[col]; const c = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR"); return desc ? -c : c; });
  }, [r, ordem, filtroTabela]);
  const ordenar = (col: string) => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : true }));
  const t = r?.totais;
  const titulo = r ? `${muns.find((m) => m.cd_tse === mun)?.municipio ?? ""} ${uf}${zona ? ` · zona ${zona}` : ""}${secao ? ` · seção ${secao}` : ""}${q ? ` · “${q}”` : ""}`.trim() : "";

  return (
    <main className="sec wrap">
      <header className="head">
        <span className="eyebrow">Microdados do TSE</span>
        <h1>Busca por <i>seção eleitoral</i></h1>
        <p className="muted">Votação para presidente no 1º turno de 2026, seção por seção: local, endereço, bairro, aptos, comparecimento, abstenção e votos de cada candidato. Filtre por município, zona e seção, ou procure pelo nome da escola ou do bairro.</p>
      </header>

      <form className="busca panel" onSubmit={buscar}>
        <label>UF<select value={uf} onChange={(e) => setUf(e.target.value)} required><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <label className="mun">Município<select value={mun} onChange={(e) => setMun(e.target.value)} disabled={!uf}>
          <option value="">{uf ? (muns.length ? "Todos (use zona/seção ou texto)" : "Carregando…") : "Escolha a UF"}</option>
          {muns.map((m) => <option key={m.cd_tse} value={m.cd_tse}>{m.municipio}</option>)}
        </select></label>
        <label>Zona<input type="text" inputMode="numeric" value={zona} onChange={(e) => setZona(e.target.value.replace(/\D/g, ""))} placeholder="nº" /></label>
        <label>Seção<input type="text" inputMode="numeric" value={secao} onChange={(e) => setSecao(e.target.value.replace(/\D/g, ""))} placeholder="nº" /></label>
        <label className="q">Local, bairro ou endereço<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Escola Municipal, Centro, Rua da Matriz" /></label>
        <button type="submit" className="btn primary" disabled={carregando || !uf}>{carregando ? "Buscando…" : "Buscar"}</button>
      </form>
      {erro && <p className="erro">{erro}</p>}

      {r && t && (
        <section>
          <div className="head">
            <h2>{titulo}</h2>
            <p className="muted small">{fmt(t.secoes)} seções encontradas{r.truncado ? `. A tabela mostra as primeiras ${fmt(r.limite)}; o CSV traz até 60 mil.` : "."}</p>
          </div>
          <div className="stats">
            <div className="stat"><b>{fmt(t.aptos)}</b><span>eleitores aptos</span></div>
            <div className="stat"><b>{fmt(t.comparecimento)}</b><span>compareceram · {pc(t.comparecimento, t.aptos)}</span></div>
            <div className="stat ouro"><b>{pc(t.abstencao, t.aptos)}</b><span>abstenção · {fmt(t.abstencao)} eleitores</span></div>
            <div className="stat lula"><b>{pc(t.lula, t.validos)}</b><span>Lula · {fmt(t.lula)} votos</span></div>
            <div className="stat flavio"><b>{pc(t.flavio, t.validos)}</b><span>Flávio · {fmt(t.flavio)} votos</span></div>
            <div className="stat"><b>{fmt(t.brancos + t.nulos)}</b><span>brancos e nulos · {pc(t.brancos + t.nulos, t.comparecimento)}</span></div>
          </div>
          <div className="split" aria-hidden="true"><i style={{ width: `${100 * t.lula / (t.validos || 1)}%`, background: "var(--lula)" }} /><i style={{ width: `${100 * t.eliminados / (t.validos || 1)}%`, background: "var(--neutral)" }} /><i style={{ width: `${100 * t.flavio / (t.validos || 1)}%`, background: "var(--flavio)" }} /></div>

          <div className="filters">
            <input type="search" value={filtroTabela} onChange={(e) => setFiltroTabela(e.target.value)} placeholder="Filtrar a tabela por local, bairro ou endereço" aria-label="Filtrar a tabela" />
            <button type="button" className="chip" aria-pressed={detalhe} onClick={() => setDetalhe(!detalhe)}>Todas as colunas e candidatos</button>
            <a className="btn" href={`/api/secoes?${params()}&formato=csv`} download>Baixar CSV</a>
          </div>
          <div className="tbl alto"><table>
            <thead><tr>{cols.map(([c, rot, n]) => <th key={c} className={`s${n ? " n" : ""}`} aria-sort={ordem.col === c ? (ordem.desc ? "descending" : "ascending") : undefined} onClick={() => ordenar(c)}>{rot}</th>)}</tr></thead>
            <tbody>{linhas.map((l) => <tr key={`${l.cd_tse}-${l.zona}-${l.secao}`}>{cols.map(([c, , n]) => <td key={c} className={n ? "n" : ""}>{c === "margem_lula" && typeof l[c] === "number" ? <span className={(l[c] as number) > 0 ? "lula" : (l[c] as number) < 0 ? "flavio" : ""}>{fmt(l[c])}</span> : c === "tipo_secao" && l[c] === "Agregadora" ? <span className="tag">agregadora</span> : fmt(l[c])}</td>)}</tr>)}</tbody>
          </table></div>
          <p className="faint small">Seções “agregadas” votam na urna da seção principal: os votos aparecem na principal e a agregada fica com zero. Comparecimento e abstenção vêm da soma dos votos e dos aptos de cada seção.</p>
        </section>
      )}
      {!r && !erro && <p className="faint">Exemplo: UF BA, município Salvador, zona 3, seção 120. Ou UF DF e o texto “Ceilândia”.</p>}
      <Credito />
    </main>
  );
}
