"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Credito } from "@/app/credito";
import "./urna.css";

/** "Por quantos votos a sua urna foi decidida?": seção por seção, com mensagem pronta para o WhatsApp. Dados estáticos em /urna/data. */
type Indice = { ufs: { sg: string; nome: string; municipios: [string, string][] }[]; turno: number };
type Stats = { eleicao: string; data: string; total_urnas: number; media: Record<string, number>; empates: number; diferenca_ate_5: number;
  abstencao_maior_que_diferenca: { urnas: number; pct: number }; mediana_diferenca: number; total_lula: number; total_flavio: number; percentis_diferenca: number[] };
type Linha = [number, string, number, number, number, number, number, number, number]; // secao, local, aptos, lula, flavio, outros, branco_nulo, abstencao, principal
type Mun = { uf: string; cd: string; nome: string; locais: Record<string, [string, string, string]>; zonas: Record<string, Linha[]> };
type Numeros = { aptos: number; lula: number; flavio: number; outros: number; branco_nulo: number; abstencao: number };

const SITE = "https://segundoturno.blog";
const FECHAMENTO_2T = Date.parse("2026-10-25T20:00:00Z"); // 17h de Brasília
const fmt = (n: number) => n.toLocaleString("pt-BR");
const sem = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(\/-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
const soma = (ls: Linha[]): Numeros => ls.reduce((a, l) => ({ aptos: a.aptos + l[2], lula: a.lula + l[3], flavio: a.flavio + l[4], outros: a.outros + l[5], branco_nulo: a.branco_nulo + l[6], abstencao: a.abstencao + l[7] }),
  { aptos: 0, lula: 0, flavio: 0, outros: 0, branco_nulo: 0, abstencao: 0 });
const cache = new Map<string, Promise<Mun>>();
const carregarMun = (uf: string, cd: string) => {
  const k = `${uf}/${cd}`;
  if (!cache.has(k)) cache.set(k, fetch(`/urna/data/mun/${k}.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Mun>; }));
  return cache.get(k)!;
};

export function Urna() {
  const [idx, setIdx] = useState<Indice | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");          // texto digitado
  const [cd, setCd] = useState("");                  // município escolhido
  const [mun, setMun] = useState<Mun | null>(null);
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

  // índice, estatísticas e link direto (?u=UF-CD-ZONA-SECAO ou ?e=UF-CD-ZONA-LOCAL)
  useEffect(() => {
    (async () => {
      try {
        const [i, s] = await Promise.all([fetch("/urna/data/index.json").then((r) => r.json()), fetch("/urna/data/stats.json").then((r) => r.json())]);
        setIdx(i); setStats(s);
        const q = new URLSearchParams(window.location.search);
        const u = q.get("u"), e = q.get("e");
        const p = (u ?? e ?? "").split("-");
        if (p.length === 4 && /^[A-Z]{2}$/.test(p[0])) {
          const m = await carregarMun(p[0], p[1]).catch(() => null);
          const existe = m && m.zonas[p[2]] && (u ? m.zonas[p[2]].some((l) => String(l[0]) === p[3]) : !!m.locais[`${p[2]}-${p[3]}`]);
          if (!m || !existe) { setAviso("Não encontramos essa urna. Escolha abaixo."); return; }
          setUf(p[0]); setCd(p[1]); setCidade(m.nome); setMun(m); setZona(p[2]);
          if (u) { setModo("secao"); setSecao(p[3]); } else { setModo("escola"); setEscola(`${p[2]}-${p[3]}`); }
        }
      } catch { setAviso("Não foi possível carregar a lista de cidades. Recarregue a página."); }
    })();
  }, []);

  const estado = idx?.ufs.find((x) => x.sg === uf);
  const sugestoes = useMemo(() => {
    if (!estado || !cidade || cd) return [];
    const q = sem(cidade);
    return estado.municipios.filter(([, n]) => sem(n).includes(q)).slice(0, 10);
  }, [estado, cidade, cd]);

  async function escolherCidade(c: string, nome: string) {
    setCidade(nome); setCd(c); setSugestoesAbertas(false); setZona(""); setSecao(""); setEscola(""); setMun(null); setAviso("");
    setCarregando(true);
    try { setMun(await carregarMun(uf, c)); } catch { setAviso("Não foi possível carregar essa cidade. Tente de novo."); }
    finally { setCarregando(false); }
  }
  function limpar() {
    setUf(""); setCidade(""); setCd(""); setMun(null); setZona(""); setSecao(""); setEscola(""); setAviso("");
    history.replaceState(null, "", location.pathname);
    document.getElementById("form-urna")?.scrollIntoView({ behavior: "smooth" });
  }

  // resultado
  const zonas = mun ? Object.keys(mun.zonas).sort((a, b) => Number(a) - Number(b)) : [];
  const linhaSecao = mun && zona && secao ? mun.zonas[zona]?.find((l) => String(l[0]) === secao) ?? null : null;
  const agregadaDe = linhaSecao && linhaSecao[8] ? linhaSecao[8] : 0;
  const linhaBase = agregadaDe && mun ? mun.zonas[zona]?.find((l) => l[0] === agregadaDe) ?? linhaSecao : linhaSecao;
  const escolas = useMemo(() => mun ? Object.entries(mun.locais).map(([id, [nome, end, bairro]]) => ({ id, nome, end, bairro, zona: id.split("-")[0] })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : [], [mun]);
  const linhasEscola = mun && modo === "escola" && escola ? (mun.zonas[escola.split("-")[0]] ?? []).filter((l) => l[1] === escola && !l[8]) : [];
  const nums: Numeros | null = modo === "secao" ? (linhaBase ? soma([linhaBase]) : null) : (linhasEscola.length ? soma(linhasEscola) : null);
  const localId = modo === "secao" ? linhaBase?.[1] : escola;
  const local = mun && localId ? mun.locais[localId] : null;
  const pronto = !!(mun && nums && stats);

  useEffect(() => {
    if (!pronto || !mun) return;
    const u = modo === "secao" ? `?u=${uf}-${cd}-${zona}-${secao}` : `?e=${uf}-${cd}-${escola}`;
    history.replaceState(null, "", location.pathname + u);
    resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pronto, modo, uf, cd, zona, secao, escola, mun]);

  let corpo: React.ReactNode = null;
  if (pronto && nums && stats && mun) {
    const dif = Math.abs(nums.lula - nums.flavio);
    const lider = nums.lula > nums.flavio ? "Lula" : nums.flavio > nums.lula ? "Flávio" : "";
    const outro = lider === "Lula" ? "Flávio" : "Lula";
    const pct = (v: number) => nums.aptos ? (100 * v / nums.aptos) : 0;
    const perc = stats.percentis_diferenca; // perc[k] = diferença no percentil k
    let maisApertada = 0; while (maisApertada < 100 && perc[maisApertada + 1] < dif) maisApertada++;
    const mediaDif = Math.abs(stats.media.lula - stats.media.flavio);
    const onde = modo === "secao" ? `Zona ${zona} · Seção ${secao}${agregadaDe ? ` (agregada à seção ${agregadaDe})` : ""}` : "Escola inteira";
    const link = `${SITE}/urna${modo === "secao" ? `?u=${uf}-${cd}-${zona}-${secao}` : `?e=${uf}-${cd}-${escola}`}`;
    const hoje = agora && agora < FECHAMENTO_2T && agora > FECHAMENTO_2T - 20 * 3600e3 ? " Hoje é o 2º turno: dá para votar até as 17h." : "";
    const quem = modo === "secao" ? "Na minha urna" : "Na minha escola";
    const pessoas = nums.abstencao === 1 ? "1 pessoa ficou em casa" : `${fmt(nums.abstencao)} pessoas ficaram em casa`;
    const mensagem = (lider
      ? `${quem}, no ${stats.eleicao}, a diferença entre ${lider} e ${outro} foi de ${dif === 1 ? "1 voto" : fmt(dif) + " votos"}. ${pessoas}.`
      : `${quem}, no ${stats.eleicao}, Lula e Flávio empataram. ${pessoas}.`) + hoje + `\nConfere a sua: ${link}`;
    const copiar = async () => {
      try { await navigator.clipboard.writeText(mensagem); }
      catch { const t = document.createElement("textarea"); t.value = mensagem; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    };
    corpo = (
      <div className="panel resultado" ref={resultadoRef} aria-live="polite">
        <div className="onde"><b>{onde}</b><span className="small muted">{local ? `${local[0]}${local[1] ? " · " + local[1] : ""}${local[2] ? " · " + local[2] : ""} · ` : ""}{titulo(mun.nome)} ({uf})</span></div>
        {agregadaDe > 0 && <p className="nota">Esta seção vota junto com a seção {agregadaDe}: o TSE divulga os votos das duas somados nela. Os números abaixo são dessa urna compartilhada.</p>}
        {modo === "escola" && <p className="nota">Soma de {linhasEscola.length} seções desta escola.</p>}
        <span className="rotulo">Diferença entre {lider ? `${lider} e ${outro}` : "Lula e Flávio"} {modo === "secao" ? "nesta urna" : "nesta escola"}, no {stats.eleicao}</span>
        <b className="grande">{dif === 0 ? "Empate" : dif === 1 ? "1 voto" : `${fmt(dif)} votos`}</b>
        <span className="sub">{lider ? `${lider} na frente.` : "Empate. Um único voto a mais decidiria esta urna."}{dif > 0 && modo === "secao" && ` Mais apertada que ${maisApertada}% das urnas do Brasil.`}</span>
        <div className="barra" role="img" aria-label={`Lula ${pct(nums.lula).toFixed(0)}%, Flávio ${pct(nums.flavio).toFixed(0)}%, outros e brancos ou nulos ${pct(nums.outros + nums.branco_nulo).toFixed(0)}%, ficaram em casa ${pct(nums.abstencao).toFixed(0)}% dos aptos`}>
          <i style={{ width: `${pct(nums.lula)}%`, background: "var(--lula)" }} /><i style={{ width: `${pct(nums.flavio)}%`, background: "var(--flavio)" }} /><i style={{ width: `${pct(nums.outros + nums.branco_nulo)}%`, background: "var(--ink-3)" }} />
        </div>
        <div className="grade">
          <div className="cx"><b className="lula">{fmt(nums.lula)}</b><span>Lula</span></div>
          <div className="cx"><b className="flavio">{fmt(nums.flavio)}</b><span>Flávio</span></div>
          <div className="cx"><b>{fmt(nums.outros)}</b><span>outros candidatos</span></div>
          <div className="cx"><b>{fmt(nums.branco_nulo)}</b><span>branco ou nulo</span></div>
          <div className="cx larga"><b className="ouro">{fmt(nums.abstencao)}</b><span>ficaram em casa, de {fmt(nums.aptos)} que podiam votar{nums.abstencao > dif && dif > 0 ? ". Mais gente do que a diferença." : ""}</span></div>
        </div>
        <p className="msg" aria-label="Mensagem para compartilhar">{mensagem.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</p>
        <div className="botoes">
          <a className="btn zap" href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer">Mandar no WhatsApp</a>
          <button className="btn" type="button" onClick={copiar}>{copiado ? "Copiado!" : "Copiar a mensagem"}</button>
          <button className="btn" type="button" onClick={limpar}>Ver outra urna</button>
        </div>
        <p className="small muted">A urna média do Brasil teve diferença de {fmt(mediaDif)} votos e {fmt(stats.media.abstencao)} pessoas em casa.</p>
      </div>
    );
  }

  return (
    <main className="wrap urna">
      <header className="head">
        <span className="eyebrow">Dados oficiais do TSE, urna por urna</span>
        <h1>Por quantos votos a <i>sua urna</i> foi decidida?</h1>
        <p className="muted">{stats ? `O TSE publicou o resultado do ${stats.eleicao} urna por urna: ${fmt(stats.total_urnas)} urnas. ` : ""}Escolha a sua e veja quantos votaram em cada um, quantos ficaram em casa e qual foi a diferença.</p>
      </header>

      <div className="panel form" id="form-urna">
        {aviso && <p className="nota" role="alert">{aviso}</p>}
        <label>Estado
          <select value={uf} onChange={(e) => { setUf(e.target.value); setCidade(""); setCd(""); setMun(null); setZona(""); setSecao(""); setEscola(""); }} disabled={!idx}>
            <option value="">{idx ? "Escolha o estado" : "Carregando…"}</option>
            {idx?.ufs.map((u) => <option key={u.sg} value={u.sg}>{u.nome}</option>)}
          </select>
        </label>
        <label className="cidade">Cidade
          <input type="text" value={cidade} disabled={!uf} placeholder={uf ? "Digite o nome da cidade" : "Escolha o estado primeiro"} autoComplete="off"
            onChange={(e) => { setCidade(e.target.value); setCd(""); setMun(null); setZona(""); setSecao(""); setEscola(""); setSugestoesAbertas(true); }}
            onFocus={() => setSugestoesAbertas(true)} onBlur={() => setTimeout(() => setSugestoesAbertas(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter" && sugestoes.length) { e.preventDefault(); escolherCidade(sugestoes[0][0], sugestoes[0][1]); } }} />
          {sugestoesAbertas && sugestoes.length > 0 && (
            <ul className="sug" role="listbox">{sugestoes.map(([c, n]) => <li key={c} role="option" aria-selected={false} onMouseDown={() => escolherCidade(c, n)}>{titulo(n)}</li>)}</ul>
          )}
        </label>
        {carregando && <p className="small muted">Carregando as seções…</p>}
        {mun && (
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
                  <select value={secao} disabled={!zona} onChange={(e) => setSecao(e.target.value)}><option value="">Seção</option>{(mun.zonas[zona] ?? []).map((l) => <option key={l[0]} value={l[0]}>{l[0]}</option>)}</select>
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
        <p className="destaque"><b>Domingo, 25 de outubro, das 8h às 17h (horário de Brasília).</b> Serve qualquer documento oficial com foto; o título não é obrigatório. Em muitas cidades o ônibus é de graça no dia da eleição: confira na sua. Você pode levar sua família no seu carro (Lei 6.091/1974, art. 5º). Celular fica com o mesário.</p>
        {stats && <p><b>A urna média do Brasil no {stats.eleicao}:</b> {fmt(stats.media.aptos)} eleitores, {fmt(stats.media.abstencao)} ficaram em casa, Flávio {fmt(stats.media.flavio)}, Lula {fmt(stats.media.lula)}, outros {fmt(stats.media.outros)}, branco e nulo {fmt(stats.media.branco_nulo)}. Diferença de {fmt(Math.abs(stats.media.lula - stats.media.flavio))} votos. {fmt(stats.empates)} urnas empataram; em {fmt(stats.diferenca_ate_5)} a diferença foi de 5 votos ou menos; em {stats.abstencao_maior_que_diferenca.pct}% das urnas, quem ficou em casa era mais gente que a diferença.</p>}
        <p className="small muted">Fonte: TSE, dados abertos, "Votação por seção eleitoral" e "Eleitorado por local de votação", presidente, {stats?.eleicao ?? ""} ({stats?.data ?? ""}). Sem as seções do exterior{stats ? `: soma Flávio ${fmt(stats.total_flavio)}, Lula ${fmt(stats.total_lula)}` : ""}. Esta página não pede nome nem telefone e não guarda nada.</p>
      </div>
      <Credito />
    </main>
  );
}
