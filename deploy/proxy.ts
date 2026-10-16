import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// O painel é aberto. Só o Raio-X Eleitoral (chat), o pedido de acesso e a administração exigem login.
const protegida = createRouteMatcher(["/analista(.*)", "/api/chat(.*)", "/api/solicitar", "/admin(.*)", "/sair"]);

export default clerkMiddleware(async (auth, req) => {
  if (protegida(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
