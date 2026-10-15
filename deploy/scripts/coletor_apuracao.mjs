// Coletor da apuração para rodar no PC na noite de 25/10 (IP diferente do Vercel):
//   cd deploy && node --env-file=.env.local --experimental-strip-types scripts/coletor_apuracao.mjs
// A cada 60 s varre o TSE, projeta e envia o snapshot ao site, que grava no banco.
import { apurar } from "../lib/apuracao.ts";

const ABERTURA = Date.parse("2026-10-25T20:00:00Z"); // 17h de Brasília
const varrer = (anterior) => apurar("ele2026", 6258, 1, "13", "22", anterior);
const modoDe = (t2) => (t2.brasil.secoes > 0 ? "oficial" : Date.now() >= ABERTURA ? "aguardando" : "demonstracao");

const SITE = process.env.SITE_URL ?? "https://segundoturno.blog";
const TOKEN = process.env.COLETOR_TOKEN;
if (!TOKEN) { console.error("COLETOR_TOKEN ausente no .env.local"); process.exit(1); }
let anterior = null;

async function ciclo() {
  const t0 = Date.now();
  try {
    const dados = await varrer(anterior);
    anterior = dados;
    const modo = modoDe(dados);
    let gravado = false;
    if (modo === "oficial") {
      const r = await fetch(`${SITE}/api/apuracao/coletar`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ dados }) });
      gravado = (await r.json()).gravado;
    }
    const b = dados.brasil, tot = b.lula + b.flavio;
    console.log(new Date().toLocaleTimeString("pt-BR"), `| ${modo} | ${b.pst.toFixed(2)}% seções | Lula ${tot ? (100 * b.lula / tot).toFixed(2) : "—"}% | proj ${b.projLula && b.projFlavio ? (100 * b.projLula / (b.projLula + b.projFlavio)).toFixed(2) + "% ±" + b.faixa : "—"} | falhas ${dados.falhas.join(",") || "nenhuma"} | ${gravado ? "gravado" : "não gravado"} | ${Date.now() - t0} ms`);
  } catch (e) {
    console.error(new Date().toLocaleTimeString("pt-BR"), "erro:", e.message);
  }
}
await ciclo();
setInterval(ciclo, 60_000);
