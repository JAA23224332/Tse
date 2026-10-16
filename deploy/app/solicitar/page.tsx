import { redirect } from "next/navigation";

/** O pedido agora é feito dentro do próprio Raio-X. */
export default function Solicitar() {
  redirect("/analista");
}
