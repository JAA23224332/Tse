import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// O painel é aberto, inclusive a vitrine do Raio-X e o pedido de acesso. Só o chat em si e a administração exigem login.
const protegida = createRouteMatcher(["/api/chat(.*)", "/admin(.*)", "/sair"]);

export default clerkMiddleware(async (auth, req) => {
  if (protegida(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
