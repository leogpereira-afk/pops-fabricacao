// Ambiente local com pessoas e conteúdos fictícios. Não acessa produção.
import http from 'node:http';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {backend} from '../tests/helpers.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
const row=(colecao,registro)=>({colecao,id:registro.id,registro,revision:1,apagado:false});
const conteudo={aprender:'Conferir a atividade antes de executar.',importancia:'Uma conferência cuidadosa protege o trabalho e evita refazer etapas.',comoFazer:'Neste exemplo de demonstração, consulte o material, confira o pedido e converse com o responsável antes de executar.',erros:'Não avance com uma informação que você ainda não compreendeu.',evidencia:'Explique a orientação e demonstre a execução acompanhada. Conteúdo fictício para testar a navegação.'};
const nomes=['Conhecer a Impresilk','Código de Ética e Conduta','Caderno da função','POPs da função','Prática acompanhada','Avaliação e conclusão','Educação contínua'];
const tipos=['cultura','etica','caderno','pop','pratica','avaliacao','continua'];
const etapas=nomes.map((titulo,i)=>({id:'e'+i,titulo,tipo:tipos[i],obrigatoria:i!==6,prerequisitos:i?['e'+(i-1)]:[],pontos:10,conteudo,aprovacao:{por:'gestao',em:'2026-10-08T12:00:00Z',versao:'1.0'},documentos:[],fontes:[1,2,3].includes(i)?[{tipo:'treinamento',refId:'demo',versao:'1.0',oficialConfirmado:true,conferidoPor:'gestao',conferidoEm:'2026-10-08T12:00:00Z'}]:[],quiz:[1,5].includes(i)?[{id:'q1',pergunta:'Ao encontrar uma dúvida na tarefa, como agir?',opcoes:['Conferir a orientação com o responsável','Improvisar para terminar mais rápido'],correta:0,explicacao:'Conferir a orientação ajuda a evitar erros e garante que o trabalho seja compreendido.',revisar:'Como fazer corretamente'}]:[],minimoAcerto:80,maxTentativas:3,checklist:i===4?['Conferi o pedido do exemplo','Demonstrei a atividade com acompanhamento']:[],validadores:i===4?['bruno']:[],duracaoMinutos:i===0?10:undefined}));
const formacao={id:'montagem',titulo:'Montagem · Primeiros passos',versao:'1.0',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh-ana'],cargos:[],setores:[],todos:false},etapas};
const usuarios={ana:{usuario:'ana',nome:'Ana · Demonstração',papel:'equipe'},bruno:{usuario:'bruno',nome:'Bruno · Demonstração',papel:'equipe'},gestao:{usuario:'gestao',nome:'Gestão · Demonstração',papel:'admin'}};
export function servidorRevisao(){
 const cfg={gestores:{},educacao:{instrutores:{bruno:['Produção']}},setores:['Produção','Comercial'],areas:[{nome:'Operações',setores:['Produção']}],conhecimentoBase:{versao:'2026.10.05',fontes:[],cargos:[],topicos:[],jornadas:[]}};
 const data={pops:[{id:'p1',titulo:'Conferir antes de executar',codigo:'DEMO-01',versao:'1.0',setor:'Produção',objetivo:'Demonstração, não é procedimento oficial.',blocos:[{tipo:'paragrafo',texto:'Conteúdo fictício para conferir o funcionamento da escola.'}],revisao:{status:'validado',por:'Demonstração',em:'2026-10-08'}}],jornadas:[],treinamentos:[{id:'demo',titulo:'Material de demonstração',versao:'1.0',blocos:[{tipo:'paragrafo',texto:'Este é um conteúdo fictício. As fontes oficiais serão vinculadas pela gestão.'}]}],pessoas:[],atribuicoes:[],leituras:[],progresso:[]};
 const tables={acesso_conta:Object.values(usuarios).map(u=>({id:'c-'+u.usuario,usuario:u.usuario,colaborador_id:'rh-'+u.usuario,ativo:true})),acesso_papel:Object.values(usuarios).map(u=>({conta_id:'c-'+u.usuario,login:u.usuario,sistema:'pops',ativo:true,papel:u.papel})),registros:Object.values(usuarios).map(u=>row('colaboradores',{id:'rh-'+u.usuario,nome:u.nome,setor:'Produção',cargoId:'montador',areaId:'operacoes'})).concat([row('cargos',{id:'montador',nome:'Montagem'}),row('areas',{id:'operacoes',nome:'Operações'})])};
 const privados=[],storageFiles={};
 if(process.env.EDUCACAO_FONTES){const pacote=JSON.parse(readFileSync(process.env.EDUCACAO_FONTES,'utf8'));for(const fonte of pacote.materiais){const m=structuredClone(fonte);delete m.arquivoLocal;m.publicada=true;m.liberacao={pessoas:['rh-ana'],cargos:[],setores:[]};privados.push(row('materiais',m));storageFiles['pops-escola-documentos/'+m.arquivoPath]=new Uint8Array(readFileSync(fonte.arquivoLocal));}}
 if(process.env.EDUCACAO_FONTES){try{const q=JSON.parse(readFileSync(path.join(path.dirname(process.env.EDUCACAO_FONTES),'avaliacao-etica-rascunho.json'),'utf8'));privados.push(row('formacoes',q.formacao));}catch(e){if(e.code!=='ENOENT')throw e;}}
 const b=backend({config:cfg,tables,persistWrites:true,storageFiles,rows:[...privados,...Object.entries(data).flatMap(([col,rs])=>rs.map(r=>row(col,r))),row('formacoes',formacao)]});
 return http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try{
   if(url.pathname.startsWith('/api/')){
    let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw || '{}');
    let user=usuarios.ana;try{const token=req.headers.authorization?.split(' ')[1];user=usuarios[JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub] || user;}catch{}
    const send=(obj,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
    if(url.pathname.endsWith('equipe-auth')){send({...user,ok:true,trocarSenha:false});return;}
    if(body.action==='conhecimento'){send({ok:true,conhecimento:cfg.conhecimentoBase});return;}
    const r=await b.call(body,{sub:user.usuario,nome:user.nome,papel:user.papel});send(r.body,r.status);return;
   }
   let name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!['index.html','app.js','store.js','auth.js','config.js','organizacao.js','conhecimento.js','treinamentos.js','educacao.js','academia.js','escola-gestao.js','styles.css','logo-impresilk.png','manifest.webmanifest','favicon.svg','icone-192.png','icone-512.png'].includes(name)){res.writeHead(404);res.end();return;}
   let out=await fs.readFile(path.join(root,name));
   if(name==='config.js')out=Buffer.from(out.toString().replace('https://heveemylixartyijxewh.supabase.co/functions/v1',url.origin.replace('http://localhost','') || '/api').replace('window.API_BASE = ""','window.API_BASE = "/api"'));
   if(name==='config.js')out=Buffer.from('window.API_BASE="/api";window.API_FN={sync:"pops-sync"};window.CONHECIMENTO_VERSAO="2026.10.05";');
   if(name==='index.html'){
    const user=usuarios[url.searchParams.get('pessoa')] || usuarios.ana;
    const token=['demo',Buffer.from(JSON.stringify({sub:user.usuario})).toString('base64url'),'demo'].join('.');
    const init=`<script>localStorage.setItem('pops_user',${JSON.stringify(JSON.stringify(user))});localStorage.setItem('pops_cracha',${JSON.stringify(token)});</script><div style="background:#fff0c5;padding:8px 16px;text-align:center;font:13px sans-serif;color:#654510">PRÉVIA LOCAL · Pessoas e registros fictícios${process.env.EDUCACAO_FONTES?' · Documentos reais em revisão':''} · <a href="/?pessoa=ana">Colaboradora</a> · <a href="/?pessoa=bruno#/escola">Instrutor</a> · <a href="/?pessoa=gestao#/escola">Gestão</a></div>`;
    out=Buffer.from(out.toString().replace('<body>','<body>'+init));
   }
   res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':name.endsWith('.svg')?'image/svg+xml':'text/html','Cache-Control':'no-store'});res.end(out);
  }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({erro:e.message}));}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=servidorRevisao();server.listen(Number(process.env.PORT || 5216),'127.0.0.1',()=>console.log('Prévia com dados fictícios: http://127.0.0.1:'+server.address().port));}
