"use client";
import { useActionState, useState } from "react";
import { gerarLinkAcesso } from "@/lib/link_acesso";

export function Gerador() {
  const [estado, acao, pendente] = useActionState(gerarLinkAcesso, null);
  const [copiado, setCopiado] = useState(false);
  const texto = estado?.link ? `Seu acesso ao painel 2º Turno 2026 (vale por 48 h, uso único): ${estado.link}` : "";
  return (
    <div className="panel outline" style={{ display: "grid", gap: 14 }}>
      <form action={acao} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, flex: "1 1 260px" }}>E-mail da pessoa<input type="email" name="email" required autoComplete="off" placeholder="nome@exemplo.com" /></label>
        <button className="btn primary" type="submit" disabled={pendente}>{pendente ? "Gerando…" : "Gerar link"}</button>
      </form>
      {estado?.erro && <p role="alert" className="erro" style={{ margin: 0 }}>{estado.erro}</p>}
      {estado?.link && (
        <div style={{ display: "grid", gap: 8 }}>
          <span className="small muted">Link para <b>{estado.email}</b>:</span>
          <code style={{ wordBreak: "break-all", padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, fontSize: 13 }}>{estado.link}</code>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {} }}>{copiado ? "Copiado" : "Copiar mensagem"}</button>
            <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Enviar pelo WhatsApp</a>
          </div>
        </div>
      )}
    </div>
  );
}
