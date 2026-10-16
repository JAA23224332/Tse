"use client";
import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Credito } from "@/app/credito";

/** Entrada por link de acesso (uso único, 48 h), para quem não recebe o código por e-mail. */
export default function Entrar() {
  const clerk = useClerk();
  const [estado, setEstado] = useState<"entrando" | "erro" | "sem-link">("entrando");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) { setEstado("sem-link"); return; }
    if (!clerk.loaded) return;
    (async () => {
      try {
        const s = await clerk.client!.signIn.create({ strategy: "ticket", ticket: t });
        if (s.status !== "complete" || !s.createdSessionId) throw new Error("incompleto");
        await clerk.setActive({ session: s.createdSessionId });
        window.location.replace("/");
      } catch { setEstado("erro"); }
    })();
  }, [clerk, clerk.loaded]);
  return (
    <main className="wrap" style={{ maxWidth: 560, gap: 20 }}>
      <header className="head">
        <span className="eyebrow">2º Turno 2026</span>
        {estado === "entrando" && <><h1>Entrando…</h1><p className="muted">Um instante: estamos abrindo o painel para você.</p></>}
        {estado === "erro" && <><h1>Este link não vale mais</h1><p className="muted">Links de acesso valem por 48 horas e só podem ser usados uma vez. Peça um novo à administração do painel ou entre com o código por e-mail.</p></>}
        {estado === "sem-link" && <><h1>Link incompleto</h1><p className="muted">Abra o link exatamente como foi enviado.</p></>}
      </header>
      {estado !== "entrando" && <a className="btn primary" href="/sign-in" style={{ justifySelf: "start", textDecoration: "none" }}>Entrar com código por e-mail</a>}
      <Credito />
    </main>
  );
}
