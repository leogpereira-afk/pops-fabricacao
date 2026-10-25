// Ponte somente leitura com o Painel. A sessão de origem nunca é persistida.
const MP_BASE='https://leogpereira-afk.github.io/painel-impresilk/patrimonio';
const MP_STORAGE='https://heveemylixartyijxewh.supabase.co/storage/v1/object/public/painel-arquivos/';
const mpCopy=(v:any)=>JSON.parse(JSON.stringify(v));
const mpId=(v:any)=>typeof v==='string'&&/^[a-zA-Z0-9._:-]{1,180}$/.test(v);
const mpUrl=(s:any)=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&[...u.searchParams].every(([k,v])=>['rev','hash'].includes(k)&&/^[a-zA-Z0-9-]{1,128}$/.test(v))&&!u.hash&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname)?u.href:'';}catch{return '';}};
const mpLink=(r:any)=>MP_BASE+'?aba=maquinas&manual='+encodeURIComponent(r.tipo==='bem'?'bem:'+r.id:r.id);
const mpFoto=(m:any)=>{const fs=[m.conteudo?.foto,...(m.conteudo?.galeria||[])];for(const f of fs){if(!f?.usoConfirmado)continue;const u=mpUrl(f.url);if(!u)continue;if(u.startsWith(MP_STORAGE)){const raiz=`manuais/${m.referencia?.tipo}/${m.referencia?.id}/livre/`;if(!u.slice(MP_STORAGE.length).startsWith(raiz))continue;}else if(u.includes('/storage/v1/'))continue;return u;}return '';};
const mpPendencias=(m:any)=>[...(m.estado!=='aprovado'?['Manual aguarda aprovação técnica.']:[]),...(m.conteudo?.consumiveis||[]).some((x:any)=>x.compatibilidade==='pendente')?['Há consumíveis com compatibilidade pendente.']:[],...(m.conteudo?.fontes||[]).some((x:any)=>x.situacao!=='verificado')?['Há fontes ainda não verificadas.']:[]];
export function criarMaquinasEscola(ctx:any){
 const {sb,admin,usuario,registro,todos,gravar,conferir,fail}=ctx;
 const fontes=new Map<string,any>();
 const fonte=async(id:string)=>{if(fontes.has(id))return fontes.get(id);if(!mpId(id))fail('Identificador do manual inválido.');const r=conferir(await sb.from('painel_registros').select('id,estado:registro->>estado,revisao:registro->revisao,referencia:registro->referencia').eq('colecao','manuais_maquinas').eq('id',id).maybeSingle());const m=r?(r.registro||r):null;fontes.set(id,m);return m;};
 const origem=async()=>{
  if(!admin)fail('Somente a administração prepara cursos por máquina.',403);
  if(!ctx.painelToken)fail('Entre no Painel com acesso aos manuais, neste navegador, e volte para atualizar.',403);
  const chamar=async(action:string)=>{let r;try{r=await fetch(Deno.env.get('SUPABASE_URL')+'/functions/v1/painel-config',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+ctx.painelToken},body:JSON.stringify({action}),signal:AbortSignal.timeout(20000)});}catch{fail('A consulta do Painel não respondeu. Tente novamente.',503);}const d=await r.json().catch(()=>({}));if(!r.ok)fail('Não foi possível consultar os manuais com seu acesso ao Painel.',r.status===401?403:r.status===403?403:503);if(!Array.isArray(d.itens))fail('Resposta de manuais inválida.',503);return d.itens;};
  const [ms,cs]=await Promise.all([chamar('manuaisMaquinasListar'),chamar('manuaisMaquinasCatalogo')]);
  return ms.flatMap((m:any)=>{const c=cs.find((c:any)=>(m.referencias||[m.referencia]).some((r:any)=>r.tipo==='ativo'?c.id===r.id:c.bem?.id===r.id));if(!c||c.conflitoVinculo||!mpId(m.id)||!Number.isInteger(m.revisao))return [];return [{m,c}];});
 };
 const pendencia=async(f:any)=>{if(!f.origemMaquina)return '';try{const m=await fonte(f.origemMaquina.manualId);if(!m)return 'Manual de origem indisponível. A gestão precisa conferir o vínculo.';if(JSON.stringify(m.referencia)!==JSON.stringify(f.origemMaquina.referencia))return 'O vínculo da máquina mudou. A gestão precisa conferir o treinamento.';const ref=m.referencia;const bem=conferir(await sb.from('painel_registros').select('id').eq('colecao',ref.tipo==='ativo'?'ativo':'patrimonio').eq('id',ref.id).maybeSingle());if(!bem)return 'Máquina indisponível no Patrimônio. A gestão precisa conferir o vínculo.';if(m.revisao!==f.origemMaquina.revisao)return 'O manual mudou. A gestão precisa revisar o treinamento.';if(m.estado!=='aprovado')return 'O manual aguarda aprovação técnica.';return '';}catch{return 'Não foi possível conferir o manual. Retome com conexão antes de avançar.';}};
 const foto=async(f:any)=>{const u=mpUrl(f.origemMaquina?.foto);if(!u)return '';if(!u.startsWith(MP_STORAGE))return u.includes('/storage/v1/')?'':u;const p=u.slice(MP_STORAGE.length),r=f.origemMaquina.referencia;if(!r||!p.startsWith(`manuais/${r.tipo}/${r.id}/livre/`)||!/^manuais\/(ativo|bem)\/[\w-]+\/livre\/[a-f0-9-]+\.(png|jpg|webp)$/.test(p))return '';const {data,error}=await sb.storage.from('painel-arquivos').createSignedUrl(p,600);return error?'':data?.signedUrl||'';};
 const decorar=async(f:any)=>{if(!f.origemMaquina)return null;const o=f.origemMaquina;return {manualId:o.manualId,revisao:o.revisao,nome:o.nome,url:mpLink(o.referencia),foto:await foto(f),pendencia:await pendencia(f)};};
 const validarEdicao=async(f:any,ant:any)=>{
  if(!ant?.origemMaquina){if(f.origemMaquina)fail('Crie o vínculo pelo catálogo de máquinas.',403);return;}
  // A autoria de origem é do servidor: o editor comum não altera nem remove.
  if(f.origemMaquina&&JSON.stringify(f.origemMaquina)!==JSON.stringify(ant.origemMaquina))fail('O vínculo do manual mudou. Use Atualizar do manual.',409);
  f.origemMaquina=mpCopy(ant.origemMaquina);
  delete f.maquina;
  for(const e of f.etapas||[])if(e.id==='video')e.requerVideo=true;
  if(f.publicada){
   const p=await pendencia(f);if(p)fail(p,409);
   const ids=['conhecer','seguranca','preparar','operar','cuidar','video','avaliacao','pratica'];
   if(ids.some((id,i)=>!f.etapas?.some((e:any)=>e.id===id&&e.obrigatoria===true&&(i===0||(e.prerequisitos||[]).includes(ids[i-1])))))fail('Mantenha as oito etapas obrigatórias e sua sequência para liberar o treinamento.',409);
   if(f.etapas.find((e:any)=>e.id==='avaliacao').tipo!=='avaliacao'||f.etapas.find((e:any)=>e.id==='pratica').tipo!=='pratica')fail('Mantenha avaliação e prática acompanhada nos tipos correspondentes.',409);
  }
 };
 const gerar=async(m:any,c:any,ant:any)=>{
  const id=ant?.id||'maq-'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(m.id)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const txt=m.conteudo||{},versao='manual-'+m.revisao;
  const passos=[['conhecer','Conhecer a máquina',txt.finalidade,10],['seguranca','Segurança antes de começar',txt.seguranca,10],['preparar','Preparar o trabalho',txt.preparacao,15],['operar','Operação acompanhada',txt.operacao,20],['cuidar','Qualidade, limpeza e encerramento',[txt.qualidade,txt.limpeza,txt.encerramento,txt.problemas].filter(Boolean).join('\n\n'),15],['video','Demonstração em vídeo','Assista ao vídeo revisado para este modelo. Registre dúvidas e converse com o instrutor.',10],['avaliacao','Conferir o aprendizado','Responda à avaliação preparada e revisada pelo responsável.',20],['pratica','Demonstrar com o instrutor','Combine a prática no posto de trabalho. O responsável acompanha e confere a execução.',30]];
  const etapas=passos.map(([eid,titulo,texto,pontos],i)=>{const old=ant?.etapas?.find((e:any)=>e.id===eid);return {id:eid,titulo,...(eid==='video'?{requerVideo:true}:{}),tipo:eid==='pratica'?'pratica':eid==='avaliacao'?'avaliacao':'aula',obrigatoria:true,prerequisitos:i?[passos[i-1][0]]:[],pontos:old?.pontos??pontos,preparacaoPendente:!texto||['video','avaliacao','pratica'].includes(String(eid)),conteudo:{aprender:String(titulo),importancia:'Entender o procedimento desta máquina e reconhecer quando pedir orientação.',comoFazer:texto||'Orientação pendente no manual. Completar antes de liberar.',erros:'Não improvisar parâmetros nem substituir o acompanhamento do responsável.',evidencia:eid==='pratica'?'Descreva a prática acompanhada e aguarde validação.':'Explique o que aprendeu e registre as dúvidas.'},fontes:[],documentos:[],materiais:mpCopy(old?.materiais||[]),quiz:mpCopy(old?.quiz||[]),checklist:mpCopy(old?.checklist||(eid==='pratica'?['Conferi a identificação e a orientação vigente com o instrutor','Demonstrei a atividade com acompanhamento','Conferi o resultado e o encerramento com o responsável']:[])),validadores:mpCopy(old?.validadores||[]),minimoAcerto:old?.minimoAcerto||80,maxTentativas:old?.maxTentativas||3};});
  etapas.push(...mpCopy((ant?.etapas||[]).filter((e:any)=>!passos.some(p=>p[0]===e.id))).map((e:any)=>({...e,preparacaoPendente:true,aprovacao:undefined})));
  const historico=mpCopy(ant?.versoesAnteriores||[]);if(ant)historico.push({versao:ant.versao,titulo:ant.titulo,etapas:mpCopy(ant.etapas),origemMaquina:mpCopy(ant.origemMaquina),arquivadaEm:new Date().toISOString(),por:usuario});
  return {id,titulo:ant?.titulo||c.nome+' · Treinamento',setor:ant?.setor||c.setor||'A definir',versao,ativa:ant?.ativa!==false,publicada:false,liberacao:mpCopy(ant?.liberacao||{pessoas:[],cargos:[],setores:[],todos:false}),catalogo:mpCopy(ant?.catalogo||{area:'Máquinas',nivel:'essencial',resumo:'Aprenda a conhecer, preparar, operar e cuidar desta máquina com acompanhamento.'}),etapas,origemMaquina:{manualId:m.id,referencia:mpCopy(m.referencia),revisao:m.revisao,nome:c.nome,foto:mpFoto(m)},versoesAnteriores:historico,atualizadoPor:usuario,atualizadoEm:new Date().toISOString()};
 };
 const operar=async(body:any)=>{
  if(!admin)fail('Somente a administração prepara cursos por máquina.',403);
  const itens=await origem(),fs=await todos('formacoes');
  if(body.operacao==='maquinas.catalogo')return {ok:true,itens:await Promise.all(itens.map(async({m,c}:any)=>{const f=fs.find((f:any)=>f.origemMaquina?.manualId===m.id);const base={origemMaquina:{referencia:m.referencia,foto:mpFoto(m)}};return {manualId:m.id,nome:c.nome,setor:c.setor,modelo:c.modelo,revisao:m.revisao,estado:m.estado,foto:await foto(base),url:mpLink(m.referencia),pendencias:mpPendencias(m),cursoId:f?.id||null,cursoRevisao:f?.origemMaquina?.revisao||null,cursoRevision:f?._serverRevision||0};}))};
  if(!['maquinas.gerar','maquinas.atualizar'].includes(body.operacao))fail('Operação de máquina desconhecida.');
  if(!mpId(body.mutationId))fail('Identificador de envio inválido.');
  const item=itens.find((x:any)=>x.m.id===body.manualId);if(!item)fail('Manual não encontrado no seu acesso.',404);
  const {m,c}=item;if(m.revisao!==body.revisaoManual)fail('O manual mudou. Atualize o catálogo.',409);
  const existente=fs.filter((f:any)=>f.origemMaquina?.manualId===m.id);if(existente.length>1)fail('Há cursos duplicados para este manual. Confira antes de continuar.',409);
  const ant=existente[0];
  if(ant&&body.operacao==='maquinas.gerar')return {ok:true,registro:ant,revision:ant._serverRevision,repetido:true};
  if(body.operacao==='maquinas.atualizar'){
   if(!ant)fail('Curso não encontrado.',404);
   const row=await registro('formacoes',ant.id);
   if(row?.mutation_id===body.mutationId&&row.registro.atualizadoPor===usuario)return {ok:true,registro:row.registro,revision:row.revision,repetido:true};
   if(body.expectedRevision!==row?.revision)fail('O curso mudou. Atualize antes de revisar.',409);
   if(ant.origemMaquina.revisao===m.revisao)fail('O curso já usa esta revisão do manual.',409);
  }
  const f=await gerar(m,c,ant);
  if(f.versoesAnteriores.some((v:any)=>v.versao===f.versao))fail('Esta versão já existe no histórico. Confira a origem.',409);
  return gravar('formacoes',f,ant?._serverRevision||0,body.mutationId);
 };
 return {operar,pendencia,decorar,validarEdicao};
}
