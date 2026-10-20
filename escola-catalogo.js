/* Catálogo de cursos, matriz de cargos e importação de pacote da escola.
   Lê o painel pelo EDUCACAO (cópia do aparelho conferida com o servidor) e grava
   somente pelas operações da escola, que repetem as regras no servidor. */
window.ESCOLA_CATALOGO=(()=>{
 const A=()=>ACADEMIA,E=()=>EDUCACAO;
 const ID=/^[a-zA-Z0-9._:-]{1,160}$/,KEBAB=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
 const TIPOS_AULA=['cultura','etica','caderno','pop','pratica','avaliacao','continua','aula'],TIPOS_MATERIAL=['video','texto','documento','nr'],NIVEIS=['essencial','intermediario','avancado'];
 const objeto=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const kebab=(v,max=80)=>typeof v==='string'&&v.length<=max&&KEBAB.test(v);
 const inteiro=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const textoOk=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
 const opcionalOk=(v,max)=>v==null||v===''||(typeof v==='string'&&v.trim().length<=max);
 const httpsOk=u=>{try{const x=new URL(u);return x.protocol==='https:'&&!x.username&&!x.password;}catch{return false;}};
 const copia=v=>v==null?v:JSON.parse(JSON.stringify(v));
 const estavel=v=>Array.isArray(v)?'['+v.map(estavel).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+estavel(v[k])).join(',')+'}':JSON.stringify(v);
 const plural=(n,um,varios)=>n+' '+(n===1?um:varios);
 const ordemTrilha=([ka,a],[kb,b])=>(Number(a?.ordem)||0)-(Number(b?.ordem)||0)||String(a?.nome||ka).localeCompare(String(b?.nome||kb),'pt-BR');
 const ordemCurso=(a,b)=>(a.catalogo?.ordem??10001)-(b.catalogo?.ordem??10001)||String(a.titulo||'').localeCompare(String(b.titulo||''),'pt-BR');
 const slug=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/,'');

 // ───────────── Catálogo (aluno e gestão) ─────────────
 // Estado do curso para quem está vendo. Não liberado vem do servidor (liberada
 // false, histórico preservado ou curso recomendado fora do público da pessoa).
 // Arquivado (ativa false) não alcança ninguém: tem estado próprio, não é rascunho.
 const ESTADOS={concluido:'Concluído',em_andamento:'Em andamento',disponivel:'Disponível',nao_liberado:'Não liberado',em_preparacao:'Em preparação',arquivado:'Arquivado'};
 function estadoParaMim(f,aprendizagem=[]){
  if(f.ativa===false)return 'arquivado';
  if(f.somenteHistorico||f.historica)return 'nao_liberado';
  if(f.publicada!==true)return 'em_preparacao';
  if(f.liberada===false)return 'nao_liberado';
  const p=aprendizagem.find(r=>r.formacaoId===f.id);
  if((p?.concluidaEm&&p.formacaoVersao===f.versao)||(f.progresso?.total&&f.progresso.percentual===100))return 'concluido';
  if(p&&(p.iniciadaEm||Object.keys(p.etapas||{}).length))return 'em_andamento';
  return 'disponivel';
 }
 function gruposCatalogo(d){
  const cat=E().catalogoCfg(d),fs=d.formacoes||[],usados=new Set();
  const out=Object.entries(cat.trilhas).sort(ordemTrilha).map(([id,t])=>{const cursos=fs.filter(f=>f.catalogo?.trilha===id).sort(ordemCurso);cursos.forEach(f=>usados.add(f.id));return {id,nome:t.nome||id,descricao:t.descricao||'',cursos};});
  const resto=fs.filter(f=>!usados.has(f.id)).sort(ordemCurso);
  if(resto.length)out.push({id:'',nome:'Cursos sem trilha',descricao:'Cursos que ainda não foram organizados em uma trilha.',cursos:resto});
  // Sub-área (campo area do curso) dentro da área, na ordem do primeiro curso dela.
  for(const g of out){const subs=new Map();for(const f of g.cursos){const k=f.catalogo?.area&&norm(f.catalogo.area)!==norm(g.nome)?f.catalogo.area:'';if(!subs.has(k))subs.set(k,[]);subs.get(k).push(f);}g.subareas=[...subs.entries()].map(([nome,cursos])=>({nome,cursos}));}
  return out;
 }
 // Busca pelo nome que o chão usa: sem acento, sem hífen e sem plural simples
 // ("letra caixa" acha "Letra-caixa", "vendas" acha "Venda"), com as palavras-chave,
 // o resumo e o título das aulas (auditoria de 15/10, J10).
 const termos=t=>norm(t).replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean).map(w=>w.length>3&&w.endsWith('s')?w.slice(0,-1):w);
 const indiceBusca=(f,g)=>' '+termos([f.titulo,f.catalogo?.codigo,f.catalogo?.area,f.catalogo?.resumo,...(f.catalogo?.palavrasChave||[]),g?.nome,...(f.etapas||[]).map(e=>e.titulo),...(f.recomendadas||[]).map(r=>r.titulo)].filter(Boolean).join(' ')).join(' ')+' ';
 const casaBusca=(indice,q)=>termos(q).every(w=>indice.includes(' '+w));
 // Silk do cabeçalho da área escolhida (um por tela); a van fica na Montagem externa.
 const SILK_AREA={'nucleo-comum':'boas-vindas',comercial:'boas-vindas',producao:'rolo',adm:'apontando',administrativo:'apontando',lideranca:'confiante','gestao-lideranca':'confiante',carreira:'apontando'};
 const temVan=(trilha,sub)=>norm(sub)==='montagem externa'||(trilha==='instalacao'&&!sub);
 function cartaoSala(g){
  const v=E().visualArea(g.id);
  return '<button type="button" class="cat-sala" data-area="'+esc(g.id)+'" data-trilha="'+esc(g.id)+'" data-tema="'+v.tema+'" aria-pressed="false"><span class="cat-sala-arte" aria-hidden="true"><img class="cat-sala-imagem" src="'+v.imagem+'" width="384" height="384" alt="" decoding="async"><span class="cat-sala-seta">'+E().iconeEscola('seta')+'</span></span><span class="cat-sala-corpo"><strong>'+esc(g.nome)+'</strong><span class="cat-sala-meta">'+plural(g.cursos.length,'curso','cursos')+'</span><span class="cat-sala-escolha" aria-hidden="true">Escolher área</span></span></button>';
 }
 function progressoCartao(f,d,st){
  if(!['concluido','em_andamento','disponivel'].includes(st))return '';
  const p=(d.aprendizagem||[]).find(p=>p.formacaoId===f.id),pr=E().progresso(f,p);
  if(!pr.total)return '<p class="dica">Aulas obrigatórias a definir</p>';
  return '<div class="cat-progresso"><span>'+ (st==='disponivel'&&!pr.concluidas?'Não iniciado':pr.concluidas+' de '+pr.total+' aulas obrigatórias')+'</span><b>'+pr.percentual+'%</b><progress max="100" value="'+pr.percentual+'" aria-label="Progresso de '+esc(f.titulo)+'"></progress></div>';
 }
 function cartaoCurso(f,d){
  const st=estadoParaMim(f,d.aprendizagem||[]),c=f.catalogo||{},meta=[E().niveis[c.nivel],E().cargaTexto(c.cargaMinutos),c.codigo].filter(Boolean),gere=!!d.gestao?.podeGerir&&!!f.liberacao;
  const recs=(f.recomendadas||[]).map(r=>esc(r.titulo||r.id)+' ('+(r.concluida?'concluído':r.liberada?'disponível':'não liberado')+')');
  // Curso que a pessoa já fez e perdeu (troca de cargo, por exemplo) não é "ainda
  // não liberado": o histórico dela continua guardado e é para lá que ela vai.
  const historico='Seu histórico continua em <a href="#/conquistas">Meu histórico</a>.';
  const acao=st==='arquivado'?'<p class="dica">'+(f.somenteHistorico?'Curso arquivado. '+historico:'Curso arquivado: não alcança ninguém. Reative no editor do curso para voltar a liberar.')+'</p>'
   :st==='nao_liberado'?(f.somenteHistorico?'<p class="cat-aviso">Não está mais liberado para você. '+historico+'</p>'
    :gere?'<p class="dica">Você gerencia este curso, mas ele não está liberado para você como aluno.</p>'
    :'<p class="cat-aviso">Este curso ainda não foi liberado para você. Peça ao seu gestor.</p>')
   :st==='em_preparacao'?'<p class="dica">Rascunho: aparece só para quem gerencia.</p>'
   :'<a class="botao mini'+(st==='concluido'?' suave':'')+'" href="'+E().rota(f.id)+'">'+(st==='concluido'?'Rever curso':st==='em_andamento'?'Continuar':'Começar curso')+'</a>';
  return '<article class="cat-curso" data-estado="'+st+'"'+(c.trilha?' data-trilha="'+esc(c.trilha)+'"':'')+' data-busca="'+esc(indiceBusca(f,{nome:E().catalogoCfg(d).trilhas[c.trilha]?.nome}))+'">'+E().arteCurso(f,['concluido','em_andamento','disponivel'].includes(st)?E().rota(f.id):'')+'<div class="cat-curso-topo">'+(meta.length?'<span class="edu-meta">'+esc(meta.join(' · '))+'</span>':'<span></span>')+'<span class="edu-status '+st+'">'+ESTADOS[st]+'</span></div><h3>'+esc(f.titulo)+'</h3>'+(c.resumo?'<p class="edu-resumo-curso">'+esc(c.resumo)+'</p>':'')+'<p class="dica">'+plural((f.etapas||[]).length,'aula','aulas')+(f.prazo?' · prazo '+esc(fmtData(f.prazo)):'')+'</p>'+progressoCartao(f,d,st)+(recs.length?'<details class="cat-recomenda"><summary>Recomendado antes:</summary><p>'+recs.join(' · ')+'</p></details>':'')+'<div class="acoes">'+acao+(gere?'<a class="botao mini fantasma" href="#/formacao-editor/'+encodeURIComponent(f.id)+'">Gerenciar curso</a>':'')+'</div></article>';
 }
 function catalogo(app,d){
  const gs=gruposCatalogo(d),total=(d.formacoes||[]).length,gere=!!d.gestao?.podeGerir,arquivados=(d.formacoes||[]).some(f=>f.ativa===false);
  // O servidor manda ao aluno só os cursos liberados para ele (e os que ele já
  // fez). A tela não promete mostrar o que ele não recebe.
  const vazio=souAdmin()?'Nenhum curso nesta trilha ainda. A trilha do curso é escolhida no editor do curso.'
   :gere?'Nenhum curso desta trilha é do seu setor ou está liberado para você.'
   :'Nenhum curso desta trilha está liberado para você ainda. Se precisar de um, fale com seu gestor.';
  const el=A().layout(app,'Catálogo de cursos',gere?'Trilhas e cursos da Escola Impresilk, com o seu andamento em cada um.':'Trilhas e cursos liberados para você, com o seu andamento em cada um.',gere?'<a class="botao mini suave" href="#/matriz">Matriz de cargos</a>':'');
  const areas=gs.filter(g=>g.id&&g.cursos.length);
  el.innerHTML=E().htmlAtualizacaoPainel()+(areas.length?'<section class="cat-salas" aria-labelledby="cat-salas-titulo"><div class="cat-salas-cab"><div class="cat-salas-convite"><span class="cat-silk-guia">'+E().silk('boas-vindas',128)+'</span><div><span class="ac-kicker">APRENDA COM O SILK</span><h2 id="cat-salas-titulo">Escolha sua área</h2><p class="dica">Cada aprendizado é um novo passo. Escolha uma imagem e vamos juntos!</p></div></div><button type="button" class="chip cat-todas" data-area="" aria-pressed="true">'+E().iconeEscola('livro')+'Todas as salas</button></div><nav class="cat-salas-grade" aria-label="Áreas">'+areas.map(g=>cartaoSala(g)).join('')+'</nav></section>':'')+'<section class="card ac-filtros"><div class="campo"><label for="cat-busca">Buscar curso</label><input id="cat-busca" type="search" placeholder="Nome, máquina, setor ou assunto"></div><div class="campo"><label for="cat-estado">Mostrar</label><select id="cat-estado"><option value="">Todos os cursos</option>'+Object.entries(ESTADOS).filter(([k])=>(k!=='em_preparacao'||gere)&&(k!=='arquivado'||arquivados)).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div></section>'+
   '<p class="dica" id="cat-contagem" tabindex="-1" aria-live="polite"></p><section class="card cat-sem-resultados" id="cat-sem-resultados" hidden><h2>Nenhum curso neste filtro</h2><p>Experimente outro assunto ou veja todas as salas.</p><button type="button" class="botao suave mini" id="cat-limpar">Limpar filtros</button></section>'+
   (gs.length?gs.map(g=>{const feitos=g.cursos.filter(f=>estadoParaMim(f,d.aprendizagem||[])==='concluido').length,libs=g.cursos.filter(f=>!['nao_liberado','em_preparacao','arquivado'].includes(estadoParaMim(f,d.aprendizagem||[]))).length;
    const sub=s=>'<div class="cat-sub"'+(s.nome?' data-sub="'+esc(norm(s.nome))+'"':'')+'>'+(s.nome?'<h3 class="cat-sub-titulo">'+esc(s.nome)+'</h3>':'')+(temVan(g.id,s.nome)?'<img class="silk-faixa" src="./silk/silk-van-g.webp" srcset="./silk/silk-van-p.webp 640w, ./silk/silk-van-g.webp 1200w" sizes="(max-width: 600px) 100vw, 1144px" width="1200" height="670" alt="" aria-hidden="true" loading="lazy" decoding="async">':'')+'<div class="cat-grade">'+s.cursos.map(f=>cartaoCurso(f,d)).join('')+'</div></div>';
    return '<section class="cat-trilha" data-trilha="'+esc(g.id)+'"><div class="secao-titulo cat-area-topo">'+('<span class="cat-silk" hidden>'+E().silk(SILK_AREA[g.id]||'apontando',110)+'</span>')+'<div><span class="ac-kicker">'+(g.id?'Área':'Sem área')+'</span><h2>'+esc(g.nome)+'</h2>'+(g.descricao?'<p class="dica">'+esc(g.descricao)+'</p>':'')+'</div><span class="dica">'+(libs?'Concluídos: '+feitos+' de '+libs:'')+'</span></div>'+(g.cursos.length?g.subareas.map(sub).join(''):'<div class="cat-grade"><p class="dica cat-vazio">'+vazio+'</p></div>')+'</section>';}).join('')
   :'<section class="card"><h2>O catálogo está em preparação</h2><p>'+(total?'':'Ainda não há cursos liberados para você. ')+'As trilhas e os cursos aparecem aqui quando a gestão os organiza.</p></section>')+
   '<p class="dica">Cursos recomendados antes de outro são uma sugestão de ordem e não bloqueiam ninguém. Curso não liberado: peça ao seu gestor, que libera pelo cargo, pela família de cargos, pelo setor ou por pessoa.</p>';
  // Filtro por área: com uma área escolhida, o Silk dela aparece no cabeçalho;
  // em "Todas", o guia acolhe no seletor (um Silk por tela). Seção sem curso visível some.
  let area='';
  const pintar=()=>{const q=$('#cat-busca').value,st=$('#cat-estado').value;let n=0;
   $$('.cat-trilha').forEach(sec=>{const naArea=!area||sec.dataset.trilha===area;let vis=0;sec.querySelectorAll('.cat-sub').forEach(sb=>{let v=0;sb.querySelectorAll('.cat-curso').forEach(c=>{const ok=naArea&&(!q||casaBusca(c.dataset.busca,q))&&(!st||c.dataset.estado===st);c.hidden=!ok;if(ok){n++;v++;}});sb.hidden=!v;vis+=v;});const vazioSec=!sec.querySelector('.cat-sub');sec.hidden=!naArea||(!vis&&!vazioSec)||(vazioSec&&!!(q||st));const sk=sec.querySelector('.cat-silk');if(sk)sk.hidden=!area||[...sec.querySelectorAll('.cat-sub')].some(sb=>!sb.hidden&&!!sb.querySelector('.silk-faixa'));});
   $$('[data-area]').forEach(b=>{const selecionada=b.dataset.area===area;b.setAttribute('aria-pressed',String(selecionada));const escolha=b.querySelector('.cat-sala-escolha');if(escolha)escolha.textContent=selecionada?'Área selecionada':'Escolher área';});
   $$('.silk-faixa').forEach(img=>{img.hidden=!area;});
   const guia=$('.cat-silk-guia');if(guia)guia.hidden=!!area&&$$('.cat-trilha').some(sec=>!sec.hidden&&((sec.querySelector('.cat-silk')&&!sec.querySelector('.cat-silk').hidden)||[...sec.querySelectorAll('.cat-sub')].some(sb=>!sb.hidden&&!!sb.querySelector('.silk-faixa'))));
   $('#cat-contagem').textContent=plural(n,'curso','cursos')+' neste filtro.';$('#cat-sem-resultados').hidden=n>0||!total;};
  $$('[data-area]').forEach(b=>b.onclick=()=>{area=b.dataset.area;pintar();const resultado=$('#cat-contagem');resultado.scrollIntoView?.({block:'start'});resultado.focus?.({preventScroll:true});});
  $('#cat-limpar').onclick=()=>{area='';$('#cat-busca').value='';$('#cat-estado').value='';pintar();};
  $('#cat-busca').oninput=pintar;$('#cat-estado').onchange=pintar;pintar();
 }

 // ───────────── Matriz de cargos (gestão) ─────────────
 // Como o cargo recebe o curso: direto, por família ou por "todos". Liberação por
 // pessoa ou setor não se traduz em cargo e fica fora da matriz.
 function recebe(f,cargoId,cat){
  const l=f.liberacao||{};
  if(l.todos===true)return {tipo:'todos',texto:'Todos'};
  if((l.cargos||[]).includes(cargoId))return {tipo:'cargo',texto:l.cargosGestor?'Cargo (setores do gestor)':'Cargo'};
  const fam=(l.familias||[]).find(k=>(cat.familias[k]?.cargos||[]).includes(cargoId));
  if(fam)return {tipo:'familia',texto:'Família: '+(cat.familias[fam]?.nome||fam)};
  return null;
 }
 function matriz(app,d){
  const g=d.gestao||{};
  if(!g.podeGerir){A().layout(app,'Matriz restrita','A matriz de cargos é da gestão da escola.');return;}
  const cat=E().catalogoCfg(d),cargos=Array.isArray(g.cargosRH)?g.cargosRH:[],vagas=g.vagasRH||[],admin=souAdmin();
  // Curso arquivado não alcança ninguém (liberada() devolve false): fica fora das
  // colunas. Cobertura do cargo conta só curso liberado e ativo; o cargo coberto só
  // por rascunho aparece à parte.
  const geridos=(d.formacoes||[]).filter(f=>f.liberacao&&!f.somenteHistorico),vigente=f=>f.publicada===true&&f.ativa!==false;
  const cursos=geridos.filter(f=>f.ativa!==false).sort((a,b)=>String(a.catalogo?.trilha||'~').localeCompare(String(b.catalogo?.trilha||'~'))||ordemCurso(a,b)),arquivados=geridos.length-cursos.length;
  const cobertura=c=>cursos.some(f=>vigente(f)&&recebe(f,c.id,cat))?'liberado':cursos.some(f=>recebe(f,c.id,cat))?'rascunho':'';
  const fora=(d.formacoes||[]).filter(f=>!f.liberacao&&!f.somenteHistorico).length;
  const vagasPorCargo=new Map();for(const v of vagas)if(v.cargoId)vagasPorCargo.set(v.cargoId,[...(vagasPorCargo.get(v.cargoId)||[]),v]);
  const semCargo=vagas.filter(v=>!v.cargoId),trilhas=Object.entries(cat.trilhas).sort(ordemTrilha);
  const el=A().layout(app,'Matriz de cargos','Quais cursos cada cargo do RH recebe, inclusive os cargos sem ninguém hoje e os das vagas abertas.','<a class="botao mini suave" href="#/catalogo">Ver o catálogo</a>');
  el.innerHTML=E().htmlAtualizacaoPainel()+(!Array.isArray(g.cargosRH)?'<div class="aviso amarelo" role="status">O servidor ainda não enviou o cadastro de cargos do RH. Atualize a função da escola antes de usar a matriz.</div>':'')+
   (semCargo.length?'<div class="aviso amarelo" role="status"><b>'+plural(semCargo.length,'vaga sem cargo no RH','vagas sem cargo no RH')+':</b> '+esc(semCargo.map(v=>v.titulo+' ('+v.status+')').join(', '))+'. Sem cargo, a vaga não recebe cursos pela matriz. Peça ao RH para ligar a vaga a um cargo.</div>':'')+
   '<div class="edu-resumo"><span><strong>'+cargos.length+'</strong> cargos do RH</span><span><strong>'+vagasPorCargo.size+'</strong> com vaga aberta</span><span><strong id="mat-sem-curso">0</strong> sem curso liberado</span><span><strong>'+cursos.length+'</strong> cursos na matriz</span></div>'+
   '<section class="card ac-filtros"><div class="campo"><label for="mat-busca">Buscar cargo</label><input id="mat-busca" type="search" placeholder="Nome do cargo ou área"></div><div class="campo"><label for="mat-trilha">Cursos da trilha</label><select id="mat-trilha"><option value="">Todas as trilhas</option>'+trilhas.map(([k,t])=>'<option value="'+esc(k)+'">'+esc(t.nome||k)+'</option>').join('')+'<option value="__sem">Sem trilha</option></select></div><label class="edu-check"><input type="checkbox" id="mat-vagas"> Somente cargos com vaga aberta</label></section>'+
   '<div id="mat-tabela"></div><p class="dica">Liberações por pessoa ou por setor não aparecem aqui. Curso em rascunho só alcança alguém depois de liberado.'+(arquivados?' '+plural(arquivados,'curso arquivado fica fora da matriz','cursos arquivados ficam fora da matriz')+'.':'')+(fora?' '+plural(fora,'curso de outro setor não aparece','cursos de outros setores não aparecem')+' porque a liberação é de outra gestão.':'')+'</p>'+
   (admin?'<section class="card" id="cat-editor"><h2>Famílias de cargos e trilhas</h2><p>Família reúne cargos do RH: quem tem um desses cargos recebe os cursos liberados para a família. Trilha organiza os cursos no catálogo.</p><form id="cat-form"><h3>Famílias de cargos</h3><div id="cat-familias"></div><button type="button" class="botao mini suave" id="cat-add-familia">+ Família</button><h3>Trilhas</h3><div id="cat-trilhas"></div><button type="button" class="botao mini suave" id="cat-add-trilha">+ Trilha</button><div id="cat-erro" class="aviso amarelo" role="alert" hidden></div><div class="acoes"><button class="botao" type="submit" id="cat-salvar">Salvar famílias e trilhas</button><span class="dica">Família ou trilha em uso por curso ou material não pode ser excluída.</span></div></form></section>':'<p class="dica">Somente a administração organiza famílias de cargos e trilhas.</p>');
  const tabela=()=>{
   const q=norm($('#mat-busca').value),tr=$('#mat-trilha').value,soVaga=$('#mat-vagas').checked;
   const cols=cursos.filter(f=>!tr||(tr==='__sem'?!f.catalogo?.trilha||!Object.hasOwn(cat.trilhas,f.catalogo.trilha):f.catalogo?.trilha===tr));
   const linhas=cargos.filter(c=>(!q||norm(c.nome+' '+c.area).includes(q))&&(!soVaga||vagasPorCargo.has(c.id)));
   let semCurso=0;for(const c of cargos)if(cobertura(c)!=='liberado')semCurso++;$('#mat-sem-curso').textContent=semCurso;
   $('#mat-tabela').innerHTML=!linhas.length?'<section class="card"><p>Nenhum cargo neste filtro.</p></section>':!cols.length?'<section class="card"><p>Nenhum curso nesta trilha.</p></section>':
    '<div class="rolagem-x" role="region" aria-label="Matriz de cargos e cursos" tabindex="0"><table class="tab-mapa tab-matriz"><thead><tr><th scope="col">Cargo</th>'+cols.map(f=>'<th scope="col"><span>'+esc(f.titulo)+'</span><small>'+esc([cat.trilhas[f.catalogo?.trilha]?.nome,f.publicada?'':'rascunho'].filter(Boolean).join(' · '))+'</small></th>').join('')+'</tr></thead><tbody>'+
    linhas.map(c=>{const vs=vagasPorCargo.get(c.id)||[],cob=cobertura(c),nenhum=cob!=='liberado';return '<tr'+(nenhum?' class="sem-curso"':'')+'><th scope="row"><b>'+esc(c.nome||c.id)+'</b><small>'+esc(c.area||'Área não informada')+'</small>'+(vs.length?'<span class="mat-vaga">'+plural(vs.length,'vaga aberta','vagas abertas')+'</span>':'')+((c.familias||[]).length?'<small>Famílias: '+esc(c.familias.map(k=>cat.familias[k]?.nome||k).join(', '))+'</small>':'')+(nenhum?'<small class="mat-alerta">'+(cob==='rascunho'?'Só curso em rascunho para este cargo':'Nenhum curso liberado para este cargo')+'</small>':'')+'</th>'+
     cols.map(f=>{const r=recebe(f,c.id,cat);return r?'<td class="m-'+r.tipo+(f.publicada?'':' m-rascunho')+'"><span aria-hidden="true">✓ </span>'+esc(r.texto)+'</td>':'<td class="m-nao"><span class="visualmente-oculto">não recebe</span></td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';
  };
  $('#mat-busca').oninput=tabela;$('#mat-trilha').onchange=tabela;$('#mat-vagas').onchange=tabela;tabela();
  if(admin)editorCatalogo(app,d,cat,cargos);
 }
 function editorCatalogo(app,d,cat,cargos){
  let familias=Object.entries(cat.familias).map(([id,v])=>({id,novo:false,nome:v.nome||'',descricao:v.descricao||'',cargos:[...(v.cargos||[])]}));
  let trilhas=Object.entries(cat.trilhas).sort(ordemTrilha).map(([id,v])=>({id,novo:false,nome:v.nome||'',descricao:v.descricao||'',ordem:Number(v.ordem)||0}));
  const opcoesCargos=sel=>cargos.map(c=>({valor:c.id,texto:c.nome||c.id,detalhe:c.area||''})).concat(sel.filter(id=>!cargos.some(c=>c.id===id)).map(id=>({valor:id,texto:id,detalhe:'cargo não encontrado no RH (conferir)'})));
  const ler=()=>{
   familias.forEach((f,i)=>{const box=$('[data-familia="'+i+'"]');if(!box)return;if(f.novo)f.id=$('[data-fam-id]',box).value.trim();f.nome=$('[data-fam-nome]',box).value.trim();f.descricao=$('[data-fam-desc]',box).value.trim();f.cargos=E().marcados('cat-fam-cargos-'+i);});
   trilhas.forEach((t,i)=>{const box=$('[data-trilha-ed="'+i+'"]');if(!box)return;if(t.novo)t.id=$('[data-tri-id]',box).value.trim();t.nome=$('[data-tri-nome]',box).value.trim();t.descricao=$('[data-tri-desc]',box).value.trim();const o=$('[data-tri-ordem]',box).value;t.ordem=o===''?0:Number(o);});
  };
  const idCampo=(x,attr,i)=>x.novo?'<div class="campo"><label for="'+attr+'-'+i+'">Identificador</label><input id="'+attr+'-'+i+'" data-'+attr+' value="'+esc(x.id)+'" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*"><p class="dica">Letras minúsculas, números e hífen. Não muda depois de salvo.</p></div>':'<p class="dica">Identificador: '+esc(x.id)+'</p>';
  const pintar=()=>{
   $('#cat-familias').innerHTML=familias.map((f,i)=>'<fieldset class="cat-item" data-familia="'+i+'"><legend>'+esc(f.nome||'Nova família')+'</legend>'+idCampo(f,'fam-id',i)+'<div class="edu-form-grid"><div class="campo"><label for="fam-nome-'+i+'">Nome da família</label><input id="fam-nome-'+i+'" data-fam-nome maxlength="120" value="'+esc(f.nome)+'"></div><div class="campo"><label for="fam-desc-'+i+'">Descrição (opcional)</label><textarea id="fam-desc-'+i+'" data-fam-desc maxlength="2000">'+esc(f.descricao)+'</textarea></div></div>'+E().listaMarcar('cat-fam-cargos-'+i,'Cargos do RH nesta família',opcoesCargos(f.cargos),f.cargos)+'<button type="button" class="botao mini fantasma" data-rem-familia="'+i+'">Remover família</button></fieldset>').join('')||'<p class="dica">Nenhuma família cadastrada.</p>';
   $('#cat-trilhas').innerHTML=trilhas.map((t,i)=>'<fieldset class="cat-item" data-trilha-ed="'+i+'"><legend>'+esc(t.nome||'Nova trilha')+'</legend>'+idCampo(t,'tri-id',i)+'<div class="edu-form-grid"><div class="campo"><label for="tri-nome-'+i+'">Nome da trilha</label><input id="tri-nome-'+i+'" data-tri-nome maxlength="120" value="'+esc(t.nome)+'"></div><div class="campo"><label for="tri-ordem-'+i+'">Ordem</label><input id="tri-ordem-'+i+'" data-tri-ordem type="number" min="0" max="10000" step="1" value="'+esc(t.ordem)+'"></div><div class="campo"><label for="tri-desc-'+i+'">Descrição (opcional)</label><textarea id="tri-desc-'+i+'" data-tri-desc maxlength="2000">'+esc(t.descricao)+'</textarea></div></div><button type="button" class="botao mini fantasma" data-rem-trilha="'+i+'">Remover trilha</button></fieldset>').join('')||'<p class="dica">Nenhuma trilha cadastrada.</p>';
   // Identificador nasce do nome enquanto a pessoa não escreve um próprio.
   familias.forEach((f,i)=>{if(!f.novo)return;const box=$('[data-familia="'+i+'"]'),nome=$('[data-fam-nome]',box),idc=$('[data-fam-id]',box);nome.oninput=()=>{if(!idc.dataset.manual)idc.value=slug(nome.value);};idc.oninput=()=>{idc.dataset.manual='1';};});
   trilhas.forEach((t,i)=>{if(!t.novo)return;const box=$('[data-trilha-ed="'+i+'"]'),nome=$('[data-tri-nome]',box),idc=$('[data-tri-id]',box);nome.oninput=()=>{if(!idc.dataset.manual)idc.value=slug(nome.value);};idc.oninput=()=>{idc.dataset.manual='1';};});
   $$('[data-rem-familia]').forEach(bt=>bt.onclick=()=>{ler();familias.splice(+bt.dataset.remFamilia,1);pintar();});
   $$('[data-rem-trilha]').forEach(bt=>bt.onclick=()=>{ler();trilhas.splice(+bt.dataset.remTrilha,1);pintar();});
   E().ligarFiltros($('#cat-form'));associarRotulos($('#cat-form'));
  };
  $('#cat-add-familia').onclick=()=>{ler();familias.push({id:'',novo:true,nome:'',descricao:'',cargos:[]});pintar();};
  $('#cat-add-trilha').onclick=()=>{ler();trilhas.push({id:'',novo:true,nome:'',descricao:'',ordem:(trilhas.length+1)*10});pintar();};
  $('#cat-form').onsubmit=async ev=>{
   ev.preventDefault();ler();const erroEl=$('#cat-erro');erroEl.hidden=true;
   // Erro do servidor (409 do catálogo mudado, por exemplo) oferece recarregar a
   // matriz: ela não se redesenha sozinha enquanto está aberta.
   const falha=(m,recarregar=false)=>{erroEl.innerHTML=esc(m)+(recarregar?' <button type="button" class="botao mini suave" id="cat-recarregar">Recarregar a matriz</button>':'');const bt=$('#cat-recarregar');if(bt)bt.onclick=()=>{E().invalidar?.();render(app);};erroEl.hidden=false;erroEl.focus?.();};
   const montar=(lista,tipo)=>{const out={};for(const x of lista){if(!kebab(x.id))throw new Error(tipo+' "'+(x.nome||x.id||'sem nome')+'": identificador inválido. Use letras minúsculas, números e hífen.');if(Object.hasOwn(out,x.id))throw new Error(tipo+' "'+x.id+'" aparece mais de uma vez.');if(!textoOk(x.nome,120))throw new Error(tipo+' "'+x.id+'": informe o nome, com até 120 caracteres.');if(!opcionalOk(x.descricao,2000))throw new Error(tipo+' "'+x.id+'": descrição com mais de 2000 caracteres.');
     out[x.id]=tipo==='Família'?{nome:x.nome,descricao:x.descricao,cargos:x.cargos}:{nome:x.nome,descricao:x.descricao,ordem:x.ordem};
     if(tipo==='Família'&&x.cargos.length>200)throw new Error('Família "'+x.id+'": no máximo 200 cargos.');
     if(tipo==='Trilha'&&!inteiro(x.ordem,0,10000))throw new Error('Trilha "'+x.id+'": a ordem deve ser um número inteiro entre 0 e 10000.');}
    if(lista.length>50)throw new Error('Cadastre no máximo 50 '+(tipo==='Família'?'famílias':'trilhas')+'.');return out;};
   let catalogo;try{catalogo={familias:montar(familias,'Família'),trilhas:montar(trilhas,'Trilha')};}catch(e){falha(e.message);return;}
   const bt=$('#cat-salvar');bt.disabled=true;
   // Vai junto o catálogo que esta tela leu: se outra pessoa gravou depois, o
   // servidor recusa (409) em vez de apagar a mudança dela.
   const r=await E().executar({operacao:'configurarCatalogo',catalogo,catalogoAnterior:copia({familias:cat.familias,trilhas:cat.trilhas})},async()=>{toast('Famílias e trilhas salvas no servidor.');await render(app);});
   if(!r){bt.disabled=false;falha(E().estadoEnvio().erro||'Não foi possível salvar. Confira e tente novamente.',true);}
  };
  pintar();
 }

 // ───────────── Importar pacote (administração) ─────────────
 // O pacote fica só no navegador: lido do arquivo, conferido e enviado item a
 // item pelas operações da escola. Nunca publica, nunca aprova prova, nunca apaga.
 async function sha256(texto){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto));return Array.from(new Uint8Array(b)).map(n=>n.toString(16).padStart(2,'0')).join('');}
 // Mesmo item do mesmo pacote gera o mesmo identificador: repetir a importação
 // devolve a gravação já feita em vez de duplicar (o servidor confere o mutationId).
 async function idDeEnvio(tipo,item){return 'imp-'+tipo+'-'+(await sha256(tipo+'\n'+item.id+'\n'+estavel(item))).slice(0,48);}
 const CAMPOS_MATERIAL=['id','tipo','titulo','versao','setor','objetivo','categoria','duracaoMinutos','url','paginas','nr','liberacao','ativa'];
 const CAMPOS_CURSO=['id','titulo','versao','setor','prazo','ativa','liberacao','catalogo','etapas'];
 const CAMPOS_AULA=['id','titulo','tipo','obrigatoria','preparacaoPendente','prerequisitos','pontos','duracaoMinutos','conteudo','fontes','documentos','materiais','quiz','minimoAcerto','maxTentativas','validadores','checklist'];
 const CAMPOS_CONTEUDO=['aprender','importancia','comoFazer','erros','evidencia'];
 const so=(o,campos)=>Object.fromEntries(campos.filter(k=>objeto(o)&&Object.hasOwn(o,k)&&o[k]!==undefined).map(k=>[k,copia(o[k])]));
 function liberacaoOk(l,erros,ctx){
  if(l==null)return;
  if(!objeto(l)){erros.push('Público (liberacao) inválido.');return;}
  for(const k of ['pessoas','cargos','setores'])if(l[k]!=null&&(!Array.isArray(l[k])||l[k].length>2000||l[k].some(x=>!textoOk(x,160))))erros.push('Público: a lista '+k+' é inválida.');
  if(l.todos!=null&&typeof l.todos!=='boolean')erros.push('Público: "todos" deve ser verdadeiro ou falso.');
  if(Array.isArray(l.cargos)&&ctx.cargosRH){const fora=l.cargos.filter(c=>!ctx.cargosRH.some(x=>x.id===c));if(fora.length)erros.push('Cargo não encontrado no RH: '+fora.join(', ')+'.');}
  if(l.familias!=null){if(!Array.isArray(l.familias)||l.familias.length>50||l.familias.some(x=>!kebab(x))||new Set(l.familias).size!==l.familias.length)erros.push('Público: famílias inválidas.');else{const fora=l.familias.filter(k=>!Object.hasOwn(ctx.mesclado.familias,k));if(fora.length)erros.push('Família não cadastrada no catálogo: '+fora.join(', ')+'.');}}
 }
 function avaliarMaterial(m,erros){
  if(!TIPOS_MATERIAL.includes(m.tipo))erros.push('Tipo de material inválido (use video, texto, documento ou nr).');
  if(!textoOk(m.titulo,200))erros.push('Título obrigatório, com até 200 caracteres.');
  if(!textoOk(m.versao,40))erros.push('Versão obrigatória, com até 40 caracteres.');
  if(!textoOk(m.setor,200))erros.push('Setor responsável obrigatório.');
  if(!textoOk(m.objetivo,4000))erros.push('Objetivo obrigatório, com até 4000 caracteres.');
  if(!opcionalOk(m.categoria,120))erros.push('Assunto (categoria) com até 120 caracteres.');
  if(m.duracaoMinutos!=null&&!inteiro(m.duracaoMinutos,1,10000))erros.push('Tempo estimado inválido (1 a 10000 minutos).');
  if(m.ativa!=null&&typeof m.ativa!=='boolean')erros.push('"ativa" deve ser verdadeiro ou falso.');
  if(m.tipo==='video'){let ok=false;try{const u=new URL(m.url);ok=u.protocol==='https:'&&['youtu.be','youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname);}catch{}if(!ok)erros.push('Vídeo precisa de um link HTTPS do YouTube.');}
  else{if(m.url&&!httpsOk(m.url))erros.push('Link do documento precisa ser HTTPS, sem usuário nem senha.');if(m.paginas!=null&&(!Array.isArray(m.paginas)||m.paginas.length>1000||m.paginas.some(x=>typeof x!=='string'||x.length>30000)))erros.push('Páginas inválidas (até 1000 páginas de 30 mil caracteres).');}
  if(m.tipo==='nr'){const n=m.nr||{};let fonte=false;try{const u=new URL(n.fonte);fonte=u.protocol==='https:'&&u.hostname==='www.gov.br'&&u.pathname.startsWith('/trabalho-e-emprego/');}catch{}
   if(!fonte||!/^\d{1,2}$/.test(String(n.numero||''))||!textoOk(n.versaoOficial,200)||!textoOk(n.publico,4000)||!textoOk(n.responsavel,160)||!Array.isArray(n.requisitos)||!n.requisitos.length||n.requisitos.length>30||n.requisitos.some(x=>!textoOk(x,500)))erros.push('NR incompleta: número, versão oficial, fonte do Ministério do Trabalho, público, responsável e requisitos.');}
 }
 function avaliarCurso(c,erros,ctx,existente){
  if(!textoOk(c.titulo,200))erros.push('Título obrigatório, com até 200 caracteres.');
  if(!textoOk(c.versao,40))erros.push('Versão obrigatória, com até 40 caracteres.');
  if(!textoOk(c.setor,200))erros.push('Setor responsável obrigatório.');
  if(c.prazo!=null&&c.prazo!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.prazo)||isNaN(Date.parse(c.prazo))))erros.push('Prazo inválido (use AAAA-MM-DD).');
  if(c.ativa!=null&&typeof c.ativa!=='boolean')erros.push('"ativa" deve ser verdadeiro ou falso.');
  if(!Array.isArray(c.etapas)||!c.etapas.length||c.etapas.length>50){erros.push('O curso precisa ter de 1 a 50 aulas (etapas).');return;}
  if(!c.etapas.some(e=>objeto(e)&&e.obrigatoria!==false))erros.push('Defina pelo menos uma aula obrigatória.');
  const vistos=new Set();
  c.etapas.forEach((e,i)=>{
   const nome='Aula '+(i+1)+(objeto(e)&&e.titulo?' ('+e.titulo+')':'');
   if(!objeto(e)){erros.push(nome+': formato inválido.');return;}
   if(typeof e.id!=='string'||!ID.test(e.id)||vistos.has(e.id))erros.push(nome+': identificador ausente, inválido ou repetido.');
   if(!textoOk(e.titulo,200))erros.push(nome+': título obrigatório.');
   if(!TIPOS_AULA.includes(e.tipo))erros.push(nome+': tipo inválido.');
   if(e.prerequisitos!=null&&(!Array.isArray(e.prerequisitos)||e.prerequisitos.some(p=>!vistos.has(p))))erros.push(nome+': aulas exigidas antes precisam ser anteriores no mesmo curso.');
   vistos.add(e.id);
   if(e.pontos!=null&&!inteiro(e.pontos,0,1000))erros.push(nome+': pontos entre 0 e 1000.');
   if(e.duracaoMinutos!=null&&!inteiro(e.duracaoMinutos,1,10000))erros.push(nome+': duração entre 1 e 10000 minutos.');
   if(e.conteudo!=null&&(!objeto(e.conteudo)||CAMPOS_CONTEUDO.some(k=>e.conteudo[k]!=null&&(typeof e.conteudo[k]!=='string'||e.conteudo[k].length>20000))||JSON.stringify(e.conteudo).length>100000))erros.push(nome+': conteúdo inválido (5 campos de texto, até 20 mil caracteres cada).');
   if(e.minimoAcerto!=null&&!inteiro(e.minimoAcerto,1,100))erros.push(nome+': acerto mínimo entre 1 e 100.');
   if(e.maxTentativas!=null&&!inteiro(e.maxTentativas,1,20))erros.push(nome+': tentativas entre 1 e 20.');
   if(e.quiz!=null){if(!Array.isArray(e.quiz)||e.quiz.length>40)erros.push(nome+': até 40 questões.');else{const qs=new Set();e.quiz.forEach((q,n)=>{if(!objeto(q)||typeof q.id!=='string'||!ID.test(q.id)||qs.has(q.id)||!textoOk(q.pergunta,2000)||!Array.isArray(q.opcoes)||q.opcoes.length<2||q.opcoes.length>8||q.opcoes.some(o=>!textoOk(o,2000))||!Number.isInteger(q.correta)||q.correta<0||q.correta>=q.opcoes.length||!textoOk(q.explicacao,4000))erros.push(nome+', questão '+(n+1)+': complete id, pergunta, de 2 a 8 alternativas, resposta e explicação.');if(objeto(q))qs.add(q.id);});}}
   if(e.fontes!=null&&(!Array.isArray(e.fontes)||e.fontes.length>30||e.fontes.some(f=>!objeto(f)||!['pop','treinamento'].includes(f.tipo)||typeof f.refId!=='string'||!ID.test(f.refId)||!textoOk(f.versao,40))))erros.push(nome+': fontes inválidas (POP ou treinamento, com versão).');
   if(e.documentos!=null&&(!Array.isArray(e.documentos)||e.documentos.length>30||e.documentos.some(d=>!objeto(d)||!textoOk(d.titulo,200)||!textoOk(d.versao,40)||!httpsOk(d.url))))erros.push(nome+': documentos precisam de título, versão e link HTTPS.');
   if(e.validadores!=null&&(!Array.isArray(e.validadores)||e.validadores.length>30||e.validadores.some(x=>!textoOk(x,160))))erros.push(nome+': responsáveis pela prática inválidos.');
   if(e.checklist!=null&&(!Array.isArray(e.checklist)||e.checklist.length>100||e.checklist.some(x=>!textoOk(x,2000))))erros.push(nome+': checklist inválido.');
   if(e.materiais!=null){if(!Array.isArray(e.materiais)||e.materiais.length>30)erros.push(nome+': até 30 materiais.');else for(const ref of e.materiais){const rid=typeof ref==='string'?ref:ref?.id,alvo=ctx.materiaisFinais.get(rid);if(!alvo)erros.push(nome+': o material '+rid+' não está no pacote nem na biblioteca.');else if(objeto(ref)&&ref.versao&&ref.versao!==alvo.versao)erros.push(nome+': aponta para a versão '+ref.versao+' do material '+rid+', que estará na versão '+alvo.versao+'.');}}
  });
  liberacaoOk(c.liberacao,erros,ctx);
  if(c.catalogo!=null){const k=c.catalogo;if(!objeto(k))erros.push('Catálogo do curso inválido.');else{
   if(k.trilha!=null&&k.trilha!==''){if(!kebab(k.trilha))erros.push('Trilha inválida.');else if(!Object.hasOwn(ctx.mesclado.trilhas,k.trilha))erros.push('Trilha não cadastrada no catálogo: '+k.trilha+'.');}
   if(!opcionalOk(k.area,120))erros.push('Área com até 120 caracteres.');
   if(k.nivel!=null&&k.nivel!==''&&!NIVEIS.includes(k.nivel))erros.push('Nível inválido (essencial, intermediario ou avancado).');
   if(k.cargaMinutos!=null&&!inteiro(k.cargaMinutos,1,100000))erros.push('Carga inválida (1 a 100000 minutos).');
   if(k.ordem!=null&&!inteiro(k.ordem,0,10000))erros.push('Ordem inválida (0 a 10000).');
   if(!opcionalOk(k.codigo,40))erros.push('Código com até 40 caracteres.');
   if(!opcionalOk(k.resumo,200))erros.push('Resumo com até 200 caracteres.');
   if(k.palavrasChave!=null&&(!Array.isArray(k.palavrasChave)||k.palavrasChave.length>20||k.palavrasChave.some(x=>typeof x!=='string'||!x.trim()||x.trim().length>40)))erros.push('Palavras-chave inválidas (até 20, com até 40 caracteres cada).');
   if(k.familias!=null){if(!Array.isArray(k.familias)||k.familias.length>20||k.familias.some(x=>!kebab(x))||new Set(k.familias).size!==k.familias.length)erros.push('Famílias indicadas inválidas.');else{const fora=k.familias.filter(x=>!Object.hasOwn(ctx.mesclado.familias,x));if(fora.length)erros.push('Família não cadastrada no catálogo: '+fora.join(', ')+'.');}}
   if(k.preRequisitos!=null){if(!Array.isArray(k.preRequisitos)||k.preRequisitos.length>20||k.preRequisitos.some(x=>typeof x!=='string'||!ID.test(x))||new Set(k.preRequisitos).size!==k.preRequisitos.length||k.preRequisitos.includes(c.id))erros.push('Cursos recomendados inválidos.');else{const fora=k.preRequisitos.filter(x=>!ctx.cursosFinais.has(x));if(fora.length)erros.push('Curso recomendado não encontrado: '+fora.join(', ')+'.');}}
  }}
 }
 // Catálogo do pacote somado ao atual: acrescenta e atualiza, nunca exclui. Cargo
 // de família é somado (união), para não tirar ninguém de uma família.
 function mesclarCatalogo(atual,pacote){
  const out={familias:copia(atual.familias||{}),trilhas:copia(atual.trilhas||{})},itens=[];
  for(const [id,v] of Object.entries(objeto(pacote?.familias)?pacote.familias:{})){const antes=out.familias[id],depois={nome:typeof v?.nome==='string'?v.nome.trim():'',descricao:typeof v?.descricao==='string'?v.descricao.trim():(antes?.descricao||''),cargos:[...new Set([...(antes?.cargos||[]),...(Array.isArray(v?.cargos)?v.cargos:[])])]};out.familias[id]=depois;itens.push({tipo:'familia',id,nome:depois.nome||id,acao:!antes?'nova':estavel(antes)===estavel(depois)?'sem mudança':'atualizada',novosCargos:(Array.isArray(v?.cargos)?v.cargos:[]).filter(c=>!(antes?.cargos||[]).includes(c)),bruto:v});}
  for(const [id,v] of Object.entries(objeto(pacote?.trilhas)?pacote.trilhas:{})){const antes=out.trilhas[id],depois={nome:typeof v?.nome==='string'?v.nome.trim():'',descricao:typeof v?.descricao==='string'?v.descricao.trim():(antes?.descricao||''),ordem:v?.ordem??antes?.ordem??0};out.trilhas[id]=depois;itens.push({tipo:'trilha',id,nome:depois.nome||id,acao:!antes?'nova':estavel(antes)===estavel(depois)?'sem mudança':'atualizada',bruto:v});}
  return {mesclado:out,itens,muda:estavel(out)!==estavel({familias:atual.familias||{},trilhas:atual.trilhas||{}})};
 }
 // Mesma conta do servidor (camposPedagogicos do curso e pedag do material): na
 // mesma versão, conteúdo diferente é recusado lá. A prévia acusa antes, para o
 // plano ficar bloqueado e a importação não gravar o catálogo e parar pela metade.
 const semConferencia=l=>Array.isArray(l)?l.map(x=>{const r=copia(x);if(objeto(r)){delete r.conferidoPor;delete r.conferidoEm;}return r;}):l;
 const aulaPedagogica=e=>{const r=copia(e);if(!objeto(r))return r;for(const k of ['aprovacao','avaliacaoPendente','status','statusFonte','motivoBloqueio'])delete r[k];r.minimoAcerto=r.minimoAcerto??70;r.maxTentativas=r.maxTentativas??3;r.fontes=semConferencia(r.fontes);r.documentos=semConferencia(r.documentos);return r;};
 const pedagogiaCurso=f=>estavel(copia({titulo:f?.titulo,etapas:(Array.isArray(f?.etapas)?f.etapas:[]).map(aulaPedagogica)}));
 // O servidor guarda o link do vídeo num formato só; compara depois de normalizar.
 const linkVideo=u=>{try{const x=new URL(u);const vid=x.hostname==='youtu.be'?x.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(x.hostname)?(x.pathname==='/watch'?x.searchParams.get('v')||'':/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(x.pathname)?.[1]||''):'';return /^[A-Za-z0-9_-]{11}$/.test(vid)?'https://www.youtube.com/watch?v='+vid:u;}catch{return u;}};
 const pedagogiaMaterial=m=>{const x=copia(m)||{};if(x.tipo==='video'){x.url=linkVideo(x.url);delete x.paginas;}return estavel(copia({tipo:x.tipo,titulo:x.titulo,objetivo:x.objetivo,url:x.url,paginas:x.paginas,nr:x.nr}));};
 // Monta a prévia: confere formato, referências e situação de cada item contra o
 // que existe hoje (painel e biblioteca da administração). Nada é gravado aqui.
 // ctx.materiaisIntegrais (opcional): material existente com as páginas, para
 // conferir o conteúdo na mesma versão (a lista da biblioteca vem sem páginas).
 async function planejar(pacote,ctx){
  const atual={familias:ctx.catalogo?.familias||{},trilhas:ctx.catalogo?.trilhas||{}};
  // anterior: o catálogo lido, que vai junto na gravação (409 se outra pessoa gravou depois).
  const plano={erros:[],catalogo:{presente:false,muda:false,itens:[],mesclado:copia(atual),anterior:copia(atual)},materiais:[],cursos:[],bloqueado:false};
  if(!objeto(pacote)){plano.erros.push('O arquivo precisa ser um objeto JSON com versao, materiais e cursos.');plano.bloqueado=true;return plano;}
  if(!textoOk(pacote.versao,40))plano.erros.push('Informe a versão do pacote (campo "versao", até 40 caracteres).');
  if(!Array.isArray(pacote.materiais))plano.erros.push('O campo "materiais" precisa ser uma lista (pode ser vazia).');
  if(!Array.isArray(pacote.cursos))plano.erros.push('O campo "cursos" precisa ser uma lista (pode ser vazia).');
  if(pacote.catalogo!=null&&(!objeto(pacote.catalogo)||(pacote.catalogo.familias!=null&&!objeto(pacote.catalogo.familias))||(pacote.catalogo.trilhas!=null&&!objeto(pacote.catalogo.trilhas))))plano.erros.push('O campo "catalogo" precisa ter "familias" e "trilhas" como objetos.');
  if(plano.erros.length){plano.bloqueado=true;return plano;}
  if(!pacote.materiais.length&&!pacote.cursos.length&&!pacote.catalogo)plano.erros.push('O pacote não tem catálogo, materiais nem cursos.');
  // Catálogo
  if(pacote.catalogo){const m=mesclarCatalogo(atual,pacote.catalogo);plano.catalogo={presente:true,muda:m.muda,itens:m.itens,mesclado:m.mesclado,anterior:copia(atual)};
   for(const it of m.itens){it.erros=[];const v=it.bruto;
    if(!kebab(it.id))it.erros.push('Identificador inválido: use letras minúsculas, números e hífen (até 80).');
    if(!objeto(v)||!textoOk(v.nome,120))it.erros.push('Informe o nome, com até 120 caracteres.');
    if(objeto(v)&&!opcionalOk(v.descricao,2000))it.erros.push('Descrição com mais de 2000 caracteres.');
    if(it.tipo==='familia'){if(objeto(v)&&v.cargos!=null&&(!Array.isArray(v.cargos)||v.cargos.some(c=>typeof c!=='string'||!ID.test(c))||new Set(v.cargos).size!==v.cargos.length))it.erros.push('Lista de cargos inválida ou com repetição.');
     else if(ctx.cargosRH){const fora=(it.novosCargos||[]).filter(c=>!ctx.cargosRH.some(x=>x.id===c));if(fora.length)it.erros.push('Cargo não encontrado no RH: '+fora.join(', ')+'.');}
     if((m.mesclado.familias[it.id]?.cargos||[]).length>200)it.erros.push('No máximo 200 cargos por família.');}
    if(it.tipo==='trilha'&&objeto(v)&&v.ordem!=null&&!inteiro(v.ordem,0,10000))it.erros.push('Ordem entre 0 e 10000.');
    delete it.bruto;delete it.novosCargos;}
   if(Object.keys(m.mesclado.familias).length>50||Object.keys(m.mesclado.trilhas).length>50)plano.erros.push('O catálogo ficaria com mais de 50 famílias ou 50 trilhas.');}
  const ctxV={...ctx,mesclado:plano.catalogo.mesclado,materiaisFinais:new Map((ctx.materiais||[]).map(m=>[m.id,{versao:m.versao,titulo:m.titulo}])),cursosFinais:new Set((ctx.formacoes||[]).map(f=>f.id))};
  const existeM=new Map((ctx.materiais||[]).map(m=>[m.id,m])),existeC=new Map((ctx.formacoes||[]).map(f=>[f.id,f]));
  const repetidos=(lista)=>{const n=new Map();for(const x of lista)if(objeto(x)&&typeof x.id==='string')n.set(x.id,(n.get(x.id)||0)+1);return n;};
  const repM=repetidos(pacote.materiais),repC=repetidos(pacote.cursos);
  for(const m of pacote.materiais)if(objeto(m)&&typeof m.id==='string')ctxV.materiaisFinais.set(m.id,{versao:m.versao,titulo:m.titulo});
  for(const c of pacote.cursos)if(objeto(c)&&typeof c.id==='string')ctxV.cursosFinais.add(c.id);
  // Situação comum: novo, versão nova ou mesma versão; item liberado não é sobrescrito.
  // Público do pacote para item que já existe substitui o atual: a prévia avisa.
  // Famílias null valem como ausentes no servidor (conserva as atuais).
  const publicoMuda=(item,existente,avisos)=>{if(!existente||!objeto(item.liberacao))return;const lista=l=>estavel(['pessoas','cargos','setores','familias'].map(k=>[...(Array.isArray(l?.[k])?l[k]:[])].sort()).concat([l?.todos===true]));const novo={...existente.liberacao,...item.liberacao};if(item.liberacao.familias===null)novo.familias=existente.liberacao?.familias;if(lista(novo)!==lista(existente.liberacao))avisos.push('O público (liberação) do pacote substitui o público atual deste item.');};
  const situacao=(item,existente,erros,avisos)=>{
   if(!existente)return 'novo';
   if(existente.publicada===true)erros.push('Já está liberado para os alunos. A importação não grava por cima de item liberado: retire a liberação na tela antes, se quiser substituir.');
   if(existente.versao===item.versao)return 'mesma_versao';
   if((existente.versoesAnteriores||[]).some(v=>v.versao===item.versao))erros.push('A versão '+item.versao+' já foi usada neste item. Escolha uma versão nova.');
   return 'versao_nova';
  };
  for(const bruto of pacote.materiais){
   const erros=[],avisos=[];if(!objeto(bruto)){plano.materiais.push({id:'',titulo:'Material sem formato',versao:'',situacao:'erro',erros:['Item inválido: precisa ser um objeto.'],avisos});continue;}
   const m=so(bruto,CAMPOS_MATERIAL);
   if(typeof m.id!=='string'||!ID.test(m.id))erros.push('Identificador ausente ou inválido.');
   if(repM.get(m.id)>1)erros.push('Identificador repetido no pacote.');
   avaliarMaterial(m,erros);liberacaoOk(m.liberacao,erros,ctxV);
   const existente=existeM.get(m.id),sit=situacao(m,existente,erros,avisos);publicoMuda(m,existente,avisos);
   // Sem "ativa" no pacote, vale a do servidor: importar não reativa item arquivado.
   const payload={...m,publicada:false,ativa:typeof m.ativa==='boolean'?m.ativa:existente?.ativa!==false,liberacao:m.liberacao?{pessoas:[],cargos:[],setores:[],todos:false,...m.liberacao}:copia(existente?.liberacao)||{pessoas:[],cargos:[],setores:[],todos:false}};
   delete payload.liberacao.cargosGestor;delete payload.liberacao.cargosSetores;
   // O servidor grava o material como chega: campo que o pacote não traz sumiria.
   // Assunto (filtro da Biblioteca) e tempo estimado não mudam o que se aprende:
   // sem eles no pacote, ficam os atuais, como o prazo do curso.
   if(existente)for(const k of ['categoria','duracaoMinutos'])if(!Object.hasOwn(m,k)&&existente[k]!=null&&existente[k]!=='')payload[k]=existente[k];
   if(sit==='mesma_versao'){const base=ctx.materiaisIntegrais?.get(m.id)||existente;
    if(pedagogiaMaterial(payload)!==pedagogiaMaterial(base))erros.push('O conteúdo mudou e a versão continua '+m.versao+'. Suba a versão do material no pacote: o servidor recusa conteúdo novo na mesma versão.');
    else avisos.push('Já existe nesta versão, com o mesmo conteúdo. Repetir a importação não duplica.');}
   const tamanho=JSON.stringify(payload).length;if(tamanho>500000)erros.push('O material passa de 500 mil caracteres, limite do servidor.');else if(sit==='versao_nova'&&tamanho>200000)avisos.push('Versão nova guarda a anterior inteira no histórico; o servidor recusa se o total passar de 500 mil caracteres.');
   plano.materiais.push({id:m.id||'',titulo:m.titulo||m.id||'',versao:m.versao||'',tipo:'material',situacao:sit,erros,avisos,payload,expectedRevision:existente?._serverRevision||0,mutationId:await idDeEnvio('m',m),tamanho});
  }
  for(const bruto of pacote.cursos){
   const erros=[],avisos=[];if(!objeto(bruto)){plano.cursos.push({id:'',titulo:'Curso sem formato',versao:'',situacao:'erro',erros:['Item inválido: precisa ser um objeto.'],avisos});continue;}
   const c=so(bruto,CAMPOS_CURSO);
   if(typeof c.id!=='string'||!ID.test(c.id))erros.push('Identificador ausente ou inválido.');
   if(repC.get(c.id)>1)erros.push('Identificador repetido no pacote.');
   const existente=existeC.get(c.id);avaliarCurso(c,erros,ctxV,existente);
   const sit=situacao(c,existente,erros,avisos);publicoMuda(c,existente,avisos);
   // Aula normalizada: aprovação de prova nunca vai no pacote; documento e fonte
   // só ficam "conferidos" se já estavam conferidos na mesma versão por alguém.
   // A aula sai no mesmo formato que o editor lê e grava (textos aparados, campos
   // sempre presentes): abrir o curso importado no editor e salvar sem mexer não
   // vira "o aprendizado mudou".
   const ordemAula=new Map((Array.isArray(c.etapas)?c.etapas:[]).filter(objeto).map((e,i)=>[e.id,i]));
   const apara=v=>typeof v==='string'?v.trim():v;
   const etapas=(Array.isArray(c.etapas)?c.etapas:[]).filter(objeto).map(e=>{const x=so(e,CAMPOS_AULA),antiga=existente?.etapas?.find(a=>a.id===x.id);
    x.titulo=apara(x.titulo);x.obrigatoria=x.obrigatoria!==false;x.preparacaoPendente=x.preparacaoPendente===true;x.pontos=x.pontos??10;
    x.prerequisitos=(Array.isArray(x.prerequisitos)?x.prerequisitos:[]).slice().sort((a,b)=>(ordemAula.get(a)??0)-(ordemAula.get(b)??0));
    x.conteudo=Object.fromEntries(CAMPOS_CONTEUDO.map(k=>[k,typeof x.conteudo?.[k]==='string'?x.conteudo[k].trim():'']));
    for(const k of ['fontes','documentos','quiz','validadores','checklist'])x[k]=Array.isArray(x[k])?x[k]:[];
    x.checklist=x.checklist.map(apara).filter(Boolean);
    x.quiz=x.quiz.map(q=>({id:q?.id,pergunta:apara(q?.pergunta),opcoes:Array.isArray(q?.opcoes)?q.opcoes.map(apara):q?.opcoes,correta:q?.correta,explicacao:apara(q?.explicacao),revisar:typeof q?.revisar==='string'?q.revisar.trim():''}));
    x.documentos=x.documentos.map(d=>({titulo:d.titulo,url:d.url,versao:d.versao,oficialConfirmado:!!antiga?.documentos?.some(a=>a.url===d.url&&a.versao===d.versao&&a.oficialConfirmado===true)}));
    x.fontes=x.fontes.map(f=>({tipo:f.tipo,refId:f.refId,versao:f.versao,oficialConfirmado:!!antiga?.fontes?.some(a=>a.tipo===f.tipo&&a.refId===f.refId&&a.versao===f.versao&&a.oficialConfirmado===true)}));
    x.materiais=(Array.isArray(x.materiais)?x.materiais:[]).map(r=>{const rid=typeof r==='string'?r:r?.id,alvo=ctxV.materiaisFinais.get(rid)||{};return {id:rid,versao:(objeto(r)&&r.versao)||alvo.versao,titulo:alvo.titulo||(objeto(r)&&r.titulo)||rid};});
    return x;});
   const payload={...c,etapas,publicada:false,ativa:typeof c.ativa==='boolean'?c.ativa:existente?.ativa!==false,liberacao:c.liberacao?{pessoas:[],cargos:[],setores:[],todos:false,...c.liberacao}:copia(existente?.liberacao)||{pessoas:[],cargos:[],setores:[],todos:false}};
   for(const k of ['cargosGestor','cargosSetores','cargosSetoresEfetivos'])delete payload.liberacao[k];
   if(!c.prazo&&existente?.prazo)payload.prazo=existente.prazo;
   if(!payload.prazo)delete payload.prazo;
   if(sit==='mesma_versao'){
    if(pedagogiaCurso(payload)!==pedagogiaCurso(existente))erros.push('O título ou as aulas mudaram e a versão continua '+c.versao+'. Suba a versão do curso no pacote: o servidor recusa conteúdo novo na mesma versão.');
    else avisos.push('Já existe nesta versão, com o mesmo conteúdo. Repetir a importação não duplica.');}
   if(JSON.stringify(payload).length>500000)erros.push('O curso passa de 500 mil caracteres, limite do servidor.');
   plano.cursos.push({id:c.id||'',titulo:c.titulo||c.id||'',versao:c.versao||'',tipo:'curso',situacao:sit,erros,avisos,payload,expectedRevision:existente?._serverRevision||0,mutationId:await idDeEnvio('c',c),pre:Array.isArray(c.catalogo?.preRequisitos)?c.catalogo.preRequisitos:[]});
  }
  // Ordem de gravação dos cursos: recomendado antes de quem o recomenda (o
  // servidor exige que o curso recomendado já exista). Círculo é erro.
  const noPacote=new Map(plano.cursos.filter(c=>c.id).map(c=>[c.id,c])),ordem=[],marca=new Map();
  const visitar=(c,pilha)=>{if(marca.get(c.id)==='feito')return;if(marca.get(c.id)==='visitando'){c.erros.push('Os cursos recomendados formariam um círculo: '+[...pilha,c.id].join(' > ')+'.');return;}marca.set(c.id,'visitando');for(const p of c.pre){const alvo=noPacote.get(p);if(alvo)visitar(alvo,[...pilha,c.id]);}marca.set(c.id,'feito');ordem.push(c);};
  for(const c of plano.cursos)if(c.id)visitar(c,[]);else ordem.push(c);
  // Círculo também pode passar por cursos que já existem no servidor.
  const grafo=new Map((ctx.formacoes||[]).map(f=>[f.id,f.catalogo?.preRequisitos||[]]));for(const c of plano.cursos)if(c.id)grafo.set(c.id,c.pre);
  for(const c of plano.cursos){if(!c.id||c.erros.some(e=>e.includes('círculo')))continue;const vistos=new Set(),pilha=[...c.pre];while(pilha.length){const x=pilha.pop();if(x===c.id){c.erros.push('Os cursos recomendados formariam um círculo com cursos que já existem. Revise a ordem da trilha.');break;}if(vistos.has(x))continue;vistos.add(x);pilha.push(...(grafo.get(x)||[]));}}
  plano.cursos=ordem;
  plano.bloqueado=!!(plano.erros.length||plano.catalogo.itens.some(i=>i.erros.length)||plano.materiais.some(i=>i.erros.length)||plano.cursos.some(i=>i.erros.length));
  return plano;
 }
 const semResposta=e=>!e?.status||[408,429].includes(e.status)||e.status>=500;
 // Grava na ordem catálogo, materiais, cursos; um por vez. Falha de rede para
 // tudo (repetir é seguro); erro definitivo de um item não impede os outros,
 // exceto quem depende dele.
 async function executarPlano(plano,{api,aoProgresso=()=>{}}={}){
  const res=[],marcar=(item,estado,mensagem='')=>{const r={tipo:item.tipo,id:item.id,titulo:item.titulo,estado,mensagem};res.push(r);aoProgresso(r,res);return r;};
  let parar='';
  if(plano.bloqueado)throw new Error('Corrija os erros do pacote antes de importar.');
  if(plano.catalogo.presente){const it={tipo:'catalogo',id:'catalogo',titulo:'Famílias e trilhas'};
   if(!plano.catalogo.muda)marcar(it,'sem_mudanca','O catálogo já tinha estas famílias e trilhas.');
   else try{await api('escola',{operacao:'configurarCatalogo',catalogo:plano.catalogo.mesclado,catalogoAnterior:plano.catalogo.anterior});marcar(it,'gravado','Catálogo atualizado.');}catch(e){parar=semResposta(e)?'Sem resposta do servidor ao gravar o catálogo.':'O catálogo não foi gravado: '+(e.message||'erro')+'.';marcar(it,'erro',e.message||'Falha ao gravar o catálogo.');}}
  const falhou=new Set();
  for(const m of plano.materiais){
   if(parar){marcar(m,'nao_enviado',parar);continue;}
   try{const r=await api('escola',{operacao:'academia.salvarMaterial',material:m.payload,expectedRevision:m.expectedRevision,mutationId:m.mutationId},60000);marcar(m,'gravado','Gravado como rascunho'+(r?.revision?' (revisão '+r.revision+')':'')+'.');}
   catch(e){falhou.add(m.id);if(semResposta(e)){parar='Sem resposta do servidor. Confira a conexão e repita a importação: o mesmo pacote não duplica registros.';marcar(m,'erro',parar);}else marcar(m,'erro',e.message||'Falha ao gravar.');}
  }
  for(const c of plano.cursos){
   if(parar){marcar(c,'nao_enviado',parar);continue;}
   const dep=(c.payload.etapas||[]).flatMap(e=>(e.materiais||[]).map(r=>r.id)).find(id=>falhou.has(id))||c.pre.find(id=>falhou.has(id));
   if(dep){falhou.add(c.id);marcar(c,'nao_enviado','Depende de '+dep+', que não foi gravado.');continue;}
   try{const r=await api('escola',{operacao:'salvarFormacao',formacao:c.payload,expectedRevision:c.expectedRevision,mutationId:c.mutationId},60000);marcar(c,r?.repetido?'repetido':'gravado',r?.repetido?'Já estava gravado por esta importação.':'Gravado como rascunho'+(r?.revision?' (revisão '+r.revision+')':'')+'.');}
   catch(e){falhou.add(c.id);if(semResposta(e)){parar='Sem resposta do servidor. Confira a conexão e repita a importação: o mesmo pacote não duplica registros.';marcar(c,'erro',parar);}else marcar(c,'erro',e.message||'Falha ao gravar.');}
  }
  return res;
 }
 const assinaturaPlano=p=>estavel({e:p.erros,c:p.catalogo.itens.map(i=>[i.id,i.acao,i.erros]),m:p.materiais.map(i=>[i.id,i.situacao,i.expectedRevision,i.erros]),k:p.cursos.map(i=>[i.id,i.situacao,i.expectedRevision,i.erros])});
 const SITUACOES={novo:'Novo',versao_nova:'Versão nova',mesma_versao:'Mesma versão',erro:'Com erro'};
 const ESTADO_ENVIO={gravado:'Gravado',repetido:'Já estava gravado',sem_mudanca:'Sem mudança',erro:'Erro',nao_enviado:'Não enviado'};
 const TIPOS_PREVIA={catalogo:'Catálogo',material:'Material',curso:'Curso'};
 function etapasImportacao(atual){
  return '<ol class="imp-etapas" id="imp-etapas" aria-label="Etapas da importação">'+['Selecionar','Conferir','Importar','Revisar'].map((titulo,i)=>'<li data-passo="'+(i+1)+'" class="'+(i+1===atual?'imp-passo-atual':i+1<atual?'imp-passo-feito':'')+'"'+(i+1===atual?' aria-current="step"':'')+'><span aria-hidden="true">'+(i+1<atual?'✓':i+1)+'</span><b>'+titulo+'</b><small>'+(i+1===atual?'Etapa atual':i+1<atual?'Etapa anterior':'A seguir')+'</small></li>').join('')+'</ol>';
 }
 // Cópias só para apresentação: ordenar e filtrar a prévia nunca muda o plano
 // nem a ordem de envio (catálogo, materiais e cursos com suas dependências).
 function itensPrevia(p){
  const area=i=>[i.payload?.catalogo?.area,p.catalogo.mesclado.trilhas[i.payload?.catalogo?.trilha]?.nome,i.payload?.setor].find(v=>typeof v==='string'&&v.trim())||'Sem área';
  return [
   ...p.catalogo.itens.map(i=>({...i,grupo:'catalogo',titulo:(i.tipo==='familia'?'Família: ':'Trilha: ')+i.nome,area:i.tipo==='trilha'?i.nome:'Sem área',situacao:i.acao==='nova'?'novo':i.acao==='atualizada'?'atualizado':'sem_mudanca',rotulo:i.acao==='nova'?'Nova':i.acao==='atualizada'?'Atualizada':'Sem mudança'})),
   ...p.materiais.map(i=>({...i,grupo:'material',area:area(i)})),
   ...p.cursos.map(i=>({...i,grupo:'curso',area:area(i)}))
  ].map(i=>({...i,situacaoFiltro:i.erros.length?'erro':i.situacao}))
   .sort((a,b)=>Number(!!b.erros.length)-Number(!!a.erros.length));
 }
 function detalhesImportacao(i){
  const materiais=[...new Set((i.payload?.etapas||[]).flatMap(e=>(e.materiais||[]).map(m=>m.id)))];
  return '<details class="imp-detalhes"><summary>Identificação e referências</summary><dl><div><dt>Identificador</dt><dd>'+esc(i.id||'Não informado')+'</dd></div>'+(i.versao?'<div><dt>Versão</dt><dd>'+esc(i.versao)+'</dd></div>':'')+(i.pre?.length?'<div><dt>Cursos recomendados antes</dt><dd>'+i.pre.map(esc).join(', ')+'</dd></div>':'')+(materiais.length?'<div><dt>Materiais das aulas</dt><dd>'+materiais.map(esc).join(', ')+'</dd></div>':'')+'</dl></details>';
 }
 function itemPrevia(i){
  return '<li class="imp-item'+(i.erros.length?' imp-erro':'')+'" data-tipo="'+i.grupo+'" data-area="'+esc(i.area)+'" data-situacao="'+i.situacaoFiltro+'"><div><b>'+esc(i.titulo||i.id||'Sem identificador')+'</b><small>'+TIPOS_PREVIA[i.grupo]+' · '+esc(i.area)+'</small></div><span class="imp-situacao">'+esc(i.erros.length?'Com erro':i.rotulo||SITUACOES[i.situacao]||'')+'</span>'+(i.erros.length?'<ul class="imp-msgs" aria-label="Erros deste item">'+i.erros.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul>':'')+((i.avisos||[]).length?'<ul class="imp-msgs imp-avisos" aria-label="Avisos deste item">'+i.avisos.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul>':'')+detalhesImportacao(i)+'</li>';
 }
 function previaHtml(p,arquivo=''){
  const itens=itensPrevia(p),contar=(...situacoes)=>itens.filter(i=>situacoes.includes(i.situacaoFiltro)).length,areas=[...new Set(itens.map(i=>i.area))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const resumo=(id,n,t)=>'<div><strong id="imp-total-'+id+'">'+n+'</strong><span>'+t+'</span></div>';
  return '<section class="card imp-previa" id="imp-previa"><div class="imp-cabecalho"><div><span class="ac-kicker">Etapa 2 de 4</span><h2 tabindex="-1" id="imp-previa-titulo">Confira as alterações</h2></div><span class="imp-situacao">'+(p.bloqueado?'Requer correção':'Pronto para importar')+'</span></div>'+(arquivo?'<p class="dica">Arquivo lido: '+esc(arquivo)+'</p>':'')+'<div class="imp-resumo" aria-label="Totais do pacote">'+resumo('novos',contar('novo'),'Novos')+resumo('versoes',contar('versao_nova'),'Versões novas')+resumo('catalogo',contar('atualizado'),'Catálogo atualizado')+resumo('iguais',contar('mesma_versao','sem_mudanca'),'Mesma versão / sem mudança')+resumo('erros',contar('erro'),'Com erro')+'</div>'+
   (p.erros.length?'<div class="aviso amarelo" role="alert"><ul>'+p.erros.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul></div>':'')+
   (p.catalogo.presente?'<p class="dica">'+(p.catalogo.muda?'O catálogo será atualizado. Nada do que existe é excluído; cargos são somados às famílias.':'O catálogo já tem estas famílias e trilhas.')+'</p>':'')+
   '<div class="imp-filtros"><div class="campo"><label for="imp-filtro-tipo">Tipo</label><select id="imp-filtro-tipo"><option value="">Todos os tipos</option>'+Object.entries(TIPOS_PREVIA).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div><div class="campo"><label for="imp-filtro-area">Área ou setor</label><select id="imp-filtro-area"><option value="">Todas as áreas</option>'+areas.map(a=>'<option value="'+esc(a)+'">'+esc(a)+'</option>').join('')+'</select></div><div class="campo"><label for="imp-filtro-situacao">Situação</label><select id="imp-filtro-situacao"><option value="">Todas as situações</option>'+Object.entries({...SITUACOES,atualizado:'Catálogo atualizado',sem_mudanca:'Sem mudança'}).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></div></div>'+
   '<p class="dica" id="imp-contagem" role="status"></p><p class="dica">Os filtros mudam apenas esta lista. A confirmação importa todo o pacote. Itens com erro aparecem primeiro.</p><ul class="imp-lista" id="imp-lista-previa">'+itens.map(itemPrevia).join('')+'</ul><p class="dica" id="imp-vazio" hidden>Nenhum item corresponde aos filtros escolhidos.</p>'+
   '<div class="aviso azul">Tudo entra como rascunho: nada é liberado aos alunos, nenhuma prova é aprovada e nada é apagado. Depois de importar, revise cada curso, aprove as provas e libere pela tela.</div>'+
   '<div class="acoes"><button type="button" class="botao" id="imp-confirmar"'+(p.bloqueado?' disabled':'')+'>Confirmar importação</button><button type="button" class="botao suave" id="imp-outro">Escolher outro arquivo</button></div>'+(p.bloqueado?'<p class="dica" role="status">Corrija os erros do pacote e escolha o arquivo de novo para importar.</p>':'')+'</section>';
 }
 function importar(app){
  if(!souAdmin()){A().layout(app,'Importação restrita','Somente a administração importa pacotes de cursos e materiais.');return;}
  const el=A().layout(app,'Importar pacote','Traga cursos e materiais preparados fora do sistema. Tudo entra como rascunho para revisão.','<a class="botao mini suave" href="#/escola">← Gestão de cursos</a>');
  let plano=null,pacote=null,rodando=false,nomeArquivo='',leitura=0;
  el.innerHTML='<div id="imp-guia">'+etapasImportacao(1)+'</div><section class="card imp-selecao"><div class="imp-cabecalho"><div><span class="ac-kicker">Etapa 1 de 4</span><h2>Escolha o pacote</h2></div><span class="imp-situacao">Até 20 MB</span></div><div class="campo imp-arquivo"><label for="imp-arquivo">Selecionar arquivo .json</label><input id="imp-arquivo" type="file" accept=".json,application/json" aria-describedby="imp-arquivo-ajuda"><p class="dica" id="imp-arquivo-ajuda">Selecione o pacote preparado no seu computador. Você confere as alterações antes de importar.</p></div><p class="dica" id="imp-arquivo-estado" role="status">Nenhum pacote selecionado.</p>'+
   '<details class="imp-formato"><summary>Como preparar o arquivo</summary><p>O arquivo é lido somente neste navegador e enviado item a item, pelas mesmas regras da tela. Não guarde pacotes com conteúdo da empresa em pastas públicas.</p><p>Um objeto JSON com <b>versao</b> (do pacote), <b>materiais</b> (lista), <b>cursos</b> (lista) e, se quiser, <b>catalogo</b> com <b>familias</b> e <b>trilhas</b>. Os campos de cada material e curso são os mesmos das telas de edição: o curso tem <b>etapas</b> (as aulas) e pode ter <b>catalogo</b> (trilha, área, nível, carga em minutos, ordem, famílias, cursos recomendados e código).</p><pre class="imp-exemplo">'+esc(JSON.stringify({versao:'2026.10.14',catalogo:{familias:{'familia-exemplo':{nome:'Família de exemplo',cargos:['cargo-exemplo']}},trilhas:{'trilha-exemplo':{nome:'Trilha de exemplo',ordem:1}}},materiais:[{id:'material-exemplo',tipo:'texto',titulo:'Material de exemplo',versao:'1.0',setor:'Setor de exemplo',objetivo:'Objetivo de exemplo',paginas:['Texto fictício']}],cursos:[{id:'curso-exemplo',titulo:'Curso de exemplo',versao:'1.0',setor:'Setor de exemplo',catalogo:{trilha:'trilha-exemplo',nivel:'essencial',cargaMinutos:30},etapas:[{id:'aula-1',titulo:'Aula de exemplo',tipo:'aula',conteudo:{aprender:'…',importancia:'…',comoFazer:'…',erros:'…',evidencia:'…'},materiais:[{id:'material-exemplo'}]}]}]},null,2))+'</pre></details></section><div id="imp-area"></div><section id="imp-resultado"></section>';
  const area=$('#imp-area'),resultado=$('#imp-resultado'),input=$('#imp-arquivo');
  const etapa=n=>{$('#imp-guia').innerHTML=etapasImportacao(n);$('.imp-selecao').hidden=n!==1;};
  const limpar=()=>{if(rodando)return;leitura++;input.value='';plano=null;pacote=null;nomeArquivo='';area.innerHTML='';resultado.innerHTML='';etapa(1);$('#imp-arquivo-estado').textContent='Nenhum pacote selecionado.';input.focus?.();input.scrollIntoView?.({block:'center'});};
  // A lista da biblioteca vem sem as páginas. Para o material do pacote que já
  // existe na mesma versão, abre o material inteiro e confere o conteúdo.
  const contexto=async pac=>{const [p,b]=await Promise.all([E().obterPainel({forcar:true}),A().obterBiblioteca({forcar:true})]);
   const materiais=b.materiais||[],integrais=new Map();
   const mesmos=(Array.isArray(pac?.materiais)?pac.materiais:[]).filter(m=>objeto(m)&&typeof m.id==='string'&&materiais.some(x=>x.id===m.id&&x.versao===m.versao));
   for(const m of mesmos){const r=await A().api('abrirMaterial',{materialId:m.id});if(r?.material)integrais.set(m.id,r.material);}
   return {formacoes:p.formacoes||[],materiais,materiaisIntegrais:integrais,catalogo:E().catalogoCfg(p),cargosRH:Array.isArray(p.gestao?.cargosRH)?p.gestao.cargosRH:null};};
  const mostrar=()=>{
   etapa(2);area.innerHTML=previaHtml(plano,nomeArquivo);$('#imp-outro').onclick=limpar;$('#imp-confirmar').onclick=confirmar;
   const filtrar=()=>{const tipo=$('#imp-filtro-tipo').value,areaEscolhida=$('#imp-filtro-area').value,situacao=$('#imp-filtro-situacao').value,itens=$$('.imp-item',area);let n=0;
    itens.forEach(i=>{const ok=(!tipo||i.dataset.tipo===tipo)&&(!areaEscolhida||i.dataset.area===areaEscolhida)&&(!situacao||i.dataset.situacao===situacao);i.hidden=!ok;if(ok)n++;});
    $('#imp-contagem').textContent=n+' de '+itens.length+' itens nesta lista.';$('#imp-vazio').hidden=!!n;
   };
   for(const id of ['#imp-filtro-tipo','#imp-filtro-area','#imp-filtro-situacao'])$(id).onchange=filtrar;
   filtrar();$('#imp-previa-titulo').focus?.();
  };
  const reconferir=async()=>{
   if(rodando||!pacote)return;const rodada=++leitura;
   resultado.innerHTML='';area.innerHTML='<p class="dica" role="status">Conferindo o pacote com o que já existe na escola…</p>';etapa(2);
   try{const novo=await planejar(pacote,await contexto(pacote));if(rodada!==leitura)return;plano=novo;mostrar();}
   catch(e){if(rodada!==leitura)return;plano=null;area.innerHTML='<div class="aviso amarelo" role="alert">'+esc(e.message||'Não foi possível conferir o pacote.')+' Selecione o arquivo para tentar novamente.</div>';etapa(1);}
  };
  input.onchange=async()=>{
   if(rodando)return;const file=input.files?.[0];if(!file)return;
   const rodada=++leitura;resultado.innerHTML='';plano=null;pacote=null;input.value='';etapa(1);
   $('#imp-arquivo-estado').textContent='Arquivo selecionado: '+(file.name||'pacote.json');
   if(file.size>20*1024*1024){area.innerHTML='<div class="aviso amarelo" role="alert">O arquivo passa de 20 MB. Divida o pacote em partes menores.</div>';return;}
   area.innerHTML='<p class="dica" role="status">Conferindo o pacote com o que já existe na escola…</p>';
   // Limpar o input permite escolher novamente o arquivo corrigido. A rodada
   // impede que uma leitura antiga substitua outro pacote escolhido depois.
   try{const texto=await file.text();if(rodada!==leitura)return;let lido;try{lido=JSON.parse(texto);}catch{throw new Error('O arquivo não é um JSON válido. Confira vírgulas, aspas e chaves.');}
    const novo=await planejar(lido,await contexto(lido));if(rodada!==leitura)return;
    pacote=lido;nomeArquivo=file.name||'';plano=novo;mostrar();
   }catch(e){if(rodada!==leitura)return;area.innerHTML='<div class="aviso amarelo" role="alert">'+esc(e.message||'Não foi possível ler o pacote.')+'</div>';}
  };
  async function confirmar(){
   if(rodando||!plano||plano.bloqueado)return;rodando=true;const bt=$('#imp-confirmar');bt.disabled=true;input.disabled=true;$('#imp-outro').disabled=true;etapa(3);
   const sair=ev=>{ev.preventDefault();ev.returnValue='';};if(typeof window.addEventListener==='function')window.addEventListener('beforeunload',sair);
   try{
    // Confere de novo antes de gravar: se a escola mudou desde a prévia, mostra a nova.
    resultado.innerHTML='<p class="dica" role="status">Conferindo a escola antes de gravar…</p>';
    const novo=await planejar(pacote,await contexto(pacote));
    if(assinaturaPlano(novo)!==assinaturaPlano(plano)){plano=novo;mostrar();resultado.innerHTML='<div class="aviso amarelo" role="alert">A escola mudou desde a prévia. Confira a prévia atualizada e confirme de novo.</div>';return;}
    plano=novo;const total=(plano.catalogo.presente?1:0)+plano.materiais.length+plano.cursos.length;$('#imp-previa').hidden=true;
    let enviados=[],emProcessamento='';
    const confirmado=r=>['gravado','repetido','sem_mudanca'].includes(r.estado);
    const pintar=(res,final)=>{const ok=res.filter(confirmado).length,erros=res.filter(r=>r.estado==='erro').length,naoEnviados=res.filter(r=>r.estado==='nao_enviado').length;
     const item=r=>{const rota=r.tipo==='curso'?'formacao-editor':r.tipo==='material'?'material-editor':r.tipo==='catalogo'?'matriz':'',revisar=final&&confirmado(r)&&rota;
      return '<li class="imp-item imp-'+r.estado+'"><div><b>'+esc(r.titulo||r.id)+'</b><small>'+esc(TIPOS_PREVIA[r.tipo]||'Catálogo')+'</small></div><span class="imp-situacao">'+ESTADO_ENVIO[r.estado]+'</span><p class="dica">'+esc(r.mensagem)+'</p>'+detalhesImportacao(r)+(revisar?'<div class="acoes imp-revisar"><a class="botao mini suave" href="#/'+rota+(r.tipo==='catalogo'?'':'/'+encodeURIComponent(r.id))+'">'+(r.tipo==='curso'?'Revisar curso':r.tipo==='material'?'Revisar material':'Revisar matriz')+'</a></div>':'')+'</li>';
     };
     resultado.innerHTML='<section class="card imp-resultado"><span class="ac-kicker">Etapa '+(final?'4':'3')+' de 4</span><h2 id="imp-resultado-titulo" tabindex="-1">'+(final?'Revise o resultado da importação':'Importando rascunhos')+'</h2><p id="imp-progresso" class="dica" role="status">'+ok+' de '+total+' itens conferidos no servidor'+(final?(ok<total?'; '+(total-ok)+' com erro ou não enviados.':'.'):'. Aguarde a confirmação de cada item.')+'</p><progress class="imp-barra" max="'+Math.max(1,total)+'" value="'+ok+'" aria-label="Itens conferidos no servidor"></progress><div class="imp-resumo imp-resumo-envio"><div><strong id="imp-confirmados">'+ok+'</strong><span>Confirmados</span></div><div><strong id="imp-falhas">'+erros+'</strong><span>Com erro</span></div><div><strong id="imp-nao-enviados">'+naoEnviados+'</strong><span>Não enviados</span></div>'+(!final?'<div><strong>'+(total-res.length)+'</strong><span>Aguardando resposta ou envio</span></div>':'')+'</div>'+
      (!final?'<p id="imp-em-processamento" class="dica" role="status">'+(emProcessamento?'Enviando: '+esc(emProcessamento):'Preparando o próximo item…')+'</p>':'<p class="dica">'+(ok?'Revise os rascunhos confirmados abaixo. Provas e liberação aos alunos continuam pendentes de revisão.':'Nenhum item foi confirmado nesta tentativa.')+'</p>')+
      '<ul class="imp-lista" id="imp-itens">'+res.map(item).join('')+'</ul>'+(final?'<div class="acoes"><a class="botao" href="#/escola">Ir para a gestão de cursos</a>'+(ok<total?'<button type="button" class="botao suave" id="imp-reconferir">Conferir pacote novamente</button>':'')+'<button type="button" class="botao fantasma" id="imp-novo">Escolher outro arquivo</button></div>':'')+'</section>';
     if(final){etapa(4);$('#imp-novo').onclick=limpar;const repetir=$('#imp-reconferir');if(repetir)repetir.onclick=reconferir;$('#imp-resultado-titulo').focus?.();}
    };
    pintar([],false);
    const res=await executarPlano(plano,{api:(acao,corpo,tempo)=>{emProcessamento=corpo.formacao?.titulo||corpo.material?.titulo||'Famílias e trilhas';pintar(enviados,false);return STORE.api(acao,corpo,tempo);},aoProgresso:(r,todos)=>{enviados=todos;emProcessamento='';pintar(todos,false);}});
    E().invalidar?.();pintar(res,true);
   }catch(e){etapa(2);const previa=$('#imp-previa');if(previa)previa.hidden=false;resultado.innerHTML='<div class="aviso amarelo" role="alert">'+esc(e.message||'A importação não foi concluída.')+' Repita a importação: o mesmo pacote não duplica registros.</div>';}
   finally{rodando=false;input.disabled=false;if(typeof window.removeEventListener==='function')window.removeEventListener('beforeunload',sair);const b=$('#imp-confirmar');if(b)b.disabled=!!plano?.bloqueado;const outro=$('#imp-outro');if(outro)outro.disabled=false;}
  }
 }

 async function render(app){
  const hash=location.hash,titulos={catalogo:['Catálogo de cursos','Consultando trilhas e cursos…'],matriz:['Matriz de cargos','Consultando cargos do RH e cursos…'],importar:['Importar pacote','Consultando a escola…']};
  const [t,s]=titulos[ROTA.nome]||titulos.catalogo;
  try{
   if(ROTA.nome==='importar'){importar(app);return;}
   A().layout(app,t,s);
   const d=await E().obterPainel({aoMudar:()=>{if(hash===location.hash)render(app);}});if(hash!==location.hash)return;
   if(ROTA.nome==='matriz')matriz(app,d);else catalogo(app,d);
  }catch(e){const el=A().layout(app,'Precisamos retomar a consulta',e.message||'Tente novamente com conexão.');el.innerHTML='<button class="botao" id="cat-retentar">Tentar novamente</button>';$('#cat-retentar').onclick=()=>render(app);}
 }
 return {render,estadoParaMim,gruposCatalogo,recebe,mesclarCatalogo,planejar,executarPlano,idDeEnvio,slug};
})();
