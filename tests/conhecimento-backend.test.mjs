import test from 'node:test';
import assert from 'node:assert/strict';
import {backend} from './helpers.mjs';
const conhecimentoBase={versao:'teste-1',titulo:'Base fictícia',fontes:[{id:'fonte-teste',titulo:'Manual fictício'}],topicos:[]};
test('conhecimento privado vem do banco para equipe autenticada sem escrever',async()=>{
 const b=backend({config:{conhecimentoBase}});const r=await b.call({action:'conhecimento'});assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.deepEqual(r.body.conhecimento,conhecimentoBase);assert.equal(b.writes.length,0);
});
test('base ainda não cadastrada não inventa catálogo nem versão',async()=>{
 const r=await backend().call({action:'conhecimento'});assert.equal(r.status,200);assert.equal(r.body.conhecimento,null);
});
test('configuração geral não duplica conteúdo documental privado',async()=>{
 const r=await backend({config:{conhecimentoBase,setores:['Setor fictício']}}).call({action:'getCfg'});assert.equal(r.status,200);assert.deepEqual(r.body.config.setores,['Setor fictício']);assert.equal(r.body.config.conhecimentoBase,undefined);assert.equal(r.body.cfg.conhecimentoBase,undefined);
});
test('conhecimento não abre com credencial vencida nem revogada',async()=>{
 assert.equal((await backend().call({action:'conhecimento'},{exp:0})).status,401);
 assert.equal((await backend({revoked:true}).call({action:'conhecimento'})).status,401);
});
test('falha ao consultar a base não aparece como catálogo vazio',async()=>{
 assert.equal((await backend({queryError:true}).call({action:'conhecimento'})).status,500);
});
