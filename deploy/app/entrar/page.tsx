"use client";
import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Credito } from "@/app/credito";

/**
 * Entrada por link:
 *   ?c=RX-XXXXXX&e=email  link pessoal reutilizável (código amarrado ao e-mail): entra direto, quantas vezes precisar
 *   ?t=…                  link de uso único (48 h) gerado pela administração
 * Quem já está logado vai direto ao Raio-X.
 */
export default function Entrar() {
  const clerk = useClerk();
  const [estado, setEstado] = useState<"entrando" | "erro" | "sem-link">("entrando");
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("t"), c = q.get("c"), e = q.get("e");
    if (!t && !(c && e)) { setEstado("sem-link"); return; }
    if (!clerk.loaded) return;
    (async () => {
      try {
        if (clerk.user) { window.location.replace("/analista"); return; }
        let ticket = t;
        if (!ticket) {
          const r = await fetch("/api/codigo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo: c, email: e }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ticket) { setMotivo(j.erro ?? ""); throw new Error("código"); }
          ticket = j.ticket as string;
        }
        const s = await clerk.client!.signIn.create({ strategy: "ticket", ticket });
        if (s.status !== "complete" || !s.createdSessionId) throw new Error("incompleto");
        await clerk.setActive({ session: s.createdSessionId });
        window.location.replace(t ? "/" : "/analista");
      } catch { setEstado("erro"); }
    })();
  }, [clerk, clerk.loaded]);
  return (
    <main className="wrap" style={{ maxWidth: 560, gap: 20 }}>
      <header className="head">
        <span className="eyebrow">2º Turno 2026</span>
        {estado === "entrando" && <><h1>Entrando…</h1><p className="muted">Um instante: estamos abrindo o Raio-X Eleitoral para você.</p></>}
        {estado === "erro" && <><h1>Este link não vale mais</h1><p className="muted">{motivo || "O link venceu, foi revogado ou já foi usado todas as vezes permitidas."} Peça um novo à administração do painel ou entre com um código.</p></>}
        {estado === "sem-link" && <><h1>Link incompleto</h1><p className="muted">Abra o link exatamente como foi enviado.</p></>}
      </header>
      {estado !== "entrando" && <a className="btn primary" href="/analista" style={{ justifySelf: "start", textDecoration: "none" }}>Tenho um código / pedir acesso</a>}
      <Credito />
    </main>
  );
}
