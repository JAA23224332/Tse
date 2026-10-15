import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

export type Perfil = "admin" | "aprovado" | "pendente" | "recusado" | "visitante";

/** Perfil de quem está logado: admin (ADMIN_EMAILS), aprovado/pendente/recusado (tabela solicitacoes) ou visitante. */
export async function perfilAtual(): Promise<{ email: string | null; perfil: Perfil }> {
  const email = await emailAtual();
  if (!email) return { email, perfil: "visitante" };
  if (ehAdmin(email)) return { email, perfil: "admin" };
  const [s] = (await sql`select status from solicitacoes where lower(email) = ${email} order by criado_em desc limit 1`) as { status: string }[];
  if (!s) return { email, perfil: "visitante" };
  return { email, perfil: s.status === "aprovada" ? "aprovado" : s.status === "recusada" ? "recusado" : "pendente" };
}

export const podeUsarAnalista = (p: Perfil) => p === "admin" || p === "aprovado";
