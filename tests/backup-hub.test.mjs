import test from 'node:test';
import assert from 'node:assert/strict';
import {backend} from './helpers.mjs';

// O backup diário do Hub chama o pops-sync sem crachá, com o x-token de serviço:
// {action:'list', after} paginado com _col e nextAfter, mais {action:'getCfg'}.
// Dados fictícios.
const row=(colecao,registro,revision=1)=>({colecao,id:registro.id,registro,revision,apagado:false});
const escola=['formacoes','aprendizagem','materiais','estudos','instrumentos','perfis','capacitacoes'];
const legado=['pops','jornadas','treinamentos','pessoas','atribuicoes','leituras','progresso'];
const config={setores:['Produção'],gestores:{},conhecimentoBase:{versao:'teste',topicos:[{id:'t1',titulo:'Tópico fictício'}]},educacao:{instrutores:{},catalogo:{familias:{},trilhas:{}}}};
const maquina={semCracha:true,xToken:'maquina-ficticia'};

test('backup do Hub com o token de serviço leva a escola inteira e a configuração completa',async()=>{
 const rows=[...[...legado,...escola].map(c=>row(c,{id:c+'-1',titulo:'Registro fictício'})),{...row('formacoes',{id:'formacao-arquivada'}),apagado:true}];
 const b=backend({rows,config:structuredClone(config)});
 const r=await b.call({action:'list'},{},maquina);
 assert.equal(r.status,200);
 assert.deepEqual(new Set(r.body.registros.map(x=>x._col)),new Set([...legado,...escola]));
 assert.equal(r.body.registros.find(x=>x._col==='formacoes').id,'formacoes-1');
 assert.equal(r.body.registros.some(x=>x.id==='formacao-arquivada'),false);
 assert.equal(r.body.nextAfter,null);
 const c=await b.call({action:'getCfg'},{},maquina);
 assert.equal(c.status,200);assert.deepEqual(c.body.cfg,config);assert.deepEqual(c.body.config,config);
});

test('crachá de admin e da equipe continuam sem a escola na listagem e sem a base privada na configuração',async()=>{
 const b=backend({rows:[...legado,...escola].map(c=>row(c,{id:c+'-1'})),config:structuredClone(config)});
 const r=await b.call({action:'list'},{sub:'admin',papel:'admin'});
 assert.equal(r.status,200);assert.deepEqual(new Set(r.body.registros.map(x=>x._col)),new Set(legado));
 assert.equal((await b.call({action:'list'},{sub:'ana',papel:'equipe'})).status,403);
 for(const who of [{sub:'admin',papel:'admin'},{sub:'ana',papel:'equipe'}]){
  const c=await b.call({action:'getCfg'},who);
  assert.equal(c.body.cfg.conhecimentoBase,undefined);assert.deepEqual(c.body.cfg.educacao,config.educacao);assert.deepEqual(c.body.cfg.setores,config.setores);
 }
 // Token errado não é serviço nem crachá.
 assert.equal((await b.call({action:'list'},{},{semCracha:true,xToken:'outro-token'})).status,401);
 assert.equal((await b.call({action:'getCfg'},{},{semCracha:true,xToken:'outro-token'})).status,401);
});

test('backup pagina a escola junto com as coleções antigas sem perder nem repetir registros',async()=>{
 const todas=[...legado,...escola],rows=Array.from({length:1001},(_,i)=>row(todas[i%todas.length],{id:'r'+String(i).padStart(4,'0')}));
 const b=backend({rows,config:structuredClone(config)});
 const vistos=[];let after=0,paginas=0;
 for(;;){
  const r=await b.call({action:'list',after},{},maquina);assert.equal(r.status,200);paginas++;
  vistos.push(...r.body.registros.map(x=>x._col+'/'+x.id));
  if(r.body.nextAfter==null)break;
  after=r.body.nextAfter;
 }
 assert.equal(paginas,3);assert.equal(vistos.length,1001);assert.equal(new Set(vistos).size,1001);
 assert.equal(vistos.filter(v=>escola.includes(v.split('/')[0])).length,rows.filter(r=>escola.includes(r.colecao)).length);
});
