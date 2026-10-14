-- Entrada do aluno pelo ID do RH e primeiro nome (14/10/2026).
--
-- O ID tem só 6 dígitos: sem limite de tentativas, dava para varrer os IDs. O
-- limite mora no banco, não na memória de uma instância da função (que reinicia
-- e se multiplica). A regra é desta rotina e de mais ninguém. Em 15 minutos:
--   - 5 tentativas erradas do mesmo ID bloqueiam esse ID;
--   - 20 erradas com o mesmo primeiro nome bloqueiam esse nome (quem fixa um
--     nome comum e percorre os IDs, vindo de muitos endereços);
--   - 30 erradas do mesmo IP bloqueiam esse IP;
--   - 300 erradas no total bloqueiam a entrada de aluno inteira (teto que não
--     depende do IP nem do nome: limita a varredura mesmo com o endereço forjado).
-- Cada bloqueio dura 15 minutos. Entrada certa zera o ID e devolve aos outros
-- contadores (nome, IP e total) a tentativa que contou. A administração libera
-- tudo na hora (pops_entrada_aluno_bloqueios), por exemplo quando a turma inteira
-- da fábrica, atrás do mesmo IP, ficou bloqueada.
--
-- Cada tentativa conta ANTES de a função conferir o ID e o nome ('tentar'): duas
-- tentativas ao mesmo tempo não passam juntas do limite. A entrada certa avisa
-- depois ('sucesso'). Função que cair no meio deixa a tentativa contada como
-- errada, o lado seguro. Tentativa barrada por um bloqueio não conta e não deixa
-- linha nova: um IP bloqueado não enche a tabela.
--
-- Tabela privada: RLS ligada e sem policy, sem permissão para anon e
-- authenticated; só estas rotinas (security definer, executadas pela
-- service_role da função pops-sync) mexem nela. As chaves chegam cifradas pela
-- função (HMAC com segredo do servidor: 'id:', 'nome:' e 'ip:' + 64 hexadecimais):
-- o banco não guarda o ID, o nome nem o IP de ninguém. A chave do total é fixa.
-- Aditiva: não toca em nenhuma tabela existente.
create table if not exists public.pops_entrada_tentativas (
  chave text primary key check (chave ~ '^(id|nome|ip|geral):[0-9a-f]{64}$'),
  falhas integer not null default 0 check (falhas >= 0),
  janela_desde timestamptz not null default clock_timestamp(),
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default clock_timestamp()
);
create index if not exists pops_entrada_tentativas_atualizado_idx on public.pops_entrada_tentativas(atualizado_em);
alter table public.pops_entrada_tentativas enable row level security;
revoke all on table public.pops_entrada_tentativas from public, anon, authenticated;

-- A versão de três parâmetros (sem o nome) não chegou a ser publicada; se uma
-- prévia a criou, sai para não sobrar uma porta com a regra antiga.
drop function if exists public.pops_entrada_aluno(text, text, text);
create or replace function public.pops_entrada_aluno(p_acao text, p_chave_id text, p_chave_ip text, p_chave_nome text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  agora timestamptz := clock_timestamp();
  janela constant interval := interval '15 minutes';
  bloqueio constant interval := interval '15 minutes';
  geral constant text := 'geral:' || repeat('0', 64);
  linha public.pops_entrada_tentativas%rowtype;
  chaves text[] := '{}'; limites integer[] := '{}'; criadas text[] := '{}';
  nova text; ate timestamptz; i integer;
begin
  if p_acao not in ('tentar', 'sucesso') then raise exception 'Ação inválida'; end if;
  if p_chave_ip is null or p_chave_ip !~ '^ip:[0-9a-f]{64}$' then raise exception 'Chave inválida'; end if;
  if p_chave_id is not null and p_chave_id !~ '^id:[0-9a-f]{64}$' then raise exception 'Chave inválida'; end if;
  if p_chave_nome is not null and p_chave_nome !~ '^nome:[0-9a-f]{64}$' then raise exception 'Chave inválida'; end if;
  -- Ordem fixa das travas (ID, nome, IP, total), uma chave de cada tipo por
  -- chamada: duas entradas nunca se esperam em círculo.
  if p_chave_id is not null then chaves := chaves || p_chave_id; limites := limites || 5; end if;
  if p_chave_nome is not null then chaves := chaves || p_chave_nome; limites := limites || 20; end if;
  chaves := chaves || p_chave_ip || geral; limites := limites || 30 || 300;

  if p_acao = 'sucesso' then
    if p_chave_id is not null then delete from public.pops_entrada_tentativas where chave = p_chave_id; end if;
    -- Os contadores divididos (nome, IP, total) recebem de volta a tentativa certa;
    -- o bloqueio que ela mesma armou se desfaz.
    for i in 1 .. array_length(chaves, 1) loop
      continue when chaves[i] = p_chave_id;
      update public.pops_entrada_tentativas
        set falhas = greatest(falhas - 1, 0),
            bloqueado_ate = case when greatest(falhas - 1, 0) < limites[i] then null else bloqueado_ate end,
            atualizado_em = agora
        where chave = chaves[i];
    end loop;
    return jsonb_build_object('ok', true);
  end if;

  for i in 1 .. array_length(chaves, 1) loop
    nova := null;
    insert into public.pops_entrada_tentativas(chave, janela_desde, atualizado_em) values (chaves[i], agora, agora)
      on conflict (chave) do nothing returning chave into nova;
    if nova is not null then criadas := criadas || nova; end if;
    select * into linha from public.pops_entrada_tentativas where chave = chaves[i] for update;
    if linha.bloqueado_ate is not null and linha.bloqueado_ate > agora then
      ate := greatest(coalesce(ate, linha.bloqueado_ate), linha.bloqueado_ate);
    end if;
  end loop;
  -- Bloqueado não conta tentativa nova (o bloqueio não se estica sozinho) e não
  -- deixa linha: a que esta chamada criou para conferir sai de novo.
  if ate is not null then
    if array_length(criadas, 1) > 0 then delete from public.pops_entrada_tentativas where chave = any(criadas); end if;
    return jsonb_build_object('ok', true, 'bloqueado', true, 'ate', ate);
  end if;

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

  -- Faxina em lote pequeno, por último: a chamada já tem as próprias travas e
  -- pula (skip locked) as linhas que outra entrada estiver usando, então nunca
  -- espera ninguém. Chave parada há mais de um dia, sem bloqueio valendo, não
  -- serve a ninguém.
  delete from public.pops_entrada_tentativas where chave in (
    select chave from public.pops_entrada_tentativas
      where atualizado_em < agora - interval '1 day' and (bloqueado_ate is null or bloqueado_ate <= agora)
      order by atualizado_em limit 200 for update skip locked);
  return jsonb_build_object('ok', true, 'bloqueado', false);
end $$;
revoke all on function public.pops_entrada_aluno(text, text, text, text) from public, anon, authenticated;
grant execute on function public.pops_entrada_aluno(text, text, text, text) to service_role;

-- Administração (pela operação liberarEntradaAluno da escola, que confere o
-- papel): quantos bloqueios valem agora e, com p_liberar, zera as tentativas
-- contadas, liberando na hora quem estava bloqueado.
create or replace function public.pops_entrada_aluno_bloqueios(p_liberar boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  agora timestamptz := clock_timestamp();
  n integer;
begin
  select count(*)::integer into n from public.pops_entrada_tentativas where bloqueado_ate > agora;
  if p_liberar then
    -- Com where explícito: o banco pode recusar delete sem filtro (safeupdate).
    delete from public.pops_entrada_tentativas where chave is not null;
    return jsonb_build_object('ok', true, 'bloqueios', 0, 'liberados', n);
  end if;
  return jsonb_build_object('ok', true, 'bloqueios', n);
end $$;
revoke all on function public.pops_entrada_aluno_bloqueios(boolean) from public, anon, authenticated;
grant execute on function public.pops_entrada_aluno_bloqueios(boolean) to service_role;
