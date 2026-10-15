import { gravarSnapshot, modoDe, varrer, ultimoSnapshot } from "@/lib/coletor";
import type { Apuracao } from "@/lib/apuracao";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Coletor: chamado a cada minuto por um disparador externo (ou pelo script no PC, que pode enviar o snapshot pronto).
 * Protegido por COLETOR_TOKEN. Sem corpo: varre o TSE aqui. Com corpo {dados}: grava o snapshot enviado.
 */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!process.env.COLETOR_TOKEN || token !== process.env.COLETOR_TOKEN) return new Response("Não autorizado", { status: 401 });
  try {
    const corpo = (await req.json().catch(() => null)) as { dados?: Apuracao } | null;
    const dados = corpo?.dados ?? (await varrer((await ultimoSnapshot().catch(() => null))?.dados ?? null));
    const gravado = await gravarSnapshot(dados);
    return Response.json({ modo: modoDe(dados), gravado, secoes: dados.brasil.secoes, pst: dados.brasil.pst, falhas: dados.falhas, atualizado: dados.atualizado });
  } catch (e) {
    console.error("coletor:", (e as Error).message);
    return Response.json({ erro: (e as Error).message }, { status: 500 });
  }
}
