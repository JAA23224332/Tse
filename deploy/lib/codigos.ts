"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para não confundir

/** Gera um código de acesso ao Raio-X (só administradoras). */
export type CodigoGerado = { codigo?: string; erro?: string; email?: string; nome?: string; dias?: number };
/**
 * Com e-mail, o código é pessoal e reutilizável (padrão 100 entradas em 120 dias): vira um link que a pessoa guarda
 * e usa sempre que a sessão cair, sem pedir acesso de novo. Sem e-mail, é um código de grupo.
 */
export async function gerarCodigo(_e: CodigoGerado | null, form: FormData) {
  const admin = await emailAtual();
  if (!ehAdmin(admin)) return { erro: "Sem permissão." };
  const temEmail = String(form.get("email") ?? "").trim() !== "";
  const usos = Math.min(500, Math.max(1, Number(form.get("usos") ?? (temEmail ? 100 : 1)) || (temEmail ? 100 : 1)));
  const dias = Math.min(365, Math.max(1, Number(form.get("dias") ?? (temEmail ? 120 : 7)) || (temEmail ? 120 : 7)));
  const nota = String(form.get("nota") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 80) || null;
  const nome = String(form.get("nome") ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 120) || null;
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254) || null;
  if (email && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return { erro: "E-mail inválido." };
  const codigo = "RX-" + Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  await sql`insert into codigos_acesso (codigo, nota, nome, email, usos_max, expira_em, criado_por)
            values (${codigo}, ${nota ?? nome}, ${nome}, ${email}, ${usos}, now() + make_interval(days => ${dias}), ${admin})`;
  revalidatePath("/admin/codigos"); revalidatePath("/admin/solicitacoes");
  return { codigo, email: email ?? undefined, nome: nome ?? undefined, dias };
}

export async function revogarCodigo(form: FormData) {
  const admin = await emailAtual();
  if (!ehAdmin(admin)) throw new Error("Sem permissão.");
  const codigo = String(form.get("codigo") ?? "");
  await sql`update codigos_acesso set revogado = true where codigo = ${codigo}`;
  revalidatePath("/admin/codigos");
}
