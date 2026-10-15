import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@clerk/nextjs/server";
import { geolocation, ipAddress, waitUntil } from "@vercel/functions";
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
  waitUntil(registrarAcesso(req, rota, userId, email).catch((e) => console.error("acesso:", (e as Error).message)));

  let html = cache.get(arquivo);
  if (!html) {
    try {
      html = await readFile(path.join(process.cwd(), "private", arquivo), "utf8");
    } catch {
      return Response.redirect(new URL("/nao-gerada", req.url));
    }
    cache.set(arquivo, html);
  }
  const corpo = html.replace("<body>", "<body>" + navHtml(rota, email, ehAdmin(email), !html.includes("fonts.googleapis.com/css2?family=Fraunces")));
  // ETag por conteúdo+pessoa: o navegador guarda a página e só rebaixa quando ela muda (a auth roda sempre)
  const etag = `"${createHash("sha1").update(corpo).digest("hex").slice(0, 20)}"`;
  const cabecalhos = { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-cache", etag, vary: "Cookie" };
  const recebida = (req.headers.get("if-none-match") ?? "").split(",").map((t) => t.trim().replace(/^W\//, ""));
  if (recebida.includes(etag)) return new Response(null, { status: 304, headers: cabecalhos });
  return new Response(corpo, { headers: cabecalhos });
}
