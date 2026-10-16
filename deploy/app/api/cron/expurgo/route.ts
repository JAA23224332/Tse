import { timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Retenção de dados pessoais (chamado 1x por dia pelo cron do Vercel, protegido por CRON_SECRET). */
export async function GET(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const esperado = process.env.CRON_SECRET ?? "";
  if (!esperado || token.length !== esperado.length || !timingSafeEqual(Buffer.from(token), Buffer.from(esperado))) return new Response("Não autorizado", { status: 401 });
  const r = {
    ip_anonimizado: (await sql`update acessos set ip = null where ip is not null and criado_em < now() - interval '30 days' returning id`).length,
    acessos_apagados: (await sql`delete from acessos where criado_em < now() - interval '90 days' returning id`).length,
    perguntas_apagadas: (await sql`delete from perguntas where criado_em < now() - interval '180 days' returning id`).length,
    consultas_apagadas: (await sql`delete from consultas where criado_em < now() - interval '180 days' returning id`).length,
    contatos_aprovadas_apagados: (await sql`update solicitacoes set whatsapp = null, cidade = null, cargo = null, indicacao = null where status = 'aprovada' and decidido_em < now() - interval '30 days' and (whatsapp is not null or cidade is not null or cargo is not null or indicacao is not null) returning id`).length,
    recusadas_apagadas: (await sql`delete from solicitacoes where status = 'recusada' and decidido_em < now() - interval '90 days' returning id`).length,
    limites_apagados: (await sql`delete from limites where janela < now() - interval '2 days' returning chave`).length,
  };
  console.log("expurgo:", JSON.stringify(r));
  return Response.json({ ok: true, ...r });
}
