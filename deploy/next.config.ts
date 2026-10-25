import type { NextConfig } from "next";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.segundoturno.blog https://challenges.cloudflare.com",
  "connect-src 'self' https://*.clerk.accounts.dev https://clerk.segundoturno.blog https://resultados.tse.jus.br",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://img.clerk.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
].join("; ");

const config: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // Report-Only primeiro: as páginas geradas têm scripts inline grandes; promover a CSP após validar
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
      { key: "Content-Security-Policy-Report-Only", value: CSP + "; report-uri /api/csp" },
    ] }];
  },
  // o HTML do painel é lido do disco pela rota "/"
  outputFileTracingIncludes: { "/painel": ["./private/*.html"], "/estrategia": ["./private/*.html"], "/mapa": ["./private/*.html"], "/regioes": ["./private/*.html"], "/api/locais/[uf]": ["./private/locais/*.json"] },
};

export default config;
