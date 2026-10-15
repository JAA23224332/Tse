import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@clerk/nextjs/server";
import { geolocation, ipAddress } from "@vercel/functions";
import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { navHtml } from "@/lib/nav";

const cache = new Map<string, string>();

/** Registra o acesso de quem está logado. */
export async function registrarAcesso(req: Request, pagina: string, userId: string, email: string | null) {
  const geo = geolocation(req);
  await sql`
    insert into acessos (email, user_id, ip, cidade, uf, pais, navegador, pagina)
    values (${email}, ${userId}, ${ipAddress(req) ?? null}, ${geo.city ? decodeURIComponent(geo.city) : null},
            ${geo.countryRegion ?? null}, ${geo.country ?? null}, ${req.headers.get("user-agent")}, ${pagina})`;
}

/** Serve um arquivo HTML de private/ para quem está logado, com a barra de navegação. */
export async function servirHtml(req: Request, arquivo: string, rota: string) {
  const { userId } = await auth();
  if (!userId) return Response.redirect(new URL("/sign-in", req.url));
  const email = await emailAtual();
  await registrarAcesso(req, rota, userId, email);

  let html = cache.get(arquivo);
  if (!html) {
    try {
      html = await readFile(path.join(process.cwd(), "private", arquivo), "utf8");
    } catch {
      return new Response("Esta página ainda não foi gerada.", { status: 404 });
    }
    cache.set(arquivo, html);
  }
  return new Response(html.replace("<body>", "<body>" + navHtml(rota, email, ehAdmin(email), !html.includes("fonts.googleapis.com/css2?family=Fraunces"))), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
