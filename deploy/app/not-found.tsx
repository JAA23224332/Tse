import { Credito } from "@/app/credito";

export default function NaoEncontrada() {
  return (
    <main className="wrap" style={{ maxWidth: 600, gap: 20 }}>
      <header className="head"><span className="eyebrow">Erro 404</span><h1>Página não encontrada</h1><p className="muted">O endereço não existe ou foi digitado errado.</p></header>
      <a className="btn primary" href="/" style={{ justifySelf: "start", textDecoration: "none" }}>Voltar ao painel</a>
      <Credito />
    </main>
  );
}
