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
const formacao={id:'montagem',titulo:'Montagem · Primeiros passos',versao:'1.0',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh-ana'],cargos:[],setores:[],todos:false},catalogo:{trilha:'integracao-demo',area:'Produção',nivel:'essencial',cargaMinutos:90,ordem:1,codigo:'DEMO-01'},etapas};
// Catálogo, famílias, cargos e vagas fictícios para conferir catálogo e matriz.
const aula={id:'a1',titulo:'Aula de sistema fictícia',tipo:'aula',obrigatoria:true,prerequisitos:[],pontos:10,conteudo,documentos:[],fontes:[],quiz:[],minimoAcerto:70,maxTentativas:3,duracaoMinutos:20};
const sistema={id:'sistema-basico',titulo:'Sistema de gestão · Primeiros passos',versao:'1.0',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-demo']},catalogo:{trilha:'sistema-demo',area:'Sistema de gestão',nivel:'essencial',cargaMinutos:20,ordem:1,preRequisitos:['montagem']},etapas:[aula]};
const rascunho={id:'sistema-financeiro',titulo:'Sistema de gestão · Rotinas administrativas',versao:'1.0',setor:'Produção',ativa:true,publicada:false,liberacao:{pessoas:[],cargos:['analista-demo'],setores:[],todos:false},catalogo:{trilha:'sistema-demo',nivel:'intermediario',ordem:2,preRequisitos:['sistema-basico']},etapas:[{...aula,id:'a2',titulo:'Rotina administrativa fictícia'}]};
const usuarios={ana:{usuario:'ana',nome:'Ana · Demonstração',papel:'equipe'},bruno:{usuario:'bruno',nome:'Bruno · Demonstração',papel:'equipe'},gestao:{usuario:'gestao',nome:'Gestão · Demonstração',papel:'admin'}};
export function servidorRevisao(){
 const cfg={gestores:{},educacao:{instrutores:{bruno:['Produção']},catalogo:{familias:{'operacao-demo':{nome:'Operação (demonstração)',descricao:'',cargos:['montador']},'gestao-demo':{nome:'Gestão (demonstração)',descricao:'',cargos:['analista-demo','cargo-vago-demo']}},trilhas:{'integracao-demo':{nome:'Integração (demonstração)',descricao:'Primeiros passos de quem chega.',ordem:0},'sistema-demo':{nome:'Sistema de gestão (demonstração)',descricao:'Uma aula por rotina do sistema.',ordem:1}}}},setores:['Produção','Comercial'],areas:[{nome:'Operações',setores:['Produção']}],conhecimentoBase:{versao:'2026.10.05',fontes:[],cargos:[],topicos:[],jornadas:[]}};
 const data={pops:[{id:'p1',titulo:'Conferir antes de executar',codigo:'DEMO-01',versao:'1.0',setor:'Produção',objetivo:'Demonstração, não é procedimento oficial.',blocos:[{tipo:'paragrafo',texto:'Conteúdo fictício para conferir o funcionamento da escola.'}],revisao:{status:'validado',por:'Demonstração',em:'2026-10-08'}}],jornadas:[],treinamentos:[{id:'demo',titulo:'Material de demonstração',versao:'1.0',blocos:[{tipo:'paragrafo',texto:'Este é um conteúdo fictício. As fontes oficiais serão vinculadas pela gestão.'}]}],pessoas:[],atribuicoes:[],leituras:[],progresso:[]};
 const tables={acesso_conta:Object.values(usuarios).map(u=>({id:'c-'+u.usuario,usuario:u.usuario,colaborador_id:'rh-'+u.usuario,ativo:true})),acesso_papel:Object.values(usuarios).map(u=>({conta_id:'c-'+u.usuario,login:u.usuario,sistema:'pops',ativo:true,papel:u.papel})),registros:Object.values(usuarios).map((u,i)=>row('colaboradores',{id:'rh-'+u.usuario,nome:u.nome,idPessoa:String(900001+i),setor:'Produção',cargoId:'montador',areaId:'operacoes'})).concat([row('cargos',{id:'montador',nome:'Montagem',areaId:'operacoes'}),row('cargos',{id:'analista-demo',nome:'Analista fictício',areaId:'gestao-demo'}),row('cargos',{id:'cargo-vago-demo',nome:'Cargo vago fictício',areaId:'gestao-demo'}),row('areas',{id:'operacoes',nome:'Operações'}),row('areas',{id:'gestao-demo',nome:'Gestão fictícia'}),row('vagas',{id:'vaga-demo-1',titulo:'Vaga fictícia com cargo',cargoId:'cargo-vago-demo',areaId:'gestao-demo',status:'Aberta',nivelId:'N1'}),row('vagas',{id:'vaga-demo-2',titulo:'Vaga fictícia sem cargo',areaId:'operacoes',status:'Prevista',nivelId:'N1'})])};
 const privados=[],storageFiles={};
 if(process.env.EDUCACAO_FONTES){const pacote=JSON.parse(readFileSync(process.env.EDUCACAO_FONTES,'utf8'));for(const fonte of pacote.materiais){const m=structuredClone(fonte);delete m.arquivoLocal;m.publicada=true;m.liberacao={pessoas:['rh-ana'],cargos:[],setores:[]};privados.push(row('materiais',m));storageFiles['pops-escola-documentos/'+m.arquivoPath]=new Uint8Array(readFileSync(fonte.arquivoLocal));}}
 if(process.env.EDUCACAO_FONTES){try{const q=JSON.parse(readFileSync(path.join(path.dirname(process.env.EDUCACAO_FONTES),'avaliacao-etica-rascunho.json'),'utf8'));privados.push(row('formacoes',q.formacao));}catch(e){if(e.code!=='ENOENT')throw e;}}
 // EDUCACAO_PACOTE: pacote da escola (catálogo e cursos), que mora fora do repositório. Mostra a jornada como
 // ficará depois da gestão aprovar e liberar: só na prévia, provas aprovadas, documentos conferidos e tudo liberado.
 if(process.env.EDUCACAO_PACOTE){const p=JSON.parse(readFileSync(process.env.EDUCACAO_PACOTE,'utf8'));cfg.educacao.catalogo={familias:{...cfg.educacao.catalogo.familias,...p.catalogo.familias},trilhas:{...cfg.educacao.catalogo.trilhas,...p.catalogo.trilhas}};
  for(const c of p.cursos){const f=structuredClone(c);f.publicada=true;f.ativa=true;f.liberacao={pessoas:[],cargos:[],setores:[],...f.liberacao,todos:true};for(const e of f.etapas){if(e.quiz?.length)e.aprovacao={por:'gestao',em:'2026-10-15T12:00:00Z',versao:f.versao};for(const d of e.documentos||[]){d.oficialConfirmado=true;d.conferidoPor='gestao';d.conferidoEm='2026-10-15T12:00:00Z';}}privados.push(row('formacoes',f));}}
 // Entrada do aluno na prévia: IDs fictícios 900001 (Ana), 900002 (Bruno), 900003 (Gestão); limite de tentativas sempre livre;
 // a configuração gravada pela tela fica na memória da prévia.
 const b=backend({config:cfg,tables,persistWrites:true,storageFiles,rpcs:{pops_entrada_aluno:async()=>({data:{ok:true,bloqueado:false},error:null}),pops_entrada_aluno_bloqueios:async a=>({data:{ok:true,bloqueios:0,...(a.p_liberar?{liberados:0}:{})},error:null}),pops_configurar:async a=>{Object.assign(cfg,structuredClone(a.p_patch));return {data:{ok:true,config:cfg},error:null};}},rows:[...privados,...Object.entries(data).flatMap(([col,rs])=>rs.map(r=>row(col,r))),row('formacoes',formacao),row('formacoes',sistema),row('formacoes',rascunho)]});
 return http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try{
   if(url.pathname.startsWith('/api/')){
    let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw || '{}');
    let user=usuarios.ana,aluno=null;try{const token=req.headers.authorization?.split(' ')[1];const p=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));if(p.sis==='pops-aluno')aluno=token;user=usuarios[p.sub] || user;}catch{}
    const send=(obj,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
    // Aluno: a porta pública e o crachá dele passam direto pelo servidor real em sandbox.
    if(body.action==='entrarAluno'){const r=await b.call(body,{}, {semCracha:true,headers:{'x-forwarded-for':'127.0.0.1'}});send(r.body,r.status);return;}
    if(aluno){const r=await b.call(body,{}, {token:aluno});send(r.body,r.status);return;}
    if(url.pathname.endsWith('equipe-auth')){send({...user,ok:true,trocarSenha:false});return;}
    if(body.action==='conhecimento'){send({ok:true,conhecimento:cfg.conhecimentoBase});return;}
    const r=await b.call(body,{sub:user.usuario,nome:user.nome,papel:user.papel});send(r.body,r.status);return;
   }
   let name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(!['index.html','app.js','store.js','auth.js','config.js','organizacao.js','conhecimento.js','treinamentos.js','educacao.js','academia.js','escola-gestao.js','escola-catalogo.js','styles.css','logo-impresilk.png','manifest.webmanifest','favicon.svg','icone-192.png','icone-512.png'].includes(name)){res.writeHead(404);res.end();return;}
   let out=await fs.readFile(path.join(root,name));
   if(name==='config.js')out=Buffer.from(out.toString().replace('https://heveemylixartyijxewh.supabase.co/functions/v1',url.origin.replace('http://localhost','') || '/api').replace('window.API_BASE = ""','window.API_BASE = "/api"'));
   if(name==='config.js')out=Buffer.from('window.API_BASE="/api";window.API_FN={sync:"pops-sync"};window.CONHECIMENTO_VERSAO="2026.10.05";');
   if(name==='index.html' && url.searchParams.get('entrada')==='1'){
    // ?entrada=1 abre a tela de entrada (sem sessão) para conferir as duas portas.
    out=Buffer.from(out.toString().replace('<body>','<body><script>localStorage.removeItem("pops_user");localStorage.removeItem("pops_cracha");localStorage.removeItem("pops_cracha_aluno");</script>'));
   }else if(name==='index.html'){
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
