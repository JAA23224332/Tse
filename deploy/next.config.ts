import type { NextConfig } from "next";

const config: NextConfig = {
  // o HTML do painel é lido do disco pela rota "/"
  outputFileTracingIncludes: { "/": ["./private/*.html"], "/estrategia": ["./private/*.html"], "/mapa": ["./private/*.html"], "/regioes": ["./private/*.html"], "/api/locais/[uf]": ["./private/locais/*.json"] },
};

export default config;
