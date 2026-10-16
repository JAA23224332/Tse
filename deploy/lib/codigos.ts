"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para não confundir

/** Gera um código de acesso ao Raio-X (só administradoras). */
export async function gerarCodigo(_e: { codigo?: string; erro?: string; email?: string; nome?: string } | null, form: FormData) {
  const admin = await emailAtual();
  if (!ehAdmin(admin)) return { erro: "Sem permissão." };
  const usos = Math.min(500, Math.max(1, Number(form.get("usos") ?? 1) || 1));
  const dias = Math.min(60, Math.max(1, Number(form.get("dias") ?? 7) || 7));
  const nota = String(form.get("nota") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 80) || null;
  const nome = String(form.get("nome") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 120) || null;
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254) || null;
  if (email && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return { erro: "E-mail inválido." };
  const codigo = "RX-" + Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  await sql`insert into codigos_acesso (codigo, nota, nome, email, usos_max, expira_em, criado_por)
            values (${codigo}, ${nota ?? nome}, ${nome}, ${email}, ${email ? 1 : usos}, now() + make_interval(days => ${dias}), ${admin})`;
  revalidatePath("/admin/codigos");
  return { codigo, email: email ?? undefined, nome: nome ?? undefined };
}

export async function revogarCodigo(form: FormData) {
  const admin = await emailAtual();
  if (!ehAdmin(admin)) throw new Error("Sem permissão.");
  const codigo = String(form.get("codigo") ?? "");
  await sql`update codigos_acesso set revogado = true where codigo = ${codigo}`;
  revalidatePath("/admin/codigos");
}
