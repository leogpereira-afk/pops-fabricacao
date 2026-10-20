/* Jornadas pessoais referenciam cursos por ID; a permissão e a gravação são do servidor. */
window.ESCOLA_JORNADAS=(()=>{
 const A=()=>ACADEMIA;
 const linkPessoa=id=>'#/aluno/'+encodeURIComponent(id);
 const opcoes=(xs,v)=>xs.map(([id,nome])=>'<option value="'+esc(id)+'"'+(id===v?' selected':'')+'>'+esc(nome)+'</option>').join('');
 const campo=(id,rot,v='',extra='')=>'<div class="campo"><label for="ej-'+id+'">'+esc(rot)+'</label><input id="ej-'+id+'" value="'+esc(v)+'" '+extra+'></div>';
 const area=(id,rot,v='',extra='')=>'<div class="campo"><label for="ej-'+id+'">'+esc(rot)+'</label><textarea id="ej-'+id+'" '+extra+'>'+esc(v)+'</textarea></div>';
 const novoLink=(url,rot)=>'<a class="botao mini suave" href="'+url+'" target="_blank" rel="noopener">'+rot+' <span aria-hidden="true">↗</span><span class="sr-only"> (abre em outra aba)</span></a>';
 const elegivel=f=>f.ativa!==false&&f.publicada===true&&!f.somenteHistorico;
 const acessoAtual=()=>JSON.stringify([SESSAO?.usuario,SESSAO?.papel,typeof AUTH!=='undefined'&&typeof AUTH.crachaDe==='function'?AUTH.crachaDe(SESSAO):null]);
 async function render(app){
  const hash=location.hash,acesso=acessoAtual(),id=ROTA.arg;let conta=null;
  A().layout(app,'Jornada pessoal','Consultando a pessoa e os cursos autorizados…');
  try{
   // Na abertura direta, o vínculo RH pode chegar depois da sessão da Central.
   // A identidade do editor só fica estável após essa conferência compartilhada.
   if(typeof atualizarIdentidadeRH==='function')await atualizarIdentidadeRH();
   if(hash!==location.hash||acesso!==acessoAtual())return;
   conta=EDUCACAO.identidadeAtual();
   const d=await EDUCACAO.obterPainel({fresco:true});
   if(hash!==location.hash||acesso!==acessoAtual()||conta!==EDUCACAO.identidadeAtual())return;
   if(!d.gestao?.podeMontarJornada){A().layout(app,'Montagem de jornada restrita','A administração organiza as jornadas pessoais.','<a class="botao mini suave" href="#/alunos">Voltar aos alunos</a>');return;}
   const pessoa=(d.gestao.pessoas||[]).find(p=>p.colaboradorId===id);
   if(!pessoa){A().layout(app,'Pessoa não disponível','Confira a ficha ativa do RH e seu escopo de acesso.','<a class="botao mini suave" href="#/alunos">Voltar aos alunos</a>');return;}
   editor(app,d,pessoa,conta,acesso);
  }catch(e){if(hash!==location.hash||acesso!==acessoAtual()||(conta!==null&&conta!==EDUCACAO.identidadeAtual()))return;const el=A().layout(app,'Não foi possível consultar a jornada',e.message||'Confira a conexão.');el.innerHTML='<button class="botao" id="ej-retentar">Tentar novamente</button>';$('#ej-retentar').onclick=()=>render(app);}
 }
 function editor(app,d,pessoa,conta,acesso){
  const anterior=(d.gestao.planos||[]).find(p=>p.colaboradorId===pessoa.colaboradorId);
  let revisao=anterior?._serverRevision||0,planoConfirmado=anterior,envio=null,ocupado=false;
  const plano={...(anterior?.id?{id:anterior.id}:{}),colaboradorId:pessoa.colaboradorId,titulo:anterior?.titulo||'Desenvolvimento pessoal',objetivo:anterior?.objetivo||'',equipeId:anterior?.equipeId||'',ativa:anterior?.ativa!==false,itens:(anterior?.itens||[]).map(i=>({formacaoId:i.formacaoId,prazo:i.prazo||'',contexto:i.contexto==='flexivel'?'flexivel':'empresa',orientacao:i.orientacao||''}))};
  const el=A().layout(app,'Jornada de '+pessoa.nome,'Organize o próximo passo e acompanhe o desenvolvimento desta pessoa.','<a class="botao mini suave" href="'+linkPessoa(pessoa.colaboradorId)+'">← Acompanhamento</a>');
  el.innerHTML='<form id="ej-form" class="ej-editor"><fieldset id="ej-campos" class="ej-campos"><legend class="sr-only">Montar jornada pessoal</legend><section class="card ej-pessoa" id="ej-pessoa" data-colaborador-id="'+esc(pessoa.colaboradorId)+'"><div><span class="ac-kicker">Pessoa do RH</span><h2>'+esc(pessoa.nome)+'</h2><p>'+esc([pessoa.funcao,pessoa.setor||pessoa.area].filter(Boolean).join(' · '))+'</p></div><p class="dica">Uma sequência de cursos para desenvolver esta pessoa.</p></section><div class="ej-config"><section class="card"><h2>Direção da jornada</h2>'+campo('titulo','Título da jornada',plano.titulo,'required maxlength="160"')+area('objetivo','Objetivo de desenvolvimento',plano.objetivo,'rows="2" maxlength="2000"')+'<div class="campo"><label for="ej-equipe">Equipe de trabalho existente</label><select id="ej-equipe"></select><p class="dica" id="ej-equipe-ajuda"></p></div><label class="edu-check"><input id="ej-ativa" type="checkbox"'+(plano.ativa?' checked':'')+'> Jornada ativa para esta pessoa</label><p class="dica">Desativar preserva o histórico de aprendizagem.</p></section><section class="card ej-criar"><h2>Preparar conteúdo</h2><p class="dica">Os editores abrem em outra aba. Depois de publicar o curso, atualize a lista abaixo.</p><div class="acoes">'+novoLink('#/formacao-editor/novo','Criar curso')+novoLink('#/material-editor/novo-video','Adicionar vídeo')+'</div><p class="dica">Vincule o vídeo a uma aula no editor do curso. Os materiais mantêm suas próprias permissões de acesso.</p><details><summary>Habilidades para a vida e o trabalho</summary><div class="ej-modelos">'+novoLink('#/formacao-editor/modelo-atendimento','Atendimento ao cliente')+novoLink('#/formacao-editor/modelo-conflitos','Comunicação em situações difíceis')+novoLink('#/formacao-editor/modelo-organizacao','Organização pessoal')+'</div><p class="dica">Modelos editáveis, com atividades de reflexão. Revise o conteúdo antes de liberar.</p></details></section></div><div class="ej-montagem"><section class="card ej-catalogo"><div class="ej-titulo"><h2>Adicionar cursos</h2><button id="ej-atualizar" type="button" class="botao mini suave">Atualizar cursos</button></div>'+campo('busca','Buscar cursos','','type="search" placeholder="Título, assunto ou objetivo"')+'<p id="ej-contagem" class="dica" role="status"></p><div id="ej-cursos"></div></section><section class="card ej-sequencia"><div class="ej-titulo"><h2>Ordem da jornada</h2><span id="ej-total" class="ej-total" role="status"></span></div><p class="dica">Use Subir e Descer para ordenar. Configure o prazo e o contexto de cada curso.</p><div id="ej-itens"></div><p class="dica ej-pratica">O contexto flexível permite estudar em casa. Práticas de equipamento continuam acompanhadas pelo responsável.</p></section></div></fieldset><footer class="card ej-salvar"><div><p id="ej-estado" role="status" aria-live="polite">Confira a sequência antes de salvar.</p><p class="dica">A jornada ativa libera os cursos selecionados para esta pessoa. Avaliações e práticas mantêm suas validações.</p><p id="ej-erro" class="aviso amarelo" role="alert" tabindex="-1" hidden></p></div><button type="submit" id="ej-salvar" class="botao">Salvar jornada</button></footer></form>';
  const form=$('#ej-form'),mesma=()=>form.isConnected&&acesso===acessoAtual()&&conta===EDUCACAO.identidadeAtual();
  function equipes(){
   const xs=(d.gestao.equipesTrabalho||[]).filter(e=>(e.colaboradorIds||[]).includes(pessoa.colaboradorId));
   $('#ej-equipe').innerHTML=opcoes([['','Sem equipe vinculada'],...xs.map(e=>[e.id,e.nome])],plano.equipeId);
   if(plano.equipeId&&!xs.some(e=>e.id===plano.equipeId))$('#ej-equipe').innerHTML+='<option value="'+esc(plano.equipeId)+'" selected>Equipe anterior indisponível · confira o vínculo</option>';
   $('#ej-equipe').value=plano.equipeId;
   const estado=pessoa.equipeTrabalho?.estado||d.gestao.estadoEquipesTrabalho;
   $('#ej-equipe-ajuda').textContent=estado==='indisponivel'?'A consulta das equipes está indisponível. Atualize a lista antes de escolher uma equipe.':xs.length?'Somente equipes com vínculo confirmado desta pessoa. O cadastro da equipe permanece no sistema de origem.':'Nenhuma equipe com vínculo confirmado desta pessoa. É possível salvar sem equipe.';
  }
  function ler(){
   plano.titulo=$('#ej-titulo').value.trim();plano.objetivo=$('#ej-objetivo').value.trim();plano.equipeId=$('#ej-equipe').value;plano.ativa=$('#ej-ativa').checked;
   plano.itens.forEach((item,n)=>{item.prazo=$('#ej-prazo-'+n).value||'';item.contexto=$('#ej-contexto-'+n).value;item.orientacao=$('#ej-orientacao-'+n).value.trim();});
  }
  function erro(msg){$('#ej-erro').hidden=false;$('#ej-erro').textContent=msg;$('#ej-erro').focus();}
  function catalogo(){
   const q=norm($('#ej-busca').value),fs=(d.formacoes||[]).filter(elegivel).filter(f=>norm([f.titulo,f.objetivo,f.setor,f.catalogo?.area].join(' ')).includes(q));
   $('#ej-contagem').textContent=fs.length+(fs.length===1?' curso publicado':' cursos publicados');
   $('#ej-cursos').innerHTML=fs.length?fs.map(f=>{const incluido=plano.itens.some(i=>i.formacaoId===f.id);return '<article class="ej-curso"><div><h3>'+esc(f.titulo)+'</h3><p class="dica">'+esc([f.setor,f.catalogo?.cargaMinutos?f.catalogo.cargaMinutos+' min estimados':''].filter(Boolean).join(' · '))+'</p></div><button type="button" class="botao mini '+(incluido?'suave':'')+'" data-ej-adicionar="'+esc(f.id)+'" aria-label="'+(incluido?'Já incluído: ':'Adicionar: ')+esc(f.titulo)+'"'+(incluido?' disabled':'')+'>'+(incluido?'Incluído':'Adicionar')+'</button></article>';}).join(''):'<p class="dica">Nenhum curso publicado neste filtro. Prepare um curso e atualize a lista.</p>';
   $$('[data-ej-adicionar]',form).forEach(bt=>bt.onclick=()=>{if(ocupado||envio||plano.itens.some(i=>i.formacaoId===bt.dataset.ejAdicionar))return;ler();plano.itens.push({formacaoId:bt.dataset.ejAdicionar,prazo:'',contexto:'empresa',orientacao:''});sequencia();catalogo();});
  }
  function sequencia(){
   const total=plano.itens.reduce((n,i)=>n+(Number(d.formacoes.find(f=>f.id===i.formacaoId)?.catalogo?.cargaMinutos)||0),0);
   $('#ej-total').textContent=plano.itens.length+(plano.itens.length===1?' curso':' cursos')+(total?' · '+total+' min estimados':'');
   $('#ej-itens').innerHTML=plano.itens.length?plano.itens.map((item,n)=>{const f=d.formacoes.find(f=>f.id===item.formacaoId),titulo=f?.titulo||'Curso indisponível';return '<article class="ej-item" data-ej-item="'+esc(item.formacaoId)+'"><div class="ej-item-cab"><span class="ej-numero" aria-label="Posição '+(n+1)+'">'+(n+1)+'</span><div><h3>'+esc(titulo)+'</h3>'+(!f||!elegivel(f)?'<p class="aviso amarelo">Curso indisponível para nova liberação. Referências já salvas podem ser preservadas ao desativar a jornada.</p>':'')+'</div><div class="ej-mover"><button type="button" class="botao mini suave" data-ej-subir="'+n+'" aria-label="Subir '+esc(titulo)+'"'+(!n?' disabled':'')+'>↑</button><button type="button" class="botao mini suave" data-ej-descer="'+n+'" aria-label="Descer '+esc(titulo)+'"'+(n===plano.itens.length-1?' disabled':'')+'>↓</button><button type="button" class="botao mini fantasma" data-ej-remover="'+n+'" aria-label="Remover '+esc(titulo)+'">Remover</button></div></div><div class="ej-item-campos">'+campo('prazo-'+n,'Prazo · curso '+(n+1),item.prazo,'type="date"')+'<div class="campo"><label for="ej-contexto-'+n+'">Contexto · curso '+(n+1)+'</label><select id="ej-contexto-'+n+'">'+opcoes([['empresa','Na empresa'],['flexivel','Flexível · também em casa']],item.contexto)+'</select></div></div>'+area('orientacao-'+n,'Orientação · curso '+(n+1),item.orientacao,'rows="2" maxlength="2000" placeholder="Como aplicar este aprendizado?"')+'</article>';}).join(''):'<div class="ej-vazio"><h3>Escolha o primeiro curso</h3><p>Adicione os cursos ao lado para preparar uma sequência pessoal.</p></div>';
   for(const [atributo,delta] of [['subir',-1],['descer',1],['remover',0]])$$('[data-ej-'+atributo+']',form).forEach(bt=>bt.onclick=()=>{if(ocupado||envio)return;ler();const n=Number(bt.dataset['ej'+atributo[0].toUpperCase()+atributo.slice(1)]),para=n+delta;if(!delta)plano.itens.splice(n,1);else if(para>=0&&para<plano.itens.length)[plano.itens[n],plano.itens[para]]=[plano.itens[para],plano.itens[n]];sequencia();catalogo();if(delta)$('[data-ej-'+atributo+'="'+para+'"]',form)?.focus();});
  }
  $('#ej-busca').oninput=catalogo;
  $('#ej-atualizar').onclick=async()=>{if(ocupado||envio)return;ler();const bt=$('#ej-atualizar');bt.disabled=true;try{const atual=await EDUCACAO.obterPainel({forcar:true});if(!mesma())return;if(!atual.gestao?.podeMontarJornada)throw new Error('Sua permissão de montar jornadas mudou. Consulte a administração.');
    // A consulta não bloqueia a edição: recolha também o que mudou durante a rede.
    ler();d=atual;equipes();sequencia();catalogo();$('#ej-estado').textContent='Lista de cursos atualizada. Sua sequência continua no formulário.';}catch(e){if(mesma())erro(e.message);}finally{if(mesma())bt.disabled=false;}};
  form.onsubmit=async ev=>{
   ev.preventDefault();if(ocupado||!mesma())return;$('#ej-erro').hidden=true;
   if(!envio){ler();if(!plano.titulo)return erro('Informe o título da jornada.');if(!plano.itens.length)return erro('Adicione pelo menos um curso.');if(plano.itens.some(i=>(plano.ativa||!planoConfirmado?.itens?.some(a=>a.formacaoId===i.formacaoId))&&!elegivel(d.formacoes.find(f=>f.id===i.formacaoId)||{})))return erro('Confira os cursos indisponíveis antes de salvar.');if(plano.equipeId&&(plano.ativa||plano.equipeId!==planoConfirmado?.equipeId)&&!(d.gestao.equipesTrabalho||[]).some(e=>e.id===plano.equipeId&&(e.colaboradorIds||[]).includes(pessoa.colaboradorId)))return erro('Confira a equipe atual desta pessoa ou escolha salvar sem equipe.');envio={operacao:'salvarPlano',plano:JSON.parse(JSON.stringify(plano)),expectedRevision:revisao,mutationId:uuid()};}
   ocupado=true;$('#ej-campos').disabled=true;$('#ej-salvar').disabled=true;$('#ej-estado').textContent='Aguardando confirmação do servidor…';
   const r=await EDUCACAO.executar(envio);
   if(!mesma())return;ocupado=false;
   if(r){const salvo=r.plano||r.registro;revisao=salvo?._serverRevision??r.revision??revisao+1;if(salvo?.id)plano.id=salvo.id;planoConfirmado=JSON.parse(JSON.stringify(envio.plano));envio=null;$('#ej-campos').disabled=false;$('#ej-estado').textContent='Jornada confirmada no servidor. O histórico de aprendizagem foi preservado.';$('#ej-salvar').textContent='Salvar alterações';}
   else{const estado=EDUCACAO.estadoEnvio();if(!estado.pendente)envio=null;$('#ej-campos').disabled=!!envio;$('#ej-estado').textContent=envio?'A gravação ainda não foi confirmada. Confira o mesmo envio antes de alterar a jornada.':'A jornada continua no formulário. Confira a mensagem antes de tentar salvar.';$('#ej-salvar').textContent=envio?'Conferir gravação':'Salvar jornada';erro(estado.erro||'Não foi possível confirmar a gravação.');}
   $('#ej-salvar').disabled=false;
  };
  equipes();sequencia();catalogo();
 }
 return {render};
})();
