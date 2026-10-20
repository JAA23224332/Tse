import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Locais de votação de uma UF (gerados por gerar_mapa_html.py), para o mapa carregar sob demanda. Pública, como a página /mapa. */
export async function GET(_req: Request, { params }: { params: Promise<{ uf: string }> }) {
  const { uf } = await params;
  if (!/^[A-Z]{2}$/.test(uf)) return new Response("", { status: 400 });
  try {
    const corpo = await readFile(path.join(process.cwd(), "private", "locais", `${uf}.json`));
    return new Response(corpo, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return new Response("[]", { status: 404, headers: { "content-type": "application/json" } });
  }
}
