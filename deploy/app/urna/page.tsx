import type { Metadata } from "next";
import { Urna } from "./urna";

const TITULO = "Por quantos votos a sua urna foi decidida?";
const DESCRICAO = "Escolha a sua seção eleitoral e veja o resultado do 1º turno na sua urna: quantos votaram em cada um, quantos ficaram em casa e qual foi a diferença. Dados oficiais do TSE.";

export const metadata: Metadata = {
  title: "Sua urna",
  description: DESCRICAO,
  openGraph: { title: TITULO, description: DESCRICAO, images: [{ url: "/urna/og.png", width: 1200, height: 630 }], locale: "pt_BR", type: "website" },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRICAO, images: ["/urna/og.png"] },
};

export default function Page() {
  return <Urna />;
}
