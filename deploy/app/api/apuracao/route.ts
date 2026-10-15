import { waitUntil } from "@vercel/functions";
import { demonstracao, gravarSnapshot, modoDe, ultimoSnapshot, varrer, type Resposta } from "@/lib/coletor";
import type { Apuracao } from "@/lib/apuracao";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pública (dados do TSE): não exige login, para a apuração continuar acessível mesmo se o login falhar na noite.
const FRESCO_S = 150;      // idade máxima do snapshot do Neon antes de a rota varrer o TSE por conta própria
const MEMORIA_S = 20;      // cache por instância, só para absorver rajadas
let memoria: { em: number; dados: Resposta } | null = null;
let emCurso: Promise<Resposta> | null = null;  // evita varreduras paralelas na mesma instância

async function montar(): Promise<Resposta> {
  const agora = Date.now();
  // 1) snapshot recente do coletor
  const snap = await ultimoSnapshot().catch((e) => { console.error("neon:", (e as Error).message); return null; });
  if (snap) {
    const idade = Math.round((agora - new Date(snap.criado_em).getTime()) / 1000);
    if (idade <= FRESCO_S) return { ...snap.dados, modo: "oficial", fonte: "neon", idade };
  }
  // 2) varredura própria (coletor parado ou ainda sem seções)
  const t2 = await varrer(snap?.dados ?? memoria?.dados ?? null).catch((e) => { console.error("apuracao 6258:", (e as Error).message); return null; });
  const modo = modoDe(t2);
  if (modo === "oficial" && t2) { waitUntil(gravarSnapshot(t2).catch(() => {})); return { ...t2, modo, fonte: "tse", idade: 0 }; }
  if (modo === "aguardando" && t2) return { ...t2, modo, fonte: "tse", idade: 0 };
  if (snap) { // TSE fora do ar: último dado conhecido
    const idade = Math.round((agora - new Date(snap.criado_em).getTime()) / 1000);
    return { ...snap.dados, modo: "oficial", fonte: "neon", idade };
  }
  const demo: Apuracao = await demonstracao();
  return { ...demo, modo: "demonstracao", fonte: "tse", idade: 0 };
}

export async function GET() {
  const agora = Date.now();
  if (memoria && agora - memoria.em < MEMORIA_S * 1000) return Response.json({ ...memoria.dados, fonte: "memoria", idade: memoria.dados.idade + Math.round((agora - memoria.em) / 1000) });
  try {
    emCurso ??= montar().finally(() => { emCurso = null; });
    const dados = await emCurso;
    memoria = { em: Date.now(), dados };
    return Response.json(dados, { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("apuracao:", (e as Error).message);
    if (memoria) return Response.json({ ...memoria.dados, fonte: "memoria", idade: memoria.dados.idade + Math.round((agora - memoria.em) / 1000) });
    return Response.json({ erro: "Não foi possível obter a apuração agora. Tente de novo em instantes." }, { status: 503 });
  }
}
