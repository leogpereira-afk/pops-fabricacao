import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let db;
before(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.registros(colecao text,id text,registro jsonb,apagado boolean default false,primary key(colecao,id));');
 for(const name of ['0001_init.sql','0002_auditoria_integridade.sql','0004_escola.sql','0005_academia.sql','0007_planos_aprendizagem.sql']){const url=new URL('../supabase/migrations/'+name,import.meta.url);if(fs.existsSync(url))await db.exec(fs.readFileSync(url,'utf8'));}
});
after(async()=>db?.close());beforeEach(async()=>db.exec('begin'));afterEach(async()=>db.exec('rollback'));
const plan=(id='plano-ficticio',pid='rh1',signature='original')=>({id,colaboradorId:pid,titulo:'Jornada fictícia',itens:[{formacaoId:'f1'}],ativa:true,alteracoes:[{id:'m1',assinatura:signature,por:'admin',em:new Date().toISOString()}]});
const put=async(r=plan(),rev=0,mid='m1')=>(await db.query('select pops_gravar($1,$2,$3,$4,$5,$6) r',['planos_aprendizagem',r.id,r,'upsert',rev,mid])).rows[0].r;
test('plano persiste com revisão e replay idêntico sem sobrescrever',async()=>{const a=await put();const b=await put();assert.equal(a.ok,true);assert.equal(a.revision,b.revision);});
test('CAS e id de mutação reaproveitado com conteúdo diferente são recusados no banco',async()=>{await put();await assert.rejects(put(plan('plano-ficticio','rh1','outro'),0,'m1'),{code:'40001'});});
test('revisão concorrente não altera plano nem pontos antigos',async()=>{await db.query("select pops_gravar('aprendizagem','antigo',$1,'upsert',0,'old')",[{id:'antigo',pontos:10}]);const a=await put();await put(plan('plano-ficticio','rh1','novo'),a.revision,'m2');await assert.rejects(put(plan('plano-ficticio','rh1','atrasado'),a.revision,'m3'),{code:'40001'});});
test('uma pessoa não recebe planos duplicados e revisão nula não ignora CAS',async()=>{await put();await assert.rejects(put(plan('outro','rh1'),0,'outro'),{code:'23505'});});
test('plano exige revisão e mutação e acesso SQL permanece só no serviço',async()=>{await assert.rejects(put(plan(),null,'m1'));});
test('migração preserva histórico e permissões do cofre',async()=>{await db.query("select pops_gravar('aprendizagem','antigo',$1,'upsert',0,'old')",[{id:'antigo',pontos:10}]);await put();const r=(await db.query("select registro from pops_registros where colecao='aprendizagem'")).rows[0];assert.equal(r.registro.pontos,10);for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.pops_gravar(text,text,jsonb,text,bigint,text)','EXECUTE') ok",[role])).rows[0].ok,false);});
