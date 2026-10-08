import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { backend } from './helpers.mjs';

// Real school renderer and handlers; lightweight DOM replaces only the browser.
// Backend-backed cases exercise the client/server payload contract end to end.
const plain=x=>JSON.parse(JSON.stringify(x));
const decode=s=>String(s??'').replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
class Element {
  constructor(tag='div',attrs={}){this.tag=tag;this.attributes=attrs;this.children=[];this.dataset={};this.style={};this._html='';this._text='';this.value=decode(attrs.value||'');this.type=attrs.type||'';this.checked=Object.hasOwn(attrs,'checked');this.disabled=Object.hasOwn(attrs,'disabled');this.selected=Object.hasOwn(attrs,'selected');this.isConnected=true;for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=decode(v);}
  set innerHTML(s){this._html=String(s);for(const n of this.descendants())n.isConnected=false;this.children=[];this._text='';const stack=[this];for(const token of this._html.match(/<[^>]*>|[^<]+/g)||[]){if(token.startsWith('</')){const name=token.match(/^<\/([\w-]+)/)?.[1];while(stack.length>1){if(stack.pop().tag===name)break;}continue;}if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attrs={};for(const m of token.slice(tag.length+1,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[m[1]]=m[2]??m[3]??m[4]??'';const n=new Element(tag,attrs);stack.at(-1).children.push(n);if(!['input','img','br','hr','meta','link'].includes(tag))stack.push(n);}else stack.at(-1)._text+=decode(token);}for(const n of this.descendants()){if(n.tag==='textarea')n.value=n.textContent;if(n.tag==='select'){const opts=n.children.filter(c=>c.tag==='option'),sel=opts.find(c=>c.selected)||opts[0];n.value=sel?.value||sel?.textContent||'';}}}
  get id(){return this.attributes.id||'';} set id(v){this.attributes.id=v;}
  get className(){return this.attributes.class||'';} set className(v){this.attributes.class=v;}
  prepend(n){this.children.unshift(n);}
  get innerHTML(){return this._html;}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set textContent(s){this._text=String(s);this.children=[];}
  get selectedOptions(){return this.children.filter(n=>n.tag==='option'&&n.selected);}
  descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
  querySelectorAll(selector){return this.descendants().filter(n=>selector.split(',').some(s=>{s=s.trim();if(s.startsWith('#'))return n.attributes.id===s.slice(1);if(s.startsWith('.'))return (n.attributes.class||'').split(/\s+/).includes(s.slice(1));const a=s.match(/^(\w+)?\[([^=\]]+)(?:=(?:"([^"]*)"|([^\]]*)))?\]$/);if(a){const value=a[3]??a[4];return (!a[1]||n.tag===a[1])&&Object.hasOwn(n.attributes,a[2])&&(value===undefined||n.attributes[a[2]]===value);}return n.tag===s;}));}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  insertAdjacentHTML(_position,html){if(html)this.innerHTML+=html;}
  setAttribute(k,v){this.attributes[k]=v;} focus(){} scrollIntoView(){} addEventListener(){} remove(){this.isConnected=false;}
}
const contents={aprender:'Aprender o procedimento',importancia:'Fazer bem o trabalho',comoFazer:'Seguir orientação',erros:'Evitar improviso',evidencia:'Responder e demonstrar'};
const makeStage=(extra={})=>({id:'e1',titulo:'Etapa inicial',tipo:'cultura',obrigatoria:true,prerequisitos:[],pontos:10,conteudo:{...contents},aprovacao:{por:'gestao',em:'2026-10-08T12:00:00Z',versao:'1'},quiz:[],minimoAcerto:70,maxTentativas:2,fontes:[],documentos:[],...extra});
const formation=(etapas=[makeStage()],extra={})=>({id:'f1',titulo:'Jornada de teste',versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},etapas,...extra});
const question={id:'q1',pergunta:'Como agir?',opcoes:['Conferir','Improvisar'],correta:0,explicacao:'Conferir evita o erro.',revisar:'Passo de conferência'};
const row=(colecao,registro,revision=1)=>({colecao,id:registro.id,registro,revision,apagado:false});
const tables={acesso_conta:[{id:'conta1',usuario:'ana',ativo:true,colaborador_id:'rh1'},{id:'conta2',usuario:'bruno',ativo:true,colaborador_id:'rh2'}],acesso_papel:[{conta_id:'conta1',sistema:'pops',login:'ana',ativo:true,papel:'equipe'},{conta_id:'conta2',sistema:'pops',login:'bruno',ativo:true,papel:'equipe'}],registros:[row('colaboradores',{id:'rh1',nome:'Ana RH',setor:'Produção',cargoId:'c1'}),row('cargos',{id:'c1',nome:'Montadora'}),row('colaboradores',{id:'rh2',nome:'Bruno RH',setor:'Produção'})]};
function backendApp(f,rows=[],config={}){return backend({tables,persistWrites:true,config,rows:[row('formacoes',f),...rows]});}
function snapshot(formacoes=[formation()],extra={}){return {ok:true,pessoa:{colaboradorId:'rh1',nome:'Ana RH',funcao:'Montadora'},formacoes,aprendizagem:[],gestao:{podeGerir:false,podeValidar:false,pessoas:[],registros:[]},...extra};}
function harness({data=snapshot(),api,backend:b,papel='equipe',storage=new Map()}={}){
 const app=new Element('main',{id:'app'}),calls=[],toasts=[];
 const sessao={usuario:'ana',nome:'Ana RH',papel,pessoaRH:{colaboradorId:'rh1'}};
 const node=(s,root=app)=>s==='#app'?app:root.querySelector(s);
 const sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const ctx=vm.createContext({sessionStorage,document:{createElement:t=>new Element(t),getElementById:id=>node('#'+id)},window:{sessionStorage,addEventListener(){}},SESSAO:sessao,ROTA:{nome:'inicio',arg:''},location:{hash:'#/'},crypto:webcrypto,console,
  STORE:{um:()=>null,col:()=>[],api:async(action,payload)=>{calls.push(plain(payload));if(api)return api(payload);if(b){const r=await b.call({action,...payload},{sub:sessao.usuario,papel:sessao.papel});if(r.status>=400)throw Object.assign(new Error(r.body.erro),{status:r.status});return r.body;}return structuredClone(data);}},
  esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),norm:s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),uuid:()=>webcrypto.randomUUID(),
  htmlTopo:()=>'',ligarTopo(){},toast:(m,t)=>toasts.push({m,t}),fmtDataHora:s=>s?'DATA '+s:'DATA AUSENTE',setores:()=>['Produção'],souAdmin:()=>sessao.papel==='admin',associarRotulos(){},confirm:()=>true,
  abrirModal:html=>{const dlg=new Element('dialog');dlg.innerHTML=html;app.children.push(dlg);dlg.remove=()=>{app.children=app.children.filter(n=>n!==dlg);dlg.isConnected=false;};return dlg;},
  $:node,$$:(s,root=app)=>root.querySelectorAll(s),
  FormData:class{constructor(form){this.form=form;}has(k){return this.get(k)!==null;}get(k){const n=this.form.descendants().find(x=>x.attributes.name===k&&(x.type!=='radio'||x.checked));return n?.value??null;}},
 });
 vm.runInContext(fs.readFileSync(new URL('../treinamentos.js',import.meta.url),'utf8'),ctx);
 vm.runInContext(fs.readFileSync(new URL('../educacao.js',import.meta.url),'utf8'),ctx);
 const route=async(nome='inicio',arg='')=>{ctx.ROTA={nome,arg};ctx.location.hash='#/'+nome+(arg?'/'+arg:'');await ctx.window.EDUCACAO.render(app);};
 const click=async s=>{const n=node(s);assert.equal(typeof n?.onclick,'function','Ação ausente '+s);await n.onclick({preventDefault(){},target:n});};
 const submit=async s=>{const n=node(s);assert.equal(typeof n?.onsubmit,'function','Formulário ausente '+s);await n.onsubmit({preventDefault(){},target:n});};
 return {app,node,route,click,submit,calls,toasts,storage,ctx,edu:ctx.window.EDUCACAO,get html(){return app.innerHTML;},text:()=>app.textContent};
}

test('entrada pessoal prioriza próximo passo e escapa textos do catálogo',async()=>{
 const f=formation([makeStage({titulo:'Conferir <script>alert(1)</script>'})]);const h=harness({data:snapshot([f])});await h.route();
 assert.match(h.text(),/SEU PRÓXIMO PASSO/);assert.match(h.html,/Continuar de onde parei/);assert.match(h.html,/&lt;script&gt;/);assert.doesNotMatch(h.html,/<script>|Procedimentos disponíveis|POPs para revisar/);
});
test('etapa bloqueada explica o pré-requisito e não oferece registro nem avaliação',async()=>{
 const e=makeStage({tipo:'avaliacao',quiz:[question],prerequisitos:['anterior'],motivoBloqueio:'Conclua antes a integração'});const h=harness({data:snapshot([formation([e])])});await h.route('formacao','f1~e1');
 assert.match(h.text(),/Conclua antes a integração/);assert.equal(h.node('[data-evento]'),null);assert.equal(h.node('#edu-quiz'),null);
});
test('vínculo RH ausente orienta liberação sem criar cadastro por número',async()=>{
 const h=harness({data:snapshot([],{pessoa:null})});await h.route();assert.match(h.text(),/Vínculo com o RH pendente/);assert.equal(h.calls.length,1);assert.equal(h.calls[0].operacao,'painel');assert.doesNotMatch(h.html,/id=".*rh.*"/);
});
test('ciência enviada pelo botão contém aceite explícito e versão estudada',async()=>{
 const f=formation([makeStage({tipo:'etica',quiz:[question],fontes:[{tipo:'treinamento',refId:'t1',versao:'1',oficialConfirmado:true,conferidoPor:'gestao',conferidoEm:'2026-10-01T12:00:00Z'}]})]);const b=backendApp(f,[row('treinamentos',{id:'t1',versao:'1'})]);const h=harness({backend:b});await h.route('formacao','f1~e1');h.node('#edu-ciencia').checked=true;await h.click('[data-evento="ciencia"]');
 const sent=h.calls.find(c=>c.evento==='ciencia');assert.equal(sent.aceite,true);assert.equal(sent.formacaoVersao,'1');assert.ok(b.writes.some(w=>w.args?.p_registro?.etapas.e1?.cienciaEm));assert.match(h.text(),/Ciência registrada/);
});
test('revisão de fonte ou formação não mantém progresso antigo como concluído',async()=>{
 const f=formation([makeStage({status:'revisar',statusFonte:'pendente',motivoBloqueio:'Fonte mudou'})],{versao:'2',revisaoNecessaria:true,progresso:{concluidas:0,total:1,percentual:0,etapaAtual:'e1'}});
 const h=harness({data:snapshot([f],{aprendizagem:[{formacaoId:'f1',formacaoVersao:'1',etapas:{e1:{status:'concluida'}},pontos:10}]})});await h.route('formacao','f1');assert.match(h.text(),/Revisão necessária/);assert.doesNotMatch(h.text(),/100% concluído/);assert.match(h.text(),/0\/1 etapas/);
});
test('avaliação mostra nota e explicação retornada pelo servidor sem JSON cru',async()=>{
 const f=formation([makeStage({tipo:'avaliacao',quiz:[question]})]);const b=backendApp(f);const h=harness({backend:b});await h.route('formacao','f1~e1');await h.click('[data-evento="leitura"]');const radio=h.node('[name="q1"]');radio.checked=true;await h.submit('#edu-quiz');
 assert.equal(h.calls.find(c=>c.evento==='responder').formacaoVersao,'1');const area=h.node('#edu-retorno');assert.match(area.textContent,/100/);assert.match(area.textContent,/Conferir evita o erro/);assert.doesNotMatch(h.html,/&quot;questoes&quot;|&quot;explicacao&quot;/);
});
test('falha de rede oferece reenvio na mesma tela sem fabricar confirmação',async()=>{
 let tentativa=0;const h=harness({api:async payload=>{if(payload.operacao==='painel')return snapshot();tentativa++;if(tentativa===1)throw new Error('Sem conexão');return {ok:true};}});await h.route('formacao','f1~e1');await h.click('[data-evento="leitura"]');
 assert.equal(h.toasts.some(x=>/confirmado pelo servidor/.test(x.m)),false);const retry=h.app.querySelectorAll('button').find(n=>n.textContent==='Conferir envio');assert.ok(retry,'Deve existir ação de retry imediatamente após falha');assert.equal(typeof retry.onclick,'function');await retry.onclick({preventDefault(){},target:retry});const enviados=h.calls.filter(c=>c.operacao==='registrar');assert.equal(enviados.length,2);assert.equal(enviados[0].mutationId,enviados[1].mutationId);
});
test('gravação confirmada seguida por falha de consulta não informa perda do registro',async()=>{
 let consultas=0;const h=harness({api:async payload=>{if(payload.operacao==='painel'){consultas++;if(consultas>1)throw new Error('Consulta temporariamente indisponível');return snapshot();}return {ok:true,registro:{formacaoId:'f1',formacaoVersao:'1',etapas:{e1:{status:'concluida',leituraEm:'2026-10-08T12:00:00Z'}},pontos:10}};}});await h.route('formacao','f1~e1');await h.click('[data-evento="leitura"]');
 assert.equal(h.toasts.some(t=>/Cannot read|properties of null|undefined/.test(t.m)),false,'Falha de refresh não é falha de gravação');assert.match(h.text(),/confirmad|atualiz|consulta|Consulta|Salvo/);
});
test('histórico de reciclagem exibe versão e data do contrato do servidor',async()=>{
 const h=harness({data:snapshot([formation()],{aprendizagem:[{formacaoId:'f1',pontos:10,conquistas:[],historico:[{formacaoVersao:'1.0',encerradaEm:'2026-10-08T12:30:00Z',motivo:'Nova versão da formação',etapas:{e1:{status:'concluida'}}}]}]})});await h.route('conquistas');assert.match(h.text(),/1\.0/);assert.match(h.text(),/2026-10-08T12:30:00Z/);assert.doesNotMatch(h.text(),/DATA AUSENTE/);
});
test('prática só pontua após responsável validar e preserva seu retorno para a pessoa',async()=>{
 const f=formation([makeStage({tipo:'pratica',checklist:['Conferir a execução'],validadores:['bruno']})]);
 const b=backendApp(f,[],{educacao:{instrutores:{bruno:['Produção']}}});const h=harness({backend:b});await h.route('formacao','f1~e1');await h.click('[data-evento="leitura"]');h.node('#edu-evidencia').value='Execução demonstrada com o responsável';h.node('[name="item-0"]').checked=true;await h.submit('#edu-pratica');
 assert.equal(h.calls.find(c=>c.evento==='enviarPratica').formacaoVersao,'1');assert.match(h.text(),/Aguardando validação/);let p=await b.call({action:'escola',operacao:'painel'});assert.equal(p.body.aprendizagem[0].pontos,0);
 const v=await b.call({action:'escola',operacao:'validar',colaboradorId:'rh1',formacaoId:'f1',formacaoVersao:'1',etapaId:'e1',aprovado:true,feedback:'Execução acompanhada e conferida',mutationId:'validacao-responsavel'},{sub:'bruno'});assert.equal(v.status,200);h.edu.zerar();await h.route('formacao','f1~e1');assert.match(h.text(),/Concluída/);assert.match(h.text(),/Execução acompanhada e conferida/);p=await b.call({action:'escola',operacao:'painel'});assert.equal(p.body.aprendizagem[0].pontos,10);assert.equal(h.node('#edu-pratica').querySelector('button').disabled,true);
});
test('colaborador sem gestão não consegue abrir editor de jornada',async()=>{
 const h=harness();await h.route('formacao-editor','novo');assert.equal(h.ctx.location.hash,'#/');assert.equal(h.node('#edu-editor'),null);
});
test('recarregar após resposta perdida recupera mesmo envio e não duplica pontos',async()=>{
 const b=backendApp(formation());const storage=new Map();let primeira=true;
 const api=async payload=>{const r=await b.call({action:'escola',...payload});if(r.status>=400)throw Object.assign(new Error(r.body.erro),{status:r.status});if(payload.operacao==='registrar'&&primeira){primeira=false;throw new Error('Resposta não chegou');}return r.body;};
 const h=harness({api,storage});await h.route('formacao','f1~e1');await h.click('[data-evento="leitura"]');const original=h.calls.find(x=>x.operacao==='registrar');assert.equal(storage.size,1);
 const nova=harness({api,storage});await nova.route('formacao','f1~e1');const retry=nova.app.querySelectorAll('button').find(n=>n.textContent==='Conferir envio');assert.ok(retry,'Recarregar mantém caminho para conferir a resposta perdida');await retry.onclick({preventDefault(){},target:retry});
 const reenvio=nova.calls.find(x=>x.operacao==='registrar');assert.deepEqual(reenvio,original);assert.equal(storage.size,0);const p=await b.call({action:'escola',operacao:'painel'});assert.equal(p.body.aprendizagem[0].pontos,10);assert.equal(p.body.aprendizagem[0].conquistas.length,1);
});
test('envio pendente fica isolado entre logins e IDs do RH no mesmo aparelho',async()=>{
 const storage=new Map();const api=async p=>{if(p.operacao==='painel')return snapshot();throw new Error('Sem conexão');};const ana=harness({storage,api});await ana.route('formacao','f1~e1');await ana.click('[data-evento="leitura"]');assert.equal(storage.size,1);
 const bruno=harness({storage,api});Object.assign(bruno.ctx.SESSAO,{usuario:'bruno',pessoaRH:{colaboradorId:'rh2'}});await bruno.route();assert.doesNotMatch(bruno.text(),/confirmação ainda não chegou|Conferir envio/);assert.equal(bruno.calls.filter(x=>x.operacao==='registrar').length,0);assert.equal(storage.size,1);
 const volta=harness({storage,api});await volta.route();assert.match(volta.text(),/Conferir envio/);
});
test('falta de espaço impede envio sem chave recuperável e permite tentar novamente',async()=>{
 const storage=new Map();storage.set=()=>{throw new Error('QuotaExceededError');};const h=harness({storage});await h.route('formacao','f1~e1');await h.click('[data-evento="leitura"]');
 assert.equal(h.calls.filter(x=>x.operacao==='registrar').length,0);assert.match(h.text(),/Nenhuma atividade foi enviada/);assert.equal(h.node('[data-evento="leitura"]').disabled,false);assert.equal(h.toasts.some(t=>/confirmado pelo servidor/.test(t.m)),false);
});
test('nova versão exige nova leitura e novas respostas sem herdar tentativa anterior',async()=>{
 const f=formation([makeStage({tipo:'avaliacao',quiz:[question],status:'revisar'})],{versao:'2',progresso:{concluidas:0,total:1,percentual:0}});
 const h=harness({data:snapshot([f],{aprendizagem:[{formacaoId:'f1',formacaoVersao:'1',etapas:{e1:{status:'concluida',leituraEm:'2026-10-01T12:00:00Z',concluidaEm:'2026-10-01T12:00:00Z',tentativas:[{nota:100},{nota:100}]}}}]})});await h.route('formacao','f1~e1');
 assert.match(h.text(),/Leitura não registrada/);assert.match(h.text(),/0 de 2 tentativas/);assert.equal(h.node('#edu-quiz').querySelector('button').disabled,true);assert.doesNotMatch(h.text(),/Critério concluído em/);
});
test('acompanhamento calcula progresso do aluno sem usar o progresso pessoal do gestor',async()=>{
 const f=formation([makeStage({status:'nao_iniciada'})],{liberada:false,progresso:{concluidas:0,total:1,percentual:0}});
 const registro={id:'ap-aluno',formacaoId:'f1',formacaoVersao:'1',nome:'Pessoa concluinte',colaboradorId:'rh2',etapas:{e1:{status:'concluida',concluidaEm:'2026-10-08T12:00:00Z'}}};
 const h=harness({papel:'gestor',data:snapshot([f],{gestao:{podeGerir:true,podeValidar:true,pessoas:[],registros:[registro]}})});await h.route('escola');assert.match(h.node('#edu-registros').textContent,/1\/1 etapas/);assert.match(h.node('#edu-registros').textContent,/Concluída/);
});
test('gestor vê catálogo de gestão sem contabilizar jornadas não atribuídas como pessoais',async()=>{
 const f=formation([makeStage()],{liberada:false});const h=harness({papel:'gestor',data:snapshot([f],{gestao:{podeGerir:true,podeValidar:true,pessoas:[],registros:[]}})});await h.route();const resumo=h.app.querySelectorAll('span').find(n=>n.textContent.includes('jornadas liberadas'));assert.equal(resumo.querySelector('strong').textContent,'0');assert.match(h.text(),/Nenhuma jornada liberada ainda/);assert.doesNotMatch(h.text(),/Etapa atual: Etapa inicial/);
});
test('responsável analisa prática na tela e servidor libera próximo passo do aluno',async()=>{
 const f=formation([makeStage({tipo:'pratica',checklist:['Conferir a execução'],validadores:['bruno']}),makeStage({id:'e2',titulo:'Educação contínua',tipo:'continua',prerequisitos:['e1']})]);const b=backendApp(f,[],{educacao:{instrutores:{bruno:['Produção']}}});
 const aluno=harness({backend:b});await aluno.route('formacao','f1~e1');await aluno.click('[data-evento="leitura"]');aluno.node('#edu-evidencia').value='Demonstração acompanhada';aluno.node('[name="item-0"]').checked=true;await aluno.submit('#edu-pratica');
 const responsavel=harness({backend:b});Object.assign(responsavel.ctx.SESSAO,{usuario:'bruno',nome:'Bruno RH',pessoaRH:{colaboradorId:'rh2'}});await responsavel.route('escola');assert.match(responsavel.node('#edu-validacoes').textContent,/Demonstração acompanhada/);await responsavel.click('[data-validar]');responsavel.node('#edu-validar-feedback').value='Prática realizada conforme orientação';responsavel.node('#edu-validar-resultado').value='aprovado';await responsavel.submit('#edu-validar-form');const enviado=responsavel.calls.find(x=>x.operacao==='validar');assert.equal(enviado.formacaoVersao,'1');assert.equal(enviado.colaboradorId,'rh1');assert.equal(enviado.aprovado,true);assert.match(responsavel.node('#edu-validacoes').textContent,/Nenhuma prática aguardando/);
 aluno.edu.zerar();await aluno.route();assert.match(aluno.node('.edu-proximo').textContent,/Educação contínua/);await aluno.route('formacao','f1~e2');assert.ok(aluno.node('[data-evento="leitura"]'),'Próxima etapa permite registrar aprendizado após validação');
});
test('acompanhamento sinaliza revisão necessária quando a jornada muda de versão',async()=>{
 const f=formation([makeStage({status:'nao_iniciada'})],{versao:'2',liberada:false});const registro={id:'ap-aluno',formacaoId:'f1',formacaoVersao:'1',nome:'Pessoa concluinte',colaboradorId:'rh2',etapas:{e1:{status:'concluida'}}};
 const h=harness({papel:'gestor',data:snapshot([f],{gestao:{podeGerir:true,podeValidar:true,pessoas:[],registros:[registro]}})});await h.route('escola');assert.match(h.node('#edu-registros').textContent,/0\/1 etapas/);assert.match(h.node('#edu-registros').textContent,/Revisão necessária/);
});
test('quem ainda precisa começar reúne atribuições por pessoa função e setor com busca',async()=>{
 const f=formation([makeStage()],{liberacao:{pessoas:['rh1','rh5'],cargos:['c2'],setores:['Impressão'],todos:false}}),rascunho=formation([makeStage()],{id:'f2',publicada:false,liberacao:{todos:true}});
 const pessoas=[{colaboradorId:'rh1',nome:'Já iniciou',usuario:'ana'},{colaboradorId:'rh2',nome:'Por função',cargoId:'c2',usuario:'bruno'},{colaboradorId:'rh3',nome:'Por setor',area:'Impressao',usuario:'maria'},{colaboradorId:'rh4',nome:'Fora do público',setor:'Financeiro'},{colaboradorId:'rh5',nome:'Por pessoa',usuario:''}];
 const h=harness({papel:'gestor',data:snapshot([f,rascunho],{gestao:{podeGerir:true,podeValidar:true,pessoas,registros:[{formacaoId:'f1',formacaoVersao:'1',colaboradorId:'rh1',nome:'Já iniciou',etapas:{e1:{status:'em_andamento'}}}]}})});await h.route('escola');
 const lista=h.node('#edu-iniciar');assert.equal(lista.querySelectorAll('article').length,3);assert.match(lista.textContent,/Por função/);assert.match(lista.textContent,/Por setor/);assert.match(lista.textContent,/Por pessoa/);assert.match(lista.textContent,/Acesso pessoal ao painel a conferir/);assert.doesNotMatch(lista.textContent,/Já iniciou|Fora do público/);h.node('#edu-busca-pessoa').value='setor';h.node('#edu-busca-pessoa').oninput();assert.equal(lista.querySelectorAll('article').length,1);assert.match(lista.textContent,/Por setor/);
});
test('resposta vazia de gravação mantém envio pendente sem informar sucesso',async()=>{
 let falhar=true;const storage=new Map();const api=async p=>p.operacao==='painel'?snapshot():falhar?{}:{ok:true};const h=harness({api,storage});await h.route('formacao','f1~e1');await h.click('[data-evento="leitura"]');assert.equal(h.edu.estadoEnvio().pendente,true);assert.equal(h.edu.estadoEnvio().enviando,false);assert.match(h.edu.estadoEnvio().erro,/não confirmou/);assert.equal(h.toasts.some(t=>/confirmado pelo servidor/.test(t.m)),false);assert.equal(storage.size,1);
 const nova=harness({api,storage});await nova.route();assert.equal(nova.edu.estadoEnvio().pendente,true);falhar=false;await nova.edu.conferirEstado();assert.equal(nova.edu.estadoEnvio().pendente,false);assert.equal(nova.edu.estadoEnvio().erro,'');assert.equal(storage.size,0);assert.equal(nova.calls.find(p=>p.operacao==='registrar').mutationId,h.calls.find(p=>p.operacao==='registrar').mutationId);
});
test('consulta sem confirmação apresenta falha e preserva navegação de consulta dos POPs',async()=>{
 const h=harness({api:async()=>({})});await h.route();assert.equal(h.edu.estadoEnvio().consultando,false);assert.match(h.edu.estadoEnvio().erro,/não foi confirmada/);assert.match(h.text(),/Vamos retomar seu aprendizado/);assert.match(h.html,/href="#\/pops"/);assert.equal(h.node('[data-evento]'),null);assert.doesNotMatch(h.html,/undefined|TypeError/);
});
test('responsável selecionado por nome envia login RH correto e setores escolhidos',async()=>{
 const b=backendApp(formation());const h=harness({papel:'admin',backend:b});await h.route('escola');await h.click('#edu-adicionar-instrutor');const linha=h.node('[data-instrutor-linha]'),pessoa=linha.querySelector('[data-instrutor-pessoa]');assert.match(pessoa.textContent,/Bruno RH · bruno/);pessoa.value='bruno';const setor=linha.querySelector('[data-instrutor-setores]');setor.children.find(o=>o.value==='Produção').selected=true;await h.submit('#edu-instrutores');
 const req=h.calls.find(p=>p.operacao==='configurarInstrutores');assert.deepEqual(req.instrutores,{bruno:['Produção']});assert.ok(b.writes.some(w=>w.rpc==='pops_configurar'&&w.args.p_patch.educacao.instrutores.bruno[0]==='Produção'));
});
test('configuração mantém login e setor antigos visíveis até remoção explícita',async()=>{
 const data=snapshot([],{gestao:{podeGerir:true,podeValidar:true,pessoas:[{colaboradorId:'rh2',nome:'Bruno RH',usuario:'bruno',setor:'Produção'}],registros:[],instrutores:{legado:['Setor antigo']}}});const h=harness({papel:'admin',api:async p=>p.operacao==='painel'?structuredClone(data):{ok:true}});await h.route('escola');assert.match(h.node('#edu-instrutores-lista').textContent,/legado · vínculo anterior \(conferir RH\)/);assert.match(h.node('#edu-instrutores-lista').textContent,/Setor antigo · setor anterior \(conferir\)/);
 await h.click('#edu-adicionar-instrutor');let linhas=h.app.querySelectorAll('[data-instrutor-linha]');linhas[1].querySelector('[data-instrutor-pessoa]').value='bruno';linhas[1].querySelector('[data-instrutor-setores]').children.find(o=>o.value==='Produção').selected=true;await h.submit('#edu-instrutores');const req=h.calls.find(p=>p.operacao==='configurarInstrutores');assert.deepEqual(req.instrutores,{legado:['Setor antigo'],bruno:['Produção']});
});
test('editor da etapa escolhe responsáveis por nome e preserva vínculos anteriores',async()=>{
 const f=formation([makeStage({tipo:'pratica',checklist:['Conferir'],validadores:['anterior']})]);const data=snapshot([f],{gestao:{podeGerir:true,podeValidar:true,pessoas:[{colaboradorId:'rh2',nome:'Bruno RH',usuario:'bruno'}],registros:[]}});const h=harness({papel:'admin',api:async p=>p.operacao==='painel'?structuredClone(data):{ok:true}});await h.route('formacao-editor','f1');const select=h.node('[data-validadores]');assert.equal(select.tag,'select');assert.match(select.textContent,/Bruno RH · bruno/);assert.match(select.textContent,/anterior · vínculo anterior/);select.children.find(o=>o.value==='bruno').selected=true;await h.submit('#edu-editor');const req=h.calls.find(p=>p.operacao==='salvarFormacao');assert.deepEqual(req.formacao.etapas[0].validadores,['anterior','bruno']);
});
test('responsáveis duplicados são explicados sem sobrescrever seus setores',async()=>{
 const data=snapshot([],{gestao:{podeGerir:true,podeValidar:true,pessoas:[{colaboradorId:'rh2',nome:'Bruno RH',usuario:'bruno',setor:'Produção'}],registros:[],instrutores:{bruno:['Produção']}}});const h=harness({papel:'admin',data});await h.route('escola');await h.click('#edu-adicionar-instrutor');const segunda=h.app.querySelectorAll('[data-instrutor-linha]')[1];segunda.querySelector('[data-instrutor-pessoa]').value='bruno';segunda.querySelector('[data-instrutor-setores]').children.find(o=>o.value==='Produção').selected=true;await h.submit('#edu-instrutores');assert.match(h.node('#edu-instrutores-erro').textContent,/aparece mais de uma vez/);assert.equal(h.calls.some(p=>p.operacao==='configurarInstrutores'),false);
});
