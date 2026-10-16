"use client";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { navHtml } from "@/lib/nav";

/** Barra para as páginas React; as páginas servidas como HTML recebem a mesma barra em lib/servir.ts. */
export function BarraNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const { user } = useUser();
  if (!path || path.startsWith("/sign-in") || path === "/sair" || path === "/entrar") return null;
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  return <div dangerouslySetInnerHTML={{ __html: navHtml(path, email, admin) }} />;
}
