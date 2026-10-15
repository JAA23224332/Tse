import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Públicas: login, pedido de acesso ao analista e suas APIs; todo o resto exige estar logado.
const publica = createRouteMatcher([
  "/sign-in(.*)", "/api/entrar",
  // apuração é dado público do TSE: continua acessível mesmo se o login falhar na noite da eleição
  "/apuracao", "/api/apuracao(.*)", "/api/saude",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!publica(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
