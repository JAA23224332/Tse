import { sql } from "@/lib/db";
import { SEGUNDO_TURNO } from "@/lib/coletor";

export const dynamic = "force-dynamic";

/** Pública: evolução da noite (um ponto por snapshot), para o gráfico ser o mesmo para todo mundo. */
export async function GET() {
  try {
    const linhas = (await sql`
      select criado_em, dados->'brasil' as brasil from apuracao_snapshots
      where eleicao = ${SEGUNDO_TURNO} order by id`) as { criado_em: string; brasil: Record<string, number | null> }[];
    const pontos = linhas.map((l) => {
      const b = l.brasil, tot = (b.lula ?? 0) + (b.flavio ?? 0), ptot = (b.projLula ?? 0) + (b.projFlavio ?? 0);
      return { t: l.criado_em, pst: b.pst ?? 0, lula: tot ? 100 * (b.lula ?? 0) / tot : null, projLula: ptot ? 100 * (b.projLula ?? 0) / ptot : null, faixa: b.faixa ?? null };
    });
    return Response.json({ pontos }, { headers: { "cache-control": "public, s-maxage=30" } });
  } catch (e) {
    console.error("historico:", (e as Error).message);
    return Response.json({ pontos: [] });
  }
}
