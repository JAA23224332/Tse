"use client";
import { useActionState, useState } from "react";
import { gerarCodigo } from "@/lib/codigos";
import { mailto, mensagemAcesso, whatsapp } from "@/lib/mensagem_acesso";

export function Gerador() {
  const [estado, acao, pendente] = useActionState(gerarCodigo, null);
  const [copiado, setCopiado] = useState("");
  const m = estado?.codigo ? mensagemAcesso(estado.codigo, estado.nome, estado.email, estado.dias) : null;
  const copiar = async (rotulo: string, texto: string) => { try { await navigator.clipboard.writeText(texto); setCopiado(rotulo); setTimeout(() => setCopiado(""), 1500); } catch {} };
  return (
    <div className="panel outline" style={{ display: "grid", gap: 14 }}>
      <form action={acao} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, flex: "1 1 200px" }}>Nome da pessoa<input type="text" name="nome" placeholder="ex.: Maria Silva" /></label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, flex: "1 1 220px" }}>E-mail da pessoa <span className="muted" style={{ fontWeight: 400 }}>(gera o link pessoal)</span><input type="email" name="email" placeholder="nome@exemplo.com" /></label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, flex: "1 1 180px" }}>Nota (grupo) <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span><input type="text" name="nota" placeholder="ex.: coordenação BA" /></label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, width: 110 }}>Entradas<input type="number" name="usos" min={1} max={500} defaultValue={100} /></label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, width: 110 }}>Dias<input type="number" name="dias" min={1} max={365} defaultValue={120} /></label>
        <button className="btn primary" type="submit" disabled={pendente}>{pendente ? "Gerando…" : "Gerar acesso"}</button>
      </form>
      {estado?.erro && <p role="alert" className="erro" style={{ margin: 0 }}>{estado.erro}</p>}
      {estado?.codigo && m && (
        <div style={{ display: "grid", gap: 10 }}>
          {m.link ? (
            <>
              <span className="small muted">Link pessoal de {estado.nome ?? estado.email} ({estado.email}). Mande uma vez; a pessoa guarda e entra por ele sempre que precisar.</span>
              <code style={{ fontSize: 13, wordBreak: "break-all", padding: "8px 10px", background: "var(--surface)", borderRadius: 6 }}>{m.link}</code>
              <span className="small muted">Código, caso o link não abra: <b style={{ fontFamily: "var(--fm)", letterSpacing: ".08em" }}>{estado.codigo}</b></span>
            </>
          ) : (
            <b style={{ fontFamily: "var(--fm)", fontSize: 28, letterSpacing: ".08em" }}>{estado.codigo}</b>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {m.link && <a className="btn primary" href={mailto(estado.email, m.assunto, m.corpo)} style={{ textDecoration: "none" }}>Enviar por e-mail</a>}
            <a className="btn primary" href={whatsapp(null, m.corpo)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Enviar pelo WhatsApp</a>
            <button className="btn" type="button" onClick={() => copiar("msg", m.corpo)}>{copiado === "msg" ? "Copiado" : "Copiar mensagem"}</button>
            {m.link && <button className="btn" type="button" onClick={() => copiar("link", m.link!)}>{copiado === "link" ? "Copiado" : "Copiar só o link"}</button>}
          </div>
        </div>
      )}
    </div>
  );
}
