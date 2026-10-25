"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Credito } from "@/app/credito";
import "./urna.css";

/**
 * "Por quantos votos a sua urna foi decidida?": seção por seção, com mensagem pronta para o WhatsApp.
 * Dados estáticos em /urna/data (1º turno) e /urna/data/2t (2º turno, publicado pelo pipeline quando o TSE
 * divulgar a votação por seção). Com os dois turnos, a página mostra o escolhido e compara com o outro.
 */
type Indice = { ufs: { sg: string; nome: string; municipios: [string, string][] }[]; turno: number };
type Stats = { turno: number; eleicao: string; data: string; total_urnas: number; media: Record<string, number>; empates: number; diferenca_ate_5: number;
  abstencao_maior_que_diferenca: { urnas: number; pct: number }; mediana_diferenca: number; total_lula: number; total_flavio: number; percentis_diferenca: number[] };
type Linha = [number, string, number, number, number, number, number, number, number]; // secao, local, aptos, lula, flavio, outros, branco_nulo, abstencao, principal
type Mun = { uf: string; cd: string; nome: string; locais: Record<string, [string, string, string]>; zonas: Record<string, Linha[]> };
type Numeros = { aptos: number; lula: number; flavio: number; outros: number; branco_nulo: number; abstencao: number };
type Turno = 1 | 2;

const SITE = "https://segundoturno.blog";
const FECHAMENTO_2T = Date.parse("2026-10-25T20:00:00Z"); // 17h de Brasília
const fmt = (n: number) => n.toLocaleString("pt-BR");
const sem = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(\/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
const soma = (ls: Linha[]): Numeros => ls.reduce((a, l) => ({ aptos: a.aptos + l[2], lula: a.lula + l[3], flavio: a.flavio + l[4], outros: a.outros + l[5], branco_nulo: a.branco_nulo + l[6], abstencao: a.abstencao + l[7] }),
  { aptos: 0, lula: 0, flavio: 0, outros: 0, branco_nulo: 0, abstencao: 0 });
const pasta = (t: Turno) => `/urna/data${t === 2 ? "/2t" : ""}`;
const cache = new Map<string, Promise<Mun>>();
const carregarMun = (t: Turno, uf: string, cd: string) => {
  const k = `${t}/${uf}/${cd}`;
  if (!cache.has(k)) cache.set(k, fetch(`${pasta(t)}/mun/${uf}/${cd}.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Mun>; }));
  return cache.get(k)!;
};
const votosDe = (m: Mun | null, modo: "secao" | "escola", zona: string, secao: string, escola: string): { nums: Numeros | null; agregadaDe: number; local: string; n: number } => {
  if (!m) return { nums: null, agregadaDe: 0, local: "", n: 0 };
  if (modo === "secao") {
    const l = zona && secao ? m.zonas[zona]?.find((x) => String(x[0]) === secao) ?? null : null;
    if (!l) return { nums: null, agregadaDe: 0, local: "", n: 0 };
    const base = l[8] ? m.zonas[zona]?.find((x) => x[0] === l[8]) ?? l : l;
    return { nums: soma([base]), agregadaDe: l[8], local: base[1], n: 1 };
  }
  const ls = escola ? (m.zonas[escola.split("-")[0]] ?? []).filter((x) => x[1] === escola && !x[8]) : [];
  return { nums: ls.length ? soma(ls) : null, agregadaDe: 0, local: escola, n: ls.length };
};

export function Urna() {
  const [idx, setIdx] = useState<Indice | null>(null);
  const [stats, setStats] = useState<Partial<Record<Turno, Stats>>>({});
  const [turno, setTurno] = useState<Turno>(1);
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [cd, setCd] = useState("");
  const [mun, setMun] = useState<Partial<Record<Turno, Mun>>>({});
  const [carregando, setCarregando] = useState(false);
  const [modo, setModo] = useState<"secao" | "escola">("secao");
  const [zona, setZona] = useState("");
  const [secao, setSecao] = useState("");
  const [escola, setEscola] = useState("");
  const [aviso, setAviso] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(0);
  useEffect(() => { setAgora(Date.now()); }, []);

  const temT2 = !!stats[2];
  const turnos: Turno[] = temT2 ? [1, 2] : [1];

  // índice, estatísticas dos turnos disponíveis e link direto (?u=UF-CD-ZONA-SECAO ou ?e=UF-CD-ZONA-LOCAL, com &t=1|2)
  useEffect(() => {
    (async () => {
      try {
        const [i, s1, s2] = await Promise.all([
          fetch("/urna/data/index.json").then((r) => r.json()),
          fetch("/urna/data/stats.json").then((r) => r.json()),
          fetch("/urna/data/2t/stats.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        setIdx(i); setStats(s2 ? { 1: s1, 2: s2 } : { 1: s1 });
        const q = new URLSearchParams(window.location.search);
        const t: Turno = !s2 ? 1 : q.get("t") === "1" ? 1 : 2; // com o 2º turno publicado, ele é o padrão
        setTurno(t);
        const u = q.get("u"), e = q.get("e");
        const p = (u ?? e ?? "").split("-");
        if (p.length === 4 && /^[A-Z]{2}$/.test(p[0])) {
          const m = await carregarMun(t, p[0], p[1]).catch(() => null);
          const existe = m && m.zonas[p[2]] && (u ? m.zonas[p[2]].some((l) => String(l[0]) === p[3]) : !!m.locais[`${p[2]}-${p[3]}`]);
          if (!m || !existe) { setAviso("Não encontramos essa urna. Escolha abaixo."); return; }
          setUf(p[0]); setCd(p[1]); setCidade(m.nome); setMun({ [t]: m }); setZona(p[2]);
          if (u) { setModo("secao"); setSecao(p[3]); } else { setModo("escola"); setEscola(`${p[2]}-${p[3]}`); }
        }
      } catch { setAviso("Não foi possível carregar a lista de cidades. Recarregue a página."); }
    })();
  }, []);

  // garante o município carregado no turno escolhido e, quando há os dois, também no outro (para comparar)
  useEffect(() => {
    if (!uf || !cd) return;
    let vivo = true;
    const falta = turnos.filter((t) => !mun[t]);
    if (!falta.length) return;
    setCarregando(true);
    Promise.all(falta.map((t) => carregarMun(t, uf, cd).then((m) => [t, m] as const).catch(() => null))).then((rs) => {
      if (!vivo) return;
      const novo = { ...mun };
      for (const r of rs) if (r) novo[r[0]] = r[1];
      setMun(novo); setCarregando(false);
      if (!novo[turno]) setAviso("Não foi possível carregar essa cidade. Tente de novo.");
    });
    return () => { vivo = false; };
  }, [uf, cd, turno, temT2]); // eslint-disable-line react-hooks/exhaustive-deps

  const estado = idx?.ufs.find((x) => x.sg === uf);
  const sugestoes = useMemo(() => {
    if (!estado || !cidade || cd) return [];
    const q = sem(cidade);
    return estado.municipios.filter(([, n]) => sem(n).includes(q)).slice(0, 10);
  }, [estado, cidade, cd]);

  function escolherCidade(c: string, nome: string) {
    setCidade(nome); setCd(c); setSugestoesAbertas(false); setZona(""); setSecao(""); setEscola(""); setMun({}); setAviso("");
  }
  function limpar() {
    setUf(""); setCidade(""); setCd(""); setMun({}); setZona(""); setSecao(""); setEscola(""); setAviso("");
    history.replaceState(null, "", location.pathname);
    document.getElementById("form-urna")?.scrollIntoView({ behavior: "smooth" });
  }

  const m = mun[turno] ?? null;
  const st = stats[turno] ?? null;
  const zonas = m ? Object.keys(m.zonas).sort((a, b) => Number(a) - Number(b)) : [];
  const escolas = useMemo(() => m ? Object.entries(m.locais).map(([id, [nome, end, bairro]]) => ({ id, nome, end, bairro, zona: id.split("-")[0] })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : [], [m]);
  const atual = votosDe(m, modo, zona, secao, escola);
  const outroTurno: Turno = turno === 1 ? 2 : 1;
  const outro = temT2 ? votosDe(mun[outroTurno] ?? null, modo, zona, secao, escola) : { nums: null, agregadaDe: 0, local: "", n: 0 };
  const local = m && atual.local ? m.locais[atual.local] : null;
  const pronto = !!(m && atual.nums && st);

  useEffect(() => {
    if (!pronto || !m) return;
    const u = (modo === "secao" ? `?u=${uf}-${cd}-${zona}-${secao}` : `?e=${uf}-${cd}-${escola}`) + (temT2 ? `&t=${turno}` : "");
    history.replaceState(null, "", location.pathname + u);
    resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pronto, modo, uf, cd, zona, secao, escola, m, turno, temT2]);

  let corpo: React.ReactNode = null;
  if (pronto && atual.nums && st && m) {
    const nums = atual.nums;
    const dif = Math.abs(nums.lula - nums.flavio);
    const lider = nums.lula > nums.flavio ? "Lula" : nums.flavio > nums.lula ? "Flávio" : "";
    const outroCand = lider === "Lula" ? "Flávio" : "Lula";
    const pct = (v: number) => nums.aptos ? (100 * v / nums.aptos) : 0;
    const perc = st.percentis_diferenca;
    let maisApertada = 0; while (maisApertada < 100 && perc[maisApertada + 1] < dif) maisApertada++;
    const mediaDif = Math.abs(st.media.lula - st.media.flavio);
    const onde = modo === "secao" ? `Zona ${zona} · Seção ${secao}${atual.agregadaDe ? ` (agregada à seção ${atual.agregadaDe})` : ""}` : "Escola inteira";
    const link = `${SITE}/urna${modo === "secao" ? `?u=${uf}-${cd}-${zona}-${secao}` : `?e=${uf}-${cd}-${escola}`}${temT2 ? `&t=${turno}` : ""}`;
    const hoje = !temT2 && agora && agora < FECHAMENTO_2T && agora > FECHAMENTO_2T - 20 * 3600e3 ? " Hoje é o 2º turno: dá para votar até as 17h." : "";
    const quem = modo === "secao" ? "Na minha urna" : "Na minha escola";
    const pessoas = (n: number) => n === 1 ? "1 pessoa ficou em casa" : `${fmt(n)} pessoas ficaram em casa`;
    const o = outro.nums;
    const difO = o ? Math.abs(o.lula - o.flavio) : 0, liderO = o ? (o.lula > o.flavio ? "Lula" : o.flavio > o.lula ? "Flávio" : "") : "";
    const verbo = outroTurno === 1 ? "tinha ficado" : "ficou", empateV = outroTurno === 1 ? "tinha dado empate" : "deu empate";
    const comparacao = o ? ` No ${outroTurno}º turno, ${liderO ? `${liderO} ${verbo} na frente por ${difO === 1 ? "1 voto" : fmt(difO) + " votos"}` : empateV} e ${pessoas(o.abstencao)}.` : "";
    const mensagem = (lider
      ? `${quem}, no ${st.eleicao}, a diferença entre ${lider} e ${outroCand} foi de ${dif === 1 ? "1 voto" : fmt(dif) + " votos"}. ${pessoas(nums.abstencao)}.`
      : `${quem}, no ${st.eleicao}, Lula e Flávio empataram. ${pessoas(nums.abstencao)}.`) + comparacao + hoje + `\nConfere a sua: ${link}`;
    const copiar = async () => {
      try { await navigator.clipboard.writeText(mensagem); }
      catch { const ta = document.createElement("textarea"); ta.value = mensagem; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    };
    const virou = !!(o && lider && liderO && lider !== liderO);
    corpo = (
      <div className="panel resultado" ref={resultadoRef} aria-live="polite">
        <div className="onde"><b>{onde}</b><span className="small muted">{local ? `${local[0]}${local[1] ? " · " + local[1] : ""}${local[2] ? " · " + local[2] : ""} · ` : ""}{titulo(m.nome)} ({uf})</span></div>
        {temT2 && (
          <div className="abas turnos" role="tablist" aria-label="Turno">
            {turnos.map((t) => <button key={t} type="button" role="tab" aria-selected={turno === t} onClick={() => setTurno(t)}>{t}º turno</button>)}
          </div>
        )}
        {atual.agregadaDe > 0 && <p className="nota">Esta seção vota junto com a seção {atual.agregadaDe}: o TSE divulga os votos das duas somados nela. Os números abaixo são dessa urna compartilhada.</p>}
        {modo === "escola" && <p className="nota">Soma de {atual.n} seções desta escola.</p>}
        <span className="rotulo">Diferença entre {lider ? `${lider} e ${outroCand}` : "Lula e Flávio"} {modo === "secao" ? "nesta urna" : "nesta escola"}, no {st.eleicao}</span>
        <b className="grande">{dif === 0 ? "Empate" : dif === 1 ? "1 voto" : `${fmt(dif)} votos`}</b>
        <span className="sub">{lider ? `${lider} na frente.` : "Empate. Um único voto a mais decidiria esta urna."}{dif > 0 && modo === "secao" && ` Mais apertada que ${maisApertada}% das urnas do Brasil.`}</span>
        <div className="barra" role="img" aria-label={`Lula ${pct(nums.lula).toFixed(0)}%, Flávio ${pct(nums.flavio).toFixed(0)}%, outros e brancos ou nulos ${pct(nums.outros + nums.branco_nulo).toFixed(0)}%, ficaram em casa ${pct(nums.abstencao).toFixed(0)}% dos aptos`}>
          <i style={{ width: `${pct(nums.lula)}%`, background: "var(--lula)" }} /><i style={{ width: `${pct(nums.flavio)}%`, background: "var(--flavio)" }} /><i style={{ width: `${pct(nums.outros + nums.branco_nulo)}%`, background: "var(--ink-3)" }} />
        </div>
        <div className="grade">
          <div className="cx"><b className="lula">{fmt(nums.lula)}</b><span>Lula{o ? ` · ${outroTurno}º turno: ${fmt(o.lula)}` : ""}</span></div>
          <div className="cx"><b className="flavio">{fmt(nums.flavio)}</b><span>Flávio{o ? ` · ${outroTurno}º turno: ${fmt(o.flavio)}` : ""}</span></div>
          {turno === 1 && <div className="cx"><b>{fmt(nums.outros)}</b><span>outros candidatos</span></div>}
          <div className="cx"><b>{fmt(nums.branco_nulo)}</b><span>branco ou nulo{o ? ` · ${outroTurno}º turno: ${fmt(o.branco_nulo)}` : ""}</span></div>
          <div className="cx larga"><b className="ouro">{fmt(nums.abstencao)}</b><span>ficaram em casa, de {fmt(nums.aptos)} que podiam votar{nums.abstencao > dif && dif > 0 ? ". Mais gente do que a diferença." : ""}{o ? `. No ${outroTurno}º turno, ${fmt(o.abstencao)} ficaram em casa.` : ""}</span></div>
        </div>
        {o && <p className="nota">{virou ? `Esta urna virou: ${liderO} estava na frente no ${outroTurno}º turno e ${lider} ficou na frente no ${turno}º.` : `No ${outroTurno}º turno a diferença foi de ${difO === 1 ? "1 voto" : fmt(difO) + " votos"}${liderO ? `, com ${liderO} na frente` : ", empate"}.`}</p>}
        <p className="msg" aria-label="Mensagem para compartilhar">{mensagem.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</p>
        <div className="botoes">
          <a className="btn zap" href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer">Mandar no WhatsApp</a>
          <button className="btn" type="button" onClick={copiar}>{copiado ? "Copiado!" : "Copiar a mensagem"}</button>
          <button className="btn" type="button" onClick={limpar}>Ver outra urna</button>
        </div>
        <p className="small muted">A urna média do Brasil no {st.eleicao} teve diferença de {fmt(mediaDif)} votos e {fmt(st.media.abstencao)} pessoas em casa.</p>
      </div>
    );
  }

  const s1 = stats[1];
  return (
    <main className="wrap urna">
      <header className="head">
        <span className="eyebrow">Dados oficiais do TSE, urna por urna</span>
        <h1>Por quantos votos a <i>sua urna</i> foi decidida?</h1>
        <p className="muted">
          {temT2 && stats[2] ? `O TSE publicou o resultado dos dois turnos urna por urna (${fmt(stats[2].total_urnas)} urnas no 2º turno). ` : s1 ? `O TSE publicou o resultado do ${s1.eleicao} urna por urna: ${fmt(s1.total_urnas)} urnas. ` : ""}
          Escolha a sua e veja quantos votaram em cada um, quantos ficaram em casa e qual foi a diferença.
          {!temT2 && " O 2º turno entra aqui assim que o TSE divulgar a votação por seção, alguns dias depois da eleição."}
        </p>
      </header>

      <div className="panel form" id="form-urna">
        {aviso && <p className="nota" role="alert">{aviso}</p>}
        {temT2 && (
          <div className="abas" role="tablist" aria-label="Turno">
            {turnos.map((t) => <button key={t} type="button" role="tab" aria-selected={turno === t} onClick={() => setTurno(t)}>{t}º turno</button>)}
          </div>
        )}
        <label>Estado
          <select value={uf} onChange={(e) => { setUf(e.target.value); setCidade(""); setCd(""); setMun({}); setZona(""); setSecao(""); setEscola(""); }} disabled={!idx}>
            <option value="">{idx ? "Escolha o estado" : "Carregando…"}</option>
            {idx?.ufs.map((u) => <option key={u.sg} value={u.sg}>{u.nome}</option>)}
          </select>
        </label>
        <label className="cidade">Cidade
          <input type="text" value={cidade} disabled={!uf} placeholder={uf ? "Digite o nome da cidade" : "Escolha o estado primeiro"} autoComplete="off"
            onChange={(e) => { setCidade(e.target.value); setCd(""); setMun({}); setZona(""); setSecao(""); setEscola(""); setSugestoesAbertas(true); }}
            onFocus={() => setSugestoesAbertas(true)} onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter" && sugestoes.length) { e.preventDefault(); escolherCidade(sugestoes[0][0], sugestoes[0][1]); } }} />
          {sugestoesAbertas && sugestoes.length > 0 && (
            <ul className="sug" role="listbox">{sugestoes.map(([c, n]) => <li key={c} role="option" aria-selected={false} onMouseDown={() => escolherCidade(c, n)}>{titulo(n)}</li>)}</ul>
          )}
        </label>
        {carregando && <p className="small muted">Carregando as seções…</p>}
        {m && (
          <>
            <div className="abas" role="tablist">
              <button type="button" role="tab" aria-selected={modo === "secao"} onClick={() => setModo("secao")}>Sei minha zona e seção</button>
              <button type="button" role="tab" aria-selected={modo === "escola"} onClick={() => setModo("escola")}>Só lembro a escola</button>
            </div>
            {modo === "secao" ? (
              <div className="dupla">
                <label>Zona
                  <select value={zona} onChange={(e) => { setZona(e.target.value); setSecao(""); }}><option value="">Zona</option>{zonas.map((z) => <option key={z} value={z}>{z}</option>)}</select>
                </label>
                <label>Seção
                  <select value={secao} disabled={!zona} onChange={(e) => setSecao(e.target.value)}><option value="">Seção</option>{(m.zonas[zona] ?? []).map((l) => <option key={l[0]} value={l[0]}>{l[0]}</option>)}</select>
                </label>
              </div>
            ) : (
              <label>Escola ou local de votação
                <select value={escola} onChange={(e) => setEscola(e.target.value)}><option value="">Escolha o local</option>{escolas.map((e) => <option key={e.id} value={e.id}>{titulo(e.nome)}{e.bairro ? ` · ${titulo(e.bairro)}` : ""} (zona {e.zona})</option>)}</select>
              </label>
            )}
            <p className="small muted">A zona e a seção estão no seu título de eleitor ou no aplicativo e-Título.</p>
          </>
        )}
      </div>

      {corpo}

      <div className="panel info">
        {!temT2 && <p className="destaque"><b>Domingo, 25 de outubro, das 8h às 17h (horário de Brasília).</b> Serve qualquer documento oficial com foto; o título não é obrigatório. Em muitas cidades o ônibus é de graça no dia da eleição: confira na sua. Você pode levar sua família no seu carro (Lei 6.091/1974, art. 5º). Celular fica com o mesário.</p>}
        {turnos.map((t) => { const s = stats[t]; return s ? <p key={t}><b>A urna média do Brasil no {s.eleicao}:</b> {fmt(s.media.aptos)} eleitores, {fmt(s.media.abstencao)} ficaram em casa, Flávio {fmt(s.media.flavio)}, Lula {fmt(s.media.lula)}{t === 1 ? `, outros ${fmt(s.media.outros)}` : ""}, branco e nulo {fmt(s.media.branco_nulo)}. Diferença de {fmt(Math.abs(s.media.lula - s.media.flavio))} votos. {fmt(s.empates)} urnas empataram; em {fmt(s.diferenca_ate_5)} a diferença foi de 5 votos ou menos; em {s.abstencao_maior_que_diferenca.pct}% das urnas, quem ficou em casa era mais gente que a diferença.</p> : null; })}
        <p className="small muted">Fonte: TSE, dados abertos, "Votação por seção eleitoral" e "Eleitorado por local de votação", presidente{turnos.map((t) => stats[t] ? `, ${stats[t]!.eleicao} (${stats[t]!.data})` : "").join("")}. Sem as seções do exterior{s1 ? `: soma do 1º turno Flávio ${fmt(s1.total_flavio)}, Lula ${fmt(s1.total_lula)}` : ""}. Esta página não pede nome nem telefone e não guarda nada.</p>
      </div>
      <Credito />
    </main>
  );
}
