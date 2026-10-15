import { auth } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lista de municípios de uma UF (código TSE e nome), para o seletor da busca por seção. */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json([], { status: 401 });
  const uf = (new URL(req.url).searchParams.get("uf") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return Response.json([], { status: 400 });
  const linhas = await sql`select cd_tse, municipio, eleitorado from municipios where uf = ${uf} order by municipio`;
  return Response.json(linhas, { headers: { "cache-control": "private, max-age=3600" } });
}
