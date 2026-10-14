import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { Element, telaEscola, esperar } from './escola-tela-harness.mjs';
import { backend, jwtAluno } from './helpers.mjs';

// Tela da entrada do aluno: as duas portas, a sessão do aluno (destinos, conta,
// Sair, rotas, boot), o cache do aparelho e o cartão "Entrada do aluno" da
// administração. IDs, nomes e conteúdos são fictícios.
const ler=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const appFonte=ler('app.js');
const sessaoAluno={usuario:'aluno:rh1',nome:'Ana',papel:'aluno',origemLogin:'aluno',colaboradorId:'rh1',validoAte:'2099-01-01T00:00:00.000Z',identidadeConferida:true,pessoaRH:{id:'p-rh1',colaboradorId:'rh1',nome:'Ana Exemplo Fictícia'}};

function telaApp({sessao=null,auth={},store={},educacao={},confirmar=()=>true,resumo={status:'ok',pendentes:0,naoGravados:0},rota={nome:'inicio',arg:''}}={}){
 const app=new Element('main',{id:'app'}),chamadas=[],toasts=[],confirmacoes=[];let user=sessao?structuredClone(sessao):null;
 const STORE={getUser:()=>user,setUser:u=>{chamadas.push(['setUser',u&&structuredClone(u)]);user=u?structuredClone(u):null;return true;},resumoSync:()=>resumo,on(){},col:()=>[],um:()=>null,getCFG:()=>({setores:['Produção']}),lastSync:()=>null,getConhecimento:()=>({}),
  api:async acao=>{chamadas.push(['api',acao]);return {ok:true,vinculada:true,pessoa:{id:'p-rh1',colaboradorId:'rh1',nome:'Ana Exemplo Fictícia'}};},trySync:()=>chamadas.push(['trySync']),pull:async()=>{chamadas.push(['pull']);},
  limparOutrosAlunos:u=>chamadas.push(['limparOutrosAlunos',structuredClone(u)]),descartarConta:u=>chamadas.push(['descartarConta',u&&u.usuario]),...store};
 const AUTH={temCracha:()=>true,cracha:()=>'cracha-ficticio',esquecer:()=>chamadas.push(['esquecer']),eu:async()=>{chamadas.push(['eu']);return null;},
  entrarAluno:async(id,nome)=>{chamadas.push(['entrarAluno',id,nome]);return {usuario:'aluno:rh1',nome:'Ana',papel:'aluno',colaboradorId:'rh1',validoAte:'2099-01-01T00:00:00.000Z',origemLogin:'aluno'};},...auth};
 const documento={title:'',querySelector:s=>s==='#app'?app:app.querySelector(s),querySelectorAll:s=>app.querySelectorAll(s),addEventListener(){},createElement:t=>new Element(t),visibilityState:'visible'};
 const ctx=vm.createContext({STORE,AUTH,document:documento,location:{hash:'#/',href:'https://exemplo.test/pops/',origin:'https://exemplo.test',pathname:'/pops/'},URL,Date,crypto:webcrypto,console,navigator:{},setInterval(){},setTimeout,clearTimeout,
  confirm:m=>{confirmacoes.push(m);return confirmar(m);},__toasts:toasts,__renders:0,
  window:{EDUCACAO:{estadoGestao:()=>({podeGerir:true,podeValidar:true}),estadoEnvio:()=>({}),limparCacheAparelho:()=>chamadas.push(['limparCacheAparelho']),descartarEnvio:()=>chamadas.push(['descartarEnvio']),...educacao},addEventListener(){},ESCOLA_TELA_VERSAO:'teste-aluno'}});
 vm.runInContext(appFonte.split("window.addEventListener('hashchange'")[0],ctx);
 vm.runInContext('toast=(m,t)=>__toasts.push([m,t]);',ctx);
 ctx.__rota=rota;vm.runInContext('ROTA=__rota',ctx);
 const rodar=codigo=>vm.runInContext(codigo,ctx);
 return {app,ctx,chamadas,toasts,confirmacoes,rodar,user:()=>user,sessao:()=>rodar('SESSAO'),
  submit:async s=>{await app.querySelector(s).onsubmit({preventDefault(){}});await esperar();},click:async s=>{await app.querySelector(s).onclick({preventDefault(){}});await esperar();}};
}

test('entrada abre na porta do aluno: ID do RH com teclado numérico e primeiro nome; administração na outra porta',()=>{
 const t=telaApp();t.rodar('renderLogin(document.querySelector("#app"))');
 const abas=t.app.querySelectorAll('[role=tab]');
 assert.deepEqual(abas.map(a=>[a.textContent,a.attributes['aria-selected']]),[['Sou aluno','true'],['Administração','false']]);
 assert.equal(t.app.querySelector('#lg-painel-aluno').hidden,false);assert.equal(t.app.querySelector('#lg-painel-adm').hidden,true);
 const id=t.app.querySelector('#lg-id');
 assert.equal(id.attributes.inputmode,'numeric');assert.equal(id.attributes.maxlength,'6');
 assert.match(t.app.querySelector('#lg-painel-aluno').textContent,/ID do RH \(6 números\).*O ID está no seu cadastro do RH\..*Primeiro nome/);
 assert.equal(t.app.querySelector('#lg-aluno').querySelectorAll('input').some(i=>i.attributes.type==='password'),false,'aluno não tem senha');
 // A porta da administração continua com usuário e senha da Central.
 t.app.querySelector('#lg-porta-adm').onclick();
 assert.equal(t.app.querySelector('#lg-painel-adm').hidden,false);assert.equal(t.app.querySelector('#lg-painel-aluno').hidden,true);
 assert.equal(t.app.querySelector('#lg-porta-adm').attributes['aria-selected'],'true');
 assert.ok(t.app.querySelector('#lg-s'));assert.equal(t.app.querySelector('#lg-s').attributes.type,'password');
 assert.doesNotMatch(t.app.textContent,/—/,'sem travessão');
});

test('ID ou nome fora do formato param na tela, sem chamar o servidor',async()=>{
 const t=telaApp();t.rodar('renderLogin(document.querySelector("#app"))');
 for(const [id,nome,msg] of [['12345','ana',/6 números/],['','ana',/6 números/],['100001','',/primeiro nome/],['100001','Ana Exemplo',/só o primeiro nome/]]){
  t.app.querySelector('#lg-id').value=id;t.app.querySelector('#lg-nome').value=nome;await t.submit('#lg-aluno');
  assert.match(t.app.querySelector('#lg-aluno-erro').textContent,msg,id+'/'+nome);
 }
 // O campo do ID aceita só números, até 6.
 const campo=t.app.querySelector('#lg-id');campo.value='10a0-0019';campo.oninput({target:campo});assert.equal(campo.value,'100001');
 assert.equal(t.chamadas.some(c=>c[0]==='entrarAluno'),false);
});

test('aluno entra: limpa o que era de outra pessoa no aparelho, guarda a sessão de aluno e confere a identidade',async()=>{
 const t=telaApp();t.rodar('renderLogin(document.querySelector("#app"))');
 t.app.querySelector('#lg-id').value='100001';t.app.querySelector('#lg-nome').value='ana';await t.submit('#lg-aluno');
 const nomes=t.chamadas.map(c=>c[0]);
 assert.deepEqual(t.chamadas.find(c=>c[0]==='entrarAluno'),['entrarAluno','100001','ana']);
 assert.ok(nomes.indexOf('limparCacheAparelho')>nomes.indexOf('entrarAluno')&&nomes.indexOf('limparCacheAparelho')<nomes.indexOf('setUser'),'o cache da escola sai antes da sessão nova');
 assert.equal(t.chamadas.find(c=>c[0]==='limparOutrosAlunos')[1].usuario,'aluno:rh1');
 const u=t.user();assert.equal(u.papel,'aluno');assert.equal(u.origemLogin,'aluno');assert.equal(u.colaboradorId,'rh1');assert.equal(u.pessoaRH.colaboradorId,'rh1');assert.equal(u.identidadeConferida,true);
 assert.ok(nomes.includes('pull'));assert.equal(t.ctx.location.hash,'#/');
});

test('recusa e muitas tentativas aparecem claras na porta do aluno',async()=>{
 for(const [erro,esperado] of [[Object.assign(new Error('ID ou nome não conferem.'),{status:401}),/ID ou nome não conferem\. Confira o ID no seu cadastro do RH e escreva só o primeiro nome\./],[Object.assign(new Error('Muitas tentativas. Tente de novo em 15 minutos.'),{status:429}),/^Muitas tentativas\. Tente de novo em 15 minutos\.$/]]){
  const t=telaApp({auth:{entrarAluno:async()=>{throw erro;}}});t.rodar('renderLogin(document.querySelector("#app"))');
  t.app.querySelector('#lg-id').value='100001';t.app.querySelector('#lg-nome').value='ana';await t.submit('#lg-aluno');
  assert.match(t.app.querySelector('#lg-aluno-erro').textContent,esperado);assert.equal(t.user(),null);
  assert.equal(t.app.querySelector('#lg-aluno-entrar').disabled,false,'botão volta a funcionar');
 }
});

test('aluno vê os quatro destinos, sem menu Escola e sem Referências da empresa',()=>{
 const t=telaApp({sessao:sessaoAluno});
 const topo=rota=>{t.ctx.__rota={nome:rota,arg:''};const el=new Element('div');el.innerHTML=t.rodar('ROTA=__rota;htmlTopo("x")');return el;};
 const el=topo('inicio');
 assert.deepEqual(el.querySelector('.nav-principal').children.filter(n=>n.tag==='a').map(a=>a.attributes.href),['#/','#/catalogo','#/pops','#/conhecimento']);
 assert.equal(el.querySelector('.nav-escola'),null,'mesmo que o painel dissesse podeGerir');
 const sub=topo('conhecimento').querySelector('.subnav').querySelectorAll('a').map(a=>a.attributes.href);
 assert.deepEqual(sub,['#/biblioteca','#/videos','#/nrs','#/conhecimento']);
 assert.equal(t.rodar('abasConhecimento(false)'),'');
});

test('rotas de gestão e as referências da empresa devolvem o aluno ao Início',()=>{
 for(const [nome,arg] of [['escola',''],['escola','entrada'],['formacao-editor','novo'],['matriz',''],['importar',''],['alunos',''],['aluno','rh2'],['pessoas',''],['mapa',''],['editor','pop~p1'],['material-editor','m1'],['perfil-editor','i1'],['senha',''],['avaliacoes','equipe']]){
  const t=telaApp({sessao:sessaoAluno});t.ctx.location.hash='#/'+nome+(arg?'/'+arg:'');
  vm.runInContext(appFonte.match(/function renderApp\(\) \{[\s\S]*?\n\}/)[0],t.ctx);t.rodar('renderApp()');
  assert.equal(t.ctx.location.hash,'#/',nome+' '+arg);
 }
 const t=telaApp({sessao:sessaoAluno,rota:{nome:'conhecimento',arg:'referencias'}});t.rodar('renderConhecimento(document.querySelector("#app"))');assert.equal(t.ctx.location.hash,'#/conhecimento');
});

test('Minha conta do aluno: sem senha nem Entrada Única; Sair leva crachá, cache, fila e envio do aparelho',async()=>{
 const t=telaApp({sessao:sessaoAluno,rota:{nome:'menu',arg:''}});t.rodar('renderMenu(document.querySelector("#app"))');
 assert.match(t.app.textContent,/aluno/);assert.match(t.app.textContent,/ID do RH/);assert.doesNotMatch(t.app.textContent,/Entrada Única|senha|Gestores por setor/i);
 await t.click('#bt-sair');
 const nomes=t.chamadas.map(c=>c[0]);
 for(const n of ['descartarEnvio','descartarConta','limparCacheAparelho','esquecer'])assert.ok(nomes.includes(n),n);
 assert.equal(t.chamadas.find(c=>c[0]==='descartarConta')[1],'aluno:rh1');assert.equal(t.user(),null);assert.equal(t.sessao(),null);
});

test('Sair com registro do aluno ainda não enviado pergunta antes; sem confirmar, nada sai',async()=>{
 const t=telaApp({sessao:sessaoAluno,rota:{nome:'menu',arg:''},resumo:{status:'pendente',pendentes:2,naoGravados:0},confirmar:()=>false});
 t.rodar('renderMenu(document.querySelector("#app"))');await t.click('#bt-sair');
 assert.match(t.confirmacoes[0],/2 registros seus ainda não enviados/);
 assert.equal(t.chamadas.some(c=>['descartarConta','esquecer','limparCacheAparelho'].includes(c[0])),false);assert.equal(t.user().papel,'aluno');
});

test('Sair da administração continua como antes: o cache da conta da Central fica no aparelho',async()=>{
 const t=telaApp({sessao:{usuario:'gestao',nome:'Gestão',papel:'admin',origemLogin:'rh'},rota:{nome:'menu',arg:''},resumo:{status:'pendente',pendentes:3,naoGravados:0}});
 t.rodar('renderMenu(document.querySelector("#app"))');await t.click('#bt-sair');
 assert.equal(t.confirmacoes.length,0);assert.equal(t.chamadas.some(c=>c[0]==='descartarConta'),false);assert.ok(t.chamadas.some(c=>c[0]==='esquecer'));
});

// Boot: o crachá do aluno não é da Entrada Única (equipe-auth); quem confere é o pops-sync.
const boot=appFonte.split('(function boot() {')[1];
async function iniciar({sessao,cracha='cracha-aluno',identidade=async()=>{}}={}){
 let user=sessao,cred=cracha;const ev={eu:0,pulls:0,identidade:0,limpou:0,toasts:[]};
 const ctx=vm.createContext({SESSAO:sessao,ROTA:{nome:''},toast:(m)=>ev.toasts.push(m),window:{EDUCACAO:{limparCacheAparelho:()=>{ev.limpou++;}}},
  AUTH:{temCracha:()=>!!cred,cracha:()=>cred,esquecer:()=>{cred='';},eu:async()=>{ev.eu++;return null;}},
  STORE:{setUser:u=>{user=u;return true;},getUser:()=>user,trySync:()=>{},pull:async()=>{ev.pulls++;}},navigator:{},document:{addEventListener(){}},renderApp(){},
  atualizarIdentidadeRH:async()=>{ev.identidade++;await identidade();},setInterval(){},ROTAS_DE_EDICAO:['matriz','catalogo']});
 vm.runInContext('(function boot() {'+boot,ctx);await esperar();
 return {ev,user:()=>user,cred:()=>cred};
}
test('boot do aluno confere pelo pops-sync, nunca pela Entrada Única',async()=>{
 const h=await iniciar({sessao:sessaoAluno});
 assert.equal(h.ev.eu,0);assert.equal(h.ev.identidade,1);assert.equal(h.ev.pulls,1);assert.equal(h.user().papel,'aluno');
});
test('entrada de aluno vencida no aparelho sai sem abrir dados e avisa',async()=>{
 const h=await iniciar({sessao:{...sessaoAluno,validoAte:'2020-01-01T00:00:00.000Z'}});
 assert.equal(h.user(),null);assert.equal(h.cred(),'');assert.equal(h.ev.pulls,0);assert.equal(h.ev.eu,0);assert.equal(h.ev.limpou,1);
 assert.match(h.ev.toasts[0],/Sua entrada de aluno terminou/);
 const sem=await iniciar({sessao:sessaoAluno,cracha:''});assert.equal(sem.user(),null);assert.equal(sem.ev.pulls,0);
});

// STORE: cache próprio do aluno, Sair apaga só o dele, entrada nova apaga o de outros alunos.
function storeReal(inicial={}){
 const mapa=new Map(Object.entries(inicial).map(([k,v])=>[k,JSON.stringify(v)])),chamadas=[];
 const localStorage={getItem:k=>mapa.get(k)??null,setItem:(k,v)=>mapa.set(k,String(v)),removeItem:k=>mapa.delete(k),key:i=>[...mapa.keys()][i]??null,get length(){return mapa.size;}};
 const ctx=vm.createContext({console,crypto:webcrypto,AbortController,navigator:{onLine:true},AUTH:{cracha:()=>'cracha'},localStorage,setTimeout:()=>1,clearTimeout(){},
  window:{API_BASE:'http://local.test',API_FN:{sync:'sync'},CONHECIMENTO_VERSAO:'2026.10.05',addEventListener(){}},
  fetch:async(url,opts)=>{const b=JSON.parse(opts.body);chamadas.push(b.action);return {ok:true,status:200,json:async()=>b.action==='rev'?{rev:{porColecao:{}}}:b.action==='getCfg'?{config:{}}:b.action==='list'?{itens:[]}:{ok:true}};}});
 vm.runInContext(ler('store.js')+'\nglobalThis.store = STORE;',ctx);
 return {store:ctx.store,mapa,chamadas};
}
test('aluno tem cache próprio; Sair apaga só o dele; a entrada de outro aluno apaga os anteriores e mais nada',async()=>{
 const vazio={dados:{},cfg:{},fila:[],rev:{porColecao:{}},syncEm:null};
 const h=storeReal({'pops_v3_ana_equipe':vazio,'pops_v4_gestao_gestor':vazio,'painel_cache':{x:1},'pops_v3_aluno%3Arh2_aluno':vazio,'pops_v3_aluno%3Arh2_aluno_rh_rh2':vazio,'pops_v3_aluno%3Arh10_aluno':vazio});
 const aluno={usuario:'aluno:rh1',nome:'Ana',papel:'aluno',identidadeConferida:true,pessoaRH:{colaboradorId:'rh1'}};
 assert.equal(h.store.setUser(aluno),true);h.store.salvar('leituras',{id:'l-aluno:rh1-p1',usuario:'aluno:rh1'});
 assert.ok(h.mapa.has('pops_v3_aluno%3Arh1_aluno_rh_rh1'),'chave própria do aluno');
 assert.equal(h.store.limparOutrosAlunos(aluno),3);
 assert.deepEqual([...h.mapa.keys()].filter(k=>k.startsWith('pops_v3_aluno')).sort(),['pops_v3_aluno%3Arh1_aluno_rh_rh1']);
 for(const k of ['pops_v3_ana_equipe','pops_v4_gestao_gestor','painel_cache'])assert.ok(h.mapa.has(k),k+' fica');
 assert.equal(h.store.descartarConta(aluno),true);assert.equal([...h.mapa.keys()].some(k=>k.startsWith('pops_v3_aluno')),false);
 assert.equal(h.store.descartarConta({usuario:'ana',papel:'equipe'}),false,'conta da Central não é descartada');assert.ok(h.mapa.has('pops_v3_ana_equipe'));
});
test('a atualização do aluno não pede a base de referências da empresa',async()=>{
 const h=storeReal();h.store.setUser({usuario:'aluno:rh1',nome:'Ana',papel:'aluno'});
 assert.equal(await h.store.pull(),true);assert.equal(h.chamadas.includes('conhecimento'),false);assert.ok(h.chamadas.includes('list'));
 const e=storeReal();e.store.setUser({usuario:'ana',nome:'Ana',papel:'equipe'});await e.store.pull();assert.ok(e.chamadas.includes('conhecimento'),'a equipe continua pedindo');
});

// auth.js: o crachá só fica guardado com resposta completa do servidor.
function auth(resposta,{status=200,falharRede=false}={}){
 const mem=new Map(),pedidos=[];
 const ctx=vm.createContext({window:{API_BASE:'http://local.test',API_FN:{sync:'pops-sync'}},localStorage:{getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)},AbortController,setTimeout,clearTimeout,
  fetch:async(url,opts)=>{pedidos.push({url,body:JSON.parse(opts.body),headers:opts.headers});if(falharRede)throw new TypeError('rede');return {ok:status<400,status,json:async()=>resposta};}});
 vm.runInContext(ler('auth.js')+'\nglobalThis.auth = AUTH;',ctx);return {a:ctx.auth,pedidos};
}
test('entrarAluno manda só ID e nome ao pops-sync, sem crachá, e guarda o crachá do aluno',async()=>{
 const token=jwtAluno();
 const {a,pedidos}=auth({ok:true,token,usuario:'aluno:rh1',nome:'Ana',papel:'aluno',colaboradorId:'rh1',validoAte:'2099-01-01T00:00:00.000Z'});
 const r=await a.entrarAluno('100001','ana');
 assert.equal(pedidos[0].url,'http://local.test/pops-sync');assert.deepEqual(pedidos[0].body,{action:'entrarAluno',id:'100001',nome:'ana'});assert.equal(pedidos[0].headers.Authorization,undefined);
 assert.equal(a.cracha(),token);assert.equal(r.papel,'aluno');assert.equal(r.origemLogin,'aluno');assert.equal(r.colaboradorId,'rh1');
});
test('entrarAluno recusado, bloqueado, sem rede ou incompleto não guarda crachá',async()=>{
 for(const [resposta,opcoes,msg] of [[{erro:'ID ou nome não conferem.'},{status:401},/^ID ou nome não conferem\.$/],[{erro:'x'},{status:429},/^Muitas tentativas\. Tente de novo em 15 minutos\.$/],[null,{falharRede:true},/Sem conexão/],[{ok:true,token:'a.b.c',papel:'admin',usuario:'gestao'},{},/incompleta/],[{ok:true,usuario:'aluno:rh1',papel:'aluno',colaboradorId:'rh1'},{},/incompleta/]]){
  const {a}=auth(resposta,opcoes);await assert.rejects(a.entrarAluno('100001','ana'),{message:msg});assert.equal(a.temCracha(),false);
 }
});

// Escola: o cartão "Entrada do aluno" (administração) e a escola do aluno pelo servidor real.
const conteudo={aprender:'A',importancia:'B',comoFazer:'C',erros:'D',evidencia:'E'};
const curso={id:'f1',titulo:'Curso fictício do aluno',versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},etapas:[{id:'e1',titulo:'Aula fictícia',tipo:'cultura',obrigatoria:true,prerequisitos:[],pontos:10,conteudo,quiz:[],minimoAcerto:70,maxTentativas:2,fontes:[],documentos:[]}]};
const row=(colecao,registro)=>({colecao,id:registro.id,registro,revision:1,apagado:false});
const tabelas=()=>({registros:[row('colaboradores',{id:'rh1',nome:'Ana Exemplo Fictícia',idPessoa:'100001',setor:'Produção'}),row('colaboradores',{id:'rh9',nome:'Gestão Fictícia',setor:'Produção'})],acesso_conta:[{id:'acc9',usuario:'gestao',ativo:true,colaborador_id:'rh9'}],acesso_papel:[{conta_id:'acc9',sistema:'pops',login:'gestao',ativo:true,papel:'admin'}]});

test('cartão Entrada do aluno: ligada por padrão, explica o alcance, desliga e muda a validade pelo servidor',async()=>{
 const cfg={educacao:{instrutores:{}}};
 const b=backend({tables:tabelas(),config:cfg,persistWrites:true,rows:[row('formacoes',curso)],rpcs:{pops_configurar:async a=>{Object.assign(cfg,structuredClone(a.p_patch));return {data:{ok:true,config:cfg},error:null};}}});
 const t=telaEscola({backend:b,sessao:{usuario:'gestao',nome:'Gestão Fictícia',papel:'admin',pessoaRH:{colaboradorId:'rh9'}}});
 await t.route('escola','entrada');
 const cartao=t.node('#edu-entrada-aluno');assert.ok(cartao,'cartão na Gestão de cursos');
 assert.match(cartao.textContent,/Entrada do aluno.*Ligada/);// (O DOM dos testes junta o texto solto antes do texto das marcas: confere por partes.)
 for(const trecho of [/Quem entra:/,/qualquer pessoa ativa no RH, com o ID do RH \(6 números\) e o primeiro nome, sem senha/,/O que alcança:/,/os próprios cursos, provas, histórico e perfil/,/Não alcança gestão/])assert.match(cartao.textContent,trecho);assert.match(cartao.textContent,/Administração, gestão e instrutores continuam entrando com usuário e senha/);
 assert.equal(t.node('#edu-entrada-validade').value,'7');assert.match(t.node('#edu-entrada-alternar').textContent,/Desligar/);
 assert.doesNotMatch(cartao.textContent,/—|jornada/i);
 await t.click('#edu-entrada-alternar');
 const envio=t.calls.find(c=>c.operacao==='configurarEntradaAluno');
 assert.equal(envio.ativa,false);assert.equal(envio.validadeDias,7);assert.deepEqual(envio.entradaAnterior,{ativa:true,validadeDias:7});
 assert.equal(cfg.educacao.entradaAluno.ativa,false);assert.deepEqual(cfg.educacao.instrutores,{},'o resto da escola fica');
 assert.match(t.node('#edu-entrada-aluno').textContent,/Desligada/);assert.match(t.node('#edu-entrada-alternar').textContent,/Ligar/);
 // Validade nova, mantendo desligada.
 t.node('#edu-entrada-validade').value='15';await t.submit('#edu-entrada-aluno-form');
 assert.equal(cfg.educacao.entradaAluno.validadeDias,15);assert.equal(cfg.educacao.entradaAluno.ativa,false);
});

test('escola do aluno pelo servidor real: o curso dele e nenhuma gestão',async()=>{
 const b=backend({tables:tabelas(),persistWrites:true,rows:[row('formacoes',curso)]});
 const token=jwtAluno();
 const t=telaEscola({sessao:sessaoAluno,api:async(payload,acao)=>{const r=await b.call({action:acao,...payload},{}, {token});if(r.status>=400)throw Object.assign(new Error(r.body.erro),{status:r.status});return r.body;}});
 await t.route('inicio');
 assert.match(t.text(),/Curso fictício do aluno/);assert.doesNotMatch(t.text(),/Gestão de cursos/);
 await t.route('escola');assert.match(t.text(),/Área restrita/);
 assert.equal(t.node('#edu-entrada-aluno'),null);
});

test('estilos: portas da entrada com alvos de 44 px; no celular a entrada vem primeiro; arquivos novos no shell',()=>{
 const css=ler('styles.css');
 assert.match(css,/\.login-portas button \{ min-height: 44px;/);assert.match(css,/\.entrada-aluno \.botao \{ min-height: 44px; \}/);
 const celular=[...css.matchAll(/@media \(max-width: 600px\) \{([\s\S]*?)\n\}/g)].map(m=>m[1]).join('\n');
 assert.match(celular,/\.login-layout \.cartao-login \{ order: -1; \}/);
 assert.match(ler('sw.js'),/const CACHE = 'pops-shell-v18-aluno';/);assert.match(ler('config.js'),/window\.ESCOLA_TELA_VERSAO = '2026\.10\.14-aluno';/);
});
