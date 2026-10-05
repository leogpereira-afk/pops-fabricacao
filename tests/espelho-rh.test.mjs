import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
let db;
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean);create table public.registros(colecao text,id text,registro jsonb,apagado boolean default false,atualizado_em timestamptz default now(),primary key(colecao,id));create table acesso_conta(id text primary key,usuario text,colaborador_id text,ativo boolean default true);create table acesso_papel(conta_id text,sistema text,login text,papel text,ativo boolean default true);create table equipe_contas(sistema text,usuario text,ativo boolean default true);`);
 for(const f of ['0001_init.sql','0002_auditoria_integridade.sql','0003_identidade_rh.sql']) if(!(process.env.BASELINE_RH && f==='0003_identidade_rh.sql') && fs.existsSync(new URL('../supabase/migrations/'+f,import.meta.url))) await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
});
after(async()=>db?.close());beforeEach(async()=>db.exec('begin'));afterEach(async()=>db.exec('rollback'));
const pessoa=async(id,nome='Pessoa fictícia',mais={})=>db.query("insert into registros(colecao,id,registro) values('colaboradores',$1,$2)",[id,{nome,statusId:'ativo',...mais}]);
const conta=async(id,cid,usuario)=>{await db.query('insert into acesso_conta(id,colaborador_id,usuario) values($1,$2,$3)',[id,cid,usuario]);await db.query("insert into acesso_papel(conta_id,sistema,login,papel) values($1,'pops',$2,'equipe')",[id,usuario]);await db.query("insert into equipe_contas(sistema,usuario) values('pops',$1)",[usuario]);};
const sync=async()=>(await db.query('select pops_sincronizar_pessoas() as r')).rows[0].r;
const ler=async(id)=>(await db.query("select registro,revision,apagado from pops_registros where colecao='pessoas' and id=$1",[id])).rows[0];
test('espelho usa ID RH e vínculo exato concedido na Central, com cargo e área atuais',async()=>{
 await pessoa('c1','Pessoa fictícia',{cargoId:'cargo1',areaId:'area1',funcao:'Função antiga',setor:'Impressão',cpf:'não-copiar',salario:99});await conta('a1','c1','ana');
 await db.exec(`insert into registros(colecao,id,registro) values('cargos','cargo1','{"nome":"Impressor"}'),('areas','area1','{"nome":"Produção"}')`);
 const r=await sync(),p=(await ler('p-c1')).registro;assert.equal(r.vinculados,1);assert.equal(p.colaboradorId,'c1');assert.equal(p.usuario,'ana');assert.equal(p.funcao,'Impressor');assert.equal(p.area,'Produção');assert.equal(p.vinculoOrigem,'central_rh');assert.equal(p.cpf,undefined);assert.equal(p.salario,undefined);
 assert.equal((await sync()).mudou,false);
});
test('nome semelhante não cria vínculo nem inventa conta',async()=>{
 await pessoa('c1','Ana');await conta('a1','outro-id','ana');const r=await sync();assert.equal(r.semConta,1);assert.equal((await ler('p-c1')).registro.usuario,undefined);
});
test('vínculo manual conflitante é preservado e sinalizado sem deslocar histórico',async()=>{
 await pessoa('c1');await conta('a1','c1','ana');await db.query("select pops_gravar('pessoas','p-c1',$1,'upsert',null,null)",[{id:'p-c1',origem:'rh',usuario:'antiga',observacao:'Preservar'}]);
 await db.query("select pops_gravar('leituras','l-antiga-pop1',$1,'upsert',null,null)",[{id:'l-antiga-pop1',usuario:'antiga',popId:'pop1',versaoLida:'1.0'}]);
 const r=await sync(),p=(await ler('p-c1')).registro;assert.equal(r.conflitos,1);assert.equal(p.usuario,'antiga');assert.equal(p.observacao,'Preservar');assert.equal(p.vinculoStatus,'conflito');assert.equal((await db.query("select count(*)::int n from pops_registros where colecao='leituras' and id='l-antiga-pop1'")).rows[0].n,1);
});
test('permissão ausente ou inativa não vincula nem concede acesso',async()=>{
 await pessoa('c1');await conta('a1','c1','ana');await db.exec("update acesso_papel set ativo=false");const r=await sync();assert.equal(r.vinculados,0);assert.equal((await ler('p-c1')).registro.usuario,undefined);
});
test('duas contas para mesmo RH não escolhem a primeira',async()=>{
 await pessoa('c1');await conta('a1','c1','ana');await conta('a2','c1','outra');const r=await sync();assert.equal(r.conflitos,1);assert.equal((await ler('p-c1')).registro.usuario,undefined);
});
test('ID/atribuições não mudam com atualização de cargo e espelho não copia dados privados',async()=>{
 await pessoa('c1','Ana',{cargoId:'carg1'});await conta('a1','c1','ana');await sync();await db.query("select pops_gravar('atribuicoes','a1',$1,'upsert',null,null)",[{id:'a1',pessoaId:'p-c1',tipo:'pop',refId:'pop1'}]);
 await db.exec(`update registros set registro=registro||'{"cargoId":"cargo2"}' where id='c1'`);await sync();assert.equal((await ler('p-c1')).registro.cargoId,'cargo2');assert.equal((await db.query("select registro->>'pessoaId' id from pops_registros where colecao='atribuicoes'")).rows[0].id,'p-c1');
});
test('origem vazia não arquiva todos e função continua restrita ao servidor',async()=>{
 await pessoa('c1');await sync();await db.exec("update registros set apagado=true");await assert.rejects(sync(),/RH sem pessoas ativas/);
});
test('login de outra conta apontado para o mesmo apelido gera conflito no espelho',async()=>{
 await pessoa('c1');await pessoa('c2');await conta('a1','c1','ana');await conta('a2','c2','bia');await db.exec("update acesso_papel set login='ana' where conta_id='a2'");
 const r=await sync();assert.ok(r.conflitos>=1);assert.equal((await ler('p-c1')).registro.usuario,undefined);assert.equal((await ler('p-c1')).registro.vinculoStatus,'conflito');
});
