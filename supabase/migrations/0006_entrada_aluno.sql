-- Entrada do aluno pelo ID do RH e primeiro nome (14/10/2026).
--
-- O ID tem só 6 dígitos: sem limite de tentativas, dava para varrer os IDs. O
-- limite mora no banco, não na memória de uma instância da função (que reinicia
-- e se multiplica). A regra é desta rotina e de mais ninguém:
--   - 5 tentativas erradas do mesmo ID em 15 minutos bloqueiam esse ID por 15 minutos;
--   - 30 tentativas erradas do mesmo IP em 15 minutos bloqueiam esse IP por 15 minutos;
--   - entrada certa zera o ID (e devolve ao IP a tentativa que contou).
--
-- Cada tentativa conta ANTES de a função conferir o ID e o nome ('tentar'): duas
-- tentativas ao mesmo tempo não passam juntas do limite. A entrada certa avisa
-- depois ('sucesso'). Função que cair no meio deixa a tentativa contada como
-- errada, o lado seguro.
--
-- Tabela privada: RLS ligada e sem policy, sem permissão para anon e
-- authenticated; só esta rotina (security definer, executada pela service_role
-- da função pops-sync) mexe nela. As chaves chegam cifradas pela função (HMAC
-- com segredo do servidor, 'id:<hmac>' e 'ip:<hmac>'): o banco não guarda o ID
-- nem o IP de ninguém. Aditiva: não toca em nenhuma tabela existente.
create table if not exists public.pops_entrada_tentativas (
  chave text primary key check (chave ~ '^(id|ip):[0-9a-f]{64}$'),
  falhas integer not null default 0 check (falhas >= 0),
  janela_desde timestamptz not null default clock_timestamp(),
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default clock_timestamp()
);
create index if not exists pops_entrada_tentativas_atualizado_idx on public.pops_entrada_tentativas(atualizado_em);
alter table public.pops_entrada_tentativas enable row level security;
revoke all on table public.pops_entrada_tentativas from public, anon, authenticated;

create or replace function public.pops_entrada_aluno(p_acao text, p_chave_id text, p_chave_ip text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  agora timestamptz := clock_timestamp();
  janela constant interval := interval '15 minutes';
  bloqueio constant interval := interval '15 minutes';
  linha public.pops_entrada_tentativas%rowtype;
  chaves text[]; limites integer[]; ate timestamptz; i integer;
begin
  if p_acao not in ('tentar', 'sucesso') then raise exception 'Ação inválida'; end if;
  if p_chave_ip is null or p_chave_ip !~ '^ip:[0-9a-f]{64}$' then raise exception 'Chave inválida'; end if;
  if p_chave_id is not null and p_chave_id !~ '^id:[0-9a-f]{64}$' then raise exception 'Chave inválida'; end if;
  -- Ordem fixa das travas (o ID antes do IP): duas entradas não se esperam em círculo.
  if p_chave_id is null then chaves := array[p_chave_ip]; limites := array[30];
  else chaves := array[p_chave_id, p_chave_ip]; limites := array[5, 30]; end if;

  if p_acao = 'sucesso' then
    delete from public.pops_entrada_tentativas where chave = p_chave_id;
    update public.pops_entrada_tentativas
      set falhas = greatest(falhas - 1, 0),
          bloqueado_ate = case when greatest(falhas - 1, 0) < 30 then null else bloqueado_ate end,
          atualizado_em = agora
      where chave = p_chave_ip;
    return jsonb_build_object('ok', true);
  end if;

  -- Faxina: chave parada há mais de um dia, sem bloqueio valendo, não serve a ninguém.
  delete from public.pops_entrada_tentativas
    where atualizado_em < agora - interval '1 day' and (bloqueado_ate is null or bloqueado_ate <= agora);

  for i in 1 .. array_length(chaves, 1) loop
    insert into public.pops_entrada_tentativas(chave, janela_desde, atualizado_em) values (chaves[i], agora, agora)
      on conflict (chave) do nothing;
    select * into linha from public.pops_entrada_tentativas where chave = chaves[i] for update;
    if linha.bloqueado_ate is not null and linha.bloqueado_ate > agora then
      ate := greatest(coalesce(ate, linha.bloqueado_ate), linha.bloqueado_ate);
    end if;
  end loop;
  -- Bloqueado não conta tentativa nova: o bloqueio não se estica sozinho.
  if ate is not null then return jsonb_build_object('ok', true, 'bloqueado', true, 'ate', ate); end if;

  for i in 1 .. array_length(chaves, 1) loop
    select * into linha from public.pops_entrada_tentativas where chave = chaves[i];
    -- Janela vencida (ou bloqueio cumprido) começa a contar do zero.
    if linha.janela_desde <= agora - janela or linha.bloqueado_ate is not null then
      linha.falhas := 0; linha.janela_desde := agora; linha.bloqueado_ate := null;
    end if;
    linha.falhas := linha.falhas + 1;
    -- Esta é a última tentativa permitida na janela: as próximas esperam o bloqueio.
    if linha.falhas >= limites[i] then linha.bloqueado_ate := agora + bloqueio; end if;
    update public.pops_entrada_tentativas
      set falhas = linha.falhas, janela_desde = linha.janela_desde, bloqueado_ate = linha.bloqueado_ate, atualizado_em = agora
      where chave = chaves[i];
  end loop;
  return jsonb_build_object('ok', true, 'bloqueado', false);
end $$;
revoke all on function public.pops_entrada_aluno(text, text, text) from public, anon, authenticated;
grant execute on function public.pops_entrada_aluno(text, text, text) to service_role;
