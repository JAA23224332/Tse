import { Credito } from "@/app/credito";
import { Vitrine } from "./vitrine";

/** Tela de quem já pediu acesso e espera a liberação. */
export function Aguardando({ email }: { email: string | null }) {
  return (
    <main className="wrap" style={{ maxWidth: 820, gap: 22 }}>
      <header className="head">
        <span className="eyebrow">Raio-X Eleitoral</span>
        <h1>Aguardando liberação</h1>
        <p className="muted">Recebemos seu pedido. A administração do painel confere quem é você e libera o acesso para <b>{email}</b> e manda o código ou link de entrada pelo WhatsApp. Costuma levar pouco tempo.</p>
      </header>
      <div className="panel outline" style={{ display: "grid", gap: 10 }}>
        <b>Enquanto isso</b>
        <p className="small muted" style={{ margin: 0 }}>As outras páginas continuam abertas para você: resultado por estado, município e escola, estratégia, mapa e apuração ao vivo.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn primary" href="/" style={{ textDecoration: "none" }}>Painel</a>
          <a className="btn" href="/estrategia" style={{ textDecoration: "none" }}>Estratégia</a>
          <a className="btn" href="/mapa" style={{ textDecoration: "none" }}>Mapa</a>
          <a className="btn" href="/apuracao" style={{ textDecoration: "none" }}>Apuração ao vivo</a>
        </div>
      </div>
      <section style={{ display: "grid", gap: 10 }}>
        <h2>O que o Raio-X responde</h2>
        <div className="an"><Vitrine /></div>
      </section>
      <Credito />
    </main>
  );
}
