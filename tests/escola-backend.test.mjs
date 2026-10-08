import test from 'node:test';
import assert from 'node:assert/strict';
import {backend} from './helpers.mjs';
const conteudo={aprender:'Aprender exemplo',importancia:'Aplicação no trabalho',comoFazer:'Instrução revisada',erros:'Erros comuns',evidencia:'Demonstrar corretamente'};
const etapa=(id,tipo='cultura',extra={})=>({id,titulo:id,tipo,obrigatoria:true,prerequisitos:[],pontos:10,conteudo,quiz:[],minimoAcerto:70,maxTentativas:2,fontes:[],documentos:[],...extra});
const quiz=[{id:'q1',pergunta:'Exemplo?',opcoes:['Correto','Errado'],correta:0,explicacao:'O motivo da resposta é este',revisar:'Instrução revisada'}];
const f=(etapas=[etapa('cultura')],extra={})=>({id:'f1',titulo:'Formação fictícia',versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},etapas,...extra});
const row=(colecao,registro,revision=1)=>({colecao,id:registro.id,registro,revision,apagado:false});
const tables={
 acesso_conta:[{id:'acc1',usuario:'ana',ativo:true,colaborador_id:'rh1'},{id:'acc2',usuario:'bruno',ativo:true,colaborador_id:'rh2'}],
 acesso_papel:[{conta_id:'acc1',sistema:'pops',login:'ana',ativo:true,papel:'equipe'},{conta_id:'acc2',sistema:'pops',login:'bruno',ativo:true,papel:'equipe'}],
 registros:[row('colaboradores',{id:'rh1',nome:'Ana RH',setor:'Produção',cargoId:'c1'}),row('colaboradores',{id:'rh2',nome:'Bruno RH',setor:'Produção'}),row('colaboradores',{id:'rh3',nome:'Outra pessoa',setor:'Financeiro'}),row('cargos',{id:'c1',nome:'Montadora'})]
};
function app(formacao=f(),opts={}){const rows=[row('formacoes',formacao),...(opts.rows||[])];return backend({tables,persistWrites:true,...opts,rows});}
const cmd=(b,operacao,args={},who={})=>b.call({action:'escola',operacao,...(['registrar','validar'].includes(operacao)?{formacaoVersao:'1'}:{}),...args},who);
let sequence=0;
const atividade=(b,evento,extra={},who={})=>cmd(b,'registrar',{formacaoId:'f1',etapaId:'cultura',evento,mutationId:'m'+(++sequence),...extra},who);
test('painel reconhece ID RH, cargo e não revela gabarito nem outras pessoas',async()=>{
 const b=app(f([etapa('cultura','avaliacao',{quiz})]));const r=await cmd(b,'painel');assert.equal(r.status,200);assert.equal(r.body.pessoa.colaboradorId,'rh1');assert.equal(r.body.pessoa.funcao,'Montadora');assert.equal(r.body.formacoes[0].etapas[0].quiz[0].correta,undefined);assert.equal(r.body.gestao.pessoas.length,0);
});
test('mesmo ID RH recebe conteúdos diferentes e conserva progresso independente em outra sessão',async()=>{
 const outra=f([etapa('leitura')],{id:'f2',titulo:'Leitura complementar'});
 const b=app(f(),{rows:[row('formacoes',outra)]});
 assert.equal((await cmd(b,'painel')).body.formacoes.length,2);
 const a=await atividade(b,'leitura');assert.equal(a.status,200);
 let p=await cmd(b,'painel');assert.equal(p.body.aprendizagem.length,1);assert.equal(p.body.aprendizagem[0].formacaoId,'f1');
 const c=await atividade(b,'abrir',{formacaoId:'f2',etapaId:'leitura'});assert.equal(c.status,200);
 const outraSessao=app(f(),{rows:[row('formacoes',outra),row('aprendizagem',a.body.registro,a.body.revision),row('aprendizagem',c.body.registro,c.body.revision)]});
 p=await cmd(outraSessao,'painel');assert.equal(p.body.aprendizagem.length,2);
 assert.deepEqual(new Set(p.body.aprendizagem.map(x=>x.colaboradorId)),new Set(['rh1']));
 assert.equal(p.body.aprendizagem.find(x=>x.formacaoId==='f1').pontos,10);
 assert.equal(p.body.aprendizagem.find(x=>x.formacaoId==='f2').pontos,0);
 assert.equal(p.body.aprendizagem.find(x=>x.formacaoId==='f2').etapas.leitura.status,'em_andamento');
 assert.equal((await cmd(outraSessao,'painel',{}, {sub:'bruno'})).body.aprendizagem.length,0);
});
test('nenhuma pessoa pode forjar pontos, RH ou progresso por escrita genérica',async()=>{
 const b=app();for(const colecao of ['formacoes','aprendizagem'])assert.equal((await b.call({action:'upsert',colecao,registro:{id:'hack',pontos:999}})).status,400);
 const r=await atividade(b,'leitura',{colaboradorId:'rh2',pontos:999});assert.equal(r.status,200);assert.equal(r.body.registro.colaboradorId,'rh1');assert.equal(r.body.registro.pontos,10);
});
test('abrir não conclui e leitura não aprova compreensão',async()=>{
 const b=app(f([etapa('cultura','avaliacao',{quiz})]));let r=await atividade(b,'abrir');assert.equal(r.body.registro.pontos,0);assert.equal(r.body.registro.etapas.cultura.status,'em_andamento');r=await atividade(b,'leitura');assert.equal(r.body.registro.pontos,0);assert.equal(r.body.registro.etapas.cultura.compreensaoEm,undefined);
});
test('ciência do código exige aceite, leitura e compreensão da versão',async()=>{
 const etica=etapa('cultura','etica',{quiz,fontes:[{tipo:'treinamento',refId:'t1',versao:'1',oficialConfirmado:true,conferidoPor:'admin',conferidoEm:'2026-10-08T12:00:00Z'}]});const b=app(f([etica]),{rows:[row('treinamentos',{id:'t1',versao:'1'})]});
 assert.equal((await atividade(b,'ciencia',{aceite:false})).status,400);await atividade(b,'ciencia',{aceite:true});const r=await atividade(b,'responder',{respostas:{q1:0}});assert.equal(r.body.registro.etapas.cultura.status,'concluida');assert.equal(r.body.feedback.nota,100);assert.equal(r.body.registro.conquistas.length,1);
});
test('reenvio mesmo comando é idempotente e releitura nunca duplica pontos',async()=>{
 const b=app();const args={mutationId:'idempotente'};const a=await atividade(b,'leitura',args);const c=await atividade(b,'leitura',args);assert.equal(a.body.revision,c.body.revision);const d=await atividade(b,'leitura');assert.equal(d.body.registro.pontos,10);assert.equal(d.body.registro.conquistas.length,1);
});
test('avaliação dá explicação, bloqueia após limite e conserva tentativas',async()=>{
 const b=app(f([etapa('cultura','avaliacao',{quiz})]));await atividade(b,'leitura');for(let i=0;i<2;i++){const r=await atividade(b,'responder',{respostas:{q1:1}});assert.equal(r.body.feedback.aprovada,false);assert.equal(r.body.feedback.questoes[0].explicacao,quiz[0].explicacao);}assert.equal((await atividade(b,'responder',{respostas:{q1:0}})).status,409);const r=await cmd(b,'painel');assert.equal(r.body.aprendizagem[0].etapas.cultura.tentativas.length,2);
});
test('pré-requisito bloqueado é explicado na resposta e aplicado no servidor',async()=>{
 const b=app(f([etapa('cultura','avaliacao',{quiz}),etapa('avanco','cultura',{prerequisitos:['cultura']})]));const p=await cmd(b,'painel');assert.match(p.body.formacoes[0].etapas[1].motivoBloqueio,/Conclua primeiro/);assert.equal((await atividade(b,'leitura',{etapaId:'avanco'})).status,409);
});
test('prática requer evidência e checklist, somente responsável designado de setor valida',async()=>{
 const b=app(f([etapa('cultura','pratica',{checklist:['Passo correto'],validadores:['bruno']})]),{config:{educacao:{instrutores:{bruno:['Produção']}}}});
 await atividade(b,'leitura');assert.equal((await atividade(b,'enviarPratica',{evidencia:'Exemplo',checklist:[false]})).status,400);
 let r=await atividade(b,'enviarPratica',{evidencia:'Exemplo realizado',checklist:[true]});assert.equal(r.body.registro.pontos,0);assert.equal(r.body.registro.etapas.cultura.status,'aguardando_validacao');
 const v={colaboradorId:'rh1',formacaoId:'f1',etapaId:'cultura',aprovado:true,feedback:'Execução conferida',mutationId:'valid-1'};
 assert.equal((await cmd(b,'validar',v)).status,403);assert.equal((await cmd(b,'validar',v,{sub:'terceiro'})).status,403);
 r=await cmd(b,'validar',v,{sub:'bruno'});assert.equal(r.status,200);assert.equal(r.body.registro.pontos,undefined);assert.equal(r.body.registro.etapas.cultura.pontos,10);assert.equal(r.body.registro.etapas.cultura.validacao.por,'bruno');
});
test('instrutor configurado em outro setor não acessa nem valida prática',async()=>{
 const b=app(f([etapa('cultura','pratica',{checklist:['Passo'],validadores:['bruno']})]),{config:{educacao:{instrutores:{bruno:['Financeiro']}}}});await atividade(b,'leitura');await atividade(b,'enviarPratica',{evidencia:'Feito',checklist:[true]});const p=await cmd(b,'painel',{}, {sub:'bruno'});assert.equal(p.body.gestao.registros.length,0);assert.equal((await cmd(b,'validar',{colaboradorId:'rh1',formacaoId:'f1',etapaId:'cultura',aprovado:true,feedback:'Ok',mutationId:'v2'},{sub:'bruno'})).status,403);
});
test('prática reprovada mantém retorno do responsável e permite refazer',async()=>{
 const b=app(f([etapa('cultura','pratica',{checklist:['Passo'],validadores:['bruno']})]),{config:{educacao:{instrutores:{bruno:['Produção']}}}});await atividade(b,'leitura');await atividade(b,'enviarPratica',{evidencia:'Feito',checklist:[true]});await cmd(b,'validar',{colaboradorId:'rh1',formacaoId:'f1',etapaId:'cultura',aprovado:false,feedback:'Rever acabamento',mutationId:'r1'},{sub:'bruno'});const r=await atividade(b,'enviarPratica',{evidencia:'Acabamento corrigido',checklist:[true]});assert.equal(r.body.registro.etapas.cultura.validacoes.length,1);assert.equal(r.body.registro.pontos,0);
});
test('reciclagem preserva histórico, libera tentativas e não premia atividade repetida',async()=>{
 const b=app();await atividade(b,'leitura');const r=await cmd(b,'reciclar',{colaboradorId:'rh1',formacaoId:'f1',motivo:'Rever novo equipamento',mutationId:'rec-1'},{sub:'gestao',papel:'admin'});assert.equal(r.status,200);assert.equal(r.body.registro.historico[0].etapas.cultura.status,'concluida');const t=await atividade(b,'leitura');assert.equal(t.body.registro.pontos,10);assert.equal(t.body.registro.conquistas.length,1);
});
test('edição pedagógica exige nova versão; permissões não permitem gerente sair do setor',async()=>{
 const b=app(f(),{config:{gestores:{gestao:['Produção']}}});let formacao=f();formacao.etapas[0].conteudo={...conteudo,comoFazer:'Nova instrução'};
 assert.equal((await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'edit1'},{sub:'gestao',papel:'gestor'})).status,409);
 formacao.versao='2';formacao.liberacao.setores=['Financeiro'];assert.equal((await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'edit2'},{sub:'gestao',papel:'gestor'})).status,403);
});
test('nova versão mantém conclusões antigas no histórico e avisa sobre atualização',async()=>{
 const b=app();await atividade(b,'leitura');const formacao=f();formacao.versao='2';formacao.etapas[0].conteudo={...conteudo,comoFazer:'Novo método'};const e=await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'edit'},{sub:'gestao',papel:'admin'});assert.equal(e.status,200);const p=await cmd(b,'painel');assert.equal(p.body.formacoes[0].revisaoNecessaria,true);const r=await atividade(b,'abrir',{formacaoVersao:'2'});assert.equal(r.body.registro.historico[0].formacaoVersao,'1');assert.equal(r.body.registro.historico[0].etapas.cultura.status,'concluida');assert.equal(r.body.registro.etapas.cultura.status,'em_andamento');
});
test('POP não revisado ou atualizado nunca conclui etapa',async()=>{
 for(const pop of [{id:'p1',versao:'1',revisao:{status:'revisar'}},{id:'p1',versao:'2',revisao:{status:'validado'}}]) {
 const b=app(f([etapa('cultura','pop',{fontes:[{tipo:'pop',refId:'p1',versao:'1'}]})]),{rows:[row('pops',pop)]});assert.equal((await atividade(b,'leitura')).status,409);const r=await cmd(b,'painel');assert.equal(r.body.formacoes[0].etapas[0].statusFonte,'pendente');
 }
});
test('documento HTTPS sozinho não comprova versão oficial',async()=>{
 const b=app(f([etapa('cultura','caderno',{documentos:[{titulo:'Caderno',url:'https://exemplo.test/manual',versao:'1'}]})]));assert.equal((await atividade(b,'leitura')).status,409);
});
test('ausência do vínculo RH bloqueia aprendizado sem criar cadastro duplicado',async()=>{
 const b=app();const r=await atividade(b,'leitura',{}, {sub:'desvinculado'});assert.equal(r.status,403);assert.equal(b.writes.length,0);
});
test('gestor lê somente pessoas e históricos dos setores autorizados',async()=>{
 const b=app(f(),{config:{gestores:{gestao:['Produção']}},rows:[row('aprendizagem',{id:'a1',colaboradorId:'rh1',formacaoId:'f1',etapas:{},eventos:[]}),row('aprendizagem',{id:'a2',colaboradorId:'rh3',formacaoId:'f1',etapas:{},eventos:[]})]});const r=await cmd(b,'painel',{}, {sub:'gestao',papel:'gestor'});assert.equal(r.body.gestao.registros.length,1);assert.equal(r.body.gestao.pessoas.some(p=>p.colaboradorId==='rh3'),false);
});
test('coleções escolares não vazam no pull genérico nem gabarito para equipe',async()=>{
 const b=app();assert.equal((await b.call({action:'list',colecao:'formacoes'})).status,400);const r=await b.call({action:'list'},{sub:'admin',papel:'admin'});assert.equal(r.body.registros.some(r=>r._col==='formacoes'),false);
});
test('falha de leitura/salvar nunca retorna confirmação enganosa',async()=>{
 const r=await cmd(app(f(),{queryError:true}),'painel');assert.equal(r.status,500);assert.equal(r.body.ok,undefined);
});
test('liberação por cargo e setor usa IDs reais sem alterar RH',async()=>{
 const b=app(f(undefined,{liberacao:{cargos:['c1'],pessoas:[],setores:[]}}));const r=await atividade(b,'leitura');assert.equal(r.status,200);assert.equal(b.writes.every(w=>!w.table&&w.args.p_colecao==='aprendizagem'),true);
});
test('escola lê catálogo e histórico sem perder registros após a página 500',async()=>{
 const rows=Array.from({length:1001},(_,i)=>row('formacoes',f([etapa('cultura')],{id:'f'+String(i).padStart(4,'0')})));
 const b=backend({tables,rows});const r=await cmd(b,'painel');assert.equal(r.status,200);assert.equal(r.body.formacoes.length,1001);assert.equal(b.queries.filter(q=>q.table==='pops_registros'&&q.range?.[0]===1000).length,1);
});
test('novo aparelho retorna a aprendizagem confirmada pelo RH, sem depender do login antigo',async()=>{
 const b=app();const r=await atividade(b,'leitura');const rows=[row('formacoes',f()),row('aprendizagem',r.body.registro,r.body.revision)];
 const novo=backend({tables:{...tables,acesso_conta:[{id:'new',usuario:'novo-login',ativo:true,colaborador_id:'rh1'}],acesso_papel:[{conta_id:'new',login:'novo-login',ativo:true,sistema:'pops',papel:'equipe'}]},rows});
 const p=await cmd(novo,'painel',{}, {sub:'novo-login'});assert.equal(p.body.aprendizagem[0].pontos,10);assert.equal(p.body.aprendizagem[0].colaboradorId,'rh1');
});
test('instrutor exige configuração e vínculo RH ativo, equipe não concede papéis',async()=>{
 const b=app();const args={instrutores:{bruno:['Produção']}};assert.equal((await cmd(b,'configurarInstrutores',args)).status,403);assert.equal((await cmd(b,'configurarInstrutores',{instrutores:{fantasma:['Produção']}},{papel:'admin',sub:'admin'})).status,409);const r=await cmd(b,'configurarInstrutores',args,{papel:'admin',sub:'admin'});assert.equal(r.status,200);assert.equal(b.writes.at(-1).args.p_patch.educacao.instrutores.bruno[0],'Produção');
});
test('confirmação de fonte grava autoria verdadeira e bloqueia fonte sem revisão',async()=>{
 const b=app(f(undefined,{publicada:false}));const formacao=f([etapa('cultura','caderno',{documentos:[{titulo:'Caderno',url:'https://exemplo.test/caderno.pdf',versao:'1',oficialConfirmado:true,conferidoPor:'forjado',conferidoEm:'antigo'}]})],{versao:'2'});const r=await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'fonte1'},{sub:'admin',papel:'admin'});assert.equal(r.status,200);assert.equal(r.body.registro.etapas[0].documentos[0].conferidoPor,'admin');assert.notEqual(r.body.registro.etapas[0].documentos[0].conferidoEm,'antigo');
});
test('reabrir leitura não remove prática que aguarda conferência',async()=>{
 const b=app(f([etapa('cultura','pratica',{checklist:['Passo'],validadores:['bruno']})]));await atividade(b,'leitura');await atividade(b,'enviarPratica',{evidencia:'Executado',checklist:[true]});const r=await atividade(b,'leitura');assert.equal(r.body.registro.etapas.cultura.status,'aguardando_validacao');
});
test('salvar formação repetido após perda de resposta devolve a gravação confirmada',async()=>{
 const b=app();const formacao=f();formacao.versao='2';const args={formacao,expectedRevision:1,mutationId:'form-retry'};const a=await cmd(b,'salvarFormacao',args,{papel:'admin'});const r=await cmd(b,'salvarFormacao',args,{papel:'admin'});assert.equal(a.status,200);assert.equal(r.status,200);assert.equal(a.body.revision,r.body.revision);assert.equal(r.body.repetido,true);
});
test('versões oficiais preservadas não podem ser substituídas reaproveitando o número',async()=>{
 const b=app();const formacao=f();formacao.versao='2';let r=await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'v-new'},{papel:'admin'});assert.equal(r.body.registro.versoesAnteriores[0].versao,'1');formacao.versao='1';r=await cmd(b,'salvarFormacao',{formacao,expectedRevision:r.body.revision,mutationId:'v-old'},{papel:'admin'});assert.equal(r.status,409);
});
test('instrutor desligado no RH perde validação mesmo permanecendo na configuração',async()=>{
 const tab=structuredClone(tables),rh=tab.registros.find(r=>r.id==='rh2');rh.registro.dataDesligamento='2026-10-08';
 const b=app(f([etapa('cultura','pratica',{checklist:['Passo'],validadores:['bruno']})]),{tables:tab,config:{educacao:{instrutores:{bruno:['Produção']}}}});await atividade(b,'leitura');await atividade(b,'enviarPratica',{evidencia:'Executado',checklist:[true]});const r=await cmd(b,'validar',{colaboradorId:'rh1',formacaoId:'f1',etapaId:'cultura',aprovado:true,feedback:'Executado',mutationId:'gone'},{sub:'bruno'});assert.equal(r.status,403);
});
test('instrutor de prática não recebe avaliações, notas ou histórico privado do colega',async()=>{
 const b=app(f([etapa('avaliacao','avaliacao',{quiz}),etapa('pratica','pratica',{checklist:['Passo'],validadores:['bruno']})]),{config:{educacao:{instrutores:{bruno:['Produção']}}}});
 await atividade(b,'leitura',{etapaId:'avaliacao'});await atividade(b,'responder',{etapaId:'avaliacao',respostas:{q1:0}});await atividade(b,'leitura',{etapaId:'pratica'});await atividade(b,'enviarPratica',{etapaId:'pratica',evidencia:'Executado',checklist:[true]});
 const r=await cmd(b,'painel',{}, {sub:'bruno'}),p=r.body.gestao.registros[0];assert.deepEqual(Object.keys(p.etapas),['pratica']);assert.equal(p.pontos,undefined);assert.equal(p.historico,undefined);assert.equal(p.eventos,undefined);assert.equal(p.conquistas,undefined);
});
test('comando sem versão não certifica uma leitura nova sem conteúdo visto',async()=>{
 const b=app();const r=await b.call({action:'escola',operacao:'registrar',formacaoId:'f1',etapaId:'cultura',evento:'leitura',mutationId:'without-version'});assert.equal(r.status,409);assert.equal(b.writes.length,0);
});
test('gestor enxerga jornada que administra mas não recebe liberação implícita como aluno',async()=>{
 const b=app(f(),{config:{gestores:{bruno:['Produção']}}});const r=await cmd(b,'painel',{}, {sub:'bruno',papel:'gestor'});assert.equal(r.body.formacoes.length,1);assert.equal(r.body.formacoes[0].liberada,false);assert.equal(r.body.formacoes[0].liberadaParaMim,false);
});
test('perda da liberação preserva histórico mas não expõe conteúdo atual da nova função',async()=>{
 const b=app();const a=await atividade(b,'leitura');const formacao=f(undefined,{liberacao:{pessoas:['rh2']}});formacao.etapas[0].conteudo={...conteudo,comoFazer:'Conteúdo restrito novo'};formacao.versao='2';const r=await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'lib-rev'},{papel:'admin'});assert.equal(r.status,200);const p=await cmd(b,'painel');assert.equal(p.body.aprendizagem[0].pontos,10);assert.equal(p.body.formacoes[0].somenteHistorico,true);assert.equal(p.body.formacoes[0].etapas[0].conteudo,undefined);assert.equal(JSON.stringify(p.body).includes('Conteúdo restrito novo'),false);
});
test('prática com avaliação exige compreensão antes de permitir envio',async()=>{
 const b=app(f([etapa('cultura','pratica',{quiz,checklist:['Passo'],validadores:['bruno']})]));await atividade(b,'leitura');const env={evidencia:'Executado',checklist:[true]};assert.equal((await atividade(b,'enviarPratica',env)).status,409);await atividade(b,'responder',{respostas:{q1:0}});assert.equal((await atividade(b,'enviarPratica',env)).status,200);
});
test('tentativa repetida após resposta perdida recupera explicação sem gastar nova tentativa',async()=>{
 const b=app(f([etapa('cultura','avaliacao',{quiz})]));await atividade(b,'leitura');const args={respostas:{q1:1},mutationId:'try-reply'};const a=await atividade(b,'responder',args);const r=await atividade(b,'responder',args);assert.equal(r.body.repetido,true);assert.deepEqual(r.body.feedback,a.body.feedback);assert.equal(r.body.registro.etapas.cultura.tentativas.length,1);
});
test('replay não permite usar ID da avaliação alheia para obter feedback como instrutor',async()=>{
 const b=app(f([etapa('av','avaliacao',{quiz}),etapa('pr','pratica',{checklist:['Passo'],validadores:['bruno']})]),{config:{educacao:{instrutores:{bruno:['Produção']}}}});await atividade(b,'leitura',{etapaId:'av'});await atividade(b,'responder',{etapaId:'av',respostas:{q1:1},mutationId:'private-reply'});await atividade(b,'leitura',{etapaId:'pr'});await atividade(b,'enviarPratica',{etapaId:'pr',evidencia:'Feito',checklist:[true]});
 const r=await cmd(b,'validar',{formacaoId:'f1',colaboradorId:'rh1',etapaId:'pr',aprovado:true,feedback:'Conferido',mutationId:'private-reply'},{sub:'bruno'});assert.equal(r.status,409);assert.equal(r.body.feedback,undefined);
});
test('reutilizar ID para respostas diferentes não retorna falso sucesso',async()=>{
 const b=app(f([etapa('cultura','avaliacao',{quiz})]));await atividade(b,'leitura');await atividade(b,'responder',{respostas:{q1:1},mutationId:'immutable-command'});const r=await atividade(b,'responder',{respostas:{q1:0},mutationId:'immutable-command'});assert.equal(r.status,409);
});
test('gestor legado lê apenas pessoas, atribuições e históricos com RH do seu setor',async()=>{
 const rows=[row('pessoas',{id:'p-rh1',nome:'Ana'}),row('pessoas',{id:'p-rh3',nome:'Outro setor'}),row('atribuicoes',{id:'atr1',pessoaId:'p-rh1'}),row('atribuicoes',{id:'atr3',pessoaId:'p-rh3'}),row('leituras',{id:'l1',colaboradorId:'rh1'}),row('leituras',{id:'l3',colaboradorId:'rh3'}),row('leituras',{id:'sem-rh',usuario:'ana'}),row('progresso',{id:'pr1',pessoaId:'p-rh1'}),row('progresso',{id:'pr3',pessoaId:'p-rh3'})];
 const b=app(f(),{rows,config:{gestores:{gestao:['Produção']}}});for(const colecao of ['pessoas','atribuicoes','leituras','progresso']){const r=await b.call({action:'list',colecao},{sub:'gestao',papel:'gestor'});assert.equal(r.status,200);assert.equal(r.body.itens.length,1);assert.equal((await b.call({action:'get',colecao,id:colecao==='pessoas'?'p-rh3':colecao==='atribuicoes'?'atr3':colecao==='leituras'?'l3':'pr3'},{sub:'gestao',papel:'gestor'})).body.registro,null);}
 assert.equal((await b.call({action:'list',colecao:'leituras'},{sub:'admin',papel:'admin'})).body.itens.length,3);
});
test('gestor não atribui POP do próprio setor a pessoa fora do seu escopo RH',async()=>{
 const b=app(f(),{rows:[row('pops',{id:'pop1',setor:'Produção'}),row('pessoas',{id:'p-rh1'}),row('pessoas',{id:'p-rh3'})],config:{gestores:{gestao:['Produção']}}});const base={action:'upsert',colecao:'atribuicoes',registro:{id:'atr1',tipo:'pop',refId:'pop1',pessoaId:'p-rh3'}};assert.equal((await b.call(base,{papel:'gestor',sub:'gestao'})).status,403);base.registro.pessoaId='p-rh1';assert.equal((await b.call(base,{papel:'gestor',sub:'gestao'})).status,200);
});
test('gestor libera por função somente no escopo de setores autorizado e não pelo campo enviado',async()=>{
 const tab=structuredClone(tables);tab.registros.find(r=>r.id==='rh3').registro.cargoId='c1';tab.acesso_conta.push({id:'acc3',usuario:'fora',ativo:true,colaborador_id:'rh3'});tab.acesso_papel.push({conta_id:'acc3',sistema:'pops',login:'fora',ativo:true,papel:'equipe'});
 const b=app(f(),{tables:tab,config:{gestores:{gestao:['Produção']}}});const formacao=f(undefined,{liberacao:{pessoas:[],setores:[],cargos:['c1'],cargosGestor:'outro',cargosSetores:['Financeiro']}});
 const s=await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'cargo-scope'},{papel:'gestor',sub:'gestao'});assert.equal(s.status,200);assert.deepEqual(s.body.registro.liberacao.cargosSetores,['Produção']);assert.equal(s.body.registro.liberacao.cargosGestor,'gestao');assert.equal((await cmd(b,'painel')).body.formacoes[0].liberada,true);assert.equal((await cmd(b,'painel',{}, {sub:'fora'})).body.formacoes.length,0);assert.equal((await atividade(b,'leitura',{}, {sub:'fora'})).status,403);
});
test('redução posterior do escopo do gestor retira liberação por função sem apagar histórico',async()=>{
 const cfg={gestores:{gestao:['Produção']}},b=app(f(),{config:cfg});const formacao=f(undefined,{liberacao:{pessoas:[],setores:[],cargos:['c1']}});await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'scope-reduce'},{papel:'gestor',sub:'gestao'});await atividade(b,'leitura');cfg.gestores.gestao=['Financeiro'];const p=await cmd(b,'painel');assert.equal(p.body.aprendizagem[0].pontos,10);assert.equal(p.body.formacoes[0].liberada,false);assert.equal((await atividade(b,'leitura')).status,403);
});
test('admin conserva limite de cargos ao editar e pode ampliá-lo somente explicitamente',async()=>{
 const b=app(f(undefined,{liberacao:{cargos:['c1'],pessoas:[],setores:[],cargosGestor:'gestao',cargosSetores:['Produção']}}),{config:{gestores:{gestao:['Produção']}}});const formacao=f(undefined,{liberacao:{cargos:['c1'],pessoas:[],setores:[]}});let r=await cmd(b,'salvarFormacao',{formacao,expectedRevision:1,mutationId:'keep-scope'},{papel:'admin'});assert.equal(r.status,200);assert.equal(r.body.registro.liberacao.cargosGestor,'gestao');r=await cmd(b,'salvarFormacao',{formacao,expectedRevision:r.body.revision,mutationId:'remove-scope',removerLimitacaoCargos:true},{papel:'admin'});assert.equal(r.status,200);assert.equal(r.body.registro.liberacao.cargosGestor,undefined);
});
test('replay de salvarFormacao por outro editor autorizado não produz falso sucesso',async()=>{
 const b=app(),formacao=f();formacao.versao='2';const args={formacao,expectedRevision:1,mutationId:'author-command'};assert.equal((await cmd(b,'salvarFormacao',args,{papel:'admin',sub:'admin1'})).status,200);assert.equal((await cmd(b,'salvarFormacao',args,{papel:'admin',sub:'admin2'})).status,409);
});
test('pendências de atribuição usam lista RH autorizada calculada no servidor também para admin',async()=>{
 const b=app(f(undefined,{liberacao:{pessoas:[],cargos:['c1'],setores:[],cargosGestor:'gestao',cargosSetores:['Produção']}}),{config:{gestores:{gestao:['Produção']}}});const r=await cmd(b,'painel',{}, {sub:'admin',papel:'admin'});assert.deepEqual(r.body.formacoes[0].pessoasLiberadas,['rh1']);assert.deepEqual(r.body.formacoes[0].liberacao.cargosSetoresEfetivos,['Produção']);const e=await cmd(b,'painel');assert.equal(e.body.formacoes[0].pessoasLiberadas,undefined);
});
