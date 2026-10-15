import { perfilAtual, podeUsarAnalista } from "@/lib/acesso";
import { Credito } from "@/app/credito";
import { Chat } from "./chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Raio-X Eleitoral" };

export default async function Analista() {
  const { email, perfil } = await perfilAtual();
  if (podeUsarAnalista(perfil)) return <Chat />;

  const textos = {
    pendente: ["Seu pedido está em análise", "Recebemos sua solicitação de acesso ao Raio-X Eleitoral. Assim que for aprovada, você recebe um e-mail e esta página passa a abrir o chat."],
    recusado: ["Seu pedido não foi aprovado", "A solicitação feita com este e-mail não foi aprovada. Se acha que houve engano, fale com a administração do painel."],
    visitante: ["O Raio-X Eleitoral exige aprovação", "O Raio-X Eleitoral é o agente de IA que analisa os dados oficiais do TSE para a campanha e, por isso, só é liberado para pessoas aprovadas. As demais páginas continuam abertas para você."],
  } as const;
  const [titulo, texto] = textos[perfil as keyof typeof textos] ?? textos.visitante;

  return (
    <main className="wrap" style={{ maxWidth: 640, gap: 20 }}>
      <header className="head">
        <span className="eyebrow">Raio-X Eleitoral · acesso restrito</span>
        <h1>{titulo}</h1>
        <p className="muted">{texto}</p>
      </header>
      <div className="panel outline" style={{ display: "grid", gap: 10 }}>
        <p className="small muted">Você está logada(o) como <b>{email}</b>.</p>
        {perfil === "visitante" && <a className="btn primary" href="/solicitar" style={{ justifySelf: "start", textDecoration: "none" }}>Solicitar acesso</a>}
        <a href="/" className="small" style={{ color: "var(--ink)" }}>Voltar ao painel</a>
      </div>
      <Credito />
    </main>
  );
}
