import test from 'node:test';
import assert from 'node:assert/strict';
import { backend } from './helpers.mjs';
const pop={id:'pop1',titulo:'Impressão',setor:'Impressão',objetivo:'Conferir arquivo',epis:['Óculos'],blocos:[{id:'b1',tipo:'texto',texto:'Conferir medidas.'}],versao:'1.0',revisao:{status:'validado',por:'Revisor anterior',em:'2026-01-01'}};
const row={colecao:'pops',id:'pop1',apagado:false,registro:pop};
const save=(b,registro,mais={})=>b.call({action:'upsert',colecao:'pops',registro,...mais},{papel:'admin',nome:'Revisor real'});
test('mudança operacional requer versão nova',async()=>{
 const b=backend({rows:[row]});const r=await save(b,{...pop,objetivo:'Novo procedimento'});assert.equal(r.status,409);assert.equal(b.writes.length,0);
});
test('nova versão perde aprovação herdada sem validação explícita',async()=>{
 const b=backend({rows:[row]});const r=await save(b,{...pop,objetivo:'Novo procedimento',versao:'2.0'});assert.equal(r.status,200);assert.deepEqual(r.body.registro.revisao,{status:'revisar'});
});
test('validação explícita ganha autoria/data do servidor',async()=>{
 const b=backend({rows:[row]});const r=await save(b,{...pop,revisao:{status:'validado',por:'Pessoa inventada',em:'1900-01-01'}},{confirmarRevisao:true});assert.equal(r.status,200);assert.equal(r.body.registro.revisao.por,'Revisor real');assert.match(r.body.registro.revisao.em,/^20\d\d-/);
});
test('cliente não forja status de revisão nem remove aprovação sem alterar conteúdo',async()=>{
 const b=backend({rows:[row]});const r=await save(b,{...pop,revisao:{status:'qualquer'}});assert.equal(r.status,400);
});
test('links internos exigem conteúdo ativo existente e não criam referência própria',async()=>{
 for(const relacionados of [[{tipo:'pop',refId:'inexistente'}],[{tipo:'pop',refId:'pop1'}],[{tipo:'script',refId:'x'}]]){
  const b=backend({rows:[row]});const r=await save(b,{...pop,relacionados});assert.equal(r.status,409);assert.equal(b.writes.length,0);
 }
});
test('links e fontes válidos conservam aprovação e versão quando conteúdo não mudou',async()=>{
 const b=backend({rows:[row,{colecao:'jornadas',id:'j1',apagado:false,registro:{id:'j1'}}]});const r=await save(b,{...pop,relacionados:[{tipo:'jornada',refId:'j1'}],fontes:['Caderno de funções 2026']});assert.equal(r.status,200);assert.equal(r.body.registro.versao,'1.0');assert.equal(r.body.registro.revisao.por,'Revisor anterior');
});
