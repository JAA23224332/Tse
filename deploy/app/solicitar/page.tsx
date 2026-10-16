import { auth } from "@clerk/nextjs/server";
import { emailAtual } from "@/lib/admin";
import { Credito } from "@/app/credito";
import { Vitrine } from "@/app/analista/vitrine";
import { Acesso } from "@/app/analista/acesso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acesso ao Raio-X" };

export default async function Solicitar() {
  const { userId } = await auth().catch(() => ({ userId: null as string | null }));
  const email = userId ? await emailAtual().catch(() => null) : null;
  return (
    <main className="wrap" style={{ maxWidth: 820, gap: 22 }}>
      <header className="head">
        <span className="eyebrow">Raio-X Eleitoral</span>
        <h1>Acesso ao Raio-X</h1>
        <p className="muted">O Raio-X é o agente de IA que responde perguntas sobre os dados oficiais do TSE. Entre com um código ou peça acesso.</p>
      </header>
      <div className="an"><Acesso email={email} inicial="pedido" /></div>
      <section style={{ display: "grid", gap: 10 }}>
        <h2>O que o Raio-X responde</h2>
        <div className="an"><Vitrine /></div>
      </section>
      <Credito />
    </main>
  );
}
