import test, {before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

// Limite de tentativas da entrada do aluno no banco real (PGlite), com chaves
// fictícias no formato que a função manda ('id:' ou 'ip:' + 64 hexadecimais).
let db;
before(async()=>{
 db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.registros(colecao text,id text,registro jsonb,apagado boolean default false,primary key(colecao,id));');
 for(const name of ['0001_init.sql','0002_auditoria_integridade.sql','0004_escola.sql','0005_academia.sql','0006_entrada_aluno.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
});
after(async()=>await db?.close());beforeEach(async()=>await db.exec('begin'));afterEach(async()=>await db.exec('rollback'));
const chave=(tipo,n)=>tipo+':'+String(n).padStart(64,'0');
const ID=chave('id','a1'),ID2=chave('id','b2'),IP=chave('ip','c3'),IP2=chave('ip','d4');
const tentar=async(id=ID,ip=IP)=>(await db.query('select pops_entrada_aluno($1,$2,$3) r',['tentar',id,ip])).rows[0].r;
const sucesso=async(id=ID,ip=IP)=>(await db.query('select pops_entrada_aluno($1,$2,$3) r',['sucesso',id,ip])).rows[0].r;
// Erro esperado dentro da transação do teste: volta ao ponto salvo e devolve o erro.
const recusa=async(sql,params)=>{await db.exec('savepoint antes');try{await db.query(sql,params);}catch(e){await db.exec('rollback to savepoint antes');return e;}throw new Error('Era para recusar: '+sql);};
const linha=async k=>(await db.query('select falhas,bloqueado_ate from pops_entrada_tentativas where chave=$1',[k])).rows[0]||null;
// Relógio: o banco usa clock_timestamp(); "passar o tempo" é recuar as marcas.
const recuar=async minutos=>db.query("update pops_entrada_tentativas set janela_desde=janela_desde-make_interval(mins=>$1),bloqueado_ate=bloqueado_ate-make_interval(mins=>$1),atualizado_em=atualizado_em-make_interval(mins=>$1)",[minutos]);

test('cinco tentativas do mesmo ID em 15 minutos bloqueiam o ID; a sexta nem conta',async()=>{
 for(let i=1;i<=5;i++)assert.equal((await tentar()).bloqueado,false,'tentativa '+i);
 const r=await tentar();assert.equal(r.bloqueado,true);assert.ok(r.ate);
 assert.equal((await linha(ID)).falhas,5,'tentativa bloqueada não estica a contagem');
 // Outro ID do mesmo IP segue: o bloqueio é do ID.
 assert.equal((await tentar(ID2)).bloqueado,false);
});
test('o bloqueio dura 15 minutos e depois a contagem recomeça do zero',async()=>{
 for(let i=0;i<5;i++)await tentar();
 await recuar(14);assert.equal((await tentar()).bloqueado,true,'aos 14 minutos ainda bloqueado');
 await recuar(2);assert.equal((await tentar()).bloqueado,false,'passados 15 minutos, libera');
 assert.equal((await linha(ID)).falhas,1);
});
test('janela de 15 minutos: erros espalhados no tempo não somam',async()=>{
 for(let i=0;i<4;i++)await tentar();
 await recuar(16);
 for(let i=0;i<4;i++)assert.equal((await tentar()).bloqueado,false);
 assert.equal((await linha(ID)).falhas,4);
});
test('entrada certa zera o ID e devolve ao IP a tentativa que contou',async()=>{
 for(let i=0;i<4;i++)await tentar();
 await tentar();await sucesso();
 assert.equal(await linha(ID),null,'ID zerado');
 assert.equal((await linha(IP)).falhas,4,'o IP fica só com as quatro erradas');
 for(let i=0;i<4;i++)assert.equal((await tentar()).bloqueado,false,'nova janela para o ID');
});
test('a quinta tentativa certa desfaz o bloqueio que ela mesma armou',async()=>{
 for(let i=0;i<5;i++)await tentar();
 assert.ok((await linha(ID)).bloqueado_ate);
 await sucesso();assert.equal(await linha(ID),null);assert.equal((await tentar()).bloqueado,false);
});
test('trinta erros do mesmo IP em 15 minutos bloqueiam o IP para qualquer ID',async()=>{
 for(let i=0;i<30;i++)assert.equal((await tentar(chave('id','e'+i.toString(16)))).bloqueado,false,'tentativa '+(i+1));
 assert.equal((await tentar(chave('id','f0'))).bloqueado,true);
 assert.equal((await tentar(chave('id','f0'),IP2)).bloqueado,false,'outro IP segue');
 // ID malformado chega sem chave de ID e conta só no IP.
 assert.equal((await tentar(null,IP)).bloqueado,true);
 await recuar(16);assert.equal((await tentar(null,IP)).bloqueado,false);
});
test('ID malformado conta no IP sem criar chave de ID',async()=>{
 await tentar(null,IP);assert.equal((await linha(IP)).falhas,1);
 assert.equal(Number((await db.query("select count(*) n from pops_entrada_tentativas where chave like 'id:%'")).rows[0].n),0);
});
test('chave fora do formato cifrado é recusada: o banco não guarda ID nem IP em claro',async()=>{
 for(const [id,ip] of [['id:100001',IP],[ID,'ip:203.0.113.9'],[ID,null],[ID,'']])assert.match((await recusa('select pops_entrada_aluno($1,$2,$3)',['tentar',id,ip])).message,/Chave inválida/);
 assert.match((await recusa('select pops_entrada_aluno($1,$2,$3)',['zerar',ID,IP])).message,/Ação inválida/);
 assert.match((await recusa("insert into pops_entrada_tentativas(chave) values('id:100001')")).message,/check/i);
});
test('chave parada há mais de um dia sai na faxina; bloqueio valendo fica',async()=>{
 await tentar(ID2,IP2);for(let i=0;i<5;i++)await tentar();
 await db.query("update pops_entrada_tentativas set atualizado_em=atualizado_em-interval '2 days' where chave=$1",[ID2]);
 await db.query("update pops_entrada_tentativas set atualizado_em=atualizado_em-interval '2 days', bloqueado_ate=clock_timestamp()+interval '5 minutes' where chave=$1",[ID]);
 await tentar(chave('id','f1'),IP);
 assert.equal(await linha(ID2),null);assert.ok(await linha(ID),'o bloqueio que ainda vale não é apagado');
});
test('tabela privada: RLS ligada, sem acesso de anon e authenticated, rotina só da service_role',async()=>{
 const r=(await db.query("select relrowsecurity from pg_class where relname='pops_entrada_tentativas'")).rows[0];assert.equal(r.relrowsecurity,true);
 for(const papel of ['anon','authenticated'])for(const priv of ['SELECT','INSERT','UPDATE','DELETE'])
  assert.equal((await db.query('select has_table_privilege($1,$2,$3) p',[papel,'public.pops_entrada_tentativas',priv])).rows[0].p,false,papel+' '+priv);
 const f=(await db.query("select has_function_privilege('anon','public.pops_entrada_aluno(text,text,text)','EXECUTE') a,has_function_privilege('authenticated','public.pops_entrada_aluno(text,text,text)','EXECUTE') b,has_function_privilege('service_role','public.pops_entrada_aluno(text,text,text)','EXECUTE') c")).rows[0];
 assert.deepEqual([f.a,f.b,f.c],[false,false,true]);
 const {n}=(await db.query("select count(*)::integer n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname like 'pops_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))")).rows[0];assert.equal(n,0);
});
test('configurar a entrada do aluno no banco muda só educacao.entradaAluno',async()=>{
 const antes={gestores:{gestora:['Produção']},setores:['Produção'],educacao:{instrutores:{bruno:['Produção']},catalogo:{familias:{},trilhas:{'t-demo':{nome:'Trilha',descricao:'',ordem:1}}}}};
 await db.query('select pops_configurar($1)',[antes]);
 // O mesmo patch que a operação configurarEntradaAluno manda (educacao inteira + anterior).
 const educacao={...antes.educacao,entradaAluno:{ativa:false,validadeDias:3,atualizadoEm:'2026-10-14T12:00:00.000Z',atualizadoPor:'gestao'}};
 const {r}=(await db.query('select pops_configurar($1,$2) r',[{educacao},{educacao:antes.educacao}])).rows[0];
 assert.deepEqual(r.config.gestores,antes.gestores);assert.deepEqual(r.config.setores,antes.setores);
 assert.deepEqual(r.config.educacao.instrutores,antes.educacao.instrutores);assert.deepEqual(r.config.educacao.catalogo,antes.educacao.catalogo);
 assert.equal(r.config.educacao.entradaAluno.ativa,false);
 // Tela com a configuração antiga não atropela: o banco recusa.
 await assert.rejects(db.query('select pops_configurar($1,$2)',[{educacao:{...antes.educacao,entradaAluno:{ativa:true,validadeDias:7}}},{educacao:antes.educacao}]),{code:'40001'});
});
