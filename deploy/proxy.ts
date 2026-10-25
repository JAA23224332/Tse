import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// O painel é aberto, inclusive a vitrine do Raio-X e o pedido de acesso. Só o chat em si e a administração exigem login.
const protegida = createRouteMatcher(["/api/chat(.*)", "/admin(.*)", "/sair"]);

export default clerkMiddleware(async (auth, req) => {
  if (!protegida(req)) return;
  // API sem login: 401 direto (auth.protect reescrevia para "não encontrada" com status 200)
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const { userId } = await auth();
    if (!userId) return new Response("Não autorizado", { status: 401 });
    return;
  }
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
