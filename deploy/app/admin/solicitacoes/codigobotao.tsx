"use client";
import { useActionState, useState } from "react";
import { gerarCodigo } from "@/lib/codigos";
import { mailto, mensagemAcesso, whatsapp } from "@/lib/mensagem_acesso";

/** Acesso pessoal amarrado ao e-mail do pedido: mostra o link ativo ou gera um novo, com envio por e-mail ou WhatsApp. */
export function CodigoBotao({ nome, email, whatsapp: numero, ativo }: { nome: string; email: string; whatsapp: string | null; ativo: string | null }) {
  const [estado, acao, pendente] = useActionState(gerarCodigo, null);
  const [copiado, setCopiado] = useState(false);
  const codigo = estado?.codigo ?? ativo;
  const m = codigo ? mensagemAcesso(codigo, nome, email, estado?.dias) : null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {codigo && m?.link ? (
        <>
          <span className="small muted">Link pessoal: <code style={{ fontSize: 12, wordBreak: "break-all" }}>{m.link}</code></span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <a className="btn primary" href={mailto(email, m.assunto, m.corpo)} style={{ textDecoration: "none" }}>Enviar por e-mail</a>
            <a className="btn primary" href={whatsapp(numero, m.corpo)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Enviar pelo WhatsApp</a>
            <button className="btn" type="button" onClick={async () => { try { await navigator.clipboard.writeText(m.link!); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {} }}>{copiado ? "Copiado" : "Copiar link"}</button>
          </div>
        </>
      ) : (
        <form action={acao} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="nome" value={nome} /><input type="hidden" name="email" value={email} />
          <button className="btn primary" type="submit" disabled={pendente}>{pendente ? "Gerando…" : "Gerar link de acesso"}</button>
        </form>
      )}
      {estado?.erro && <span className="erro small">{estado.erro}</span>}
    </div>
  );
}
