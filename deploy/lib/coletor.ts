/**
 * Coleta e distribuição da apuração: um único coletor lê o TSE e grava no Neon; todos os leitores usam o Neon.
 * Assim a carga sobre o TSE não depende de quantas pessoas abrem a página.
 */
import { apurar, type Apuracao } from "./apuracao";
import { sql } from "./db";

export const CICLO = "ele2026";
export const SEGUNDO_TURNO = 6258, PRIMEIRO_TURNO = 6257;
export const ABERTURA = Date.parse("2026-10-25T20:00:00Z"); // 17h de Brasília: urnas fecham e a totalização começa
export type Modo = "oficial" | "aguardando" | "demonstracao";
export type Resposta = Apuracao & { modo: Modo; fonte: "tse" | "neon" | "memoria"; idade: number };

export function modoDe(t2: Apuracao | null): Modo {
  if (t2 && t2.brasil.secoes > 0) return "oficial";
  if (t2 && Date.now() >= ABERTURA) return "aguardando";
  return "demonstracao";
}

/** Último snapshot gravado do 2º turno (ou null). */
export async function ultimoSnapshot(): Promise<{ dados: Apuracao; criado_em: string } | null> {
  const [r] = (await sql`select dados, criado_em from apuracao_snapshots where eleicao = ${SEGUNDO_TURNO} order by id desc limit 1`) as { dados: Apuracao; criado_em: string }[];
  return r ?? null;
}

/** Grava um snapshot do 2º turno, no máximo um por minuto e só quando há seções totalizadas. */
export async function gravarSnapshot(dados: Apuracao) {
  if (dados.eleicao !== SEGUNDO_TURNO || dados.brasil.secoes === 0) return false;
  const r = await sql`
    insert into apuracao_snapshots (eleicao, dados)
    select ${SEGUNDO_TURNO}, ${JSON.stringify(dados)}::jsonb
    where not exists (select 1 from apuracao_snapshots where eleicao = ${SEGUNDO_TURNO} and criado_em > now() - interval '55 seconds')
    returning id`;
  return r.length > 0;
}

/** Varredura completa do 2º turno no TSE (usada pelo coletor e pelo leitor em emergência). */
export async function varrer(anterior?: Apuracao | null) {
  return apurar(CICLO, SEGUNDO_TURNO, 1, "13", "22", anterior);
}

export async function demonstracao() {
  return apurar(CICLO, PRIMEIRO_TURNO, 1, "13", "22");
}
