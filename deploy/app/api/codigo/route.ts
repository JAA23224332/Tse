import { clerkClient } from "@clerk/nextjs/server";
import { ipAddress } from "@vercel/functions";
import { sql } from "@/lib/db";
import { dentroDoLimite } from "@/lib/limite";

const limpo = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

/**
 * Entrada no Raio-X com código de acesso (gerado pela administração): valida o código, aprova o e-mail,
 * cria a conta se preciso e devolve um bilhete de login de uso único. Não depende de e-mail chegar.
 */
export async function POST(req: Request) {
  const ip = ipAddress(req) ?? "sem-ip";
  if (!(await dentroDoLimite(`codigo:${ip}`, 10))) return Response.json({ erro: "Muitas tentativas. Aguarde uma hora." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = limpo(b.nome, 120), email = limpo(b.email, 254).toLowerCase();
  const codigo = limpo(b.codigo, 20).toUpperCase().replace(/\s+/g, "").replace(/^RX-?/, "RX-");
  if (nome.length < 3) return Response.json({ erro: "Informe seu nome completo." }, { status: 400 });
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return Response.json({ erro: "Informe um e-mail válido." }, { status: 400 });
  if (!/^RX-[A-Z2-9]{6}$/.test(codigo)) return Response.json({ erro: "Código inválido. Ele tem o formato RX-XXXXXX." }, { status: 400 });

  // consome uma utilização só se o código estiver válido (atômico)
  const [c] = (await sql`
    update codigos_acesso set usos = usos + 1
    where codigo = ${codigo} and not revogado and expira_em > now() and usos < usos_max
    returning codigo, nota`) as { codigo: string; nota: string | null }[];
  if (!c) return Response.json({ erro: "Código inválido, vencido ou já usado. Peça outro à administração." }, { status: 400 });

  const clerk = await clerkClient();
  let user = (await clerk.users.getUserList({ emailAddress: [email] })).data[0];
  if (!user) {
    try { user = await clerk.users.createUser({ emailAddress: [email], skipPasswordRequirement: true }); }
    catch (e) { console.error("codigo/createUser:", (e as Error).message); return Response.json({ erro: "Não foi possível criar a conta. Tente de novo." }, { status: 500 }); }
  }
  // aprovação automática: quem tem código foi autorizado por quem gerou o código
  const [existente] = (await sql`select id, status from solicitacoes where lower(email) = ${email} order by criado_em desc limit 1`) as { id: number; status: string }[];
  if (existente && existente.status !== "aprovada") {
    await sql`update solicitacoes set status = 'aprovada', decidido_em = now(), decidido_por = ${"código " + codigo}, user_id = ${user.id} where id = ${existente.id}`;
  } else if (!existente) {
    await sql`insert into solicitacoes (nome, email, user_id, organizacao, finalidade, aceite, status, decidido_em, decidido_por)
              values (${nome}, ${email}, ${user.id}, ${c.nota ?? "código de acesso"}, ${"entrou com o código " + codigo}, true, 'aprovada', now(), ${"código " + codigo})`;
  }
  const r = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST", headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
  });
  const j = (await r.json()) as { token?: string };
  if (!j.token) return Response.json({ erro: "Não foi possível abrir a sessão. Tente de novo." }, { status: 500 });
  return Response.json({ ok: true, ticket: j.token });
}
