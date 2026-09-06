import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function app(dados={}){
  const ctx=vm.createContext({STORE:{getUser:()=>({usuario:'ana',papel:'admin'}),on(){},col:c=>dados[c]||[],um:(c,id)=>(dados[c]||[]).find(x=>x.id===id)},location:{href:'https://exemplo.test/pops/',origin:'https://exemplo.test',pathname:'/pops/'},URL,Date});
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
