import { emailAtual, ehAdmin } from "@/lib/admin";
import { SemAcesso } from "@/app/admin/semacesso";
import { Credito } from "@/app/credito";
import { Gerador } from "./gerador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links de acesso" };

export default async function Links() {
  const email = await emailAtual();
  if (!ehAdmin(email)) return <SemAcesso email={email} />;
  return (
    <main className="wrap" style={{ maxWidth: 760, gap: 24 }}>
      <header className="head">
        <span className="eyebrow">Quando o código não chega</span>
        <h1>Link de acesso</h1>
        <p className="muted">Gere um link para a pessoa entrar sem código. Vale por 48 horas e só uma vez; mande pelo WhatsApp. Se o e-mail ainda não tem conta, ela é criada.</p>
        <nav className="small" style={{ display: "flex", gap: 14 }}><a href="/admin" style={{ color: "var(--ink)" }}>Acessos</a><a href="/admin/solicitacoes" style={{ color: "var(--ink)" }}>Solicitações</a></nav>
      </header>
      <Gerador />
      <Credito />
    </main>
  );
}
