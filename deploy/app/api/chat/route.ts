import { auth } from "@clerk/nextjs/server";
import { createAgentUIStreamResponse } from "ai";
import { criarAnalista } from "@/lib/analista";
import { perfilAtual, podeUsarAnalista } from "@/lib/acesso";
import { sql } from "@/lib/db";

export const maxDuration = 300; // o serviço de IA às vezes demora mais de 2 minutos

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Não autorizado", { status: 401 });
  if (!process.env.LLM_API_KEY) return new Response("O Raio-X Eleitoral está temporariamente indisponível.", { status: 503 });

  const { messages } = await req.json();
  const ultima = messages?.at?.(-1);
  const texto = ultima?.parts?.find?.((p: { type: string }) => p.type === "text")?.text ?? "";
  const { email, perfil } = await perfilAtual();
  if (!podeUsarAnalista(perfil)) return new Response("Seu acesso ao Raio-X Eleitoral ainda não foi aprovado.", { status: 403 });
  // registra a pergunta (sem a resposta) no histórico de uso
  sql`insert into perguntas (email, user_id, pergunta) values (${email}, ${userId}, ${String(texto).slice(0, 2000)})`.catch(() => {});

  return createAgentUIStreamResponse({
    agent: criarAnalista({ email, userId }),
    uiMessages: messages,
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
