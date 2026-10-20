import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { Element } from './escola-tela-harness.mjs';

// Navegação enxuta do app real (htmlTopo do app.js) e o caminho de publicação
// dos arquivos da tela. Sessões e setores são fictícios.
function topo({papel='equipe',gestores={},gestao={},pendencias=0}={}){
 const sessao={usuario:'ana',nome:'Ana Fictícia',papel};
 const ctx=vm.createContext({STORE:{getUser:()=>sessao,resumoSync:()=>({status:'ok',pendentes:0}),on(){},col:()=>[],um:()=>null,getCFG:()=>({gestores,setores:['Produção']}),lastSync:()=>null,getConhecimento:()=>({})},
  location:{href:'https://exemplo.test/pops/',origin:'https://exemplo.test',pathname:'/pops/'},URL,Date,
  window:{EDUCACAO:{estadoGestao:()=>gestao,estadoEnvio:()=>null},addEventListener(){}},document:{querySelector:()=>null}});
 vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').split("window.addEventListener('hashchange'")[0],ctx);
 vm.runInContext('minhasPendencias=()=>Array.from({length:'+pendencias+'})',ctx);
 return (nome,arg='',extra={})=>{ctx.__rota={nome,arg,...extra};const el=new Element('div');el.innerHTML=vm.runInContext('ROTA=__rota;htmlTopo("conhecimento")',ctx);return el;};
}
const destinos=el=>el.querySelector('.nav-principal').children.filter(n=>n.tag==='a').map(a=>[a.textContent,a.attributes.href]);
const ativo=el=>el.querySelector('.nav-principal').children.filter(n=>n.tag==='a'&&Object.hasOwn(n.attributes,'aria-current')).map(a=>a.querySelector('.nav-rotulo').textContent);
const menu=el=>el.querySelector('.nav-escola')?.querySelectorAll('a').map(a=>[a.textContent,a.attributes.href])||[];

test('quem estuda vê quatro destinos e a conta no topo, sem o menu da escola',()=>{
 const el=topo()('inicio');
 assert.deepEqual(destinos(el).map(([t,h])=>[t.replace(/^\W+/,''),h]),[['Início','#/'],['Catálogo','#/catalogo'],['POPs e Fabricação','#/pops'],['Conhecimento','#/conhecimento']]);
 assert.equal(el.querySelector('.nav-escola'),null);
 assert.equal(el.querySelector('.tit').attributes.href,'#/menu');assert.match(el.querySelector('.tit').textContent,/Escola Impresilk.*Minha conta/);
 assert.doesNotMatch(el.textContent,/jornada|forma[cç][aã]o|Painel de Educação/i);
});

test('menu Escola conforme a permissão: administração, gestão e instrutor',()=>{
 assert.deepEqual(menu(topo({papel:'admin'})('escola')),[['Gestão de cursos','#/escola'],['Acompanhamento','#/alunos'],['Provas para aprovar','#/avaliacoes/equipe'],['Matriz de cargos','#/matriz'],['Equipe e vínculos','#/pessoas'],['Histórico anterior','#/mapa'],['Importar pacote','#/importar'],['Entrada do aluno','#/escola/entrada'],['Biblioteca','#/biblioteca'],['Vídeos','#/videos'],['NRs','#/nrs']]);
 const gestor=menu(topo({papel:'gestor',gestores:{ana:['Produção']}})('escola'));
 assert.equal(gestor.length,9);assert.equal(gestor.some(([,h])=>h==='#/importar'),false);assert.ok(gestor.some(([,h])=>h==='#/pessoas'));
 assert.deepEqual(menu(topo({gestao:{podeValidar:true}})('inicio')),[['Práticas para validar','#/escola']]);
});

test('destino aceso segue a rota, inclusive Alunos, NRs, Vídeos e editores',()=>{
 const t=topo({papel:'admin'});
 for(const [rota,arg,esperado,extra] of [['inicio','','Início'],['formacao','f1','Início'],['avaliacoes','','Início'],['catalogo','','Catálogo'],['pop','p1','POPs e Fabricação'],['fab','','POPs e Fabricação'],['nrs','','Conhecimento'],['videos','','Conhecimento'],['biblioteca','','Conhecimento'],['editor','t1','Conhecimento',{tipoEditor:'treinamento'}],['editor','p1','POPs e Fabricação',{tipoEditor:'pop'}]])
  assert.deepEqual(ativo(t(rota,arg,extra)),[esperado],rota);
 for(const rota of ['alunos','escola','matriz','importar','formacao-editor','jornada-editor']){const el=t(rota);assert.deepEqual(ativo(el),[],rota);assert.ok(Object.hasOwn(el.querySelector('.nav-escola').querySelector('summary').attributes,'aria-current'),rota);}
 assert.ok(Object.hasOwn(t('alunos').querySelector('.nav-escola').querySelectorAll('a').find(a=>a.attributes.href==='#/alunos').attributes,'aria-current'));
 assert.ok(Object.hasOwn(t('jornada-editor','rh-ficticio').querySelector('.nav-escola').querySelectorAll('a').find(a=>a.attributes.href==='#/alunos').attributes,'aria-current'));
 assert.ok(Object.hasOwn(t('menu').querySelector('.tit').attributes,'aria-current'));
});

test('subnavegação junta os destinos do grupo sem empurrar o início',()=>{
 const t=topo();
 assert.equal(t('inicio').querySelector('.subnav'),null);assert.equal(t('formacao','f1~e1').querySelector('.subnav'),null,'Aula tem o voltar no conteúdo');
 const sub=el=>el.querySelector('.subnav').querySelectorAll('a').map(a=>[a.textContent,Object.hasOwn(a.attributes,'aria-current')]);
 assert.deepEqual(sub(t('pops')),[['POPs',true],['Jornadas de fabricação',false]]);
 assert.deepEqual(sub(t('jornada','j1')).find(([n])=>n==='Jornadas de fabricação'),['Jornadas de fabricação',true]);
 assert.deepEqual(sub(t('conhecimento','referencias')).filter(([,a])=>a),[['Referências',true]]);
 assert.deepEqual(sub(t('conhecimento')).filter(([,a])=>a),[['Treinamentos',true]]);
 assert.deepEqual(sub(t('avaliacoes')).filter(([,a])=>a),[['Avaliações',true]]);
});

test('pendência antiga aparece no Início da navegação',()=>{
 const el=topo({pendencias:2})('pops');const inicio=el.querySelector('.nav-principal').children.find(a=>a.attributes.href==='#/');
 assert.equal(inicio.querySelector('.nav-badge').textContent,'2');assert.match(inicio.querySelector('.nav-badge').attributes['aria-label'],/2 atribuições anteriores pendentes/);
});

test('arquivos da tela: index, cache do aparelho, publicação e prévia andam juntos',()=>{
 const ler=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
 const scripts=[...ler('index.html').matchAll(/<script src="\.\/([^"]+)"/g)].map(m=>m[1]);
 assert.ok(scripts.includes('escola-catalogo.js'));
 const sw=ler('sw.js'),shell=[...sw.matchAll(/'\.\/([^']+\.js)'/g)].map(m=>m[1]);
 const deploy=ler('.github/workflows/deploy.yml').match(/cp index\.html ([^\n]+) dist\//)[1].split(/\s+/);
 const previa=ler('scripts/revisao-educacao.mjs');
 for(const s of scripts){assert.ok(shell.includes(s),'sw.js sem '+s);assert.ok(deploy.includes(s),'deploy sem '+s);assert.ok(previa.includes("'"+s+"'"),'prévia sem '+s);}
 assert.doesNotMatch(sw,/pops-shell-v16-escola/,'Publicar a tela nova exige trocar o nome do cache');assert.match(sw,/const CACHE = 'pops-shell-v\d+-[a-z-]+';/);
 const cfg=ler('config.js');assert.match(cfg,/window\.ESCOLA_TELA_VERSAO = '[^']+';/);assert.match(cfg,/window\.CONHECIMENTO_VERSAO = '2026\.10\.05';/,'A versão da base acompanha o servidor, não a tela');
 assert.match(ler('index.html'),/<title>Escola Impresilk<\/title>/);
});

// ───── Correções da revisão de 14/10 (navegação, conta, nome e pull) ─────
test('menu Escola leva a Equipe e vínculos, ao Histórico anterior e às provas para aprovar sem sair da Escola',()=>{
 const t=topo({papel:'admin'});
 const atual=el=>el.querySelector('.nav-escola').querySelectorAll('a').filter(a=>Object.hasOwn(a.attributes,'aria-current')).map(a=>a.textContent);
 for(const [rota,arg,item] of [['pessoas','','Equipe e vínculos'],['mapa','','Histórico anterior'],['avaliacoes','equipe','Provas para aprovar']]){
  const el=t(rota,arg);assert.deepEqual(ativo(el),[],rota);assert.ok(Object.hasOwn(el.querySelector('.nav-escola').querySelector('summary').attributes,'aria-current'),rota);assert.deepEqual(atual(el),[item],rota);
 }
 // As avaliações pessoais continuam no Início.
 assert.deepEqual(ativo(t('avaliacoes')),['Início']);assert.deepEqual(atual(t('avaliacoes')),[]);
 // Biblioteca, Vídeos e NRs abrem em Conhecimento, e o menu avisa antes.
 const lista=t('escola').querySelector('.nav-escola-lista');
 const grupo=lista.querySelectorAll('.nav-escola-grupo');assert.equal(grupo.length,1);assert.equal(grupo[0].textContent,'Abrem em Conhecimento');
 const ordem=lista.children.map(n=>n.tag==='p'?'#grupo':n.attributes.href);assert.deepEqual(ordem.slice(ordem.indexOf('#grupo')),['#grupo','#/biblioteca','#/videos','#/nrs']);
 // Quem não gerencia não vê Equipe nem Histórico anterior.
 assert.deepEqual(menu(topo({gestao:{podeValidar:true}})('inicio')),[['Práticas para validar','#/escola']]);
});

test('no celular "Minha conta" tem linha própria no topo e não é cortada com o nome',()=>{
 const tit=topo()('inicio').querySelector('.tit');
 assert.equal(tit.querySelector('.tit-conta').textContent,'Minha conta');assert.equal(tit.querySelector('.tit-sep').textContent,' · ');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const celular=[...css.matchAll(/@media \(max-width: 600px\) \{([\s\S]*?)\n\}/g)].map(m=>m[1]).join('\n');
 assert.match(celular,/\.topo \.tit \.tit-conta \{ display: block;/);assert.match(celular,/\.topo \.tit \.tit-sep \{ display: none; \}/);
});

test('entrada e aplicativo instalado chamam o sistema de Escola Impresilk; textos sem travessão',()=>{
 const ler=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
 const app=ler('app.js'),manifesto=JSON.parse(ler('manifest.webmanifest'));
 assert.match(app,/document\.title="Escola Impresilk · Entrada";/);assert.doesNotMatch(app,/POPs · Entrada/);
 assert.equal(manifesto.name,'Escola Impresilk');assert.equal(manifesto.short_name,'Escola');
 assert.match(ler('sw.js'),/'\.\/manifest\.webmanifest'/,'O manifesto vai no shell do sw, cujo nome já é novo neste ramo');
 assert.match(app,/quem já leu verá "mudou: releia"/);
 for(const velho of ['mudou — releia','_(trecho —','concluíram —'])assert.equal(app.includes(velho),false,velho);
});

test('atualização dos POPs a cada 90 s não redesenha o catálogo por baixo da busca',()=>{
 const ouvintes={},sessao={usuario:'ana',nome:'Ana Fictícia',papel:'equipe'};
 const ctx=vm.createContext({STORE:{getUser:()=>sessao,resumoSync:()=>({status:'ok',pendentes:0}),on:(ev,fn)=>{(ouvintes[ev]||=[]).push(fn);},col:()=>[],um:()=>null,getCFG:()=>({gestores:{},setores:[]}),lastSync:()=>null,getConhecimento:()=>({})},
  location:{href:'https://exemplo.test/pops/',origin:'https://exemplo.test',pathname:'/pops/'},URL,Date,window:{EDUCACAO:{estadoGestao:()=>({}),estadoEnvio:()=>null},addEventListener(){}},document:{querySelector:()=>null}});
 vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').split("window.addEventListener('hashchange'")[0],ctx);
 vm.runInContext('var __renders=0;renderApp=()=>{__renders++;};',ctx);
 const pull=nome=>{ctx.__rota={nome,arg:''};vm.runInContext('ROTA=__rota',ctx);const antes=ctx.__renders;for(const fn of ouvintes.pull)fn();return ctx.__renders-antes;};
 assert.equal(pull('catalogo'),0,'Catálogo não se redesenha: a busca, o filtro e a rolagem ficam');
 assert.equal(pull('matriz'),0);assert.equal(pull('pops'),1,'A lista de POPs continua se atualizando');
});
