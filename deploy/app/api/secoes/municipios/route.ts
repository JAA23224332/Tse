import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lista de municípios de uma UF (código TSE e nome), para o seletor da busca por seção. Pública, como a página /secoes. */
export async function GET(req: Request) {
  const uf = (new URL(req.url).searchParams.get("uf") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return Response.json([], { status: 400 });
  try {
    const linhas = await sql`select cd_tse, municipio, eleitorado from municipios where uf = ${uf} order by municipio`;
    return Response.json(linhas, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
  } catch (e) {
    console.error("municipios:", (e as Error).message);
    return Response.json([], { status: 503 });
  }
}
