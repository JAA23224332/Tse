"use client";
import { Pedido } from "@/app/analista/pedido";

export function Formulario({ email }: { email: string | null }) {
  return <Pedido email={email} pagina onEnviado={() => { window.location.assign(email ? "/analista" : "/"); }} />;
}
