import { sql } from "@/lib/db";

/** Limite simples por chave e hora, guardado no Neon (o plano Hobby do Vercel não tem rate limit no WAF). */
export async function dentroDoLimite(chave: string, maxPorHora: number): Promise<boolean> {
  try {
    const [r] = (await sql`
      insert into limites (chave, janela, n) values (${chave}, date_trunc('hour', now()), 1)
      on conflict (chave, janela) do update set n = limites.n + 1 returning n`) as { n: number }[];
    return r.n <= maxPorHora;
  } catch (e) {
    console.error("limite:", (e as Error).message);
    return true; // se o banco falhar, não bloqueia o uso legítimo
  }
}
