// Ambiente de tela da escola para os testes: os arquivos reais (educacao,
// academia, escola-gestao e escola-catalogo) rodam num vm com um DOM mínimo.
// Só a superfície do navegador é trocada; layout e foco têm conferência visual
// separada. Todos os nomes, cargos e conteúdos usados nos testes são fictícios.
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

export const plain=x=>JSON.parse(JSON.stringify(x));
export const esperar=async(n=30)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
const decode=s=>String(s??'').replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
export class Element {
  constructor(tag='div',attrs={}){this.tag=tag;this.attributes=attrs;this.children=[];this.dataset={};this.style={};this._html='';this._text='';this.value=decode(attrs.value||'');this.type=attrs.type||'';this.checked=Object.hasOwn(attrs,'checked');this.disabled=Object.hasOwn(attrs,'disabled');this.selected=Object.hasOwn(attrs,'selected');this.hidden=Object.hasOwn(attrs,'hidden');this.open=Object.hasOwn(attrs,'open');this.isConnected=true;for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=decode(v);}
  set innerHTML(s){this._html=String(s);for(const n of this.descendants())n.isConnected=false;this.children=[];this._text='';const stack=[this];for(const token of this._html.match(/<[^>]*>|[^<]+/g)||[]){if(token.startsWith('</')){const name=token.match(/^<\/([\w-]+)/)?.[1];while(stack.length>1){if(stack.pop().tag===name)break;}continue;}if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attrs={};for(const m of token.slice(tag.length+1,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[m[1]]=m[2]??m[3]??m[4]??'';const n=new Element(tag,attrs);stack.at(-1).children.push(n);if(!['input','img','br','hr','meta','link'].includes(tag))stack.push(n);}else stack.at(-1)._text+=decode(token);}for(const n of this.descendants()){if(n.tag==='textarea')n.value=n.textContent;if(n.tag==='select'){const opts=n.children.filter(c=>c.tag==='option'),sel=opts.find(c=>c.selected)||opts[0];n.value=sel?(sel.attributes.value!==undefined?decode(sel.attributes.value):sel.textContent):'';}}}
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
  setAttribute(k,v){this.attributes[k]=v;} focus(){} scrollIntoView(){} addEventListener(){} remove(){this.isConnected=false;if(this._pai)this._pai.children=this._pai.children.filter(n=>n!==this);}
}
// IndexedDB mínimo (get, put, delete, clear, getAllKeys), com transações que
// terminam depois das requisições, como no navegador.
export function indexedDBFicticio(){
  const bancos=new Map(),depois=fn=>setImmediate(fn);
  const pedido=()=>({onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null,result:undefined,error:null});
  return {bancos,
    open(nome){const r=pedido();depois(()=>{let db=bancos.get(nome);const novo=!db;if(!db){db=new Map();bancos.set(nome,db);}
      r.result={objectStoreNames:{contains:n=>db.has(n)},createObjectStore:n=>{db.set(n,new Map());},close(){},onversionchange:null,
        transaction(n){const st=db.get(n),tx={oncomplete:null,onerror:null,onabort:null,error:null};let pend=0;const fim=()=>{if(--pend===0)depois(()=>tx.oncomplete?.());};
          const req=fn=>{const q=pedido();pend++;depois(()=>{q.result=fn();q.onsuccess?.();fim();});return q;};
          tx.objectStore=()=>({get:k=>req(()=>st.has(k)?structuredClone(st.get(k)):undefined),put:(v,k)=>req(()=>{st.set(k,structuredClone(v));return k;}),delete:k=>req(()=>{st.delete(k);}),clear:()=>req(()=>{st.clear();}),getAllKeys:()=>req(()=>[...st.keys()])});
          depois(()=>{if(pend===0)tx.oncomplete?.();});return tx;}};
      if(novo)r.onupgradeneeded?.();r.onsuccess?.();});return r;},
    entradas(){return [...(bancos.get('impresilk-escola-cache')?.get('consultas')?.entries()||[])];}};
}
// sessao: {usuario,nome,papel,pessoaRH}; api(payload,acao,tempo) ou backend b.
export function telaEscola({sessao={},api,backend:b,storage=new Map(),idb,arquivos=['treinamentos.js','educacao.js','academia.js','escola-gestao.js','escola-catalogo.js','escola-jornadas.js'],cfgSetores=['Produção'],versaoTela='teste-1'}={}){
  const app=new Element('main',{id:'app'}),calls=[],toasts=[],ouvintes=[];
  const SESSAO={usuario:'ana',nome:'Ana Fictícia',papel:'equipe',pessoaRH:{colaboradorId:'rh1'},...sessao};
  const node=(s,root=app)=>s==='#app'?app:root.querySelector(s);
  const sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  // window é o próprio global, como no navegador: window.ACADEMIA vira ACADEMIA.
  const global={sessionStorage,addEventListener(){},removeEventListener(){},ESCOLA_TELA_VERSAO:versaoTela};global.window=global;
  const ctx=vm.createContext(Object.assign(global,{SESSAO,ROTA:{nome:'inicio',arg:''},location:{hash:'#/'},crypto:webcrypto,TextEncoder,URL,console,setTimeout,clearTimeout,
    document:{createElement:t=>new Element(t),getElementById:id=>node('#'+id),querySelector:()=>null,addEventListener:(ev,fn)=>ouvintes.push([ev,fn])},
    ...(idb?{indexedDB:idb}:{}),
    STORE:{um:()=>null,col:()=>[],api:async(action,payload,tempo)=>{calls.push({action,...plain(payload),_tempo:tempo});if(api)return api(plain(payload),action,tempo);const r=await b.call({action,...payload},{sub:SESSAO.usuario,papel:SESSAO.papel});if(r.status>=400)throw Object.assign(new Error(r.body.erro),{status:r.status});return r.body;}},
    esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),norm:s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim(),uuid:()=>webcrypto.randomUUID(),
    htmlTopo:()=>'',ligarTopo(){},toast:(m,t)=>toasts.push({m,t}),fmtDataHora:s=>s?'DATA '+s:'',fmtData:s=>s?'DIA '+s:'',setores:()=>cfgSetores,souAdmin:()=>SESSAO.papel==='admin',associarRotulos(){},confirm:()=>true,
    abrirModal:html=>{const dlg=new Element('dialog');dlg.innerHTML=html;dlg._pai=app;app.children.push(dlg);return dlg;},
    $:node,$$:(s,root=app)=>root.querySelectorAll(s),
  }));
  for(const f of arquivos)vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),ctx);
  const rotear=(nome,arg='')=>{ctx.ROTA={nome,arg};ctx.location.hash='#/'+nome+(arg?'/'+arg:'');};
  const route=async(nome='inicio',arg='')=>{rotear(nome,arg);const mod=nome==='jornada-editor'?ctx.window.ESCOLA_JORNADAS:['catalogo','matriz','importar'].includes(nome)?ctx.window.ESCOLA_CATALOGO:['biblioteca','videos','material','material-editor'].includes(nome)?ctx.window.ACADEMIA:['alunos','aluno','avaliacoes','nrs','perfil'].includes(nome)?ctx.window.ESCOLA_GESTAO:ctx.window.EDUCACAO;await mod.render(app);await esperar();};
  const click=async s=>{const n=typeof s==='string'?node(s):s;if(!n||typeof n.onclick!=='function')throw new Error('Ação ausente '+s);await n.onclick({preventDefault(){},target:n});await esperar();};
  const submit=async s=>{const n=node(s);if(!n||typeof n.onsubmit!=='function')throw new Error('Formulário ausente '+s);await n.onsubmit({preventDefault(){},target:n});await esperar();};
  const marcar=(fieldset,valor,sim=true)=>{const box=node('#'+fieldset);const x=box?.querySelectorAll('input[type=checkbox]').find(i=>i.value===valor);if(!x)throw new Error('Opção ausente '+fieldset+':'+valor);x.checked=sim;x.onchange?.();return x;};
  const interagir=()=>{for(const [ev,fn] of ouvintes)if(ev==='input')fn();};
  return {app,node,route,rotear,click,submit,marcar,interagir,calls,toasts,ctx,SESSAO,edu:ctx.window.EDUCACAO,cat:ctx.window.ESCOLA_CATALOGO,acad:ctx.window.ACADEMIA,text:()=>app.textContent,get html(){return app.innerHTML;}};
}
