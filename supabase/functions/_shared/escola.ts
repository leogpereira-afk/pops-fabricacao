// A escola usa comandos autenticados. Nenhum formulário pode escolher identidade,
// fabricar progresso, liberar uma prática ou escrever pontos diretamente.
const norm = (v: any) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const copy = (v: any) => JSON.parse(JSON.stringify(v));
// 'aula' é conteúdo próprio da escola, inclusive aula de sistema (o ERP, por
// exemplo): conclui por leitura e, se tiver avaliação, por compreensão. Não
// depende de POP nem de treinamento como fonte; documentos e materiais são opcionais.
const tipos = ['cultura', 'etica', 'caderno', 'pop', 'pratica', 'avaliacao', 'continua', 'aula'];
const texto = (v: any, max = 4000) => typeof v === 'string' && v.trim().length <= max ? v.trim() : '';
// Catálogo organiza o curso (trilha, área, nível, carga, ordem); não muda o que
// se aprende, por isso fica fora dos campos pedagógicos e não pede versão nova.
const kebab = (v: any, max = 80) => typeof v === 'string' && v.length <= max && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const idFormato = (v: any) => typeof v === 'string' && /^[a-zA-Z0-9._:-]{1,160}$/.test(v);
const inteiro = (v: any, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
const objeto = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const niveis = ['essencial', 'intermediario', 'avancado'];
const catalogoCfg = (cfg: any) => { const c = cfg?.educacao?.catalogo; return { familias: objeto(c?.familias) ? c.familias : {}, trilhas: objeto(c?.trilhas) ? c.trilhas : {} }; };
// Família é uma lista de cargos do RH mantida pela administração: quem muda de
// cargo no RH entra ou sai da família sem ninguém editar a formação.
const familiaTem = (cfg: any, fam: any, cargoId: any) => {
  const fs = catalogoCfg(cfg).familias;
  return !!cargoId && typeof fam === 'string' && Object.hasOwn(fs, fam) && Array.isArray(fs[fam]?.cargos) && fs[fam].cargos.includes(cargoId);
};
const estavel = (v: any): string => Array.isArray(v) ? '[' + v.map(estavel).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}' : JSON.stringify(v);
const iguais = (a: any, b: any) => estavel(a) === estavel(b);
const limparEtapa = (e:any) => {const r=copy(e);for(const k of ['aprovacao','avaliacaoPendente','status','statusFonte','motivoBloqueio'])delete r[k];return r;};
const camposPedagogicos = (f: any) => ({ titulo: f.titulo, etapas: f.etapas.map(limparEtapa) });
const corresponde = (p: any, setores: any[]) => setores.map(norm).some(s => s && [p?.setor, p?.area, p?.areaId].map(norm).includes(s));
const liberada = (f: any, p: any, cfg: any) => {
  if(!p || f.ativa===false || f.publicada!==true)return false;
  const l=f.liberacao||{};
  const porCargo=(l.cargos||[]).includes(p.cargoId) && (!l.cargosGestor || (corresponde(p,l.cargosSetores||[]) && corresponde(p,cfg.gestores?.[l.cargosGestor]||[])));
  const porFamilia=(Array.isArray(l.familias)?l.familias:[]).some((fam:any)=>familiaTem(cfg,fam,p.cargoId));
  return l.todos===true || (l.pessoas||[]).includes(p.colaboradorId) || porCargo || porFamilia || corresponde(p,l.setores||[]);
};
// O cadastro do RH (fichas, cargos, áreas e vagas) é o mesmo para todos e muda
// pouco. Guardado por até 60 s nesta instância da função, poupa leituras inteiras
// das tabelas a cada tela. Só entram projeções sem dado sensível; quem chama
// continua conferido na hora (identidadeRH), e gravar configuração limpa tudo.
const RH_VALIDADE_MS = 60_000;
const cacheRH = new Map<string, { em: number; valor: Promise<any[]> }>();
const CAMPOS_RH: Record<string, string> = {
  colaboradores: 'id,nome:registro->>nome,cargoId:registro->>cargoId,areaId:registro->>areaId,setor:registro->>setor,statusId:registro->>statusId,dataDesligamento:registro->>dataDesligamento,cargoLivre:registro->>cargoLivre,funcao:registro->>funcao',
  // Nunca faixas nem salário praticado do cargo; nunca candidatos da vaga.
  cargos: 'id,nome:registro->>nome,areaId:registro->>areaId,trilha:registro->>trilha',
  areas: 'id,nome:registro->>nome',
  // divulgacaoInterna só serve para filtrar quem não é administração; não sai na resposta.
  vagas: 'id,titulo:registro->>titulo,nome:registro->>nome,cargoId:registro->>cargoId,areaId:registro->>areaId,status:registro->>status,nivelId:registro->>nivelId,divulgacaoInterna:registro->>divulgacaoInterna',
};
const lerRH = (sb: any, conferir: any, colecao: string): Promise<any[]> => {
  const agora = Date.now(), salvo = cacheRH.get(colecao);
  if (salvo && agora - salvo.em < RH_VALIDADE_MS) return salvo.valor;
  const campos = CAMPOS_RH[colecao].split(',').map(c => c.split(':')[0]);
  const valor = (async () => {
    const out: any[] = []; let de = 0;
    for (;;) {
      const rows = conferir(await sb.from('registros').select(CAMPOS_RH[colecao]).eq('colecao', colecao).eq('apagado', false).order('id').range(de, de + 499));
      // Lista fechada de campos: mesmo que a consulta traga o registro inteiro,
      // nada além da projeção sai daqui.
      for (const row of rows) { const o: any = {}; for (const k of campos) o[k] = k === 'id' ? row.id : (row[k] ?? row.registro?.[k] ?? null); out.push(o); }
      if (rows.length < 500) return out;
      de += 500;
    }
  })();
  cacheRH.set(colecao, { em: agora, valor });
  // Leitura que falhou não fica guardada: a próxima chamada tenta de novo.
  valor.catch(() => { if (cacheRH.get(colecao)?.valor === valor) cacheRH.delete(colecao); });
  return valor;
};
// Operações da escola que o crachá do aluno alcança: a visão de aluno do painel,
// o registro do próprio aprendizado, a biblioteca liberada para ele e as NRs e o
// perfil dele. Qualquer outra (salvar, aprovar, validar, reciclar, configurar,
// cadastrar material, instrumento ou capacitação, anexar PDF) é recusada.
const OPS_ALUNO = new Set(['painel', 'registrar', 'academia.biblioteca', 'academia.abrirMaterial', 'academia.registrarMaterial', 'academia.arquivoPDF', 'academia.capacitacoes', 'academia.perfis', 'academia.responderPerfil']);
// Entrada do aluno na configuração: ausente vale como LIGADA ("já faz
// automático"), validade de 1 a 30 dias, 7 por padrão. Uma regra só: o pops-sync
// usa esta mesma função para conferir o crachá do aluno a cada chamada.
export const entradaAlunoCfg = (cfg: any) => {
  const e = cfg?.educacao?.entradaAluno, dias = e?.validadeDias;
  return { ativa: e?.ativa !== false, validadeDias: Number.isInteger(dias) && dias >= 1 && dias <= 30 ? dias : 7,
    ...(typeof e?.ligadaEm === 'string' ? { ligadaEm: e.ligadaEm } : {}), ...(typeof e?.atualizadoEm === 'string' ? { atualizadoEm: e.atualizadoEm, atualizadoPor: String(e.atualizadoPor || '') } : {}) };
};
export async function escola(body: any, ctx: any) {
  const { sb, cracha, maquina, identidadeRH, config, conferir, Falha } = ctx;
  const fail = (m: string, s = 400): never => { throw new Falha(m, s); };
  // Cache desta requisição: cada registro, coleção e leitura do RH é feito uma
  // vez por chamada, mesmo que várias formações apontem para o mesmo material.
  // Morre com a requisição, então nada de uma pessoa chega à chamada de outra.
  const lidos = new Map<string, Promise<any>>();
  const lembrar = (chave: string, ler: () => Promise<any>): Promise<any> => {
    let p = lidos.get(chave);
    if (!p) { p = ler(); lidos.set(chave, p); p.catch(() => { if (lidos.get(chave) === p) lidos.delete(chave); }); }
    return p;
  };
  const registro = (col: string, rid: string) => lembrar('r:' + col + ':' + rid, () => ctx.registro(col, rid));
  if (maquina || !cracha) fail('Entre com sua conta pessoal para acessar a escola.', 401);
  // Aluno (entrada pelo ID do RH e primeiro nome): só o próprio aprendizado, antes
  // de qualquer leitura. Nunca gestão, configuração, validação ou cadastro.
  const aluno = cracha.papel === 'aluno';
  if (aluno && !OPS_ALUNO.has(String(body.operacao || 'painel'))) fail('A entrada de aluno não permite esta operação.', 403);
  const usuario = norm(cracha.sub), admin = cracha.papel === 'admin';
  const cfg = await config(), setores = aluno ? [] : cfg.gestores?.[usuario] || [];
  const gestor = cracha.papel === 'gestor' && Array.isArray(setores) && setores.length > 0;
  const gerencia = (f: any) => admin || (gestor && setores.map(norm).includes(norm(f.setor)));
  const identidade = await identidadeRH(cracha), pessoa = identidade.vinculada ? identidade.pessoa : null;
  const id = (v: any) => { if (typeof v !== 'string' || !/^[a-zA-Z0-9._:-]{1,160}$/.test(v)) fail('Identificador inválido.'); return v; };
  const todos = (col: string) => lembrar('t:' + col, async () => {
    const out: any[] = []; let de = 0;
    for (;;) {
      const rows = conferir(await sb.from('pops_registros').select('id,registro,revision,apagado').eq('colecao', col).eq('apagado', false).order('id').range(de, de + 499));
      out.push(...rows.map((r: any) => ({ ...r.registro, _serverRevision: r.revision })));
      if (rows.length < 500) return out;
      de += 500;
    }
  });
  const pessoasRH = () => lembrar('pessoasRH', async () => {
    // Projeção sem campo sensível na fronteira do banco (CAMPOS_RH).
    const [fichas, areasRH, cargosRH] = await Promise.all(['colaboradores', 'areas', 'cargos'].map(c => lerRH(sb, conferir, c)));
    const out: any[] = [];
    for (const r of fichas) {
      if (r.dataDesligamento || ['inativo','abandono'].includes(r.statusId)) continue;
      out.push({ id:'p-'+r.id, colaboradorId:r.id, nome:r.nome || '', cargoId:r.cargoId || '', areaId:r.areaId || '', setor:r.setor || '', funcao:r.cargoLivre || r.funcao || '', area:'' });
    }
    const areas = new Map<string,string>(areasRH.map((r:any) => [r.id, r.nome || ''])), cargos = new Map<string,string>(cargosRH.map((r:any) => [r.id, r.nome || '']));
    // Contas e papéis são da Central de Acessos: lidos a cada requisição, sem cache da instância.
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
  });
  // Catálogo do RH para quem monta a grade: todos os cargos, inclusive os que
  // ainda não têm ninguém, e as vagas vivas. Somente leitura, sem pessoa nenhuma.
  const nomesAreas = () => lembrar('areasRH', async () => new Map<string,string>((await lerRH(sb, conferir, 'areas')).map((a:any) => [a.id, a.nome || ''])));
  const porNome = (a:any, b:any) => String(a.nome || a.titulo).localeCompare(String(b.nome || b.titulo), 'pt-BR') || String(a.id).localeCompare(String(b.id));
  const cargosRH = () => lembrar('cargosRH', async () => {
    const [cs, areas] = await Promise.all([lerRH(sb, conferir, 'cargos'), nomesAreas()]);
    const fams = catalogoCfg(cfg).familias;
    return cs.map((c:any) => ({ id:c.id, nome:c.nome || '', areaId:c.areaId || '', area:areas.get(c.areaId) || '', trilha:c.trilha || '', familias:Object.keys(fams).filter(k => familiaTem(cfg, k, c.id)) })).sort(porNome);
  });
  const vagasRH = () => lembrar('vagasRH', async () => {
    const [vs, areas] = await Promise.all([lerRH(sb, conferir, 'vagas'), nomesAreas()]);
    // Vaga fechada ou cancelada não forma ninguém; prevista, aberta e em triagem sim.
    // No RH, a tela de vagas é só do RH e o mural mostra só as vagas divulgadas:
    // gestor de qualquer setor vê aqui só as divulgadas e abertas (aberta ou em
    // triagem). Vaga prevista ou não divulgada (a substituição planejada de alguém,
    // por exemplo) fica com a administração. ->> devolve texto: 'true' ou true.
    const divulgada = (v:any) => v.divulgacaoInterna === true || v.divulgacaoInterna === 'true';
    return vs.filter((v:any) => admin ? !['fechada', 'cancelada'].includes(norm(v.status)) : divulgada(v) && ['aberta', 'em triagem'].includes(norm(v.status)))
      .map((v:any) => ({ id:v.id, titulo:v.titulo || v.nome || '', cargoId:v.cargoId || '', areaId:v.areaId || '', area:areas.get(v.areaId) || '', status:v.status || '', nivelId:v.nivelId || '' })).sort(porNome);
  });
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
  // Cópia integral: o registro lido fica no cache da requisição e não pode ser
  // alterado por quem vai editar a formação antes de gravar.
  const getF = async (fid:any) => { const r=await registro('formacoes',id(fid));if(!r||r.apagado)fail('Curso não disponível.',404);return {...copy(r.registro),_serverRevision:r.revision}; };
  const getP = async (pid:any) => { const ps=await pessoasRH();const p=ps.find(x=>x.colaboradorId===id(pid));if(!p)fail('Pessoa não disponível no RH.',404);return p; };
  const idApr = async (pid:string,fid:string) => 'ap-'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pid+'\n'+fid)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const gravar = async (col:string,r:any,revision:number,mutation:string) => {
    if(JSON.stringify(r).length>500_000)fail('O histórico atingiu o limite. A gestão deve preparar um curso novo; nenhum registro foi apagado.',409);
    const res=await sb.rpc('pops_gravar',{p_colecao:col,p_id:r.id,p_registro:r,p_acao:'upsert',p_expected:revision,p_mutation:mutation});
    // Depois de gravar, a próxima leitura desta requisição vai ao banco.
    lidos.delete('r:'+col+':'+r.id);lidos.delete('t:'+col);
    if(res.error?.code==='40001')fail('O registro mudou em outro aparelho. Atualize e tente novamente; sua resposta continua disponível.',409);
    return conferir(res);
  };
  const pendenciaFonte = async (e:any) => {
    if(e.preparacaoPendente) return 'Conteúdo em preparação pela gestão.';
    if(!e.conteudo || ['aprender','importancia','comoFazer','erros','evidencia'].some(k=>!texto(e.conteudo[k],20000)))return 'A orientação desta aula ainda precisa ser preparada.';
    if(['etica','caderno','pop'].includes(e.tipo) && !(e.fontes?.length || e.documentos?.length || e.materiais?.length))return 'Falta vincular o documento oficial desta aula.';
    // Busca materiais e fontes ao mesmo tempo (e uma vez só, pelo cache da
    // requisição); as conferências abaixo seguem na mesma ordem de antes.
    await Promise.all([...(e.materiais||[]).map((ref:any)=>registro('materiais',ref.id)),...(e.fontes||[]).map((fonte:any)=>registro(fonte.tipo==='pop'?'pops':'treinamentos',fonte.refId))]);
    for(const ref of e.materiais||[]){const m=await registro('materiais',ref.id);if(!m||m.apagado||m.registro.versao!==ref.versao||m.registro.publicada!==true||m.registro.ativa===false)return 'Um material integral vinculado mudou ou ainda não foi liberado. Revise a aula.';}
    for(const d of e.documentos || []) if(d.oficialConfirmado!==true || !d.conferidoPor || !d.conferidoEm)return 'A gestão precisa conferir a versão oficial deste documento.';
    for(const fonte of e.fontes || []) {
      const col=fonte.tipo==='pop'?'pops':'treinamentos',r=await registro(col,fonte.refId);
      if(!r||r.apagado)return 'Uma fonte oficial não está mais disponível.';
      if(String(r.registro.versao||'1.0')!==fonte.versao)return 'A fonte mudou de versão. A gestão precisa revisar esta aula.';
      if(col==='pops' && r.registro.revisao?.status!=='validado')return 'O POP aguarda revisão do responsável antes de formar a equipe.';
      if(col==='treinamentos' && (fonte.oficialConfirmado!==true||!fonte.conferidoPor||!fonte.conferidoEm))return 'A gestão precisa conferir a versão oficial deste treinamento.';
    }
    if(['etica','avaliacao'].includes(e.tipo)&&!e.quiz?.length)return 'A prova de compreensão ainda precisa ser preparada.';
    if(e.tipo==='pratica'&&(!e.checklist?.length || !e.validadores?.length))return 'Falta definir o checklist e o responsável pela prática.';
    return '';
  };
  const decorar = async (f:any,r:any,privado:boolean,ps:any[]=[]) => {
    const res=copy(f),novaVersao=!!r && r.formacaoVersao!==f.versao;
    let concluidas=0;const obrigatorias=f.etapas.filter((e:any)=>e.obrigatoria!==false);
    const fontesPendentes=new Map<string,string>(),pendencias=await Promise.all(f.etapas.map((e:any)=>pendenciaFonte(e)));f.etapas.forEach((e:any,i:number)=>fontesPendentes.set(e.id,pendencias[i]));
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
  // Público por família: só a administração escolhe (como "todos"). Quem não é
  // admin pode salvar o curso mantendo as famílias que já estavam, sem mudá-las.
  const familiasLiberacao = (lista:any, anteriores:any) => {
    if(lista==null)return [];
    if(!Array.isArray(lista)||lista.length>50||lista.some((x:any)=>!kebab(x))||new Set(lista).size!==lista.length)fail('Famílias de cargos inválidas.');
    const ant=Array.isArray(anteriores)?anteriores:[];
    if(!admin&&!iguais([...lista].sort(),[...ant].sort()))fail('Somente a administração libera por família de cargos.',403);
    // Família que não existe no catálogo não alcança ninguém e não avisaria.
    const fams=catalogoCfg(cfg).familias,fora=lista.filter((x:string)=>!ant.includes(x)&&!Object.hasOwn(fams,x));
    if(fora.length)fail('Família não cadastrada no catálogo: '+fora.join(', ')+'.',409);
    return [...lista];
  };
  // Tela antiga não conhece famílias: campo ausente conserva o que já existia;
  // lista vazia é que retira. Lista vazia não fica gravada, para não criar
  // atribuição nova no histórico quando nada mudou. null vale como ausente: sem
  // isso, quem não é admin apagaria com null as famílias que, com [], recebe 403.
  const aplicarFamilias = (lib:any, anterior:any) => {
    if((!Object.hasOwn(lib,'familias')||lib.familias===null)&&Array.isArray(anterior?.familias))lib.familias=copy(anterior.familias);
    const fams=familiasLiberacao(lib.familias,anterior?.familias);
    if(fams.length)lib.familias=fams;else delete lib.familias;
  };
  const textoOpcional = (v:any,max:number,msg:string) => { if(v==null||v==='')return ''; if(typeof v!=='string'||v.trim().length>max)fail(msg); return v.trim(); };
  // Catálogo do curso. Pré-requisito entre cursos é só recomendação ao aluno:
  // não bloqueia nada, mas precisa apontar para curso que existe e sem círculo.
  const catalogoFormacao = async (c:any, ant:any, fid:string) => {
    if(c==null)return null;
    if(!objeto(c))fail('Catálogo do curso inválido.');
    const out:any={},a=objeto(ant)?ant:{},cat=catalogoCfg(cfg);
    if(c.trilha!=null&&c.trilha!==''){
      if(!kebab(c.trilha))fail('Trilha do catálogo inválida.');
      if(c.trilha!==a.trilha&&!Object.hasOwn(cat.trilhas,c.trilha))fail('Trilha não cadastrada no catálogo: '+c.trilha+'.',409);
      out.trilha=c.trilha;
    }
    const area=textoOpcional(c.area,120,'Área do catálogo inválida.');if(area)out.area=area;
    if(c.nivel!=null&&c.nivel!==''){if(!niveis.includes(c.nivel))fail('Nível do curso inválido.');out.nivel=c.nivel;}
    if(c.cargaMinutos!=null){if(!inteiro(c.cargaMinutos,1,100000))fail('Carga horária do curso inválida.');out.cargaMinutos=c.cargaMinutos;}
    if(c.ordem!=null){if(!inteiro(c.ordem,0,10000))fail('Ordem do curso inválida.');out.ordem=c.ordem;}
    const codigo=textoOpcional(c.codigo,40,'Código do curso inválido.');if(codigo)out.codigo=codigo;
    // Resumo do cartão e palavras que o chão usa para procurar (CNC, serralheria,
    // balcão). Não pedagógicos, como o resto do catálogo: mudar não pede versão nova.
    // Tela que não conhece os campos (editor antigo) não os apaga: ausente conserva o anterior.
    if(!Object.hasOwn(c,'resumo')&&typeof a.resumo==='string'&&a.resumo)out.resumo=a.resumo;
    if(!Object.hasOwn(c,'palavrasChave')&&Array.isArray(a.palavrasChave)&&a.palavrasChave.length)out.palavrasChave=[...a.palavrasChave];
    const resumo=textoOpcional(c.resumo,200,'Resumo do curso com até 200 caracteres.');if(resumo)out.resumo=resumo;
    if(c.palavrasChave!=null){
      const pc=c.palavrasChave;
      if(!Array.isArray(pc)||pc.length>20||pc.some((x:any)=>typeof x!=='string'||!x.trim()||x.trim().length>40))fail('Palavras-chave do curso inválidas (até 20, com até 40 caracteres cada).');
      const limpas=[...new Set(pc.map((x:string)=>x.trim()))];if(limpas.length)out.palavrasChave=limpas;
    }
    if(c.familias!=null){
      if(!Array.isArray(c.familias)||c.familias.length>20||c.familias.some((x:any)=>!kebab(x))||new Set(c.familias).size!==c.familias.length)fail('Famílias do catálogo inválidas.');
      const antes=Array.isArray(a.familias)?a.familias:[],fora=c.familias.filter((x:string)=>!antes.includes(x)&&!Object.hasOwn(cat.familias,x));
      if(fora.length)fail('Família não cadastrada no catálogo: '+fora.join(', ')+'.',409);
      if(c.familias.length)out.familias=[...c.familias];
    }
    if(c.preRequisitos!=null){
      const pre=c.preRequisitos;
      if(!Array.isArray(pre)||pre.length>20||pre.some((x:any)=>!idFormato(x))||new Set(pre).size!==pre.length||pre.includes(fid))fail('Cursos recomendados inválidos.');
      const antes=Array.isArray(a.preRequisitos)?a.preRequisitos:[];
      if(pre.some((x:string)=>!antes.includes(x))){
        const mapa=new Map((await todos('formacoes')).map((x:any)=>[x.id,x]));
        const faltam=pre.filter((x:string)=>!antes.includes(x)&&!mapa.has(x));
        if(faltam.length)fail('Curso recomendado não encontrado: '+faltam.join(', ')+'.',409);
        // A antes de B antes de A não orienta ninguém.
        const chega=(origem:string)=>{const pilha=[origem],vistos=new Set<string>();while(pilha.length){const x=pilha.pop()!;if(x===fid)return true;if(vistos.has(x))continue;vistos.add(x);const prox=mapa.get(x)?.catalogo?.preRequisitos;if(Array.isArray(prox))pilha.push(...prox);}return false;};
        if(pre.some(chega))fail('Os cursos recomendados formariam um círculo. Revise a ordem da trilha.',409);
      }
      if(pre.length)out.preRequisitos=[...pre];
    }
    return Object.keys(out).length?out:null;
  };
  const op=String(body.operacao || 'painel');
  if(op.startsWith('academia.'))return academia(body,{sb,usuario,admin,gestor,aluno,setores,pessoa,cfg,gerencia,registro,todos,pessoasRH,idApr,gravar,fail,id,aplicarFamilias});
  // Entrada do aluno (ID do RH e primeiro nome): ligada por padrão. Só a
  // administração liga, desliga e muda a validade do crachá do aluno (1 a 30 dias).
  // Patch só em educacao, levando o resto (instrutores, catálogo), com o valor
  // anterior para o banco recusar se outra pessoa gravou no meio (como no catálogo).
  if(op==='configurarEntradaAluno') {
    if(!admin)fail('Somente a administração configura a entrada do aluno.',403);
    if(typeof body.ativa!=='boolean')fail('Informe se a entrada do aluno fica ligada ou desligada.');
    if(!inteiro(body.validadeDias,1,30))fail('A validade da entrada do aluno vai de 1 a 30 dias.');
    const antes=entradaAlunoCfg(cfg),lida=body.entradaAnterior;
    if(antes.ativa===body.ativa&&antes.validadeDias===body.validadeDias)return {ok:true,entradaAluno:antes,repetido:true};
    // A tela manda o que leu: se mudou desde então, não grava por cima.
    if(lida!=null&&(!objeto(lida)||lida.ativa!==antes.ativa||lida.validadeDias!==antes.validadeDias))fail('A entrada do aluno mudou desde que você abriu esta tela. Recarregue e refaça a alteração; nada foi gravado.',409);
    const agora=new Date().toISOString();
    // Religar marca a hora: crachá emitido antes de desligar não volta a valer.
    const nova:any={ativa:body.ativa,validadeDias:body.validadeDias,atualizadoEm:agora,atualizadoPor:usuario};
    if(body.ativa&&!antes.ativa)nova.ligadaEm=agora;else if(antes.ligadaEm)nova.ligadaEm=antes.ligadaEm;
    const educacao={...(cfg.educacao||{}),entradaAluno:nova};
    const res=await sb.rpc('pops_configurar',{p_patch:{educacao},p_anterior:Object.hasOwn(cfg,'educacao')?{educacao:cfg.educacao}:{}});
    if(res.error?.code==='40001')fail('A configuração mudou. Atualize antes de salvar.',409);
    conferir(res);return {ok:true,entradaAluno:entradaAlunoCfg({educacao})};
  }
  // Muitos erros seguidos bloqueiam a entrada do aluno por 15 minutos (por ID,
  // nome, rede ou no total). A turma inteira da fábrica sai pelo mesmo IP: se ela
  // ficou bloqueada, a administração libera na hora, zerando as tentativas contadas.
  if(op==='liberarEntradaAluno') {
    if(!admin)fail('Somente a administração libera a entrada do aluno.',403);
    const res=await sb.rpc('pops_entrada_aluno_bloqueios',{p_liberar:true});
    if(res.error||!objeto(res.data)||res.data.ok!==true)fail('Não consegui liberar a entrada do aluno agora. Tente novamente.',503);
    return {ok:true,liberados:Number.isInteger(res.data.liberados)?res.data.liberados:0,bloqueios:0};
  }
  if(op==='configurarCatalogo') {
    if(!admin)fail('Somente a administração organiza o catálogo da escola.',403);
    const c=body.catalogo;
    if(!objeto(c)||(c.familias!=null&&!objeto(c.familias))||(c.trilhas!=null&&!objeto(c.trilhas)))fail('Catálogo inválido.');
    const fams=c.familias||{},trs=c.trilhas||{};
    if(Object.keys(fams).length>50||Object.keys(trs).length>50)fail('Cadastre até 50 famílias e até 50 trilhas.');
    const antes=catalogoCfg(cfg),limpo:any={familias:{},trilhas:{}},lido=body.catalogoAnterior;
    if(lido!=null&&(!objeto(lido)||(lido.familias!=null&&!objeto(lido.familias))||(lido.trilhas!=null&&!objeto(lido.trilhas))))fail('Catálogo lido pela tela inválido.');
    for(const [fid,v] of Object.entries(fams) as [string,any][]) {
      const cargos=v?.cargos??[];
      if(!kebab(fid)||!objeto(v)||!texto(v.nome,120)||!Array.isArray(cargos)||cargos.length>200||cargos.some((x:any)=>!idFormato(x))||new Set(cargos).size!==cargos.length)fail('Família '+(kebab(fid)?fid:'sem identificador válido')+': informe identificador, nome e cargos do RH.');
      limpo.familias[fid]={nome:texto(v.nome,120),descricao:textoOpcional(v.descricao,2000,'Descrição da família '+fid+' muito longa.'),cargos:[...cargos]};
    }
    for(const [tid,v] of Object.entries(trs) as [string,any][]) {
      if(!kebab(tid)||!objeto(v)||!texto(v.nome,120)||(v.ordem!=null&&!inteiro(v.ordem,0,10000)))fail('Trilha '+(kebab(tid)?tid:'sem identificador válido')+': informe identificador, nome e ordem entre 0 e 10000.');
      limpo.trilhas[tid]={nome:texto(v.nome,120),descricao:textoOpcional(v.descricao,2000,'Descrição da trilha '+tid+' muito longa.'),ordem:v.ordem??0};
    }
    // Reenvio de uma gravação que já entrou (resposta perdida, envio guardado no
    // aparelho): o catálogo pedido é o gravado, então devolve sem gravar de novo.
    if(iguais(limpo,antes))return {ok:true,catalogo:limpo,repetido:true};
    // A tela manda o catálogo que leu (catalogoAnterior). O p_anterior do banco só
    // protege a janela desta requisição: sem esta conferência, uma Matriz aberta
    // com dados antigos gravaria por cima do que outra pessoa salvou no meio
    // tempo, sem aviso. Tela antiga, sem o campo, segue como antes.
    if(lido!=null&&!iguais(catalogoCfg({educacao:{catalogo:lido}}),antes))fail('O catálogo mudou desde que você abriu esta tela. Recarregue a Matriz de cargos e refaça a alteração; nada foi gravado.',409);
    // Cargo novo precisa existir no RH: identificador digitado errado não alcança
    // ninguém e não avisaria. Lê o RH na hora, sem o cache da instância.
    cacheRH.delete('cargos');
    const existentes=new Set((await lerRH(sb,conferir,'cargos')).map((x:any)=>x.id));
    const faltam=Object.entries(limpo.familias).flatMap(([fid,v]:[string,any])=>v.cargos.filter((x:string)=>!(antes.familias[fid]?.cargos||[]).includes(x)&&!existentes.has(x)));
    if(faltam.length)fail('Cargo não encontrado no RH: '+[...new Set(faltam)].join(', ')+'.',409);
    // Família ou trilha excluída não pode deixar curso ou material apontando para o vazio.
    const semF=Object.keys(antes.familias).filter(k=>!Object.hasOwn(limpo.familias,k)),semT=Object.keys(antes.trilhas).filter(k=>!Object.hasOwn(limpo.trilhas,k));
    if(semF.length||semT.length){
      const [fs,ms,ins]=await Promise.all([todos('formacoes'),todos('materiais'),todos('instrumentos')]),uso=new Set<string>();
      for(const x of [...fs,...ms,...ins])for(const k of Array.isArray(x.liberacao?.familias)?x.liberacao.familias:[])uso.add('f:'+k);
      for(const x of fs){for(const k of Array.isArray(x.catalogo?.familias)?x.catalogo.familias:[])uso.add('f:'+k);if(x.catalogo?.trilha)uso.add('t:'+x.catalogo.trilha);}
      const presas=[...semF.filter(k=>uso.has('f:'+k)).map(k=>'família '+k),...semT.filter(k=>uso.has('t:'+k)).map(k=>'trilha '+k)];
      if(presas.length)fail('Ainda há cursos ou materiais usando: '+presas.join(', ')+'. Retire o vínculo antes de excluir.',409);
    }
    // Patch só em educacao, levando instrutores e o que mais houver; o banco
    // confere que educacao não mudou desde a leitura (p_anterior).
    const educacao={...(cfg.educacao||{}),catalogo:limpo};
    const res=await sb.rpc('pops_configurar',{p_patch:{educacao},p_anterior:Object.hasOwn(cfg,'educacao')?{educacao:cfg.educacao}:{}});
    if(res.error?.code==='40001')fail('A configuração mudou. Atualize antes de salvar.',409);
    conferir(res);cacheRH.clear();return {ok:true,catalogo:limpo};
  }
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
    conferir(res);cacheRH.clear();return {ok:true,instrutores:mapa};
  }
  if(op==='painel') {
    // Quem gerencia monta a grade com todos os cargos e vagas do RH; aluno não paga essa leitura.
    const gere=admin||gestor;
    // O aluno não paga nem recebe a lista de pessoas: a visão dele não a usa.
    const [fs,rs,ps,cargos,vagas]=await Promise.all([todos('formacoes'),todos('aprendizagem'),aluno?[]:pessoasRH(),gere?cargosRH():null,gere?vagasRH():null]);
    const pessoais=rs.filter(r=>pessoa && r.colaboradorId===pessoa.colaboradorId);
    const visiveis=fs.filter(f=>gerencia(f)||liberada(f,pessoa,cfg)||pessoais.some(r=>r.formacaoId===f.id)||(pessoa&&(cfg.educacao?.instrutores?.[usuario]||[]).map(norm).includes(norm(f.setor))&&f.etapas?.some((e:any)=>(e.validadores||[]).map(norm).includes(usuario))));
    const formacoes:any[]=await Promise.all(visiveis.map(async(f:any)=>{
      const pessoal=pessoais.find(r=>r.formacaoId===f.id);
      const instrutor=!!pessoa&&(cfg.educacao?.instrutores?.[usuario]||[]).map(norm).includes(norm(f.setor))&&f.etapas.some((e:any)=>(e.validadores||[]).map(norm).includes(usuario));
      if(!gerencia(f)&&!liberada(f,pessoa,cfg)&&!instrutor) {
        const antiga=f.versoesAnteriores?.find((v:any)=>v.versao===pessoal?.formacaoVersao);
        // Só a trilha (e a ordem) do catálogo: o curso fica na trilha certa do
        // catálogo da pessoa, sem levar cursos recomendados nem outro metadado.
        const cat=f.catalogo?.trilha?{catalogo:{trilha:f.catalogo.trilha,...(Number.isInteger(f.catalogo.ordem)?{ordem:f.catalogo.ordem}:{})}}:{};
        return {id:f.id,titulo:antiga?.titulo||f.titulo,versao:pessoal?.formacaoVersao||f.versao,setor:f.setor,ativa:f.ativa,...cat,publicada:false,liberada:false,liberadaParaMim:false,somenteHistorico:true,historica:true,etapas:(antiga?.etapas||f.etapas).map((e:any)=>({id:e.id,titulo:e.titulo,tipo:e.tipo,obrigatoria:e.obrigatoria,status:pessoal?.etapas?.[e.id]?.status||'nao_iniciada',statusFonte:'restrito',motivoBloqueio:'Este curso não está mais liberado para você. Seu histórico continua preservado em Meu histórico.'})),progresso:{concluidas:Object.values(pessoal?.etapas||{}).filter((e:any)=>e.status==='concluida').length,total:f.etapas.length,percentual:0,etapaAtual:null}};
      }
      return decorar(f,pessoal,gerencia(f),ps);
    }));
    // Pré-requisito entre cursos é recomendação: o aluno vê o título, se já
    // concluiu a versão atual e se o curso está liberado para ele. Rascunho de
    // outro curso só aparece para quem o gerencia.
    const porId=new Map(fs.map((f:any)=>[f.id,f]));
    for(const f of formacoes) {
      if(f.somenteHistorico||!Array.isArray(f.catalogo?.preRequisitos))continue;
      const lista=f.catalogo.preRequisitos.flatMap((rid:string)=>{
        const pre:any=porId.get(rid);if(!pre)return [];
        const libera=liberada(pre,pessoa,cfg);
        if(!libera&&!gerencia(pre)&&(pre.publicada!==true||pre.ativa===false))return [];
        const meu=pessoais.find(r=>r.formacaoId===rid);
        return [{id:rid,titulo:pre.titulo,concluida:!!meu?.concluidaEm&&meu.formacaoVersao===pre.versao,liberada:libera}];
      });
      if(lista.length)f.recomendadas=lista;
      // Quem não gerencia o curso recebe em catalogo.preRequisitos só os ids que
      // passaram no filtro acima: o id (slug) de um rascunho de outro setor
      // revelaria o assunto de um curso ainda não anunciado.
      if(!gerencia(f)){
        if(lista.length)f.catalogo.preRequisitos=lista.map((x:any)=>x.id);else delete f.catalogo.preRequisitos;
        if(!Object.keys(f.catalogo).length)delete f.catalogo;
      }
    }
    const catalogo=copy(catalogoCfg(cfg));
    // Aluno: visão de aluno, nunca dados de gestão (nem pessoas, nem registros de
    // outros, nem cargos e vagas do RH, nem configuração).
    if(aluno)return {ok:true,pessoa,motivoVinculo:identidade.motivo||null,formacoes,aprendizagem:pessoais,catalogo,gestao:{podeGerir:false,podeValidar:false,pessoas:[],registros:[]},atualizadoEm:new Date().toISOString()};
    const gestaoReg=rs.filter(r=>{const f=fs.find(f=>f.id===r.formacaoId),p=ps.find(p=>p.colaboradorId===r.colaboradorId);return f&&p&&(admin ||(gerencia(f)&&corresponde(p,setores))||f.etapas.some((e:any)=>validar(f,e,p)));});
    const ids=new Set(gestaoReg.map(r=>r.colaboradorId));
    // Administração: quantos bloqueios da entrada do aluno valem agora. Sem a
    // contagem (banco fora), o cartão segue sem ela; o painel não cai por isso.
    let bloqueiosAluno:number|null=null;
    if(admin){try{const b=await sb.rpc('pops_entrada_aluno_bloqueios',{p_liberar:false});if(!b.error&&Number.isInteger(b.data?.bloqueios))bloqueiosAluno=b.data.bloqueios;}catch{/* sem contagem */}}
    return {ok:true,pessoa,motivoVinculo:identidade.motivo||null,formacoes,aprendizagem:pessoais,catalogo,gestao:{instrutores:admin?(cfg.educacao?.instrutores||{}):undefined,...(admin?{entradaAluno:{...entradaAlunoCfg(cfg),...(bloqueiosAluno===null?{}:{bloqueios:bloqueiosAluno})}}:{}),...(gere?{cargosRH:cargos,vagasRH:vagas,catalogo}:{}),podeGerir:admin||gestor,podeValidar:!!pessoa&&(admin||gestor||fs.some(f=>f.etapas.some((e:any)=>(e.validadores||[]).map(norm).includes(usuario)))),pessoas:ps.filter(p=>admin||(gestor&&corresponde(p,setores))||ids.has(p.colaboradorId)),registros:gestaoReg.map(r=>registroGestao(r,fs.find(f=>f.id===r.formacaoId),ps.find(p=>p.colaboradorId===r.colaboradorId)))},atualizadoEm:new Date().toISOString()};
  }
  if(op==='aprovarAvaliacao') {
    const f=await getF(body.formacaoId);if(!gerencia(f))fail('Somente a gestão responsável aprova avaliações.',403);
    const e=f.etapas.find((e:any)=>e.id===body.etapaId);if(!e?.quiz?.length)fail('Prepare as questões antes da aprovação.');
    if(!texto(body.parecer,4000))fail('Registre o parecer da revisão pedagógica.');
    const mutation=id(body.mutationId);if(e.aprovacao?.mutationId===mutation&&e.aprovacao.por===usuario)return {ok:true,registro:f,revision:f._serverRevision};
    if(body.expectedRevision!==f._serverRevision)fail('O curso mudou. Confira a versão atual.',409);
    const falta=await pendenciaFonte(e);if(falta)fail(falta,409);
    e.aprovacao={por:usuario,em:new Date().toISOString(),versao:f.versao,parecer:texto(body.parecer,4000),mutationId:mutation};
    const rev=f._serverRevision;delete f._serverRevision;return gravar('formacoes',f,rev,mutation);
  }
  if(op==='salvarFormacao') {
    const f=copy(body.formacao||{});id(f.id);
    const anterior=await registro('formacoes',f.id);
    if(!gerencia(f)||(anterior&&!gerencia(anterior.registro)))fail('Seu acesso não permite gerenciar este curso.',403);
    const mutation=id(body.mutationId);
    if(anterior?.mutation_id===mutation){
      if(anterior.registro.atualizadoPor!==usuario)fail('Este envio pertence a outra pessoa. Atualize antes de salvar.',409);
      return {ok:true,registro:anterior.registro,revision:anterior.revision,repetido:true};
    }
    if(!texto(f.titulo,200)||!texto(f.versao,40)||!texto(f.setor,200))fail('Informe título, versão e setor.');
    if(!Array.isArray(f.etapas)||!f.etapas.length||f.etapas.length>50)fail('Cadastre entre 1 e 50 aulas.');
    if(typeof f.publicada!=='boolean'||typeof f.ativa!=='boolean')fail('Informe a disponibilidade do curso.');
    f.liberacao=f.liberacao||{};if(!objeto(f.liberacao))fail('Público do curso inválido.');delete f.liberacao.cargosSetoresEfetivos;delete f.pessoasLiberadas;
    for(const k of ['pessoas','cargos','setores'])if(!Array.isArray(f.liberacao[k]||[])||(f.liberacao[k]||[]).length>2000||(f.liberacao[k]||[]).some((s:any)=>!texto(s,160)))fail('Público do curso inválido.');
    // "Todos" é escolha da administração. Quem não é admin salva o curso mantendo
    // o "todos" que já estava (na tela dele a caixa fica desligada) e pode
    // retirá-lo; ligar é que é recusado, como nas famílias.
    if(f.liberacao.todos && !admin){if(anterior?.registro.liberacao?.todos!==true)fail('Somente a administração libera para toda a empresa.',403);f.liberacao.todos=true;}
    aplicarFamilias(f.liberacao,anterior?.registro.liberacao);
    // Catálogo ausente no envio (tela antiga) conserva o anterior; null apaga.
    if(!Object.hasOwn(f,'catalogo')&&anterior?.registro.catalogo)f.catalogo=copy(anterior.registro.catalogo);
    const catalogo=await catalogoFormacao(f.catalogo,anterior?.registro.catalogo,f.id);
    if(catalogo)f.catalogo=catalogo;else delete f.catalogo;
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
    if(!f.etapas.some((e:any)=>e?.obrigatoria!==false))fail('Defina pelo menos uma aula obrigatória para concluir o curso.');
    const vistos=new Set<string>();
    for(const e of f.etapas) {
      id(e.id);if(vistos.has(e.id)||!texto(e.titulo,200)||!tipos.includes(e.tipo))fail('Aula inválida ou repetida.');
      if(!Array.isArray(e.prerequisitos||[])||(e.prerequisitos||[]).some((p:any)=>!vistos.has(p)))fail('As aulas exigidas antes precisam vir antes no curso.');
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
      for(const ref of e.materiais||[]){const mat=await registro('materiais',ref.id);if(!mat||mat.apagado||!gerencia(mat.registro))fail('Você não pode liberar material de outro setor por este curso.',403);}
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
    if(anterior && body.expectedRevision!==anterior.revision)fail('O curso mudou. Atualize antes de salvar.',409);
    delete f._serverRevision;delete f.progresso;delete f.revisaoNecessaria;delete f.liberada;delete f.liberadaParaMim;delete f.somenteHistorico;delete f.historica;delete f.recomendadas;
    if(f.prazo&&(!/^\d{4}-\d{2}-\d{2}$/.test(f.prazo)||isNaN(Date.parse(f.prazo))))fail('Prazo do curso inválido.');
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
  if(op==='registrar'&&!liberada(f,pessoa,cfg))fail('Este curso não está liberado para você.',403);
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
  if(op!=='reciclar'&&body.formacaoVersao!==f.versao)fail('O curso mudou ou sua versão não foi informada. Atualize o conteúdo antes de continuar.',409);
  if(op==='reciclar'||r.formacaoVersao!==f.versao) {
    if(op==='validar')fail('O curso mudou. A pessoa precisa retomar a versão atual.',409);
    if(op==='reciclar'&&!texto(body.motivo,2000))fail('Informe o motivo e a orientação da reciclagem.');
    r.historico.push({formacaoVersao:r.formacaoVersao,etapas:copy(r.etapas),concluidaEm:r.concluidaEm||null,encerradaEm:agora,motivo:op==='reciclar'?texto(body.motivo,2000):'Nova versão do curso',por:usuario});
    r.etapas={};r.formacaoVersao=f.versao;delete r.concluidaEm;r.reciclagem={em:agora,por:usuario,motivo:op==='reciclar'?texto(body.motivo,2000):'Nova versão do curso'};
  }
  let feedback:any=null;
  if(op!=='reciclar') {
    if(!e)fail('Aula não disponível.',404);
    if(op==='registrar' && !['abrir','leitura','ciencia','responder','enviarPratica'].includes(body.evento))fail('Atividade inválida.');
    for(const pid of e.prerequisitos||[]) {
      const previa=f.etapas.find((x:any)=>x.id===pid);
      if(r.etapas[pid]?.status!=='concluida'||!previa||await pendenciaFonte(previa))fail('Conclua ou revise as aulas exigidas antes de avançar.',409);
    }
    const falta=await pendenciaFonte(e);if(falta)fail(falta,409);
    const a=r.etapas[e.id] || {status:'nao_iniciada',tentativas:[],pontos:0,versao:f.versao,fontes:copy(e.fontes||[]),documentos:copy(e.documentos||[])};
    const completoAntes=a.status==='concluida';
    if(op==='validar') {
      if(e.tipo!=='pratica'||a.status!=='aguardando_validacao')fail('Não existe prática pendente de validação nesta aula.',409);
      if(e.quiz?.length&&!a.compreensaoEm)fail('A compreensão desta aula precisa ser demonstrada antes da prática.',409);
      if(typeof body.aprovado!=='boolean'||!texto(body.feedback,4000))fail('Registre o resultado e uma orientação para a pessoa.');
      a.validacao={por:usuario,nome:String(cracha.nome||usuario),em:agora,aprovado:body.aprovado,feedback:texto(body.feedback,4000),checklist:copy(a.checklist||[])};
      a.validacoes=[...(a.validacoes||[]),copy(a.validacao)];
      a.status=body.aprovado?'concluida':'revisar';feedback=a.validacao;
    } else if(body.evento==='abrir') {a.abertaEm=a.abertaEm||agora;if(a.status==='nao_iniciada')a.status='em_andamento';}
    else if(body.evento==='leitura'||body.evento==='ciencia') {
      for(const ref of e.materiais||[]){const key=await idApr(alvo.colaboradorId,'material:'+ref.id+':'+ref.versao),estudo=await registro('estudos',key);if(!estudo?.registro.leituraEm)fail('Abra e declare o estudo dos materiais integrais desta aula antes de avançar.',409);}

      a.abertaEm=a.abertaEm||agora;a.leituraEm=a.leituraEm||agora;
      if(body.evento==='ciencia') {if(body.aceite!==true)fail('Confirme a ciência desta versão.');a.cienciaEm=a.cienciaEm||agora;}
      if(!completoAntes&&a.status!=='aguardando_validacao')a.status='em_andamento';
    } else if(body.evento==='responder') {
      if(!e.aprovacao?.por||e.aprovacao.versao!==f.versao)fail('A prova aguarda revisão e aprovação pelo responsável.',409);
      if(completoAntes)fail('Esta aula já foi concluída; a tentativa anterior está preservada.',409);
      if(!a.leituraEm)fail('Estude o conteúdo e registre a leitura antes de responder.',409);
      if(!e.quiz?.length)fail('Esta aula não tem prova.');
      if(a.tentativas.length>=e.maxTentativas)fail('As tentativas terminaram. Peça apoio à gestão para revisar e liberar uma nova aprendizagem.',409);
      const answers=body.respostas;
      if(!answers||Array.isArray(answers)||e.quiz.some((q:any)=>!Number.isInteger(answers[q.id])||answers[q.id]<0||answers[q.id]>=q.opcoes.length))fail('Responda todas as perguntas.');
      const corretas=e.quiz.filter((q:any)=>answers[q.id]===q.correta).length,nota=Math.round(corretas/e.quiz.length*100),aprovada=nota>=e.minimoAcerto;
      feedback={nota,aprovada,questoes:e.quiz.map((q:any)=>({id:q.id,acertou:answers[q.id]===q.correta,explicacao:q.explicacao,revisar:q.revisar||e.titulo}))};
      a.tentativas.push({em:agora,nota,aprovada,formacaoVersao:f.versao,avaliacaoAprovadaEm:e.aprovacao.em,fontes:copy(e.fontes||[]),materiais:copy(e.materiais||[]),respostas:copy(answers),feedback});a.compreensaoEm=aprovada?agora:a.compreensaoEm;
      a.status=aprovada?'em_andamento':'revisar';
    } else if(body.evento==='enviarPratica') {
      if(e.tipo!=='pratica')fail('Esta aula não é uma prática acompanhada.');
      if(completoAntes||a.status==='aguardando_validacao')fail('Esta prática já foi enviada.',409);
      if(!a.leituraEm || !texto(body.evidencia,10000))fail('Registre a leitura e descreva a execução realizada.');
      if(e.quiz?.length&&!a.compreensaoEm)fail('Demonstre a compreensão desta aula antes de enviar a prática.',409);
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
  const {sb,usuario,admin,gestor,aluno,setores,pessoa,cfg,gerencia,registro,todos,pessoasRH,idApr,gravar,fail,id,aplicarFamilias}=c;
  const op=body.operacao.slice(9),agora=new Date().toISOString();
  // Cópia integral: o registro lido fica no cache da requisição.
  const obter=async(col:string,key:any)=>{const r=await registro(col,id(key));if(!r||r.apagado)fail('Registro não disponível.',404);return {...copy(r.registro),_serverRevision:r.revision};};
  // O aluno nunca é instrutor nem responsável por NR: só o que é dele.
  const escopoInstrutor=aluno?[]:cfg.educacao?.instrutores?.[usuario]||[];
  const instrutorNR=(m:any)=>!aluno&&m.tipo==='nr'&&norm(m.nr?.responsavel)===usuario&&escopoInstrutor.map(norm).includes(norm(m.setor));
  const acessoMaterial=async(m:any)=>gerencia(m)||instrutorNR(m)||liberada(m,pessoa,cfg)||m.publicada===true&&m.ativa!==false&&(await todos('formacoes')).some((f:any)=>liberada(f,pessoa,cfg)&&f.etapas.some((e:any)=>(e.materiais||[]).some((ref:any)=>ref.id===m.id&&ref.versao===m.versao)));
  const seguro=(m:any,integral=false)=>{const r=copy(m);if(!gerencia(m)){delete r.liberacao;delete r.versoesAnteriores;}if(!integral)delete r.paginas;r.temPDF=!!m.arquivoPath;delete r.arquivoPath;if(m.youtubeId)r.embed='https://www.youtube-nocookie.com/embed/'+m.youtubeId;return r;};
  const audiencia=async(r:any,anterior:any)=>{
    r.liberacao=r.liberacao||{};if(!objeto(r.liberacao))fail('Público inválido.');
    for(const k of ['pessoas','cargos','setores'])if(!Array.isArray(r.liberacao[k]||[])||(r.liberacao[k]||[]).length>2000||(r.liberacao[k]||[]).some((x:any)=>!texto(x,160)))fail('Público inválido.');
    // A regra de liberação é a mesma das formações: família só pela administração.
    aplicarFamilias(r.liberacao,anterior);
    if(!admin){
      // Mesma regra do curso: conserva o "todos" que a administração ligou, não liga.
      if(r.liberacao.todos){if(anterior?.todos!==true)fail('Somente a administração libera para todos.',403);r.liberacao.todos=true;}
      if((r.liberacao.setores||[]).some((s:any)=>!setores.map(norm).includes(norm(s))))fail('Setor fora do seu escopo.',403);
      const ps=await pessoasRH();if((r.liberacao.pessoas||[]).some((pid:any)=>!ps.some((p:any)=>p.colaboradorId===pid&&corresponde(p,setores))))fail('Pessoa fora do seu escopo.',403);
      r.liberacao.cargosGestor=usuario;r.liberacao.cargosSetores=copy(setores);
    }else{delete r.liberacao.cargosGestor;delete r.liberacao.cargosSetores;}
  };
  if(op==='biblioteca') {
    const [ms,estudos,ps]=await Promise.all([todos('materiais'),todos('estudos'),aluno?[]:pessoasRH()]);const visiveis=[];
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
    await audiencia(m,anterior?.registro.liberacao);
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
    const [ms,rs,ps]=await Promise.all([todos('materiais'),todos('capacitacoes'),aluno?[]:pessoasRH()]);
    const vis=ms.filter((m:any)=>m.tipo==='nr'&&(gerencia(m)||instrutorNR(m)||liberada(m,pessoa,cfg)));
    // Aluno: só as NRs e o registro dele; nenhuma pessoa, pendência ou registro de outros.
    if(aluno)return {ok:true,pendencias:vis.flatMap((m:any)=>{const r=rs.find((r:any)=>r.materialId===m.id&&r.colaboradorId===pessoa?.colaboradorId);const situacao=!pessoa?'':!r?'Não iniciado':r.versao!==m.versao?'Revisão de versão necessária':r.vencimento&&r.vencimento<agora.slice(0,10)?'Reciclagem vencida':r.status!=='concluida'?'Etapas pendentes':'';return situacao?[{materialId:m.id,colaboradorId:pessoa.colaboradorId,nome:pessoa.nome,titulo:m.titulo,situacao}]:[];}),normas:vis.map((m:any)=>({...seguro(m),podeRegistrar:false})),pessoas:[],registros:rs.filter((r:any)=>!!pessoa&&r.colaboradorId===pessoa.colaboradorId),podeGerir:false,pessoa};
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
    await audiencia(r,anterior?.registro.liberacao);
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
    // Os nomes de quem consulta os resultados ficam para todos (é o que a pessoa
    // aceita antes de responder); os IDs das fichas deles não vão ao aluno.
    const [ins,rs,ps]=await Promise.all([todos('instrumentos'),todos('perfis'),pessoasRH()]);
    const vis=ins.filter((r:any)=>admin||(liberada(r,pessoa,cfg)&&r.aprovacao?.versao===r.versao));
    return {ok:true,pessoa,podeGerir:admin,pessoas:admin?ps:[],instrumentos:vis.map((r:any)=>{const x=copy(r);x.liberadaParaMim=liberada(r,pessoa,cfg);x.consultores=(x.visibilidade||[]).map((id:string)=>ps.find((p:any)=>p.colaboradorId===id)?.nome||'Responsável autorizado');if(!admin){delete x.liberacao;delete x.versoesAnteriores;}if(aluno)delete x.visibilidade;return x;}),resultados:rs.filter((r:any)=>!!pessoa&&(r.colaboradorId===pessoa.colaboradorId||!aluno&&ins.some((i:any)=>i.id===r.instrumentoId&&(i.visibilidade||[]).includes(pessoa.colaboradorId))))};
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
