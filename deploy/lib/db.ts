import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);
/** Conexão com a role raiox_leitor: só SELECT nas tabelas de dados, statement_timeout de 15 s. Usada pelo agente. */
export const sqlLeitura = neon(process.env.DATABASE_URL_LEITURA ?? "postgresql://invalido@localhost/invalido");

export type Acesso = {
  email: string;
  ip: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  navegador: string | null;
  criado_em: string;
};
