import { Credito } from "@/app/credito";

export default function NaoGerada() {
  return (
    <main className="wrap" style={{ maxWidth: 600, gap: 20 }}>
      <header className="head"><span className="eyebrow">Em preparação</span><h1>Esta página ainda não foi gerada</h1><p className="muted">Os dados dela ainda não foram processados. Tente mais tarde.</p></header>
      <a className="btn primary" href="/" style={{ justifySelf: "start", textDecoration: "none" }}>Voltar ao painel</a>
      <Credito />
    </main>
  );
}
