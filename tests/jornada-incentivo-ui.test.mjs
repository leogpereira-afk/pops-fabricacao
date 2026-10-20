import test from 'node:test';
import assert from 'node:assert/strict';
import { telaEscola } from './escola-tela-harness.mjs';
const aula=(id,extra={})=>({id,titulo:'Aula '+id,tipo:'aula',pontos:10,obrigatoria:true,prerequisitos:[],quiz:[],conteudo:{aprender:'Comunicar com clareza',comoFazer:'Ouvir, confirmar e combinar'},...extra});
const curso=(id,etapas=[aula('a')])=>({id,titulo:'Curso '+id,versao:'1',publicada:true,ativa:true,liberada:true,etapas});
const data=(extra={})=>({ok:true,pessoa:{colaboradorId:'rh-demo',nome:'Pessoa de demonstração',funcao:'Atendimento'},formacoes:[curso('primeiro'),curso('prioritario')],aprendizagem:[],gestao:{},...extra});
function tela(d){return telaEscola({api:async()=>structuredClone(d)});}
test('plano pessoal prioriza ordem definida e mostra objetivo, contexto e equipe verificada',async()=>{
 const t=tela(data({planoPessoal:{titulo:'Seu próximo ciclo',objetivo:'Atender com clareza',ativa:true,itens:[{formacaoId:'prioritario',contexto:'flexivel',orientacao:'Estude e prepare um exemplo',prazo:'2026-11-01'},{formacaoId:'primeiro',contexto:'empresa'}]},equipeTrabalho:{estado:'vinculada',id:'eq-demo',nome:'Equipe de demonstração'}}));
 await t.route();assert.equal(t.node('.edu-proximo').querySelector('a').attributes.href,'#/formacao/prioritario/a');
 assert.match(t.node('.edu-plano-pessoal').textContent,/Seu próximo ciclo|Atender com clareza/);
 assert.match(t.text(),/Equipe de demonstração/);assert.match(t.text(),/Estudo flexível/);
 await t.route('formacao','prioritario');assert.match(t.text(),/Estude e prepare um exemplo/);
});
test('plano não fabrica acesso, equipe ou conteúdo de um curso ausente',async()=>{
 const t=tela(data({planoPessoal:{titulo:'Plano',ativa:true,itens:[{formacaoId:'oculto',contexto:'flexivel'}]},equipeTrabalho:{estado:'indisponivel'}}));
 await t.route();assert.doesNotMatch(t.html,/href="#\/formacao\/oculto/);assert.match(t.text(),/Equipe ainda não consultada|Equipe indisponível/);
});
test('incentivo distingue leitura de conclusão e usa imagem sem duplicar promessa de pontos',async()=>{
 const f=curso('leitura',[aula('a',{status:'em_andamento',quiz:[{id:'q',pergunta:'Como atender?',opcoes:['Ouvir','Interromper']} ]})]);
 const t=tela(data({formacoes:[f],aprendizagem:[{formacaoId:f.id,formacaoVersao:'1',etapas:{a:{leituraEm:'2026-10-20',status:'em_andamento'}},pontos:0}]}));
 await t.route('formacao','leitura~a');assert.match(t.node('.edu-incentivo').textContent,/Leitura registrada/);assert.doesNotMatch(t.node('.edu-incentivo').textContent,/concluída|ganhou|\+10/);assert.ok(t.node('.edu-incentivo').querySelector('img'));
});
test('aula concluída tem incentivo confirmado e próximo passo, sem celebrar novamente como ganho novo',async()=>{
 const f=curso('feito',[aula('a',{status:'concluida'}),aula('b')]);
 const t=tela(data({formacoes:[f],aprendizagem:[{formacaoId:f.id,formacaoVersao:'1',etapas:{a:{status:'concluida',leituraEm:'2026-10-20'}},pontos:10,conquistas:[{chave:'feito:a',pontos:10}]}]}));
 await t.route('formacao','feito~a');assert.match(t.node('.edu-incentivo').textContent,/Aula concluída/);assert.match(t.node('.edu-incentivo').textContent,/10 pontos no seu histórico/);assert.doesNotMatch(t.text(),/ganhou mais|\+10 pontos/);assert.equal(t.app.querySelectorAll('img').length,1);assert.equal(t.node('.edu-incentivo-proximo').attributes.href,'#/formacao/feito/b');
});
test('prática aguardando validação incentiva envio sem conceder conquista',async()=>{
 const f=curso('pratica',[aula('a',{tipo:'pratica',status:'aguardando_validacao',checklist:['Conferir']})]);
 const t=tela(data({formacoes:[f],aprendizagem:[{formacaoId:f.id,etapas:{a:{leituraEm:'2026-10-20',status:'aguardando_validacao'}},pontos:0}]}));
 await t.route('formacao','pratica~a');assert.match(t.node('.edu-incentivo').textContent,/Atividade enviada/);assert.match(t.node('.edu-incentivo').textContent,/validação/);assert.doesNotMatch(t.node('.edu-incentivo').textContent,/concluída|ganhou/);
});
test('modelo de atendimento é rascunho editável e não publica nem inventa vídeo',async()=>{
 const d=data({formacoes:[],gestao:{podeGerir:true,pessoas:[],registros:[]}});
 const t=telaEscola({papel:'admin',api:async p=>p.operacao==='academia.biblioteca'?{ok:true,materiais:[]}:structuredClone(d)});
 await t.route('formacao-editor','modelo-atendimento');
 assert.match(t.node('#edu-titulo').value,/Atendimento/);assert.equal(t.node('#edu-publicada').checked,false);
 assert.equal(t.app.querySelectorAll('[data-ee]').length,3);assert.match(t.text(),/Modelo editável/);
 assert.equal(t.calls.some(c=>c.operacao==='salvarFormacao'),false);assert.doesNotMatch(t.html,/youtube.com\/watch/);
});

test('Silk acolhe antes da primeira leitura sem anunciar pontos ou conclusão',async()=>{
 const t=tela(data({formacoes:[curso('entrada')]}));
 await t.route('formacao','entrada~a');
 assert.match(t.node('.edu-silk-guia').textContent,/Vamos aprender/);
 assert.equal(t.app.querySelectorAll('.silk').length,1);
 assert.equal(t.node('.edu-incentivo'),null);
 assert.doesNotMatch(t.node('.edu-silk-guia').textContent,/concluída|pontos|aprovado/);
 assert.equal(t.calls.filter(c=>c.evento==='leitura').length,0);
});

test('capa é atalho do curso liberado, nunca abre curso restrito ou arquivado',async()=>{
 const fs=[curso('aberto'),{...curso('restrito'),liberada:false},{...curso('arquivado'),ativa:false}];
 const t=tela(data({formacoes:fs}));await t.route('catalogo');
 const cards=t.app.querySelectorAll('.cat-curso');
 assert.equal(cards[0].querySelector('.edu-capa-3d').attributes.href,'#/formacao/aberto');
 for(const card of cards.slice(1))assert.equal(card.querySelector('.edu-capa-3d').attributes.href,undefined);
 assert.equal(t.calls.some(c=>c.operacao==='registrar'),false);
});

test('área personalizada recebe Silk ao ser escolhida e mantém um único guia',async()=>{
 const f={...curso('exemplo'),catalogo:{trilha:'financas-turma-ficticia'}};
 const t=tela(data({formacoes:[f],catalogo:{trilhas:{'financas-turma-ficticia':{nome:'Finanças fictícias'}}}}));
 await t.route('catalogo');
 assert.equal(t.node('.cat-silk-guia').hidden,false);
 t.app.querySelectorAll('[data-area]').find(n=>n.dataset.area==='financas-turma-ficticia').onclick();
 assert.equal(t.node('.cat-silk-guia').hidden,true);
 assert.equal(t.node('.cat-silk').hidden,false);
 assert.equal(t.node('.cat-sala').attributes['aria-pressed'],'true');
});
