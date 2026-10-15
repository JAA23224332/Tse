import { currentUser } from "@clerk/nextjs/server";

// ADMIN_EMAILS: e-mails separados por vírgula que podem ver /admin
export async function emailAtual() {
  const u = await currentUser();
  return u?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
}

export function ehAdmin(email: string | null) {
  if (!email) return false;
  const lista = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim());
  return lista.includes(email);
}
