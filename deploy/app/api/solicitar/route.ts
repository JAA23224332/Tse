import { auth } from "@clerk/nextjs/server";
import { ipAddress } from "@vercel/functions";
import { emailAtual } from "@/lib/admin";
import { dentroDoLimite } from "@/lib/limite";
import { sql } from "@/lib/db";
import { emailNovaSolicitacao, enviarEmail } from "@/lib/email";

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const limpo = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

export async function POST(req: Request) {
  const { userId } = await auth();
  const emailSessao = await emailAtual();
  if (!userId || !emailSessao) return Response.json({ erro: "Entre com seu e-mail antes de pedir acesso." }, { status: 401 });
  if (!(await dentroDoLimite(`solicitar:${ipAddress(req) ?? userId}`, 3))) return Response.json({ erro: "Muitos pedidos. Tente de novo mais tarde." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = {
    nome: limpo(b.nome, 120), email: emailSessao, organizacao: limpo(b.organizacao, 120),  // o e-mail é o da conta logada, não o digitado
    cargo: limpo(b.cargo, 120) || null, cidade: limpo(b.cidade, 80) || null, uf: limpo(b.uf, 2).toUpperCase() || null,
    whatsapp: limpo(b.whatsapp, 30) || null, finalidade: limpo(b.finalidade, 600) || null, indicacao: limpo(b.indicacao, 120) || null,
    aceite: b.aceite === true,
  };
  if (s.nome.length < 3) return Response.json({ erro: "Informe seu nome completo." }, { status: 400 });
  if (s.organizacao.length < 2) return Response.json({ erro: "Informe a organização." }, { status: 400 });
  if (s.uf && !UFS.includes(s.uf)) return Response.json({ erro: "UF inválida." }, { status: 400 });
  if (!s.aceite) return Response.json({ erro: "É preciso aceitar as condições de uso." }, { status: 400 });

  const [existente] = (await sql`select status from solicitacoes where lower(email) = ${s.email} order by criado_em desc limit 1`) as { status: string }[];
  // é a própria pessoa logada, então pode saber o estado do seu pedido
  if (existente?.status === "aprovada") return Response.json({ ok: true, estado: "aprovada" });
  if (existente?.status === "pendente") return Response.json({ ok: true, estado: "pendente" });

  await sql`insert into solicitacoes (nome, email, user_id, organizacao, cargo, cidade, uf, whatsapp, finalidade, indicacao, aceite)
            values (${s.nome}, ${s.email}, ${userId}, ${s.organizacao}, ${s.cargo}, ${s.cidade}, ${s.uf}, ${s.whatsapp}, ${s.finalidade}, ${s.indicacao}, true)`;

  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (admins.length) {
    const m = emailNovaSolicitacao(s);
    enviarEmail(admins, m.assunto, m.html).catch(() => {});
  }
  return Response.json({ ok: true, estado: "nova" });
}
