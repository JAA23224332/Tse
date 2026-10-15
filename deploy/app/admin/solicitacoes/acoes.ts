"use server";
import { revalidatePath } from "next/cache";
import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { emailAprovado, emailRecusado, enviarEmail } from "@/lib/email";

export async function decidir(formData: FormData) {
  const admin = await emailAtual();
  if (!ehAdmin(admin)) throw new Error("Sem permissão.");
  const id = Number(formData.get("id"));
  const decisao = formData.get("decisao") === "aprovar" ? "aprovada" : "recusada";
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 300) || null;

  const [s] = (await sql`
    update solicitacoes set status = ${decisao}, motivo = ${motivo}, decidido_em = now(), decidido_por = ${admin}
    where id = ${id} returning nome, email`) as { nome: string; email: string }[];
  if (s) {
    const m = decisao === "aprovada" ? emailAprovado(s.nome) : emailRecusado(s.nome, motivo);
    enviarEmail(s.email, m.assunto, m.html).catch(() => {});
  }
  revalidatePath("/admin/solicitacoes");
}
