import { emailAtual, ehAdmin } from "@/lib/admin";
import { sql, type Acesso } from "@/lib/db";
import { Credito } from "@/app/credito";
import { SemAcesso } from "@/app/admin/semacesso";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acessos ao painel" };

type Pessoa = { email: string; acessos: number; primeiro: string; ultimo: string };

const quando = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function navegador(ua: string | null) {
  if (!ua) return "—";
  const so = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Outro";
  const nav = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Outro";
  return `${nav}, ${so}`;
}

export default async function Admin() {
  const email = await emailAtual();
  if (!ehAdmin(email)) return <SemAcesso email={email} />;

  const [totais] = (await sql`
    select count(*)::int as acessos, count(distinct email)::int as pessoas,
           count(*) filter (where criado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')::int as hoje
    from acessos`) as { acessos: number; pessoas: number; hoje: number }[];
  const pessoas = (await sql`
    select email, count(*)::int as acessos, min(criado_em) as primeiro, max(criado_em) as ultimo
    from acessos group by email order by max(criado_em) desc`) as Pessoa[];
  const recentes = (await sql`
    select email, ip, cidade, uf, pais, navegador, criado_em from acessos
    order by criado_em desc limit 300`) as Acesso[];

  return (
    <main className="wrap" style={{ maxWidth: 1100, gap: 28 }}>
      <header className="head">
        <span className="eyebrow">Quem abriu o painel e quando</span>
        <h1>Acessos</h1>
        <nav className="small" style={{ display: "flex", gap: 14 }}><a href="/admin/solicitacoes" style={{ color: "var(--ink)" }}>Solicitações de acesso ao Raio-X Eleitoral</a><a href="/admin/links" style={{ color: "var(--ink)" }}>Gerar link de acesso (código não chegou)</a></nav>
      </header>

      <div className="stats">
        {[["pessoas", totais.pessoas, "ouro"], ["acessos no total", totais.acessos, ""], ["acessos hoje", totais.hoje, ""]].map(([r, v, c]) => (
          <div key={r as string} className={`stat ${c}`}><b>{v}</b><span>{r}</span></div>
        ))}
      </div>

      <section>
        <h2>Por pessoa</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>E-mail</th><th className="n">Acessos</th><th>Primeiro acesso</th><th>Último acesso</th></tr></thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.email}><td>{p.email}</td><td className="n">{p.acessos}</td><td>{quando(p.primeiro)}</td><td>{quando(p.ultimo)}</td></tr>
              ))}
              {pessoas.length === 0 && <tr><td colSpan={4}>Ninguém acessou ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Últimos acessos</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>Quando</th><th>E-mail</th><th>Local</th><th>Navegador</th><th>IP</th></tr></thead>
            <tbody>
              {recentes.map((a, i) => (
                <tr key={i}>
                  <td>{quando(a.criado_em)}</td><td>{a.email}</td>
                  <td>{[a.cidade, a.uf, a.pais].filter(Boolean).join(", ") || "—"}</td>
                  <td>{navegador(a.navegador)}</td><td><code>{a.ip ?? "—"}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faint small">Cada abertura do painel conta como um acesso. Local aproximado, pelo IP. Mostra os 300 mais recentes.</p>
      </section>
      <Credito />
    </main>
  );
}
