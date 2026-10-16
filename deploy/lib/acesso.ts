import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

export type Perfil = "admin" | "aprovado" | "pendente" | "recusado" | "visitante";
export const DEGUSTACAO = 2; // perguntas de experiência para quem ainda não foi aprovado

/** Perfil de quem está logado: admin (ADMIN_EMAILS), aprovado/pendente/recusado (tabela solicitacoes) ou visitante. */
export async function perfilAtual(): Promise<{ email: string | null; perfil: Perfil }> {
  const email = await emailAtual();
  if (!email) return { email, perfil: "visitante" };
  if (ehAdmin(email)) return { email, perfil: "admin" };
  const [s] = (await sql`select status from solicitacoes where lower(email) = ${email} order by criado_em desc limit 1`) as { status: string }[];
  if (!s) return { email, perfil: "visitante" };
  return { email, perfil: s.status === "aprovada" ? "aprovado" : s.status === "recusada" ? "recusado" : "pendente" };
}

/** Quem pode perguntar agora e quantas perguntas de experiência restam. */
export async function acessoAnalista(userId: string) {
  const { email, perfil } = await perfilAtual();
  if (perfil === "admin" || perfil === "aprovado") return { email, perfil, podeUsar: true, restantes: null as number | null };
  if (perfil === "recusado") return { email, perfil, podeUsar: false, restantes: 0 };
  const [c] = (await sql`select count(*)::int as n from perguntas where user_id = ${userId}`) as { n: number }[];
  const restantes = Math.max(0, DEGUSTACAO - c.n);
  return { email, perfil, podeUsar: restantes > 0, restantes };
}

export const podeUsarAnalista = (p: Perfil) => p === "admin" || p === "aprovado";
