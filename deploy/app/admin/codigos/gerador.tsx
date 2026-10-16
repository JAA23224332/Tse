"use client";
import { useActionState, useState } from "react";
import { gerarCodigo } from "@/lib/codigos";

export function Gerador() {
  const [estado, acao, pendente] = useActionState(gerarCodigo, null);
  const [copiado, setCopiado] = useState(false);
  const texto = estado?.codigo ? `Seu código de acesso ao Raio-X Eleitoral (painel 2º Turno 2026): ${estado.codigo}. Abra https://segundoturno.blog/analista, clique em "Tenho um código de acesso" e informe nome, e-mail e o código.` : "";
  return (
    <div className="panel outline" style={{ display: "grid", gap: 14 }}>
      <form action={acao} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, flex: "1 1 220px" }}>Para quem (nota)<input type="text" name="nota" placeholder="ex.: coordenação BA" /></label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, width: 110 }}>Usos<input type="number" name="usos" min={1} max={500} defaultValue={1} /></label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, width: 110 }}>Dias<input type="number" name="dias" min={1} max={60} defaultValue={7} /></label>
        <button className="btn primary" type="submit" disabled={pendente}>{pendente ? "Gerando…" : "Gerar código"}</button>
      </form>
      {estado?.erro && <p role="alert" className="erro" style={{ margin: 0 }}>{estado.erro}</p>}
      {estado?.codigo && (
        <div style={{ display: "grid", gap: 8 }}>
          <b style={{ fontFamily: "var(--fm)", fontSize: 28, letterSpacing: ".08em" }}>{estado.codigo}</b>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {} }}>{copiado ? "Copiado" : "Copiar mensagem"}</button>
            <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Enviar pelo WhatsApp</a>
          </div>
        </div>
      )}
    </div>
  );
}
