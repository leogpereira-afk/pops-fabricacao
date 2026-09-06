import test, {before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let db;
before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean); create table public.registros(colecao text,id text,registro jsonb,apagado boolean default false,atualizado_em timestamptz default now(),primary key(colecao,id));`);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/0001_init.sql',import.meta.url),'utf8'));
  if(!process.env.BASELINE_SQL)await db.exec(fs.readFileSync(new URL('../supabase/migrations/0002_auditoria_integridade.sql',import.meta.url),'utf8'));
});
after(async()=>await db?.close());beforeEach(async()=>await db.exec('begin'));afterEach(async()=>await db.exec('rollback'));
const gravar=async(col,id,registro,acao='upsert',expected=null,mutation=null)=>(await db.query('select pops_gravar($1,$2,$3,$4,$5,$6) as r',[col,id,registro,acao,expected,mutation])).rows[0].r;
test('arquivar preserva conteúdo e permite restaurar sem reconstrução manual',async()=>{
  const novo=await gravar('pops','p1',{id:'p1',titulo:'Procedimento fictício',blocos:[{texto:'Conteúdo importante'}]});
  const arq=await gravar('pops','p1',null,'delete',novo.revision);
  assert.equal(arq.apagado,true);assert.equal(arq.registro.blocos[0].texto,'Conteúdo importante');
  const restaurado=await gravar('pops','p1',null,'restore',arq.revision);
  assert.equal(restaurado.apagado,false);assert.equal(restaurado.registro.titulo,'Procedimento fictício');
});
test('edição desatualizada não sobrescreve uma versão mais nova',async()=>{
  const a=await gravar('pops','p1',{id:'p1',titulo:'A'});await gravar('pops','p1',{id:'p1',titulo:'B'},'upsert',a.revision);
  await assert.rejects(gravar('pops','p1',{id:'p1',titulo:'C'},'upsert',a.revision),{code:'40001'});
});
test('repetição do mesmo envio após perda da resposta não grava novamente',async()=>{
  const a=await gravar('pops','p1',{id:'p1',titulo:'A'},'upsert',0,'envio-1');
  const b=await gravar('pops','p1',{id:'p1',titulo:'A'},'upsert',0,'envio-1');assert.equal(a.revision,b.revision);
});
test('edição offline antiga não ressuscita registro arquivado',async()=>{
  await gravar('pops','p1',{id:'p1',titulo:'A'});await gravar('pops','p1',null,'delete');
  await assert.rejects(gravar('pops','p1',{id:'p1',titulo:'A'}),{code:'40001'});
});
test('bump conserva revisões de coleções diferentes e avança em cada escrita',async()=>{
  await gravar('pops','p1',{id:'p1'});await gravar('jornadas','j1',{id:'j1'});await gravar('pops','p1',{id:'p1'});
  const {valor}= (await db.query("select valor from pops_meta where chave='rev'")).rows[0];
  assert.equal(valor.rev,3);assert.equal(valor.porColecao.pops,3);assert.equal(valor.porColecao.jornadas,2);
});
test('configuração parcial preserva campos não enviados',async()=>{
  await db.query('select pops_configurar($1)',[{setores:['A'],linhas:[{id:'l1'}]}]);
  const {r}=(await db.query('select pops_configurar($1,$2) as r',[{setores:['B']},{setores:['A']}])).rows[0];
  assert.deepEqual(r.config.linhas,[{id:'l1'}]);assert.deepEqual(r.config.setores,['B']);
});
test('configuração concorrente é rejeitada sem apagar a alteração anterior',async()=>{
  await db.query('select pops_configurar($1)',[{setores:['A']}]);
  await assert.rejects(db.query('select pops_configurar($1,$2)',[{setores:['C']},{setores:['B']}]),{code:'40001'});
});
test('espelho RH ignora arquivados, preserva vínculo e não altera revisão sem novidade',async()=>{
  await db.query("insert into registros(colecao,id,registro,apagado) values('colaboradores','c1',$1,false),('colaboradores','c2',$2,true)",[{nome:'Pessoa fictícia',salario:999,cpf:'fictício'},{nome:'Arquivada fictícia'}]);
  await gravar('pessoas','p-c1',{id:'p-c1',origem:'rh',usuario:'ana',observacao:'Preservar'});
  const s1=(await db.query('select pops_sincronizar_pessoas() as r')).rows[0].r;assert.equal(s1.ativos,1);
  const {registro:r}=(await db.query("select registro from pops_registros where colecao='pessoas'")).rows[0];
  assert.equal(r.usuario,'ana');assert.equal(r.observacao,'Preservar');assert.equal(r.salario,undefined);assert.equal(r.cpf,undefined);
  const s2=(await db.query('select pops_sincronizar_pessoas() as r')).rows[0].r;assert.equal(s2.mudou,false);
});
test('espelho com origem inesperadamente vazia não arquiva todas as pessoas',async()=>{
  await gravar('pessoas','p-c1',{id:'p-c1',origem:'rh',nome:'Pessoa fictícia'});
  await assert.rejects(db.query('select pops_sincronizar_pessoas()'),/RH sem pessoas ativas/);
});
test('espelho consulta mais de mil colaboradores sem truncamento',async()=>{
  await db.exec("insert into registros(colecao,id,registro) select 'colaboradores','c'||n,jsonb_build_object('nome','Pessoa fictícia '||n) from generate_series(1,1001)n");
  const {r}=(await db.query('select pops_sincronizar_pessoas() as r')).rows[0];assert.equal(r.ativos,1001);
  const {n}=(await db.query("select count(*)::integer n from pops_registros where colecao='pessoas' and not apagado")).rows[0];assert.equal(n,1001);
});
test('rotinas que alteram dados não ficam executáveis por visitantes ou contas comuns',async()=>{
  const {n}=(await db.query("select count(*)::integer n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname like 'pops_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))")).rows[0];assert.equal(n,0);
});
test('importação direta também invalida edições antigas',async()=>{
  const a=await gravar('pops','p1',{id:'p1',titulo:'A'});
  await db.exec("update pops_registros set registro=registro||'{\"titulo\":\"Importado\"}' where colecao='pops' and id='p1'");
  await assert.rejects(gravar('pops','p1',{id:'p1',titulo:'Desatualizado'},'upsert',a.revision),{code:'40001'});
});
