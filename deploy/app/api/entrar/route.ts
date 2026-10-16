import { clerkClient } from "@clerk/nextjs/server";
import { ipAddress } from "@vercel/functions";
import { resolveMx } from "node:dns/promises";
import { dentroDoLimite } from "@/lib/limite";

// Garante que existe um cadastro (sem senha) para o e-mail, para o login por código funcionar
// mesmo na primeira visita. Qualquer e-mail pode entrar no painel.
export async function POST(req: Request) {
  if (!(await dentroDoLimite("entrar:global", 300))) return Response.json({ erro: "Muitas entradas agora. Tente em alguns minutos." }, { status: 429 });
  if (!(await dentroDoLimite(`entrar:${ipAddress(req) ?? "sem-ip"}`, 10))) {
    return Response.json({ erro: "Muitas tentativas. Aguarde uma hora e tente de novo." }, { status: 429 });
  }
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) || e.length > 254) {
    return Response.json({ erro: "Digite um e-mail válido, sem o sinal de + no endereço." }, { status: 400 });
  }
  // domínio precisa receber e-mail: pega erros de digitação (conass.og.br, gmail.con) antes de criar conta e mandar código
  const dominio = e.split("@")[1];
  const recebe = await Promise.race([resolveMx(dominio).then((mx) => mx.length > 0), new Promise<boolean>((ok) => setTimeout(() => ok(true), 3000))]).catch(() => false);
  if (!recebe) return Response.json({ erro: `O endereço "${dominio}" não recebe e-mails. Confira a digitação (ex.: conass.org.br, gmail.com).` }, { status: 400 });
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [e] });
  if (data.length === 0) {
    try { await clerk.users.createUser({ emailAddress: [e], skipPasswordRequirement: true }); }
    catch (err) { if ((err as { status?: number }).status !== 422) throw err; } // 422 = já existe (pedido simultâneo)
  }
  return Response.json({ ok: true });
}
