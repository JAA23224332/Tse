import { auth } from "@clerk/nextjs/server";
import { ipAddress } from "@vercel/functions";
import { emailAtual } from "@/lib/admin";
import { dentroDoLimite } from "@/lib/limite";
import { sql } from "@/lib/db";
import { emailNovaSolicitacao, enviarEmail } from "@/lib/email";

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const limpo = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

export async function POST(req: Request) {
  const { userId } = await auth().catch(() => ({ userId: null as string | null }));
  const emailSessao = userId ? await emailAtual().catch(() => null) : null;
  if (!(await dentroDoLimite(`solicitar:${ipAddress(req) ?? "sem-ip"}`, 5))) return Response.json({ erro: "Muitos pedidos. Tente de novo mais tarde." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const emailDigitado = limpo(b.email, 254).toLowerCase();
  const email = emailSessao ?? emailDigitado;  // pedido aberto: quem não está logado informa o e-mail
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return Response.json({ erro: "Informe um e-mail válido." }, { status: 400 });
  const s = {
    nome: limpo(b.nome, 120), email, organizacao: limpo(b.organizacao, 120),
    cargo: limpo(b.cargo, 120) || null, cidade: limpo(b.cidade, 80) || null, uf: limpo(b.uf, 2).toUpperCase() || null,
    whatsapp: limpo(b.whatsapp, 30) || null, finalidade: limpo(b.finalidade, 600) || null, indicacao: limpo(b.indicacao, 120) || null,
    aceite: true,  // enviar o formulário é o aceite; o texto está ao lado do botão
  };
  if (s.nome.length < 3) return Response.json({ erro: "Informe seu nome completo." }, { status: 400 });
  if (s.organizacao.length < 2) return Response.json({ erro: "Informe a instituição." }, { status: 400 });
  if (!s.uf || !UFS.includes(s.uf)) return Response.json({ erro: "Escolha o estado." }, { status: 400 });
  if (!s.finalidade || s.finalidade.length < 10) return Response.json({ erro: "Conte em uma frase por que quer acessar." }, { status: 400 });

  const [existente] = (await sql`select status from solicitacoes where lower(email) = ${s.email} order by criado_em desc limit 1`) as { status: string }[];
  // pedido repetido não cria linha nova; a resposta não revela o estado para quem não está logado
  if (existente?.status === "aprovada" || existente?.status === "pendente") return Response.json({ ok: true, estado: emailSessao ? existente.status : "nova" });

  await sql`insert into solicitacoes (nome, email, user_id, organizacao, cargo, cidade, uf, whatsapp, finalidade, indicacao, aceite)
            values (${s.nome}, ${s.email}, ${userId}, ${s.organizacao}, ${s.cargo}, ${s.cidade}, ${s.uf}, ${s.whatsapp}, ${s.finalidade}, ${s.indicacao}, true)`;

  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (admins.length) {
    const m = emailNovaSolicitacao(s);
    enviarEmail(admins, m.assunto, m.html).catch(() => {});
  }
  return Response.json({ ok: true, estado: "nova" });
}
