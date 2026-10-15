import { Credito } from "@/app/credito";

/** Mostrado quando a conta logada não é administradora. */
export function SemAcesso({ email }: { email: string | null }) {
  return (
    <main className="wrap" style={{ maxWidth: 600, gap: 20 }}>
      <header className="head">
        <span className="eyebrow">Área da administração</span>
        <h1>Esta conta não é administradora</h1>
        <p className="muted">Você está logada(o) como <b>{email ?? "—"}</b>. As páginas de acessos e de solicitações só abrem para as contas cadastradas como administradoras.</p>
      </header>
      <div className="panel outline" style={{ display: "grid", gap: 10 }}>
        <p className="small muted">Se você é administradora, saia e entre de novo com o e-mail cadastrado.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn primary" href="/sair" style={{ textDecoration: "none" }}>Sair e trocar de conta</a>
          <a className="btn" href="/" style={{ textDecoration: "none" }}>Voltar ao painel</a>
        </div>
      </div>
      <Credito />
    </main>
  );
}
