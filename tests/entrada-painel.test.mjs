import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const boot=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').split('(function boot() {')[1];
async function iniciar({resposta={usuario:'ana',nome:'Ana',papel:'equipe'},token='valido',sessao=null,pendente=false}={}){
 let user=sessao,cred=token,finish,consultas=0,pulls=0;
 const ctx=vm.createContext({SESSAO:sessao,ROTA:{nome:''},AUTH:{temCracha:()=>!!cred,cracha:()=>cred,esquecer:()=>{cred=''},eu:()=>{consultas++;return pendente?new Promise(r=>finish=r):Promise.resolve(resposta)}},STORE:{setUser:u=>{user=u;return true},getUser:()=>user,trySync:()=>{},pull:async()=>{pulls++}},navigator:{},document:{addEventListener(){}},renderApp(){},atualizarIdentidadeRH:async()=>{},setInterval(){}});
 vm.runInContext('(function boot() {'+boot,ctx);await new Promise(r=>setImmediate(r));
 return {ctx,finish,setToken:t=>{cred=t},get:()=>({user,cred,consultas,pulls})};
}
test('entrada do Painel recupera sessão validada sem cadastro local anterior',async()=>{
 const h=await iniciar();assert.equal(h.get().consultas,1);assert.equal(h.get().user.usuario,'ana');assert.equal(h.get().pulls,1);
});
test('crachá inválido não abre dados nem mantém credencial',async()=>{
 const h=await iniciar({resposta:false});assert.equal(h.get().user,null);assert.equal(h.get().cred,'');assert.equal(h.get().pulls,0);
});
test('sem internet e sem sessão local não cria identidade',async()=>{
 const h=await iniciar({resposta:null});assert.equal(h.get().user,null);assert.equal(h.get().pulls,0);
});
test('resposta antiga não substitui um novo acesso',async()=>{
 const h=await iniciar({pendente:true});h.setToken('novo');h.finish?.({usuario:'ana',papel:'admin'});await new Promise(r=>setImmediate(r));assert.equal(h.get().user,null);assert.equal(h.get().cred,'novo');
});
