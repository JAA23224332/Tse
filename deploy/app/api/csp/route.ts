import { ipAddress } from "@vercel/functions";
import { dentroDoLimite } from "@/lib/limite";

/** Recebe relatórios de violação da CSP (modo relatar) e registra no log do servidor. */
export async function POST(req: Request) {
  if (!(await dentroDoLimite(`csp:${ipAddress(req) ?? "sem-ip"}`, 20))) return new Response(null, { status: 204 });
  const corpo = await req.text().catch(() => "");
  console.warn("csp:", corpo.slice(0, 600));
  return new Response(null, { status: 204 });
}
