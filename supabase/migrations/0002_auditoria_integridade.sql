-- Revisões atômicas, concorrência otimista e arquivamento recuperável.
-- Nenhum conteúdo existente é removido por esta migração.
alter table public.pops_registros add column if not exists revision bigint not null default 1;
alter table public.pops_registros add column if not exists mutation_id text;
create index if not exists pops_cursor_idx on public.pops_registros(colecao, atualizado_em, id);
-- O vínculo conta/pessoa não pode se duplicar, inclusive em dois aparelhos.
create unique index if not exists pops_pessoa_usuario_idx on public.pops_registros(lower(btrim(registro->>'usuario')))
where colecao='pessoas' and not apagado and coalesce(btrim(registro->>'usuario'),'')<>'';

-- Também cobre importações administrativas que escrevem diretamente na tabela.
create or replace function public.pops_versionar_registro() returns trigger
language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' then
    new.revision:=old.revision+1;
    if new.registro is distinct from old.registro and new.mutation_id is not distinct from old.mutation_id then new.mutation_id:=null; end if;
  else new.revision:=1;
  end if;
  new.atualizado_em:=clock_timestamp();
  return new;
end $$;
revoke all on function public.pops_versionar_registro() from public,anon,authenticated;
drop trigger if exists pops_versao_registro on public.pops_registros;
create trigger pops_versao_registro before insert or update on public.pops_registros for each row execute function public.pops_versionar_registro();

create or replace function public.pops_marcar_revisao() returns trigger
language plpgsql security definer set search_path=public as $$
declare c text; n bigint;
begin
  if tg_table_name='pops_config_global' then c:='cfg'; else c:=new.colecao; end if;
  insert into public.pops_meta(chave,valor) values('rev','{"rev":0,"porColecao":{}}') on conflict(chave) do nothing;
  -- Bloqueio da linha + atualização no mesmo comando impedem perder a revisão de outra coleção.
  update public.pops_meta set valor=jsonb_build_object(
    'rev',coalesce((valor->>'rev')::bigint,0)+1,
    'porColecao',coalesce(valor->'porColecao','{}') || jsonb_build_object(c,coalesce((valor->>'rev')::bigint,0)+1)
  ),atualizado_em=clock_timestamp() where chave='rev' returning (valor->>'rev')::bigint into n;
  return new;
end $$;
revoke all on function public.pops_marcar_revisao() from public,anon,authenticated;
drop trigger if exists pops_rev_registros on public.pops_registros;
create trigger pops_rev_registros after insert or update on public.pops_registros for each row execute function public.pops_marcar_revisao();
drop trigger if exists pops_rev_config on public.pops_config_global;
create trigger pops_rev_config after insert or update on public.pops_config_global for each row execute function public.pops_marcar_revisao();

create or replace function public.pops_gravar(p_colecao text,p_id text,p_registro jsonb,p_acao text,p_expected bigint default null,p_mutation text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare atual public.pops_registros%rowtype; conteudo jsonb; arq boolean;
begin
  if p_colecao not in ('pops','jornadas','treinamentos','pessoas','atribuicoes','leituras','progresso') or coalesce(p_id,'')='' then raise exception 'Registro inválido'; end if;
  if p_acao not in ('upsert','delete','restore') then raise exception 'Ação inválida'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pops:'||p_colecao||':'||p_id,0));
  select * into atual from public.pops_registros where colecao=p_colecao and id=p_id for update;
  if p_mutation is not null and atual.mutation_id=p_mutation then
    return jsonb_build_object('ok',true,'revision',atual.revision,'registro',atual.registro,'apagado',atual.apagado);
  end if;
  if p_expected is not null and p_expected<>coalesce(atual.revision,0) then raise exception 'Registro alterado por outra pessoa' using errcode='40001'; end if;
  if p_acao='upsert' then
    -- Um envio antigo não ressuscita um item arquivado.
    if atual.apagado then raise exception 'Item arquivado' using errcode='40001'; end if;
    if jsonb_typeof(p_registro)<>'object' or p_registro->>'id' is distinct from p_id then raise exception 'Conteúdo inválido'; end if;
    conteudo := p_registro - '_serverRevision' - '_apagado'; arq:=false;
  else
    if atual.id is null then raise exception 'Item não encontrado' using errcode='40001'; end if;
    if p_acao='restore' and (atual.registro - 'id' - '_apagado' - 'atualizadoEm')='{}'::jsonb then
      raise exception 'Registro antigo sem conteúdo; recuperar a cópia de segurança' using errcode='40001';
    end if;
    conteudo:=atual.registro - '_apagado'; arq:=p_acao='delete';
  end if;
  conteudo:=conteudo || jsonb_build_object('atualizadoEm',clock_timestamp());
  insert into public.pops_registros(colecao,id,registro,apagado,atualizado_em,revision,mutation_id)
    values(p_colecao,p_id,conteudo,arq,clock_timestamp(),coalesce(atual.revision,0)+1,p_mutation)
    on conflict(colecao,id) do update set registro=excluded.registro,apagado=excluded.apagado,atualizado_em=excluded.atualizado_em,revision=excluded.revision,mutation_id=excluded.mutation_id
    returning * into atual;
  return jsonb_build_object('ok',true,'revision',atual.revision,'registro',atual.registro,'apagado',atual.apagado);
end $$;
revoke all on function public.pops_gravar(text,text,jsonb,text,bigint,text) from public,anon,authenticated;
grant execute on function public.pops_gravar(text,text,jsonb,text,bigint,text) to service_role;

create or replace function public.pops_configurar(p_patch jsonb,p_anterior jsonb default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare atual jsonb; k text;
begin
  if jsonb_typeof(p_patch)<>'object' then raise exception 'Configuração inválida'; end if;
  perform pg_advisory_xact_lock(hashtextextended('pops:cfg',0));
  select config into atual from public.pops_config_global where id=true for update;
  atual:=coalesce(atual,'{}');
  -- Compara apenas os campos editados, preservando mudanças independentes.
  if p_anterior is not null then
    for k in select jsonb_object_keys(p_patch) loop
      if atual->k is distinct from p_anterior->k then raise exception 'Configuração alterada' using errcode='40001'; end if;
    end loop;
  end if;
  atual:=atual||p_patch;
  insert into public.pops_config_global(id,config,atualizado_em) values(true,atual,clock_timestamp())
    on conflict(id) do update set config=excluded.config,atualizado_em=excluded.atualizado_em;
  return jsonb_build_object('ok',true,'config',atual);
end $$;
revoke all on function public.pops_configurar(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pops_configurar(jsonb,jsonb) to service_role;

-- Espelho mínimo do RH, lido inteiro dentro da mesma transação; sem teto HTTP de 1.000 linhas.
create or replace function public.pops_sincronizar_pessoas() returns jsonb
language plpgsql security definer set search_path=public as $$
declare r record; antes public.pops_registros%rowtype; reg jsonb; vivos text[]:='{}'; ativos integer:=0; desligados integer:=0; arquivados integer:=0; mudou boolean:=false;
begin
  perform pg_advisory_xact_lock(hashtextextended('pops:espelho-rh',0));
  for r in select c.id,c.registro,a.registro->>'nome' as area from public.registros c
    left join public.registros a on a.colecao='areas' and a.id=c.registro->>'areaId' and not a.apagado
    where c.colecao='colaboradores' and not c.apagado order by c.id loop
    if coalesce(btrim(r.registro->>'nome'),'')='' then continue; end if;
    if coalesce(btrim(r.registro->>'dataDesligamento'),'')<>'' then desligados:=desligados+1; continue; end if;
    vivos:=array_append(vivos,'p-'||r.id); ativos:=ativos+1;
    select * into antes from public.pops_registros where colecao='pessoas' and id='p-'||r.id for update;
    reg:=jsonb_build_object('id','p-'||r.id,'nome',r.registro->>'nome','funcao',coalesce(r.registro->>'funcao',r.registro->>'cargoLivre',''),
      'area',r.area,'gestorId',case when coalesce(r.registro->>'gestorId','')<>'' then 'p-'||(r.registro->>'gestorId') else null end,
      'admissao',r.registro->>'dataAdmissao','origem','rh');
    if antes.registro ? 'usuario' then reg:=reg||jsonb_build_object('usuario',antes.registro->'usuario'); end if;
    if antes.registro ? 'observacao' then reg:=reg||jsonb_build_object('observacao',antes.registro->'observacao'); end if;
    if antes.id is null or antes.apagado or (antes.registro-'atualizadoEm') is distinct from reg then
      insert into public.pops_registros(colecao,id,registro,apagado,atualizado_em,revision)
      values('pessoas','p-'||r.id,reg||jsonb_build_object('atualizadoEm',clock_timestamp()),false,clock_timestamp(),coalesce(antes.revision,0)+1)
      on conflict(colecao,id) do update set registro=excluded.registro,apagado=false,atualizado_em=excluded.atualizado_em,revision=excluded.revision,mutation_id=null;
      mudou:=true;
    end if;
  end loop;
  -- Origem inesperadamente vazia nunca arquiva a equipe inteira.
  if ativos=0 and exists(select 1 from public.pops_registros where colecao='pessoas' and not apagado and registro->>'origem'='rh') then
    raise exception 'RH sem pessoas ativas; confira a origem antes de sincronizar';
  end if;
  update public.pops_registros set apagado=true,atualizado_em=clock_timestamp(),revision=revision+1,mutation_id=null
    where colecao='pessoas' and not apagado and registro->>'origem'='rh' and not(id=any(vivos));
  get diagnostics arquivados=row_count;
  return jsonb_build_object('ok',true,'ativos',ativos,'desligados',desligados,'arquivados',arquivados,'mudou',mudou or arquivados>0);
end $$;
revoke all on function public.pops_sincronizar_pessoas() from public,anon,authenticated;
grant execute on function public.pops_sincronizar_pessoas() to service_role;
