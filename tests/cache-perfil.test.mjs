import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {store,tick} from './helpers.mjs';
const admin={usuario:'ana',nome:'Ana fictícia',papel:'admin'};
const equipe={...admin,papel:'equipe'};
const legado={dados:{pessoas:[{id:'p-outra',nome:'Outra pessoa fictícia'}]},cfg:{gestores:{ana:['Setor fictício']}},fila:[{action:'upsert',colecao:'pops',id:'pop1',registro:{id:'pop1',titulo:'Rascunho reservado'},mutationId:'m1'}],rev:{porColecao:{pessoas:1}},syncEm:'2026-10-01',rascunhos:[{registro:{id:'rascunho1'}}]};
test('papel inferior do mesmo usuário não recebe cache ou fila administrativa',()=>{
 const h=store();h.store.setUser(admin);h.store.salvar('pessoas',{id:'p-outra',nome:'Outra pessoa fictícia'});h.store.salvar('pops',{id:'pop1',titulo:'Rascunho admin'});
 h.store.setUser(equipe);assert.deepEqual(Array.from(h.store.col('pessoas')),[]);assert.equal(h.store.getFila().length,0);assert.equal(h.store.getRascunhos().length,0);
 h.store.setUser(admin);assert.equal(h.store.col('pessoas').length,1);assert.equal(h.store.getFila().length,2);
});
test('boot migra cache v2 apenas para usuário e papel já identificados, sem apagar backup',()=>{
 const h=store({initial:{pops_user:admin,pops_v2_ana:legado}});assert.equal(h.store.col('pessoas').length,1);assert.equal(h.store.getFila().length,1);assert.ok(h.storage.has('pops_v3_ana_admin'));assert.equal(JSON.parse(h.storage.get('pops_v2_ana')).fila.length,1);
 h.store.setUser(equipe);assert.equal(h.store.col('pessoas').length,0);assert.equal(h.store.getFila().length,0);assert.deepEqual(Object.keys(h.store.getCFG()),[]);
});
test('migração preserva fila offline da equipe identificada antes de carregar',()=>{
 const h=store({initial:{pops_user:equipe,pops_v2_ana:{...legado,dados:{leituras:[{id:'l-ana-pop1',usuario:'ana'}]},fila:[{action:'upsert',colecao:'leituras',registro:{id:'l-ana-pop1',usuario:'ana'},mutationId:'m2'}]}}});assert.equal(h.store.col('leituras').length,1);assert.equal(h.store.getFila()[0].mutationId,'m2');assert.ok(h.storage.has('pops_v3_ana_equipe'));assert.ok(h.storage.has('pops_v2_ana'));
});
test('login posterior sem dono identificado no boot não adota cache antigo',()=>{
 const h=store({initial:{pops_v2_ana:legado}});h.store.setUser(admin);assert.equal(h.store.col('pessoas').length,0);assert.equal(h.store.getFila().length,0);assert.ok(h.storage.has('pops_v2_ana'));
});
test('resposta antiga não mistura dados entre papéis e preserva fila original',async()=>{
 let finish;
 const h=store({fetcher:()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({ok:true,revision:2,registro:{id:'pop1',titulo:'Salvo no servidor'}})});})});
 h.store.setUser(admin);h.store.salvar('pops',{id:'pop1',titulo:'Admin'});h.navigator.onLine=true;const envio=h.store.trySync();await tick();h.store.setUser(equipe);finish();await envio;
 assert.equal(h.store.col('pops').length,0);assert.equal(h.store.getFila().length,0);h.store.setUser(admin);assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].registro.titulo,'Admin');
});
test('atualizar nome na mesma conta e papel mantém estado e fila',()=>{
 const h=store();h.store.salvar('leituras',{id:'l-ana-pop1',usuario:'ana'});h.store.setUser({...equipe,nome:'Nome corrigido'});assert.equal(h.store.getFila().length,1);assert.equal(h.store.col('leituras').length,1);
});
const comRH=id=>({...equipe,identidadeConferida:true,pessoaRH:id?{id:'p-'+id,colaboradorId:id,nome:'Pessoa fictícia'}:null});
test('troca ou remoção do ID RH isola histórico e fila mesmo com usuário e papel iguais',()=>{
 const h=store();const avisos=[];h.store.on('cachePreservado',x=>avisos.push(x));h.store.setUser(comRH('rh-a'));h.store.salvar('leituras',{id:'l-ana-pop1',usuario:'ana',colaboradorId:'rh-a'});
 h.store.setUser(comRH('rh-b'));assert.equal(h.store.col('leituras').length,0);assert.equal(h.store.getFila().length,0);assert.ok(h.storage.has('pops_v3_ana_equipe_rh_rh-a'));assert.equal(JSON.parse(h.storage.get('pops_v3_ana_equipe_rh_rh-a')).fila.length,1);assert.equal(avisos.at(-1).colaboradorId,'rh-a');
 h.store.salvar('progresso',{id:'j-ana-j1',usuario:'ana',colaboradorId:'rh-b'});h.store.setUser(comRH(null));assert.equal(h.store.col('progresso').length,0);assert.equal(h.store.col('leituras').length,0);assert.equal(h.store.getFila().length,0);assert.equal(JSON.parse(h.storage.get('pops_v3_ana_equipe_rh_rh-b')).fila.length,1);
});
test('primeira confirmação RH preserva catálogo confirmado e guarda fila antiga sem retransmitir',()=>{
 const old={...legado,dados:{pops:[{id:'publicado',_serverRevision:1},{id:'rascunho',titulo:'Edição não enviada'}],leituras:[{id:'l-ana-antigo',usuario:'ana'}]},fila:[{colecao:'pops',id:'rascunho',registro:{id:'rascunho'},mutationId:'m3'},{colecao:'leituras',id:'l-ana-antigo',mutationId:'m4'}],rev:{porColecao:{pops:3,leituras:8,pessoas:10}}};
 const h=store({initial:{pops_user:equipe,pops_v3_ana_equipe:old}});h.store.setUser(comRH('rh-a'));assert.deepEqual(Array.from(h.store.col('pops'),x=>x.id),['publicado']);assert.equal(h.store.col('leituras').length,0);assert.equal(h.store.getFila().length,0);const atual=JSON.parse(h.storage.get('pops_v3_ana_equipe_rh_rh-a'));assert.equal(atual.rev.porColecao.leituras,undefined);assert.equal(atual.preservacao.pendentes,2);assert.equal(JSON.parse(h.storage.get('pops_v3_ana_equipe')).fila.length,2);
});
test('metadados atualizados do mesmo ID RH conservam a própria fila',()=>{
 const h=store();h.store.setUser(comRH('rh-a'));h.store.salvar('leituras',{id:'l-ana-pop1',colaboradorId:'rh-a'});h.store.setUser({...comRH('rh-a'),nome:'Nome atualizado'});assert.equal(h.store.getFila().length,1);
});
test('boot com identidade RH não importa histórico de cache ainda sem identidade',()=>{
 const h=store({initial:{pops_user:comRH('rh-a'),pops_v3_ana_equipe:legado}});
 assert.equal(h.store.col('pessoas').length,0);assert.equal(h.store.getFila().length,0);assert.equal(h.store.getRascunhos().length,0);
 assert.equal(JSON.parse(h.storage.get('pops_v3_ana_equipe')).fila.length,1);
 assert.deepEqual(Object.keys(JSON.parse(h.storage.get('pops_v3_ana_equipe_rh_rh-a')).rev.porColecao),[]);
});
function conhecimentoStore(responder) {
 const user=comRH('rh-a'),cacheKey='pops_v3_ana_equipe_rh_rh-a';
 const storage=new Map([['pops_user',JSON.stringify(user)],[cacheKey,JSON.stringify({dados:{},cfg:{},fila:[],rev:{porColecao:{}},conhecimento:{versao:'1',fontes:[]}})]]);
 const chamadas=[];
 const ctx=vm.createContext({crypto:webcrypto,AbortController,navigator:{onLine:true},AUTH:{cracha:()=>''},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  window:{API_BASE:'http://local.test',API_FN:{sync:'sync'},CONHECIMENTO_VERSAO:'2',addEventListener(){}},setTimeout:()=>1,clearTimeout(){},
  fetch:async(url,opts)=>{const body=JSON.parse(opts.body);chamadas.push(body);
   if(body.action==='conhecimento')return responder();
   const data=body.action==='rev'?{rev:{porColecao:{pops:1}}}:body.action==='list'?{itens:body.colecao==='pops'?[{registro:{id:'pop-publicado',titulo:'POP de teste'},revision:1}]:[]}:{config:{}};
   return {ok:true,json:async()=>({ok:true,...data})};
  }
 });
 vm.runInContext(fs.readFileSync(new URL('../store.js',import.meta.url),'utf8')+'\nglobalThis.store = STORE;',ctx);
 return {store:ctx.store,chamadas,storage};
}
for(const [nome,responder] of [
 ['base ausente',async()=>({ok:true,json:async()=>({ok:true,conhecimento:null})})],
 ['falha de rede',async()=>{throw new Error('Rede indisponível');}],
 ['versão antiga no servidor',async()=>({ok:true,json:async()=>({ok:true,conhecimento:{versao:'1'}})})]
]) test(`${nome} avisa sem impedir atualização dos POPs e históricos`,async()=>{
 const h=conhecimentoStore(responder),erros=[],pullErros=[];h.store.on('conhecimentoErro',x=>erros.push(x));h.store.on('pullErro',x=>pullErros.push(x));
 assert.equal(await h.store.pull(),true);assert.equal(h.store.col('pops')[0].id,'pop-publicado');assert.equal(h.store.getConhecimento().versao,'1');assert.equal(erros.length,1);assert.ok(erros[0]);assert.equal(pullErros.length,0);assert.equal(h.chamadas.filter(x=>x.action==='list').length,7);assert.ok(h.store.lastSync());
});
test('base atualizada limpa o aviso próprio somente depois de ser guardada',async()=>{
 const h=conhecimentoStore(async()=>({ok:true,json:async()=>({ok:true,conhecimento:{versao:'2',fontes:[]}})})),avisos=[];h.store.on('conhecimentoErro',x=>avisos.push(x));
 assert.equal(await h.store.pull(),true);assert.equal(h.store.getConhecimento().versao,'2');assert.equal(avisos.at(-1),null);
});
