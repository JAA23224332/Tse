import { auth } from "@clerk/nextjs/server";
import { emailAtual } from "@/lib/admin";
import { Credito } from "@/app/credito";
import { Vitrine } from "@/app/analista/vitrine";
import { Formulario } from "./formulario";
import { EntrarComCodigo } from "@/app/analista/codigo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedir acesso ao Raio-X" };

export default async function Solicitar() {
  const { userId } = await auth().catch(() => ({ userId: null as string | null }));
  const email = userId ? await emailAtual().catch(() => null) : null;
  return (
    <main className="wrap" style={{ maxWidth: 820, gap: 22 }}>
      <header className="head">
        <span className="eyebrow">Raio-X Eleitoral</span>
        <h1>Pedir acesso</h1>
        <p className="muted">O Raio-X é o agente de IA que responde perguntas sobre os dados oficiais do TSE. Diga quem você é; a administração libera o acesso e manda o link de entrada.</p>
      </header>
      <div className="an"><EntrarComCodigo compacto /></div>
      <div className="an"><Formulario email={email} /></div>
      <section style={{ display: "grid", gap: 10 }}>
        <h2>O que o Raio-X responde</h2>
        <div className="an"><Vitrine /></div>
      </section>
      <Credito />
    </main>
  );
}
