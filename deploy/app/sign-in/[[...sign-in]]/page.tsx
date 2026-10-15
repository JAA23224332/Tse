"use client";
import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { Credito } from "@/app/credito";
import resumo from "../resumo.json";
import "../entrar.css";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pc = (n: number, d = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
const mi = (n: number) => (n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " mi";

// posição (coluna, linha) de cada UF no cartograma em azulejos, igual ao painel
const TILES: Record<string, [number, number]> = { RR: [1, 0], AP: [2, 0], AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1], AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
  MT: [1, 3], GO: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3], MS: [1, 4], DF: [2, 4], MG: [3, 4], ES: [4, 4], PR: [1, 5], SP: [2, 5], RJ: [3, 5], SC: [1, 6], RS: [1, 7] };
const LULA = ["#f0918d", "#ea5f5b", "#dc342f", "#a8151b"], FLAVIO = ["#93a7f3", "#6683ee", "#3a5fe6", "#1f3cbf"];
const cor = (m: number) => { const a = Math.abs(m), i = a <= 10 ? 0 : a <= 25 ? 1 : a <= 45 ? 2 : 3; return (m >= 0 ? LULA : FLAVIO)[i]; };

const DENTRO = [
  ["Painel", "Resultado do 1º turno por estado e município, simulador de 2º turno com as suas premissas e perfil do eleitorado."],
  ["Onde buscar votos", "Quanto cada caminho pode render, município a município e escola a escola, com premissas ajustáveis."],
  ["Mapa", "Os 5.570 municípios em áreas ou bolhas, com as escolas aparecendo ao aproximar e comparação com 2022."],
  ["Bairros", "As capitais por bairro e Brasília por região administrativa, a partir de cada local de votação."],
  ["Apuração ao vivo", "Na noite de 25 de outubro, a contagem do TSE a cada 30 segundos, com projeção do resultado final."],
  ["Raio-X Eleitoral", "Agente de IA que analisa os dados oficiais do TSE: pergunte em português e receba números, consulta usada e recomendação."],
];

export default function Entrar() {
  const { signIn } = useSignIn();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const b = resumo.brasil;
  const lideraLula = resumo.ufs.filter((u) => u.m > 0).length;

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setCarregando(true);
    try {
      const r = await fetch("/api/entrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      if (!r.ok) { setErro((await r.json()).erro ?? "Não foi possível continuar."); return; }
      const { error } = await signIn.emailCode.sendCode({ emailAddress: email.trim().toLowerCase() });
      if (error) { setErro("Não foi possível enviar o código. Confira o e-mail e tente de novo."); return; }
      setEtapa("codigo");
    } finally { setCarregando(false); }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setCarregando(true);
    try {
      const { error } = await signIn.emailCode.verifyCode({ code: codigo.trim() });
      if (error || signIn.status !== "complete") { setErro("Código incorreto ou expirado. Confira e tente de novo."); return; }
      await signIn.finalize();
      window.location.href = "/";
    } finally { setCarregando(false); }
  }

  return (
    <main className="lp">
      <header className="faixa">
        <a className="marca" href="/sign-in">2º Turno <i>2026</i></a>
        <span className="data">Eleição em <b>25 de outubro</b></span>
      </header>

      <div className="miolo">
        <section className="hero">
          <div className="apres">
            <div className="head">
              <span className="eyebrow">Dados oficiais do TSE, município por município</span>
              <h1>O 2º turno, <i>lugar por lugar</i></h1>
              <p className="sub">Resultado do 1º turno em cada estado, município e escola, simulador de cenários, mapa, apuração ao vivo e um analista que responde perguntas com os dados. Para a equipe que precisa decidir onde investir tempo e gente.</p>
            </div>

            <div className="placar" aria-label="Resultado do 1º turno">
              <div className="linha">
                <div className="cand flavio">
                  <div className="quem"><span className="tecla flavio">22</span><span><b>Flávio Bolsonaro</b> <small>PL</small></span></div>
                  <div className="pct">{pc(100 * b.flavio / b.validos)}</div>
                  <div className="v num">{fmt(b.flavio)} votos</div>
                </div>
                <div className="dif"><b className="num">{fmt(b.flavio - b.lula)}</b><span>votos de diferença</span></div>
                <div className="cand lula r">
                  <div className="quem"><span className="tecla lula">13</span><span><b>Lula</b> <small>PT</small></span></div>
                  <div className="pct">{pc(100 * b.lula / b.validos)}</div>
                  <div className="v num">{fmt(b.lula)} votos</div>
                </div>
              </div>
              <div className="split" aria-hidden="true"><span style={{ flex: b.flavio, background: "var(--flavio)" }} /><span style={{ flex: b.eliminados, background: "var(--neutral)" }} /><span style={{ flex: b.lula, background: "var(--lula)" }} /></div>
              <p className="fonte">{resumo.atualizado}. Em cinza, os {mi(b.eliminados)} de votos dos candidatos eliminados, que decidem o 2º turno.</p>
            </div>
          </div>

          <div className="login panel">
            <div style={{ display: "grid", gap: 6 }}>
              <h2>{etapa === "email" ? "Entrar" : "Confirme o código"}</h2>
              <p className="muted small">
                {etapa === "email" ? "Informe seu e-mail. Enviamos um código de acesso, sem senha." : `Enviamos um código de 6 dígitos para ${email}.`}
              </p>
            </div>
            {etapa === "email" ? (
              <form onSubmit={enviarCodigo}>
                <label htmlFor="email">E-mail</label>
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" />
                <button type="submit" className="btn primary ok" disabled={carregando}>{carregando ? "Enviando…" : "Receber código"}</button>
              </form>
            ) : (
              <form onSubmit={confirmar}>
                <label htmlFor="codigo">Código</label>
                <input id="codigo" className="cod" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={6} value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
                <button type="submit" className="btn primary ok" disabled={carregando || codigo.length < 6}>{carregando ? "Confirmando…" : "Entrar"}</button>
                <button type="button" className="link" onClick={() => { setEtapa("email"); setCodigo(""); setErro(""); }}>Usar outro e-mail ou reenviar código</button>
              </form>
            )}
            {erro && <p role="alert" className="erro">{erro}</p>}
            <p className="acesso">O código chega em alguns segundos; confira também a caixa de spam. O acesso é restrito à equipe.</p>
          </div>
        </section>

        <section className="brasil">
          <div className="azulejos" role="img" aria-label="Margem por estado no 1º turno">
            {Object.entries(TILES).map(([uf, [c, l]]) => { const u = resumo.ufs.find((x) => x.uf === uf); const m = u?.m ?? 0; return (
              <div key={uf} className={`az${u?.gov ? " gov" : ""}`} style={{ gridColumn: c + 1, gridRow: l + 1, background: cor(m) }} title={`${uf}: ${m > 0 ? "Lula" : "Flávio"} +${Math.abs(m).toLocaleString("pt-BR")} p.p.`}>
                <b>{uf}</b><span>{(m > 0 ? "+" : "") + m.toFixed(0)}</span>
              </div>); })}
          </div>
          <div className="leitura">
            <h2>Um país dividido ao meio, com mapas diferentes</h2>
            <p>Lula lidera em {lideraLula} estados, Flávio Bolsonaro em {27 - lideraLula}. O número em cada estado é a margem em pontos. A disputa se decide nos {mi(b.eliminados)} de votos de quem saiu da corrida, nos {mi(b.brancos + b.nulos)} de brancos e nulos e nos {mi(b.abstencao)} de eleitores que não foram votar.</p>
            <div className="leg"><span><i style={{ background: "var(--lula)" }} />Lula lidera</span><span><i style={{ background: "var(--flavio)" }} />Flávio lidera</span><span><i className="pt" />também escolhe governador</span></div>
          </div>
        </section>

        <section className="dentro">
          <div className="head">
            <h2>O que há dentro</h2>
            <p className="muted">Seis ferramentas sobre a mesma base: {fmt(resumo.municipios)} municípios, 27 estados e 93 mil locais de votação, com os resultados oficiais de 2026 e 2022 e o perfil do eleitorado.</p>
          </div>
          <div className="grade">
            {DENTRO.map(([t, d], i) => <div className="item" key={t}><span className="n">{i + 1}</span><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </section>
      </div>

      <div className="rodape"><Credito /></div>
    </main>
  );
}
