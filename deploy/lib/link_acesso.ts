"use server";
import { clerkClient } from "@clerk/nextjs/server";
import { emailAtual, ehAdmin } from "@/lib/admin";

const SITE = process.env.SITE_URL ?? "https://segundoturno.blog";

/** Gera um link de acesso de uso único (48 h) para um e-mail: alternativa quando o código não chega. Só administradoras. */
export async function gerarLinkAcesso(_estado: { link?: string; erro?: string; email?: string } | null, form: FormData) {
  const admin = await emailAtual();
  if (!ehAdmin(admin)) return { erro: "Sem permissão." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return { erro: "Digite um e-mail válido." };
  const clerk = await clerkClient();
  let user = (await clerk.users.getUserList({ emailAddress: [email] })).data[0];
  if (!user) {
    try { user = await clerk.users.createUser({ emailAddress: [email], skipPasswordRequirement: true }); }
    catch (e) { return { erro: `Não foi possível criar a conta: ${(e as Error).message.slice(0, 80)}` }; }
  }
  const r = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST", headers: { authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.id, expires_in_seconds: 48 * 3600 }),
  });
  const j = (await r.json()) as { token?: string; errors?: { message: string }[] };
  if (!j.token) return { erro: `Falha ao gerar o link: ${j.errors?.[0]?.message ?? r.status}` };
  console.log("link de acesso gerado por", admin, "para", email.replace(/^(.).*@/, "$1***@"));
  return { link: `${SITE}/entrar?t=${j.token}`, email };
}
