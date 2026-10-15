// Cria a tabela de acessos no Neon (rodar uma vez: npm run db:criar)
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`
  create table if not exists acessos (
    id bigserial primary key,
    email text,
    user_id text not null,
    ip text,
    cidade text,
    uf text,
    pais text,
    navegador text,
    criado_em timestamptz not null default now()
  )`;
await sql`create index if not exists acessos_criado_em on acessos (criado_em desc)`;
await sql`create index if not exists acessos_email on acessos (email)`;
console.log("tabela acessos pronta");
