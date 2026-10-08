import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function app(dados={},sessao={usuario:'ana',papel:'admin'}){
  const ctx=vm.createContext({STORE:{getUser:()=>sessao,resumoSync:()=>({status:"aguardando",pendentes:0}),on(){},col:c=>dados[c]||[],um:(c,id)=>(dados[c]||[]).find(x=>x.id===id)},location:{href:'https://exemplo.test/pops/',origin:'https://exemplo.test',pathname:'/pops/'},URL,Date});
  const src=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').split("window.addEventListener('hashchange'")[0];vm.runInContext(src,ctx);
  return expr=>vm.runInContext(expr,ctx);
}
test('etapas removidas não concluem jornada com etapas novas pendentes',()=>{
  const a=app({jornadas:[{id:'j1',etapas:[{id:'e2'}]}],progresso:[{id:'j-ana-j1',etapas:{e1:'2026-09-01'}}]});
  assert.equal(a("conclusaoDe({tipo:'jornada',refId:'j1'},'ana')"),null);
});
test('jornada sem etapas não conta como concluída',()=>{
  const a=app({jornadas:[{id:'j1',etapas:[]}],progresso:[{id:'j-ana-j1',etapas:{}}]});
  assert.equal(a("conclusaoDe({tipo:'jornada',refId:'j1'},'ana')"),null);
});
test('aceite antigo de treinamento exige leitura da versão atual',()=>{
  const a=app({treinamentos:[{id:'t1',versao:'2.0'}],leituras:[{id:'t-ana-t1',versaoLida:'1.0',em:'2026-09-01'}]});
  assert.equal(a("conclusaoDe({tipo:'treinamento',refId:'t1'},'ana').desatualizado"),true);
});
test('data sem horário mantém o mesmo dia no Brasil',()=>{
  const anterior=process.env.TZ;process.env.TZ='America/Sao_Paulo';
  try {assert.equal(app()("fmtData('2026-09-06')"),'06/09/2026');}finally{process.env.TZ=anterior;}
});
test('histórico carimbado com RH acompanha mudança de usuário sem duplicar conclusão',()=>{
 const a=app({pessoas:[{id:'p-rh1',colaboradorId:'rh1',usuario:'ana'}],pops:[{id:'p1',versao:'1.0'}],leituras:[{id:'l-antigo-p1',usuario:'antigo',colaboradorId:'rh1',popId:'p1',versaoLida:'1.0',em:'2026-10-01'}]});
 assert.equal(a("minhaLeitura('p1').id"),'l-antigo-p1');assert.equal(a("conclusaoDe({tipo:'pop',refId:'p1'},'ana').em"),'2026-10-01');
});
test('login reutilizado não reaproveita leitura de outro ID RH',()=>{
 const a=app({pessoas:[{id:'p-rh2',colaboradorId:'rh2',usuario:'ana'}],leituras:[{id:'l-ana-p1',usuario:'ana',colaboradorId:'rh1',popId:'p1',versaoLida:'1.0'}]});
 assert.equal(a("minhaLeitura('p1')"),null);
});

test('vínculo RH recusado não reaproveita ficha antiga pelo nome de usuário',()=>{
 const a=app({pessoas:[{id:'p-1',usuario:'ana'}]},{usuario:'ana',papel:'equipe',identidadeConferida:true,pessoaRH:null});
 assert.equal(a('minhaPessoa()'),null);
});

test('conta Central sem ficha válida não oferece registro pessoal; legado mantém compatibilidade',()=>{
 assert.equal(app({}, {usuario:'ana',papel:'equipe',identidadeConferida:true,pessoaRH:null,vinculoRH:'sem_ficha_rh'})('podeRegistrarAprendizado()'),false);
 assert.equal(app({}, {usuario:'ana',papel:'equipe',identidadeConferida:true,pessoaRH:null,vinculoRH:'sem_vinculo_central'})('podeRegistrarAprendizado()'),true);
});
