import { governadores, type Governadores } from "@/lib/governadores";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Pública, como /api/apuracao. Seis arquivos do TSE; cache curto por instância e na CDN para não repetir a leitura a cada visita.
const MEMORIA_S = 30;
let memoria: { em: number; dados: Governadores } | null = null;
let emCurso: Promise<Governadores> | null = null;

export async function GET() {
  const agora = Date.now();
  const cabecalhos = { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" };
  if (memoria && agora - memoria.em < MEMORIA_S * 1000) return Response.json(memoria.dados, { headers: cabecalhos });
  try {
    emCurso ??= governadores().finally(() => { emCurso = null; });
    const dados = await emCurso;
    // TSE fora: mantém a última leitura boa das UFs que falharam
    if (memoria && dados.falhas.length) {
      for (const uf of dados.falhas) { const velha = memoria.dados.ufs.find((u) => u.uf === uf); if (velha) dados.ufs.push(velha); }
    }
    if (dados.ufs.length) memoria = { em: Date.now(), dados };
    return Response.json(dados, { headers: cabecalhos });
  } catch (e) {
    console.error("governadores:", (e as Error).message);
    if (memoria) return Response.json(memoria.dados);
    return Response.json({ erro: "Não foi possível obter a apuração dos governadores agora." }, { status: 503 });
  }
}
