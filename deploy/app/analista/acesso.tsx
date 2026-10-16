"use client";
import { useState } from "react";
import { EntrarComCodigo } from "./codigo";
import { Pedido } from "./pedido";
import "./analista.css";

/** Um cartão, duas abas: entrar com código ou pedir acesso. Usado no Raio-X sem login e em /solicitar. */
export function Acesso({ email, inicial = "codigo" }: { email: string | null; inicial?: "codigo" | "pedido" }) {
  const [aba, setAba] = useState<"codigo" | "pedido">(inicial);
  return (
    <div className="acesso">
      <div className="abas" role="tablist" aria-label="Como entrar">
        <button type="button" role="tab" aria-selected={aba === "codigo"} onClick={() => setAba("codigo")}>Tenho um código</button>
        <button type="button" role="tab" aria-selected={aba === "pedido"} onClick={() => setAba("pedido")}>Pedir acesso</button>
      </div>
      {aba === "codigo" ? (
        <div className="aba-corpo">
          <p className="small muted" style={{ margin: "0 0 10px" }}>Recebeu um código da administração (formato RX-XXXXXX)? Informe seus dados e entre na hora.</p>
          <EntrarComCodigo compacto />
        </div>
      ) : (
        <div className="aba-corpo">
          <p className="small muted" style={{ margin: "0 0 10px" }}>Sem código? Diga quem você é. A administração confere e manda o código ou o link de entrada.</p>
          <Pedido email={email} pagina onEnviado={() => { window.location.assign(email ? "/analista" : "/"); }} />
        </div>
      )}
    </div>
  );
}
