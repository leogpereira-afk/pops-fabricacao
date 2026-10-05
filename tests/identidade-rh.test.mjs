import test from 'node:test';
import assert from 'node:assert/strict';
import { backend } from './helpers.mjs';
const conta={id:'conta-ana',usuario:'ana',ativo:true,colaborador_id:'rh-ana'};
const papel={conta_id:'conta-ana',sistema:'pops',login:'ana',papel:'equipe',ativo:true};
const ficha={colecao:'colaboradores',id:'rh-ana',apagado:false,registro:{nome:'Ana da Equipe',cargoId:'cargo-1',areaId:'area-1',setor:'Impressão',statusId:'ativo',apelido:'ana',cpf:'NAO-RETORNAR',salario:9999}};
const pessoa={colecao:'pessoas',id:'p-rh-ana',apagado:false,registro:{id:'p-rh-ana',origem:'rh',nome:'Ana da Equipe'}};
const tables={acesso_conta:[conta],acesso_papel:[papel],registros:[ficha,{colecao:'cargos',id:'cargo-1',apagado:false,registro:{nome:'Impressor'}},{colecao:'areas',id:'area-1',apagado:false,registro:{nome:'Produção'}}],equipe_contas:[{sistema:'pops',usuario:'ana',ativo:true}]};
test('identidade RH encontra ID exato mesmo sem antigo vínculo manual e não escreve',async()=>{
 const b=backend({rows:[pessoa],tables});const r=await b.call({action:'identidadeRH'});
 assert.equal(r.status,200);assert.equal(r.body.vinculada,true);assert.equal(r.body.pessoa.id,'p-rh-ana');assert.equal(r.body.pessoa.colaboradorId,'rh-ana');assert.equal(r.body.pessoa.funcao,'Impressor');assert.equal(r.body.pessoa.area,'Produção');assert.equal(r.body.pessoa.cpf,undefined);assert.equal(r.body.pessoa.salario,undefined);assert.equal(b.writes.length,0);
});
test('identidade RH não aceita ID escolhido pelo cliente',async()=>{
 const b=backend({rows:[pessoa],tables});const r=await b.call({action:'identidadeRH',colaboradorId:'rh-outra',usuario:'bia'});
 assert.equal(r.body.pessoa.colaboradorId,'rh-ana');
});
test('pessoa e atribuições são consultadas por ID RH com espelho ainda sem usuário',async()=>{
 const rows=[pessoa,{colecao:'pessoas',id:'p-outra',apagado:false,registro:{id:'p-outra',usuario:'ana'}},{colecao:'atribuicoes',id:'a1',apagado:false,registro:{id:'a1',pessoaId:'p-rh-ana'}}];const b=backend({rows,tables});
 const r=await b.call({action:'list',colecao:'pessoas'});assert.deepEqual(r.body.itens.map(x=>x.id),['p-rh-ana']);
 const a=await b.call({action:'list',colecao:'atribuicoes'});assert.deepEqual(a.body.itens.map(x=>x.id),['a1']);
});
for (const [name,t] of [['sem ficha',{...tables,registros:[]}],['conta técnica',{...tables,acesso_conta:[{...conta,colaborador_id:null}]}],['permissão desativada',{...tables,acesso_papel:[{...papel,ativo:false}]}],['RH inativo sem data',{...tables,registros:[{...ficha,registro:{...ficha.registro,statusId:'inativo'}}]}],['login ambíguo',{...tables,acesso_papel:[papel,{...papel,conta_id:'conta-bia'}],acesso_conta:[conta,{...conta,id:'conta-bia',usuario:'bia',colaborador_id:'rh-bia'}]}]]) test('identidade não inventa vínculo: '+name,async()=>{
 const b=backend({rows:[pessoa],tables:t});const r=await b.call({action:'identidadeRH'});assert.equal(r.status,200);assert.equal(r.body.vinculada,false);assert.equal(r.body.pessoa,null);assert.equal(b.writes.length,0);
});
test('server carimba RH real em leitura e conserva ID antigo e versão',async()=>{
 const pop={colecao:'pops',id:'pop1',apagado:false,registro:{id:'pop1',versao:'1.0'}};const b=backend({rows:[pessoa,pop],tables});
 const r=await b.call({action:'upsert',colecao:'leituras',registro:{id:'l-ana-pop1',usuario:'ana',popId:'pop1',versaoLida:'1.0',pessoaId:'p-outra',colaboradorId:'outro'}});
 assert.equal(r.status,200);const v=b.writes.find(x=>x.rpc==='pops_gravar').args.p_registro;assert.equal(v.id,'l-ana-pop1');assert.equal(v.pessoaId,'p-rh-ana');assert.equal(v.colaboradorId,'rh-ana');assert.equal(v.versaoLida,'1.0');
});
test('admin não vincula conta de pessoa RH diferente',async()=>{
 const b=backend({rows:[pessoa],tables:{...tables,acesso_conta:[{...conta,colaborador_id:'rh-outra'}]}});
 const r=await b.call({action:'upsert',colecao:'pessoas',registro:{...pessoa.registro,usuario:'ana'}},{papel:'admin'});assert.equal(r.status,409);assert.equal(b.writes.length,0);
});
test('histórico carimbado pelo RH continua acessível após mudança de login sem vazar outra ficha',async()=>{
 const rows=[{colecao:'leituras',id:'l-antiga-pop1',apagado:false,registro:{id:'l-antiga-pop1',usuario:'antiga',colaboradorId:'rh-ana',popId:'pop1'}},{colecao:'leituras',id:'l-ana-pop2',apagado:false,registro:{id:'l-ana-pop2',usuario:'ana',popId:'pop2'}},{colecao:'leituras',id:'l-ana-outra',apagado:false,registro:{id:'l-ana-outra',usuario:'ana',colaboradorId:'rh-outra',popId:'outro'}}];
 const r=await backend({rows,tables}).call({action:'list',colecao:'leituras'});assert.equal(r.status,200);assert.deepEqual(r.body.itens.map(x=>x.id).sort(),['l-ana-pop2','l-antiga-pop1']);
});
test('login reutilizado não sobrescreve histórico marcado com outro ID RH',async()=>{
 const rows=[{colecao:'pops',id:'pop1',apagado:false,registro:{id:'pop1',versao:'1.0'}},{colecao:'leituras',id:'l-ana-pop1',apagado:false,registro:{id:'l-ana-pop1',usuario:'ana',colaboradorId:'rh-outra',popId:'pop1',versaoLida:'1.0'}}];
 const b=backend({rows,tables});const r=await b.call({action:'upsert',colecao:'leituras',registro:{id:'l-ana-pop1',usuario:'ana',popId:'pop1',versaoLida:'1.0'}});assert.equal(r.status,403);assert.equal(b.writes.length,0);
});

const identidadesInvalidas = [
 ['sem ficha', {...tables, acesso_conta:[{...conta,colaborador_id:null}]}],
 ['ficha removida', {...tables, registros:[]}],
 ['conta inativa', {...tables, acesso_conta:[{...conta,ativo:false}]}],
 ['permissão inativa', {...tables, acesso_papel:[{...papel,ativo:false}]}],
 ['RH desligado', {...tables, registros:[{...ficha,registro:{...ficha.registro,statusId:'inativo'}}]}],
 ['login ambíguo', {...tables, acesso_papel:[papel,{...papel,conta_id:'conta-bia'}],acesso_conta:[conta,{...conta,id:'conta-bia',usuario:'bia',colaborador_id:'rh-bia'}]}]
];
for (const [nome,t] of identidadesInvalidas) test('identidade conhecida inválida não lê nem grava histórico pessoal: '+nome,async()=>{
 const rows=['leituras','progresso'].flatMap(colecao=>[
  {colecao,id:colecao+'-rh',apagado:false,registro:{id:colecao+'-rh',usuario:'ana',colaboradorId:'rh-ana'}},
  {colecao,id:colecao+'-legado',apagado:false,registro:{id:colecao+'-legado',usuario:'ana'}}
 ]).concat([
  {colecao:'pops',id:'pop1',apagado:false,registro:{id:'pop1',versao:'1.0'}},
  {colecao:'jornadas',id:'jor1',apagado:false,registro:{id:'jor1',etapas:[{id:'etapa1'}]}}
 ]);
 const b=backend({rows,tables:t});
 for (const colecao of ['leituras','progresso']) {
  const lista=await b.call({action:'list',colecao});
  assert.equal(lista.status,200);assert.equal(lista.body.itens.length,0);
  const individual=await b.call({action:'get',colecao,id:colecao+'-rh'});
  assert.equal(individual.body.registro,null);
 }
 for (const [colecao,registro] of [
  ['leituras',{id:'l-ana-pop1',usuario:'ana',popId:'pop1',versaoLida:'1.0'}],
  ['progresso',{id:'j-ana-jor1',usuario:'ana',jornadaId:'jor1',etapas:{etapa1:'2026-10-05'}}]
 ]) {
  const escrita=await b.call({action:'upsert',colecao,registro});
  assert.equal(escrita.status,403);
 }
 assert.equal(b.writes.length,0);
});
test('conta legada sem Central só lê histórico sem RH do próprio login',async()=>{
 const rows=['leituras','progresso'].flatMap(colecao=>[
  {colecao,id:colecao+'-rh',apagado:false,registro:{id:colecao+'-rh',usuario:'ana',colaboradorId:'rh-anterior'}},
  {colecao,id:colecao+'-ana',apagado:false,registro:{id:colecao+'-ana',usuario:'ana'}},
  {colecao,id:colecao+'-bia',apagado:false,registro:{id:colecao+'-bia',usuario:'bia'}}
 ]);
 const b=backend({rows,tables:{acesso_conta:[],acesso_papel:[]}});
 for (const colecao of ['leituras','progresso']) {
  const lista=await b.call({action:'list',colecao});
  assert.equal(lista.status,200);assert.deepEqual(lista.body.itens.map(i=>i.id),[colecao+'-ana']);
  assert.equal((await b.call({action:'get',colecao,id:colecao+'-rh'})).body.registro,null);
 }
});
