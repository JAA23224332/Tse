import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

export type Acesso = {
  email: string;
  ip: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  navegador: string | null;
  criado_em: string;
};
