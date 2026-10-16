import { auth } from "@clerk/nextjs/server";
import { acessoAnalista } from "@/lib/acesso";
import { Credito } from "@/app/credito";
import { Chat } from "./chat";
import { Aguardando } from "./aguardando";

export const dynamic = "force-dynamic";
export const metadata = { title: "Raio-X Eleitoral" };

export default async function Analista() {
  const { userId } = await auth();
  const a = await acessoAnalista(userId!);
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
