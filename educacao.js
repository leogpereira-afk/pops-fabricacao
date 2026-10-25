/* Escola interna: operações confirmadas pelo servidor, identidade derivada do RH.
   O catálogo operacional legado continua no STORE; avaliações nunca são upserts livres. */
window.EDUCACAO = (() => {
  // Vocabulário único da tela (14/10/2026): Trilha > Curso > Aula > Atividade
  // (prova ou prática). No servidor o curso continua sendo "formação" e a aula,
  // "etapa"; ids, rotas e campos não mudam. "Jornada" fica só para as jornadas
  // de fabricação (#/fab), que são outra coleção.
  const estados={nao_iniciada:'Não iniciada',em_andamento:'Em andamento',aguardando_validacao:'Aguardando validação',concluida:'Concluída',revisar:'Revisão necessária'};
  const tipos={cultura:'Conhecer a Impresilk',etica:'Código de Ética e Conduta',caderno:'Caderno da função',pop:'POPs da função',pratica:'Prática acompanhada',avaliacao:'Avaliação e conclusão',continua:'Educação contínua',aula:'Aula (conteúdo próprio ou de sistema)'};
  // Estrutura de partida de um curso novo: as sete aulas modelo de sempre. A aula
  // de conteúdo próprio entra pelo botão "+ Aula".
  const MODELO_CURSO=['cultura','etica','caderno','pop','pratica','avaliacao','continua'];
  const niveis={essencial:'Essencial',intermediario:'Intermediário',avancado:'Avançado'};
  const plural=(n,um,varios)=>n+' '+(n===1?um:varios);
  // Consulta mais nova que isto é reaproveitada sem perguntar de novo ao servidor
  // (navegar entre Início, curso e Catálogo); mais velha é mostrada e conferida.
  const FRESCO_MS=30000;
  let snapshot=null, identidade='', carregando=null, erro='', mutacao=null, enviando=false, seq=0;
  const rascunhosPratica=new Map();
  let bibliotecaEditor=null, snapshotEm=0, snapshotDoAparelho=false, exigirFresco=false, mutacoes=0, renderEm=0, interacaoEm=0;
  const rota=(id,etapa)=>'#/formacao/'+encodeURIComponent(id)+(etapa?'/'+encodeURIComponent(etapa):'');
  const pessoaKey=()=>[SESSAO?.usuario,SESSAO?.papel,SESSAO?.pessoaRH?.colaboradorId].join('|');
  function pendenciaKey(){return 'educacao_envio_v1_'+encodeURIComponent(pessoaKey());}
  // Cache no aparelho (auditoria de 14/10, P2-5): cada aba da escola esperava de
  // 5 a 7 s pelo servidor. A tela mostra a última consulta guardada e confere com
  // o servidor logo em seguida (stale-while-revalidate). Regras da casa:
  // - IndexedDB, nunca localStorage: os sistemas da origem dividem os 5 MB dele.
  // - Uma entrada por consulta, carimbada com quem a baixou (login, papel e ID do
  //   RH) e com a versão da tela (config.js). Outro crachá, outro papel ou outra
  //   versão nunca leem o pacote: a leitura confere o carimbo, e cada gravação
  //   apaga o que for de outra identidade (aparelho dividido na fábrica).
  // - Sair da conta ou crachá recusado apaga tudo, mesmo com envio pendente: o
  //   envio pendente mora em outro lugar (sessionStorage), o cache é descartável.
  // - Validade de 7 dias pelo relógio deste aparelho (recebidoEm), não pelo do servidor.
  const aparelho=(()=>{
    const BANCO='impresilk-escola-cache',ARMAZEM='consultas',VALIDADE_MS=7*24*3600*1000;
    const versaoTela=()=>String((typeof window!=='undefined'&&window.ESCOLA_TELA_VERSAO)||'');
    let conexao=null;
    function abrir(){
      if(typeof indexedDB==='undefined')return Promise.reject(new Error('Sem IndexedDB.'));
      if(conexao)return conexao;
      conexao=new Promise((resolve,reject)=>{let req;try{req=indexedDB.open(BANCO,1);}catch(e){reject(e);return;}
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(ARMAZEM))req.result.createObjectStore(ARMAZEM);};
        req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();conexao=null;};resolve(db);};
        req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Cache bloqueado por outra aba.'));});
      conexao.catch(()=>{conexao=null;});return conexao;
    }
    function pedir(modo,acao){return abrir().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(ARMAZEM,modo),st=tx.objectStore(ARMAZEM);let res;const q=acao(st);if(q)q.onsuccess=()=>{res=q.result;};tx.oncomplete=()=>resolve(res);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);}));}
    const chave=tipo=>tipo+'|'+pessoaKey();
    async function ler(tipo){try{const ident=pessoaKey(),v=await pedir('readonly',st=>st.get(chave(tipo)));if(!v||!v.dados||v.identidade!==ident||ident!==pessoaKey()||v.versaoTela!==versaoTela()||!(Date.now()-v.recebidoEm<VALIDADE_MS))return null;return v;}catch{return null;}}
    async function gravar(tipo,dados){const ident=pessoaKey();try{await pedir('readwrite',st=>{const ks=st.getAllKeys();ks.onsuccess=()=>{for(const k of ks.result||[])if(String(k).split('|').slice(1).join('|')!==ident)st.delete(k);};st.put({identidade:ident,versaoTela:versaoTela(),recebidoEm:Date.now(),dados},tipo+'|'+ident);return null;});}catch{/* Cache é opcional: sem espaço ou sem IndexedDB, a tela consulta o servidor. */}}
    async function apagar(tipo){try{await pedir('readwrite',st=>st.delete(chave(tipo)));}catch{/* nada guardado */}}
    async function limpar(){try{await pedir('readwrite',st=>st.clear());}catch{/* nada guardado */}}
    return {ler,gravar,apagar,limpar};
  })();
  // Mudança de dados por cima do que a pessoa está digitando apagaria o que ela
  // fez: depois de qualquer interação (digitar, marcar, abrir um quadro ou menu),
  // a tela só oferece "Mostrar agora". toggle não borbulha, mas a captura pega.
  if(typeof document!=='undefined'&&typeof document.addEventListener==='function')for(const ev of ['input','change','toggle'])document.addEventListener(ev,()=>{interacaoEm=Date.now();},true);
  function marcarRender(){renderEm=Date.now();interacaoEm=0;}
  function houveInteracao(){if(interacaoEm&&interacaoEm>=renderEm)return true;try{return !!(typeof document!=='undefined'&&document.querySelector?.('dialog[open], .nav-escola[open], textarea:focus, input:focus, select:focus'));}catch{return false;}}
  const assinatura=d=>{try{return JSON.stringify({...(d||{}),atualizadoEm:null});}catch{return String(Math.random());}};
  function htmlAtualizacao(doAparelho,em){return doAparelho?'<p class="dica escola-atualizacao" id="escola-atualizacao" role="status">Mostrando a última consulta deste aparelho'+(em?', de '+esc(fmtDataHora(new Date(em).toISOString())):'')+'. Conferindo com o servidor…</p>':'';}
  // Depois de conferir: igual, some o aviso; diferente, redesenha se a pessoa não
  // mexeu na tela, senão oferece o botão; sem conexão, diz que é a cópia do aparelho.
  function concluirAtualizacao(resultado,aoMudar){
    const el=typeof document!=='undefined'&&document.getElementById?document.getElementById('escola-atualizacao'):null;
    if(resultado==='falhou'){if(el)el.textContent='Sem conexão com o servidor agora. Esta é a última consulta guardada neste aparelho.';return;}
    if(resultado==='igual'){if(el)el.remove?.();return;}
    if(!houveInteracao()&&typeof aoMudar==='function'){aoMudar();return;}
    if(el){el.innerHTML='Há informações novas da escola. <button type="button" class="botao mini suave" id="escola-mostrar-novo">Mostrar agora</button>';const bt=el.querySelector?.('#escola-mostrar-novo');if(bt)bt.onclick=()=>aoMudar?.();}
  }
  function zerar(){rascunhosPratica.clear();snapshot=null;snapshotEm=0;snapshotDoAparelho=false;erro='';mutacao=null;enviando=false;carregando=null;seq++;identidade=pessoaKey();try{if(typeof sessionStorage!=='undefined')mutacao=JSON.parse(sessionStorage.getItem(pendenciaKey()) || 'null');}catch{erro='Não foi possível recuperar o envio deste aparelho. Confira o histórico antes de responder novamente.';}}
  function conferirIdentidade(){if(identidade!==pessoaKey())zerar();}
  function renderAtual(){return typeof renderApp==='function'?renderApp():render($('#app'));}
  function estadoEnvio(){return {pendente:!!mutacao,enviando,erro,consultando:!!carregando};}
  function podeAcompanhar(){return !!(snapshot?.gestao?.podeGerir || snapshot?.gestao?.podeValidar);}
  function notificarEstado(){if(typeof window.dispatchEvent==='function' && typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent('educacao:estado'));}
  async function conferirEstado(){if(mutacao && !enviando)return executar(mutacao,()=>renderAtual());snapshot=null;await carregar();if(['inicio','formacao','formacao-editor','conquistas','escola'].includes(ROTA.nome) && ROTA.nome!=='formacao-editor')await render($('#app'));else if(erro)toast(erro,'erro');}
  async function arquivoPendente(modo,valor){
    if(typeof indexedDB==='undefined')throw new Error('O navegador não disponibilizou o armazenamento necessário para este PDF.');
    const chave=pendenciaKey();return new Promise((resolve,reject)=>{const req=indexedDB.open('impresilk-escola-envios',1);req.onupgradeneeded=()=>req.result.createObjectStore('arquivos');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('arquivos',modo==='get'?'readonly':'readwrite'),store=tx.objectStore('arquivos');const q=modo==='get'?store.get(chave):modo==='put'?store.put(valor,chave):store.delete(chave);let result;q.onsuccess=()=>result=q.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};};});
  }
  async function guardarEnvio(envio){if(typeof sessionStorage==='undefined')return;if(envio.operacao==='academia.enviarPDF'){await arquivoPendente('put',envio);const {base64,...meta}=envio;sessionStorage.setItem(pendenciaKey(),JSON.stringify({...meta,arquivoIdb:true}));}else sessionStorage.setItem(pendenciaKey(),JSON.stringify(envio));}

  function limparEnvio(){try{if(typeof sessionStorage!=='undefined')sessionStorage.removeItem(pendenciaKey());if(typeof indexedDB!=='undefined')arquivoPendente('delete').catch(()=>{});}catch{/* Identificador persistido será reenviado sem duplicar a atividade. */}}
  if(typeof window.addEventListener==='function')window.addEventListener('beforeunload',ev=>{if(mutacao){ev.preventDefault();ev.returnValue='';}});

  // Texto das aulas: o curso traz **negrito**, subtítulo (linha só em negrito) e
  // listas ("- " e "1. "). Escapa primeiro e só depois troca o que é permitido:
  // nenhum HTML vindo do curso chega à tela (auditoria de 15/10, J01).
  function textoAula(s){
    const negrito=t=>esc(t).replace(/\*\*([^*\n]+?)\*\*/g,'<strong>$1</strong>');
    return String(s||'').replace(/\r\n?/g,'\n').split(/\n{2,}/).map(bloco=>{
      const out=[];let lista=null,para=[];
      const fecharPara=()=>{if(para.length){out.push('<p>'+para.join('<br>')+'</p>');para=[];}};
      const fecharLista=()=>{if(lista){out.push('<'+lista.tag+(lista.inicio>1?' start="'+lista.inicio+'"':'')+'>'+lista.itens.map(i=>'<li>'+i+'</li>').join('')+'</'+lista.tag+'>');lista=null;}};
      for(const linha of bloco.split('\n')){
        const t=linha.trim();if(!t)continue;let m;
        if((m=/^[-•]\s+(.+)$/.exec(t))){fecharPara();if(lista?.tag!=='ul'){fecharLista();lista={tag:'ul',itens:[]};}lista.itens.push(negrito(m[1]));continue;}
        if((m=/^(\d{1,2})[.)]\s+(.+)$/.exec(t))){fecharPara();if(lista?.tag!=='ol'){fecharLista();lista={tag:'ol',itens:[],inicio:Number(m[1])};}lista.itens.push(negrito(m[2]));continue;}
        fecharLista();
        if((m=/^\*\*([^*]+)\*\*:?$/.exec(t))){fecharPara();out.push('<h4>'+esc(m[1])+'</h4>');continue;}
        para.push(negrito(t));
      }
      fecharPara();fecharLista();return out.join('');
    }).join('');
  }
  // Silk, o mascote (mesmas regras do Painel, 13 e 14/10): imagem decorativa
  // (alt vazio, fora do leitor de tela), sem clique, nunca sobre botão ou campo,
  // uma por tela, com tamanho reservado e fora da impressão. O guia fica antes
  // do conteúdo, nunca entre questões, em erro ou em curso de segurança.
  const SILK_POSES={celebrando:[240,360],'boas-vindas':[224,360],apontando:[196,360],confiante:[167,360],rolo:[190,360],espatula:[200,360]};
  // Curso de segurança (altura, máquina, solda) não tem Silk: ele não usa o EPI certo.
  const semSilk=f=>!!f&&(f.catalogo?.seguranca===true||/seguranc/.test(norm(f.titulo||'')));
  function silk(pose,altura,cls=''){const d=SILK_POSES[pose];if(!d)return '';const w=Math.round(d[0]*altura/d[1]);return '<img class="silk'+(cls?' '+cls:'')+'" src="./silk/silk-'+pose+'-'+(altura>120?'g':'p')+'.webp" width="'+w+'" height="'+altura+'" alt="" aria-hidden="true" decoding="async"'+(altura>120?'':' loading="lazy"')+'>';}
  // Ordem de estudo: trilha (Núcleo comum primeiro), depois a ordem do curso na
  // trilha. Sem progresso, o primeiro passo segue essa ordem, não a ordem em que
  // o servidor mandou (auditoria de 15/10, J02).
  function chaveOrdem(f,d=snapshot){const c=f.catalogo||{},t=c.trilha?catalogoCfg(d).trilhas[c.trilha]:null;return [t&&Number.isInteger(Number(t.ordem))?Number(t.ordem):9999,Number.isInteger(c.ordem)?c.ordem:9999,String(f.titulo||'')];}
  function emOrdem(fs,d=snapshot){return fs.slice().sort((a,b)=>{const x=chaveOrdem(a,d),y=chaveOrdem(b,d);return x[0]-y[0]||x[1]-y[1]||x[2].localeCompare(y[2],'pt-BR');});}
  function status(e,p){return e?.status || p?.status || 'nao_iniciada';}
  function progresso(f,p){if(f.progresso)return f.progresso;const es=(f.etapas || []).filter(e=>e.obrigatoria!==false),concluidas=es.filter(e=>status(e,p?.etapas?.[e.id])==='concluida').length;return {total:es.length,concluidas,percentual:es.length?Math.round(concluidas/es.length*100):0};}
  function bloqueio(f,e,p){
    if(e.motivoBloqueio)return e.motivoBloqueio;
    const faltam=(e.prerequisitos || []).filter(id=>p?.etapas?.[id]?.status!=='concluida');
    if(faltam.length)return 'Conclua antes: '+faltam.map(id=>f.etapas.find(x=>x.id===id)?.titulo || id).join(', ')+'.';
    if(e.preparacaoPendente || e.statusFonte==='pendente')return 'Conteúdo em preparação pela gestão.';
    return '';
  }
  const meuProgresso=f=> (snapshot?.aprendizagem || []).find(p=>p.formacaoId===f.id) || {etapas:{},pontos:0,conquistas:[],historico:[]};
  function proxima(f,p){return (f.etapas || []).find(e=>e.obrigatoria!==false && status(e,p.etapas?.[e.id])!=='concluida') || (f.etapas || []).find(e=>status(e,p.etapas?.[e.id])!=='concluida');}
  // Próxima aula que depende da pessoa: a prática enviada espera o validador.
  function proximaParaMim(f,p){const ok=e=>!['concluida','aguardando_validacao'].includes(status(e,p.etapas?.[e.id]))&&!bloqueio(f,e,p);return (f.etapas || []).find(e=>e.obrigatoria!==false && ok(e)) || (f.etapas || []).find(ok);}
  const aguardaValidacao=(f,p)=>(f.etapas || []).find(e=>status(e,p.etapas?.[e.id])==='aguardando_validacao');
  const iniciado=(f,p)=>!!(p?.atualizadoEm || Object.keys(p?.etapas || {}).length);
  function selo(st){return '<span class="edu-status '+esc(st)+'">'+esc(estados[st] || st)+'</span>';}
  function iconeEscola(tipo){
    const paths={casa:'M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',equipe:'M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M3 20v-3a6 6 0 0 1 12 0v3 M16 4a3 3 0 0 1 0 6 M18 13a5 5 0 0 1 3 5v2',play:'M9 6l10 6-10 6z M3 3h18v18H3z',livro:'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z M13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3',alvo:'M21 12a9 9 0 1 1-9-9 M17 12a5 5 0 1 1-5-5 M12 12l9-9 M17 3h4v4',ferramenta:'M14 4a6 6 0 0 0-7 7L3 15v6h6l4-4a6 6 0 0 0 7-7l-4 3-4-4z',conversa:'M4 4h16v12H9l-5 4z M8 8h8 M8 12h5',pasta:'M3 6h7l2 3h9v12H3z M3 6V3h7l2 3h9v3',medalha:'M8 3l4 6 4-6 M6 3l4 8 M18 3l-4 8 M12 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12 M12 13v6 M9 16h6',check:'M5 12l4 4L19 6',relogio:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',cadeado:'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3',pessoa:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 21v-2a8 8 0 0 1 16 0v2',seta:'M4 12h16 M14 6l6 6-6 6'};
    return '<svg class="edu-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+(paths[tipo]||paths.livro)+'"></path></svg>';
  }
  const conquistaDaAula=(f,e,p)=>(p.conquistas||[]).find(c=>c.chave===f.id+':'+e.id);
  function pontosDaAula(f,e,p){const c=conquistaDaAula(f,e,p);return c?'Conquista já registrada · '+Number(c.pontos||0)+' pontos no histórico':Number(e.pontos||0)+' pontos ao cumprir o critério';}
  function metricasHtml(itens){return '<div class="edu-metricas">'+itens.map(i=>'<a class="edu-metrica" href="'+i.href+'"'+(i.alvo?' data-scroll="'+i.alvo+'"':'')+'>'+iconeEscola(i.icone)+'<span><strong>'+esc(i.valor)+'</strong><span>'+esc(i.rotulo)+'</span></span></a>').join('')+'</div>';}
  function barraCurso(pr,titulo){return '<div class="edu-progresso"><progress max="'+Math.max(1,pr.total)+'" value="'+pr.concluidas+'" aria-label="Aulas obrigatórias concluídas em '+esc(titulo)+'"></progress><b>'+pr.percentual+'%</b></div><p class="dica">'+pr.concluidas+' de '+pr.total+' aulas obrigatórias concluídas</p>';}
  function itemDoPlano(fid){return snapshot?.planoPessoal?.ativa!==false?(snapshot?.planoPessoal?.itens||[]).find(i=>i.formacaoId===fid):null;}
  function contextoPlanoHtml(fid){const i=itemDoPlano(fid);return i?'<aside class="edu-orientacao"><span class="edu-contexto">'+iconeEscola(i.contexto==='flexivel'?'casa':'pessoa')+(i.contexto==='flexivel'?'Estudo flexível':'Na empresa')+'</span>'+(i.prazo?'<span class="dica">Combinado para '+fmtData(i.prazo)+'</span>':'')+(i.orientacao?'<p>'+esc(i.orientacao)+'</p>':'')+(i.contexto==='flexivel'?'<p class="dica">Pode estudar em casa ou em outro local tranquilo, no horário combinado. Atividades práticas com equipamentos continuam acompanhadas.</p>':'')+'</aside>':'';}
  function equipeHtml(){const eq=snapshot?.equipeTrabalho;if(!eq)return '';const nome=eq.estado==='vinculada'?eq.nome:eq.estado==='multipla'?'Mais de uma equipe vinculada':eq.estado==='indisponivel'?'Equipe indisponível':eq.estado==='sem_vinculo'?'Vínculo com a equipe a conferir':'Sem equipe de trabalho vinculada';return '<span class="edu-equipe">'+iconeEscola('equipe')+esc(nome||'Equipe a conferir')+'</span>';}
  function planoPessoalHtml(){const plano=snapshot?.planoPessoal;if(!plano||plano.ativa===false)return '';const fs=(plano.itens||[]).flatMap(i=>{const f=snapshot.formacoes.find(f=>f.id===i.formacaoId&&f.publicada&&f.ativa!==false&&f.liberada!==false);return f?[{i,f}]:[];}),completos=fs.filter(({f})=>progresso(f,meuProgresso(f)).percentual===100).length;return '<section class="edu-plano-pessoal" aria-labelledby="edu-plano-titulo"><div class="secao-titulo"><div><span class="eyebrow">PREPARADO PARA VOCÊ</span><h2 id="edu-plano-titulo">'+esc(plano.titulo||'Minha jornada')+'</h2></div><span class="edu-plano-selo">'+iconeEscola('alvo')+completos+'/'+fs.length+' cursos</span></div>'+(plano.objetivo?'<p>'+esc(plano.objetivo)+'</p>':'')+'<ol class="edu-plano-caminho">'+fs.map(({i,f},n)=>{const pr=progresso(f,meuProgresso(f)),feito=pr.percentual===100;return '<li class="'+(feito?'feito':'')+'"><span class="edu-plano-num">'+(feito?iconeEscola('check'):n+1)+'</span><a href="'+rota(f.id)+'"><strong>'+esc(f.titulo)+'</strong><span>'+ (feito?'Concluído':pr.concluidas+'/'+pr.total+' aulas')+' · '+(i.contexto==='flexivel'?'Estudo flexível':'Na empresa')+(i.prazo?' · '+fmtData(i.prazo):'')+'</span></a></li>';}).join('')+'</ol>'+(fs.length<(plano.itens||[]).length?'<p class="dica">Há um curso indisponível. A gestão precisa conferir a liberação.</p>':'')+'</section>';}
  // Identidade visual por área. Não cria vínculos nem modifica a ordem do catálogo.
  function visualArea(id=''){
    // Só apresentação: trilhas personalizadas conservam seu ID e sua liberação.
    if(/financ/.test(norm(id)))id='financeiro';
    const temas={'nucleo-comum':['azul','equipe'],comercial:['rosa','conversa'],producao:['ciano','ferramenta'],adm:['ouro','pasta'],administrativo:['ouro','pasta'],financeiro:['ouro','pasta'],lideranca:['violeta','alvo'],'gestao-lideranca':['violeta','alvo'],carreira:['verde','medalha'],instalacao:['ciano','ferramenta']};
    const padrao=['azul','ciano','rosa','ouro','verde','violeta'];
    const [tema,icone]=temas[id]||[padrao[Array.from(id).reduce((s,c)=>s+c.charCodeAt(0),0)%padrao.length],'livro'];
    const imagens={equipe:'boas-vindas',conversa:'comercial',ferramenta:'producao',pasta:'administrativo',alvo:'desenvolvimento',medalha:'desenvolvimento',livro:'aprendizagem'};
    const imagem=['mubisys','sistema','sistemas','sistema-demo'].includes(id)?'sistemas':imagens[icone];
    return {tema,icone,imagem:'./areas/'+imagem+'.webp'};
  }
  function visualCurso(f){
    const v=visualArea(f.catalogo?.trilha),assunto=norm([f.titulo,f.catalogo?.area].filter(Boolean).join(' '));
    // A ilustração ajuda a reconhecer o assunto; não classifica nem vincula dados.
    const temas=[[/cobrar|cobranca/,'comercial','rosa','Conversar e resolver'],[/cadastro|cliente|fornecedor/,'cadastros','ciano','Conhecer e organizar'],[/banco|pagamento|pagar|receber|recebimento|salario|folha/,'pagamentos','azul','Conferir e agir'],[/analise|indicador|fechamento|fluxo de caixa|conciliacao|competencia/,'analise','violeta','Entender e decidir'],[/nota fiscal|faturamento|documento/,'administrativo','ouro','Organizar e conferir']];
    const tema=temas.find(([re])=>re.test(assunto));
    return tema?{imagem:'./areas/'+tema[1]+'.webp',tema:tema[2],chamada:tema[3]}:{...v,chamada:'Aprender e praticar'};
  }
  function arteCurso(f,href=''){
    const v=visualCurso(f),tag=href?'a':'div';
    if(f.maquina?.foto)return '<'+tag+' class="edu-capa-curso em-capa"'+(href?' href="'+esc(href)+'" aria-label="Abrir curso: '+esc(f.titulo)+'"':'')+'><img src="'+esc(f.maquina.foto)+'" alt="'+esc(f.maquina.nome)+'" loading="lazy"><span>Aprender nesta máquina</span></'+tag+'>';
    return '<'+tag+' class="edu-capa-curso edu-capa-3d" data-tema="'+v.tema+'"'+(href?' href="'+esc(href)+'" aria-label="Abrir curso: '+esc(f.titulo)+'"':' aria-hidden="true"')+'><span class="edu-capa-texto" aria-hidden="true"><small>ESCOLA IMPRESILK</small><strong>'+v.chamada+'</strong><span>Conhecimento para a vida '+iconeEscola('seta')+'</span></span><img class="edu-capa-imagem" src="'+v.imagem+'" width="480" height="480" alt="" aria-hidden="true" loading="lazy" decoding="async"></'+tag+'>';
  }
  function guiaSilkHtml(titulo,texto,pose='apontando'){
    return '<aside class="edu-silk-guia">'+silk(pose,120)+'<div><span class="eyebrow">JUNTOS COM O SILK</span><strong>'+esc(titulo)+'</strong><p>'+esc(texto)+'</p></div></aside>';
  }
  function incentivoHtml(f,e,p,r){
    if(erro||mutacao||bloqueio(f,e,p))return '';
    const st=status(e,r),feito=st==='concluida',espera=st==='aguardando_validacao',lida=!!r.leituraEm;
    if(!feito&&!espera&&!lida)return '';
    const seguinte=feito?proximaParaMim(f,p):null,c=conquistaDaAula(f,e,p),titulo=feito?'Aula concluída. Você avançou!':espera?'Atividade enviada. Mais um passo!':r.cienciaEm?'Ciência registrada. Vamos seguir!':'Leitura registrada. Vamos colocar em prática?',sub=feito?(progresso(f,p).percentual===100?'Você completou este curso. Leve esse aprendizado para a sua rotina.':'Cada passo conta. Seu próximo aprendizado está logo à frente.'):espera?'Sua evidência está com o responsável. A conclusão depende da validação.':(e.quiz||[]).length?'Agora confira o que aprendeu respondendo à prova.':'Siga os critérios desta aula para concluir o aprendizado.';
    return '<section class="edu-incentivo '+(feito?'edu-incentivo-feito':espera?'edu-incentivo-espera':'')+'" role="status" aria-live="polite">'+(!semSilk(f)?silk(feito?'celebrando':espera?'apontando':'boas-vindas',140):'<span class="edu-incentivo-icone">'+iconeEscola(feito?'medalha':'check')+'</span>')+'<div><span class="eyebrow">'+(feito?'PROGRESSO CONFIRMADO':espera?'AGUARDANDO O RESPONSÁVEL':'ESTUDO EM ANDAMENTO')+'</span><h2>'+titulo+'</h2><p>'+sub+'</p>'+(feito&&c?'<span class="edu-recompensa">'+iconeEscola('medalha')+Number(c.pontos||0)+' pontos no seu histórico</span>':'')+(feito?'<a class="botao mini edu-incentivo-proximo" href="'+(seguinte?rota(f.id,seguinte.id):'#/')+'">'+(seguinte?'Próximo aprendizado':'Ver minha jornada')+' →</a>':'')+'</div></section>';
  }

  // A navegação (topo e subnavegação do grupo) vem do htmlTopo; a antiga fileira
  // de sete botões da academia repetia as abas e empurrava o título para baixo.
  function header(aba='inicio'){return htmlTopo(aba)+'<div class="miolo escola">';}
  function intro(titulo,sub,acoes=''){return '<header class="edu-cab"><div><div class="eyebrow">ESCOLA IMPRESILK</div><h1>'+esc(titulo)+'</h1><p>'+esc(sub)+'</p></div><div class="acoes">'+acoes+'</div></header>';}
  function aviso(){return htmlAtualizacao(snapshotDoAparelho&&!!snapshot,snapshotEm)+(erro?'<div class="aviso amarelo" role="alert">'+esc(erro)+' <button class="botao mini suave" id="edu-recarregar">Tentar novamente</button></div>':'')+(mutacao?'<div class="aviso amarelo" role="alert">A confirmação ainda não chegou. Sua atividade continua nesta tela. <button class="botao mini suave" id="edu-reenviar">Conferir envio</button></div>':'');}
  function fim(app){app.insertAdjacentHTML('beforeend','');ligarTopo();$$('[data-scroll]').forEach(a=>a.onclick=ev=>{ev.preventDefault();const alvo=document.getElementById(a.dataset.scroll);if(alvo?.tagName==='DETAILS')alvo.open=true;alvo?.scrollIntoView({behavior:'smooth'});});const bt=$('#edu-recarregar');if(bt)bt.onclick=()=>{snapshot=null;render(app);};const re=$('#edu-reenviar');if(re)re.onclick=()=>executar(mutacao,()=>{snapshot=null;render(app);});}
  async function carregar(){
    if(identidade!==pessoaKey())zerar();
    if(carregando)return carregando;
    const ciclo=seq,conta=pessoaKey();
    carregando=STORE.api('escola',{operacao:'painel'}).then(r=>{if(ciclo!==seq || conta!==pessoaKey())return; if(r?.ok!==true || !Array.isArray(r.formacoes) || !Array.isArray(r.aprendizagem))throw new Error('A consulta da escola não foi confirmada pelo servidor. Tente novamente.');snapshot=r;snapshotEm=Date.now();snapshotDoAparelho=false;exigirFresco=false;erro='';aparelho.gravar('painel',r);}).catch(e=>{if(ciclo===seq)erro=e.message || 'Não foi possível consultar a escola. Tente novamente.';}).finally(()=>{if(ciclo===seq){carregando=null;notificarEstado();}});
    notificarEstado();return carregando;
  }
  function usarDoAparelho(salvo){snapshot=salvo.dados;snapshotEm=salvo.recebidoEm;snapshotDoAparelho=true;}
  const precisaConferir=()=>!!snapshot&&(snapshotDoAparelho||Date.now()-snapshotEm>FRESCO_MS);
  function revalidar(aoMudar){
    const antes=snapshot,assinaturaAntes=assinatura(antes),ciclo=seq;
    return carregar().then(()=>{if(ciclo!==seq)return;concluirAtualizacao(snapshot===antes?'falhou':assinatura(snapshot)===assinaturaAntes?'igual':'mudou',aoMudar);});
  }
  // Ponto único de leitura do painel para as outras telas da escola (catálogo,
  // matriz, acompanhamento, avaliações e importação). fresco: aceita só consulta
  // recente do servidor (editor); forcar: pergunta de novo, sempre (importação).
  async function obterPainel(opcoes={}){
    conferirIdentidade();const conta=pessoaKey();
    if(opcoes.forcar || ((opcoes.fresco||exigirFresco) && (snapshotDoAparelho || Date.now()-snapshotEm>FRESCO_MS)))snapshot=null;
    if(!snapshot && !opcoes.fresco && !opcoes.forcar && !exigirFresco){const salvo=await aparelho.ler('painel');if(conta!==pessoaKey())throw new Error('A conta mudou durante a consulta. Abra a tela novamente.');if(salvo && !snapshot)usarDoAparelho(salvo);}
    if(!snapshot){await carregar();if(conta!==pessoaKey())throw new Error('A conta mudou durante a consulta. Abra a tela novamente.');if(!snapshot)throw new Error(erro || 'Não foi possível consultar a escola. Tente novamente.');return snapshot;}
    if(precisaConferir())revalidar(opcoes.aoMudar);
    return snapshot;
  }
  // A biblioteca guarda na memória a última consulta e a que está em andamento:
  // sai junto, para o próximo crachá do aparelho não receber a de quem saiu.
  function limparCacheAparelho(){snapshot=null;snapshotEm=0;snapshotDoAparelho=false;try{window.ACADEMIA?.zerar?.();}catch{/* biblioteca ainda não carregada */}return aparelho.limpar();}
  // Gravação feita fora do executar (importação de pacote): mesma regra de depois
  // de gravar, a próxima tela espera o servidor.
  function invalidar(){snapshot=null;snapshotDoAparelho=false;exigirFresco=true;mutacoes++;aparelho.apagar('painel');aparelho.apagar('biblioteca');}
  const htmlAtualizacaoPainel=()=>htmlAtualizacao(snapshotDoAparelho&&!!snapshot,snapshotEm);
  async function executar(payload,feito){
    if(enviando)return null;
    if(mutacao && payload!==mutacao){toast('Confira o envio anterior antes de iniciar outra atividade.','erro');return;}
    if(payload.arquivoIdb){try{const recuperado=await arquivoPendente('get');if(!recuperado||recuperado.mutationId!==payload.mutationId)throw new Error('PDF pendente não está mais neste aparelho. Mantenha a cópia original e confira o material com a gestão.');payload=recuperado;}catch(e){erro=e.message;mostrarFalha();notificarEstado();return null;}}
    const envio=payload.mutationId?payload:{...payload,mutationId:uuid()}, conta=pessoaKey();
    enviando=true;notificarEstado();
    try{await guardarEnvio(envio);}catch{enviando=false;erro='Não foi possível preservar este envio no aparelho. Nenhuma atividade foi enviada. Mantenha o formulário aberto, libere espaço e tente novamente.';mostrarFalha();notificarEstado();return null;}mutacao=envio;enviando=true;notificarEstado();
    try{
      const r=await STORE.api('escola',envio);
      if(r?.ok!==true)throw new Error('O servidor não confirmou a gravação. Confira o envio antes de continuar.');
      if(conta!==pessoaKey()){zerar();return;}
      // Depois de gravar, a próxima tela espera o servidor: a cópia do aparelho
      // mostraria o estado de antes e desmentiria o "confirmado".
      mutacao=null;limparEnvio();erro='';snapshot=null;snapshotDoAparelho=false;exigirFresco=true;mutacoes++;aparelho.apagar('painel');aparelho.apagar('biblioteca');enviando=false;notificarEstado();
      if(feito){try{await feito(r);}catch{erro='Registro confirmado no servidor. Não foi possível atualizar a visualização; tente consultar novamente.';mostrarFalha();}}
      return r;
    }catch(e){
      if(conta!==pessoaKey()){zerar();return;}
      // Erro de validação é resposta definitiva; falha de rede mantém o mesmo identificador.
      if(e.status && e.status>=400 && e.status<500 && ![408,429].includes(e.status)){mutacao=null;limparEnvio();}
      erro=e.message || 'Envio sem confirmação. Tente novamente com esta tela aberta.';
      toast(erro,'erro');mostrarFalha();return null;
    }finally{enviando=false;notificarEstado();
    }
  }
  function mostrarFalha(){
    const main=$('.escola');if(!main)return;
    let box=$('#edu-envio-estado');if(!box){box=document.createElement('div');box.id='edu-envio-estado';box.className='aviso amarelo';box.setAttribute('role','alert');main.prepend(box);}
    box.innerHTML=esc(erro)+(mutacao?' <button class="botao mini suave" id="edu-retentar-envio">Conferir envio</button>':' <button class="botao mini suave" id="edu-reconsultar">Consultar novamente</button>');
    const retry=$('#edu-retentar-envio');if(retry)retry.onclick=async()=>{retry.disabled=true;const r=await executar(mutacao,()=>{snapshot=null;renderAtual();});if(!r&&retry.isConnected)retry.disabled=false;};
    const reload=$('#edu-reconsultar');if(reload)reload.onclick=()=>{snapshot=null;renderAtual();};
  }
  async function atualizarEtapa(app,fid,eid){await carregar();if(!snapshot){erro='Registro confirmado no servidor. A consulta atualizada está indisponível; tente novamente.';mostrarFalha();return false;}const f=snapshot.formacoes.find(x=>x.id===fid),e=f?.etapas?.find(x=>x.id===eid);if(f&&e){etapa(app,f,e);const incentivo=$('.edu-incentivo');if(incentivo){incentivo.setAttribute('tabindex','-1');incentivo.focus?.({preventScroll:true});incentivo.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'center'});}}else render(app);return true;}
  // Catálogo (trilha, área, nível, carga): metadado do curso, igual para todos.
  function cargaTexto(min){min=Number(min)||0;if(!min)return '';const h=Math.floor(min/60),m=min%60;return h?h+' h'+(m?' '+m+' min':''):m+' min';}
  function catalogoCfg(d=snapshot){const c=d?.catalogo||d?.gestao?.catalogo||{};return {familias:c.familias&&typeof c.familias==='object'?c.familias:{},trilhas:c.trilhas&&typeof c.trilhas==='object'?c.trilhas:{}};}
  // Área (trilha) e sub-área sem repetir quando têm o mesmo nome ("Produção · Produção").
  function metaCurso(f,d=snapshot){const c=f.catalogo||{},t=c.trilha?catalogoCfg(d).trilhas[c.trilha]:null,area=c.area&&norm(c.area)!==norm(t?.nome||'')?c.area:'';return [t?.nome||'',area,niveis[c.nivel]||'',cargaTexto(c.cargaMinutos)].filter(Boolean);}
  // Cor da área no cartão (faixa de 4 px): Comercial, Produção, ADM e as transversais.
  const trilhaAttr=f=>f.catalogo?.trilha?' data-trilha="'+esc(f.catalogo.trilha)+'"':'';
  function cartao(f){const p=meuProgresso(f),pr=progresso(f,p),e=proxima(f,p),meta=metaCurso(f),comecou=iniciado(f,p);return '<article class="edu-jornada edu-jornada-visual"'+trilhaAttr(f)+'>'+arteCurso(f,rota(f.id))+(meta.length?'<span class="edu-meta">'+esc(meta.join(' · '))+'</span>':'')+'<h2>'+esc(f.titulo)+'</h2>'+(f.catalogo?.resumo?'<p class="edu-resumo-curso">'+esc(f.catalogo.resumo)+'</p>':'')+(comecou||pr.percentual?'<div class="edu-progresso"><progress max="100" value="'+pr.percentual+'" aria-label="Progresso de '+esc(f.titulo)+'"></progress><b>'+pr.percentual+'%</b></div><p class="dica">'+pr.concluidas+' de '+pr.total+' aulas obrigatórias concluídas</p>':'<p class="dica">Não iniciado · '+plural(pr.total,'aula obrigatória','aulas obrigatórias')+'</p>')+'<p class="edu-atual">'+(e?(comecou?'Aula atual: ':'Primeira aula: ')+esc(e.titulo):'Curso concluído')+'</p><a class="botao mini" href="'+rota(f.id)+'">'+(!e?'Rever curso':comecou?'Continuar':'Começar curso')+'</a></article>';}
  // Os demais cursos da pessoa, por área e sub-área, recolhidos.
  function cursosPorArea(fs){
    const cat=catalogoCfg(),grupos=new Map();
    for(const f of emOrdem(fs)){const t=f.catalogo?.trilha||'',nome=cat.trilhas[t]?.nome||'Outros cursos';if(!grupos.has(t))grupos.set(t,{nome,subs:new Map()});const g=grupos.get(t),sub=f.catalogo?.area&&norm(f.catalogo.area)!==norm(nome)?f.catalogo.area:'';if(!g.subs.has(sub))g.subs.set(sub,[]);g.subs.get(sub).push(f);}
    return [...grupos.entries()].map(([t,g])=>'<section class="edu-area"'+(t?' data-trilha="'+esc(t)+'"':'')+'><h3>'+esc(g.nome)+'</h3>'+[...g.subs.entries()].map(([sub,cs])=>(sub?'<h4>'+esc(sub)+'</h4>':'')+'<div class="edu-grid">'+cs.map(cartao).join('')+'</div>').join('')+'</section>').join('');
  }
  function pendenciasAnteriores(){try{return typeof minhasPendencias==='function'?minhasPendencias():[];}catch{return [];}}
  function inicio(app){
    const fs=snapshot.formacoes || [],pessoa=snapshot.pessoa,anteriores=pendenciasAnteriores();
    const liberadas=emOrdem(fs.filter(f=>f.publicada && f.ativa!==false && f.liberada!==false));
    const concluido=f=>progresso(f,meuProgresso(f)).percentual===100;
    // Em andamento: o mais recente primeiro. Sem progresso: a ordem das trilhas
    // (Núcleo comum primeiro), nunca a ordem em que o servidor mandou.
    const andamento=liberadas.filter(f=>!concluido(f)&&iniciado(f,meuProgresso(f))).sort((a,b)=>String(meuProgresso(b).atualizadoEm || '').localeCompare(String(meuProgresso(a).atualizadoEm || '')));
    const aFazer=liberadas.filter(f=>!concluido(f)&&!iniciado(f,meuProgresso(f)));
    // Curso cuja próxima aula depende de mim; a prática enviada espera o validador.
    const ordemPessoal=snapshot.planoPessoal?.ativa!==false?(snapshot.planoPessoal?.itens||[]).map(i=>liberadas.find(f=>f.id===i.formacaoId)).filter(Boolean):[];
    const ativa=[...ordemPessoal,...andamento,...aFazer].find(f=>proximaParaMim(f,meuProgresso(f))),esperando=andamento.find(f=>!proximaParaMim(f,meuProgresso(f))&&aguardaValidacao(f,meuProgresso(f))),pendente=liberadas.find(f=>!concluido(f));
    const p=ativa?meuProgresso(ativa):null,e=ativa?proximaParaMim(ativa,p):null;
    const conquistas=(snapshot.aprendizagem || []).flatMap(p=>p.conquistas || []),pontos=(snapshot.aprendizagem || []).reduce((s,p)=>s+(p.pontos || 0),0);
    const primeiroNome=String(pessoa?.nome || SESSAO.nome || '').trim().split(/\s+/)[0]||'';
    const naAula=(f,e)=>{const es=f.etapas || [],i=es.indexOf(e);return f.titulo+' · aula '+(i+1)+' de '+es.length+(e.duracaoMinutos?' · '+e.duracaoMinutos+' min':'');};
    // Próximo passo único: o curso da vez; senão, as atribuições anteriores
    // (POPs e treinamentos do sistema antigo) que ainda estão pendentes.
    const proximo=e?{titulo:e.titulo,texto:bloqueio(ativa,e,p) || naAula(ativa,e),href:rota(ativa.id,e.id),botao:iniciado(ativa,p)?'Continuar de onde parei →':'Começar →',silk:iniciado(ativa,p)?silk('apontando',190):silk('boas-vindas',190),ola:!iniciado(ativa,p)&&!andamento.length}
      :esperando?{titulo:'Sua prática está com o validador',texto:'A prática de '+esperando.titulo+' aguarda a validação do responsável. Combine o dia no posto.',href:rota(esperando.id),botao:'Ver o curso →',silk:silk('apontando',120)}
      :pendente?{titulo:'Seu curso tem uma etapa pendente',texto:'Confira as orientações do curso. A gestão precisa preparar ou liberar o próximo conteúdo.',href:rota(pendente.id),botao:'Ver o que falta →',silk:''}
      :anteriores.length?{titulo:anteriores.length===1?'Você tem 1 atribuição anterior pendente':'Você tem '+anteriores.length+' atribuições anteriores pendentes',texto:'São POPs e treinamentos atribuídos antes dos cursos da escola. Conclua-os por aqui.',href:'#/meus',botao:'Ver atribuições anteriores →',silk:''}
      :liberadas.length?{titulo:'Seus cursos estão em dia',texto:'Você pode rever seus conteúdos e conhecer outros cursos no catálogo.',href:'#/catalogo',botao:'Ver o catálogo →',silk:silk('confiante',120)}
      :{titulo:'Seu primeiro curso começa aqui',texto:'Os cursos liberados para você aparecerão abaixo. Conheça o catálogo enquanto isso.',href:'#/catalogo',botao:'Ver o catálogo de cursos →',silk:silk('boas-vindas',150),ola:true};
    // Agora: até 3 cursos (o da vez e os em andamento); depois, os próximos 3 pela
    // ordem; o resto recolhido por área (auditoria de 15/10, J03).
    const agora=[...new Set([ativa,...andamento].filter(Boolean))].slice(0,3),proximos=aFazer.filter(f=>!agora.includes(f)).slice(0,3),resto=liberadas.filter(f=>!agora.includes(f)&&!proximos.includes(f));
    app.innerHTML=header()+intro('Seu aprendizado, passo a passo.',pessoa?((pessoa.nome || SESSAO.nome)+' · '+(pessoa.funcao || 'Função a conferir')+(pessoa.setor?' · '+pessoa.setor:'')):'Vamos organizar seus cursos.',snapshot.gestao?.podeGerir?'<a class="botao suave mini" href="#/escola">Gestão de cursos</a>':'')+aviso()+
      (!pessoa?'<div class="aviso amarelo"><b>Vínculo com o RH pendente.</b> A gestão precisa conferir sua conta para liberar e registrar seus cursos. A biblioteca continua disponível.</div>':'')+
      '<section class="edu-resumo-topo" aria-label="Seu progresso">'+metricasHtml([{valor:liberadas.filter(concluido).length+'/'+liberadas.length,rotulo:'cursos concluídos',icone:'livro',href:'#/catalogo'},{valor:pontos,rotulo:'pontos de aprendizagem',icone:'alvo',href:'#/conquistas'},{valor:conquistas.length,rotulo:conquistas.length===1?'conquista pessoal':'conquistas pessoais',icone:'medalha',href:'#/conquistas'}])+'</section>'+
      equipeHtml()+'<div class="edu-proximo-bloco edu-aventura">'+(semSilk(ativa||esperando)||erro||mutacao?'':(proximo.silk||''))+'<div class="edu-proximo-col">'+(primeiroNome?'<p class="edu-ola">'+(proximo.ola?'Bem-vindo à Escola Impresilk, '+esc(primeiroNome)+'.':esc(primeiroNome)+', seu próximo passo começa aqui.')+'</p>':'')+'<section class="edu-proximo"><div><div class="eyebrow">SEU PRÓXIMO PASSO</div><h2>'+esc(proximo.titulo)+'</h2><p>'+esc(proximo.texto)+'</p></div><a class="botao" href="'+proximo.href+'">'+proximo.botao+'</a></section></div></div>'+
      '<nav class="edu-atalhos" aria-label="Mais do seu aprendizado"><a href="#/catalogo">'+iconeEscola('livro')+'Catálogo</a><a href="#/avaliacoes">'+iconeEscola('check')+'Minhas avaliações</a><a href="#/conquistas">'+iconeEscola('medalha')+'Meu histórico</a><a href="#/perfil">'+iconeEscola('pessoa')+'Perfil e desenvolvimento</a>'+(anteriores.length?'<a href="#/meus">Atribuições anteriores ('+anteriores.length+' pendentes)</a>':'')+'</nav>'+
      planoPessoalHtml()+
      (liberadas.length?
        (agora.length?'<section aria-labelledby="edu-agora"><div class="secao-titulo"><h2 id="edu-agora">Agora</h2></div><div class="edu-grid">'+agora.map(cartao).join('')+'</div></section>':'')+
        (proximos.length?'<section aria-labelledby="edu-depois"><div class="secao-titulo"><h2 id="edu-depois">Próximos cursos</h2><a href="#/catalogo">Ver o catálogo completo</a></div><div class="edu-grid">'+proximos.map(cartao).join('')+'</div></section>':'')+
        (resto.length?'<details class="card edu-todos"><summary>Todos os seus cursos, por área ('+resto.length+' a mais)</summary>'+cursosPorArea(resto)+'</details>':'')
      :'<section aria-labelledby="edu-minhas"><div class="secao-titulo"><h2 id="edu-minhas">Meus cursos</h2><a href="#/catalogo">Ver o catálogo completo</a></div><div class="card edu-vazio"><h3>Nenhum curso liberado ainda</h3><p>A gestão libera os cursos pelo seu cargo no RH, pela família de cargos, pelo setor ou para você. No catálogo você vê as trilhas e os cursos liberados para você.</p></div></section>')+
      referencias(liberadas)+'<p class="dica edu-rodape">'+(snapshot.atualizadoEm?'Consultado em '+fmtDataHora(snapshot.atualizadoEm)+'. ':'')+'Pontos reconhecem aprendizagem. A autorização para executar uma atividade depende da validação responsável.</p></div>';
    fim(app);
  }
  function referencias(fs){const refs=fs.flatMap(f=>(f.etapas || []).filter(e=>['etica','caderno'].includes(e.tipo)).map(e=>({f,e})));return refs.length?'<section class="edu-referencias"><h2>Suas referências de trabalho</h2><div class="edu-atalhos">'+refs.slice(0,6).map(({f,e})=>'<a href="'+rota(f.id,e.id)+'">'+esc(e.titulo)+'</a>').join('')+'</div></section>':'';}
  // Recomendação de ordem entre cursos: nunca bloqueia, só orienta o aluno.
  function recomendadasHtml(f){const rs=f.recomendadas || [];return rs.length?'<section class="card edu-recomendadas"><h2>Antes deste curso, recomendamos</h2><ul>'+rs.map(r=>'<li><b>'+esc(r.titulo || r.id)+'</b> · '+(r.concluida?'concluído por você':r.liberada?'<a href="'+rota(r.id)+'">disponível para você</a>':'ainda não liberado para você. Peça ao seu gestor')+'</li>').join('')+'</ul><p class="dica">É uma sugestão de ordem. Você pode fazer este curso mesmo sem concluir os recomendados.</p></section>':'';}
  // Quadro "Neste curso": para quem é, o que a pessoa sai sabendo e o que tem (J19).
  function origemMaquinaHtml(f){return window.ESCOLA_MAQUINAS?.origemHtml(f)||'';}
  function nesteCursoHtml(f){const es=f.etapas || [],aulas=es.filter(e=>!['avaliacao','pratica'].includes(e.tipo)).length,provas=es.filter(e=>(e.quiz || []).length).length,praticas=es.filter(e=>e.tipo==='pratica').length,c=f.catalogo||{};return '<section class="card edu-neste"'+trilhaAttr(f)+'><h2>Neste curso</h2>'+(c.resumo?'<p>'+esc(c.resumo)+'</p>':'')+'<p class="dica">'+[plural(aulas,'aula','aulas'),provas?plural(provas,'prova','provas'):'',praticas?plural(praticas,'prática acompanhada','práticas acompanhadas'):'',c.cargaMinutos?cargaTexto(c.cargaMinutos)+' no total':'',f.prazo?'prazo '+fmtData(f.prazo):''].filter(Boolean).join(' · ')+'</p></section>';}
  function etapaMapa(f,e,p,atual){
    const st=status(e,p.etapas?.[e.id]),bloq=bloqueio(f,e,p),i=f.etapas.indexOf(e),esta=e.id===atual?.id;
    const simbolo=st==='concluida'?'check':st==='aguardando_validacao'?'relogio':bloq?'cadeado':null;
    return '<details class="edu-etapa '+esc(st)+(esta?' edu-etapa-atual':'')+'"'+(esta?' open':'')+'><summary><span class="edu-numero">'+(simbolo?iconeEscola(simbolo):String(i+1).padStart(2,'0'))+'</span><span class="edu-etapa-texto"><span class="ac-kicker">'+esc(e.tipo==='pratica'?'Atividade prática':(e.quiz||[]).length?'Conteúdo e prova':'Conteúdo e leitura')+(esta?' · seu próximo passo':'')+'</span><strong>'+esc(e.titulo)+'</strong><span class="dica">'+(e.obrigatoria===false?'Complementar':'Obrigatória')+(e.duracaoMinutos?' · '+e.duracaoMinutos+' min':'')+'</span></span>'+selo(st)+'<span class="edu-expandir" aria-hidden="true">⌄</span></summary><div class="edu-etapa-detalhe"><p>'+esc(bloq || (st==='aguardando_validacao'?'Sua evidência foi enviada. Aguarde o retorno do responsável.':st==='concluida'?'Critério concluído. Você pode rever o conteúdo quando precisar.':criterio(e)))+'</p><div class="edu-etapa-rodape"><span class="dica">'+esc(pontosDaAula(f,e,p))+'</span><a class="botao mini '+(esta?'':'suave')+'" href="'+rota(f.id,e.id)+'">'+(st==='concluida'?'Rever aula':bloq?'Ver orientações':st==='aguardando_validacao'?'Ver registro':'Abrir aula')+' →</a></div></div></details>';
  }
  function jornada(app,f){
    const p=meuProgresso(f),pr=progresso(f,p),meta=metaCurso(f),atual=proximaParaMim(f,p),espera=aguardaValidacao(f,p),completou=pr.total>0&&pr.percentual===100;
    const obrigatorias=(f.etapas||[]).filter(e=>e.obrigatoria!==false),extras=(f.etapas||[]).filter(e=>e.obrigatoria===false);
    const titulo=completou?'Curso concluído':atual?atual.titulo:espera?'Sua prática está com o validador':'Vamos conferir o próximo passo';
    const orientacao=completou?'Seu aprendizado está registrado. Reveja o conteúdo ou continue nos próximos cursos.':atual?criterio(atual):espera?'A prática aguarda a validação do responsável. Combine o acompanhamento no posto.':'Confira as pendências abaixo com a gestão para seguir neste curso.';
    app.innerHTML=header()+intro(f.titulo,'Curso · versão '+f.versao+(meta.length?' · '+meta.join(' · '):''),'<a class="botao suave mini" href="#/">← Meus cursos</a>')+aviso()+
      '<section class="edu-missao'+(completou?' edu-concluido':'')+'">'+(!semSilk(f)&&!erro&&!mutacao?silk(completou?'confiante':'apontando',120):'')+'<div class="edu-missao-conteudo"><span class="eyebrow">'+(completou?'MAIS UM PASSO NO SEU DESENVOLVIMENTO':'SEU PRÓXIMO PASSO')+'</span><h2>'+esc(titulo)+'</h2><p>'+esc(orientacao)+'</p>'+barraCurso(pr,f.titulo)+'<div class="acoes">'+(atual?'<a class="botao" href="'+rota(f.id,atual.id)+'">'+(atual.obrigatoria===false?'Explorar aula complementar':'Continuar na aula')+' →</a>':completou?'<a class="botao" href="#/">Escolher próximo curso →</a>':espera?'<a class="botao" href="'+rota(f.id,espera.id)+'">Ver prática enviada →</a>':'')+'<a class="edu-missao-historico" href="#/conquistas">'+(p.pontos||0)+' pontos · conquistas →</a></div></div></section>'+
      contextoPlanoHtml(f.id)+'<div class="edu-curso-contexto">'+nesteCursoHtml(f)+origemMaquinaHtml(f)+recomendadasHtml(f)+'</div><section aria-labelledby="edu-mapa-titulo"><div class="secao-titulo"><h2 id="edu-mapa-titulo">Seu caminho no curso</h2><span class="dica">'+pr.concluidas+'/'+pr.total+' aulas obrigatórias</span></div><div class="edu-mapa">'+obrigatorias.map(e=>etapaMapa(f,e,p,atual)).join('')+'</div></section>'+
      (extras.length?'<details class="card edu-complementares"'+(atual?.obrigatoria===false?' open':'')+'><summary>'+plural(extras.length,'aula complementar','aulas complementares')+' · para ir além</summary><p class="dica">Conteúdo extra. Não entra na porcentagem das aulas obrigatórias.</p>'+extras.map(e=>etapaMapa(f,e,p,atual)).join('')+'</details>':'')+
      '<details class="card edu-regras-pontos"><summary>'+iconeEscola('medalha')+'Como avançar e ganhar pontos</summary><p>As aulas obrigatórias formam o seu curso. Cada uma mostra o critério para avançar. Ler não comprova domínio; responder a prova e demonstrar na prática são registros separados.</p><ul>'+(f.etapas||[]).map(e=>'<li>'+esc(e.titulo)+': '+esc(pontosDaAula(f,e,p))+'. Novas aberturas e envios repetidos não somam pontos.</li>').join('')+'</ul></details></div>';
    fim(app);
  }
  // Tipo da aula para quem estuda: prova e prática são atividades.
  function rotuloTipo(e){return e.tipo==='pratica'?'Atividade prática':e.tipo==='avaliacao'?'Atividade de avaliação':e.tipo==='aula'?'Aula':tipos[e.tipo] || 'Aula';}
  function fonteHtml(e){return (e.fontes || []).map(f=>{const col=f.tipo==='pop'?'pops':'treinamentos',r=STORE.um(col,f.refId);return '<a class="edu-material" href="'+(f.tipo==='pop'?'#/pop/':'#/treinamento/')+encodeURIComponent(f.refId)+'">▤ '+esc(r?.titulo || f.refId)+' <small>Versão '+esc(f.versao)+'</small></a>';}).join('')+(e.documentos || []).filter(d=>window.POPS_TREINAMENTOS.urlSegura(d.url)).map(d=>'<a class="edu-material" href="'+esc(d.url)+'" target="_blank" rel="noopener noreferrer">↗ '+esc(d.titulo)+' <small>Versão '+esc(d.versao)+' · abre em outra aba</small></a>').join('');}
  function etapa(app,f,e){
    const p=meuProgresso(f),r=(p.formacaoVersao && p.formacaoVersao!==f.versao?{}:p.etapas?.[e.id]) || {},st=status(e,r),bloq=bloqueio(f,e,p),c=e.conteudo || {},chaveRascunho=f.id+'/'+e.id,rascunho=rascunhosPratica.get(chaveRascunho);
    const incentivo=incentivoHtml(f,e,p,r);
    const boasVindas=!incentivo&&!semSilk(f)&&!erro&&!mutacao&&!bloq?guiaSilkHtml('Vamos aprender, um passo de cada vez.','Leia com calma, observe os exemplos e leve esse conhecimento para a sua rotina.'):'';
    app.innerHTML=header()+intro(e.titulo,rotuloTipo(e)+' · '+f.titulo+' · '+(e.obrigatoria===false?'Complementar':'Obrigatória'),'<a class="botao suave mini" href="'+rota(f.id)+'">← Curso</a>')+aviso()+
      '<div class="edu-resumo">'+selo(st)+'<span>'+esc(pontosDaAula(f,e,p))+'</span>'+(e.duracaoMinutos?'<span>'+e.duracaoMinutos+' min estimados</span>':'')+'</div>'+(bloq?'<div class="aviso amarelo">🔒 '+esc(bloq)+'</div>':'')+
      (incentivo||boasVindas)+contextoPlanoHtml(f.id)+((e.materiais||[]).length?'<section class="card"><h2>Estude os materiais completos</h2><p>Abra cada material, registre o estudo e retorne a esta aula.</p><div class="edu-atalhos">'+e.materiais.map(m=>'<a href="#/material/'+encodeURIComponent(m.id)+'">'+esc(m.titulo||'Material integral')+' · v'+esc(m.versao)+'</a>').join('')+'</div></section>':'')+
      '<nav class="edu-aula-roteiro" aria-label="Passos desta aula"><span>'+iconeEscola(r.leituraEm?'check':'livro')+'Estudar o conteúdo</span>'+((e.quiz||[]).length?'<a href="#edu-quiz" data-scroll="edu-quiz">'+iconeEscola('alvo')+'Responder à prova</a>':'')+(e.tipo==='pratica'?'<a href="#edu-pratica" data-scroll="edu-pratica">'+iconeEscola('pessoa')+'Demonstrar na prática</a>':'')+'</nav><div class="edu-conteudo"><section class="card"><h2>Vamos aprender</h2>'+[['aprender','O que vou aprender?'],['importancia','Por que isso importa?'],['comoFazer','Como fazer corretamente?'],['erros','Quais erros evitar?'],['evidencia','Como demonstrar que aprendi?']].map(([k,t])=>'<div class="edu-topico"><h3>'+iconeEscola(k==='aprender'?'alvo':k==='evidencia'?'check':'livro')+t+'</h3>'+(c[k]?textoAula(c[k]):'<p>Conteúdo aguardando preparação pela gestão.</p>')+'</div>').join('')+fonteHtml(e)+(!bloq && !r.leituraEm && st!=='concluida'?'<div class="edu-fim-leitura"><button class="botao" data-evento="leitura">Terminei de ler</button><p class="dica">Registra a leitura desta aula.</p></div>':'')+'</section><aside class="card edu-comprovar"><h2>Seu registro nesta aula</h2><details class="edu-registro-detalhes"><summary>Datas e confirmações</summary><ul class="edu-registros"><li>'+ (r.abertaEm?'✓ Aberta em '+fmtDataHora(r.abertaEm):'○ Abertura ainda não registrada')+'</li><li>'+(r.leituraEm?'✓ Leitura registrada em '+fmtDataHora(r.leituraEm):'○ Leitura não registrada')+'</li><li>'+(r.cienciaEm?'✓ Ciência registrada em '+fmtDataHora(r.cienciaEm):e.tipo==='etica'?'○ Ciência do Código pendente':'')+'</li><li>'+(r.concluidaEm?'✓ Critério concluído em '+fmtDataHora(r.concluidaEm):'○ Critério de conclusão pendente')+'</li></ul></details><p class="dica">'+esc(criterio(e))+'</p>'+
      '<div id="edu-retorno" role="status" aria-live="polite"></div>'+
      (!bloq && st!=='concluida'?'<div class="edu-acoes">'+(e.tipo==='etica'?'<label class="edu-check"><input type="checkbox" id="edu-ciencia"> Li o Código de Ética desta versão e registro minha ciência.</label><button class="botao" data-evento="ciencia">Registrar ciência</button>':'')+'</div>':'')+
      (r.validacao?'<div class="aviso amarelo">Retorno do responsável: '+esc(r.validacao.feedback || '')+'</div>':'')+'</aside></div>'+
      (e.avaliacaoPendente?'<div class="aviso amarelo">A prova está em revisão pelo responsável. Você pode estudar e retomar a prova quando ela for aprovada.</div>':'')+(!bloq && !e.avaliacaoPendente && (e.quiz || []).length?quizHtml(e,r):'')+
      (!bloq && e.tipo==='pratica'?'<form id="edu-pratica" class="card"><span class="ac-kicker">Atividade</span><h2>Prática acompanhada</h2><p>Execute com orientação do responsável. Sua evidência será analisada antes da conclusão.</p>'+(e.checklist || []).map((x,i)=>'<label class="edu-check"><input type="checkbox" name="item-'+i+'" required'+(rascunho?.itens?.[i]?' checked':'')+'> '+esc(x)+'</label>').join('')+'<div class="campo"><label for="edu-evidencia">O que foi realizado? Registre o resultado e as observações do acompanhamento.</label><textarea id="edu-evidencia" required maxlength="4000">'+esc(rascunho?.evidencia ?? r.evidencia ?? '')+'</textarea></div><button class="botao"'+(st==='aguardando_validacao' || st==='concluida'?' disabled':'')+'>Enviar para validação</button></form>':'')+
      '<details class="card"><summary>Histórico e tentativas desta aula</summary>'+tentativasHtml(r)+'<p class="dica">As tentativas anteriores permanecem registradas. Nova versão não apaga seu histórico.</p></details>'+ (st==='concluida'?seguirAulaHtml(f,e,p):'')+'</div>';
    fim(app);
    $$('[data-evento]').forEach(bt=>bt.onclick=async()=>{
      if(bt.dataset.evento==='ciencia' && !$('#edu-ciencia')?.checked){toast('Confirme a ciência do Código antes de registrar.','erro');return;}
      bt.disabled=true;const res=await executar({operacao:'registrar',formacaoId:f.id,etapaId:e.id,evento:bt.dataset.evento,formacaoVersao:f.versao,aceite:bt.dataset.evento==='ciencia'},async()=>{await atualizarEtapa(app,f.id,e.id);toast('Registro confirmado pelo servidor.');});if(!res && bt.isConnected)bt.disabled=false;
    });
    const q=$('#edu-quiz');if(q){q.onchange=()=>{$('#edu-questoes-contagem').textContent=q.querySelectorAll('input[type=radio]:checked').length+' de '+e.quiz.length+' questões respondidas';};q.onchange();}if(q)q.onsubmit=async ev=>{ev.preventDefault();const respostas={};for(const questao of e.quiz)respostas[questao.id]=new FormData(q).has(questao.id)?Number(new FormData(q).get(questao.id)):null;const bt=q.querySelector('button');bt.disabled=true;const res=await executar({operacao:'registrar',formacaoId:f.id,etapaId:e.id,evento:'responder',respostas,formacaoVersao:f.versao},async r=>{const redesenhou=await atualizarEtapa(app,f.id,e.id);mostrarFeedback(r,redesenhou);});if(!res && bt.isConnected)bt.disabled=false;};
    // O que a pessoa marcou e escreveu na prática fica guardado enquanto a tela
    // se redesenha (registrar a leitura apagava tudo, J04). O envio registra a
    // leitura antes, quando ela ainda não foi registrada.
    const pratica=$('#edu-pratica');if(pratica){
      const lerRascunho=()=>({itens:(e.checklist || []).map((_,i)=>!!pratica.querySelector('[name="item-'+i+'"]')?.checked),evidencia:$('#edu-evidencia').value});
      pratica.addEventListener('input',()=>rascunhosPratica.set(chaveRascunho,lerRascunho()));pratica.addEventListener('change',()=>rascunhosPratica.set(chaveRascunho,lerRascunho()));
      pratica.onsubmit=async ev=>{ev.preventDefault();const bt=pratica.querySelector('button');bt.disabled=true;const dados=lerRascunho();rascunhosPratica.set(chaveRascunho,dados);
        if(!r.leituraEm){const lida=await executar({operacao:'registrar',formacaoId:f.id,etapaId:e.id,evento:'leitura',formacaoVersao:f.versao});if(!lida){if(bt.isConnected)bt.disabled=false;return;}}
        const res=await executar({operacao:'registrar',formacaoId:f.id,etapaId:e.id,evento:'enviarPratica',formacaoVersao:f.versao,evidencia:dados.evidencia.trim(),checklist:dados.itens},async()=>{rascunhosPratica.delete(chaveRascunho);await atualizarEtapa(app,f.id,e.id);toast('Prática enviada. Aguarde o retorno do responsável.');});if(!res){if(bt.isConnected)bt.disabled=false;else await atualizarEtapa(app,f.id,e.id);}};
    }
  }
  function seguirAulaHtml(f,e,p){
    const seguinte=proximaParaMim(f,p),aguardando=aguardaValidacao(f,p);
    return '<div class="edu-seguir">'+''+'<div><strong>Aula concluída.</strong><p class="dica">'+(seguinte?'Seu próximo passo: '+esc(seguinte.titulo):aguardando?'Uma prática ainda aguarda validação.':progresso(f,p).percentual===100?'Você concluiu as aulas obrigatórias deste curso.':'Confira com a gestão o que falta para continuar.')+'</p></div><a class="botao" href="'+(seguinte?rota(f.id,seguinte.id):rota(f.id))+'">'+(seguinte?'Próxima aula →':'Ver meu curso →')+'</a></div>';
  }
  function criterio(e){if(e.avaliacaoPendente)return 'Estude os materiais. A prova aguarda revisão do responsável; a aula só será concluída após os critérios de aprendizagem.';return e.tipo==='pratica'?'Para avançar: execute o checklist e receba a validação do responsável.':e.tipo==='etica'?'Para avançar: registre leitura, ciência e demonstre compreensão na prova.':(e.quiz || []).length?'Para avançar: registre a leitura e alcance '+(e.minimoAcerto ?? 70)+'% na prova. Até '+(e.maxTentativas || 3)+' tentativas nesta versão.':'Para avançar: registre a leitura do conteúdo oficial. Isso comprova leitura, sem autorizar execução prática.';}
  // Resultado da última tentativa logo acima das questões: aprovado ou não, e só
  // as questões a rever, com a aula onde aquilo é ensinado (J05). As respostas
  // certas continuam marcadas; as erradas voltam em branco e destacadas (J06).
  function ultimaTentativa(r){const t=(r.tentativas || []).at(-1);return t&&t.feedback&&typeof t.feedback==='object'?t:null;}
  function resultadoHtml(e,r,esgotou=false){
    const t=ultimaTentativa(r);if(!t)return '';const qs=t.feedback.questoes || [],min=e.minimoAcerto ?? 70,nota=t.nota ?? t.feedback.nota,aprovada=t.aprovada ?? t.feedback.aprovada ?? (nota>=min);
    const pos=new Map((e.quiz || []).map((q,i)=>[q.id,i+1])),erradas=qs.filter(q=>!q.acertou),certas=qs.filter(q=>q.acertou);
    const item=q=>'<li><b>Questão '+(pos.get(q.id) || '?')+'</b>'+(q.acertou?' · certa':' · reveja')+'<p>'+esc(q.explicacao || '')+'</p>'+(!q.acertou&&q.revisar&&q.revisar!==e.titulo?'<p class="dica">Reveja a aula: '+esc(q.revisar)+'</p>':'')+'</li>';
    return '<section class="card edu-resultado '+(aprovada?'aprovado':'rever')+'" id="edu-resultado" tabindex="-1" aria-labelledby="edu-resultado-titulo"><h2 id="edu-resultado-titulo">'+(aprovada?'Aprovado na prova · ':'Ainda não foi desta vez · ')+esc(nota)+'%</h2><p>'+(aprovada?'Você passou do mínimo de '+min+'%.':'O mínimo é '+min+'%. '+(erradas.length===1?'Reveja a questão abaixo':'Reveja as '+erradas.length+' questões abaixo')+(esgotou?'. As tentativas acabaram: procure o responsável para rever o conteúdo.':' e tente de novo.'))+'</p>'+(erradas.length?'<ol class="edu-res-lista">'+erradas.map(item).join('')+'</ol>':'')+(certas.length?'<details><summary>'+plural(certas.length,'questão certa','questões certas')+'</summary><ul class="edu-res-lista">'+certas.map(item).join('')+'</ul></details>':'')+'</section>';
  }
  function quizHtml(e,r){const n=(r.tentativas || []).length,max=e.maxTentativas || 3,t=ultimaTentativa(r),acerto=new Map((t?.feedback?.questoes || []).map(q=>[q.id,q.acertou])),resp=t?.respostas || {};return resultadoHtml(e,r,n>=max)+'<form class="card edu-quiz" id="edu-quiz"><span class="ac-kicker">Atividade</span><h2>Prova de compreensão</h2><p>'+n+' de '+max+' tentativas · mínimo '+(e.minimoAcerto ?? 70)+'%</p><p id="edu-questoes-contagem" class="dica" aria-live="polite"></p>'+(e.quiz || []).map((q,i)=>{const rever=acerto.get(q.id)===false;return '<fieldset'+(rever?' class="edu-q-rever"':'')+'><legend>'+(i+1)+'. '+esc(q.pergunta)+(rever?' <span class="edu-q-tag">reveja</span>':'')+'</legend>'+q.opcoes.map((o,j)=>'<label class="edu-check"><input type="radio" required name="'+esc(q.id)+'" value="'+j+'"'+(acerto.get(q.id)===true&&resp[q.id]===j?' checked':'')+'> '+esc(o)+'</label>').join('')+'</fieldset>';}).join('')+'<button class="botao"'+(n>=max || r.status==='concluida' || !r.leituraEm?' disabled':'')+'>Conferir respostas</button>'+(!r.leituraEm&&r.status!=='concluida'?'<p class="dica">Registre a leitura da aula ("Terminei de ler") para liberar a prova.</p>':'')+(n>=max && r.status!=='concluida'?'<p class="aviso amarelo">Limite de tentativas atingido. Procure o responsável para rever o conteúdo e planejar uma nova tentativa.</p>':'')+'</form>';}
  function tentativasHtml(r){return (r.tentativas || []).length?(r.tentativas || []).map((t,i)=>'<div class="edu-tentativa"><strong>Tentativa '+(i+1)+'</strong> · '+((t.nota ?? t.percentual)!=null?esc(t.nota ?? t.percentual)+'%':'sem nota')+' · '+fmtDataHora(t.em)+(t.feedback?(typeof t.feedback==='string'?'<p>'+esc(t.feedback)+'</p>':'<ol class="edu-res-lista">'+(t.feedback.questoes || []).map(q=>'<li>'+(q.acertou?'Certa':'Reveja')+'</li>').join('')+'</ol>'):'')+'</div>').join(''):'<p>Nenhuma tentativa registrada.</p>';}
  function mostrarFeedback(r,redesenhou=true){const res=$('#edu-resultado');if(res&&!redesenhou)res.remove?.();else if(res){res.scrollIntoView?.({block:'start',behavior:'smooth'});res.focus?.({preventScroll:true});return;}const area=$('#edu-retorno');if(!area)return;const fs=r.feedback?.questoes || (Array.isArray(r.feedback)?r.feedback:r.feedback?[r.feedback]:[]);area.innerHTML='<h3>Seu resultado'+(r.feedback?.nota!=null?' · '+r.feedback.nota+'%':'')+'</h3>'+fs.map(f=>'<p>'+esc(typeof f==='string'?f:f.explicacao || f.mensagem || '')+'</p>'+(f.revisar?'<p class="dica">Revisar: '+esc(f.revisar)+'</p>':'')).join('')+(fs.length?'':'<p>Resposta registrada. Consulte o resultado e o histórico desta aula.</p>');area.scrollIntoView({block:'center',behavior:'smooth'});}
  function conquistas(app){
    const ps=snapshot.aprendizagem||[],fs=snapshot.formacoes||[],marcos=ps.flatMap(p=>(p.conquistas||[]).map(c=>({c,p,f:fs.find(f=>f.id===p.formacaoId)}))).sort((a,b)=>String(b.c.em||b.c.conquistadaEm||'').localeCompare(String(a.c.em||a.c.conquistadaEm||'')));
    const pontos=ps.reduce((n,p)=>n+Number(p.pontos||0),0),praticas=marcos.filter(({c})=>c.tipo==='pratica_validada').length;
    const f=emOrdem(fs.filter(f=>f.publicada&&f.ativa!==false&&f.liberada!==false)).find(f=>{const p=meuProgresso(f),e=proximaParaMim(f,p);return e&&!conquistaDaAula(f,e,p);}),e=f?proximaParaMim(f,meuProgresso(f)):null;
    app.innerHTML=header()+intro('Sua evolução merece ser vista.','Cada conquista tem uma atividade, uma data e um critério cumprido.','<a class="botao suave mini" href="#/">← Meus cursos</a>')+aviso()+
      metricasHtml([{valor:pontos,rotulo:'pontos de aprendizagem',icone:'alvo',href:'#/conquistas'},{valor:marcos.length,rotulo:marcos.length===1?'conquista pessoal':'conquistas pessoais',icone:'medalha',href:'#/conquistas'},{valor:praticas,rotulo:praticas===1?'prática validada':'práticas validadas',icone:'check',href:'#/avaliacoes'}])+
      (e?'<section class="edu-marco-proximo">'+(!semSilk(f)&&!erro&&!mutacao?silk('confiante',100):'')+'<div><span class="eyebrow">SEU PRÓXIMO MARCO</span><h2>'+esc(e.titulo)+'</h2><p>'+esc(f.titulo)+' · '+Number(e.pontos||0)+' pontos ao cumprir o critério</p><p class="dica">'+esc(criterio(e))+'</p></div><a class="botao" href="'+rota(f.id,e.id)+'">Continuar →</a></section>':'')+
      '<section aria-labelledby="edu-marcos-titulo"><div class="secao-titulo"><h2 id="edu-marcos-titulo">Suas conquistas</h2><span class="dica">Mais recentes primeiro</span></div><div class="edu-marcos">'+(marcos.map(({c,p,f})=>'<article class="edu-conquista"><span class="edu-conquista-simbolo">'+iconeEscola(c.tipo==='pratica_validada'?'check':'medalha')+'</span><div class="edu-conquista-corpo"><span class="ac-kicker">'+(c.tipo==='pratica_validada'?'Prática validada':'Critério concluído')+'</span><h3>'+esc(c.titulo||c.nome||'Marco concluído')+'</h3><p>'+esc(f?.titulo||'Curso do seu histórico')+'</p><p class="dica">'+(c.em||c.conquistadaEm?fmtDataHora(c.em||c.conquistadaEm):'Data não informada')+(c.formacaoVersao?' · versão '+esc(c.formacaoVersao):'')+'</p><details><summary>Ver registro</summary><p>'+esc(c.tipo==='pratica_validada'?'Conclusão após validação da prática pelo responsável.':'Conclusão conforme o critério da aula. Não equivale à autorização para execução prática.')+'</p>'+(f&&f.liberada!==false&&f.publicada&&f.ativa!==false?'<a href="'+rota(f.id)+'">Rever curso →</a>':'<p class="dica">Registro preservado. O curso não está disponível para consulta.</p>')+'</details></div><strong class="edu-conquista-pontos">'+Number(c.pontos||0)+'<small> pontos</small></strong></article>').join('')||'<section class="card edu-vazio"><h3>Seu próximo marco está à frente</h3><p>Conclua uma atividade e cumpra seu critério para registrar a primeira conquista. Tudo aparece aqui após a confirmação.</p><a class="botao mini" href="#/">Ir para meus cursos →</a></section>')+'</div></section>'+
      '<details class="card edu-historico-completo"><summary>'+iconeEscola('relogio')+'Histórico pessoal · atividades e versões</summary>'+ps.map(p=>'<details><summary>'+esc(fs.find(f=>f.id===p.formacaoId)?.titulo||'Curso do seu histórico')+' · '+(p.pontos||0)+' pontos</summary>'+historicoHtml(p)+'</details>').join('')+(ps.length?'':'<p>Ainda não há atividades registradas.</p>')+'</details><p class="dica edu-rodape">Os pontos não substituem uma validação prática nem autorizam automaticamente o exercício de uma atividade. Rever aulas não soma novos pontos.</p></div>';
    fim(app);
  }
  function historicoHtml(p){return '<ul class="edu-historico">'+[...(p.historico || []),...(p.eventos || [])].map(h=>'<li><b>'+esc(h.motivo || h.evento || h.tipo || 'Registro')+'</b> · '+fmtDataHora(h.em || h.encerradaEm)+'<span>'+esc(h.etapaId || h.motivo || '')+(h.formacaoVersao || h.versao?' · versão '+esc(h.formacaoVersao || h.versao):'')+'</span></li>').join('')+'</ul>';}
  async function render(app){
    if(typeof atualizarIdentidadeRH==='function' && !SESSAO?.identidadeConferida)await atualizarIdentidadeRH();
    if(identidade!==pessoaKey())zerar();
    const alvo=location.hash,conta=pessoaKey();
    // O editor grava com a revisão que leu: só aceita consulta recente do servidor.
    const fresco=ROTA.nome==='formacao-editor';
    if(snapshot && (fresco || exigirFresco) && (snapshotDoAparelho || Date.now()-snapshotEm>FRESCO_MS))snapshot=null;
    if(!snapshot && !fresco && !exigirFresco){const salvo=await aparelho.ler('painel');if(alvo!==location.hash || conta!==pessoaKey())return;if(salvo && !snapshot)usarDoAparelho(salvo);}
    if(!snapshot){app.innerHTML=header()+intro(tituloCarregando(),'Consultando cursos e registros confirmados…')+aviso()+'</div>';ligarTopo();await carregar();if(alvo!==location.hash || conta!==pessoaKey())return;if(!snapshot){app.innerHTML=header()+intro('Vamos retomar seu aprendizado.','A consulta da escola precisa de conexão. Os POPs sincronizados continuam disponíveis.')+aviso()+'<a class="botao suave" href="#/pops">Consultar POPs</a></div>';fim(app);return;}}
    else if(precisaConferir())revalidar(()=>{if(alvo===location.hash && conta===pessoaKey())render(app);});
    marcarRender();
    if(ROTA.nome==='escola'){gestao(app);return;}
    if(ROTA.nome==='formacao-editor'){bibliotecaEditor=null;if(snapshot.gestao?.podeGerir){const b=await STORE.api('escola',{operacao:'academia.biblioteca'});if(alvo!==location.hash || conta!==pessoaKey())return;bibliotecaEditor={materiais:b.materiais||[]};}editor(app);return;}
    if(ROTA.nome==='conquistas'){conquistas(app);return;}
    if(ROTA.nome==='formacao'){const [id,eid]=ROTA.arg.split('~'),f=snapshot.formacoes.find(f=>f.id===id);if(!f){app.innerHTML=header()+intro('Curso não disponível','Confira no catálogo os cursos liberados para sua conta.')+'<a href="#/">Voltar aos meus cursos</a></div>';fim(app);return;}const e=f.etapas?.find(e=>e.id===eid);if(e)etapa(app,f,e);else jornada(app,f);return;}
    inicio(app);
  }
  // Título final já no carregamento: antes um título provisório trocava pelo
  // definitivo e a tela pulava (auditoria P2-5).
  function tituloCarregando(){return ({escola:'Cuidar de quem aprende.','formacao-editor':'Preparar curso',conquistas:'Sua evolução merece ser vista.',formacao:'Seu curso'})[ROTA.nome] || 'Seu aprendizado, passo a passo.';}
  function gestao(app){
    const g=snapshot.gestao || {};
    if(!g.podeGerir && !g.podeValidar){app.innerHTML=header()+intro('Área restrita','A gestão e os responsáveis acompanham os cursos conforme sua permissão.')+'</div>';fim(app);return;}
    const fs=snapshot.formacoes || [],registros=g.registros || [];
    const aIniciar=g.podeGerir?fs.filter(f=>f.publicada && f.ativa!==false).flatMap(f=>(g.pessoas || []).filter(p=>{
      const pid=p.colaboradorId || String(p.id || '').replace(/^p-/,''),lib=f.liberacao || {};
      const atribuida=Array.isArray(f.pessoasLiberadas)?f.pessoasLiberadas.includes(pid):pid && (lib.todos===true || (lib.pessoas || []).includes(pid) || (lib.cargos || []).includes(p.cargoId) || (lib.setores || []).map(norm).some(s=>s && [p.setor,p.area,p.areaId].map(norm).includes(s)));
      return atribuida && !registros.some(r=>r.formacaoId===f.id && r.colaboradorId===pid);
    }).map(p=>({f,p}))):[];
    const praticas=registros.flatMap(p=>Object.entries(p.etapas || {}).filter(([,r])=>r.status==='aguardando_validacao').map(([etapaId,r])=>({p,r,etapaId})));
    app.innerHTML=header('escola')+intro('Cuidar de quem aprende.','Organize cursos e trilhas, acompanhe dificuldades e valide a prática com evidência.',g.podeGerir?'<a class="botao" href="#/formacao-editor/novo">+ Novo curso</a>'+ (souAdmin()?'<a class="botao suave" href="#/maquinas-escola">Treinar por máquina</a>':''):'')+aviso()+
      metricasHtml([{valor:fs.length,rotulo:fs.length===1?'curso na escola':'cursos na escola',icone:'livro',href:'#/escola',alvo:'edu-cursos-gestao'},{valor:registros.length,rotulo:'cursos iniciados',icone:'alvo',href:'#/escola',alvo:'edu-acompanhamento'},...(g.podeGerir?[{valor:aIniciar.length,rotulo:'cursos a iniciar',icone:'pessoa',href:'#/escola',alvo:'edu-acompanhamento'}]:[]),{valor:praticas.length,rotulo:'práticas para validar',icone:'check',href:'#/escola',alvo:'edu-validacoes'}])+
      '<nav class="edu-atalhos" aria-label="Atalhos da gestão"><a href="#/escola" data-scroll="edu-validacoes">Práticas para validar</a><a href="#/escola" data-scroll="edu-acompanhamento">Acompanhamento individual</a>'+(g.podeGerir?'<a href="#/catalogo">Catálogo e trilhas</a><a href="#/matriz">Matriz de cargos</a>':'')+'<a href="#/pessoas">Equipe e vínculos RH</a><a href="#/mapa">Histórico anterior</a></nav>'+
      (souAdmin()&&ROTA.arg==='entrada'?cartaoEntradaAluno(g.entradaAluno):'')+
      '<section class="card" id="edu-validacoes"><h2>Práticas aguardando validação</h2>'+ (praticas.length?praticas.map(({p,r,etapaId},i)=>{const f=fs.find(f=>f.id===p.formacaoId),e=f?.etapas.find(e=>e.id===etapaId);return '<article class="edu-linha"><div><h3>'+esc(p.nome || p.colaboradorId)+' · '+esc(e?.titulo || etapaId)+'</h3><p>'+esc(f?.titulo || p.formacaoId)+'</p><p class="edu-evidencia">'+esc(r.evidencia || 'Sem descrição de evidência')+'</p></div><button class="botao mini" data-validar="'+i+'">Analisar prática</button></article>';}).join(''):'<p class="dica">Nenhuma prática aguardando validação no seu escopo.</p>')+'</section>'+
      (souAdmin()?'<details class="card"><summary>Responsáveis pela prática · instrutores</summary><p>Escolha quem acompanha as práticas e em quais setores. Depois vincule a pessoa às atividades práticas do curso. Ninguém pode validar a própria prática.</p><form id="edu-instrutores"><div id="edu-instrutores-lista"></div><p id="edu-instrutores-erro" class="aviso amarelo" role="alert" hidden></p><div class="acoes"><button type="button" id="edu-adicionar-instrutor" class="botao mini suave">+ Adicionar responsável</button><button id="edu-salvar-instrutores" type="submit" class="botao mini">Salvar responsáveis</button></div></form></details>':'')+
      '<details class="card edu-todos" id="edu-cursos-gestao"><summary>Cursos da escola ('+fs.length+')</summary><div class="edu-grid">'+fs.map(f=>'<article class="edu-jornada">'+(metaCurso(f).length?'<span class="ac-kicker">'+esc(metaCurso(f).join(' · '))+'</span>':'')+'<h3>'+esc(f.titulo)+'</h3><p>'+esc(f.setor || 'Geral')+' · versão '+esc(f.versao)+'</p><span class="edu-status '+(f.publicada?'em_andamento':'nao_iniciada')+'">'+(f.ativa===false?'Arquivada':f.publicada?'Liberada':'Em preparação')+'</span><p class="dica">'+(f.etapas || []).length+' aulas · '+(Array.isArray(f.pessoasLiberadas)?f.pessoasLiberadas.length+' pessoas no público':(f.liberacao?.pessoas || []).length+' liberações individuais')+'</p><div class="acoes"><a class="botao mini suave" href="'+rota(f.id)+'">Ver curso</a>'+(g.podeGerir?'<a class="botao mini" href="#/formacao-editor/'+encodeURIComponent(f.id)+'">Editar e liberar</a>':'')+'</div></article>').join('')+'</div></details>'+
      '<section class="card" id="edu-acompanhamento"><h2>Acompanhar e apoiar</h2><div class="campo"><label for="edu-busca-pessoa">Buscar pessoa ou curso</label><input type="search" id="edu-busca-pessoa" placeholder="Nome ou curso"></div><div id="edu-registros"></div>'+(g.podeGerir?'<h3>Quem ainda precisa começar</h3><p class="dica">Pessoas do seu escopo com curso liberado por pessoa, cargo, família de cargos ou setor e sem registro de início.</p><div id="edu-iniciar"></div>':'')+'</section></div>';
    fim(app);
    ligarEntradaAluno(app,g.entradaAluno);
    const instrutores=$('#edu-instrutores');if(instrutores){
      let linhas=Object.entries(g.instrutores || {}).map(([usuario,setores])=>({usuario,setores:[...setores]}));
      const setoresAtuais=[...new Set([...setores(),...fs.map(f=>f.setor),...(g.pessoas || []).flatMap(p=>[p.setor,p.area])].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      const lerInstrutores=()=>{linhas=$$('[data-instrutor-linha]').map(el=>({usuario:$('[data-instrutor-pessoa]',el).value,setores:Array.from($('[data-instrutor-setores]',el).selectedOptions).map(o=>o.value)}));};
      const pintarInstrutores=()=>{
        $('#edu-instrutores-lista').innerHTML=linhas.map((l,i)=>'<div class="edu-doc-editor" data-instrutor-linha><div class="edu-form-grid"><div class="campo"><label for="edu-instrutor-'+i+'">Responsável '+(i+1)+'</label><select id="edu-instrutor-'+i+'" data-instrutor-pessoa required><option value="">Selecione uma pessoa</option>'+opcoesResponsaveis(g.pessoas || [],[l.usuario].filter(Boolean))+'</select></div><div class="campo"><label for="edu-instrutor-setores-'+i+'">Setores em que pode acompanhar</label><select id="edu-instrutor-setores-'+i+'" data-instrutor-setores multiple size="4" required>'+[...setoresAtuais,...l.setores.filter(s=>!setoresAtuais.includes(s))].map(s=>'<option value="'+esc(s)+'"'+(l.setores.includes(s)?' selected':'')+'>'+esc(s)+(setoresAtuais.includes(s)?'':' · setor anterior (conferir)')+'</option>').join('')+'</select><p class="dica">Você pode selecionar mais de um setor.</p></div></div><button class="botao mini suave" type="button" data-remover-instrutor="'+i+'">Remover responsável</button></div>').join('') || '<p class="dica">Nenhum responsável configurado. Adicione uma pessoa com acesso vinculado ao RH.</p>';
        $$('[data-remover-instrutor]').forEach(bt=>bt.onclick=()=>{lerInstrutores();linhas.splice(Number(bt.dataset.removerInstrutor),1);pintarInstrutores();});
      };
      $('#edu-adicionar-instrutor').onclick=()=>{lerInstrutores();linhas.push({usuario:'',setores:[]});pintarInstrutores();};
      instrutores.onsubmit=async ev=>{ev.preventDefault();lerInstrutores();const mapa={},el=$('#edu-instrutores-erro');el.hidden=true;for(const l of linhas){if(!l.usuario || !l.setores.length){el.textContent='Escolha a pessoa e pelo menos um setor para cada responsável.';el.hidden=false;return;}if(Object.hasOwn(mapa,l.usuario)){el.textContent='Essa pessoa aparece mais de uma vez. Reúna os setores em um único cadastro.';el.hidden=false;return;}mapa[l.usuario]=l.setores;}const bt=$('#edu-salvar-instrutores');bt.disabled=true;const r=await executar({operacao:'configurarInstrutores',instrutores:mapa},async()=>{await carregar();if(snapshot)gestao(app);toast('Responsáveis registrados.');});if(!r)bt.disabled=false;};
      pintarInstrutores();
    }
    function registrosHtml(){const q=norm($('#edu-busca-pessoa').value);$('#edu-registros').innerHTML=registros.filter(p=>norm((p.nome || p.colaboradorId)+' '+(fs.find(f=>f.id===p.formacaoId)?.titulo || '')).includes(q)).map((p)=>{const f=fs.find(f=>f.id===p.formacaoId),novaVersao=!!p.formacaoVersao && p.formacaoVersao!==f?.versao,etapas=(f?.etapas || []).map(e=>({...e,status:novaVersao || e.statusFonte==='pendente'?'revisar':p.etapas?.[e.id]?.status || 'nao_iniciada'})),pr=progresso({...f,etapas,progresso:null},p),pend=etapas.some(e=>e.status==='revisar');return '<article class="edu-linha"><div><h3>'+esc(p.nome || p.colaboradorId)+'</h3><p>'+esc(f?.titulo || p.formacaoId)+' · '+pr.concluidas+'/'+pr.total+' aulas</p>'+selo(pend?'revisar':pr.percentual===100?'concluida':'em_andamento')+'<details><summary>Registros e versões</summary>'+historicoHtml(p)+'</details></div>'+(g.podeGerir?'<button class="botao mini suave" data-reciclar="'+esc(p.colaboradorId)+'" data-formacao="'+esc(p.formacaoId)+'">Programar reciclagem</button>':'')+'</article>';}).join('') || '<p class="dica">Nenhum curso iniciado neste filtro.</p>';
      const iniciar=$('#edu-iniciar');if(iniciar)iniciar.innerHTML=aIniciar.filter(({f,p})=>norm(p.nome+' '+f.titulo).includes(q)).map(({f,p})=>'<article class="edu-linha"><div><h3>'+esc(p.nome || p.colaboradorId)+'</h3><p>'+esc(f.titulo)+' · '+esc([p.funcao,p.setor || p.area].filter(Boolean).join(' · ') || 'Função a conferir')+'</p>'+selo('nao_iniciada')+(!p.usuario?'<p class="dica">Acesso pessoal ao painel a conferir.</p>':'')+'</div><a class="botao mini suave" href="#/formacao-editor/'+encodeURIComponent(f.id)+'">Conferir liberação</a></article>').join('') || '<p class="dica">Nenhuma pessoa com início pendente neste filtro.</p>';
      $$('[data-reciclar]').forEach(bt=>bt.onclick=()=>{const dlg=abrirModal('<h3>Programar reciclagem</h3><p>O histórico anterior será preservado. Informe por que este curso precisa ser refeito.</p><form id="edu-rec-form"><div class="campo"><label for="edu-rec-motivo">Motivo</label><textarea id="edu-rec-motivo" required maxlength="1000"></textarea></div><button class="botao">Confirmar reciclagem</button><button class="botao suave" type="button" id="edu-rec-cancelar">Cancelar</button></form>');$('#edu-rec-cancelar').onclick=()=>dlg.remove();$('#edu-rec-form').onsubmit=async ev=>{ev.preventDefault();const res=await executar({operacao:'reciclar',colaboradorId:bt.dataset.reciclar,formacaoId:bt.dataset.formacao,motivo:$('#edu-rec-motivo').value},async()=>{dlg.remove();await carregar();gestao(app);toast('Reciclagem registrada. Histórico preservado.');});if(!res)toast(erro,'erro');};});
    }
    $('#edu-busca-pessoa').oninput=registrosHtml;registrosHtml();
    $$('[data-validar]').forEach(bt=>bt.onclick=()=>{const {p,r,etapaId}=praticas[Number(bt.dataset.validar)],f=fs.find(f=>f.id===p.formacaoId),e=f?.etapas.find(e=>e.id===etapaId);const dlg=abrirModal('<h3>Validar prática de '+esc(p.nome || p.colaboradorId)+'</h3><p>'+esc(e?.titulo || etapaId)+'</p><p class="edu-evidencia">'+esc(r.evidencia)+'</p><ul>'+(e?.checklist || []).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><form id="edu-validar-form"><div class="campo"><label for="edu-validar-feedback">Retorno sobre o que foi observado</label><textarea id="edu-validar-feedback" required maxlength="2000"></textarea></div><div class="campo"><label for="edu-validar-resultado">Resultado</label><select id="edu-validar-resultado"><option value="revisar">Precisa praticar novamente</option><option value="aprovado">Prática validada</option></select></div><p class="dica">Confirme somente após acompanhar a execução. Pontos e medalhas não substituem esta avaliação.</p><button class="botao">Registrar avaliação</button><button class="botao suave" type="button" id="edu-val-cancelar">Cancelar</button></form>');$('#edu-val-cancelar').onclick=()=>dlg.remove();$('#edu-validar-form').onsubmit=async ev=>{ev.preventDefault();const btn=ev.target.querySelector('button');btn.disabled=true;const res=await executar({operacao:'validar',colaboradorId:p.colaboradorId,formacaoId:p.formacaoId,etapaId,formacaoVersao:f?.versao,aprovado:$('#edu-validar-resultado').value==='aprovado',feedback:$('#edu-validar-feedback').value},async()=>{dlg.remove();await carregar();gestao(app);toast('Avaliação confirmada pelo servidor.');});if(!res)btn.disabled=false;};});
  }
  // Entrada do aluno (ID do RH e primeiro nome): ligada por padrão, só a
  // administração liga, desliga e escolhe a validade. O servidor guarda em
  // educacao.entradaAluno sem tocar no resto e recusa se outra pessoa mudou antes.
  const VALIDADES_ALUNO=[1,3,7,15,30];
  function cartaoEntradaAluno(e){
    const ent=e||{ativa:true,validadeDias:7},dias=VALIDADES_ALUNO.includes(ent.validadeDias)?VALIDADES_ALUNO:[...VALIDADES_ALUNO,ent.validadeDias].sort((a,b)=>a-b);
    return '<section class="card entrada-aluno" id="edu-entrada-aluno" aria-labelledby="edu-entrada-aluno-titulo"><div class="secao-titulo"><h2 id="edu-entrada-aluno-titulo">Entrada do aluno</h2><span class="edu-status '+(ent.ativa?'concluida':'revisar')+'">'+(ent.ativa?'Ligada':'Desligada')+'</span></div>'+
      '<p><b>Quem entra:</b> qualquer pessoa ativa no RH, com o ID do RH (6 números) e o primeiro nome, sem senha. Desligada ou fora do RH, não entra.</p>'+
      '<p><b>O que alcança:</b> os próprios cursos, provas, histórico e perfil; a biblioteca, os vídeos e as NRs liberados para a pessoa; POPs e Fabricação e os treinamentos, só para leitura. Não alcança gestão, acompanhamento de outras pessoas, configurações nem as referências da empresa.</p>'+
      '<p class="dica">Administração, gestão e instrutores continuam entrando com usuário e senha. Desligar encerra na hora a entrada de todos os alunos; ao ligar de novo, cada um entra outra vez.</p>'+
      '<p class="dica">Erros seguidos bloqueiam a entrada por 15 minutos: 5 no mesmo ID, 20 com o mesmo primeiro nome, 30 na mesma rede ou 300 no total. Na fábrica, todos saem pela mesma rede: se a turma ficou bloqueada, libere aqui.</p>'+
      '<div class="acoes"><span class="dica" id="edu-entrada-bloqueios">'+(Number.isInteger(ent.bloqueios)?(ent.bloqueios?ent.bloqueios+(ent.bloqueios===1?' bloqueio valendo agora.':' bloqueios valendo agora.'):'Nenhum bloqueio agora.'):'Não consegui contar os bloqueios agora.')+'</span><button type="button" class="botao mini suave" id="edu-entrada-liberar">Liberar a entrada agora</button></div>'+
      (ent.atualizadoEm?'<p class="dica">Última mudança em '+esc(fmtDataHora(ent.atualizadoEm))+(ent.atualizadoPor?' por '+esc(ent.atualizadoPor):'')+'.</p>':'<p class="dica">Ligada por padrão: ninguém mudou esta configuração ainda.</p>')+
      '<form id="edu-entrada-aluno-form" class="entrada-aluno-form"><div class="campo"><label for="edu-entrada-validade">Validade da entrada no aparelho</label><select id="edu-entrada-validade">'+dias.map(d=>'<option value="'+d+'"'+(d===ent.validadeDias?' selected':'')+'>'+d+(d===1?' dia':' dias')+'</option>').join('')+'</select></div>'+
      '<div class="acoes"><button type="submit" class="botao mini suave" id="edu-entrada-salvar">Salvar validade</button><button type="button" class="botao mini '+(ent.ativa?'fantasma':'')+'" id="edu-entrada-alternar">'+(ent.ativa?'Desligar a entrada do aluno':'Ligar a entrada do aluno')+'</button></div><p id="edu-entrada-erro" class="aviso amarelo" role="alert" hidden></p></form></section>';
  }
  function ligarEntradaAluno(app,e){
    const form=$('#edu-entrada-aluno-form');if(!form)return;
    const ent=e||{ativa:true,validadeDias:7},anterior={ativa:ent.ativa,validadeDias:ent.validadeDias};
    const gravar=async(ativa,bt)=>{
      const validadeDias=Number($('#edu-entrada-validade').value),el=$('#edu-entrada-erro');el.hidden=true;
      if(!ativa&&ent.ativa&&!confirm('Desligar a entrada do aluno? Quem entrou pelo ID do RH sai na próxima consulta, e ninguém entra assim até ligar de novo.'))return;
      bt.disabled=true;
      const r=await executar({operacao:'configurarEntradaAluno',ativa,validadeDias,entradaAnterior:anterior},async res=>{await carregar();if(snapshot)gestao(app);toast(res?.entradaAluno?.ativa===false?'Entrada do aluno desligada.':'Entrada do aluno salva.');});
      if(!r){bt.disabled=false;el.textContent=erro||'Não foi possível salvar. Tente novamente.';el.hidden=false;}
    };
    form.onsubmit=ev=>{ev.preventDefault();gravar(ent.ativa,$('#edu-entrada-salvar'));};
    $('#edu-entrada-alternar').onclick=()=>gravar(!ent.ativa,$('#edu-entrada-alternar'));
    // Zera as tentativas erradas contadas: quem estava bloqueado tenta de novo na hora.
    $('#edu-entrada-liberar').onclick=async()=>{
      const bt=$('#edu-entrada-liberar'),el=$('#edu-entrada-erro');el.hidden=true;
      if(!confirm('Liberar a entrada do aluno agora? As tentativas erradas contadas são zeradas e quem estava bloqueado pode tentar de novo.'))return;
      bt.disabled=true;
      const r=await executar({operacao:'liberarEntradaAluno'},async res=>{await carregar();if(snapshot)gestao(app);toast(res?.liberados?'Entrada do aluno liberada.':'Não havia bloqueio; as tentativas contadas foram zeradas.');});
      if(!r){bt.disabled=false;el.textContent=erro||'Não foi possível liberar. Tente novamente.';el.hidden=false;}
    };
    // Vindo de "Entrada do aluno" no menu Escola, o cartão é o destino.
    // Depois do scrollTo(0,0) do renderApp, que roda logo após o desenho.
    if(ROTA.arg==='entrada')setTimeout(()=>$('#edu-entrada-aluno')?.scrollIntoView?.({block:'start'}),0);
  }
  function opcoesResponsaveis(pessoas,selecionados){
    const conhecidos=new Map(pessoas.filter(p=>p.usuario).map(p=>[norm(p.usuario),p]));
    const valores=[...conhecidos.keys(),...selecionados.filter(u=>!conhecidos.has(u))];
    return [...new Set(valores)].sort((a,b)=>(conhecidos.get(a)?.nome || a).localeCompare(conhecidos.get(b)?.nome || b,'pt-BR')).map(u=>{const p=conhecidos.get(u);return '<option value="'+esc(u)+'"'+(selecionados.includes(u)?' selected':'')+'>'+esc(p?(p.nome || u)+' · '+u:u+' · vínculo anterior (conferir RH)')+'</option>';}).join('');
  }
  function novaEtapa(tipo){return {id:uuid(),titulo:tipo==='aula'?'Nova aula':tipos[tipo],tipo,obrigatoria:true,preparacaoPendente:true,prerequisitos:[],pontos:10,conteudo:{aprender:'',importancia:'',comoFazer:'',erros:'',evidencia:''},fontes:[],documentos:[],quiz:[],minimoAcerto:70,maxTentativas:3,validadores:[],checklist:[]};}
  // Lista de marcar com filtro: substitui o <select multiple>, que exige Ctrl/Cmd
  // e quase não funciona no celular (auditoria P2-8). opcoes: {valor,texto,detalhe}.
  function listaMarcar(id,rotulo,opcoes,selecionados,{dica='',bloqueada=false}={}){
    const filtro=opcoes.length>8?'<input type="search" class="lista-marcar-busca" data-filtrar="'+id+'" aria-label="Filtrar: '+esc(rotulo)+'" placeholder="Filtrar">':'';
    return '<fieldset class="lista-marcar" id="'+id+'"><legend>'+esc(rotulo)+'</legend>'+filtro+'<div class="lista-marcar-itens">'+(opcoes.length?opcoes.map(o=>'<label class="edu-check" data-item="'+esc(norm(o.texto+' '+(o.detalhe || '')))+'"><input type="checkbox" value="'+esc(o.valor)+'"'+(selecionados.includes(o.valor)?' checked':'')+(bloqueada?' disabled':'')+'> <span>'+esc(o.texto)+(o.detalhe?'<small>'+esc(o.detalhe)+'</small>':'')+'</span></label>').join(''):'<p class="dica">Nada para escolher ainda.</p>')+'</div>'+(dica?'<p class="dica">'+dica+'</p>':'')+'</fieldset>';
  }
  function marcados(id){const box=$('#'+id);return box?$$('input[type=checkbox]',box).filter(x=>x.checked).map(x=>x.value):[];}
  function ligarFiltros(raiz){$$('[data-filtrar]',raiz).forEach(campo=>campo.oninput=()=>{const q=norm(campo.value),box=$('#'+campo.dataset.filtrar);if(box)$$('[data-item]',box).forEach(l=>{l.hidden=!!q && !l.dataset.item.includes(q);});});}
  // Quem a liberação alcança no escopo de quem edita: a mesma regra do servidor
  // (pessoa, cargo, família, setor ou todos). É estimativa; o número oficial vem
  // do servidor depois de salvar (pessoas no público).
  function alcance(lib,pessoas,catalogo){
    const fams=catalogo.familias || {};
    return pessoas.filter(p=>{const pid=p.colaboradorId || String(p.id || '').replace(/^p-/,'');
      return lib.todos===true || (lib.pessoas || []).includes(pid) || (!!p.cargoId && (lib.cargos || []).includes(p.cargoId)) || (!!p.cargoId && (lib.familias || []).some(k=>(fams[k]?.cargos || []).includes(p.cargoId))) || (lib.setores || []).map(norm).some(s=>s && [p.setor,p.area,p.areaId].map(norm).includes(s));});
  }
  // Modelos genéricos editáveis: não são conteúdo oficial aprovado, nem cursos já publicados.
  function modeloHabilidade(chave){
    const modelos={
      atendimento:{titulo:'Atendimento ao cliente com clareza',objetivo:'Ouvir a necessidade, combinar o próximo passo e acompanhar o atendimento.',aulas:[
        ['Ouvir antes de oferecer','Entender a necessidade antes de propor uma solução.','Uma pergunta bem feita evita retrabalho e expectativas diferentes.','1. Cumprimente e pergunte o que a pessoa precisa resolver.\n2. Escute sem interromper.\n3. Confirme com suas palavras a necessidade, o prazo desejado e a prioridade.\n4. Registre o que ainda depende de conferência.','Pressupor o que o cliente quer; prometer antes de conferir; interromper para oferecer um produto.','Imagine um cliente pedindo algo urgente. Escreva três perguntas que ajudariam a entender a situação.'],
        ['Explicar e combinar','Explicar uma proposta com linguagem simples.','O cliente precisa entender o que foi combinado e qual é o próximo passo.','1. Apresente a solução ligada à necessidade.\n2. Explique o que está incluído e o que precisa ser confirmado.\n3. Combine quem fará o quê e quando haverá retorno.\n4. Confirme se ficou claro.','Usar termos técnicos sem explicar; inventar prazo ou desconto; deixar o retorno sem responsável.','Treine uma explicação de um minuto para uma pessoa de confiança. Peça que ela repita o que entendeu.'],
        ['Acompanhar sem deixar o cliente no escuro','Manter o cliente informado e encerrar com clareza.','Um retorno honesto ajuda a manter a confiança, inclusive quando há um imprevisto.','1. Consulte o combinado antes de responder.\n2. Informe o andamento confirmado.\n3. Se houver problema, explique o próximo passo possível.\n4. Registre o retorno e confirme se a necessidade foi atendida.','Desaparecer quando não há resposta; culpar outra pessoa; afirmar solução que ainda não aconteceu.','Simule um retorno sobre um prazo que ainda depende de confirmação. Use uma situação fictícia, sem dados de clientes reais.']
      ]},
      conflitos:{titulo:'Comunicação em situações difíceis',objetivo:'Responder com calma, organizar fatos e buscar uma solução possível.',aulas:[
        ['Pausar e compreender','Separar o problema da reação emocional.','Uma pausa ajuda a ouvir e evita que o conflito aumente.','1. Respire e mantenha um tom respeitoso.\n2. Deixe a pessoa explicar o que aconteceu.\n3. Confirme os fatos que você entendeu.\n4. Reconheça o incômodo sem prometer uma solução ainda não conferida.','Responder no mesmo tom; ironizar; discutir quem tem culpa antes de entender o problema.','Pense em uma situação fictícia de reclamação. Escreva uma primeira resposta acolhedora e objetiva.'],
        ['Conversar sobre fatos e alternativas','Propor caminhos sem atacar a pessoa.','Fatos verificáveis e alternativas concretas ajudam a sair da discussão.','1. Descreva o fato sem rótulos pessoais.\n2. Explique o impacto observado.\n3. Pergunte o que seria uma solução aceitável.\n4. Apresente apenas opções dentro da sua autonomia.','Generalizações como sempre e nunca; fazer promessa para encerrar a conversa; expor outras pessoas.','Treine o roteiro fato, impacto, pergunta e próximo passo com uma situação cotidiana.'],
        ['Pedir apoio e acompanhar','Reconhecer limites e encaminhar a situação com responsabilidade.','Pedir ajuda no momento certo protege as pessoas e melhora a chance de resolução.','1. Identifique o que você pode resolver.\n2. Se ultrapassar sua autonomia, peça apoio ao responsável.\n3. Registre o combinado de forma objetiva.\n4. Retorne com a informação confirmada. Em situação de ameaça, priorize afastar-se e buscar ajuda adequada.','Tentar resolver tudo sozinho; discutir sob ameaça; divulgar a situação em grupos sem necessidade.','Escreva um pedido de apoio com contexto, fatos e decisão necessária, sem identificar pessoas reais.']
      ]},
      organizacao:{titulo:'Organização pessoal e combinados',objetivo:'Planejar pequenas ações, cuidar dos compromissos e comunicar imprevistos.',aulas:[
        ['Escolher o que importa agora','Organizar prioridades e dividir uma tarefa grande.','Uma próxima ação clara facilita começar e acompanhar o que falta.','1. Anote o resultado esperado.\n2. Divida em ações pequenas.\n3. Identifique prazo e dependências.\n4. Escolha a próxima ação que depende de você.','Manter tudo apenas na memória; começar várias tarefas sem concluir; ignorar dependências.','Escolha uma tarefa pessoal simples e escreva três ações para realizá-la.'],
        ['Criar um momento de estudo','Preparar um ambiente possível para aprender.','Pequenos períodos de atenção ajudam a transformar leitura em entendimento.','1. Combine um horário possível.\n2. Separe o material e reduza distrações.\n3. Estude uma parte por vez.\n4. Anote uma dúvida ou aplicação prática.','Estudar enquanto executa uma atividade de risco; correr apenas para marcar como feito; esconder dúvidas.','Planeje um momento de estudo em casa ou em outro local tranquilo. A duração pode ser ajustada com o responsável.'],
        ['Revisar e comunicar','Acompanhar o progresso e avisar quando o combinado precisa mudar.','Comunicar cedo permite ajustar a rota com mais clareza.','1. Confira o que foi concluído.\n2. Registre o que falta.\n3. Avise sobre um impedimento com antecedência.\n4. Combine o novo próximo passo.','Confundir estar ocupado com concluir; esconder atrasos; alterar o combinado sem avisar.','Prepare uma mensagem curta com feito, pendente e próximo passo sobre uma tarefa fictícia.']
      ]}
    };
    const m=modelos[chave];if(!m)return null;
    const etapas=m.aulas.map((a,i)=>({...novaEtapa('aula'),titulo:a[0],duracaoMinutos:10,pontos:10,conteudo:Object.fromEntries(['aprender','importancia','comoFazer','erros','evidencia'].map((k,n)=>[k,a[n+1]]))}));
    etapas.forEach((e,i)=>{if(i)e.prerequisitos=[etapas[i-1].id];});
    return {id:uuid(),titulo:m.titulo,versao:'1.0',setor:'',ativa:true,publicada:false,liberacao:{pessoas:[],cargos:[],setores:[],todos:false},catalogo:{area:'Habilidades para a vida e o trabalho',nivel:'essencial',cargaMinutos:30,resumo:m.objetivo},etapas};
  }

  function editor(app){
    if(!snapshot.gestao?.podeGerir){location.hash='#/';return;}
    const modelo=ROTA.arg?.startsWith('modelo-')?modeloHabilidade(ROTA.arg.slice(7)):null;
    const anterior=(snapshot.formacoes || []).find(f=>f.id===ROTA.arg),novo=ROTA.arg==='novo'||!!modelo;
    if(!novo && !anterior){location.hash='#/escola';return;}
    const f=JSON.parse(JSON.stringify(anterior || modelo || {id:uuid(),titulo:'',versao:'1.0',setor:'',ativa:true,publicada:false,liberacao:{pessoas:[],cargos:[],setores:[],todos:false},etapas:MODELO_CURSO.map(novaEtapa)}));
    if(novo)f.etapas.forEach((e,i)=>{if(i)e.prerequisitos=[f.etapas[i-1].id];});
    const g=snapshot.gestao,pessoas=g.pessoas || [],lib=f.liberacao || {},cat=f.catalogo || {},catalogo=catalogoCfg(),admin=souAdmin();
    const pid=p=>p.colaboradorId || String(p.id || '').replace(/^p-/,'');
    // Cargos do RH: todos os cargos do cadastro, inclusive os que ainda não têm
    // ninguém (vaga futura), com nome e área. Servidor antigo sem cargosRH: os
    // cargos das pessoas, como antes.
    const porCargo=new Map();for(const p of pessoas)if(p.cargoId)porCargo.set(p.cargoId,(porCargo.get(p.cargoId) || 0)+1);
    const vagas=new Map();for(const v of g.vagasRH || [])if(v.cargoId)vagas.set(v.cargoId,(vagas.get(v.cargoId) || 0)+1);
    const cargos=Array.isArray(g.cargosRH)?g.cargosRH:[...new Map(pessoas.filter(p=>p.cargoId).map(p=>[p.cargoId,{id:p.cargoId,nome:p.funcao || p.cargoId,area:p.area || ''}])).values()];
    const opcoesCargos=cargos.map(c=>({valor:c.id,texto:c.nome || c.id,detalhe:[c.area,porCargo.get(c.id)?porCargo.get(c.id)+(porCargo.get(c.id)===1?' pessoa':' pessoas'):'ninguém no cargo hoje',vagas.get(c.id)?'vaga aberta':''].filter(Boolean).join(' · ')}))
      .concat((lib.cargos || []).filter(id=>!cargos.some(c=>c.id===id)).map(id=>({valor:id,texto:id,detalhe:'Cargo anterior, não encontrado no RH (conferir)'})));
    const opcoesPessoas=pessoas.map(p=>({valor:pid(p),texto:p.nome || pid(p),detalhe:[p.funcao,p.area || p.setor].filter(Boolean).join(' · ')}))
      .concat((lib.pessoas || []).filter(id=>!pessoas.some(p=>pid(p)===id)).map(id=>({valor:id,texto:'Pessoa '+id,detalhe:'Liberação anterior fora da lista atual (desligada ou fora do seu escopo)'})));
    const opcoesFamilias=Object.entries(catalogo.familias).map(([k,v])=>({valor:k,texto:v.nome || k,detalhe:(v.cargos || []).length+((v.cargos || []).length===1?' cargo':' cargos')}));
    const familiasFora=(ids)=>ids.filter(k=>!Object.hasOwn(catalogo.familias,k)).map(k=>({valor:k,texto:k,detalhe:'Família fora do catálogo (conferir)'}));
    const opcoesSetores=[...new Set([...setores(),...(lib.setores || [])])].map(s=>({valor:s,texto:s}));
    const trilhas=Object.entries(catalogo.trilhas).sort(([,a],[,b])=>(a.ordem || 0)-(b.ordem || 0) || String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    const outros=(snapshot.formacoes || []).filter(x=>x.id!==f.id && !x.somenteHistorico);
    const areasConhecidas=[...new Set([...outros.map(x=>x.catalogo?.area),...cargos.map(c=>c.area)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const somaAulas=()=>f.etapas.reduce((t,e)=>t+(Number(e.duracaoMinutos) || 0),0);
    app.innerHTML=header('escola')+intro(novo?'Um curso para formar bem.':f.titulo,'Conteúdo oficial, critério claro e prática acompanhada.','<a class="botao suave mini" href="#/escola">← Gestão de cursos</a>')+aviso()+
      (modelo?'<section class="edu-modelo-aviso"><h2>Modelo editável para começar</h2><p>Revise o conteúdo para a sua realidade, escolha o setor responsável e acrescente vídeos da biblioteca se desejar. Os exercícios podem ser feitos em casa, sem dados de clientes reais. Este modelo registra leitura; para avaliar compreensão, prepare uma prova e faça a revisão antes de liberar.</p></section>':'')+''+origemMaquinaHtml(f)+'<form id="edu-editor"><section class="card"><h2>Identidade do curso</h2><div class="edu-form-grid"><div class="campo"><label for="edu-titulo">Nome do curso</label><input id="edu-titulo" required maxlength="200" value="'+esc(f.titulo)+'"></div><div class="campo"><label for="edu-setor">Setor responsável</label><input id="edu-setor" required list="edu-setores" value="'+esc(f.setor)+'"><datalist id="edu-setores">'+setores().map(s=>'<option value="'+esc(s)+'">').join('')+'</datalist></div><div class="campo"><label for="edu-versao">Versão</label><input id="edu-versao" required maxlength="40" value="'+esc(f.versao)+'"></div></div><p class="dica">Ao alterar o que será ensinado ou avaliado, use uma nova versão. As conclusões anteriores permanecem no histórico.</p><div class="campo"><label for="edu-prazo">Prazo do curso (opcional)</label><input type="date" id="edu-prazo" value="'+esc(f.prazo||'')+'"></div><label class="edu-check"><input id="edu-publicada" type="checkbox"'+(f.publicada?' checked':'')+'> Liberar este curso para o público selecionado</label><label class="edu-check"><input id="edu-ativa" type="checkbox"'+(f.ativa!==false?' checked':'')+'> Curso ativo</label></section>'+
      '<section class="card"><h2>Catálogo</h2><p class="dica">Organiza o curso na trilha e no catálogo. Mudar estes campos não pede versão nova nem derruba provas aprovadas.</p><div class="edu-form-grid"><div class="campo"><label for="edu-cat-trilha">Trilha</label><select id="edu-cat-trilha"><option value="">Sem trilha</option>'+trilhas.map(([k,t])=>'<option value="'+esc(k)+'"'+(cat.trilha===k?' selected':'')+'>'+esc(t.nome || k)+'</option>').join('')+(cat.trilha && !Object.hasOwn(catalogo.trilhas,cat.trilha)?'<option value="'+esc(cat.trilha)+'" selected>'+esc(cat.trilha)+' (fora do catálogo)</option>':'')+'</select></div><div class="campo"><label for="edu-cat-ordem">Ordem na trilha (opcional)</label><input id="edu-cat-ordem" type="number" min="0" max="10000" step="1" value="'+esc(cat.ordem ?? '')+'"></div><div class="campo"><label for="edu-cat-area">Área (opcional)</label><input id="edu-cat-area" maxlength="120" list="edu-cat-areas" value="'+esc(cat.area || '')+'"><datalist id="edu-cat-areas">'+areasConhecidas.map(a=>'<option value="'+esc(a)+'">').join('')+'</datalist></div><div class="campo"><label for="edu-cat-nivel">Nível (opcional)</label><select id="edu-cat-nivel"><option value="">Sem nível</option>'+Object.entries(niveis).map(([k,v])=>'<option value="'+k+'"'+(cat.nivel===k?' selected':'')+'>'+v+'</option>').join('')+'</select></div><div class="campo"><label for="edu-cat-carga">Carga em minutos (opcional)</label><input id="edu-cat-carga" type="number" min="1" max="100000" step="1" value="'+esc(cat.cargaMinutos ?? '')+'"><p class="dica" id="edu-cat-soma">Soma das aulas: '+(somaAulas()?cargaTexto(somaAulas()):'sem duração informada')+'.</p></div><div class="campo"><label for="edu-cat-codigo">Código (opcional)</label><input id="edu-cat-codigo" maxlength="40" value="'+esc(cat.codigo || '')+'"></div></div>'+
        listaMarcar('edu-cat-familias','Famílias de cargos indicadas',opcoesFamilias.concat(familiasFora(cat.familias || [])),cat.familias || [],{dica:'Indicar não libera: para liberar, escolha o público abaixo.'})+
        listaMarcar('edu-cat-pre','Cursos recomendados antes deste',outros.map(x=>({valor:x.id,texto:x.titulo,detalhe:x.publicada?'liberado':'em preparação'})).concat((cat.preRequisitos || []).filter(id=>!outros.some(x=>x.id===id)).map(id=>({valor:id,texto:id,detalhe:'curso fora da sua lista (conferir)'}))),cat.preRequisitos || [],{dica:'Recomendação de ordem: não bloqueia o aluno. Até 20 cursos.'})+'</section>'+
      '<section class="card"><h2>Quem pode aprender neste curso?</h2><p>Libere por cargo do RH, família de cargos, pessoa ou setor. Essa escolha não modifica o cargo no RH.</p>'+(!admin?'<p class="dica">Os cargos serão liberados somente nos setores sob sua gestão.</p>':lib.cargosGestor?'<p class="dica">A liberação por cargo mantém o limite de setores definido na liberação anterior.</p>':'')+
        '<div class="edu-form-grid">'+listaMarcar('edu-lib-cargos','Cargos do RH',opcoesCargos,lib.cargos || [],{dica:'Todos os cargos do RH, inclusive os que ainda não têm ninguém: quem for contratado no cargo recebe o curso.'})+
        (admin?listaMarcar('edu-lib-familias','Famílias de cargos',opcoesFamilias.concat(familiasFora(lib.familias || [])),lib.familias || [],{dica:'Quem tem no RH um cargo da família recebe o curso. As famílias são organizadas na Matriz de cargos.'}):'<div class="campo"><p><b>Famílias de cargos</b></p><p class="dica">'+((lib.familias || []).length?'Também liberado para: '+esc((lib.familias || []).map(k=>catalogo.familias[k]?.nome || k).join(', '))+'. ':'')+'Somente a administração libera por família.</p></div>')+
        listaMarcar('edu-lib-pessoas','Pessoas (vínculo RH)',opcoesPessoas,lib.pessoas || [])+
        listaMarcar('edu-lib-setores','Setores',opcoesSetores,lib.setores || [],{dica:'O setor é comparado com o setor e a área da ficha no RH e pode não alcançar ninguém. Prefira cargo ou família.'})+'</div>'+
        '<label class="edu-check"><input id="edu-todos" type="checkbox"'+(lib.todos?' checked':'')+(admin?'':' disabled')+'> Liberar para todas as pessoas com vínculo RH válido'+(admin?'':' (somente a administração)')+'</label><p class="dica" id="edu-alcance" aria-live="polite"></p></section>'+
      '<section class="card"><div class="secao-titulo"><h2>Aulas e atividades do curso</h2><button type="button" class="botao mini suave" id="edu-add-etapa">+ Aula</button></div><p class="dica">As aulas iniciais são uma estrutura de preparação. Inclua os conteúdos oficiais e critérios reais antes de liberar. Prova e prática são atividades dentro da aula.</p><div id="edu-etapas-editor"></div></section><div id="edu-editor-erro" role="alert" class="aviso amarelo" hidden></div><div class="edu-salvar"><button class="botao" type="submit">Salvar curso</button><span>Confirmação após gravação no servidor.</span></div></form></div>';
    function ler(){
      $$('[data-ee]').forEach(el=>{const e=f.etapas.find(e=>e.id===el.dataset.ee);if(!e)return;
        $$('[data-campo]',el).forEach(input=>{const k=input.dataset.campo;if(k.startsWith('conteudo.'))e.conteudo[k.split('.')[1]]=input.value.trim();else if(input.type==='checkbox')e[k]=input.checked;else if(input.type==='number'){if(input.value)e[k]=Number(input.value);else delete e[k];}else e[k]=input.value.trim();});
        e.materiais=Array.from($('[data-biblioteca]',el).selectedOptions).map(o=>{const m=(bibliotecaEditor?.materiais || []).find(m=>m.id===o.value);return m?{id:m.id,versao:m.versao,titulo:m.titulo}:(e.materiais || []).find(r=>r.id===o.value);}).filter(Boolean);
        e.prerequisitos=Array.from($('[data-pre]',el).selectedOptions).map(o=>o.value);
        e.validadores=Array.from($('[data-validadores]',el).selectedOptions).map(o=>o.value);
        e.checklist=$('[data-checklist]',el).value.split('\n').map(x=>x.trim()).filter(Boolean);
        e.fontes=Array.from($('[data-fontes]',el).selectedOptions).map(o=>{const [tipo,refId]=o.value.split('|'),r=STORE.um(tipo==='pop'?'pops':'treinamentos',refId);const previa=(e.fontes || []).find(x=>x.tipo===tipo&&x.refId===refId);return {tipo,refId,versao:previa?.versao || r?.versao || '1.0',oficialConfirmado:previa?.oficialConfirmado || $('[data-fontes-oficiais]',el).checked};});
        e.documentos=$$('[data-doc]',el).map(d=>({titulo:$('[data-doc-titulo]',d).value.trim(),url:$('[data-doc-url]',d).value.trim(),versao:$('[data-doc-versao]',d).value.trim(),oficialConfirmado:$('[data-doc-oficial]',d).checked}));
        e.quiz=$$('[data-q]',el).map(q=>({id:q.dataset.q,pergunta:$('[data-pergunta]',q).value.trim(),opcoes:$('[data-opcoes]',q).value.split('\n').map(x=>x.trim()).filter(Boolean),correta:Number($('[data-correta]',q).value)-1,explicacao:$('[data-explicacao]',q).value.trim(),revisar:$('[data-revisar]',q).value.trim()}));
      });
    }
    function pintar(){
      const conteudos=STORE.col('pops').map(p=>({...p,tipo:'pop'})).concat(STORE.col('treinamentos').map(p=>({...p,tipo:'treinamento'})));
      $('#edu-etapas-editor').innerHTML=f.etapas.map((e,i)=>'<details class="edu-editar-etapa" data-ee="'+esc(e.id)+'"'+(i===0?' open':'')+'><summary><span class="edu-numero">'+(i+1)+'</span> '+esc(e.titulo)+'</summary><div class="edu-form-grid"><div class="campo"><label>Título</label><input data-campo="titulo" required maxlength="200" value="'+esc(e.titulo)+'"></div><div class="campo"><label>Tipo</label><select data-campo="tipo">'+Object.entries(tipos).map(([k,v])=>'<option value="'+k+'"'+(e.tipo===k?' selected':'')+'>'+v+'</option>').join('')+'</select></div><div class="campo"><label>Pontos por conclusão</label><input type="number" min="0" max="1000" step="1" data-campo="pontos" value="'+Number(e.pontos || 0)+'"></div><div class="campo"><label>Duração estimada (minutos, opcional)</label><input data-campo="duracaoMinutos" type="number" min="1" max="10000" value="'+esc(e.duracaoMinutos || '')+'"></div></div><label class="edu-check"><input data-campo="obrigatoria" type="checkbox"'+(e.obrigatoria!==false?' checked':'')+'> Aula obrigatória</label><label class="edu-check"><input data-campo="preparacaoPendente" type="checkbox"'+(e.preparacaoPendente?' checked':'')+'> Conteúdo em preparação (aula fica bloqueada)</label><div class="campo"><label>Aulas anteriores exigidas</label><select data-pre multiple size="3">'+f.etapas.filter(x=>x.id!==e.id).map(x=>'<option value="'+esc(x.id)+'"'+((e.prerequisitos || []).includes(x.id)?' selected':'')+'>'+esc(x.titulo)+'</option>').join('')+'</select></div>'+
        '<div class="edu-form-grid">'+[['aprender','O que a pessoa aprenderá?'],['importancia','Por que isso importa?'],['comoFazer','Como fazer corretamente?'],['erros','Quais erros evitar?'],['evidencia','Como demonstrará que aprendeu?']].map(([k,l])=>'<div class="campo"><label>'+l+'</label><textarea data-campo="conteudo.'+k+'" maxlength="8000">'+esc(e.conteudo?.[k] || '')+'</textarea></div>').join('')+'</div>'+
        '<div class="campo"><label>POPs e treinamentos oficiais utilizados</label><select data-fontes multiple size="4">'+conteudos.map(x=>'<option value="'+esc(x.tipo+'|'+x.id)+'"'+((e.fontes || []).some(r=>r.tipo===x.tipo&&r.refId===x.id)?' selected':'')+'>'+esc(x.codigo || x.titulo)+' · v'+esc(x.versao || '1.0')+'</option>').join('')+'</select><p class="dica">Cada vínculo guarda a versão estudada. Se a fonte mudar, confira a etapa e atualize a referência.</p><label class="edu-check"><input type="checkbox" data-fontes-oficiais> Conferi as versões oficiais dos treinamentos selecionados</label><button type="button" class="botao mini suave" data-atualizar-fontes="'+i+'">Usar versões atuais das fontes selecionadas</button></div><h3>Documentos, imagens ou vídeos oficiais</h3><p class="dica">Use links HTTPS com controle de acesso adequado. Os documentos internos não devem ser publicados em uma pasta pública.</p>'+(e.documentos || []).map((d,n)=>'<div class="edu-doc-editor" data-doc><div class="campo"><label>Título do material</label><input data-doc-titulo value="'+esc(d.titulo)+'"></div><div class="campo"><label>Link HTTPS</label><input data-doc-url type="url" value="'+esc(d.url)+'"></div><div class="campo"><label>Versão</label><input data-doc-versao value="'+esc(d.versao)+'"></div><label class="edu-check"><input type="checkbox" data-doc-oficial'+(d.oficialConfirmado?' checked':'')+'> Conferi que esta é a versão oficial autorizada</label><button class="botao mini suave" type="button" data-rem-doc="'+i+':'+n+'">Remover material</button></div>').join('')+'<button class="botao mini suave" type="button" data-add-doc="'+i+'">+ Material</button>'+
        '<div class="campo"><label>Materiais integrais e vídeos da biblioteca</label><select multiple size="4" data-biblioteca>'+(bibliotecaEditor?.materiais || []).map(m=>'<option value="'+esc(m.id)+'"'+((e.materiais||[]).some(r=>r.id===m.id)?' selected':'')+'>'+esc(m.titulo)+' · v'+esc(m.versao)+'</option>').join('')+'</select><a href="#/biblioteca">Organizar biblioteca</a></div><h3>Atividade: prova de compreensão</h3><p class="dica">'+(e.aprovacao?'Revisada por '+esc(e.aprovacao.por)+' · '+fmtDataHora(e.aprovacao.em):'Aguardando revisão. Salve o conteúdo antes de aprovar a prova.')+'</p>'+(!novo&&e.quiz?.length?'<button class="botao mini suave" type="button" data-revisar-avaliacao="'+esc(e.id)+'">Revisar avaliação salva</button>':'')+'<div class="edu-form-grid"><div class="campo"><label>Acerto mínimo (%)</label><input data-campo="minimoAcerto" type="number" min="1" max="100" value="'+(e.minimoAcerto ?? 70)+'"></div><div class="campo"><label>Máximo de tentativas</label><input data-campo="maxTentativas" type="number" min="1" max="20" value="'+(e.maxTentativas || 3)+'"></div></div>'+(e.quiz || []).map((q,n)=>'<div class="edu-questao-editor" data-q="'+esc(q.id)+'"><h4>Questão '+(n+1)+'</h4><div class="campo"><label>Situação ou pergunta</label><textarea data-pergunta>'+esc(q.pergunta)+'</textarea></div><div class="edu-form-grid"><div class="campo"><label>Alternativas (uma por linha)</label><textarea data-opcoes>'+esc(q.opcoes.join('\n'))+'</textarea></div><div class="campo"><label>Número da alternativa correta</label><input type="number" min="1" max="10" data-correta value="'+(q.correta+1)+'"></div></div><div class="campo"><label>Explicação após responder</label><textarea data-explicacao>'+esc(q.explicacao)+'</textarea></div><div class="campo"><label>O que rever se precisar de apoio?</label><input data-revisar value="'+esc(q.revisar || '')+'"></div><button type="button" class="botao mini suave" data-rem-q="'+i+':'+n+'">Remover questão</button></div>').join('')+'<button class="botao mini suave" type="button" data-add-q="'+i+'">+ Questão</button>'+
        '<h3>Atividade: prática acompanhada</h3><div class="edu-form-grid"><div class="campo"><label>Checklist da prática (um item por linha)</label><textarea data-checklist>'+esc((e.checklist || []).join('\n'))+'</textarea></div><div class="campo"><label>Quem valida esta prática?</label><select data-validadores multiple size="4">'+opcoesResponsaveis(pessoas,e.validadores || [])+'</select><p class="dica">Selecione uma ou mais pessoas. Elas também precisam estar autorizadas para o setor em Responsáveis pela prática. Esse vínculo não concede acesso administrativo.</p></div></div><div class="acoes"><button type="button" class="botao mini suave" data-mover="'+i+':-1"'+(!i?' disabled':'')+'>↑ Subir</button><button type="button" class="botao mini suave" data-mover="'+i+':1"'+(i===f.etapas.length-1?' disabled':'')+'>↓ Descer</button><button type="button" class="botao mini fantasma" data-rem-etapa="'+i+'">Remover aula</button></div></details>').join('');
      $$('[data-revisar-avaliacao]').forEach(bt=>bt.onclick=()=>{const e=anterior.etapas.find(e=>e.id===bt.dataset.revisarAvaliacao);const dlg=abrirModal('<h2>Revisar avaliação salva · '+esc(e.titulo)+'</h2><p>Confira o material integral e as questões antes de aprovar. Alterações ainda não salvas neste formulário não fazem parte desta revisão.</p><ol>'+e.quiz.map(q=>'<li><b>'+esc(q.pergunta)+'</b><p>Resposta: '+esc(q.opcoes[q.correta])+'</p><p>'+esc(q.explicacao)+'</p><p>'+esc(q.revisar||'')+'</p></li>').join('')+'</ol><form id="edu-revisao-prova"><label for="edu-parecer-prova">Parecer do responsável</label><textarea id="edu-parecer-prova" required maxlength="4000"></textarea><button class="botao">Aprovar avaliação salva</button><button class="botao suave" type="button" id="edu-revisao-fechar">Cancelar</button></form>');$('#edu-revisao-fechar').onclick=()=>dlg.remove();$('#edu-revisao-prova').onsubmit=async ev=>{ev.preventDefault();const b=ev.target.querySelector('button');b.disabled=true;const r=await executar({operacao:'aprovarAvaliacao',formacaoId:f.id,etapaId:e.id,expectedRevision:anterior._serverRevision,parecer:$('#edu-parecer-prova').value},async()=>{dlg.remove();await render(app);});if(!r)b.disabled=false;};});
      $$('[data-add-doc]').forEach(bt=>bt.onclick=()=>{ler();f.etapas[+bt.dataset.addDoc].documentos.push({titulo:'',url:'',versao:'1.0'});pintar();});
      $$('[data-add-q]').forEach(bt=>bt.onclick=()=>{ler();f.etapas[+bt.dataset.addQ].quiz.push({id:uuid(),pergunta:'',opcoes:['',''],correta:0,explicacao:'',revisar:''});pintar();});
      for(const [seletor,prop] of [['remDoc','documentos'],['remQ','quiz']])$$('[data-'+(seletor==='remDoc'?'rem-doc':'rem-q')+']').forEach(bt=>bt.onclick=()=>{ler();const[i,n]=bt.dataset[seletor].split(':').map(Number);f.etapas[i][prop].splice(n,1);pintar();});
      $$('[data-mover]').forEach(bt=>bt.onclick=()=>{ler();const[i,d]=bt.dataset.mover.split(':').map(Number);[f.etapas[i],f.etapas[i+d]]=[f.etapas[i+d],f.etapas[i]];pintar();});
      $$('[data-rem-etapa]').forEach(bt=>bt.onclick=()=>{if(!confirm('Remover esta aula da nova estrutura? O histórico confirmado permanecerá registrado.'))return;ler();const i=+bt.dataset.remEtapa,id=f.etapas[i].id;f.etapas.splice(i,1);for(const e of f.etapas)e.prerequisitos=e.prerequisitos.filter(k=>k!==id);pintar();});
      $$('[data-atualizar-fontes]').forEach(bt=>bt.onclick=()=>{ler();const e=f.etapas[+bt.dataset.atualizarFontes];e.fontes=e.fontes.map(r=>({...r,versao:STORE.um(r.tipo==='pop'?'pops':'treinamentos',r.refId)?.versao || r.versao,oficialConfirmado:false}));toast('Referências atualizadas no formulário. Revise o conteúdo e a versão do curso antes de salvar.');});
      associarRotulos($('#edu-editor'));
    }
    $('#edu-add-etapa').onclick=()=>{ler();f.etapas.push(novaEtapa('aula'));pintar();};
    // Catálogo e público lidos do formulário. Famílias só a administração envia:
    // sem o campo, o servidor conserva as famílias já gravadas.
    function lerCatalogo(){
      // Resumo e palavras-chave vêm do pacote e o formulário não os mostra: seguem como estão.
      const c={},num=id=>{const v=$(id).value;return v===''?null:Number(v);};
      const trilha=$('#edu-cat-trilha').value,area=$('#edu-cat-area').value.trim(),nivel=$('#edu-cat-nivel').value,codigo=$('#edu-cat-codigo').value.trim(),carga=num('#edu-cat-carga'),ordem=num('#edu-cat-ordem');
      if(trilha)c.trilha=trilha;if(area)c.area=area;if(nivel)c.nivel=nivel;if(codigo)c.codigo=codigo;
      if(carga!=null){if(!Number.isInteger(carga)||carga<1||carga>100000)throw new Error('A carga do curso deve ser um número inteiro de minutos, entre 1 e 100000.');c.cargaMinutos=carga;}
      if(ordem!=null){if(!Number.isInteger(ordem)||ordem<0||ordem>10000)throw new Error('A ordem na trilha deve ser um número inteiro entre 0 e 10000.');c.ordem=ordem;}
      const fams=marcados('edu-cat-familias'),pre=marcados('edu-cat-pre');
      if(fams.length>20)throw new Error('Indique no máximo 20 famílias de cargos no catálogo.');
      if(pre.length>20)throw new Error('Recomende no máximo 20 cursos antes deste.');
      if(fams.length)c.familias=fams;if(pre.length)c.preRequisitos=pre;
      if(cat.resumo)c.resumo=cat.resumo;if(Array.isArray(cat.palavrasChave)&&cat.palavrasChave.length)c.palavrasChave=[...cat.palavrasChave];
      return Object.keys(c).length?c:null;
    }
    // Curso gravado fora do editor (importação, carga assistida) pode não ter as
    // listas vazias que o formulário sempre preenche. Enviar campo novo vazio
    // pareceria mudança de conteúdo e o servidor pediria versão nova sem motivo.
    function aulaParaEnvio(e){
      const o=(anterior?.etapas || []).find(x=>x.id===e.id),r=JSON.parse(JSON.stringify(e));if(!o)return r;
      for(const k of ['materiais','validadores','checklist','fontes','documentos','quiz','prerequisitos'])if(!Object.hasOwn(o,k)&&Array.isArray(r[k])&&!r[k].length)delete r[k];
      if(!Object.hasOwn(o,'preparacaoPendente')&&r.preparacaoPendente===false)delete r.preparacaoPendente;
      for(const q of r.quiz || []){const qo=(o.quiz || []).find(x=>x.id===q.id);if(qo&&!Object.hasOwn(qo,'revisar')&&q.revisar==='')delete q.revisar;}
      return r;
    }
    function lerLiberacao(){const l={pessoas:marcados('edu-lib-pessoas'),cargos:marcados('edu-lib-cargos'),setores:marcados('edu-lib-setores'),todos:admin?$('#edu-todos').checked:lib.todos===true};if(admin)l.familias=marcados('edu-lib-familias');return l;}
    function pintarAlcance(){const el=$('#edu-alcance');if(!el)return;const l={...lerLiberacao()};if(!admin)l.familias=lib.familias || [];const n=alcance(l,pessoas,catalogo).length;el.textContent='Alcance estimado: '+(n===1?'1 pessoa':n+' pessoas')+(admin?' com vínculo RH':' do seu escopo')+'. O servidor confirma o número ao salvar.';}
    for(const id of ['edu-lib-cargos','edu-lib-familias','edu-lib-pessoas','edu-lib-setores']){const box=$('#'+id);if(box)$$('input[type=checkbox]',box).forEach(x=>x.onchange=pintarAlcance);}$('#edu-todos').onchange=pintarAlcance;
    ligarFiltros($('#edu-editor'));pintarAlcance();
    $('#edu-editor').onsubmit=async ev=>{ev.preventDefault();const el=$('#edu-editor-erro');el.hidden=true;ler();let catalogoNovo;try{catalogoNovo=lerCatalogo();}catch(e){el.hidden=false;el.textContent=e.message;el.focus();return;}Object.assign(f,{titulo:$('#edu-titulo').value.trim(),prazo:$('#edu-prazo').value||null,versao:$('#edu-versao').value.trim(),setor:$('#edu-setor').value.trim(),ativa:$('#edu-ativa').checked,publicada:$('#edu-publicada').checked,liberacao:lerLiberacao(),catalogo:catalogoNovo});const bt=ev.target.querySelector('button[type=submit]');bt.disabled=true;const res=await executar({operacao:'salvarFormacao',formacao:{...f,etapas:f.etapas.map(aulaParaEnvio)},expectedRevision:anterior?._serverRevision ?? anterior?.revision ?? 0},async()=>{toast('Curso salvo no servidor.');location.hash='#/escola';});if(!res){bt.disabled=false;el.hidden=false;el.textContent=erro;el.focus();}};
    pintar();fim(app);
  }
  return {conferirIdentidade,executar,render,zerar,carregar,progresso,bloqueio,status,tipos,estadoEnvio,conferirEstado,podeAcompanhar,
    obterPainel,limparCacheAparelho,invalidar,htmlAtualizacaoPainel,aparelho,marcarRender,houveInteracao,htmlAtualizacao,concluirAtualizacao,assinatura,
    iconeEscola,visualArea,arteCurso,guiaSilkHtml,contadorMutacoes:()=>mutacoes,identidadeAtual:pessoaKey,catalogoCfg,metaCurso,cargaTexto,niveis,rota,silk,emOrdem,textoAula,listaMarcar,marcados,ligarFiltros,alcance,
    estadoGestao:()=>({podeGerir:!!snapshot?.gestao?.podeGerir,podeValidar:!!snapshot?.gestao?.podeValidar}),gestaoAtual:()=>snapshot?.gestao || null,
    // Sair do aluno: o envio que ficou guardado nesta aba sai junto (a pessoa confirmou).
    descartarEnvio:()=>{mutacao=null;erro='';limparEnvio();notificarEstado();}};
})();
