import test from 'node:test';
import assert from 'node:assert/strict';
import {backend} from './helpers.mjs';

const pop={colecao:'pops',id:'p1',apagado:false,registro:{id:'p1',setor:'Impressão',versao:'1.0'}};
const leitura={id:'l-ana-p1',usuario:'ana',nome:'Ana',popId:'p1',versaoLida:'1.0',em:new Date().toISOString()};
test('equipe registra a própria leitura de um POP existente',async()=>{
  const b=backend({rows:[pop]});const r=await b.call({action:'upsert',colecao:'leituras',registro:leitura});
  assert.equal(r.status,200);assert.ok(b.writes.length);
});
test('gestor não registra leitura em nome de outra pessoa',async()=>{
  const b=backend({rows:[pop]});const r=await b.call({action:'upsert',colecao:'leituras',registro:{...leitura,usuario:'outra',id:'l-outra-p1'}},{papel:'gestor'});
  assert.equal(r.status,403);assert.equal(b.writes.length,0);
});
test('gestor não altera POP de setor que não gerencia',async()=>{
  const b=backend({rows:[pop],config:{gestores:{ana:['Metalurgia']}}});
  const r=await b.call({action:'upsert',colecao:'pops',registro:{...pop.registro,titulo:'Alteração indevida'}},{papel:'gestor'});
  assert.equal(r.status,403);assert.equal(b.writes.length,0);
});
test('gestor não toma POP de outro setor mudando seu setor no envio',async()=>{
  const b=backend({rows:[pop],config:{gestores:{ana:['Metalurgia']}}});
  const r=await b.call({action:'upsert',colecao:'pops',registro:{...pop.registro,setor:'Metalurgia'}},{papel:'gestor'});
  assert.equal(r.status,403);assert.equal(b.writes.length,0);
});
for(const exp of [null,'amanhã',0]) test('credencial sem validade numérica futura é recusada: '+exp,async()=>{
  assert.equal((await backend().call({action:'ping'},{exp})).status,401);
});
test('consulta de revogação indisponível não libera acesso',async()=>{
  const b=backend({revocationError:true});const r=await b.call({action:'ping'});
  assert.equal(r.status,503);assert.equal(b.writes.length,0);
});
test('falha de leitura não aparece como coleção vazia ou saúde normal',async()=>{
  for(const action of ['get','getCfg','rev','saude']){
    const r=await backend({queryError:true}).call({action,colecao:'pops',id:'p1'},{papel:'admin'});
    assert.equal(r.status,500,action);
  }
});
test('página seguinte inclui registros com o mesmo carimbo de atualização',async()=>{
  const rows=Array.from({length:501},(_,i)=>({colecao:'pops',id:'p'+String(i).padStart(4,'0'),registro:{id:'p'+i},apagado:false,atualizado_em:'2026-09-01T00:00:00+00:00'}));
  const b=backend({rows});const a=await b.call({action:'list',colecao:'pops',protocolo:2,limite:500});
  const c=await b.call({action:'list',colecao:'pops',protocolo:2,limite:500,desde:a.body.proximo});
  assert.equal(a.body.itens.length+c.body.itens.length,501);
});
test('gestor autorizado salva POP do próprio setor',async()=>{
  const b=backend({rows:[pop],config:{gestores:{ana:['Impressão']}}});
  assert.equal((await b.call({action:'upsert',colecao:'pops',registro:pop.registro},{papel:'gestor'})).status,200);
});
test('equipe não obtém exportação administrativa de todas as coleções',async()=>{
  assert.equal((await backend().call({action:'list'})).status,403);
});
test('vínculo de pessoa rejeita conta inexistente',async()=>{
  const pessoa={colecao:'pessoas',id:'p-1',registro:{id:'p-1',nome:'Pessoa fictícia',origem:'rh'},apagado:false};
  const b=backend({rows:[pessoa]});
  const r=await b.call({action:'upsert',colecao:'pessoas',registro:{...pessoa.registro,usuario:'inexistente'}},{papel:'admin'});
  assert.equal(r.status,409);assert.equal(b.writes.length,0);
});
test('leitura de versão antiga não é registrada como leitura da versão atual',async()=>{
  const b=backend({rows:[{...pop,registro:{...pop.registro,versao:'2.0'}}]});
  assert.equal((await b.call({action:'upsert',colecao:'leituras',registro:leitura})).status,409);assert.equal(b.writes.length,0);
});
