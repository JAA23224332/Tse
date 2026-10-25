import { carregarBase, UFS } from "@/lib/apuracao";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * Municípios de uma UF na apuração do 2º turno: andamento (% de seções) do arquivo -ab.json do TSE, com nome,
 * eleitorado e votos do 1º turno da base. Pública; uma leitura do TSE por UF a cada 30 s, no máximo.
 */
type Andamento = { dg?: string; hg?: string; abr?: { tpabr: string; cdabr: string; s?: Record<string, string> }[] };
type Resp = { uf: string; atualizado: string; dh: string; municipios: { cd: string; nome: string; eleitorado: number; pst: number; secoes: number; secoesTot: number; lula1: number; flavio1: number }[] };
const n = (x: unknown) => Number(String(x ?? "0").replace(",", ".")) || 0;
const memoria = new Map<string, { em: number; dados: Resp }>();

export async function GET(_req: Request, ctx: { params: Promise<{ uf: string }> }) {
  const uf = (await ctx.params).uf.toLowerCase();
  if (!UFS.includes(uf) || uf === "zz") return Response.json({ erro: "UF inválida." }, { status: 400 });
  const cab = { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" };
  const m = memoria.get(uf);
  if (m && Date.now() - m.em < 30_000) return Response.json(m.dados, { headers: cab });
  try {
    const r = await fetch(`https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${uf}/${uf}-e006258-ab.json`, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (apuracao segundoturno.blog)" } });
    if (!r.ok) throw new Error(String(r.status));
    const a = (await r.json()) as Andamento;
    const base = await carregarBase();
    const municipios = (a.abr ?? []).filter((x) => x.tpabr === "mun").map((x) => {
      const b = base[`${uf}${x.cdabr}`];
      return { cd: x.cdabr, nome: b?.nome ?? x.cdabr, eleitorado: b?.eleitorado ?? 0, pst: n(x.s?.pstn ?? x.s?.pst), secoes: n(x.s?.st), secoesTot: n(x.s?.ts), lula1: b?.lula ?? 0, flavio1: b?.flavio ?? 0 };
    }).sort((p, q) => q.eleitorado - p.eleitorado);
    const dados: Resp = { uf: uf.toUpperCase(), atualizado: new Date().toISOString(), dh: `${a.dg ?? ""} ${a.hg ?? ""}`.trim(), municipios };
    memoria.set(uf, { em: Date.now(), dados });
    return Response.json(dados, { headers: cab });
  } catch (e) {
    console.error("apuracao uf", uf, (e as Error).message);
    if (m) return Response.json(m.dados);
    return Response.json({ erro: "Sem resposta do TSE para esta UF agora." }, { status: 503 });
  }
}
