"use client";
import { Credito } from "@/app/credito";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap" style={{ maxWidth: 600, gap: 20 }}>
      <header className="head"><span className="eyebrow">Algo deu errado</span><h1>Não foi possível abrir esta página</h1><p className="muted">Tente de novo; se continuar, avise a administração do painel.</p></header>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn primary" type="button" onClick={reset}>Tentar de novo</button>
        <a className="btn" href="/" style={{ textDecoration: "none" }}>Voltar ao painel</a>
      </div>
      <Credito />
    </main>
  );
}
