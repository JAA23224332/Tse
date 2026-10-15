"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Credito } from "@/app/credito";

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const campo: React.CSSProperties = { display: "grid", gap: 4, fontSize: 13, fontWeight: 600 };
const area: React.CSSProperties = { font: "inherit", fontSize: 15, padding: "9px 11px", borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--surface-2)", color: "var(--ink)", width: "100%", boxSizing: "border-box", minHeight: 84, resize: "vertical" };

export default function Solicitar() {
  const { user } = useUser();
  const emailConta = user?.primaryEmailAddress?.emailAddress ?? "";
  const [f, setF] = useState({ nome: "", email: "", organizacao: "", cargo: "", cidade: "", uf: "", whatsapp: "", finalidade: "", indicacao: "", aceite: false });
  const [estado, setEstado] = useState<"form" | "enviando" | "nova" | "pendente" | "aprovada">("form");
  const [erro, setErro] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setEstado("enviando");
    try {
      const r = await fetch("/api/solicitar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro ?? "Não foi possível enviar."); setEstado("form"); return; }
      setEstado(j.estado);
    } catch { setErro("Falha de conexão. Tente de novo."); setEstado("form"); }
  }

  if (estado === "nova" || estado === "pendente" || estado === "aprovada") {
    const msg = {
      nova: ["Pedido enviado", "Sua solicitação foi registrada. Quando for aprovada, você recebe um e-mail com o link de acesso."],
      pendente: ["Já recebemos seu pedido", "Existe uma solicitação em análise para este e-mail. Você será avisada(o) por e-mail quando houver decisão."],
      aprovada: ["Você já tem acesso", "Este e-mail já está aprovado. Entre no painel com o código enviado ao seu e-mail."],
    }[estado];
    return (
      <main className="wrap" style={{ maxWidth: 560, gap: 20 }}>
        <header className="head"><span className="eyebrow">Raio-X Eleitoral</span><h1>{msg[0]}</h1><p className="muted">{msg[1]}</p></header>
        <a className="btn primary" href={estado === "aprovada" ? "/analista" : "/"} style={{ justifySelf: "start", textDecoration: "none" }}>{estado === "aprovada" ? "Abrir o Raio-X Eleitoral" : "Ir para o painel"}</a>
        <Credito />
      </main>
    );
  }

  return (
    <main className="wrap" style={{ maxWidth: 640, gap: 20 }}>
      <header className="head">
        <span className="eyebrow">Painel do 2º Turno 2026</span>
        <h1>Solicitar acesso ao Raio-X Eleitoral</h1>
        <p className="muted">O Raio-X Eleitoral é o agente de IA que analisa os dados oficiais do TSE para a campanha. O acesso é liberado pela administração do painel para o e-mail da sua conta; preencha os dados e aguarde o e-mail de aprovação.</p>
      </header>
      <form onSubmit={enviar} className="panel outline" style={{ display: "grid", gap: 14 }}>
        <label style={campo}>Nome completo<input type="text" required value={f.nome} onChange={set("nome")} autoComplete="name" /></label>
        <label style={campo}>E-mail<input type="email" value={emailConta} readOnly aria-readonly="true" /><span className="small muted" style={{ fontWeight: 400 }}>É o e-mail da sua conta; o acesso será liberado para ele.</span></label>
        <label style={campo}>Organização<input type="text" required value={f.organizacao} onChange={set("organizacao")} autoComplete="organization" placeholder="Partido, coordenação, instituto, veículo..." /></label>
        <label style={campo}>Cargo ou função<input type="text" value={f.cargo} onChange={set("cargo")} autoComplete="organization-title" /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 12 }}>
          <label style={campo}>Cidade<input type="text" value={f.cidade} onChange={set("cidade")} autoComplete="address-level2" /></label>
          <label style={campo}>UF<select value={f.uf} onChange={set("uf")}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
        </div>
        <label style={campo}>WhatsApp <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span><input type="tel" value={f.whatsapp} onChange={set("whatsapp")} autoComplete="tel" placeholder="(61) 99999-9999" /></label>
        <label style={campo}>Para que você vai usar o Raio-X Eleitoral?<textarea value={f.finalidade} onChange={set("finalidade")} style={area} maxLength={600} placeholder="Ex.: planejar a mobilização no interior da Bahia" /></label>
        <label style={campo}>Quem indicou <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span><input type="text" value={f.indicacao} onChange={set("indicacao")} /></label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
          <input type="checkbox" checked={f.aceite} onChange={set("aceite")} required style={{ marginTop: 3 }} />
          <span>Entendo que estes dados servem apenas para controle de acesso ao painel e que as perguntas feitas ao Raio-X Eleitoral ficam registradas com meu e-mail.</span>
        </label>
        {erro && <p role="alert" style={{ margin: 0, color: "#e5484d", fontSize: 14 }}>{erro}</p>}
        <button className="btn primary" type="submit" disabled={estado === "enviando"} style={{ justifySelf: "start", padding: "10px 18px", fontSize: 15 }}>{estado === "enviando" ? "Enviando…" : "Enviar solicitação"}</button>
      </form>
      <Credito />
    </main>
  );
}
