import { auth } from "@clerk/nextjs/server";
import { apurar, type Apuracao } from "@/lib/apuracao";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Eleição acompanhada: 2º turno (6258). Enquanto o TSE não publica os arquivos do 2º turno, cai no 1º turno
// (6257) em modo de demonstração; na noite de 25/10 a troca é automática.
const CICLO = "ele2026";
const SEGUNDO_TURNO = 6258, PRIMEIRO_TURNO = 6257;
const INTERVALO_S = 30;

type Modo = "oficial" | "aguardando" | "demonstracao";
type Resposta = Apuracao & { modo: Modo };
const ABERTURA = Date.parse("2026-10-25T20:00:00Z"); // 17h de Brasília: urnas fecham e a totalização começa
let memoria: { em: number; dados: Resposta } | null = null;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Não autorizado", { status: 401 });

  const agora = Date.now();
  if (memoria && agora - memoria.em < INTERVALO_S * 1000) return Response.json(memoria.dados);

  try {
    // O TSE publica os arquivos do 2º turno zerados dias antes; só vale "oficial" quando há seção totalizada.
    let dados: Resposta;
    const t2 = await apurar(CICLO, SEGUNDO_TURNO, 1, "13", "22").catch((e) => { console.error("apuracao 6258:", (e as Error).message); return null; });
    if (t2 && t2.brasil.secoes > 0) dados = { ...t2, modo: "oficial" };
    else if (t2 && Date.now() >= ABERTURA) dados = { ...t2, modo: "aguardando" };
    else dados = { ...(await apurar(CICLO, PRIMEIRO_TURNO, 1, "13", "22")), modo: "demonstracao" };
    memoria = { em: agora, dados };
    // guarda o histórico da noite para o gráfico e para auditoria
    if (dados.modo === "oficial") {
      sql`insert into apuracao_snapshots (eleicao, dados) values (${SEGUNDO_TURNO}, ${JSON.stringify(dados)}::jsonb)`.catch(() => {});
    }
    return Response.json(dados);
  } catch (e) {
    if (memoria) return Response.json(memoria.dados);
    return Response.json({ erro: `O TSE não respondeu (${(e as Error).message})` }, { status: 503 });
  }
}
