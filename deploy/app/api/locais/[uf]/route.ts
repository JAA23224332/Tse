import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

/** Locais de votação de uma UF (gerados por gerar_mapa_html.py), para o mapa carregar sob demanda. */
export async function GET(_req: Request, { params }: { params: Promise<{ uf: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("", { status: 401 });
  const { uf } = await params;
  if (!/^[A-Z]{2}$/.test(uf)) return new Response("", { status: 400 });
  try {
    const corpo = await readFile(path.join(process.cwd(), "private", "locais", `${uf}.json`));
    return new Response(corpo, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=3600" } });
  } catch {
    return new Response("[]", { status: 404, headers: { "content-type": "application/json" } });
  }
}
