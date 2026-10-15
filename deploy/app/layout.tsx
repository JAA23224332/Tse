import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import { emailAtual, ehAdmin } from "@/lib/admin";
import { BarraNav } from "@/app/nav";
import "./globals.css";

export const metadata = { title: "Painel do 2º Turno 2026" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await emailAtual().then(ehAdmin).catch(() => false); // se o Clerk falhar, a página ainda abre
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1&family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap" />
      </head>
      <body>
        <ClerkProvider localization={ptBR}>
          <BarraNav admin={admin} />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
