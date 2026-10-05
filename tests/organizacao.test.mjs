import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function modelo(){ const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(new URL('../organizacao.js',import.meta.url),'utf8'),ctx);return ctx.window.POPS_ORGANIZACAO; }
test('semente e data antiga não são revisão humana comprovada',()=>{
 const m=modelo();assert.equal(m.revisao({revisadoPor:'Semente inicial',revisadoEm:'2026-08-04'}).validada,false);
 assert.equal(m.revisao({revisadoPor:'Gestor',revisadoEm:'2026-10-01'}).validada,false);
 assert.equal(m.revisao({revisao:{status:'validado',por:'Gestor',em:'2026-10-05'}}).validada,true);
});
test('busca encontra acentos, código e instrução sem duplicar resultado',()=>{
 const m=modelo(),dados={pops:[{id:'p1',codigo:'POP-CMP-01',titulo:'Compras',blocos:[{tipo:'lista',itens:['Conferência do almoxarifado']}]}],jornadas:[],treinamentos:[]};
 assert.equal(m.buscar(dados,'conferencia almoxarifado').length,1);assert.equal(m.buscar(dados,'POP-CMP-01')[0].id,'p1');assert.equal(m.buscar(dados,'não existe').length,0);
});
test('vínculos excluem origem, destino inexistente e duplicações',()=>{
 const m=modelo(),p={id:'p1',relacionados:[{tipo:'pop',refId:'p1'},{tipo:'pop',refId:'p2'},{tipo:'pop',refId:'p2'},{tipo:'jornada',refId:'inexistente'}]};
 const res=m.relacionados(p,{pops:[p,{id:'p2',titulo:'Destino'}],jornadas:[],treinamentos:[]});assert.equal(res.length,1);assert.equal(res[0].id,'p2');
});
test('mudança de instrução exige nova versão; ajuste editorial de vínculo preserva aceites',()=>{
 const m=modelo(),a={titulo:'Corte',objetivo:'Conferir',blocos:[],epis:[],versao:'1.0'};
 assert.match(m.validarEdicao(a,{...a,blocos:[{tipo:'paragrafo',texto:'Nova instrução'}]}),/versão/i);
 assert.equal(m.validarEdicao(a,{...a,relacionados:[{tipo:'pop',refId:'p2'}]}),'');
 assert.equal(m.validarEdicao(a,{...a,versao:'2.0',blocos:[{tipo:'paragrafo',texto:'Nova instrução'}]}),'');
});
