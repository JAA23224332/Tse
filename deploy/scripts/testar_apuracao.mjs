// Testes de sanidade do motor de apuração. Rodar de deploy/: node --experimental-strip-types scripts/testar_apuracao.mjs
import { apurar, carregarBase, lerUF, projetar, UFS } from "../lib/apuracao.ts";
let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok  " : "  FALHA") + " " + msg); if (!cond) falhas++; };

// 1) 1º turno a 100%: projeção == contado em cada UF, swing 0, Brasil igual ao arquivo nacional
const r = await apurar("ele2026", 6257, 1, "13", "22");
ok(r.falhas.length === 0, `sem falhas de UF (${r.falhas.join(",") || "nenhuma"})`);
ok(r.ufs.length === 28, `28 UFs lidas (${r.ufs.length})`);
let maxDif = 0, maxSwing = 0;
for (const u of r.ufs) { maxDif = Math.max(maxDif, Math.abs(u.projLula - u.lula), Math.abs(u.projFlavio - u.flavio)); maxSwing = Math.max(maxSwing, Math.abs(u.swing)); }
ok(maxDif <= 1, `projeção == contado por UF a 100% (maior diferença ${maxDif} voto)`);
ok(maxSwing < 1e-9, `swing zero a 100% (máx ${maxSwing.toExponential(1)})`);
ok(r.brasil.lula === 53879538 && r.brasil.flavio === 56104503, `Brasil contado = oficial (${r.brasil.lula} × ${r.brasil.flavio})`);
ok(Math.abs(r.brasil.projLula - r.brasil.lula) <= 28 && Math.abs(r.brasil.projFlavio - r.brasil.flavio) <= 28, `Brasil projetado == contado (${r.brasil.projLula - r.brasil.lula}, ${r.brasil.projFlavio - r.brasil.flavio})`);
ok(r.brasil.faixa !== null && r.brasil.faixa <= 0.3, `faixa mínima a 100% (${r.brasil.faixa})`);

// 2) apuração parcial sintética: só municípios < 20 mil eleitores apurados, com +3 p.p. uniformes para Lula
const base = await carregarBase();
const lidas = [];
for (const uf of UFS) {
  const muns = Object.entries(base).filter(([k]) => k.startsWith(uf));
  let lula = 0, flavio = 0; const abr = [];
  for (const [k, m] of muns) {
    const f = m.eleitorado < 20000 ? 1 : 0, tot = m.lula + m.flavio;
    if (tot > 0) { const marg = Math.max(-1, Math.min(1, (m.lula - m.flavio) / tot + 0.03)); lula += f * tot * (1 + marg) / 2; flavio += f * tot * (1 - marg) / 2; }
    abr.push({ tpabr: "mun", cdabr: k.slice(2), s: { ts: "10", st: String(10 * f) } });
  }
  const parcial = { ele: "6257", carg: [{ cd: "1", agr: [{ par: [{ cand: [{ n: "13", vap: String(Math.round(lula)) }, { n: "22", vap: String(Math.round(flavio)) }] }] }] }], v: { vvc: String(Math.round(lula + flavio)) }, e: {}, s: { st: "1", ts: "10", pstn: "10" } };
  lidas.push(lerUF(uf, parcial, { abr }, base, "13", "22", 6257));
}
const p = projetar(lidas);
const totL = Object.values(base).reduce((s, m) => s + m.lula, 0), totF = Object.values(base).reduce((s, m) => s + m.flavio, 0);
// esperado: cada município com +3 p.p. → total esperado
let espL = 0; for (const m of Object.values(base)) { const t = m.lula + m.flavio; if (t) espL += t * (1 + Math.max(-1, Math.min(1, (m.lula - m.flavio) / t + 0.03))) / 2; }
const projPct = 100 * p.projLula / (p.projLula + p.projFlavio), espPct = 100 * espL / (totL + totF);
ok(Math.abs(projPct - espPct) < 0.15, `parcial sintético (+3 p.p., só cidades pequenas): projetado ${projPct.toFixed(2)}% vs esperado ${espPct.toFixed(2)}% (1º turno: ${(100 * totL / (totL + totF)).toFixed(2)}%)`);
const semConf = p.ufs.filter((u) => !u.swingConfiavel).map((u) => u.uf);
ok(semConf.length <= 2, `UFs sem swing confiável no sintético: ${semConf.join(",") || "nenhuma"}`);
ok(p.faixa > 1, `faixa larga com pouca apuração (${p.faixa})`);

// 3) arquivos do 2º turno (6258): mesmo número de municípios que a base, por UF
let difs = [];
for (const uf of UFS) {
  try {
    const ab = await (await fetch(`https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${uf}/${uf}-e006258-ab.json`, { signal: AbortSignal.timeout(8000) })).json();
    const nMun = ab.abr.filter((m) => m.tpabr === "mun").length, nBase = Object.keys(base).filter((k) => k.startsWith(uf)).length;
    if (nMun !== nBase) difs.push(`${uf}:${nMun}/${nBase}`);
  } catch (e) { difs.push(`${uf}:erro`); }
}
ok(difs.length === 0, `6258: municípios por UF batem com a base ${difs.length ? "(" + difs.join(" ") + ")" : ""}`);
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo");
process.exit(falhas ? 1 : 0);
