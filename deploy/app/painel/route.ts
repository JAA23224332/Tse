import { servirHtml } from "@/lib/servir";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => servirHtml(req, "painel.html", "/painel");
