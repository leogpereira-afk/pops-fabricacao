import test, {before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let db;
before(async()=>{
 db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.registros(colecao text,id text,registro jsonb,apagado boolean default false,primary key(colecao,id));');
 for(const name of ['0001_init.sql','0002_auditoria_integridade.sql','0004_escola.sql','0005_academia.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
});
after(async()=>await db?.close());beforeEach(async()=>await db.exec('begin'));afterEach(async()=>await db.exec('rollback'));
const put=async(col,id,r,rev=0,mid='m1')=>(await db.query('select pops_gravar($1,$2,$3,$4,$5,$6) r',[col,id,r,'upsert',rev,mid])).rows[0].r;
test('formações e progresso escolar persistem no mesmo cofre com revisões e RLS',async()=>{
 const f=await put('formacoes','f1',{id:'f1',titulo:'Exemplo',versao:'1'});const a=await put('aprendizagem','a1',{id:'a1',colaboradorId:'rh1',formacaoId:'f1',pontos:10});assert.equal(f.ok,true);assert.equal(a.ok,true);const q=await db.query("select registro from pops_registros where colecao='aprendizagem'");assert.equal(q.rows[0].registro.colaboradorId,'rh1');const r=await db.query("select relrowsecurity from pg_class where relname='pops_registros'");assert.equal(r.rows[0].relrowsecurity,true);
});
test('retransmissão e conflito não duplicam conquistas nem sobrescrevem prática',async()=>{
 const r={id:'a1',pontos:10,conquistas:[{chave:'f1:et1'}]};const a=await put('aprendizagem','a1',r);const b=await put('aprendizagem','a1',r);assert.equal(a.revision,b.revision);await assert.rejects(put('aprendizagem','a1',{...r,pontos:999},0,'m2'),{code:'40001'});
});
test('pessoas, leituras e jornadas legadas continuam preservadas com migração',async()=>{
 for(const col of ['pessoas','leituras','jornadas','treinamentos','progresso']){const r=await put(col,'old',{id:'old',conteudo:'Legado'});assert.equal(r.registro.conteudo,'Legado');}
});
test('rotina da escola não concede escrita SQL a anon nem authenticated',async()=>{
 const {n}=(await db.query("select count(*)::integer n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname like 'pops_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))")).rows[0];assert.equal(n,0);
});

test('biblioteca, perfil e NRs persistem sem abrir acesso SQL e PDF permanece privado',async()=>{
 for(const col of ['materiais','estudos','instrumentos','perfis','capacitacoes']){const r=await put(col,'n1',{id:'n1',versao:'1'});assert.equal(r.ok,true);}
 const r=(await db.query("select public,file_size_limit from storage.buckets where id='pops-escola-documentos'")).rows[0];assert.equal(r.public,false);assert.equal(Number(r.file_size_limit),25000000);
});
