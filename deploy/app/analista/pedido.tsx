"use client";
import { useEffect, useRef, useState } from "react";

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");

/** Pedido de acesso em tela cheia: nome, estado, instituição e motivo. O e-mail é o da conta logada. */
export function Pedido({ email, onEnviado, onDepois }: { email: string | null; onEnviado: () => void; onDepois: () => void }) {
  const [f, setF] = useState({ nome: "", uf: "", organizacao: "", finalidade: "" });
  const [estado, setEstado] = useState<"form" | "enviando" | "ok">("form");
  const [erro, setErro] = useState("");
  const primeiro = useRef<HTMLInputElement>(null);
  useEffect(() => { primeiro.current?.focus(); const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && estado !== "ok") onDepois(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [estado, onDepois]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setEstado("enviando");
    try {
      const r = await fetch("/api/solicitar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro ?? "Não foi possível enviar."); setEstado("form"); return; }
      setEstado("ok");
    } catch { setErro("Falha de conexão. Tente de novo."); setEstado("form"); }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pedido-titulo">
      {estado === "ok" ? (
        <div className="pedido">
          <div className="pedido-topo"><b id="pedido-titulo">Pedido enviado</b><span className="small muted">A administração libera o acesso para <b>{email}</b> e você recebe um aviso. Enquanto isso, as outras páginas do painel seguem abertas.</span></div>
          <div className="pedido-rodape"><button className="btn primary" type="button" onClick={onEnviado}>Continuar</button></div>
        </div>
      ) : (
        <form className="pedido" onSubmit={enviar}>
          <div className="pedido-topo"><span className="eyebrow">Raio-X Eleitoral</span><b id="pedido-titulo">Quer continuar? Diga quem você é.</b><span className="small muted">Leva 30 segundos. O acesso será liberado para {email}.</span></div>
          <div className="pedido-campos">
            <label>Nome completo<input ref={primeiro} type="text" required minLength={3} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoComplete="name" /></label>
            <label>Estado<select required value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })}><option value="">Escolha</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
            <label>Instituição<input type="text" required minLength={2} value={f.organizacao} onChange={(e) => setF({ ...f, organizacao: e.target.value })} placeholder="ex.: PT-BA, sindicato, coordenação da campanha" /></label>
            <label className="largo">Por que você quer acessar?<textarea required minLength={10} maxLength={600} value={f.finalidade} onChange={(e) => setF({ ...f, finalidade: e.target.value })} placeholder="ex.: planejar a mobilização nos bairros de Salvador" /></label>
          </div>
          {erro && <p role="alert" className="erro">{erro}</p>}
          <div className="pedido-rodape">
            <button className="btn primary" type="submit" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Pedir acesso"}</button>
            <button className="btn" type="button" onClick={onDepois}>Agora não</button>
            <span className="small muted">Os dados servem só para identificar quem usa; as perguntas ficam registradas com o seu e-mail.</span>
          </div>
        </form>
      )}
    </div>
  );
}
