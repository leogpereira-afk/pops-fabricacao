import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const usuario = {usuario:'ana',papel:'equipe',identidadeConferida:true,pessoaRH:{colaboradorId:'rh-a'}};
const cacheKey = 'pops_v3_ana_equipe_rh_rh-a';
const estado = () => ({dados:{},cfg:{},fila:[],rev:{porColecao:{}},syncEm:'2026-10-01T10:00:00Z'});
function ambiente({inicial=estado(),online=true,fetcher,conhecimento=false,falharInicio=false,user=usuario,legado={},inicialKey=cacheKey}={}) {
  const storage = new Map([['pops_user',JSON.stringify(user)],...Object.entries(legado).map(([k,v])=>[k,JSON.stringify(v)])]);
  if(inicial!==null)storage.set(inicialKey,typeof inicial==='string'?inicial:JSON.stringify(inicial));
  let bloqueio=falharInicio, redeFalha=false;
  const chamadas=[], eventos=[], avisos=[], handlers={};
  const navigator={onLine:online};
  const context = vm.createContext({crypto:webcrypto,AbortController,navigator,AUTH:{cracha:()=>''},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(typeof bloqueio==='function'?bloqueio(k,v):bloqueio)throw new Error('quota');storage.set(k,v);},removeItem:k=>storage.delete(k)},
    window:{API_BASE:'http://test.local',API_FN:{sync:'pops'},CONHECIMENTO_VERSAO:conhecimento?'2':null,addEventListener:(event,fn)=>handlers[event]=fn},setTimeout:()=>1,clearTimeout(){},
    fetch:async(url,opts)=>{const b=JSON.parse(opts.body);chamadas.push(b);if(redeFalha)throw new Error('Sem conexão com o servidor');if(fetcher)return fetcher(b);
      return {ok:true,json:async()=>b.action==='rev'?{rev:{porColecao:{}}}:b.action==='getCfg'?{config:{}}:b.action==='list'?{itens:[]}:b.action==='conhecimento'?{conhecimento:{versao:'2',texto:'x'.repeat(100)}}:{ok:true,revision:1,registro:b.registro}};
    }});
  vm.runInContext(fs.readFileSync(new URL('../store.js',import.meta.url),'utf8')+'\nglobalThis.store = STORE;',context);
  const store=context.store;
  store.on('sync',e=>eventos.push(e));store.on('quota',e=>avisos.push(e));
  return {store,storage,navigator,chamadas,eventos,avisos,sair:event=>handlers.beforeunload?.(event),evento:(nome,event={})=>handlers[nome]?.(event),quota:(v=true)=>bloqueio=v,rede:(v=true)=>redeFalha=v};
}

test('quota numa gravação com fila vazia nunca termina como sincronizado',async()=>{
 const h=ambiente();h.quota();assert.equal(h.store.salvar('leituras',{id:'l1',usuario:'ana'}),false);await h.store.trySync();
 assert.equal(h.eventos.at(-1).status,'erro');assert.equal(h.store.getFila().length,0);assert.equal(h.storage.get(cacheKey),JSON.stringify(estado()));
});
test('falha de atualização não é apagada pela confirmação de fila vazia',async()=>{
 const h=ambiente();h.rede();assert.equal(await h.store.pull(),false);await h.store.trySync();assert.equal(h.eventos.at(-1).status,'erro');
});
test('cache antigo só recebe estado ok depois de uma atualização confirmada nesta sessão',async()=>{
 const h=ambiente();await h.store.trySync();assert.notEqual(h.eventos.at(-1).status,'ok');assert.equal(await h.store.pull(),true);assert.equal(h.store.resumoSync().status,'ok');
});
test('falha da base complementar conserva o último conteúdo e informa atualização parcial',async()=>{
 const ini=estado();ini.conhecimento={versao:'1',texto:'Base antiga'};
 const h=ambiente({inicial:ini,conhecimento:true});h.quota((k,v)=>v.includes('"versao":"2"'));
 assert.equal(await h.store.pull(),true);assert.equal(h.store.getConhecimento().versao,'1');assert.equal(h.store.resumoSync().status,'parcial');assert.equal(h.avisos.length,1);
});
test('registro local falho pode ser recuperado com o mesmo ID de envio e sem repetição',async()=>{
 const h=ambiente({online:false});h.quota();assert.equal(h.store.salvar('leituras',{id:'l1',usuario:'ana',versaoLida:'1'}),false);
 const draft=h.store.getNaoGravados()[0];assert.equal(draft.registro.id,'l1');assert.equal(h.store.col('leituras').length,0);assert.equal(h.store.exportarRecuperacao().naoGravados.length,1);
 h.quota(false);await h.store.tentarNovamente();assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].mutationId,draft.mutationId);assert.equal(h.store.getNaoGravados().length,0);
 await h.store.tentarNovamente();assert.equal(h.store.getFila().length,1);h.navigator.onLine=true;await h.store.tentarNovamente();assert.equal(h.store.getFila().length,0);assert.equal(h.chamadas.filter(x=>x.action==='upsert').length,1);
});
test('erro e rascunho não gravado são separados por usuário, papel e vínculo RH',async()=>{
 const h=ambiente({online:false});h.quota();h.store.salvar('leituras',{id:'l1',usuario:'ana'});h.quota(false);
 h.store.setUser({...usuario,pessoaRH:{colaboradorId:'rh-b'}});assert.equal(h.store.getNaoGravados().length,0);assert.notEqual(h.store.resumoSync().status,'erro');
 h.store.setUser(usuario);assert.equal(h.store.getNaoGravados().length,1);assert.equal(h.store.resumoSync().status,'erro');
});
test('cache ilegível não vira fila vazia sincronizada nem é sobrescrito na recuperação',async()=>{
 const h=ambiente({inicial:'{conteudo-incompleto'});await h.store.trySync();assert.equal(h.store.resumoSync().status,'erro');assert.equal(h.store.exportarRecuperacao().cacheOriginal,'{conteudo-incompleto');
 await h.store.tentarNovamente();assert.equal(h.storage.get(cacheKey),'{conteudo-incompleto');
});
test('retentativa não sobrescreve uma edição mais nova de outra aba',async()=>{
 const h=ambiente({online:false});h.quota();h.store.salvar('pops',{id:'pop1',titulo:'Tentativa local'});h.quota(false);
 const externo=estado();externo.dados.pops=[{id:'pop1',titulo:'Outra aba',_serverRevision:2}];h.storage.set(cacheKey,JSON.stringify(externo));
 assert.equal(await h.store.tentarNovamente(),false);assert.equal(h.store.col('pops')[0].titulo,'Outra aba');assert.equal(h.store.getNaoGravados().length,1);assert.equal(h.store.getFila().length,0);
});
test('falha ao gravar confirmação mantém envio idempotente na próxima tentativa',async()=>{
 let h, primeiro=true;h=ambiente({fetcher:async b=>{
   if(b.action==='upsert'&&primeiro){primeiro=false;h.quota();}
   return {ok:true,json:async()=>b.action==='upsert'?{ok:true,revision:4,registro:b.registro}:b.action==='rev'?{rev:{porColecao:{}}}:b.action==='list'?{itens:[]}:{config:{}}};
 }});
 h.store.salvar('leituras',{id:'l1',usuario:'ana'});const id=h.store.getFila()[0].mutationId;
 await h.store.trySync();assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].mutationId,id);assert.equal(h.store.resumoSync().status,'erro');
 h.quota(false);await h.store.tentarNovamente();assert.equal(h.store.getFila().length,0);assert.deepEqual(h.chamadas.filter(x=>x.action==='upsert').map(x=>x.mutationId),[id,id]);
});
test('falha parcial de download conserva data, dados e fila da última gravação válida',async()=>{
 const ini=estado();ini.dados.pops=[{id:'p1',titulo:'Último válido'}];ini.fila=[{action:'upsert',colecao:'leituras',id:'l1',registro:{id:'l1'},mutationId:'m1'}];
 const h=ambiente({inicial:ini});h.quota();assert.equal(await h.store.pull(),false);
 assert.equal(h.store.lastSync(),ini.syncEm);assert.equal(h.store.col('pops')[0].titulo,'Último válido');assert.equal(h.store.getFila()[0].mutationId,'m1');assert.equal(h.store.resumoSync().status,'erro');
});
test('retentativa manual não retira bloqueio de permissão ou conflito',async()=>{
 const ini=estado();ini.fila=[{action:'upsert',colecao:'pops',id:'p1',registro:{id:'p1'},mutationId:'m1',bloqueado:true,erro:'Não autorizado'}];
 const h=ambiente({inicial:ini});await h.store.tentarNovamente();assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].bloqueado,true);assert.equal(h.chamadas.some(x=>x.action==='upsert'),false);assert.equal(h.store.resumoSync().status,'revisar');
});
test('tentativa de cancelar cadastro ainda local é preservada sem envio de exclusão inexistente',async()=>{
 const h=ambiente({online:false});h.store.salvar('pops',{id:'p1'});h.quota();assert.equal(h.store.apagar('pops','p1'),false);assert.equal(h.store.getNaoGravados().length,1);
 h.quota(false);await h.store.tentarNovamente();assert.equal(h.store.col('pops').length,0);assert.equal(h.store.getFila().length,0);assert.equal(h.store.getNaoGravados().length,0);
});
test('HTTP 200 sem confirmação da mutação não remove a alteração da fila',async()=>{
 const h=ambiente({fetcher:async()=>({ok:true,json:async()=>({ok:true})})});h.store.salvar('leituras',{id:'l1',usuario:'ana'});await h.store.trySync();
 assert.equal(h.store.getFila().length,1);assert.equal(h.store.resumoSync().status,'erro');assert.match(h.store.getFila()[0].erro,/confirm/);
});
test('resposta de revisão incompleta não substitui coleções nem recebe sincronizado',async()=>{
 const ini=estado();ini.dados.pops=[{id:'p1',titulo:'Último válido'}];
 const h=ambiente({inicial:ini,fetcher:async()=>({ok:true,json:async()=>({ok:true})})});assert.equal(await h.store.pull(),false);assert.equal(h.store.col('pops')[0].id,'p1');assert.equal(h.store.resumoSync().status,'erro');assert.equal(h.chamadas.length,1);
});
test('rascunhos não gravados pedem aviso antes de sair desta página',()=>{
 const h=ambiente({online:false});h.quota();h.store.salvar('leituras',{id:'l1'});const event={preventDefault(){this.impedido=true;}};
 h.sair(event);assert.equal(event.impedido,true);assert.equal(event.returnValue,'');
});
test('recuperação válida do cache exige confirmação online antes de remover erro de leitura',async()=>{
 const h=ambiente({inicial:'{quebrado'});assert.equal(h.store.resumoSync().status,'erro');h.storage.set(cacheKey,JSON.stringify(estado()));
 assert.equal(await h.store.pull(),true);assert.equal(h.store.resumoSync().status,'ok');
});

test('migração sem espaço conserva a fila antiga disponível para a retentativa',async()=>{
 const antigo=estado();antigo.fila=[{action:'upsert',colecao:'leituras',id:'l1',registro:{id:'l1',usuario:'ana'},mutationId:'original'}];antigo.dados.leituras=[{id:'l1',usuario:'ana'}];
 const h=ambiente({inicial:null,user:{usuario:'ana',papel:'equipe'},legado:{pops_v2_ana:antigo},falharInicio:true,online:false});
 assert.equal(h.store.resumoSync().status,'erro');assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].mutationId,'original');
 h.quota(false);await h.store.tentarNovamente();assert.equal(h.store.getFila().length,1);assert.equal(h.store.getFila()[0].mutationId,'original');assert.ok(h.storage.has('pops_v3_ana_equipe'));assert.ok(h.storage.has('pops_v2_ana'));
});

const gestor={...usuario,papel:'gestor'};
const gestorKey='pops_v4_ana_gestor_rh_rh-a';
const gestorAntigoKey='pops_v3_ana_gestor_rh_rh-a';
const pessoais=['pessoas','atribuicoes','leituras','progresso'];
function dadosGestor(){const s=estado();s.dados={pops:[{id:'pop1',titulo:'Catálogo preservado'}],pessoas:[{id:'p-b',nome:'Outro setor'}],atribuicoes:[{id:'a-b',pessoaId:'p-b'}],leituras:[{id:'l-b',colaboradorId:'b'}],progresso:[{id:'j-b',pessoaId:'p-b'}]};s.fila=[{action:'upsert',colecao:'atribuicoes',id:'a-b',registro:s.dados.atribuicoes[0],mutationId:'preservar'}];s.rev.porColecao=Object.fromEntries(['pops','jornadas','treinamentos',...pessoais,'cfg'].map(x=>[x,0]));return s;}
function respostaGestor(b,escopo='a'){return {ok:true,json:async()=>b.action==='rev'?{rev:{porColecao:{}}}:b.action==='getCfg'?{config:{}}:b.action==='list'?{itens:pessoais.includes(b.colecao)?[{registro:b.colecao==='pessoas'?{id:'p-'+escopo,nome:'Pessoa '+escopo}:b.colecao==='atribuicoes'?{id:'a-'+escopo,pessoaId:'p-'+escopo}:{id:b.colecao+'-'+escopo,colaboradorId:escopo},revision:1}]:[]}:{ok:true,revision:2,registro:b.registro}};}
test('gestor migra só catálogo e preserva cache amplo, fila e rascunhos sem retransmitir',async()=>{
 const ini=dadosGestor();ini.rascunhos=[{colecao:'leituras',registro:{id:'r-b'}}];
 const h=ambiente({inicial:ini,inicialKey:gestorAntigoKey,user:gestor,online:false});
 assert.equal(h.store.col('pops')[0].id,'pop1');for(const c of pessoais)assert.equal(h.store.col(c).length,0);
 assert.equal(h.store.getFila().length,0);assert.equal(h.store.getRascunhos().length,0);assert.equal(h.storage.get(gestorAntigoKey),JSON.stringify(ini));
 assert.equal(JSON.parse(h.storage.get(gestorKey)).preservacao.pendentes,1);await h.store.trySync();assert.equal(h.chamadas.length,0);
});
test('gestor com quota na migração não expõe o cache amplo nem perde backup',()=>{
 const ini=dadosGestor();const h=ambiente({inicial:ini,inicialKey:gestorAntigoKey,user:gestor,falharInicio:true});
 assert.equal(h.store.col('pessoas').length,0);assert.equal(h.store.col('pops')[0].id,'pop1');assert.equal(h.store.resumoSync().status,'erro');assert.equal(h.storage.get(gestorAntigoKey),JSON.stringify(ini));
});
test('gestor exige consulta completa na sessão apesar de revisões locais iguais',async()=>{
 const h=ambiente({inicial:dadosGestor(),inicialKey:gestorKey,user:gestor,fetcher:async b=>respostaGestor(b)});
 assert.equal(h.store.col('pessoas').length,0);assert.equal(await h.store.pull(),true);assert.deepEqual(Array.from(h.store.col('pessoas'),x=>x.id),['p-a']);
 assert.equal(h.chamadas.filter(b=>b.action==='list'&&pessoais.includes(b.colecao)).length,4);assert.deepEqual(Array.from(h.store.col('atribuicoes'),x=>x.id),['a-a']);
 assert.equal(h.store.getFila().length,0);assert.equal(JSON.parse(h.storage.get(gestorKey)).fila[0].mutationId,'preservar');
});
test('gestor troca de escopo em novo pull sem depender da revisão dos registros',async()=>{
 let escopo='a';const h=ambiente({inicial:estado(),inicialKey:gestorKey,user:gestor,fetcher:async b=>respostaGestor(b,escopo)});
 await h.store.pull();assert.equal(h.store.col('pessoas')[0].id,'p-a');escopo='c';await h.store.pull();assert.deepEqual(Array.from(h.store.col('pessoas'),x=>x.id),['p-c']);
 assert.equal(h.chamadas.filter(b=>b.action==='list'&&pessoais.includes(b.colecao)).length,8);
});
test('gestor após falha parcial oculta dados pessoais, conserva arquivo e fila para recuperação',async()=>{
 let falhar=false;const h=ambiente({inicial:estado(),inicialKey:gestorKey,user:gestor,fetcher:async b=>{if(falhar&&b.colecao==='progresso')throw new Error('Falha de rede');return respostaGestor(b);}});
 await h.store.pull();assert.equal(h.store.col('pessoas').length,1);h.store.salvar('atribuicoes',{id:'nova',pessoaId:'p-a'});falhar=true;
 assert.equal(await h.store.pull(),false);for(const c of pessoais)assert.equal(h.store.col(c).length,0);
 assert.equal(JSON.parse(h.storage.get(gestorKey)).fila.length,1);assert.equal(h.store.getFila().length,0);assert.equal(h.store.resumoSync().status,'erro');
});
test('gestor não consulta dados pessoais offline nem reutiliza confirmação após novo login',async()=>{
 const h=ambiente({inicial:estado(),inicialKey:gestorKey,user:gestor,fetcher:async b=>respostaGestor(b)});await h.store.pull();assert.equal(h.store.col('pessoas').length,1);
 h.navigator.onLine=false;assert.equal(h.store.col('pessoas').length,0);h.navigator.onLine=true;h.store.setUser({...gestor,nome:'Mesmo gestor'});assert.equal(h.store.col('pessoas').length,0);
 await h.store.pull();assert.equal(h.store.col('pessoas').length,1);
});

test('eventos de escopo do gestor permitem ocultar o DOM antes de consultar e ao ficar offline',async()=>{
 const h=ambiente({inicial:estado(),inicialKey:gestorKey,user:gestor,fetcher:async b=>respostaGestor(b)}),eventos=[];
 h.store.on('escopoGestor',e=>eventos.push({...e,visiveis:h.store.col('pessoas').length}));
 await h.store.pull();assert.deepEqual(eventos.map(e=>[e.confirmado,e.visiveis]),[[false,0],[true,1]]);
 h.navigator.onLine=false;h.evento('offline');assert.equal(eventos.at(-1).confirmado,false);assert.equal(eventos.at(-1).motivo,'offline');
 h.navigator.onLine=true;assert.equal(h.store.col('pessoas').length,0);await h.store.pull();assert.equal(h.store.col('pessoas').length,1);
});
test('primeira migração do gestor sem RH também preserva legado sem importar pessoas ou fila',()=>{
 const ini=dadosGestor(),u={usuario:'ana',papel:'gestor'};
 const h=ambiente({inicial:null,user:u,legado:{pops_v2_ana:ini},online:false});
 assert.equal(h.store.col('pops')[0].id,'pop1');assert.equal(h.store.getFila().length,0);assert.equal(h.store.col('pessoas').length,0);
 assert.equal(JSON.parse(h.storage.get('pops_v2_ana')).fila[0].mutationId,'preservar');assert.equal(JSON.parse(h.storage.get('pops_v4_ana_gestor')).preservacao.pendentes,1);
});

test('migração do gestor para RH prefere o cache v4 atual ao backup v3 antigo',()=>{
 const antigo=dadosGestor(),atual=dadosGestor();atual.dados.pops=[{id:'pop-atual',titulo:'Mais recente'}];
 const h=ambiente({inicial:antigo,inicialKey:gestorAntigoKey,user:gestor,legado:{pops_v4_ana_gestor:atual},online:false});
 assert.equal(h.store.col('pops')[0].id,'pop-atual');assert.equal(JSON.parse(h.storage.get(gestorKey)).preservacao.chave,'pops_v4_ana_gestor');
 assert.equal(JSON.parse(h.storage.get('pops_v4_ana_gestor')).fila[0].mutationId,'preservar');
});
