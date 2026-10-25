// Link pessoal de acesso ao Raio-X e as mensagens prontas (e-mail e WhatsApp). Sem segredo: o link carrega só o código e o e-mail.
export const SITE_PUBLICO = "https://segundoturno.blog";

export function linkDeAcesso(codigo: string, email: string | null | undefined) {
  return email ? `${SITE_PUBLICO}/entrar?c=${encodeURIComponent(codigo)}&e=${encodeURIComponent(email)}` : null;
}

export function mensagemAcesso(codigo: string, nome: string | null | undefined, email: string | null | undefined, dias?: number) {
  const link = linkDeAcesso(codigo, email);
  const quem = nome ? nome.split(" ")[0] + ", seu" : "Seu";
  const validade = dias ? ` Vale por ${dias} dias; depois peça outro.` : "";
  const corpo = link
    ? `${quem} acesso ao Raio-X Eleitoral (painel 2º Turno 2026) é este link: ${link}\n\nGuarde: ele é seu e entra direto, quantas vezes precisar, sem pedir acesso de novo.${validade} Se o link não abrir, vá em ${SITE_PUBLICO}/analista, aba "Tenho um código", e informe o e-mail ${email} e o código ${codigo}.`
    : `${quem} código de acesso ao Raio-X Eleitoral (painel 2º Turno 2026): ${codigo}. Abra ${SITE_PUBLICO}/analista, aba "Tenho um código", e informe seu e-mail e o código.`;
  return { link, corpo, assunto: "Seu acesso ao Raio-X Eleitoral · 2º Turno 2026" };
}

export const mailto = (email: string | null | undefined, assunto: string, corpo: string) =>
  `mailto:${email ?? ""}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

export const whatsapp = (numero: string | null | undefined, corpo: string) => {
  const n = (numero ?? "").replace(/\D/g, "");
  return `https://wa.me/${n ? (n.startsWith("55") ? n : "55" + n) : ""}?text=${encodeURIComponent(corpo)}`;
};
