import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function auth(resposta){
 const mem=new Map();const ctx=vm.createContext({window:{API_BASE:'http://local.test'},localStorage:{getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)},AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,status:200,json:async()=>resposta})});
 vm.runInContext(fs.readFileSync(new URL('../auth.js',import.meta.url),'utf8')+'\nglobalThis.auth = AUTH;',ctx);return ctx.auth;
}
test('resposta que recusa a troca da senha não é tratada como sucesso',async()=>{
 await assert.rejects(auth({ok:false,erro:'Senha atual incorreta'}).trocarMinhaSenha('fictícia','outra-fictícia'),/Senha atual incorreta/);
});
test('login incompleto não substitui a credencial guardada',async()=>{
 const a=auth({ok:true});await assert.rejects(a.login('ana','fictícia'),/incompleta/);assert.equal(a.temCracha(),false);
});
