import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { SemAcesso } from "@/app/admin/semacesso";
import { Credito } from "@/app/credito";
import { revogarCodigo } from "@/lib/codigos";
import { Gerador } from "./gerador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Códigos de acesso" };
type Cod = { codigo: string; nota: string | null; nome: string | null; email: string | null; usos_max: number; usos: number; expira_em: string; criado_por: string; criado_em: string; revogado: boolean };
const quando = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function Codigos() {
  const email = await emailAtual();
  if (!ehAdmin(email)) return <SemAcesso email={email} />;
  const lista = (await sql`select * from codigos_acesso order by criado_em desc limit 200`) as Cod[];
  return (
    <main className="wrap" style={{ maxWidth: 900, gap: 24 }}>
      <header className="head">
        <span className="eyebrow">Raio-X Eleitoral · entrada sem e-mail</span>
        <h1>Códigos de acesso</h1>
        <p className="muted">Gere um código e mande pelo WhatsApp. A pessoa abre o Raio-X, digita nome, e-mail e o código, e entra na hora, já aprovada. Com nome e e-mail, o código fica amarrado àquela pessoa (1 uso). Sem e-mail, vale para um grupo (ex.: 30 usos para uma coordenação).</p>
        <nav className="small" style={{ display: "flex", gap: 14 }}><a href="/admin" style={{ color: "var(--ink)" }}>Acessos</a><a href="/admin/solicitacoes" style={{ color: "var(--ink)" }}>Solicitações</a><a href="/admin/links" style={{ color: "var(--ink)" }}>Links</a></nav>
      </header>
      <Gerador />
      <div className="tbl"><table>
        <thead><tr><th>Código</th><th>Pessoa / grupo</th><th className="n">Usos</th><th>Vale até</th><th>Criado</th><th></th></tr></thead>
        <tbody>{lista.map((c) => {
          const ativo = !c.revogado && new Date(c.expira_em) > new Date() && c.usos < c.usos_max;
          return <tr key={c.codigo} className={ativo ? "" : "faint"}><td><code>{c.codigo}</code>{c.revogado ? " (revogado)" : ""}</td><td>{c.nome ?? c.nota ?? "—"}{c.email ? <span className="small muted"> · {c.email}</span> : ""}</td><td className="n">{c.usos}/{c.usos_max}</td><td>{quando(c.expira_em)}</td><td>{quando(c.criado_em)}</td>
            <td>{ativo && <form action={revogarCodigo}><input type="hidden" name="codigo" value={c.codigo} /><button className="btn" type="submit">Revogar</button></form>}</td></tr>;
        })}{lista.length === 0 && <tr><td colSpan={6}>Nenhum código ainda.</td></tr>}</tbody>
      </table></div>
      <Credito />
    </main>
  );
}
