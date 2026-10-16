-- Esquema das tabelas do site (Neon). As tabelas de dados eleitorais (municipios, ufs, locais_votacao, secoes, candidatos)
-- são criadas por carregar_neon.py. Rodar com: psql "$DATABASE_URL" -f scripts/schema.sql
create table if not exists acessos (id bigserial primary key, email text, user_id text not null, ip text, cidade text, uf text, pais text, navegador text, pagina text default '/', criado_em timestamptz not null default now());
create table if not exists perguntas (id bigserial primary key, email text, user_id text not null, pergunta text, criado_em timestamptz not null default now());
create table if not exists consultas (id bigserial primary key, email text, user_id text, motivo text, sql text, linhas int, erro text, criado_em timestamptz not null default now());
create table if not exists solicitacoes (id bigserial primary key, nome text not null, email text not null, user_id text, organizacao text not null, cargo text, cidade text, uf text, whatsapp text, finalidade text, indicacao text, aceite boolean not null default false, status text not null default 'pendente', motivo text, criado_em timestamptz not null default now(), decidido_em timestamptz, decidido_por text);
create index if not exists solicitacoes_email on solicitacoes (lower(email));
create table if not exists apuracao_snapshots (id bigserial primary key, eleicao int, dados jsonb, origem text not null default 'servidor', verificado boolean not null default false, ip text, criado_em timestamptz not null default now());
create index if not exists apuracao_snapshots_eleicao_criado on apuracao_snapshots (eleicao, criado_em desc);
create table if not exists limites (chave text not null, janela timestamptz not null, n int not null default 0, primary key (chave, janela));
-- usuário só-leitura do agente
-- create role raiox_leitor login password '...'; grant usage on schema public to raiox_leitor;
-- grant select on municipios, ufs, locais_votacao, secoes, candidatos to raiox_leitor;
-- alter role raiox_leitor set statement_timeout = '15s'; alter role raiox_leitor set default_transaction_read_only = on;
create table if not exists codigos_acesso (codigo text primary key, nota text, usos_max int not null default 1, usos int not null default 0, expira_em timestamptz not null, criado_por text, criado_em timestamptz not null default now(), revogado boolean not null default false);
