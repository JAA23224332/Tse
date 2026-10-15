import { sql } from "@/lib/db";
import { SEGUNDO_TURNO } from "@/lib/coletor";

export const dynamic = "force-dynamic";

/** Pública: estado dos serviços para o monitor externo e para o runbook da noite. */
export async function GET() {
  const t0 = Date.now();
  const tse = await fetch(`https://resultados.tse.jus.br/oficial/ele2026/${SEGUNDO_TURNO}/dados/br/br-c0001-e00${SEGUNDO_TURNO}-u.json`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    .then((r) => ({ ok: r.ok, ms: Date.now() - t0 })).catch((e) => ({ ok: false, ms: Date.now() - t0, erro: (e as Error).message }));
  const t1 = Date.now();
  const neon = await sql`select max(criado_em) as ultimo, count(*)::int as snapshots from apuracao_snapshots where eleicao = ${SEGUNDO_TURNO}`
    .then((r) => ({ ok: true, ms: Date.now() - t1, ultimo_snapshot: r[0].ultimo, snapshots: r[0].snapshots })).catch((e) => ({ ok: false, ms: Date.now() - t1, erro: (e as Error).message }));
  const ok = tse.ok && neon.ok;
  return Response.json({ ok, tse, neon, coletor_token: !!process.env.COLETOR_TOKEN, agora: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
