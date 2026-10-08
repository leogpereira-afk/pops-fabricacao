// A escola usa comandos autenticados. Nenhum formulário pode escolher identidade,
// fabricar progresso, liberar uma prática ou escrever pontos diretamente.
const norm = (v: any) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const copy = (v: any) => JSON.parse(JSON.stringify(v));
const tipos = ['cultura', 'etica', 'caderno', 'pop', 'pratica', 'avaliacao', 'continua'];
const texto = (v: any, max = 4000) => typeof v === 'string' && v.trim().length <= max ? v.trim() : '';
const estavel = (v: any): string => Array.isArray(v) ? '[' + v.map(estavel).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}' : JSON.stringify(v);
const iguais = (a: any, b: any) => estavel(a) === estavel(b);
const limparEtapa = (e:any) => {const r=copy(e);for(const k of ['aprovacao','avaliacaoPendente','status','statusFonte','motivoBloqueio'])delete r[k];return r;};
const camposPedagogicos = (f: any) => ({ titulo: f.titulo, etapas: f.etapas.map(limparEtapa) });
const corresponde = (p: any, setores: any[]) => setores.map(norm).some(s => s && [p?.setor, p?.area, p?.areaId].map(norm).includes(s));
const liberada = (f: any, p: any, cfg: any) => {
  if(!p || f.ativa===false || f.publicada!==true)return false;
  const l=f.liberacao||{};
  const porCargo=(l.cargos||[]).includes(p.cargoId) && (!l.cargosGestor || (corresponde(p,l.cargosSetores||[]) && corresponde(p,cfg.gestores?.[l.cargosGestor]||[])));
  return l.todos===true || (l.pessoas||[]).includes(p.colaboradorId) || porCargo || corresponde(p,l.setores||[]);
};
export async function escola(body: any, ctx: any) {
  const { sb, cracha, maquina, identidadeRH, config, registro, conferir, Falha } = ctx;
  const fail = (m: string, s = 400): never => { throw new Falha(m, s); };
  if (maquina || !cracha) fail('Entre com sua conta pessoal para acessar a escola.', 401);
  const usuario = norm(cracha.sub), admin = cracha.papel === 'admin';
  const cfg = await config(), setores = cfg.gestores?.[usuario] || [];
  const gestor = cracha.papel === 'gestor' && Array.isArray(setores) && setores.length > 0;
  const gerencia = (f: any) => admin || (gestor && setores.map(norm).includes(norm(f.setor)));
  const identidade = await identidadeRH(cracha), pessoa = identidade.vinculada ? identidade.pessoa : null;
  const id = (v: any) => { if (typeof v !== 'string' || !/^[a-zA-Z0-9._:-]{1,160}$/.test(v)) fail('Identificador inválido.'); return v; };
  const todos = async (col: string) => {
    const out: any[] = []; let de = 0;
    for (;;) {
      const rows = conferir(await sb.from('pops_registros').select('id,registro,revision,apagado').eq('colecao', col).eq('apagado', false).order('id').range(de, de + 499));
      out.push(...rows.map((r: any) => ({ ...r.registro, _serverRevision: r.revision })));
      if (rows.length < 500) return out;
      de += 500;
    }
  };
  const pessoasRH = async () => {
    const out: any[] = []; let de = 0;
    for (;;) {
      // Projection excludes sensitive RH fields at the database boundary.
      const rows = conferir(await sb.from('registros').select('id,nome:registro->>nome,cargoId:registro->>cargoId,areaId:registro->>areaId,setor:registro->>setor,statusId:registro->>statusId,dataDesligamento:registro->>dataDesligamento,cargoLivre:registro->>cargoLivre,funcao:registro->>funcao').eq('colecao','colaboradores').eq('apagado',false).order('id').range(de,de+499));
      for (const row of rows) {
        const r = row.registro || row;
        if (r.dataDesligamento || ['inativo','abandono'].includes(r.statusId)) continue;
        out.push({ id:'p-'+row.id, colaboradorId:row.id, nome:r.nome || '', cargoId:r.cargoId || '', areaId:r.areaId || '', setor:r.setor || '', funcao:r.cargoLivre || r.funcao || '', area:'' });
      }
      if (rows.length < 500) break; de += 500;
    }
    const areas = new Map<string,string>(), cargos = new Map<string,string>();
    for (const [col, map] of [['areas',areas],['cargos',cargos]] as const) {
      let offset = 0;
      for (;;) {
        const rows = conferir(await sb.from('registros').select('id,nome:registro->>nome').eq('colecao',col).eq('apagado',false).order('id').range(offset,offset+499));
        for (const r of rows) map.set(r.id,r.nome || r.registro?.nome || '');
        if(rows.length<500)break;offset+=500;
      }
    }
    const contas:any[]=[],papeis:any[]=[];
    for(const [t,campos,destino] of [['acesso_conta','id,usuario,colaborador_id',contas],['acesso_papel','conta_id,login',papeis]] as const) {
      let offset=0;
      for(;;){
        let q=sb.from(t).select(campos).eq('ativo',true);if(t==='acesso_papel')q=q.eq('sistema','pops');
        const rs=conferir(await q.order(t==='acesso_conta'?'id':'conta_id').range(offset,offset+499));destino.push(...rs);if(rs.length<500)break;offset+=500;
      }
    }
    return out.map(p => {
      const vinculadas=contas.filter(c=>c.colaborador_id===p.colaboradorId&&papeis.some(a=>a.conta_id===c.id));
      return {...p,area:areas.get(p.areaId)||'',funcao:cargos.get(p.cargoId)||p.funcao,usuario:vinculadas.length===1?vinculadas[0].usuario:''};
    });
  };
  const validar = (f:any,e:any,p:any) => {
    // Responsável designado nunca aprova a si mesmo. Gestores continuam no setor.
    if (!pessoa || !p || p.colaboradorId === pessoa?.colaboradorId || norm(p.usuario) === usuario) return false;
    if (admin) return true;
    if (gestor && (!corresponde(p,setores) || !setores.map(norm).includes(norm(f.setor)))) return false;
    return (e.validadores || []).map(norm).includes(usuario) && (gestor || (corresponde(p,cfg.educacao?.instrutores?.[usuario] || [])&&(cfg.educacao?.instrutores?.[usuario]||[]).map(norm).includes(norm(f.setor))));
  };
  const registroGestao = (r:any,f:any,p:any) => {
    if(admin||(gerencia(f)&&corresponde(p,setores)))return r;
    const etapas:any={};for(const e of f.etapas)if(e.tipo==='pratica'&&validar(f,e,p)&&r.etapas?.[e.id])etapas[e.id]=r.etapas[e.id];
    return {id:r.id,colaboradorId:r.colaboradorId,nome:r.nome,formacaoId:r.formacaoId,formacaoVersao:r.formacaoVersao,etapas,atualizadoEm:r.atualizadoEm};
  };
  const getF = async (fid:any) => { const r=await registro('formacoes',id(fid));if(!r||r.apagado)fail('Formação não disponível.',404);return {...r.registro,_serverRevision:r.revision}; };
  const getP = async (pid:any) => { const ps=await pessoasRH();const p=ps.find(x=>x.colaboradorId===id(pid));if(!p)fail('Pessoa não disponível no RH.',404);return p; };
  const idApr = async (pid:string,fid:string) => 'ap-'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pid+'\n'+fid)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const gravar = async (col:string,r:any,revision:number,mutation:string) => {
    if(JSON.stringify(r).length>500_000)fail('Histórico atingiu o limite. A gestão deve preparar uma nova jornada; nenhum registro foi apagado.',409);
    const res=await sb.rpc('pops_gravar',{p_colecao:col,p_id:r.id,p_registro:r,p_acao:'upsert',p_expected:revision,p_mutation:mutation});
    if(res.error?.code==='40001')fail('O registro mudou em outro aparelho. Atualize e tente novamente; sua resposta continua disponível.',409);
    return conferir(res);
  };
  const pendenciaFonte = async (e:any) => {
    if(e.preparacaoPendente) return 'Conteúdo em preparação pela gestão.';
    if(!e.conteudo || ['aprender','importancia','comoFazer','erros','evidencia'].some(k=>!texto(e.conteudo[k],20000)))return 'A orientação desta etapa ainda precisa ser preparada.';
    if(['etica','caderno','pop'].includes(e.tipo) && !(e.fontes?.length || e.documentos?.length || e.materiais?.length))return 'Falta vincular o documento oficial desta etapa.';
    for(const ref of e.materiais||[]){const m=await registro('materiais',ref.id);if(!m||m.apagado||m.registro.versao!==ref.versao||m.registro.publicada!==true||m.registro.ativa===false)return 'Um material integral vinculado mudou ou ainda não foi liberado. Revise a etapa.';}
    for(const d of e.documentos || []) if(d.oficialConfirmado!==true || !d.conferidoPor || !d.conferidoEm)return 'A gestão precisa conferir a versão oficial deste documento.';
    for(const fonte of e.fontes || []) {
      const col=fonte.tipo==='pop'?'pops':'treinamentos',r=await registro(col,fonte.refId);
      if(!r||r.apagado)return 'Uma fonte oficial não está mais disponível.';
      if(String(r.registro.versao||'1.0')!==fonte.versao)return 'A fonte mudou de versão. A gestão precisa revisar esta etapa.';
      if(col==='pops' && r.registro.revisao?.status!=='validado')return 'O POP aguarda revisão do responsável antes de formar a equipe.';
      if(col==='treinamentos' && (fonte.oficialConfirmado!==true||!fonte.conferidoPor||!fonte.conferidoEm))return 'A gestão precisa conferir a versão oficial deste treinamento.';
    }
    if(['etica','avaliacao'].includes(e.tipo)&&!e.quiz?.length)return 'A avaliação de compreensão ainda precisa ser preparada.';
    if(e.tipo==='pratica'&&(!e.checklist?.length || !e.validadores?.length))return 'Falta definir o checklist e o responsável pela prática.';
    return '';
  };
  const decorar = async (f:any,r:any,privado:boolean,ps:any[]=[]) => {
    const res=copy(f),novaVersao=!!r && r.formacaoVersao!==f.versao;
    let concluidas=0;const obrigatorias=f.etapas.filter((e:any)=>e.obrigatoria!==false);
    const fontesPendentes=new Map<string,string>();for(const e of f.etapas)fontesPendentes.set(e.id,await pendenciaFonte(e));
    for(const e of res.etapas) {
      const a=!novaVersao?r?.etapas?.[e.id]:null;
      const falta=fontesPendentes.get(e.id)||'', prereq=(e.prerequisitos||[]).find((pid:string)=>novaVersao||r?.etapas?.[pid]?.status!=='concluida'||fontesPendentes.get(pid));
      e.status=a?.status || (novaVersao?'revisar':'nao_iniciada');
      e.statusFonte=falta?'pendente':'disponivel';
      e.motivoBloqueio=falta || (prereq?'Conclua primeiro: '+(f.etapas.find((x:any)=>x.id===prereq)?.titulo||prereq):'');
      if(e.status==='concluida'&&!falta&&e.obrigatoria!==false)concluidas++;
      if(falta && e.status==='concluida')e.status='revisar';
      e.avaliacaoPendente=!!e.quiz?.length&&(!e.aprovacao?.por||e.aprovacao?.versao!==f.versao);
      if(!privado&&e.avaliacaoPendente)e.quiz=[];
      if(!privado)e.quiz=(e.quiz||[]).map(({correta,explicacao,revisar,...q}:any)=>q);
    }
    if(!privado){delete res.liberacao;delete res.versoesAnteriores;delete res.atribuicoesAnteriores;if(res.atribuicao)delete res.atribuicao.liberacao;}
    else {
      const escopoPessoas=ps.filter(p=>admin||corresponde(p,setores));
      res.pessoasLiberadas=escopoPessoas.filter(p=>liberada(f,p,cfg)).map(p=>p.colaboradorId);
      if(res.liberacao?.cargosGestor) {
        const antes=res.liberacao.cargosSetores||[],atuais=cfg.gestores?.[res.liberacao.cargosGestor]||[];
        res.liberacao.cargosSetoresEfetivos=[...new Set([...antes.filter((s:any)=>atuais.map(norm).includes(norm(s))),...escopoPessoas.filter(p=>corresponde(p,antes)&&corresponde(p,atuais)).map(p=>p.setor||p.area||p.areaId).filter(Boolean)])];
      }
    }
    res.progresso={concluidas,total:obrigatorias.length,percentual:obrigatorias.length?Math.round(concluidas/obrigatorias.length*100):0,etapaAtual:res.etapas.find((e:any)=>e.obrigatoria!==false&&e.status!=='concluida')?.id||null};
    res.revisaoNecessaria=novaVersao;res.liberada=liberada(f,pessoa,cfg);res.liberadaParaMim=res.liberada;
    return res;
  };
  const op=String(body.operacao || 'painel');
  if(op.startsWith('academia.'))return academia(body,{sb,usuario,admin,gestor,setores,pessoa,cfg,gerencia,registro,todos,pessoasRH,idApr,gravar,fail,id});
  if(op==='configurarInstrutores') {
    if(!admin)fail('Somente a administração configura instrutores.',403);
    const mapa=body.instrutores;
    if(!mapa||typeof mapa!=='object'||Array.isArray(mapa)||Object.keys(mapa).length>100)fail('Configuração de instrutores inválida.');
    const unicos=new Set();
    for(const [login,locais] of Object.entries(mapa)) {
      if(!texto(login,160)||norm(login)!==login||unicos.has(norm(login))||!Array.isArray(locais)||!locais.length||locais.length>30||locais.some(s=>!texto(s,200)))fail('Informe login pessoal e setores permitidos para cada instrutor.');
      unicos.add(login);
      const acesso=await identidadeRH({sub:login});
      if(!acesso.vinculada)fail('O instrutor '+login+' precisa de conta ativa vinculada ao RH.',409);
    }
    const educacao={...(cfg.educacao||{}),instrutores:copy(mapa)};
    const res=await sb.rpc('pops_configurar',{p_patch:{educacao},p_anterior:Object.hasOwn(cfg,'educacao')?{educacao:cfg.educacao}:{}});
    if(res.error?.code==='40001')fail('A configuração mudou. Atualize antes de salvar.',409);
    conferir(res);return {ok:true,instrutores:mapa};
  }
  if(op==='painel') {
    const [fs,rs,ps]=await Promise.all([todos('formacoes'),todos('aprendizagem'),pessoasRH()]);
    const pessoais=rs.filter(r=>pessoa && r.colaboradorId===pessoa.colaboradorId);
    const visiveis=fs.filter(f=>gerencia(f)||liberada(f,pessoa,cfg)||pessoais.some(r=>r.formacaoId===f.id)||(pessoa&&(cfg.educacao?.instrutores?.[usuario]||[]).map(norm).includes(norm(f.setor))&&f.etapas?.some((e:any)=>(e.validadores||[]).map(norm).includes(usuario))));
    const formacoes=[];
    for(const f of visiveis) {
      const pessoal=pessoais.find(r=>r.formacaoId===f.id);
      const instrutor=!!pessoa&&(cfg.educacao?.instrutores?.[usuario]||[]).map(norm).includes(norm(f.setor))&&f.etapas.some((e:any)=>(e.validadores||[]).map(norm).includes(usuario));
      if(!gerencia(f)&&!liberada(f,pessoa,cfg)&&!instrutor) {
        const antiga=f.versoesAnteriores?.find((v:any)=>v.versao===pessoal?.formacaoVersao);
        formacoes.push({id:f.id,titulo:antiga?.titulo||f.titulo,versao:pessoal?.formacaoVersao||f.versao,setor:f.setor,ativa:f.ativa,publicada:false,liberada:false,liberadaParaMim:false,somenteHistorico:true,historica:true,etapas:(antiga?.etapas||f.etapas).map((e:any)=>({id:e.id,titulo:e.titulo,tipo:e.tipo,obrigatoria:e.obrigatoria,status:pessoal?.etapas?.[e.id]?.status||'nao_iniciada',statusFonte:'restrito',motivoBloqueio:'Esta jornada não está mais liberada para sua função. Seu histórico permanece preservado.'})),progresso:{concluidas:Object.values(pessoal?.etapas||{}).filter((e:any)=>e.status==='concluida').length,total:f.etapas.length,percentual:0,etapaAtual:null}});
      } else formacoes.push(await decorar(f,pessoal,gerencia(f),ps));
    }
    const gestaoReg=rs.filter(r=>{const f=fs.find(f=>f.id===r.formacaoId),p=ps.find(p=>p.colaboradorId===r.colaboradorId);return f&&p&&(admin ||(gerencia(f)&&corresponde(p,setores))||f.etapas.some((e:any)=>validar(f,e,p)));});
    const ids=new Set(gestaoReg.map(r=>r.colaboradorId));
    return {ok:true,pessoa,motivoVinculo:identidade.motivo||null,formacoes,aprendizagem:pessoais,gestao:{instrutores:admin?(cfg.educacao?.instrutores||{}):undefined,podeGerir:admin||gestor,podeValidar:!!pessoa&&(admin||gestor||fs.some(f=>f.etapas.some((e:any)=>(e.validadores||[]).map(norm).includes(usuario)))),pessoas:ps.filter(p=>admin||(gestor&&corresponde(p,setores))||ids.has(p.colaboradorId)),registros:gestaoReg.map(r=>registroGestao(r,fs.find(f=>f.id===r.formacaoId),ps.find(p=>p.colaboradorId===r.colaboradorId)))},atualizadoEm:new Date().toISOString()};
  }
  if(op==='aprovarAvaliacao') {
    const f=await getF(body.formacaoId);if(!gerencia(f))fail('Somente a gestão responsável aprova avaliações.',403);
    const e=f.etapas.find((e:any)=>e.id===body.etapaId);if(!e?.quiz?.length)fail('Prepare as questões antes da aprovação.');
    if(!texto(body.parecer,4000))fail('Registre o parecer da revisão pedagógica.');
    const mutation=id(body.mutationId);if(e.aprovacao?.mutationId===mutation&&e.aprovacao.por===usuario)return {ok:true,registro:f,revision:f._serverRevision};
    if(body.expectedRevision!==f._serverRevision)fail('A jornada mudou. Confira a versão atual.',409);
    const falta=await pendenciaFonte(e);if(falta)fail(falta,409);
    e.aprovacao={por:usuario,em:new Date().toISOString(),versao:f.versao,parecer:texto(body.parecer,4000),mutationId:mutation};
    const rev=f._serverRevision;delete f._serverRevision;return gravar('formacoes',f,rev,mutation);
  }
  if(op==='salvarFormacao') {
    const f=copy(body.formacao||{});id(f.id);
    const anterior=await registro('formacoes',f.id);
    if(!gerencia(f)||(anterior&&!gerencia(anterior.registro)))fail('Seu acesso não permite gerenciar esta formação.',403);
    const mutation=id(body.mutationId);
    if(anterior?.mutation_id===mutation){
      if(anterior.registro.atualizadoPor!==usuario)fail('Este envio pertence a outra pessoa. Atualize antes de salvar.',409);
      return {ok:true,registro:anterior.registro,revision:anterior.revision,repetido:true};
    }
    if(!texto(f.titulo,200)||!texto(f.versao,40)||!texto(f.setor,200))fail('Informe título, versão e setor.');
    if(!Array.isArray(f.etapas)||!f.etapas.length||f.etapas.length>50)fail('Cadastre entre 1 e 50 etapas.');
    if(typeof f.publicada!=='boolean'||typeof f.ativa!=='boolean')fail('Informe a disponibilidade da formação.');
    f.liberacao=f.liberacao||{};delete f.liberacao.cargosSetoresEfetivos;delete f.pessoasLiberadas;
    for(const k of ['pessoas','cargos','setores'])if(!Array.isArray(f.liberacao[k]||[])||(f.liberacao[k]||[]).length>2000||(f.liberacao[k]||[]).some((s:any)=>!texto(s,160)))fail('Público da formação inválido.');
    if(f.liberacao.todos && !admin)fail('Somente a administração libera para toda a empresa.',403);
    if(!admin) {
      if((f.liberacao.cargos||[]).length){
        // O navegador não escolhe o alcance do gestor; o limite acompanha o RH
        // e precisa continuar autorizado mesmo depois da atribuição inicial.
        f.liberacao.cargosSetores=copy(setores);f.liberacao.cargosGestor=usuario;
      }else{delete f.liberacao.cargosSetores;delete f.liberacao.cargosGestor;}
      if((f.liberacao.setores||[]).some((s:any)=>!setores.map(norm).includes(norm(s))))fail('Escolha somente os setores sob sua gestão.',403);
      const ps=await pessoasRH();if((f.liberacao.pessoas||[]).some((pid:any)=>!ps.some(p=>p.colaboradorId===pid&&corresponde(p,setores))))fail('Escolha somente as pessoas sob sua gestão.',403);
    }
    if(admin) {
      const limite=anterior?.registro.liberacao;
      if((f.liberacao.cargos||[]).length&&limite?.cargosGestor&&body.removerLimitacaoCargos!==true){f.liberacao.cargosGestor=limite.cargosGestor;f.liberacao.cargosSetores=copy(limite.cargosSetores||[]);}
      else{delete f.liberacao.cargosGestor;delete f.liberacao.cargosSetores;}
    }
    if(!f.etapas.some((e:any)=>e?.obrigatoria!==false))fail('Defina pelo menos uma etapa obrigatória para concluir a jornada.');
    const vistos=new Set<string>();
    for(const e of f.etapas) {
      id(e.id);if(vistos.has(e.id)||!texto(e.titulo,200)||!tipos.includes(e.tipo))fail('Etapa inválida ou repetida.');
      if(!Array.isArray(e.prerequisitos||[])||(e.prerequisitos||[]).some((p:any)=>!vistos.has(p)))fail('Pré-requisitos devem apontar para etapas anteriores.');
      vistos.add(e.id);
      if(!Number.isInteger(e.pontos)||e.pontos<0||e.pontos>1000)fail('Os pontos devem estar entre 0 e 1000.');
      if(e.duracaoMinutos!=null&&(!Number.isInteger(e.duracaoMinutos)||e.duracaoMinutos<1||e.duracaoMinutos>10000))fail('Duração inválida.');
      if(!Array.isArray(e.validadores||[])||(e.validadores||[]).length>30||(e.validadores||[]).some((s:any)=>!texto(s,160)))fail('Responsáveis inválidos.');
      if(!Array.isArray(e.checklist||[])||(e.checklist||[]).length>100||(e.checklist||[]).some((s:any)=>!texto(s,2000)))fail('Checklist inválido.');
      if(!Array.isArray(e.quiz||[])||(e.quiz||[]).length>40)fail('Avaliação inválida.');
      const qs=new Set();
      for(const q of e.quiz||[]) {
        id(q.id);if(qs.has(q.id)||!texto(q.pergunta,2000)||!Array.isArray(q.opcoes)||q.opcoes.length<2||q.opcoes.length>8||q.opcoes.some((v:any)=>!texto(v,2000))||!Number.isInteger(q.correta)||q.correta<0||q.correta>=q.opcoes.length||!texto(q.explicacao,4000))fail('Complete a pergunta, alternativas, resposta e explicação.');qs.add(q.id);
      }
      e.minimoAcerto=e.minimoAcerto??70;e.maxTentativas=e.maxTentativas??3;
      if(!Number.isInteger(e.minimoAcerto)||e.minimoAcerto<1||e.minimoAcerto>100||!Number.isInteger(e.maxTentativas)||e.maxTentativas<1||e.maxTentativas>20)fail('Critérios da avaliação inválidos.');
      for(const k of ['fontes','documentos'])if(!Array.isArray(e[k]||[])||(e[k]||[]).length>30)fail('Fontes inválidas.');
      for(const fonte of e.fontes||[]) {
        if(!['pop','treinamento'].includes(fonte.tipo)||!texto(fonte.versao,40)||!id(fonte.refId))fail('Fonte inválida.');
        const antigo=anterior?.registro.etapas?.find((x:any)=>x.id===e.id)?.fontes?.find((x:any)=>x.tipo===fonte.tipo&&x.refId===fonte.refId&&x.versao===fonte.versao);
        if(fonte.oficialConfirmado===true){fonte.conferidoPor=antigo?.conferidoPor||usuario;fonte.conferidoEm=antigo?.conferidoEm||new Date().toISOString();}else{delete fonte.conferidoPor;delete fonte.conferidoEm;}
      }
      for(const d of e.documentos||[]) {
        let u;try{u=new URL(d.url);}catch{fail('Use HTTPS nos documentos.');}
        if(u.protocol!=='https:'||u.username||u.password||!texto(d.titulo,200)||!texto(d.versao,40))fail('Informe título, versão e link HTTPS do documento oficial.');
        const antigo=anterior?.registro.etapas?.find((x:any)=>x.id===e.id)?.documentos?.find((x:any)=>x.url===d.url&&x.versao===d.versao);
        if(d.oficialConfirmado===true){d.conferidoPor=antigo?.conferidoPor||usuario;d.conferidoEm=antigo?.conferidoEm||new Date().toISOString();}else{delete d.conferidoPor;delete d.conferidoEm;}
      }
      if(JSON.stringify(e.conteudo||{}).length>100000)fail('Conteúdo muito extenso.');
      if(!Array.isArray(e.materiais||[])||(e.materiais||[]).length>30||(e.materiais||[]).some((r:any)=>!texto(r.id,160)||!texto(r.versao,40)))fail('Referências da biblioteca inválidas.');
      for(const ref of e.materiais||[]){const mat=await registro('materiais',ref.id);if(!mat||mat.apagado||!gerencia(mat.registro))fail('Você não pode liberar material de outro setor por esta jornada.',403);}
      const antiga=anterior?.registro.etapas?.find((x:any)=>x.id===e.id);
      delete e.aprovacao;delete e.avaliacaoPendente;
      if(antiga?.aprovacao&&anterior?.registro.versao===f.versao&&iguais(limparEtapa(e),limparEtapa(antiga)))e.aprovacao=copy(antiga.aprovacao);
      // Fontes podem ficar pendentes no rascunho; nunca concedem conclusão.
      if(f.publicada) { const falta=await pendenciaFonte(e);if(falta&&!e.preparacaoPendente)fail(e.titulo+': '+falta,409); }
      delete e.status;delete e.statusFonte;delete e.motivoBloqueio;
    }
    const mudouPedagogia=!!anterior&&!iguais(camposPedagogicos(f),camposPedagogicos(anterior.registro));
    if(mudouPedagogia&&f.versao===anterior.registro.versao)fail('O aprendizado mudou. Informe nova versão para preservar as conclusões anteriores.',409);
    f.versoesAnteriores=copy(anterior?.registro.versoesAnteriores||[]);
    if(anterior&&f.versao!==anterior.registro.versao){
      if(f.versoesAnteriores.some((v:any)=>v.versao===f.versao))fail('Esta versão já foi usada. Escolha uma versão nova para preservar o histórico.',409);
      f.versoesAnteriores.push({versao:anterior.registro.versao,titulo:anterior.registro.titulo,etapas:copy(anterior.registro.etapas),arquivadaEm:new Date().toISOString(),por:usuario});
    }
    if(anterior && body.expectedRevision!==anterior.revision)fail('A formação mudou. Atualize antes de salvar.',409);
    delete f._serverRevision;delete f.progresso;delete f.revisaoNecessaria;delete f.liberada;delete f.liberadaParaMim;delete f.somenteHistorico;delete f.historica;
    if(f.prazo&&(!/^\d{4}-\d{2}-\d{2}$/.test(f.prazo)||isNaN(Date.parse(f.prazo))))fail('Prazo da formação inválido.');
    f.atribuicoesAnteriores=copy(anterior?.registro.atribuicoesAnteriores||[]);f.atribuicao=copy(anterior?.registro.atribuicao||null);
    if(!anterior||!iguais(f.liberacao,anterior.registro.liberacao)||f.prazo!==anterior.registro.prazo){if(f.atribuicao)f.atribuicoesAnteriores.push(f.atribuicao);f.atribuicao={por:usuario,em:new Date().toISOString(),prazo:f.prazo||null,liberacao:copy(f.liberacao)};}
    f.atualizadoPor=usuario;f.atualizadoEm=new Date().toISOString();
    return gravar('formacoes',f,anterior?.revision||0,mutation);
  }
  if(!['registrar','validar','reciclar'].includes(op))fail('Operação da escola desconhecida.');
  const f=await getF(body.formacaoId);
  const alvo=op==='registrar'?pessoa:await getP(body.colaboradorId);
  if(!alvo)fail('Vincule sua conta ao ID do RH para registrar aprendizagem.',403);
  const rid=await idApr(alvo.colaboradorId,f.id),atual=await registro('aprendizagem',rid),mutation=id(body.mutationId);
  if(atual?.apagado)fail('O histórico está arquivado. Fale com a gestão.',409);
  const agora=new Date().toISOString();
  const assinatura=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(estavel({operacao:op,formacaoVersao:body.formacaoVersao||null,etapaId:body.etapaId||null,evento:body.evento||null,respostas:body.respostas||null,evidencia:body.evidencia||null,checklist:body.checklist||null,aceite:body.aceite||false,aprovado:body.aprovado??null,feedback:body.feedback||null,motivo:body.motivo||null,por:usuario}))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  let r=atual?.registro?copy(atual.registro):{id:rid,colaboradorId:alvo.colaboradorId,pessoaId:'p-'+alvo.colaboradorId,nome:alvo.nome,formacaoId:f.id,formacaoVersao:f.versao,etapas:{},pontos:0,conquistas:[],historico:[],eventos:[],iniciadaEm:agora};
  const e=f.etapas.find((e:any)=>e.id===body.etapaId);
  if(op==='registrar'&&!liberada(f,pessoa,cfg))fail('Esta formação não está liberada para você.',403);
  if(op==='validar'&&(!e||!validar(f,e,alvo)))fail('A prática exige outro responsável autorizado para este setor.',403);
  if(op==='reciclar'&&(!gerencia(f)||(!admin&&!corresponde(alvo,setores))))fail('Seu acesso não permite liberar esta reciclagem.',403);
  const repetido=r.eventos.find((ev:any)=>ev.id===mutation);
  if(repetido) {
    if(repetido.assinatura!==assinatura||repetido.por!==usuario||repetido.operacao!==op||repetido.etapaId!==(e?.id||null))fail('Este identificador de envio pertence a outra atividade. Atualize e tente novamente.',409);
    const etapas=repetido.ciclo!=null&&repetido.ciclo<r.historico.length?r.historico[repetido.ciclo].etapas:r.etapas;
    const etapa=etapas?.[repetido.etapaId];
    const feedback=repetido.tentativaIndice!=null?etapa?.tentativas?.[repetido.tentativaIndice]?.feedback:repetido.validacaoIndice!=null?etapa?.validacoes?.[repetido.validacaoIndice]:null;
    return {ok:true,registro:op==='validar'?registroGestao(r,f,alvo):r,revision:atual.revision,repetido:true,feedback};
  }
  if(op!=='reciclar'&&body.formacaoVersao!==f.versao)fail('A formação mudou ou sua versão não foi informada. Atualize o conteúdo antes de continuar.',409);
  if(op==='reciclar'||r.formacaoVersao!==f.versao) {
    if(op==='validar')fail('A formação mudou. O colaborador precisa retomar a versão atual.',409);
    if(op==='reciclar'&&!texto(body.motivo,2000))fail('Informe o motivo e a orientação da reciclagem.');
    r.historico.push({formacaoVersao:r.formacaoVersao,etapas:copy(r.etapas),concluidaEm:r.concluidaEm||null,encerradaEm:agora,motivo:op==='reciclar'?texto(body.motivo,2000):'Nova versão da formação',por:usuario});
    r.etapas={};r.formacaoVersao=f.versao;delete r.concluidaEm;r.reciclagem={em:agora,por:usuario,motivo:op==='reciclar'?texto(body.motivo,2000):'Nova versão da formação'};
  }
  let feedback:any=null;
  if(op!=='reciclar') {
    if(!e)fail('Etapa não disponível.',404);
    if(op==='registrar' && !['abrir','leitura','ciencia','responder','enviarPratica'].includes(body.evento))fail('Atividade inválida.');
    for(const pid of e.prerequisitos||[]) {
      const previa=f.etapas.find((x:any)=>x.id===pid);
      if(r.etapas[pid]?.status!=='concluida'||!previa||await pendenciaFonte(previa))fail('Conclua ou revise os pré-requisitos antes de avançar.',409);
    }
    const falta=await pendenciaFonte(e);if(falta)fail(falta,409);
    const a=r.etapas[e.id] || {status:'nao_iniciada',tentativas:[],pontos:0,versao:f.versao,fontes:copy(e.fontes||[]),documentos:copy(e.documentos||[])};
    const completoAntes=a.status==='concluida';
    if(op==='validar') {
      if(e.tipo!=='pratica'||a.status!=='aguardando_validacao')fail('Não existe prática pendente de validação nesta etapa.',409);
      if(e.quiz?.length&&!a.compreensaoEm)fail('A compreensão desta etapa precisa ser demonstrada antes da prática.',409);
      if(typeof body.aprovado!=='boolean'||!texto(body.feedback,4000))fail('Registre o resultado e uma orientação para a pessoa.');
      a.validacao={por:usuario,nome:String(cracha.nome||usuario),em:agora,aprovado:body.aprovado,feedback:texto(body.feedback,4000),checklist:copy(a.checklist||[])};
      a.validacoes=[...(a.validacoes||[]),copy(a.validacao)];
      a.status=body.aprovado?'concluida':'revisar';feedback=a.validacao;
    } else if(body.evento==='abrir') {a.abertaEm=a.abertaEm||agora;if(a.status==='nao_iniciada')a.status='em_andamento';}
    else if(body.evento==='leitura'||body.evento==='ciencia') {
      for(const ref of e.materiais||[]){const key=await idApr(alvo.colaboradorId,'material:'+ref.id+':'+ref.versao),estudo=await registro('estudos',key);if(!estudo?.registro.leituraEm)fail('Abra e declare o estudo dos materiais integrais vinculados antes de avançar.',409);}

      a.abertaEm=a.abertaEm||agora;a.leituraEm=a.leituraEm||agora;
      if(body.evento==='ciencia') {if(body.aceite!==true)fail('Confirme a ciência desta versão.');a.cienciaEm=a.cienciaEm||agora;}
      if(!completoAntes&&a.status!=='aguardando_validacao')a.status='em_andamento';
    } else if(body.evento==='responder') {
      if(!e.aprovacao?.por||e.aprovacao.versao!==f.versao)fail('A avaliação aguarda revisão e aprovação pelo responsável.',409);
      if(completoAntes)fail('Esta etapa já foi concluída; a tentativa anterior está preservada.',409);
      if(!a.leituraEm)fail('Estude o conteúdo e registre a leitura antes de responder.',409);
      if(!e.quiz?.length)fail('Esta etapa não possui avaliação.');
      if(a.tentativas.length>=e.maxTentativas)fail('As tentativas terminaram. Peça apoio à gestão para revisar e liberar uma nova aprendizagem.',409);
      const answers=body.respostas;
      if(!answers||Array.isArray(answers)||e.quiz.some((q:any)=>!Number.isInteger(answers[q.id])||answers[q.id]<0||answers[q.id]>=q.opcoes.length))fail('Responda todas as perguntas.');
      const corretas=e.quiz.filter((q:any)=>answers[q.id]===q.correta).length,nota=Math.round(corretas/e.quiz.length*100),aprovada=nota>=e.minimoAcerto;
      feedback={nota,aprovada,questoes:e.quiz.map((q:any)=>({id:q.id,acertou:answers[q.id]===q.correta,explicacao:q.explicacao,revisar:q.revisar||e.titulo}))};
      a.tentativas.push({em:agora,nota,aprovada,formacaoVersao:f.versao,avaliacaoAprovadaEm:e.aprovacao.em,fontes:copy(e.fontes||[]),materiais:copy(e.materiais||[]),respostas:copy(answers),feedback});a.compreensaoEm=aprovada?agora:a.compreensaoEm;
      a.status=aprovada?'em_andamento':'revisar';
    } else if(body.evento==='enviarPratica') {
      if(e.tipo!=='pratica')fail('A etapa não é uma prática acompanhada.');
      if(completoAntes||a.status==='aguardando_validacao')fail('Esta prática já foi enviada.',409);
      if(!a.leituraEm || !texto(body.evidencia,10000))fail('Registre a leitura e descreva a execução realizada.');
      if(e.quiz?.length&&!a.compreensaoEm)fail('Demonstre a compreensão desta etapa antes de enviar a prática.',409);
      if(!Array.isArray(body.checklist)||body.checklist.length!==e.checklist.length||body.checklist.some((x:any)=>x!==true))fail('Confira todos os itens da prática antes de enviar.');
      a.evidencia=texto(body.evidencia,10000);a.checklist=copy(body.checklist);a.enviadaEm=agora;a.status='aguardando_validacao';
    }
    if(e.tipo!=='pratica' && a.leituraEm && (!e.quiz?.length || a.compreensaoEm) && (e.tipo!=='etica'||a.cienciaEm))a.status='concluida';
    if(a.status==='concluida'&&!completoAntes) {
      a.concluidaEm=agora;
      const chave=f.id+':'+e.id;
      if(!r.conquistas.some((c:any)=>c.chave===chave)) {a.pontos=e.pontos;r.conquistas.push({chave,titulo:e.titulo,pontos:e.pontos,em:agora,formacaoVersao:f.versao,tipo:e.tipo==='pratica'?'pratica_validada':'etapa_concluida'});}
    }
    r.etapas[e.id]=a;
  }
  r.pontos=r.conquistas.reduce((n:number,c:any)=>n+Number(c.pontos||0),0);
  if(f.etapas.filter((e:any)=>e.obrigatoria!==false).every((e:any)=>r.etapas[e.id]?.status==='concluida'))r.concluidaEm=r.concluidaEm||agora;
  r.eventos.push({id:mutation,assinatura,operacao:op,evento:body.evento||null,etapaId:e?.id||null,ciclo:r.historico.length,tentativaIndice:body.evento==='responder'?r.etapas[e.id].tentativas.length-1:undefined,validacaoIndice:op==='validar'?r.etapas[e.id].validacoes.length-1:undefined,por:usuario,em:agora});r.atualizadoEm=agora;
  const result=await gravar('aprendizagem',r,atual?.revision||0,mutation);
  return {...result,registro:op==='validar'?registroGestao(result.registro,f,alvo):result.registro,feedback};
}

// Biblioteca e registros pessoais separados das evidências de domínio da função.
async function academia(body:any,c:any) {
  const {sb,usuario,admin,gestor,setores,pessoa,cfg,gerencia,registro,todos,pessoasRH,idApr,gravar,fail,id}=c;
  const op=body.operacao.slice(9),agora=new Date().toISOString();
  const obter=async(col:string,key:any)=>{const r=await registro(col,id(key));if(!r||r.apagado)fail('Registro não disponível.',404);return {...r.registro,_serverRevision:r.revision};};
  const escopoInstrutor=cfg.educacao?.instrutores?.[usuario]||[];
  const instrutorNR=(m:any)=>m.tipo==='nr'&&norm(m.nr?.responsavel)===usuario&&escopoInstrutor.map(norm).includes(norm(m.setor));
  const acessoMaterial=async(m:any)=>gerencia(m)||instrutorNR(m)||liberada(m,pessoa,cfg)||m.publicada===true&&m.ativa!==false&&(await todos('formacoes')).some((f:any)=>liberada(f,pessoa,cfg)&&f.etapas.some((e:any)=>(e.materiais||[]).some((ref:any)=>ref.id===m.id&&ref.versao===m.versao)));
  const seguro=(m:any,integral=false)=>{const r=copy(m);if(!gerencia(m)){delete r.liberacao;delete r.versoesAnteriores;}if(!integral)delete r.paginas;r.temPDF=!!m.arquivoPath;delete r.arquivoPath;if(m.youtubeId)r.embed='https://www.youtube-nocookie.com/embed/'+m.youtubeId;return r;};
  const audiencia=async(r:any)=>{
    r.liberacao=r.liberacao||{};
    for(const k of ['pessoas','cargos','setores'])if(!Array.isArray(r.liberacao[k]||[])||(r.liberacao[k]||[]).length>2000||(r.liberacao[k]||[]).some((x:any)=>!texto(x,160)))fail('Público inválido.');
    if(!admin){
      if(r.liberacao.todos)fail('Somente a administração libera para todos.',403);
      if((r.liberacao.setores||[]).some((s:any)=>!setores.map(norm).includes(norm(s))))fail('Setor fora do seu escopo.',403);
      const ps=await pessoasRH();if((r.liberacao.pessoas||[]).some((pid:any)=>!ps.some((p:any)=>p.colaboradorId===pid&&corresponde(p,setores))))fail('Pessoa fora do seu escopo.',403);
      r.liberacao.cargosGestor=usuario;r.liberacao.cargosSetores=copy(setores);
    }else{delete r.liberacao.cargosGestor;delete r.liberacao.cargosSetores;}
  };
  if(op==='biblioteca') {
    const [ms,estudos,ps]=await Promise.all([todos('materiais'),todos('estudos'),pessoasRH()]);const visiveis=[];
    for(const m of ms)if(await acessoMaterial(m))visiveis.push(seguro(m));
    return {ok:true,materiais:visiveis,estudos:estudos.filter((r:any)=>r.colaboradorId===pessoa?.colaboradorId),pessoa,podeGerir:admin||gestor,pessoas:ps.filter((p:any)=>admin||(gestor&&corresponde(p,setores))),atualizadoEm:agora};
  }
  if(op==='salvarMaterial') {
    const m=copy(body.material||{});id(m.id);const anterior=await registro('materiais',m.id);
    if(!gerencia(m)||(anterior&&!gerencia(anterior.registro)))fail('Seu acesso não permite cadastrar este material.',403);
    const mutation=id(body.mutationId);
    if(anterior?.mutation_id===mutation&&anterior.registro.atualizadoPor===usuario)return {ok:true,registro:anterior.registro,revision:anterior.revision};
    if(!texto(m.titulo,200)||!texto(m.versao,40)||!texto(m.setor,200)||!texto(m.objetivo,4000))fail('Informe título, versão, setor e objetivo.');
    if(!['video','texto','documento','nr'].includes(m.tipo))fail('Tipo de material inválido.');
    if(typeof m.publicada!=='boolean'||typeof m.ativa!=='boolean')fail('Informe disponibilidade.');
    if(m.duracaoMinutos!=null&&(!Number.isInteger(m.duracaoMinutos)||m.duracaoMinutos<1||m.duracaoMinutos>10000))fail('Tempo estimado inválido.');
    await audiencia(m);
    delete m.embed;delete m.youtubeId;
    if(m.tipo==='video') {
      let u;try{u=new URL(m.url);}catch{fail('Cole um link válido do YouTube.');}
      if(u.protocol!=='https:'||u.username||u.password)fail('Use um link HTTPS do YouTube.');
      let vid='';
      if(u.hostname==='youtu.be')vid=u.pathname.slice(1);
      else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname))vid=u.pathname==='/watch'?u.searchParams.get('v')||'':/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname)?.[1]||'';
      if(!/^[A-Za-z0-9_-]{11}$/.test(vid))fail('Use o link de um vídeo específico do YouTube.');
      m.youtubeId=vid;m.url='https://www.youtube.com/watch?v='+vid;delete m.paginas;
    }else{
      if(m.url){let u;try{u=new URL(m.url);}catch{fail('Link do documento inválido.');}if(u.protocol!=='https:'||u.username||u.password)fail('Use HTTPS no documento.');}
      if(!Array.isArray(m.paginas||[])||(m.paginas||[]).length>1000||(m.paginas||[]).some((x:any)=>typeof x!=='string'||x.length>30000))fail('Páginas inválidas.');
      if(m.publicada&&!m.url&&!m.paginas?.length&&!anterior?.registro.arquivoPath)fail('Vincule o material integral antes de liberar.');
    }
    if(m.tipo==='nr') {
      const n=m.nr||{};let u;try{u=new URL(n.fonte);}catch{fail('Informe a fonte oficial da NR.');}
      if(u.protocol!=='https:'||u.hostname!=='www.gov.br'||!u.pathname.startsWith('/trabalho-e-emprego/'))fail('Use a fonte oficial do Ministério do Trabalho e Emprego.');
      if(!/^\d{1,2}$/.test(n.numero)||!texto(n.versaoOficial,200)||!texto(n.publico,4000)||!texto(n.responsavel,160))fail('Complete número, versão consultada, público e responsável.');
      if(!Array.isArray(n.requisitos)||!n.requisitos.length||n.requisitos.length>30||n.requisitos.some((s:any)=>!texto(s,500))||new Set(n.requisitos).size!==n.requisitos.length)fail('Cadastre requisitos distintos, definidos pelo responsável.');
      if(n.validadeMeses!=null&&(!Number.isInteger(n.validadeMeses)||n.validadeMeses<1||n.validadeMeses>120))fail('Validade deve ser configurada em meses pelo responsável ou ficar sem definição.');
      if(!(await pessoasRH()).some((p:any)=>norm(p.usuario)===norm(n.responsavel)))fail('O responsável precisa de conta ativa vinculada ao RH.');
    }
    for(const k of ['arquivoPath','arquivoHash','arquivoVersao']){delete m[k];if(anterior?.registro[k])m[k]=anterior.registro[k];}delete m.temPDF;
    const pedag=(x:any)=>({tipo:x.tipo,titulo:x.titulo,objetivo:x.objetivo,url:x.url,paginas:x.paginas,nr:x.nr});
    if(anterior&&!iguais(pedag(m),pedag(anterior.registro))&&m.versao===anterior.registro.versao)fail('Informe nova versão ao alterar o conteúdo. O histórico será preservado.',409);
    m.versoesAnteriores=copy(anterior?.registro.versoesAnteriores||[]);
    if(anterior&&m.versao!==anterior.registro.versao){if(m.versoesAnteriores.some((v:any)=>v.versao===m.versao))fail('Versão já utilizada.',409);const v=copy(anterior.registro);delete v.versoesAnteriores;m.versoesAnteriores.push(v);}
    delete m._serverRevision;delete m.pontos;m.atualizadoPor=usuario;m.atualizadoEm=agora;
    if(body.expectedRevision!==(anterior?.revision||0))fail('Material mudou. Atualize antes de salvar.',409);
    return gravar('materiais',m,anterior?.revision||0,mutation);
  }
  if(op==='abrirMaterial'||op==='registrarMaterial') {
    const m=await obter('materiais',body.materialId);if(!await acessoMaterial(m))fail('Material não liberado para sua conta.',403);
    if(op==='abrirMaterial')return {ok:true,material:seguro(m,true)};
    if(!pessoa)fail('Vincule sua conta ao RH para registrar o estudo.',403);
    if(!liberada(m,pessoa,cfg)&&!((await todos('formacoes')).some((f:any)=>liberada(f,pessoa,cfg)&&f.etapas.some((e:any)=>(e.materiais||[]).some((r:any)=>r.id===m.id&&r.versao===m.versao)))))fail('Estudo não liberado para você.',403);
    if(body.versao!==m.versao)fail('O material mudou. Abra a versão atual.',409);
    const key=await idApr(pessoa.colaboradorId,'material:'+m.id+':'+m.versao),ant=await registro('estudos',key),mutation=id(body.mutationId);
    const r=ant?copy(ant.registro):{id:key,colaboradorId:pessoa.colaboradorId,nome:pessoa.nome,materialId:m.id,titulo:m.titulo,versao:m.versao,eventos:[]};
    const assinatura=estavel({evento:body.evento,pagina:body.pagina??null,usuario});
    const repetido=r.eventos.find((e:any)=>e.id===mutation);if(repetido){if(repetido.assinatura!==assinatura)fail('Envio pertence a outra atividade.',409);return {ok:true,registro:r,revision:ant.revision};}
    if(body.evento==='abrir')r.abertaEm=r.abertaEm||agora;
    else if(body.evento==='leitura'){if(!r.abertaEm)fail('Abra o material antes de declarar seu estudo.',409);r.leituraEm=r.leituraEm||agora;}
    else if(body.evento==='pagina'){if(!r.abertaEm)fail('Abra o material antes de marcar a página.',409);if(!Number.isInteger(body.pagina)||body.pagina<1||body.pagina>(m.paginas?.length||(m.arquivoPath?10000:1)))fail('Página inválida.');r.pagina=body.pagina;}
    else fail('Atividade de estudo inválida.');
    r.eventos.push({id:mutation,assinatura,evento:body.evento,em:agora});r.atualizadoEm=agora;return gravar('estudos',r,ant?.revision||0,mutation);
  }
  if(op==='enviarPDF'||op==='arquivoPDF') {
    const m=await obter('materiais',body.materialId);
    if(op==='arquivoPDF') {
      if(!await acessoMaterial(m))fail('Documento não liberado para sua conta.',403);
      if(!m.arquivoPath)fail('PDF não disponível.',404);
      const download=await sb.storage.from('pops-escola-documentos').download(m.arquivoPath);
      if(download.error||!download.data)fail('Não foi possível abrir o documento. Tente novamente.',503);
      const bytes=new Uint8Array(await download.data.arrayBuffer());let bin='';for(let i=0;i<bytes.length;i+=8192)bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return {ok:true,base64:btoa(bin),mime:'application/pdf',titulo:m.titulo,versao:m.versao};
    }
    if(!gerencia(m))fail('Somente a gestão responsável pode anexar documentos.',403);
    if(m.tipo==='video')fail('Este material é um vídeo. Cadastre um documento separado.');
    if(typeof body.base64!=='string'||body.base64.length>34_000_000||!body.base64)fail('Envie um PDF de até 25 MB.');
    let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(body.base64),(c:string)=>c.charCodeAt(0));}catch{fail('Arquivo inválido.');}
    if(bytes.length>25_000_000||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')fail('O arquivo precisa ser um PDF válido de até 25 MB.');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
    const mutation=id(body.mutationId),old=await registro('materiais',m.id);
    if(old.mutation_id===mutation&&m.arquivoHash===hash&&m.atualizadoPor===usuario)return {ok:true,registro:m,revision:m._serverRevision};
    if(body.versao!==m.versao||body.expectedRevision!==m._serverRevision)fail('O material mudou. Confira a versão antes de anexar.',409);
    if(m.arquivoHash&&m.arquivoHash!==hash&&m.arquivoVersao===m.versao)fail('Crie uma nova versão antes de substituir o PDF original.',409);
    const path=m.id+'/'+hash+'.pdf',up=await sb.storage.from('pops-escola-documentos').upload(path,bytes,{contentType:'application/pdf',upsert:false});
    if(up.error&&String(up.error.statusCode)!=='409')fail('O arquivo não foi confirmado no servidor. Tente novamente.',503);
    const rev=m._serverRevision;delete m._serverRevision;m.arquivoPath=path;m.arquivoHash=hash;m.arquivoVersao=m.versao;m.atualizadoPor=usuario;m.atualizadoEm=agora;
    return gravar('materiais',m,rev,mutation);
  }
  if(op==='capacitacoes') {
    const [ms,rs,ps]=await Promise.all([todos('materiais'),todos('capacitacoes'),pessoasRH()]);
    const vis=ms.filter((m:any)=>m.tipo==='nr'&&(gerencia(m)||instrutorNR(m)||liberada(m,pessoa,cfg)));
    const pendencias=vis.flatMap((m:any)=>ps.filter((p:any)=>liberada(m,p,cfg)&&(p.colaboradorId===pessoa?.colaboradorId||admin||gerencia(m)&&corresponde(p,setores)||instrutorNR(m)&&corresponde(p,escopoInstrutor))).flatMap((p:any)=>{const r=rs.find((r:any)=>r.materialId===m.id&&r.colaboradorId===p.colaboradorId);const situacao=!r?'Não iniciado':r.versao!==m.versao?'Revisão de versão necessária':r.vencimento&&r.vencimento<agora.slice(0,10)?'Reciclagem vencida':r.status!=='concluida'?'Etapas pendentes':'';return situacao?[{materialId:m.id,colaboradorId:p.colaboradorId,nome:p.nome,titulo:m.titulo,situacao}]:[];}));
    return {ok:true,pendencias,normas:vis.map((m:any)=>({...seguro(m),podeRegistrar:gerencia(m)||instrutorNR(m)})),pessoas:ps.filter((p:any)=>admin||(gestor&&corresponde(p,setores))||vis.some((m:any)=>instrutorNR(m)&&corresponde(p,escopoInstrutor)&&liberada(m,p,cfg))),registros:rs.filter((r:any)=>r.colaboradorId===pessoa?.colaboradorId||(vis.some((m:any)=>m.id===r.materialId&&(gerencia(m)||instrutorNR(m)))&&(admin||ps.some((p:any)=>p.colaboradorId===r.colaboradorId&&(gestor&&corresponde(p,setores)||vis.some((m:any)=>m.id===r.materialId&&instrutorNR(m)&&corresponde(p,escopoInstrutor))))))),podeGerir:admin||gestor,pessoa};
  }
  if(op==='salvarCapacitacao') {
    const m=await obter('materiais',body.materialId);
    if(!gerencia(m)&&!instrutorNR(m))fail('Somente a gestão ou o instrutor autorizado registra a capacitação.',403);
    if(m.tipo!=='nr'||!m.nr?.requisitos?.length)fail('Configure os requisitos desta NR antes de registrar.');
    const p=(await pessoasRH()).find((p:any)=>p.colaboradorId===body.colaboradorId);
    if(!p||(!admin&&!(gerencia(m)&&corresponde(p,setores))&&!(instrutorNR(m)&&corresponde(p,escopoInstrutor))))fail('Aluno fora do seu escopo.',403);
    if(!liberada(m,p,cfg))fail('Atribua esta NR ao aluno antes de registrar a capacitação.',409);
    const key=await idApr(p.colaboradorId,'nr:'+m.id),anterior=await registro('capacitacoes',key),mutation=id(body.mutationId);
    if(anterior?.mutation_id===mutation&&anterior.registro.atualizadoPor===usuario)return {ok:true,registro:anterior.registro,revision:anterior.revision};
    if(body.expectedRevision!==(anterior?.revision||0))fail('Registro mudou. Atualize antes de salvar.',409);
    if(anterior?.registro.status==='concluida'&&(!body.novoCiclo||!texto(body.motivo,2000)))fail('A conclusão está preservada. Inicie uma reciclagem com motivo para novo registro.',409);
    if(!Array.isArray(body.etapas)||body.etapas.length!==m.nr.requisitos.length||body.etapas.some((e:any,i:number)=>e.titulo!==m.nr.requisitos[i]||typeof e.cumprida!=='boolean'||(e.cumprida&&!texto(e.evidencia,4000))))fail('Registre a evidência de cada requisito cumprido.');
    if(body.concluir&&body.etapas.some((e:any)=>!e.cumprida))fail('Existem etapas pendentes; a capacitação ainda não pode ser concluída.',409);
    if(body.concluir&&(!pessoa||pessoa.colaboradorId===p.colaboradorId||norm(m.nr.responsavel)!==usuario))fail('A conclusão exige o responsável configurado e não pode ser uma autovalidação.',403);
    const data=String(body.dataRealizacao||'');
    if(body.concluir&&(!/^\d{4}-\d{2}-\d{2}$/.test(data)||isNaN(Date.parse(data))||new Date(data+'T12:00:00Z').toISOString().slice(0,10)!==data||data>agora.slice(0,10)))fail('Informe a data real de conclusão, sem data futura.');
    const documentos=body.documentos||[];if(!Array.isArray(documentos)||documentos.length>30)fail('Documentos inválidos.');
    for(const doc of documentos){let u;try{u=new URL(doc.url);}catch{fail('Link do comprovante inválido.');}if(u.protocol!=='https:'||u.username||u.password||!texto(doc.titulo,200))fail('Informe título e link HTTPS do comprovante.');}
    const historico=copy(anterior?.registro.historico||[]);if(body.novoCiclo&&anterior){const old=copy(anterior.registro);delete old.historico;historico.push({...old,motivoReciclagem:texto(body.motivo,2000)});}
    let vencimento=null;if(body.concluir&&m.nr.validadeMeses){const dt=new Date(data+'T12:00:00Z'),dia=dt.getUTCDate();dt.setUTCDate(1);dt.setUTCMonth(dt.getUTCMonth()+m.nr.validadeMeses);const fim=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate();dt.setUTCDate(Math.min(dia,fim));vencimento=dt.toISOString().slice(0,10);}
    const r={id:key,colaboradorId:p.colaboradorId,nome:p.nome,materialId:m.id,titulo:m.titulo,versao:m.versao,nr:copy(m.nr),etapas:copy(body.etapas),documentos:copy(documentos),status:body.concluir?'concluida':'pendente',dataRealizacao:body.concluir?data:null,vencimento,validadoPor:body.concluir?usuario:null,validadoEm:body.concluir?agora:null,historico,atualizadoPor:usuario,atualizadoEm:agora};
    return gravar('capacitacoes',r,anterior?.revision||0,mutation);
  }
  if(op==='salvarInstrumento') {
    if(!admin)fail('Somente a administração cadastra instrumentos e suas permissões.',403);
    const r=copy(body.instrumento||{});id(r.id);const anterior=await registro('instrumentos',r.id),mutation=id(body.mutationId);
    if(anterior?.mutation_id===mutation&&anterior.registro.atualizadoPor===usuario)return {ok:true,registro:anterior.registro,revision:anterior.revision};
    for(const k of ['titulo','objetivo','instrucoes','versao','setor','metodologia','autorizacao'])if(!texto(r[k],k==='titulo'?200:4000))fail('Complete objetivo, instruções, metodologia, autorização, setor e versão.');
    await audiencia(r);
    if(!Array.isArray(r.visibilidade)||r.visibilidade.length>30)fail('Defina quem poderá consultar os resultados.');
    const ps=await pessoasRH();if(r.visibilidade.some((pid:any)=>!ps.some((p:any)=>p.colaboradorId===pid)))fail('Selecione responsáveis ativos do RH.');
    if(!Array.isArray(r.escala)||r.escala.length<2||r.escala.length>7||r.escala.some((o:any)=>!texto(o,500)))fail('Defina entre duas e sete alternativas ordenadas.');
    if(!Array.isArray(r.dimensoes)||r.dimensoes.length<1||r.dimensoes.length>15)fail('Defina as dimensões do instrumento.');
    const dims=new Set();for(const d of r.dimensoes){id(d.id);if(dims.has(d.id)||!texto(d.titulo,200)||!texto(d.forte,4000)||!texto(d.desenvolver,4000)||!Array.isArray(d.recomendacoes||[])||(d.recomendacoes||[]).some((x:any)=>!texto(x,2000)))fail('Complete as orientações de cada dimensão.');dims.add(d.id);}
    if(!Array.isArray(r.questoes)||!r.questoes.length||r.questoes.length>80)fail('Cadastre entre uma e oitenta perguntas.');
    const qs=new Set();for(const q of r.questoes){id(q.id);if(qs.has(q.id)||!texto(q.texto,2000)||!dims.has(q.dimensao)||(q.inversa!=null&&typeof q.inversa!=='boolean'))fail('Pergunta ou dimensão inválida.');qs.add(q.id);}
    if(r.dimensoes.some((d:any)=>!r.questoes.some((q:any)=>q.dimensao===d.id)))fail('Cada dimensão precisa de perguntas.');
    if(r.duracaoMinutos!=null&&(!Number.isInteger(r.duracaoMinutos)||r.duracaoMinutos<1||r.duracaoMinutos>10000))fail('Tempo estimado inválido.');
    delete r.liberadaParaMim;delete r.consultores;r.formula='media_normalizada_por_dimensao_v1';
    const pedagogia=(x:any)=>({objetivo:x.objetivo,instrucoes:x.instrucoes,metodologia:x.metodologia,autorizacao:x.autorizacao,escala:x.escala,dimensoes:x.dimensoes,questoes:x.questoes});
    const mudou=!anterior||!iguais(pedagogia(r),pedagogia(anterior.registro));
    if(anterior&&mudou&&r.versao===anterior.registro.versao)fail('Altere a versão ao mudar o instrumento.',409);
    delete r.aprovacao;if(!mudou&&r.versao===anterior?.registro.versao&&anterior?.registro.aprovacao)r.aprovacao=copy(anterior.registro.aprovacao);
    r.versoesAnteriores=copy(anterior?.registro.versoesAnteriores||[]);if(anterior&&r.versao!==anterior.registro.versao){if(r.versoesAnteriores.some((v:any)=>v.versao===r.versao))fail('Versão já utilizada.',409);const old=copy(anterior.registro);delete old.versoesAnteriores;r.versoesAnteriores.push(old);}
    if(body.expectedRevision!==(anterior?.revision||0))fail('Instrumento mudou. Atualize.',409);
    delete r._serverRevision;r.atualizadoPor=usuario;r.atualizadoEm=agora;return gravar('instrumentos',r,anterior?.revision||0,mutation);
  }
  if(op==='aprovarInstrumento') {
    if(!admin)fail('A aprovação exige administração autorizada.',403);
    const r=await obter('instrumentos',body.instrumentoId);
    if(!texto(body.parecer,4000))fail('Registre a conferência da metodologia, autorização e finalidade.');
    const mutation=id(body.mutationId);if(r.aprovacao?.mutationId===mutation&&r.aprovacao.por===usuario)return {ok:true,registro:r,revision:r._serverRevision};
    if(body.expectedRevision!==r._serverRevision)fail('Instrumento mudou. Revise a versão atual.',409);
    const revision=r._serverRevision;delete r._serverRevision;r.aprovacao={por:usuario,em:agora,parecer:texto(body.parecer,4000),versao:r.versao,mutationId:mutation};return gravar('instrumentos',r,revision,mutation);
  }
  if(op==='perfis') {
    const [ins,rs,ps]=await Promise.all([todos('instrumentos'),todos('perfis'),pessoasRH()]);
    const vis=ins.filter((r:any)=>admin||(liberada(r,pessoa,cfg)&&r.aprovacao?.versao===r.versao));
    return {ok:true,pessoa,podeGerir:admin,pessoas:admin?ps:[],instrumentos:vis.map((r:any)=>{const x=copy(r);x.liberadaParaMim=liberada(r,pessoa,cfg);x.consultores=(x.visibilidade||[]).map((id:string)=>ps.find((p:any)=>p.colaboradorId===id)?.nome||'Responsável autorizado');if(!admin){delete x.liberacao;delete x.versoesAnteriores;}return x;}),resultados:rs.filter((r:any)=>r.colaboradorId===pessoa?.colaboradorId||!!pessoa&&ins.some((i:any)=>i.id===r.instrumentoId&&(i.visibilidade||[]).includes(pessoa.colaboradorId)))};
  }
  if(op==='responderPerfil') {
    if(!pessoa)fail('Vincule sua conta ao RH.',403);
    const i=await obter('instrumentos',body.instrumentoId);
    if(!liberada(i,pessoa,cfg))fail('Instrumento não atribuído à sua conta.',403);
    if(i.aprovacao?.versao!==i.versao)fail('O instrumento aguarda revisão e aprovação.',409);
    if(body.versao!==i.versao)fail('O instrumento mudou. Confira a versão atual.',409);
    if(body.ciente!==true)fail('Confirme que compreendeu a finalidade e quem consulta os resultados.');
    const respostas=body.respostas;if(!respostas||Array.isArray(respostas)||i.questoes.some((q:any)=>!Number.isInteger(respostas[q.id])||respostas[q.id]<0||respostas[q.id]>=i.escala.length))fail('Responda todas as perguntas.');
    const mutation=id(body.mutationId),key=await idApr(pessoa.colaboradorId,'perfil:'+i.id+':'+mutation),old=await registro('perfis',key),assinatura=estavel({respostas,versao:i.versao});
    if(old){if(old.registro.assinatura!==assinatura)fail('Este envio já foi usado em outra resposta.',409);return {ok:true,registro:old.registro,revision:old.revision};}
    const max=i.escala.length-1;
    const resultado=i.dimensoes.map((d:any)=>{const qs=i.questoes.filter((q:any)=>q.dimensao===d.id);const percentual=Math.round(qs.reduce((s:number,q:any)=>s+(q.inversa?max-respostas[q.id]:respostas[q.id]),0)/(qs.length*max)*100);return {dimensao:d.id,titulo:d.titulo,percentual,orientacao:percentual>=67?d.forte:d.desenvolver,recomendacoes:copy(d.recomendacoes||[])};});
    const instrumento=copy(i);delete instrumento.versoesAnteriores;delete instrumento.liberacao;delete instrumento._serverRevision;
    return gravar('perfis',{id:key,colaboradorId:pessoa.colaboradorId,nome:pessoa.nome,instrumentoId:i.id,titulo:i.titulo,versao:i.versao,instrumento,respostas:copy(respostas),resultado,assinatura,cienteEm:agora,em:agora},0,mutation);
  }
  fail('Operação da escola não disponível.');
}
