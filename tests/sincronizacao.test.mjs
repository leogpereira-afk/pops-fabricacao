import test from 'node:test';
import assert from 'node:assert/strict';
import {store,tick} from './helpers.mjs';
test('confirmação do envio A preserva edição B feita durante o envio',async()=>{
  let finish;const h=store({fetcher:()=>new Promise(resolve=>finish=()=>resolve({ok:true,json:async()=>({ok:true,revision:2})}))});
  h.store.salvar('pops',{id:'p1',titulo:'A'});h.navigator.onLine=true;
  const sync=h.store.trySync();await tick();
  h.store.salvar('pops',{id:'p1',titulo:'B'});finish();await sync;
  assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].registro.titulo,'B');
});
test('troca de usuário não mostra nem envia a fila de outra pessoa',()=>{
  const h=store();h.store.salvar('leituras',{id:'l-ana-p1',usuario:'ana'});
  h.store.setUser(null);h.store.setUser({usuario:'bia',papel:'equipe'});
  assert.equal(h.store.getFila().length,0);assert.equal(h.store.col('leituras').length,0);
  h.store.setUser({usuario:'ana',papel:'equipe'});assert.equal(h.store.getFila().length,1);
});
test('resposta HTTP 200 com ok falso conserva a alteração pendente',async()=>{
  const h=store({fetcher:async()=>({ok:true,json:async()=>({ok:false,erro:'Não salvo'})})});
  h.store.salvar('pops',{id:'p1'});h.navigator.onLine=true;await h.store.trySync();
  assert.equal(h.store.getFila().length,1);
});
test('exclusão sem espaço no aparelho avisa falha',()=>{
  const h=store();h.store.salvar('pops',{id:'p1'});h.quota();
  assert.equal(h.store.apagar('pops','p1'),false);
});
test('download não ressuscita exclusão local que ainda está na fila',async()=>{
  const h=store({initial:{pops_user:{usuario:'ana',papel:'admin'},pops_dados:{pops:[{id:'p1'}]}},fetcher:async(url,o)=>({ok:true,json:async()=>{
    const b=JSON.parse(o.body);
    if(b.action==='rev')return {rev:{porColecao:{pops:1}}};
    if(b.action==='getCfg')return {config:{}};
    return {itens:b.colecao==='pops'?[{registro:{id:'p1',titulo:'Antigo',atualizadoEm:'2020-01-01'},apagado:false}]:[],proximo:null};
  }})});
  h.store.apagar('pops','p1');h.navigator.onLine=true;await h.store.pull();
  assert.equal(h.store.col('pops').length,0);
});
test('cancelar cadastro que nunca foi enviado não deixa exclusão impossível na fila',()=>{
  const h=store();h.store.salvar('pops',{id:'novo'});h.store.apagar('pops','novo');
  assert.equal(h.store.getFila().length,0);assert.equal(h.store.col('pops').length,0);
});
test('401 de sessão anterior não encerra a sessão que acabou de entrar',async()=>{
  let finish;const h=store({fetcher:()=>new Promise(resolve=>finish=()=>resolve({ok:false,status:401,json:async()=>({erro:'Sessão anterior venceu'})}))});
  let avisos=0;h.store.on('sessao',()=>avisos++);
  const request=h.store.api('ping').catch(()=>{});await tick();h.store.setUser({usuario:'bia',papel:'equipe'});finish();await request;
  assert.equal(avisos,0);
});
