-- Espelho profissional ligado ao ID real do RH. Não altera contas, permissões,
-- atribuições ou históricos; só a ação explícita do administrador o atualiza.
create or replace function public.pops_sincronizar_pessoas() returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 r record; antes public.pops_registros%rowtype; reg jsonb; vivos text[]:='{}';
 ativos integer:=0; desligados integer:=0; arquivados integer:=0; mudou boolean:=false;
 vinculados integer:=0; sem_conta integer:=0; conflitos integer:=0;
 n_contas integer; conta_central text; login_central text; login_sistema text; vinculo_status text;
begin
 perform pg_advisory_xact_lock(hashtextextended('pops:espelho-rh',0));
 for r in select c.id,c.registro,a.registro->>'nome' as area,ca.registro->>'nome' as cargo
   from public.registros c
   left join public.registros a on a.colecao='areas' and a.id=c.registro->>'areaId' and not a.apagado
   left join public.registros ca on ca.colecao='cargos' and ca.id=c.registro->>'cargoId' and not ca.apagado
   where c.colecao='colaboradores' and not c.apagado order by c.id loop
   if coalesce(btrim(r.registro->>'nome'),'')='' then continue; end if;
   if coalesce(btrim(r.registro->>'dataDesligamento'),'')<>'' then desligados:=desligados+1; continue; end if;
   vivos:=array_append(vivos,'p-'||r.id); ativos:=ativos+1;
   select * into antes from public.pops_registros where colecao='pessoas' and id='p-'||r.id for update;
   reg:=jsonb_build_object('id','p-'||r.id,'colaboradorId',r.id,'nome',r.registro->>'nome',
     'funcao',coalesce(nullif(r.cargo,''),nullif(r.registro->>'cargoLivre',''),r.registro->>'funcao',''),
     'cargoId',r.registro->>'cargoId','areaId',r.registro->>'areaId','area',r.area,
     'setor',coalesce(r.registro->>'setor',''),'statusId',coalesce(r.registro->>'statusId',''),
     'gestorId',case when coalesce(r.registro->>'gestorId','')<>'' then 'p-'||(r.registro->>'gestorId') else null end,
     'admissao',r.registro->>'dataAdmissao','origem','rh');
   if antes.registro ? 'usuario' then reg:=reg||jsonb_build_object('usuario',antes.registro->'usuario'); end if;
   if antes.registro ? 'observacao' then reg:=reg||jsonb_build_object('observacao',antes.registro->'observacao'); end if;
   -- Só vínculo já concedido na Central: a comparação é pelo ID, nunca pelo nome.
   select count(*),min(c.id::text),min(c.usuario),min(p.login) into n_contas,conta_central,login_central,login_sistema
     from public.acesso_conta c join public.acesso_papel p on p.conta_id=c.id and p.sistema='pops' and p.ativo
     where c.ativo and c.colaborador_id=r.id and p.papel in ('equipe','gestor','admin')
       and exists(select 1 from public.equipe_contas e where e.sistema='pops' and e.ativo and e.usuario=c.usuario);
   vinculo_status:='sem_conta';
   if n_contas>1 then vinculo_status:='conflito';
   elsif n_contas=1 then
     if (coalesce(btrim(antes.registro->>'usuario'),'')<>''
         and lower(btrim(antes.registro->>'usuario')) not in (lower(btrim(login_central)),lower(btrim(coalesce(login_sistema,login_central)))))
       or exists(select 1 from public.pops_registros p where p.colecao='pessoas' and not p.apagado and p.id<>'p-'||r.id and lower(btrim(p.registro->>'usuario'))=lower(btrim(login_central)))
       or exists(select 1 from public.acesso_conta c where c.id::text<>conta_central and c.usuario=login_central)
       or exists(select 1 from public.acesso_papel p where p.sistema='pops' and p.conta_id::text<>conta_central and p.login=login_central)
     then vinculo_status:='conflito';
     elsif coalesce(r.registro->>'statusId','') in ('inativo','abandono') then vinculo_status:='pessoa_desligada';
     else
       vinculo_status:='vinculado';
       -- Não renomear um login antigo válido nem reescrever IDs de leituras.
       reg:=reg||jsonb_build_object('usuario',coalesce(nullif(btrim(antes.registro->>'usuario'),''),login_central),'vinculoOrigem','central_rh');
     end if;
   end if;
   reg:=reg||jsonb_build_object('vinculoStatus',vinculo_status);
   if vinculo_status='vinculado' then vinculados:=vinculados+1;
   elsif vinculo_status='conflito' then conflitos:=conflitos+1;
   else sem_conta:=sem_conta+1; end if;
   if antes.id is null or antes.apagado or (antes.registro-'atualizadoEm') is distinct from reg then
     insert into public.pops_registros(colecao,id,registro,apagado,atualizado_em,revision)
     values('pessoas','p-'||r.id,reg||jsonb_build_object('atualizadoEm',clock_timestamp()),false,clock_timestamp(),coalesce(antes.revision,0)+1)
     on conflict(colecao,id) do update set registro=excluded.registro,apagado=false,atualizado_em=excluded.atualizado_em,revision=excluded.revision,mutation_id=null;
     mudou:=true;
   end if;
 end loop;
 if ativos=0 and exists(select 1 from public.pops_registros where colecao='pessoas' and not apagado and registro->>'origem'='rh') then
   raise exception 'RH sem pessoas ativas; confira a origem antes de sincronizar';
 end if;
 update public.pops_registros set apagado=true,atualizado_em=clock_timestamp(),revision=revision+1,mutation_id=null
   where colecao='pessoas' and not apagado and registro->>'origem'='rh' and not(id=any(vivos));
 get diagnostics arquivados=row_count;
 return jsonb_build_object('ok',true,'ativos',ativos,'desligados',desligados,'arquivados',arquivados,'mudou',mudou or arquivados>0,
   'vinculados',vinculados,'semConta',sem_conta,'conflitos',conflitos);
end $$;
revoke all on function public.pops_sincronizar_pessoas() from public,anon,authenticated;
grant execute on function public.pops_sincronizar_pessoas() to service_role;
