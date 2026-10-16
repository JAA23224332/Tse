import { ipAddress } from "@vercel/functions";
import { sql } from "@/lib/db";
import { dentroDoLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UF = /^[A-Z]{2}$/;
const LIMITE_JSON = 1000;
const LIMITE_CSV = 60000;

/** Microdados por seção eleitoral (tabela secoes), filtrados por UF, município, zona, seção ou texto. */
export async function GET(req: Request) {
  const userId = ipAddress(req) ?? "sem-ip";  // página aberta: a cota é por endereço
  if (!(await dentroDoLimite(`secoes:${userId}`, 120))) return Response.json({ erro: "Muitas buscas em pouco tempo. Aguarde alguns minutos." }, { status: 429 });
  const p = new URL(req.url).searchParams;
  const uf = (p.get("uf") ?? "").toUpperCase();
  const mun = (p.get("mun") ?? "").trim();
  const zona = p.get("zona")?.trim();
  const secao = p.get("secao")?.trim();
  const q = (p.get("q") ?? "").trim();
  const csv = p.get("formato") === "csv";
  if (!UF.test(uf)) return Response.json({ erro: "Informe a UF." }, { status: 400 });
  if (mun && !/^\d{5}$/.test(mun)) return Response.json({ erro: "Código de município inválido." }, { status: 400 });
  if (!mun && !q && !(zona && secao)) return Response.json({ erro: "Escolha um município, ou zona e seção, ou um texto para buscar." }, { status: 400 });
  if (csv && !mun && !(zona && secao)) return Response.json({ erro: "Para baixar o CSV, escolha um município ou uma zona e seção." }, { status: 400 });
  if (csv && !(await dentroDoLimite(`secoes-csv:${userId}`, 8))) return Response.json({ erro: "Muitos downloads em pouco tempo. Aguarde uma hora." }, { status: 429 });
  if (q && q.length < 4 && !mun) return Response.json({ erro: "Para buscar por texto em todo o estado, digite pelo menos 4 letras ou escolha um município." }, { status: 400 });

  const cond: string[] = ["uf = $1"];
  const args: unknown[] = [uf];
  if (mun) { args.push(mun); cond.push(`cd_tse = $${args.length}`); }
  if (zona && /^\d+$/.test(zona)) { args.push(Number(zona)); cond.push(`zona = $${args.length}`); }
  if (secao && /^\d+$/.test(secao)) { args.push(Number(secao)); cond.push(`(secao = $${args.length} or secao_principal = $${args.length})`); }
  if (q) { args.push(`%${q}%`); cond.push(`(local ilike $${args.length} or bairro ilike $${args.length} or endereco ilike $${args.length} or municipio ilike $${args.length})`); }
  const where = cond.join(" and ");
  const limite = csv ? LIMITE_CSV : LIMITE_JSON;

  try {
    const [linhas, tot, candidatos] = await Promise.all([
      sql.query(`select * from secoes where ${where} order by municipio, zona, secao limit ${limite + 1}`, args) as Promise<Record<string, unknown>[]>,
      sql.query(`select count(*)::int as secoes, coalesce(sum(aptos),0)::bigint as aptos, coalesce(sum(comparecimento),0)::bigint as comparecimento,
                 coalesce(sum(abstencao),0)::bigint as abstencao, coalesce(sum(validos),0)::bigint as validos, coalesce(sum(lula),0)::bigint as lula,
                 coalesce(sum(flavio),0)::bigint as flavio, coalesce(sum(brancos),0)::bigint as brancos, coalesce(sum(nulos),0)::bigint as nulos,
                 coalesce(sum(eliminados),0)::bigint as eliminados from secoes where ${where}`, args) as Promise<Record<string, number>[]>,
      sql`select numero, nome from candidatos order by numero`.then((x) => x as { numero: string; nome: string }[]),
    ]);
    const truncado = linhas.length > limite;
    if (truncado) linhas.pop();
    if (csv) {
      const cols = linhas.length ? Object.keys(linhas[0]) : [];
      const nomeCol = (c: string) => { const m = /^v(\d+)$/.exec(c); const cand = m && candidatos.find((x) => x.numero === m[1]); return cand ? `votos_${m[1]}_${cand.nome.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}` : c; };
      const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const corpo = [cols.map(nomeCol).join(";"), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(";"))].join("\n");
      const nome = `secoes_${uf}${mun ? "_" + mun : ""}${zona ? "_z" + zona : ""}${secao ? "_s" + secao : ""}.csv`;
      return new Response("﻿" + corpo, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${nome}"`, "cache-control": "private, max-age=86400" } });
    }
    return Response.json({ linhas, totais: tot[0], candidatos, truncado, limite });
  } catch (e) {
    const msg = (e as Error).message;
    if (/relation "secoes" does not exist/.test(msg)) return Response.json({ erro: "A base por seção ainda não foi carregada no banco." }, { status: 503 });
    console.error("secoes:", msg);
    return Response.json({ erro: "Não foi possível buscar as seções agora. Tente de novo em instantes." }, { status: 500 });
  }
}
