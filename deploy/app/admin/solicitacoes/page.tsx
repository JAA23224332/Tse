import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { Credito } from "@/app/credito";
import { SemAcesso } from "@/app/admin/semacesso";
import { decidir } from "./acoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitações de acesso" };

type Sol = {
  id: number; nome: string; email: string; organizacao: string; cargo: string | null; cidade: string | null; uf: string | null;
  whatsapp: string | null; finalidade: string | null; indicacao: string | null; status: string; motivo: string | null;
  criado_em: string; decidido_em: string | null; decidido_por: string | null; perguntas: number;
};
const quando = (s: string | null) => s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
const rotulo: Record<string, string> = { pendente: "Pendente", aprovada: "Aprovada", recusada: "Recusada" };

function Cartao({ s }: { s: Sol }) {
  return (
    <div className="panel outline" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div><b style={{ fontSize: 17 }}>{s.nome}</b> <span className="muted">· {s.organizacao}{s.cargo ? `, ${s.cargo}` : ""}</span></div>
        <span className={`tag ${s.status === "aprovada" ? "lula" : ""}`}>{rotulo[s.status] ?? s.status}</span>
      </div>
      <div className="small" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "4px 16px" }}>
        <span><span className="muted">E-mail</span> <b>{s.email}</b></span>
        <span><span className="muted">WhatsApp</span> {s.whatsapp ?? "—"}</span>
        <span><span className="muted">Local</span> {[s.cidade, s.uf].filter(Boolean).join(", ") || "—"}</span>
        <span><span className="muted">Indicação</span> {s.indicacao ?? "—"}</span>
        <span><span className="muted">Pedido em</span> {quando(s.criado_em)}</span>
        {s.decidido_em && <span><span className="muted">Decidido em</span> {quando(s.decidido_em)} por {s.decidido_por}</span>}
        {s.status === "aprovada" && <span><span className="muted">Perguntas feitas</span> {s.perguntas}</span>}
      </div>
      {s.finalidade && <p className="small" style={{ margin: 0 }}><span className="muted">Finalidade:</span> {s.finalidade}</p>}
      {s.motivo && <p className="small" style={{ margin: 0 }}><span className="muted">Motivo:</span> {s.motivo}</p>}
      <form action={decidir} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="hidden" name="id" value={s.id} />
        {s.status !== "aprovada" && <button className="btn primary" type="submit" name="decisao" value="aprovar">Aprovar</button>}
        {s.status !== "recusada" && (
          <>
            <input type="text" name="motivo" placeholder="Motivo (opcional, vai no e-mail)" style={{ flex: "1 1 220px", minWidth: 0 }} />
            <button className="btn" type="submit" name="decisao" value="recusar">Recusar</button>
          </>
        )}
      </form>
    </div>
  );
}

export default async function Solicitacoes() {
  const email = await emailAtual();
  if (!ehAdmin(email)) return <SemAcesso email={email} />;
  const lista = (await sql`
    select s.*, (select count(*)::int from perguntas p where lower(p.email) = lower(s.email)) as perguntas
    from solicitacoes s order by case s.status when 'pendente' then 0 else 1 end, s.criado_em desc`) as Sol[];
  const pend = lista.filter((s) => s.status === "pendente"), outras = lista.filter((s) => s.status !== "pendente");
  const link = `${process.env.SITE_URL ?? "https://segundoturno.blog"}/solicitar`;

  return (
    <main className="wrap" style={{ maxWidth: 900, gap: 28 }}>
      <header className="head">
        <span className="eyebrow">Raio-X Eleitoral · quem pode usar</span>
        <h1>Solicitações de acesso</h1>
        <p className="muted">Envie o link <b style={{ fontFamily: "var(--fm)", fontWeight: 500 }}>{link}</b> para quem precisa do Raio-X Eleitoral. Aprovar libera o chat para o e-mail informado e avisa a pessoa por e-mail.</p>
        <nav className="small" style={{ display: "flex", gap: 14 }}><a href="/admin" style={{ color: "var(--ink)" }}>Acessos</a><a href="/analista" style={{ color: "var(--ink)" }}>Raio-X Eleitoral</a></nav>
      </header>
      <div className="stats">
        <div className="stat ouro"><b>{pend.length}</b><span>pendentes</span></div>
        <div className="stat"><b>{lista.filter((s) => s.status === "aprovada").length}</b><span>aprovadas</span></div>
        <div className="stat"><b>{lista.filter((s) => s.status === "recusada").length}</b><span>recusadas</span></div>
      </div>
      <section style={{ display: "grid", gap: 12 }}>
        <h2>Pendentes</h2>
        {pend.length === 0 && <p className="muted">Nenhuma solicitação aguardando.</p>}
        {pend.map((s) => <Cartao key={s.id} s={s} />)}
      </section>
      <section style={{ display: "grid", gap: 12 }}>
        <h2>Decididas</h2>
        {outras.length === 0 && <p className="muted">Ainda não há decisões.</p>}
        {outras.map((s) => <Cartao key={s.id} s={s} />)}
      </section>
      <Credito />
    </main>
  );
}
