import { clerkClient } from "@clerk/nextjs/server";

// Garante que existe um cadastro (sem senha) para o e-mail, para o login por código funcionar
// mesmo na primeira visita. Qualquer e-mail pode entrar no painel.
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) {
    return Response.json({ erro: "Digite um e-mail válido." }, { status: 400 });
  }
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [e] });
  if (data.length === 0) {
    await clerk.users.createUser({ emailAddress: [e], skipPasswordRequirement: true });
  }
  return Response.json({ ok: true });
}
