import { auth } from "@clerk/nextjs/server";
import { acessoAnalista } from "@/lib/acesso";
import { Credito } from "@/app/credito";
import { Chat } from "./chat";
import { Aguardando } from "./aguardando";
import { Vitrine } from "./vitrine";
import { Acesso } from "./acesso";

function SemLogin() {
  return (
    <main className="wrap" style={{ maxWidth: 820, gap: 22 }}>
      <header className="head">
        <span className="eyebrow">Raio-X Eleitoral · agente de IA sobre os dados oficiais do TSE</span>
        <h1>Pergunte aos dados da eleição</h1>
        <p className="muted">Em português, resposta em segundos com números, tabela e PDF. Para conversar com o Raio-X é preciso um código de acesso; o resto do painel é aberto.</p>
      </header>
      <div className="an"><Acesso email={null} /></div>
      <p className="small muted" style={{ margin: 0 }}>Já tem acesso aprovado? Use o código ou o link que a administração enviou.</p>
      <div className="an"><Vitrine /></div>
      <Credito />
    </main>
  );
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Raio-X Eleitoral" };

export default async function Analista() {
  const { userId } = await auth().catch(() => ({ userId: null as string | null }));
  if (!userId) return <SemLogin />;
  const a = await acessoAnalista(userId);
  if (a.perfil === "recusado") {
    return (
      <main className="wrap" style={{ maxWidth: 640, gap: 20 }}>
        <header className="head"><span className="eyebrow">Raio-X Eleitoral</span><h1>Seu pedido não foi aprovado</h1><p className="muted">A solicitação feita com <b>{a.email}</b> não foi aprovada. Se acha que houve engano, fale com a administração do painel.</p></header>
        <a href="/" className="btn" style={{ justifySelf: "start", textDecoration: "none" }}>Voltar ao painel</a>
        <Credito />
      </main>
    );
  }
  if (a.perfil === "pendente") return <Aguardando email={a.email} />;
  return <Chat modo={a.podeUsar && a.restantes === null ? "completo" : "degustacao"} perfil={a.perfil} restantes={a.restantes ?? 0} email={a.email} />;
}
