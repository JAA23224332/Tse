"use client";
import { useState } from "react";

/** Pedido de acesso em três campos; o e-mail é o da conta logada. */
export function Pedido({ email, onEnviado }: { email: string | null; onEnviado: () => void }) {
  const [f, setF] = useState({ nome: "", organizacao: "", whatsapp: "" });
  const [estado, setEstado] = useState<"form" | "enviando" | "ok">("form");
  const [erro, setErro] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setEstado("enviando");
    try {
      const r = await fetch("/api/solicitar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, aceite: true }) });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro ?? "Não foi possível enviar."); setEstado("form"); return; }
      setEstado("ok"); onEnviado();
    } catch { setErro("Falha de conexão. Tente de novo."); setEstado("form"); }
  }
  if (estado === "ok") return <div className="pedido ok"><b>Pedido enviado.</b> A administração libera o acesso para <b>{email}</b> e você recebe um aviso. Enquanto isso, as outras páginas do painel seguem abertas.</div>;
  return (
    <form className="pedido" onSubmit={enviar}>
      <div className="pedido-topo"><b>Quer continuar? Diga quem você é.</b><span className="small muted">Leva 30 segundos. Acesso liberado para {email}.</span></div>
      <div className="pedido-campos">
        <label>Nome completo<input type="text" required minLength={3} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="name" /></label>
        <label>Quem é você na campanha<input type="text" required minLength={2} value={f.organizacao} onChange={(e) => setF({ ...f, organizacao: e.target.value })} placeholder="ex.: coordenação de mobilização, PT-BA" /></label>
        <label>WhatsApp<input type="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} autoComplete="tel" placeholder="(61) 99999-9999" /></label>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <div className="pedido-rodape">
        <button className="btn primary" type="submit" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Pedir acesso"}</button>
        <span className="small muted">Os dados servem só para identificar quem usa; as perguntas ficam registradas com o seu e-mail.</span>
      </div>
    </form>
  );
}
