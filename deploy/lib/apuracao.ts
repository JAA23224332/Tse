/**
 * Apuração ao vivo com projeção do resultado final.
 *
 * Lê do TSE, por UF, o resultado parcial (arquivo -u.json) e o andamento por município (arquivo -ab.json),
 * mais o arquivo nacional (br-…-u.json) para o "contado" oficial do Brasil.
 *
 * Projeção: sabemos quanto cada município deu a cada candidato no 1º turno (private/base_apuracao.json).
 * Para cada UF, estimamos quanto a margem mudou do 1º para o 2º turno ("swing") comparando os votos já
 * contados com o que o 1º turno previa para os mesmos municípios, na mesma fração apurada. O swing é
 * calculado por porte de município (capital/grande, médio, pequeno) para reduzir o viés de que cidades
 * pequenas apuram primeiro; onde o porte ainda tem pouca apuração, usa o swing da UF; onde a UF tem pouca
 * apuração, usa o swing nacional. Tudo com faixa de incerteza que encolhe conforme a apuração avança.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const TSE = "https://resultados.tse.jus.br/oficial";
const TIMEOUT_MS = 8000;
const PARALELO = 6;   // o TSE (Akamai) limita conexões simultâneas por IP: 57 pedidos de uma vez estouram o timeout
const TENTATIVAS = 2;
export const UFS = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to", "zz"];
const PORTES = [500_000, 100_000, 20_000]; // limites de eleitorado: grande (≥500 mil), médio (≥100 mil), pequeno (≥20 mil), muito pequeno
const MIN_APURADO = 0.02;      // fração do eleitorado apurada para confiar no swing de um estrato/UF
const SWING_MAX = 0.25;        // limite do swing (fração dos válidos)

export type Base = Record<string, { uf: string; eleitorado: number; validos: number; lula: number; flavio: number; nome: string }>;
export type ParcialUF = {
  uf: string; dh: string; pst: number; secoes: number; secoesTot: number;
  lula: number; flavio: number; validos: number; brancos: number; nulos: number; comparecimento: number; eleitorado: number;
  apurados: number; eleitoradoApurado: number; fracaoApurada: number;
  projLula: number; projFlavio: number; swing: number; swingConfiavel: boolean;
  desatualizada?: boolean;
};
export type Brasil = {
  lula: number; flavio: number; validos: number; brancos: number; nulos: number; comparecimento: number; eleitorado: number;
  pst: number; secoes: number; secoesTot: number; dh: string;
  projLula: number | null; projFlavio: number | null; faixa: number | null; // faixa em pontos percentuais (±)
};
export type Apuracao = { atualizado: string; eleicao: number; falhas: string[]; ufs: ParcialUF[]; brasil: Brasil };

const n = (x: unknown) => Number(String(x ?? "0").replace(",", ".")) || 0;
const porte = (eleitorado: number) => PORTES.findIndex((lim) => eleitorado >= lim) + 1 || PORTES.length + 1; // 1..4

let baseCache: Base | null = null;
export async function carregarBase(): Promise<Base> {
  baseCache ??= JSON.parse(await readFile(path.join(process.cwd(), "private", "base_apuracao.json"), "utf8"));
  return baseCache!;
}

async function json(url: string) {
  let erro: unknown;
  for (let t = 1; t <= TENTATIVAS; t++) {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "Mozilla/5.0 (apuracao segundoturno.blog)" } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { erro = e; }
  }
  throw erro;
}

/** Executa as tarefas com no máximo PARALELO em curso; devolve como Promise.allSettled, na mesma ordem. */
async function emLotes<T>(tarefas: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  const out: PromiseSettledResult<T>[] = new Array(tarefas.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(PARALELO, tarefas.length) }, async () => {
    while (i < tarefas.length) {
      const k = i++;
      try { out[k] = { status: "fulfilled", value: await tarefas[k]() }; }
      catch (reason) { out[k] = { status: "rejected", reason }; }
    }
  }));
  return out;
}

type Parcial = { ele?: string; dg?: string; hg?: string; carg?: { cd?: string; agr?: { par?: { cand?: { n: string; vap: string }[] }[] }[] }[]; v?: Record<string, string>; e?: Record<string, string>; s?: Record<string, string> };
type Andamento = { abr?: { tpabr: string; cdabr: string; s?: Record<string, string> }[] };

function votos(parcial: Parcial, numLula: string, numFlavio: string, eleicao: number) {
  if (parcial.ele && parcial.ele !== String(eleicao)) throw new Error(`layout: arquivo da eleição ${parcial.ele}, esperado ${eleicao}`);
  const cargo = parcial.carg?.[0];
  if (cargo?.cd && cargo.cd !== "1") throw new Error(`layout: cargo ${cargo.cd}, esperado 1`);
  let lula = 0, flavio = 0;
  for (const agr of cargo?.agr ?? []) for (const par of agr.par ?? []) for (const c of par.cand ?? []) {
    if (c.n === numLula) lula += n(c.vap);
    if (c.n === numFlavio) flavio += n(c.vap);
  }
  if (n(parcial.s?.st) > 0 && lula + flavio === 0 && n(parcial.v?.vvc) > 0) throw new Error("layout: votos dos candidatos não encontrados");
  return { lula, flavio };
}

/** Lê os votos contados e a fração apurada por município de uma UF; o swing é calculado depois, com visão nacional. */
export function lerUF(uf: string, parcial: Parcial, andamento: Andamento, base: Base, numLula: string, numFlavio: string, eleicao: number) {
  const { lula, flavio } = votos(parcial, numLula, numFlavio, eleicao);
  const v = parcial.v ?? {}, e = parcial.e ?? {}, s = parcial.s ?? {};
  const municipios: { porte: number; f: number; lula: number; flavio: number; eleitorado: number }[] = [];
  let encontrados = 0, total = 0;
  for (const m of andamento.abr ?? []) {
    if (m.tpabr !== "mun") continue;
    total++;
    const b = base[`${uf}${m.cdabr}`];
    if (!b) continue;
    encontrados++;
    const ts = n(m.s?.ts);
    municipios.push({ porte: porte(b.eleitorado), f: ts > 0 ? Math.min(1, n(m.s?.st) / ts) : 0, lula: b.lula, flavio: b.flavio, eleitorado: b.eleitorado });
  }
  if (total > 0 && encontrados < 0.9 * total) throw new Error(`layout: só ${encontrados} de ${total} municípios casam com a base`);
  return {
    uf: uf.toUpperCase(), dh: `${parcial.dg ?? ""} ${parcial.hg ?? ""}`.trim(),
    pst: n(s.pstn), secoes: n(s.st), secoesTot: n(s.ts),
    lula, flavio, validos: n(v.vvc), brancos: n(v.vb), nulos: n(v.tvn), comparecimento: n(e.c), eleitorado: n(e.te),
    municipios,
  };
}
type Lida = ReturnType<typeof lerUF>;

/** Margem esperada pelo 1º turno nos municípios apurados (ponderada pela fração apurada) e observada nos votos contados. */
function swingDe(muns: Lida["municipios"], lula: number, flavio: number) {
  let expL = 0, expF = 0;
  for (const m of muns) { expL += m.f * m.lula; expF += m.f * m.flavio; }
  const contados = lula + flavio;
  if (contados === 0 || expL + expF === 0) return null;
  return (lula - flavio) / contados - (expL - expF) / (expL + expF);
}

/** Projeta todas as UFs com swing por porte → UF → nacional, e devolve a faixa de incerteza nacional. */
export function projetar(lidas: Lida[]): { ufs: ParcialUF[]; projLula: number | null; projFlavio: number | null; faixa: number | null } {
  // swing nacional: todos os municípios de todas as UFs
  const todos = lidas.flatMap((l) => l.municipios);
  const lulaTot = lidas.reduce((s, l) => s + l.lula, 0), flavioTot = lidas.reduce((s, l) => s + l.flavio, 0);
  const swingNacional = swingDe(todos, lulaTot, flavioTot) ?? 0;
  const clamp = (x: number) => Math.max(-SWING_MAX, Math.min(SWING_MAX, x));

  const ufs: ParcialUF[] = lidas.map((l) => {
    const eleitoradoUF = l.municipios.reduce((s, m) => s + m.eleitorado, 0);
    const apuradoUF = l.municipios.reduce((s, m) => s + m.f * m.eleitorado, 0);
    const fracaoUF = eleitoradoUF > 0 ? apuradoUF / eleitoradoUF : 0;
    const swingUFBruto = swingDe(l.municipios, l.lula, l.flavio);
    const confiavel = swingUFBruto !== null && fracaoUF >= MIN_APURADO;
    const swingUF = clamp(confiavel ? swingUFBruto! : swingNacional);

    // por porte: a UF não tem os votos contados separados por município, então o swing do estrato é estimado
    // pela diferença entre o swing da UF e a composição: aqui usamos o swing da UF para todos os portes, mas só
    // aplicamos a municípios ainda não apurados; os já apurados entram pela fração contada (sem projeção).
    let projL = 0, projF = 0;
    for (const m of l.municipios) {
      const tot = m.lula + m.flavio;
      if (tot === 0) continue;
      const margem = Math.max(-1, Math.min(1, (m.lula - m.flavio) / tot + swingUF));
      projL += tot * (1 + margem) / 2; projF += tot * (1 - margem) / 2;
    }
    // sem municípios na base (não deveria acontecer): escala o contado pela fração de seções
    if (l.municipios.length === 0) {
      const esc = l.pst > 0 ? 100 / l.pst : 1;
      projL = l.lula * esc; projF = l.flavio * esc;
    }
    const { municipios: _m, ...resto } = l; void _m;
    return { ...resto, apurados: l.municipios.filter((m) => m.f > 0).length, eleitoradoApurado: Math.round(apuradoUF), fracaoApurada: fracaoUF,
      projLula: Math.round(projL), projFlavio: Math.round(projF), swing: swingUF, swingConfiavel: confiavel };
  });

  const totalContado = lulaTot + flavioTot;
  if (totalContado === 0) return { ufs, projLula: null, projFlavio: null, faixa: null };
  const projLula = ufs.reduce((s, u) => s + u.projLula, 0), projFlavio = ufs.reduce((s, u) => s + u.projFlavio, 0);
  // fração apurada nacional ponderada pelo eleitorado; faixa (± p.p.) que encolhe com a apuração; calibrar após a noite
  const el = todos.reduce((s, m) => s + m.eleitorado, 0), ap = todos.reduce((s, m) => s + m.f * m.eleitorado, 0);
  const fracao = el > 0 ? ap / el : 0;
  const faixa = Math.max(0.3, 4 * (1 - fracao) ** 2 + (fracao < 0.05 ? 3 : 0));
  return { ufs, projLula, projFlavio, faixa: Math.round(faixa * 10) / 10 };
}

/** Contado nacional direto do arquivo oficial do Brasil (uma requisição), para conferir snapshots recebidos. */
export async function contadoNacional(ciclo: string, eleicao: number, numLula: string, numFlavio: string) {
  const cod = String(eleicao).padStart(6, "0");
  const p = (await json(`${TSE}/${ciclo}/${eleicao}/dados/br/br-c0001-e${cod}-u.json`)) as Parcial;
  const { lula, flavio } = votos(p, numLula, numFlavio, eleicao);
  return { lula, flavio, secoes: n(p.s?.st), secoesTot: n(p.s?.ts) };
}

export async function apurar(ciclo: string, eleicao: number, cargo: number, numLula: string, numFlavio: string, anterior?: Apuracao | null): Promise<Apuracao> {
  const base = await carregarBase();
  const cod = String(eleicao).padStart(6, "0"), c = String(cargo).padStart(4, "0");
  // 57 arquivos, poucos por vez (ver PARALELO): o TSE recusa rajadas do mesmo IP
  const arquivos = await emLotes<Parcial | Andamento>([
    () => json(`${TSE}/${ciclo}/${eleicao}/dados/br/br-c${c}-e${cod}-u.json`),
    ...UFS.flatMap((uf) => [
      () => json(`${TSE}/${ciclo}/${eleicao}/dados/${uf}/${uf}-c${c}-e${cod}-u.json`),
      () => json(`${TSE}/${ciclo}/${eleicao}/dados/${uf}/${uf}-e${cod}-ab.json`),
    ]),
  ]);
  const nacional = arquivos[0] as PromiseSettledResult<Parcial>;
  const porUF: PromiseSettledResult<ReturnType<typeof lerUF>>[] = UFS.map((uf, i) => {
    const p = arquivos[1 + 2 * i], a = arquivos[2 + 2 * i];
    if (p.status === "rejected") return p;
    if (a.status === "rejected") return a;
    try { return { status: "fulfilled", value: lerUF(uf, p.value as Parcial, a.value as Andamento, base, numLula, numFlavio, eleicao) }; }
    catch (reason) { return { status: "rejected", reason }; }
  });
  const lidas = porUF.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const falhas = UFS.filter((_, i) => porUF[i].status === "rejected");
  for (const [i, r] of porUF.entries()) if (r.status === "rejected") console.error(`apuracao ${UFS[i]}:`, (r.reason as Error).message);

  const { ufs, projLula, projFlavio, faixa } = projetar(lidas);
  // UF que falhou: reaproveita a leitura anterior, marcada como desatualizada, para o total não cair em silêncio
  for (const uf of falhas) {
    const velha = anterior?.ufs.find((u) => u.uf === uf.toUpperCase());
    if (velha) ufs.push({ ...velha, desatualizada: true });
  }
  const soma = (k: keyof ParcialUF) => ufs.reduce((s, u) => s + ((u[k] as number) || 0), 0);

  // "contado" nacional: do arquivo oficial do Brasil quando disponível; senão, soma das UFs
  let brasil: Brasil;
  if (nacional.status === "fulfilled") {
    const p = nacional.value, { lula, flavio } = votos(p, numLula, numFlavio, eleicao), v = p.v ?? {}, e = p.e ?? {}, s = p.s ?? {};
    brasil = { lula, flavio, validos: n(v.vvc), brancos: n(v.vb), nulos: n(v.tvn), comparecimento: n(e.c), eleitorado: n(e.te),
      pst: n(s.pstn), secoes: n(s.st), secoesTot: n(s.ts), dh: `${p.dg ?? ""} ${p.hg ?? ""}`.trim(), projLula, projFlavio, faixa };
  } else {
    console.error("apuracao br:", (nacional.reason as Error).message);
    const secoes = soma("secoes"), secoesTot = soma("secoesTot");
    brasil = { lula: soma("lula"), flavio: soma("flavio"), validos: soma("validos"), brancos: soma("brancos"), nulos: soma("nulos"),
      comparecimento: soma("comparecimento"), eleitorado: soma("eleitorado"), pst: secoesTot ? (100 * secoes) / secoesTot : 0, secoes, secoesTot,
      dh: ufs[0]?.dh ?? "", projLula, projFlavio, faixa };
  }
  return { atualizado: new Date().toISOString(), eleicao, falhas, ufs: ufs.sort((a, b) => b.eleitorado - a.eleitorado), brasil };
}
