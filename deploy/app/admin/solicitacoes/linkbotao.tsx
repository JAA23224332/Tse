"use client";
import { useActionState } from "react";
import { gerarLinkAcesso } from "@/lib/link_acesso";

/** Gera o link de acesso (uso único, 48 h) para o e-mail do pedido e oferece o envio pelo WhatsApp. */
export function LinkBotao({ email, whatsapp }: { email: string; whatsapp: string | null }) {
  const [estado, acao, pendente] = useActionState(gerarLinkAcesso, null);
  const texto = estado?.link ? `Seu acesso ao Raio-X Eleitoral (painel 2º Turno 2026) foi liberado. Entre por este link (vale 48 h, uso único): ${estado.link}` : "";
  const numero = (whatsapp ?? "").replace(/\D/g, "");
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <form action={acao}><input type="hidden" name="email" value={email} /><button className="btn" type="submit" disabled={pendente}>{pendente ? "Gerando…" : "Gerar link de acesso"}</button></form>
      {estado?.erro && <span className="erro small">{estado.erro}</span>}
      {estado?.link && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ fontSize: 11, wordBreak: "break-all", maxWidth: 520 }}>{estado.link}</code>
          <a className="btn primary" href={`https://wa.me/${numero ? (numero.startsWith("55") ? numero : "55" + numero) : ""}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Enviar pelo WhatsApp</a>
        </div>
      )}
    </div>
  );
}
