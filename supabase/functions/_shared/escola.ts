// A escola usa comandos autenticados. Nenhum formulário pode escolher identidade,
// fabricar progresso, liberar uma prática ou escrever pontos diretamente.
const norm = (v: any) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const copy = (v: any) => JSON.parse(JSON.stringify(v));
const tipos = ['cultura', 'etica', 'caderno', 'pop', 'pratica', 'avaliacao', 'continua'];
const texto = (v: any, max = 4000) => typeof v === 'string' && v.trim().length <= max ? v.trim() : '';
const estavel = (v: any): string => Array.isArray(v) ? '[' + v.map(estavel).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}' : JSON.stringify(v);
const iguais = (a: any, b: any) => estavel(a) === estavel(b);
const camposPedagogicos = (f: any) => ({ titulo: f.titulo, etapas: f.etapas });
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
    if(['etica','caderno','pop'].includes(e.tipo) && !(e.fontes?.length || e.documentos?.length))return 'Falta vincular o documento oficial desta etapa.';
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
      if(!privado)e.quiz=(e.quiz||[]).map(({correta,explicacao,revisar,...q}:any)=>q);
    }
    if(!privado){delete res.liberacao;delete res.versoesAnteriores;}
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
      a.abertaEm=a.abertaEm||agora;a.leituraEm=a.leituraEm||agora;
      if(body.evento==='ciencia') {if(body.aceite!==true)fail('Confirme a ciência desta versão.');a.cienciaEm=a.cienciaEm||agora;}
      if(!completoAntes&&a.status!=='aguardando_validacao')a.status='em_andamento';
    } else if(body.evento==='responder') {
      if(completoAntes)fail('Esta etapa já foi concluída; a tentativa anterior está preservada.',409);
      if(!a.leituraEm)fail('Estude o conteúdo e registre a leitura antes de responder.',409);
      if(!e.quiz?.length)fail('Esta etapa não possui avaliação.');
      if(a.tentativas.length>=e.maxTentativas)fail('As tentativas terminaram. Peça apoio à gestão para revisar e liberar uma nova aprendizagem.',409);
      const answers=body.respostas;
      if(!answers||Array.isArray(answers)||e.quiz.some((q:any)=>!Number.isInteger(answers[q.id])||answers[q.id]<0||answers[q.id]>=q.opcoes.length))fail('Responda todas as perguntas.');
      const corretas=e.quiz.filter((q:any)=>answers[q.id]===q.correta).length,nota=Math.round(corretas/e.quiz.length*100),aprovada=nota>=e.minimoAcerto;
      feedback={nota,aprovada,questoes:e.quiz.map((q:any)=>({id:q.id,acertou:answers[q.id]===q.correta,explicacao:q.explicacao,revisar:q.revisar||e.titulo}))};
      a.tentativas.push({em:agora,nota,aprovada,respostas:copy(answers),feedback});a.compreensaoEm=aprovada?agora:a.compreensaoEm;
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
