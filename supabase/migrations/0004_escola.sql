-- Escola: aditiva, sem alterar históricos ou registros existentes.
create or replace function public.pops_gravar(p_colecao text,p_id text,p_registro jsonb,p_acao text,p_expected bigint default null,p_mutation text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare atual public.pops_registros%rowtype; conteudo jsonb; arq boolean;
begin
  if p_colecao not in ('pops','jornadas','treinamentos','pessoas','atribuicoes','leituras','progresso','formacoes','aprendizagem') or coalesce(p_id,'')='' then raise exception 'Registro inválido'; end if;
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

