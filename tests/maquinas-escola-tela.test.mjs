import test from 'node:test';import assert from 'node:assert/strict';import {telaEscola} from './escola-tela-harness.mjs';
const item={manualId:'ativo:demo',nome:'Máquina exemplo',setor:'Produção',modelo:'Fictício',revisao:1,estado:'rascunho',foto:'',url:'https://example.org/manual',pendencias:['Manual aguarda revisão.'],cursoId:null,cursoRevision:0};
test('gestão prepara curso, mostra pendência e não repete geração',async()=>{
 const t=telaEscola({sessao:{papel:'admin'},api:async p=>p.operacao==='maquinas.catalogo'?{itens:[structuredClone(item)]}:{registro:{id:'maq-demo',origemMaquina:{revisao:1}},revision:1}});
 await t.route('maquinas-escola');assert.match(t.text(),/Um passo de cada vez/);assert.match(t.text(),/Manual aguarda revisão/);
 await t.click('[data-em-acao]');assert.match(t.text(),/Curso preparado/);assert.equal(t.node('#em-todos').disabled,true);assert.equal(t.calls.filter(c=>c.operacao==='maquinas.gerar').length,1);assert(t.node('.em-maquina').querySelectorAll('a').some(a=>a.attributes.href==='#/formacao-editor/maq-demo')); 
});
test('aluno não consulta catálogo administrativo de máquinas',async()=>{const t=telaEscola({api:async()=>{throw Error('Não deveria consultar');}});await t.route('maquinas-escola');assert.equal(t.calls.length,0);assert.match(t.text(),/cursos liberados/);});
test('falha de origem aparece como orientação sem afirmar que curso foi preparado',async()=>{const t=telaEscola({sessao:{papel:'admin'},api:async()=>{throw Error('Acesso ao Painel pendente');}});await t.route('maquinas-escola');assert.match(t.text(),/Acesso ao Painel pendente/);assert.equal(t.node('#em-todos').disabled,true);});
