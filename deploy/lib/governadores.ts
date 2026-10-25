/**
 * 2º turno de governador ao vivo (eleição 6260 do TSE): um arquivo por UF, só contagem, sem projeção.
 * UFs conferidas na config do TSE em 25/10/2026; o RJ não tem 2º turno de governador publicado (404).
 */
const TSE = "https://resultados.tse.jus.br/oficial";
const ELEICAO = 6260;
export const UFS_GOV_2T = ["ac", "am", "df", "es", "rn", "to"];

export type CandidatoGov = { numero: string; nome: string; partido: string; votos: number; pct: number; eleito: boolean };
export type Governador = {
  uf: string; dh: string; pst: number; secoes: number; secoesTot: number; final: boolean;
  validos: number; brancos: number; nulos: number; comparecimento: number; eleitorado: number;
  candidatos: CandidatoGov[];
};
export type Governadores = { atualizado: string; ufs: Governador[]; falhas: string[] };

type Arquivo = {
  ele?: string; dg?: string; hg?: string; tf?: string; s?: Record<string, string>; v?: Record<string, string>; e?: Record<string, string>;
  carg?: { cd?: string; agr?: { par?: { sg?: string; cand?: { n: string; nmu: string; vap: string; pvap: string; e?: string; seq?: string }[] }[] }[] }[];
};
const n = (x: unknown) => Number(String(x ?? "0").replace(",", ".")) || 0;

async function json(url: string): Promise<Arquivo> {
  let erro: unknown;
  for (let t = 1; t <= 2; t++) {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (apuracao segundoturno.blog)" } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { erro = e; }
  }
  throw erro;
}

export function lerGovernador(uf: string, d: Arquivo): Governador {
  if (d.ele && d.ele !== String(ELEICAO)) throw new Error(`layout: eleição ${d.ele}`);
  const cargo = d.carg?.[0];
  if (cargo?.cd && cargo.cd !== "3") throw new Error(`layout: cargo ${cargo.cd}`);
  const candidatos: (CandidatoGov & { seq: number })[] = [];
  for (const agr of cargo?.agr ?? []) for (const par of agr.par ?? []) for (const c of par.cand ?? []) {
    candidatos.push({ numero: c.n, nome: c.nmu, partido: par.sg ?? "", votos: n(c.vap), pct: n(c.pvap), eleito: c.e === "s", seq: n(c.seq) });
  }
  if (candidatos.length === 0) throw new Error("layout: sem candidatos");
  candidatos.sort((a, b) => b.votos - a.votos || a.seq - b.seq);
  const s = d.s ?? {}, v = d.v ?? {}, e = d.e ?? {};
  return {
    uf: uf.toUpperCase(), dh: `${d.dg ?? ""} ${d.hg ?? ""}`.trim(), pst: n(s.pstn), secoes: n(s.st), secoesTot: n(s.ts), final: d.tf === "s",
    validos: n(v.vvc), brancos: n(v.vb), nulos: n(v.tvn), comparecimento: n(e.c), eleitorado: n(e.te),
    candidatos: candidatos.map(({ seq: _s, ...c }) => { void _s; return c; }),
  };
}

export async function governadores(): Promise<Governadores> {
  const r = await Promise.allSettled(UFS_GOV_2T.map((uf) =>
    json(`${TSE}/ele2026/${ELEICAO}/dados/${uf}/${uf}-c0003-e00${ELEICAO}-u.json`).then((d) => lerGovernador(uf, d))));
  const ufs: Governador[] = [], falhas: string[] = [];
  r.forEach((x, i) => {
    if (x.status === "fulfilled") ufs.push(x.value);
    else { falhas.push(UFS_GOV_2T[i].toUpperCase()); console.error(`governador ${UFS_GOV_2T[i]}:`, (x.reason as Error).message); }
  });
  return { atualizado: new Date().toISOString(), ufs, falhas };
}
