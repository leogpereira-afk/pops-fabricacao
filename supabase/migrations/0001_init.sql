-- ============================================================================
-- Schema do sistema pops no Supabase — MOLDE (trocar pops pelo prefixo).
--
-- ATENÇÃO — PROJETO COMPARTILHADO (ref heveemylixartyijxewh): este projeto
-- hospeda o RH com nomes CRUS (registros, config_global, meta, perfis, bucket
-- "arquivos", function "sync") e os demais sistemas com prefixo (brief_, pcp_,
-- dre_, painel_, leo_, equipe_). Criar objeto SEM prefixo reutiliza em silêncio
-- a tabela do RH em produção — "create table if not exists" NÃO avisa.
--
-- RLS ligado e SEM policy: só a Edge Function (service_role) acessa. O
-- navegador nunca fala com o Postgres direto.
-- ============================================================================

-- Cofre genérico: coleção/id/registro. É o mesmo desenho do Blobs que os apps
-- offline-first já entendem, e o backup do Hub sabe ler.
create table if not exists public.pops_registros (
  colecao       text not null,
  id            text not null,
  registro      jsonb not null,
  atualizado_em timestamptz not null default now(),
  apagado       boolean not null default false,   -- lápide: apagar é marcar, nunca deletar
  primary key (colecao, id)
);
create index if not exists pops_registros_colecao_idx
  on public.pops_registros (colecao);
-- Faxinas e pulls incrementais varrem por data; sem este índice é varredura completa.
create index if not exists pops_registros_atualizado_idx
  on public.pops_registros (colecao, atualizado_em);
alter table public.pops_registros enable row level security;

-- Config global do app (UMA linha — check(id) impede a segunda).
create table if not exists public.pops_config_global (
  id            boolean primary key default true check (id),
  config        jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.pops_config_global enable row level security;

-- Chave/valor: contador "rev" do pull econômico, batimentos, credenciais de
-- integração (que nunca vão ao navegador).
create table if not exists public.pops_meta (
  chave         text primary key,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.pops_meta enable row level security;

-- Arquivos/fotos. Bucket PRIVADO: só a service_role lê e grava.
insert into storage.buckets (id, name, public)
values ('pops-arquivos', 'pops-arquivos', false)
on conflict (id) do nothing;

-- Se o sistema tiver numeração própria (nº de O.S., nº de pedido), usar
-- SEQUENCE — é o contador atômico que o Blobs não tinha (o Brief fazia laço de
-- até 1000 tentativas por causa disso):
-- create sequence if not exists public.pops_numero_seq;
-- create or replace function public.pops_proximo_numero() returns bigint
--   language sql security definer as $$ select nextval('public.pops_numero_seq') $$;
-- revoke all on function public.pops_proximo_numero() from anon, authenticated;

-- Se "um por número" é regra de negócio, vira garantia do banco (lição do PCP —
-- a faxina de duplicatas existia porque o código não conseguia garantir):
-- create unique index if not exists pops_os_numero_idx
--   on public.pops_registros ((registro->>'numero')) where colecao = 'os' and not apagado;
