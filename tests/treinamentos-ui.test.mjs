import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { store } from './helpers.mjs';
import { cfg, dados } from './fixtures.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const decode = value => String(value ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (_, key) => ({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));

class Element {
  constructor(tag='div', attributes={}) {
    this.tag=tag;this.attributes=attributes;this.children=[];this.style={};this.dataset={};this._html='';this._text='';
    this.value=decode(attributes.value || '');this.checked=Object.hasOwn(attributes,'checked');this.disabled=Object.hasOwn(attributes,'disabled');
    for(const [key,value] of Object.entries(attributes)) if(key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=decode(value);
  }
  set innerHTML(html) {
    this._html=String(html);this.children=[];this._text='';const stack=[this];
    for(const token of this._html.match(/<[^>]*>|[^<]+/g) || []) {
      if(token.startsWith('</')) {const name=token.match(/^<\/([\w-]+)/)?.[1];while(stack.length>1){const n=stack.pop();if(n.tag===name)break;}continue;}
      if(token.startsWith('<')) {
        const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attrs={};
        for(const m of token.slice(tag.length+1,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[m[1]]=m[2]??m[3]??m[4]??'';
        const n=new Element(tag,attrs);stack.at(-1).children.push(n);if(!['input','img','br','hr','meta','link'].includes(tag))stack.push(n);
      } else stack.at(-1)._text+=decode(token);
    }
    for(const n of this.descendants()) {
      if(n.tag==='textarea')n.value=n.textContent;
      if(n.tag==='select'){const opts=n.children.filter(c=>c.tag==='option');const selected=opts.find(c=>Object.hasOwn(c.attributes,'selected'))||opts[0];n.value=selected?decode(selected.attributes.value??selected.textContent):'';}
    }
  }
  get innerHTML(){return this._html;}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set textContent(text){this._text=String(text);this.children=[];}
  descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
  querySelectorAll(selector){return this.descendants().filter(n=>selector.split(',').some(s=>{s=s.trim();if(s.startsWith('#'))return n.attributes.id===s.slice(1);if(s.startsWith('[')){const a=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return a&&Object.hasOwn(n.attributes,a[1])&&(a[2]===undefined||n.attributes[a[1]]===a[2]);}return n.tag===s;}));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){} setAttribute(name,value){this.attributes[name]=value;} addEventListener(){}
}

// Exercise the real renderers, handlers and offline STORE. Only the browser
// surface is replaced; layout, focus and native form behavior have separate QA.
function harness({ papel = 'admin', registros = {}, confirmacao = true } = {}) {
  const base = structuredClone({ ...dados, ...registros });
  const sessao = { usuario:'ana', nome:'Ana Exemplo', papel };
  const h = store({ initial:{ pops_user:sessao, pops_dados:base, pops_cfg:cfg } });
  const toasts = [], lotes = [], app = new Element('main',{id:'app'});
  const node = selector => selector==='#app'?app:app.querySelector(selector);
  const ctx = vm.createContext({ STORE:h.store, document:{querySelector:node,querySelectorAll:s=>app.querySelectorAll(s)},
    location:{hash:'#/conhecimento',href:'https://exemplo.test/pops/',origin:'https://exemplo.test',pathname:'/pops/'},
    URL, Date, crypto:webcrypto, window:{scrollTo(){}}, confirm:()=>confirmacao, __toasts:toasts, __lotes:lotes,
    __app:app, setTimeout:()=>1, clearTimeout(){} });
  for (const file of ['organizacao.js','conhecimento.js','treinamentos.js']) vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').split("window.addEventListener('hashchange'")[0],ctx);
  vm.runInContext('htmlTopo=()=>""; ligarTopo=()=>{}; toast=(m,t)=>__toasts.push({m,t}); abrirLote=items=>__lotes.push(items); globalThis.__renderAppReal=renderApp; renderApp=()=>{};',ctx);
  const run = expression => vm.runInContext(expression,ctx);
  function render(name, arg='') { run('ROTA={nome:"editor",arg:'+JSON.stringify(arg)+'};'+name+'(__app);'); }
  function fill(values) { for(const [selector,value] of Object.entries(values)){assert.ok(node(selector),'Missing control '+selector);Object.assign(node(selector),typeof value==='object'?value:{value});} }
  function click(selector) { const el=node(selector);assert.equal(typeof el?.onclick,'function','Missing handler '+selector);return el.onclick({preventDefault(){}}); }
  function submit(){assert.equal(typeof node('#treino-form')?.onsubmit,'function');node('#treino-form').onsubmit({preventDefault(){}});}
  function route(hash){ctx.location.hash=hash;run('__renderAppReal()');}
  return { ...h, run, render, route, fill, click, submit, node, app, toasts, lotes, ctx, get html(){return app.innerHTML;}, get hash(){return ctx.location.hash;} };
}

function valido(patch={}) {
  return {id:'t1',titulo:'Como conferir uma instalação',versao:'1.0',tipo:'esporadico',setor:'Impressão',
    resumo:'Conferência antes da saída.',responsavel:'Instrutora',blocos:[{tipo:'paragrafo',texto:'Confira os itens.'}],
    validadeMeses:0,exigeAceite:false,materiais:[{titulo:'Manual',url:'https://exemplo.test/manual.pdf'}],...patch};
}

test('links de apoio rejeitam protocolos e formatos que o servidor recusaria',()=>{
  const h=harness();
  for(const url of ['javascript:alert(1)','http://exemplo.test/manual','https:exemplo.test','https://user:senha@exemplo.test/','https://exemplo.test/um arquivo','https://exemplo.test/\nmanual','https://exemplo.test\\manual']) {
    assert.equal(h.run('window.POPS_TREINAMENTOS.urlSegura('+JSON.stringify(url)+')'),false,url);
  }
  assert.equal(h.run('window.POPS_TREINAMENTOS.urlSegura("https://exemplo.test/manual.pdf?q=a%20b#inicio")'),true);
});

test('mudança de instruções ou material exige versão nova, metadado não',()=>{
  const h=harness(), anterior=valido();
  for(const patch of [{titulo:'Novo título'},{blocos:[{tipo:'paragrafo',texto:'Outro procedimento.'}]},{materiais:[]},{validadeMeses:12},{exigeAceite:true}]) {
    assert.match(h.run('window.POPS_TREINAMENTOS.validar('+JSON.stringify(anterior)+','+JSON.stringify({...anterior,...patch})+')'),/nova versão/);
    assert.equal(h.run('window.POPS_TREINAMENTOS.validar('+JSON.stringify(anterior)+','+JSON.stringify({...anterior,...patch,versao:'2.0'})+')'),'');
  }
  assert.equal(h.run('window.POPS_TREINAMENTOS.validar('+JSON.stringify(anterior)+','+JSON.stringify({...anterior,responsavel:'Outra instrutora'})+')'),'');
});

test('rota de cadastro é exclusiva do administrador; equipe e gestor consultam catálogo',()=>{
  for(const papel of ['gestor','equipe']) {
    const h=harness({papel});h.route('#/editor/treinamento/novo');
    assert.equal(h.hash,'#/conhecimento');assert.equal(h.node('#treino-form'),null);
    h.route('#/editor/treinamento/t1');assert.equal(h.hash,'#/conhecimento');
    h.route('#/conhecimento');assert.doesNotMatch(h.html,/Novo treinamento/);
    assert.doesNotMatch(h.node('#treino-lista').innerHTML,/data-atribuir-treino|editor\/treinamento/);
    h.run('atribuirTreinamento(STORE.um("treinamentos","t1"))');assert.equal(h.lotes.length,0);
  }
  const admin=harness();admin.route('#/editor/treinamento/novo');assert.ok(admin.node('#treino-form'));
});

test('cadastro com material, aceite e reciclagem entra na fila offline e abre a leitura',()=>{
  const h=harness();h.route('#/editor/treinamento/novo');
  h.fill({'#tr-titulo':'Conferência em campo','#tr-resumo':'Orientação específica.','#tr-conteudo':'## Antes da entrega\n\n1. Conferir peças\n2. Conferir acabamento','#tr-setor':'Impressão','#tr-resp':'Instrutora','#tr-validade':'12','#tr-aceite':{checked:true}});
  h.click('#tr-add-material');h.fill({'#tr-mtitulo-0':'Vídeo de apoio','#tr-murl-0':'https://exemplo.test/video'});h.submit();
  const fila=h.store.getFila();assert.equal(fila.length,1);assert.equal(fila[0].colecao,'treinamentos');assert.equal(fila[0].expectedRevision,0);
  const salvo=fila[0].registro;assert.equal(salvo.titulo,'Conferência em campo');assert.equal(salvo.validadeMeses,12);assert.equal(salvo.exigeAceite,true);
  assert.deepEqual(plain(salvo.materiais),[{titulo:'Vídeo de apoio',url:'https://exemplo.test/video'}]);
  assert.deepEqual(plain(salvo.blocos),[{tipo:'subtitulo',texto:'Antes da entrega'},{tipo:'passos',itens:['Conferir peças','Conferir acabamento']}]);
  assert.equal(h.hash,'#/treinamento/'+salvo.id);assert.match(h.toasts.at(-1).m,/aguardando sincronização/);
});

test('formulário vazio ou link inseguro conserva os campos sem enfileirar treinamento',()=>{
  const h=harness();h.route('#/editor/treinamento/novo');h.submit();
  assert.equal(h.store.getFila().length,0);assert.match(h.node('#tr-erro').textContent,/título/);
  h.fill({'#tr-titulo':'Título preservado','#tr-conteudo':'Uma instrução válida.'});h.click('#tr-add-material');
  h.fill({'#tr-mtitulo-0':'Material','#tr-murl-0':'javascript:alert(1)'});h.submit();
  assert.equal(h.store.getFila().length,0);assert.match(h.node('#tr-erro').textContent,/HTTPS/);
  assert.equal(h.node('#tr-titulo').value,'Título preservado');assert.equal(h.hash,'#/editor/treinamento/novo');
});

test('erro de armazenamento mantém cadastro e edição abertos para tentar novamente',()=>{
  for(const id of ['novo','t1']) {
    const h=harness({registros:{treinamentos:[valido()]}});h.route('#/editor/treinamento/'+id);
    if(id==='novo')h.fill({'#tr-titulo':'Treinamento novo','#tr-conteudo':'Conteúdo que não pode ser perdido.'});
    h.quota();h.submit();assert.equal(h.hash,'#/editor/treinamento/'+id);assert.equal(h.store.getFila().length,0);
    assert.match(h.node('#tr-erro').textContent,/continua aqui/);assert.ok(h.node('#tr-conteudo').value);
  }
});

test('edição preserva identidade, campos legados, materiais e autoria da criação',()=>{
  const anterior=valido({ordem:8,extraLegado:{importado:true},criadoEm:'2026-01-02',criadoPor:'Criadora original',blocos:[{tipo:'texto',texto:'Conteúdo antigo.',extra:'preservar'}],materiais:[{titulo:'Manual',url:'https://exemplo.test/manual.pdf',legado:'preservar'}],_serverRevision:4});
  const h=harness({registros:{treinamentos:[anterior]}});h.route('#/editor/treinamento/t1');h.fill({'#tr-resp':'Nova responsável'});h.submit();
  const item=h.store.getFila()[0];assert.ok(item);const salvo=item.registro;
  assert.equal(item.expectedRevision,4);assert.equal(salvo.id,'t1');assert.equal(salvo.versao,'1.0');assert.equal(salvo.ordem,8);
  for(const key of ['extraLegado','blocos','materiais'])assert.deepEqual(plain(salvo[key]),anterior[key]);
  assert.equal(salvo.criadoEm,anterior.criadoEm);assert.equal(salvo.criadoPor,anterior.criadoPor);assert.equal(salvo.responsavel,'Nova responsável');
});

test('mudança de conteúdo bloqueia versão repetida e mantém a leitura anterior após salvar versão nova',()=>{
  const leitura={id:'t-ana-t1',usuario:'ana',treinamentoId:'t1',versaoLida:'1.0',em:'2026-01-01'};
  const h=harness({registros:{treinamentos:[valido()],leituras:[leitura]}});h.route('#/editor/treinamento/t1');
  h.fill({'#tr-conteudo':'Nova instrução para a equipe.'});h.submit();assert.equal(h.store.getFila().length,0);assert.match(h.node('#tr-erro').textContent,/nova versão/);
  h.fill({'#tr-versao':'1.1'});h.submit();assert.equal(h.store.getFila().length,1);assert.deepEqual(plain(h.store.col('leituras')),[leitura]);
  assert.equal(h.run('conclusaoDe({tipo:"treinamento",refId:"t1"},"ana").desatualizado'),true);
});

test('arquivamento remove só o catálogo; mantém leituras e atribuições e respeita cancelamento',()=>{
  const leitura={id:'t-ana-t1',usuario:'ana',treinamentoId:'t1',versaoLida:'1.0',em:'2026-01-01'};
  const registros={treinamentos:[valido({_serverRevision:3})],leituras:[leitura]};
  const cancelado=harness({registros,confirmacao:false});cancelado.route('#/editor/treinamento/t1');cancelado.click('#tr-arquivar');
  assert.equal(cancelado.store.getFila().length,0);assert.ok(cancelado.store.um('treinamentos','t1'));
  const h=harness({registros});const atribuicoes=plain(h.store.col('atribuicoes'));h.route('#/editor/treinamento/t1');h.click('#tr-arquivar');
  assert.equal(h.store.um('treinamentos','t1'),null);assert.deepEqual(plain(h.store.col('leituras')),[leitura]);assert.deepEqual(plain(h.store.col('atribuicoes')),atribuicoes);
  assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].action,'delete');assert.equal(h.store.getFila()[0].colecao,'treinamentos');assert.equal(h.hash,'#/conhecimento');
});

test('materiais na leitura escapam texto e descartam URLs ativas perigosas',()=>{
  const h=harness({registros:{treinamentos:[valido({titulo:'<script>um</script>',materiais:[{titulo:'<img src=x onerror=alert(1)>',url:'https://exemplo.test/manual?a=1&b=2'},{titulo:'Link perigoso',url:'javascript:alert(1)'}]})]}});
  h.route('#/treinamento/t1');assert.match(h.html,/&lt;script&gt;um&lt;\/script&gt;/);assert.match(h.html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(h.html,/href="https:\/\/exemplo.test\/manual\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);assert.doesNotMatch(h.html,/javascript:|<img src=x/);
});

test('atribuição direta da leitura abre lote com somente o treinamento atual',()=>{
  const h=harness();h.route('#/treinamento/t1');h.click('#treino-atribuir');
  assert.deepEqual(plain(h.lotes),[[{tipo:'treinamento',id:'t1',titulo:dados.treinamentos[0].titulo,grupo:'Treinamentos'}]]);
  for(const papel of ['gestor','equipe']){const restrito=harness({papel});restrito.route('#/treinamento/t1');assert.equal(restrito.node('#treino-atribuir'),null);assert.doesNotMatch(restrito.html,/Editar treinamento/);}
});

test('catálogo busca instruções sem acento, filtra por setor e mostra estado da leitura',()=>{
  const leitura={id:'t-ana-t1',usuario:'ana',treinamentoId:'t1',versaoLida:'0.9',em:'2026-01-01'};
  const h=harness({registros:{treinamentos:[valido(),valido({id:'t2',titulo:'Soldagem',setor:'Metalurgia',blocos:[{tipo:'paragrafo',texto:'Usar proteção facial.'}]})],leituras:[leitura]}});
  h.route('#/conhecimento');assert.equal(h.node('#treino-contagem').textContent,'2 de 2 treinamento(s)');assert.match(h.node('#treino-lista').innerHTML,/Nova versão · releia/);
  h.fill({'#treino-busca':'protecao'});h.node('#treino-busca').oninput();assert.match(h.node('#treino-lista').innerHTML,/Soldagem/);assert.doesNotMatch(h.node('#treino-lista').innerHTML,/Como conferir/);
  h.fill({'#treino-setor':'Impressão'});h.node('#treino-setor').onchange();assert.equal(h.node('#treino-contagem').textContent,'0 de 2 treinamento(s)');assert.match(h.node('#treino-lista').innerHTML,/Nenhum resultado/);
});
