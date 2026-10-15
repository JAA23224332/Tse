/**
 * Apuração ao vivo com projeção do resultado final.
 *
 * Lê do TSE, por UF, o resultado parcial (arquivo -u.json) e o andamento por município (arquivo -ab.json).
 * Como sabemos quanto cada município deu a cada candidato no 1º turno, estimamos o resultado final assim:
 * para cada UF, supomos que a mudança do 1º para o 2º turno (em pontos) é a mesma em todos os municípios
 * da UF (swing uniforme). Com a fração apurada de cada município, calculamos qual swing reproduz os votos
 * já contados e aplicamos esse swing ao eleitorado inteiro. Isso corrige o viés de que cidades pequenas
 * apuram primeiro.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const TSE = "https://resultados.tse.jus.br/oficial";
export const UFS = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to", "zz"];

export type Base = Record<string, { uf: string; eleitorado: number; validos: number; lula: number; flavio: number; nome: string }>;
export type ParcialUF = {
  uf: string; dh: string; pst: number; secoes: number; secoesTot: number;
  lula: number; flavio: number; validos: number; brancos: number; nulos: number; comparecimento: number; eleitorado: number;
  apurados: number; eleitoradoApurado: number; // municípios/eleitores com seções já totalizadas
  projLula: number; projFlavio: number; swing: number;
};

const n = (x: unknown) => Number(String(x ?? "0").replace(",", ".")) || 0;

let baseCache: Base | null = null;
export async function carregarBase(): Promise<Base> {
  baseCache ??= JSON.parse(await readFile(path.join(process.cwd(), "private", "base_apuracao.json"), "utf8"));
  return baseCache!;
}

async function json(url: string) {
  const r = await fetch(url, { cache: "no-store", headers: { "user-agent": "painel-2turno" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

/** Projeta uma UF a partir do parcial e do andamento por município. */
export function projetarUF(uf: string, parcial: Record<string, unknown>, andamento: Record<string, unknown>, base: Base, numLula: string, numFlavio: string): ParcialUF {
  const cargo = (parcial as { carg?: { agr?: { par?: { cand?: { n: string; vap: string }[] }[] }[] }[] }).carg?.[0];
  let lula = 0, flavio = 0;
  for (const agr of cargo?.agr ?? []) for (const par of agr.par ?? []) for (const c of par.cand ?? []) {
    if (c.n === numLula) lula += n(c.vap);
    if (c.n === numFlavio) flavio += n(c.vap);
  }
  const v = (parcial as { v?: Record<string, string> }).v ?? {};
  const e = (parcial as { e?: Record<string, string> }).e ?? {};
  const s = (parcial as { s?: Record<string, string> }).s ?? {};

  // fração apurada por município (seções totalizadas / seções totais), ponderada pelo eleitorado de 2026
  let expLula = 0, expFlavio = 0, expValidos = 0, totLula = 0, totFlavio = 0, totValidos = 0, apurados = 0, eleitoradoApurado = 0;
  for (const m of (andamento as { abr?: { tpabr: string; cdabr: string; s?: Record<string, string> }[] }).abr ?? []) {
    if (m.tpabr !== "mun") continue;
    const b = base[`${uf}${m.cdabr}`];
    if (!b) continue;
    const f = n(m.s?.ts) > 0 ? n(m.s?.st) / n(m.s?.ts) : 0;
    totLula += b.lula; totFlavio += b.flavio; totValidos += b.validos;
    expLula += f * b.lula; expFlavio += f * b.flavio; expValidos += f * b.validos;
    if (f > 0) { apurados++; eleitoradoApurado += f * b.eleitorado; }
  }
  // swing: diferença entre a margem contada e a margem esperada (1º turno) nos mesmos municípios, em fração dos válidos
  const validosContados = lula + flavio;
  let swing = 0;
  if (validosContados > 0 && expValidos > 0) {
    const margemObs = (lula - flavio) / validosContados;
    const margemEsp = (expLula - expFlavio) / (expLula + expFlavio || 1);
    swing = margemObs - margemEsp;
  }
  const margemBase = totLula + totFlavio > 0 ? (totLula - totFlavio) / (totLula + totFlavio) : 0;
  const margemProj = Math.max(-1, Math.min(1, margemBase + swing));
  // projeção em votos: usa o total de válidos de 1º turno (lula+flavio) como tamanho do universo
  const universo = totLula + totFlavio;
  // sem andamento por município (exterior), a projeção é o contado escalado pelas seções apuradas
  const pst = n(s.pstn);
  const escala = universo > 0 ? 1 : pst > 0 ? 100 / pst : 1;
  const projLula = universo > 0 ? universo * (1 + margemProj) / 2 : lula * escala;
  const projFlavio = universo > 0 ? universo * (1 - margemProj) / 2 : flavio * escala;

  return {
    uf: uf.toUpperCase(), dh: `${(parcial as { dg?: string }).dg ?? ""} ${(parcial as { hg?: string }).hg ?? ""}`.trim(),
    pst: n(s.pstn), secoes: n(s.st), secoesTot: n(s.ts),
    lula, flavio, validos: n(v.vvc), brancos: n(v.vb), nulos: n(v.tvn), comparecimento: n(e.c), eleitorado: n(e.te),
    apurados, eleitoradoApurado: Math.round(eleitoradoApurado),
    projLula: Math.round(projLula), projFlavio: Math.round(projFlavio), swing,
  };
}

export async function apurar(ciclo: string, eleicao: number, cargo: number, numLula: string, numFlavio: string) {
  const base = await carregarBase();
  const cod = String(eleicao).padStart(6, "0");
  const resultados = await Promise.allSettled(UFS.map(async (uf) => {
    const [parcial, andamento] = await Promise.all([
      json(`${TSE}/${ciclo}/${eleicao}/dados/${uf}/${uf}-c${String(cargo).padStart(4, "0")}-e${cod}-u.json`),
      uf === "zz" ? { abr: [] } : json(`${TSE}/${ciclo}/${eleicao}/dados/${uf}/${uf}-e${cod}-ab.json`),
    ]);
    return projetarUF(uf, parcial, andamento, base, numLula, numFlavio);
  }));
  const ufs = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const falhas = UFS.filter((_, i) => resultados[i].status === "rejected");
  const soma = (k: keyof ParcialUF) => ufs.reduce((s, u) => s + (u[k] as number), 0);
  const secoes = soma("secoes"), secoesTot = soma("secoesTot");
  return {
    atualizado: new Date().toISOString(), falhas, ufs,
    brasil: {
      lula: soma("lula"), flavio: soma("flavio"), validos: soma("validos"), brancos: soma("brancos"), nulos: soma("nulos"),
      comparecimento: soma("comparecimento"), eleitorado: soma("eleitorado"),
      pst: secoesTot ? (100 * secoes) / secoesTot : 0, secoes, secoesTot,
      projLula: soma("projLula"), projFlavio: soma("projFlavio"),
    },
  };
}
export type Apuracao = Awaited<ReturnType<typeof apurar>>;
