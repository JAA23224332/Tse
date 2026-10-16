"use client";
import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import "./analista.css";

/** Entrada no Raio-X com código de acesso fornecido pela administração. */
export function EntrarComCodigo({ compacto = false }: { compacto?: boolean }) {
  const clerk = useClerk();
  const [f, setF] = useState({ nome: "", email: "", codigo: "" });
  const [estado, setEstado] = useState<"form" | "enviando" | "entrando">("form");
  const [erro, setErro] = useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setEstado("enviando");
    try {
      const r = await fetch("/api/codigo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro ?? "Não foi possível entrar."); setEstado("form"); return; }
      setEstado("entrando");
      const s = await clerk.client!.signIn.create({ strategy: "ticket", ticket: j.ticket });
      await clerk.setActive({ session: s.createdSessionId! });
      window.location.assign("/analista");
    } catch { setErro("Falha ao abrir a sessão. Tente de novo."); setEstado("form"); }
  }
  return (
    <form className="pedido codigo" onSubmit={enviar}>
      <div className="pedido-topo"><b>Tenho um código de acesso</b>{!compacto && <span className="small muted">Recebeu um código da administração (formato RX-XXXXXX)? Entre por aqui, sem e-mail de confirmação.</span>}</div>
      <div className="pedido-campos">
        <label>Nome completo <span className="muted" style={{ fontWeight: 400 }}>(se já cadastrado, pode deixar em branco)</span><input type="text" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="name" /></label>
        <label>E-mail<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
        <label>Código<input type="text" required value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase() })} placeholder="RX-XXXXXX" autoComplete="one-time-code" style={{ fontFamily: "var(--fm)", letterSpacing: ".08em" }} /></label>
      </div>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <div className="pedido-rodape"><button className="btn primary" type="submit" disabled={estado !== "form"}>{estado === "form" ? "Entrar com o código" : estado === "enviando" ? "Conferindo…" : "Entrando…"}</button></div>
    </form>
  );
}
