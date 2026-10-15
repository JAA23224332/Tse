/** Envio de e-mail pelo Resend (integração do Vercel). Sem RESEND_API_KEY, não envia e avisa no log. */
const DE = process.env.EMAIL_DE ?? "Painel 2º Turno <onboarding@resend.dev>";
const SITE = process.env.SITE_URL ?? "https://segundoturno.blog";

export async function enviarEmail(para: string | string[], assunto: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("email não enviado (RESEND_API_KEY ausente):", assunto, para);
    return { ok: false, motivo: "sem chave" };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: DE, to: para, subject: assunto, html }),
  });
  if (!r.ok) console.error("resend:", r.status, await r.text());
  return { ok: r.ok };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const base = (corpo: string) => `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">${corpo}
<p style="color:#777;font-size:12px;margin-top:24px">Painel do 2º Turno 2026 · ${SITE}</p></div>`;

export function emailNovaSolicitacao(s: { nome: string; email: string; organizacao: string; cargo?: string | null; finalidade?: string | null }) {
  return {
    assunto: `Nova solicitação de acesso: ${s.nome} (${s.organizacao})`,
    html: base(`<p><b>${esc(s.nome)}</b> pediu acesso ao Raio-X Eleitoral.</p>
<p>E-mail: ${esc(s.email)}<br>Organização: ${esc(s.organizacao)}<br>Cargo: ${esc(s.cargo ?? "—")}<br>Finalidade: ${esc(s.finalidade ?? "—")}</p>
<p><a href="${SITE}/admin/solicitacoes" style="background:#111;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Ver e aprovar</a></p>`),
  };
}

export function emailAprovado(nome: string) {
  return {
    assunto: "Seu acesso ao Raio-X Eleitoral foi aprovado",
    html: base(`<p>Olá, ${esc(nome)}.</p><p>Seu acesso ao <b>Raio-X Eleitoral</b>, o agente de IA do Painel do 2º Turno que analisa os dados oficiais do TSE, foi aprovado.</p>
<p>Entre com este mesmo e-mail: você recebe um código de 6 dígitos para acessar.</p>
<p><a href="${SITE}/analista" style="background:#111;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Abrir o Raio-X Eleitoral</a></p>`),
  };
}

export function emailRecusado(nome: string, motivo?: string | null) {
  return {
    assunto: "Sobre sua solicitação de acesso ao Raio-X Eleitoral",
    html: base(`<p>Olá, ${esc(nome)}.</p><p>Sua solicitação de acesso ao Raio-X Eleitoral não foi aprovada${motivo ? `: ${esc(motivo)}` : "."}</p>
<p>As demais páginas do painel continuam disponíveis com o login por e-mail.</p>`),
  };
}
