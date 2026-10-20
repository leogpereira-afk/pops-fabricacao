import test from 'node:test';
import assert from 'node:assert/strict';
import {telaEscola,esperar} from './escola-tela-harness.mjs';

const curso=(id,titulo,extra={})=>({id,titulo,versao:'1',ativa:true,publicada:true,etapas:[],pessoasLiberadas:[],catalogo:{cargaMinutos:15},...extra});
const pessoa={colaboradorId:'rh-pessoa-a',nome:'Pessoa fictícia',funcao:'Função fictícia',setor:'Produção'};
const base=()=>({ok:true,pessoa:null,aprendizagem:[],formacoes:[curso('curso-a','Atendimento fictício'),curso('curso-b','Organização fictícia'),curso('rascunho','Em preparação',{publicada:false}),curso('inativo','Curso inativo',{ativa:false}),curso('historico','Curso histórico',{somenteHistorico:true})],gestao:{podeGerir:true,podeMontarJornada:true,pessoas:[pessoa,{...pessoa,colaboradorId:'rh-pessoa-b'}],registros:[],planos:[],equipesTrabalho:[{id:'equipe-a',nome:'Equipe existente A',colaboradorIds:['rh-pessoa-a']},{id:'equipe-b',nome:'Equipe existente B',colaboradorIds:['rh-pessoa-b']}]}});
function tela({painel=base(),salvar}={}){return telaEscola({sessao:{usuario:'admin',papel:'admin',pessoaRH:null},api:async p=>{if(p.operacao==='painel')return structuredClone(painel);if(p.operacao==='salvarPlano')return salvar?salvar(p):{ok:true,plano:{...p.plano,_serverRevision:p.expectedRevision+1}};return {ok:true,registros:[],resultados:[]};}});}
async function editor(t,id='rh-pessoa-a'){await t.route('jornada-editor',id);}

test('ação da gestão abre a jornada pela ficha RH mesmo com nomes iguais',async()=>{
 const t=tela();await t.route('alunos');const links=t.app.querySelectorAll('a').filter(a=>a.textContent==='Montar jornada');
 assert.deepEqual(links.map(a=>a.attributes.href),['#/jornada-editor/rh-pessoa-a','#/jornada-editor/rh-pessoa-b']);
 await editor(t);assert.equal(t.node('#ej-pessoa').dataset.colaboradorId,'rh-pessoa-a');
 assert.deepEqual(t.node('#ej-equipe').children.map(o=>o.attributes.value),['','equipe-a']);
 assert.equal(t.node('#ej-equipe').value,'','Não atribui equipe por nome, cargo nem por inferência');
});

test('ordena cursos e salva contexto, prazo e orientação com revisão da pessoa certa',async()=>{
 const painel=base();painel.gestao.planos=[{id:'plano-existente',colaboradorId:'rh-pessoa-a',titulo:'Plano inicial',objetivo:'Objetivo fictício',equipeId:'equipe-a',ativa:true,_serverRevision:7,itens:[{formacaoId:'curso-a',prazo:null,contexto:'empresa',orientacao:''}]}];
 const t=tela({painel});await editor(t);
 assert.equal(t.app.querySelectorAll('[data-ej-adicionar]').length,2,'Somente cursos publicados e ativos, sem histórico');
 t.node('#ej-busca').value='organização';t.node('#ej-busca').oninput();assert.equal(t.app.querySelectorAll('[data-ej-adicionar]').length,1);
 await t.click('[data-ej-adicionar="curso-b"]');
 t.node('#ej-prazo-1').value='2026-11-10';t.node('#ej-contexto-1').value='flexivel';t.node('#ej-orientacao-1').value='Refletir sobre uma situação fictícia.';
 await t.click('[data-ej-subir="1"]');
 assert.deepEqual(t.app.querySelectorAll('[data-ej-item]').map(el=>el.dataset.ejItem),['curso-b','curso-a']);
 assert.equal(t.node('#ej-prazo-0').value,'2026-11-10');
 t.node('#ej-titulo').value='Desenvolvimento pessoal';t.node('#ej-objetivo').value='Aplicar as orientações no trabalho';
 await t.submit('#ej-form');
 const req=t.calls.find(p=>p.operacao==='salvarPlano');assert.ok(req);assert.equal(req.expectedRevision,7);assert.ok(req.mutationId);
 assert.deepEqual(req.plano,{id:'plano-existente',colaboradorId:'rh-pessoa-a',titulo:'Desenvolvimento pessoal',objetivo:'Aplicar as orientações no trabalho',equipeId:'equipe-a',ativa:true,itens:[{formacaoId:'curso-b',prazo:'2026-11-10',contexto:'flexivel',orientacao:'Refletir sobre uma situação fictícia.'},{formacaoId:'curso-a',prazo:'',contexto:'empresa',orientacao:''}]});
 assert.match(t.node('#ej-estado').textContent,/confirmada/i);assert.equal(t.calls.filter(p=>p.operacao==='registrar').length,0,'Organizar a jornada não dá pontos nem conclui atividades');
});

test('conflito preserva conteúdo, revisão e histórico sem anunciar sucesso',async()=>{
 const t=tela({salvar:()=>{throw Object.assign(new Error('Esta jornada foi alterada por outra pessoa. Consulte a versão salva.'),{status:409});}});await editor(t);
 await t.click('[data-ej-adicionar="curso-a"]');t.node('#ej-titulo').value='Rascunho mantido';t.node('#ej-orientacao-0').value='Minha orientação fictícia';
 await t.submit('#ej-form');assert.equal(t.node('#ej-titulo').value,'Rascunho mantido');assert.equal(t.node('#ej-orientacao-0').value,'Minha orientação fictícia');assert.equal(t.node('#ej-salvar').disabled,false);
 assert.match(t.node('#ej-erro').textContent,/alterada/);assert.doesNotMatch(t.node('#ej-estado').textContent,/confirmada/i);assert.equal(t.toasts.some(x=>/confirmada/.test(x.m)),false);
});

test('aguarda confirmação e reenvia a mesma operação após falha de rede',async()=>{
 let liberar,vez=0;const t=tela({salvar:async p=>{vez++;if(vez===1)throw new Error('Conexão interrompida');return new Promise(r=>{liberar=()=>r({ok:true,plano:{...p.plano,_serverRevision:1}});});}});await editor(t);await t.click('[data-ej-adicionar="curso-a"]');
 await t.submit('#ej-form');assert.equal(t.node('#ej-campos').disabled,true,'A confirmação pendente mantém o envio congelado');
 const reenvio=t.submit('#ej-form');await esperar();assert.doesNotMatch(t.node('#ej-estado').textContent,/confirmada/i);assert.equal(t.node('#ej-salvar').disabled,true);
 liberar();await reenvio;const req=t.calls.filter(p=>p.operacao==='salvarPlano');assert.equal(req.length,2);assert.equal(req[0].mutationId,req[1].mutationId);assert.deepEqual(req[0].plano,req[1].plano);assert.match(t.node('#ej-estado').textContent,/confirmada/i);
});

test('contas sem permissão e pessoas fora do RH autorizado não recebem editor',async()=>{
 for(const [permitir,id] of [[false,'rh-pessoa-a'],[true,'fora-do-rh']]){const painel=base();painel.gestao.podeMontarJornada=permitir;const t=tela({painel});await editor(t,id);assert.equal(t.node('#ej-form'),null);assert.equal(t.calls.some(p=>p.operacao==='salvarPlano'),false);}
 const painel=base();painel.gestao.podeMontarJornada=false;const t=tela({painel});await t.route('alunos');assert.equal(t.app.querySelectorAll('a').some(a=>a.textContent==='Montar jornada'),false);
});

test('remoção preserva outros cursos e atalhos criam conteúdo na outra aba',async()=>{
 const t=tela();await editor(t);await t.click('[data-ej-adicionar="curso-a"]');await t.click('[data-ej-adicionar="curso-b"]');await t.click('[data-ej-remover="0"]');
 assert.deepEqual(t.app.querySelectorAll('[data-ej-item]').map(el=>el.dataset.ejItem),['curso-b']);
 const links=t.app.querySelectorAll('a');for(const destino of ['#/formacao-editor/novo','#/material-editor/novo-video','#/formacao-editor/modelo-atendimento']){const link=links.find(a=>a.attributes.href===destino);assert.ok(link);assert.equal(link.attributes.target,'_blank');}
 assert.match(t.text(),/materiais.*permiss/i);
});

test('jornada salva no servidor real libera cursos e a edição posterior usa a revisão confirmada',async()=>{
 const {backend}=await import('./helpers.mjs');
 const row=(colecao,registro)=>({colecao,id:registro.id,registro,revision:1,apagado:false});
 const c=id=>({...curso(id,'Curso fictício '+id),setor:'Produção',liberacao:{pessoas:[],setores:[],cargos:[],todos:false},etapas:[{id:'aula-'+id,titulo:'Aula fictícia',tipo:'aula',obrigatoria:true,prerequisitos:[],conteudo:{aprender:'Refletir',importancia:'Aprender',comoFazer:'Estudar',erros:'Revisar',evidencia:'Explicar'},quiz:[],fontes:[],documentos:[],pontos:10}]});
 const historico={id:'historico-ficticio',colaboradorId:'rh-pessoa-a',formacaoId:'curso-antigo',formacaoVersao:'1',etapas:{anterior:{leituraEm:'2026-10-01T12:00:00Z'}}};
 const rows=[row('formacoes',c('curso-a')),row('formacoes',c('curso-b')),row('aprendizagem',historico)];
 const b=backend({persistWrites:true,rows,tables:{registros:[row('colaboradores',{id:'rh-pessoa-a',nome:'Pessoa fictícia',idPessoa:'900001',setor:'Produção'})],acesso_conta:[{id:'conta-a',usuario:'aluna',ativo:true,colaborador_id:'rh-pessoa-a'}],acesso_papel:[{conta_id:'conta-a',sistema:'pops',login:'aluna',ativo:true,papel:'equipe'}],pcp_config_global:[{id:true,config:{performancePCP:{equipes:[{id:'equipe-a',nome:'Equipe fictícia',membros:[{chave:'900001'}]}]}}}]}});
 const t=telaEscola({sessao:{usuario:'admin',papel:'admin',pessoaRH:null},backend:b});await editor(t);
 await t.click('[data-ej-adicionar="curso-a"]');await t.click('[data-ej-adicionar="curso-b"]');t.node('#ej-equipe').value='equipe-a';await t.click('[data-ej-subir="1"]');await t.submit('#ej-form');
 const salvo=rows.find(r=>r.colecao==='planos_aprendizagem');assert.ok(salvo);assert.equal(salvo.registro.colaboradorId,'rh-pessoa-a');assert.equal(salvo.revision,1);assert.deepEqual(salvo.registro.itens.map(i=>i.formacaoId),['curso-b','curso-a']);
 t.node('#ej-objetivo').value='Objetivo alterado depois de confirmar';await t.submit('#ej-form');assert.equal(rows.find(r=>r.colecao==='planos_aprendizagem').revision,2);assert.equal(t.calls.filter(c=>c.operacao==='salvarPlano').at(-1).expectedRevision,1);
 assert.deepEqual(rows.find(r=>r.colecao==='aprendizagem').registro,historico);
 const aluno=await b.call({action:'escola',operacao:'painel'},{sub:'aluna',papel:'equipe'});assert.equal(aluno.status,200);assert.deepEqual(aluno.body.planoPessoal.itens.map(i=>i.formacaoId),['curso-b','curso-a']);assert.equal(aluno.body.formacoes.every(f=>f.liberadaParaMim),true);assert.equal(aluno.body.equipeTrabalho.nome,'Equipe fictícia');
});

test('atualizar cursos conserva rascunho e distingue equipes indisponíveis',async()=>{
 const painel=base();painel.gestao.estadoEquipesTrabalho='indisponivel';painel.gestao.equipesTrabalho=[];const t=tela({painel});await editor(t);assert.match(t.node('#ej-equipe-ajuda').textContent,/indisponível/);
 await t.click('[data-ej-adicionar="curso-a"]');t.node('#ej-titulo').value='Título ainda local';t.node('#ej-orientacao-0').value='Orientação ainda local';
 painel.formacoes.push(curso('curso-novo','Curso publicado em outra aba'));await t.click('#ej-atualizar');assert.equal(t.node('#ej-titulo').value,'Título ainda local');assert.equal(t.node('#ej-orientacao-0').value,'Orientação ainda local');assert.ok(t.node('[data-ej-adicionar="curso-novo"]'));assert.equal(t.calls.some(c=>c.operacao==='salvarPlano'),false);
});

test('desativar jornada conserva curso e equipe anteriores indisponíveis, sem permitir reativação',async()=>{
 const painel=base();painel.gestao.equipesTrabalho=[];painel.gestao.planos=[{id:'plano-anterior',colaboradorId:'rh-pessoa-a',titulo:'Plano anterior',objetivo:'Preservar o histórico',equipeId:'equipe-removida',ativa:true,_serverRevision:4,itens:[{formacaoId:'curso-removido',prazo:'2026-11-10',contexto:'flexivel',orientacao:'Orientação original'}]}];
 const t=tela({painel});await editor(t);await t.submit('#ej-form');assert.equal(t.calls.some(c=>c.operacao==='salvarPlano'),false,'Curso ausente não pode ser liberado pelo plano ativo');
 t.node('#ej-ativa').checked=false;await t.submit('#ej-form');const req=t.calls.find(c=>c.operacao==='salvarPlano');assert.ok(req,'A desativação deve chegar ao servidor');assert.equal(req.plano.ativa,false);assert.equal(req.plano.equipeId,'equipe-removida');assert.deepEqual(req.plano.itens,[{formacaoId:'curso-removido',prazo:'2026-11-10',contexto:'flexivel',orientacao:'Orientação original'}]);assert.equal(req.expectedRevision,4);assert.match(t.node('#ej-estado').textContent,/confirmada/i);
 t.node('#ej-ativa').checked=true;await t.submit('#ej-form');assert.equal(t.calls.filter(c=>c.operacao==='salvarPlano').length,1,'Reativação exige referências disponíveis');
});

test('desativar só conserva referências confirmadas; não aceita curso novo indisponível',async()=>{
 for(const confirmar of [false,true]){
  const painel=base(),t=tela({painel});await editor(t);await t.click('[data-ej-adicionar="curso-a"]');if(confirmar)await t.submit('#ej-form');
  painel.formacoes=painel.formacoes.filter(c=>c.id!=='curso-a');await t.click('#ej-atualizar');t.node('#ej-ativa').checked=false;await t.submit('#ej-form');
  const req=t.calls.filter(c=>c.operacao==='salvarPlano');assert.equal(req.length,confirmar?2:0,confirmar?'Referências da gravação confirmada podem ser conservadas':'Curso nunca confirmado continua sujeito à disponibilidade');if(confirmar)assert.equal(req.at(-1).plano.ativa,false);
 }
});

test('desativar não autoriza equipe diferente da última gravação quando o vínculo desaparece',async()=>{
 const painel=base();painel.gestao.planos=[{id:'plano-anterior',colaboradorId:'rh-pessoa-a',titulo:'Plano anterior',objetivo:'Objetivo fictício',equipeId:'equipe-a',ativa:true,_serverRevision:2,itens:[{formacaoId:'curso-a',prazo:'',contexto:'empresa',orientacao:''}]}];painel.gestao.equipesTrabalho.push({id:'equipe-nova',nome:'Outra equipe fictícia',colaboradorIds:['rh-pessoa-a']});
 const t=tela({painel});await editor(t);t.node('#ej-equipe').value='equipe-nova';painel.gestao.equipesTrabalho=[];await t.click('#ej-atualizar');t.node('#ej-ativa').checked=false;await t.submit('#ej-form');assert.equal(t.calls.some(c=>c.operacao==='salvarPlano'),false);assert.match(t.node('#ej-erro').textContent,/equipe atual/);
});

test('resposta tardia de atualizar cursos preserva orientação, prazo, contexto e equipe alterados durante a consulta',async()=>{
 const painel=base();let liberar,consultas=0;
 const t=telaEscola({sessao:{usuario:'admin',papel:'admin',pessoaRH:null},api:async p=>{if(p.operacao==='painel'){if(++consultas===1)return structuredClone(painel);return new Promise(resolve=>{liberar=()=>resolve(structuredClone(painel));});}if(p.operacao==='salvarPlano')return {ok:true,registro:p.plano,revision:1};throw new Error('Operação inesperada');}});
 await editor(t);await t.click('[data-ej-adicionar="curso-a"]');t.node('#ej-orientacao-0').value='Antes de consultar';
 const consulta=t.click('#ej-atualizar');await esperar();assert.equal(t.node('#ej-atualizar').disabled,true);assert.equal(t.node('#ej-campos').disabled,false);
 t.node('#ej-orientacao-0').value='Digitado durante a consulta';t.node('#ej-prazo-0').value='2026-12-15';t.node('#ej-contexto-0').value='flexivel';t.node('#ej-equipe').value='equipe-a';
 painel.formacoes.push(curso('curso-chegando','Novo curso fictício'));liberar();await consulta;
 assert.equal(t.node('#ej-orientacao-0').value,'Digitado durante a consulta');assert.equal(t.node('#ej-prazo-0').value,'2026-12-15');assert.equal(t.node('#ej-contexto-0').value,'flexivel');assert.equal(t.node('#ej-equipe').value,'equipe-a');assert.ok(t.node('[data-ej-adicionar="curso-chegando"]'));
 await t.submit('#ej-form');const req=t.calls.find(c=>c.operacao==='salvarPlano');assert.deepEqual(req.plano.itens,[{formacaoId:'curso-a',prazo:'2026-12-15',contexto:'flexivel',orientacao:'Digitado durante a consulta'}]);assert.equal(req.plano.equipeId,'equipe-a');
});

test('falha tardia ao abrir jornada não substitui outra rota da mesma conta',async()=>{
 let rejeitar;const t=telaEscola({sessao:{usuario:'admin',papel:'admin',pessoaRH:null},api:()=>new Promise((resolve,reject)=>{rejeitar=reject;})});
 const abertura=t.route('jornada-editor','rh-pessoa-a');await esperar();
 t.rotear('catalogo');t.app.innerHTML='<h1>Catálogo aberto</h1><p>Conteúdo da página de destino.</p>';
 rejeitar(new Error('Consulta de jornada indisponível'));await abertura;
 assert.equal(t.text(),'Catálogo abertoConteúdo da página de destino.');assert.equal(t.node('#ej-retentar'),null);
});

test('abertura direta espera o vínculo RH da sessão antes de permitir montar e salvar a jornada',async()=>{
 const t=tela();let confirmar;
 t.ctx.atualizarIdentidadeRH=()=>new Promise(resolve=>{confirmar=()=>{t.SESSAO.pessoaRH={colaboradorId:'rh-administrador'};t.SESSAO.identidadeConferida=true;resolve();};});
 const abertura=editor(t);await esperar();assert.equal(t.node('#ej-form')===null,true,'Não monta formulário com identidade ainda provisória');assert.equal(t.calls.some(c=>c.operacao==='painel'),false,'Consulta pessoal aguarda a identidade confirmada');
 confirmar();await abertura;await t.click('[data-ej-adicionar="curso-a"]');await t.submit('#ej-form');assert.equal(t.calls.filter(c=>c.operacao==='salvarPlano').length,1);assert.match(t.node('#ej-estado').textContent,/confirmada/i);
});

test('espera do RH não monta jornada sobre outra rota, conta ou crachá',async()=>{
 for(const mudar of ['rota','conta','cracha']){
  const t=tela();let confirmar,token='cracha-inicial';t.ctx.AUTH={crachaDe:()=>token};t.ctx.atualizarIdentidadeRH=()=>new Promise(resolve=>{confirmar=resolve;});
  const abertura=editor(t);await esperar();assert.equal(typeof confirmar,'function','A abertura aguarda confirmação do RH');if(mudar==='rota')t.rotear('catalogo');if(mudar==='conta')t.SESSAO.usuario='outra-conta';if(mudar==='cracha')token='outro-cracha';t.app.innerHTML='<h1>Página de destino</h1>';
  confirmar();await abertura;assert.equal(t.text(),'Página de destino',mudar);assert.equal(t.calls.some(c=>c.operacao==='painel'),false,mudar);assert.equal(t.node('#ej-form'),null,mudar);
 }
});
