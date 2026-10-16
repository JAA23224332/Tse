"use client";
import { useActionState } from "react";
import { gerarCodigo } from "@/lib/codigos";

/** Código de acesso amarrado ao e-mail do pedido: mostra o ativo ou gera um novo, com envio pelo WhatsApp. */
export function CodigoBotao({ nome, email, whatsapp, ativo }: { nome: string; email: string; whatsapp: string | null; ativo: string | null }) {
  const [estado, acao, pendente] = useActionState(gerarCodigo, null);
  const codigo = estado?.codigo ?? ativo;
  const numero = (whatsapp ?? "").replace(/\D/g, "");
  const texto = codigo ? `${nome.split(" ")[0]}, seu código de acesso ao Raio-X Eleitoral (painel 2º Turno 2026): ${codigo}. Abra https://segundoturno.blog/analista, aba "Tenho um código", e informe o e-mail ${email} e o código.` : "";
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {codigo ? (
        <>
          <span className="small muted">Código:</span><code style={{ fontSize: 15, letterSpacing: ".06em" }}>{codigo}</code>
          <a className="btn primary" href={`https://wa.me/${numero ? (numero.startsWith("55") ? numero : "55" + numero) : ""}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Enviar código pelo WhatsApp</a>
        </>
      ) : (
        <form action={acao} style={{ display: "contents" }}>
          <input type="hidden" name="nome" value={nome} /><input type="hidden" name="email" value={email} /><input type="hidden" name="dias" value="14" />
          <button className="btn primary" type="submit" disabled={pendente}>{pendente ? "Gerando…" : "Gerar código de acesso"}</button>
        </form>
      )}
      {estado?.erro && <span className="erro small">{estado.erro}</span>}
    </div>
  );
}
