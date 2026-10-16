import { timingSafeEqual } from "node:crypto";
import { ipAddress } from "@vercel/functions";
import { z } from "zod";
import { gravarSnapshot, modoDe, varrer, ultimoSnapshot } from "@/lib/coletor";
import { UFS, type Apuracao } from "@/lib/apuracao";
import { dentroDoLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const N = z.number().finite().min(0).max(2e8);
const UF = z.object({
  uf: z.enum(UFS.map((u) => u.toUpperCase()) as [string, ...string[]]), dh: z.string().max(40), pst: z.number().min(0).max(100),
  secoes: N, secoesTot: N, lula: N, flavio: N, validos: N, brancos: N, nulos: N, comparecimento: N, eleitorado: N,
  apurados: N, eleitoradoApurado: N, fracaoApurada: z.number().min(0).max(1), projLula: N, projFlavio: N,
  swing: z.number().min(-0.25).max(0.25), swingConfiavel: z.boolean(), desatualizada: z.boolean().optional(),
}).strict();
const Snapshot = z.object({
  atualizado: z.string().datetime(), eleicao: z.literal(6258), falhas: z.array(z.string().max(2)).max(28), ufs: z.array(UF).max(28),
  brasil: z.object({ lula: N, flavio: N, validos: N, brancos: N, nulos: N, comparecimento: N, eleitorado: N, pst: z.number().min(0).max(100),
    secoes: N, secoesTot: N, dh: z.string().max(40), projLula: N.nullable(), projFlavio: N.nullable(), faixa: z.number().min(0).max(20).nullable() }).strict(),
}).strict();

/**
 * Coletor: chamado a cada minuto por um disparador externo (ou pelo script no PC, que pode enviar o snapshot pronto).
 * Protegido por COLETOR_TOKEN. Sem corpo: varre o TSE aqui. Com corpo {dados}: valida, confere com o TSE e grava.
 */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!process.env.COLETOR_TOKEN || !igual(token, process.env.COLETOR_TOKEN)) return new Response("Não autorizado", { status: 401 });
  const ip = ipAddress(req) ?? null;
  if (!(await dentroDoLimite(`coletar:${ip ?? "sem-ip"}`, 30))) return new Response("Muitas chamadas", { status: 429 });
  try {
    const corpo = (await req.json().catch(() => null)) as { dados?: unknown } | null;
    let dados: Apuracao, origem: "servidor" | "cliente";
    if (corpo?.dados !== undefined) {
      const v = Snapshot.safeParse(corpo.dados);
      if (!v.success) return Response.json({ erro: "snapshot inválido", detalhe: v.error.issues.slice(0, 3) }, { status: 422 });
      dados = v.data as Apuracao; origem = "cliente";
    } else {
      dados = await varrer((await ultimoSnapshot().catch(() => null))?.dados ?? null); origem = "servidor";
    }
    const gravado = await gravarSnapshot(dados, origem, ip);
    return Response.json({ modo: modoDe(dados), gravado, origem, secoes: dados.brasil.secoes, pst: dados.brasil.pst, falhas: dados.falhas, atualizado: dados.atualizado });
  } catch (e) {
    console.error("coletor:", (e as Error).message);
    return Response.json({ erro: "snapshot recusado", motivo: (e as Error).message.slice(0, 160) }, { status: 409 });
  }
}
