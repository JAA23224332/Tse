"use client";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { navHtml } from "@/lib/nav";

declare global { interface Window { __aovivo?: { render: () => void } } }

/** Barra para as páginas React; as páginas servidas como HTML recebem a mesma barra em lib/servir.ts. */
export function BarraNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const { user } = useUser();
  const oculta = !path || path.startsWith("/sign-in") || path === "/sair" || path === "/entrar";
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  // script dentro de innerHTML não roda: carrega a faixa "ao vivo" uma vez e redesenha a cada troca de página
  useEffect(() => {
    if (oculta) return;
    if (window.__aovivo) { window.__aovivo.render(); return; }
    if (document.querySelector('script[data-aovivo]')) return;
    const s = document.createElement("script");
    s.src = "/aovivo.js"; s.defer = true; s.dataset.aovivo = "1";
    document.body.appendChild(s);
  }, [path, email, oculta]);
  if (oculta) return null;
  return <div dangerouslySetInnerHTML={{ __html: navHtml(path, email, admin) }} />;
}
