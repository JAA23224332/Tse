import { auth } from "@clerk/nextjs/server";
import { createAgentUIStreamResponse } from "ai";
import { criarAnalista, MASTER_EMAIL, temAnthropic, type Motor } from "@/lib/analista";
import { acessoAnalista } from "@/lib/acesso";
import { sql } from "@/lib/db";
import { dentroDoLimite } from "@/lib/limite";
import { z } from "zod";

const Msg = z.object({ id: z.string().max(64), role: z.enum(["user", "assistant"]), parts: z.array(z.record(z.string(), z.unknown())).max(40) });
const Corpo = z.object({ messages: z.array(Msg).min(1).max(30), motor: z.enum(["mae", "opus", "sonnet"]).optional() });

export const maxDuration = 300; // o serviço de IA às vezes demora mais de 2 minutos

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Não autorizado", { status: 401 });
  if (!process.env.LLM_API_KEY) return new Response("O Raio-X Eleitoral está temporariamente indisponível.", { status: 503 });

  // só user/assistant (nada de "system" injetado), últimas 20 mensagens, texto do usuário até 4 mil caracteres, tabelas encurtadas
  const r = Corpo.safeParse(await req.json().catch(() => null));
  if (!r.success) return new Response("Pedido inválido.", { status: 400 });
  type Parte = Record<string, unknown> & { type?: string; text?: unknown; output?: { linhas?: unknown[] } };
  const messages = r.data.messages.slice(-20).map((m) => m.role === "user"
    ? { ...m, parts: (m.parts as Parte[]).filter((p) => p.type === "text" && typeof p.text === "string").slice(0, 2).map((p) => ({ type: "text", text: String(p.text).slice(0, 4000) })) }
    : { ...m, parts: (m.parts as Parte[]).map((p) => p.type === "tool-consultar_sql" && Array.isArray(p.output?.linhas) ? { ...p, output: { ...p.output, linhas: p.output!.linhas!.slice(0, 30) } } : p) });
  const ultima = messages[messages.length - 1];
  const texto = (ultima.parts.find((p) => (p as Parte).type === "text") as Parte | undefined)?.text ?? "";
  const { email, podeUsar } = await acessoAnalista(userId);
  if (!podeUsar) return new Response("Suas perguntas de experiência acabaram. Peça o acesso completo para continuar.", { status: 403 });
  // escolha de motor: só o usuário mestre pode sair da API Mãe
  const motor: Motor = r.data.motor && r.data.motor !== "mae" && (email ?? "").toLowerCase() === MASTER_EMAIL && temAnthropic() ? r.data.motor : "mae";
  if (!(await dentroDoLimite(`chat:${userId}`, 40))) return new Response("Você fez muitas perguntas na última hora. Aguarde um pouco.", { status: 429 });
  // registra a pergunta (sem a resposta) no histórico de uso
  sql`insert into perguntas (email, user_id, pergunta) values (${email}, ${userId}, ${String(texto).slice(0, 2000)})`.catch(() => {});

  return createAgentUIStreamResponse({
    agent: criarAnalista({ email, userId }, motor),
    headers: { "x-motor": motor }, // para conferência: qual motor respondeu
    uiMessages: messages as unknown as Parameters<typeof createAgentUIStreamResponse>[0]["uiMessages"],
    // mensagens ao usuário sem detalhes técnicos (o motivo real vai só para o log do servidor)
    onError: (e) => {
      const err = e as { statusCode?: number; message?: string };
      console.error("analista:", err?.statusCode, err?.message ?? e);
      if (err?.statusCode === 429) return "O Raio-X Eleitoral está atendendo muitas perguntas ao mesmo tempo. Tente de novo em alguns segundos.";
      if (err?.statusCode === 401 || err?.statusCode === 404) return "O Raio-X Eleitoral está indisponível no momento. A administração do painel já foi avisada.";
      return "O Raio-X Eleitoral não conseguiu responder agora. Tente de novo em instantes; se persistir, avise a administração do painel.";
    },
  });
}
