// ============================================================================
// app.js — Pops & Fabricação · Impresilk
// POPs por setor (o procedimento oficial de cada área) + Jornadas de
// fabricação (trilhas passo a passo dos processos técnicos). Login pela
// Central de Acessos (mesma conta do Painel). Offline-first: lê na bancada
// sem sinal; leituras e progresso sobem quando a rede volta.
//
// Papéis: admin edita tudo e vê o mapa de treinamento; gestor edita os POPs
// do(s) setor(es) dele; equipe lê e registra leitura/progresso.
// ============================================================================

const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
const fmtData = iso => { if (!iso) return ''; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR'); };
const fmtDataHora = iso => { if (!iso) return ''; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

let SESSAO = STORE.getUser();

// A estrutura da empresa (4 macroáreas × 21 setores e as 4 linhas de produção)
// vem do servidor, no cfg. O padrão abaixo é só o primeiro boot, antes do pull.
const AREAS_PADRAO = [
  { nome: 'Mercado e Vendas', ic: '📣', setores: ['Comercial', 'Marketing', 'Pós-venda'] },
  { nome: 'Criação e Engenharia', ic: '✏️', setores: ['Design de criação', 'Arte-final e pré-impressão', 'Projetos técnicos'] },
  { nome: 'Operações', ic: '🏭', setores: ['PCP e Expedição', 'Compras e almoxarifado', 'Impressão digital e recorte',
    'DTF UV e brindes', 'Corte de chapas e usinagem', 'Metalurgia', 'Pintura', 'Montagem de letras',
    'Portas de ACM', 'Acabamento', 'Instalação de placas'] },
  { nome: 'Apoio e Gestão', ic: '🧭', setores: ['Financeiro', 'RH e DP', 'TI e sistemas', 'Manutenção'] },
];
function areas() {
  const a = STORE.getCFG().areas;
  return (a && a.length ? a : AREAS_PADRAO);
}
function setores() {
  const cfg = STORE.getCFG();
  if (cfg.setores && cfg.setores.length) return cfg.setores;
  return areas().reduce((t, a) => t.concat(a.setores || []), []);
}
function areaDoSetor(setor) {
  return areas().find(a => (a.setores || []).some(x => norm(x) === norm(setor)));
}
function resumoDoSetor(setor) {
  return (STORE.getCFG().resumoSetor || {})[setor] || '';
}
function linhas() {
  const l = STORE.getCFG().linhas;
  return (l && l.length ? l.slice().sort((x, y) => (x.ordem || 0) - (y.ordem || 0)) : []);
}
function souAdmin() { return SESSAO && SESSAO.papel === 'admin'; }
function meusSetores() {
  if (souAdmin()) return setores();
  const g = (STORE.getCFG().gestores || {})[norm(SESSAO && SESSAO.usuario)] || [];
  return SESSAO && SESSAO.papel === 'gestor' ? g : [];
}
function possoEditar(pop) { return souAdmin() || meusSetores().some(s => norm(s) === norm(pop.setor)); }

/* ══════════ toasts e modal ══════════ */
function toast(msg, tipo) {
  const t = document.createElement('div');
  t.className = 'toast' + (tipo ? ' ' + tipo : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
function associarRotulos(raiz) {
  $$('.campo', raiz).forEach(campo => {
    const rotulo = $('label', campo), controle = $('input:not([type=checkbox]), select, textarea', campo);
    if (rotulo && controle && !rotulo.htmlFor) {
      if (!controle.id) controle.id = 'campo-' + uuid();
      rotulo.htmlFor = controle.id;
    }
  });
}
function abrirModal(html) {
  const veu = document.createElement('dialog');
  veu.className = 'veu';
  veu.innerHTML = '<div class="modal">' + html + '</div>';
  veu.setAttribute('aria-label', $('h3', veu)?.textContent || 'Detalhes');
  const remover = veu.remove.bind(veu);
  veu.remove = () => { veu.close(); remover(); };
  veu.addEventListener('cancel', e => { e.preventDefault(); veu.remove(); });
  veu.onclick = e => { if (e.target === veu) veu.remove(); };
  $('#overlays').appendChild(veu);
  associarRotulos(veu); veu.showModal();
  return veu;
}
function salvarLocal(colecao, registro) {
  if (['leituras','progresso'].includes(colecao) && !podeRegistrarAprendizado()) {
    toast('Para registrar seu aprendizado, a gestão precisa conferir seu vínculo com o RH.', 'erro'); return false;
  }
  if (STORE.salvar(colecao, registro)) return true;
  toast('Não foi possível guardar a alteração neste aparelho. Libere espaço e tente novamente.', 'erro'); return false;
}
function arquivarLocal(colecao, id) {
  if (STORE.apagar(colecao, id)) return true;
  toast('Não foi possível guardar esta alteração. O item foi mantido.', 'erro'); return false;
}
function mensagemSalvo() { return 'Salvo neste aparelho · aguardando sincronização'; }
function etapasFeitas(j, pr) { return (j.etapas || []).filter(e => !!pr?.etapas?.[e.id]).length; }
function expiracaoTreinamento(t, em) {
  if (!t?.validadeMeses || !em) return null;
  const d = new Date(em), dia = d.getDate();
  if (!Number.isFinite(d.getTime())) return null;
  d.setDate(1); d.setMonth(d.getMonth() + Number(t.validadeMeses));
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(dia, fim)); return d;
}

/* ══════════ blocos: dado ↔ tela ↔ texto do editor ══════════
   O conteúdo de POPs e etapas é uma lista de blocos:
   {tipo:'paragrafo'|'subtitulo'|'passos'|'lista'|'destaque'|'alerta'|'checklist', texto|itens}
   (o MESMO formato dos 5 POPs que vieram do RH — eles migram sem conversão).
   No editor vira texto simples: "## Sub", "1. passo", "- item", "! destaque",
   "!! alerta", "[ ] item de checklist", linha solta = parágrafo. */
function blocosParaHtml(blocos) {
  return (blocos || []).map(b => {
    if (b.tipo === 'subtitulo') return '<div class="bloco-sub">' + esc(b.texto) + '</div>';
    if (b.tipo === 'passos') return '<ol class="bloco-passos">' + (b.itens || []).map(i => '<li>' + esc(i) + '</li>').join('') + '</ol>';
    if (b.tipo === 'lista') return '<ul class="bloco-lista">' + (b.itens || []).map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
    if (b.tipo === 'destaque') return '<div class="bloco-destaque">' + esc(b.texto) + '</div>';
    if (b.tipo === 'alerta') return '<div class="bloco-alerta">⚠️ ' + esc(b.texto) + '</div>';
    if (b.tipo === 'checklist') return '<div class="bloco-check">' + (b.itens || []).map(i =>
      '<label><input type="checkbox"><span>' + esc(i) + '</span></label>').join('') + '</div>';
    return '<p class="bloco-par">' + esc(b.texto) + '</p>';
  }).join('');
}
function blocosParaTexto(blocos) {
  return (blocos || []).map(b => {
    if (b.tipo === 'subtitulo') return '## ' + b.texto;
    if (b.tipo === 'passos') return (b.itens || []).map((i, n) => (n + 1) + '. ' + i).join('\n');
    if (b.tipo === 'lista') return (b.itens || []).map(i => '- ' + i).join('\n');
    if (b.tipo === 'destaque') return '! ' + b.texto;
    if (b.tipo === 'alerta') return '!! ' + b.texto;
    if (b.tipo === 'checklist') return (b.itens || []).map(i => '[ ] ' + i).join('\n');
    return b.texto || '';
  }).join('\n\n');
}
function textoParaBlocos(txt) {
  const out = [];
  let grupo = null; // {tipo, itens}
  const fechar = () => { if (grupo) { out.push(grupo); grupo = null; } };
  for (const linhaCrua of String(txt || '').split('\n')) {
    const l = linhaCrua.trim();
    if (!l) { fechar(); continue; }
    let m;
    if ((m = l.match(/^##\s+(.*)/))) { fechar(); out.push({ tipo: 'subtitulo', texto: m[1] }); }
    else if ((m = l.match(/^!!\s+(.*)/))) { fechar(); out.push({ tipo: 'alerta', texto: m[1] }); }
    else if ((m = l.match(/^!\s+(.*)/))) { fechar(); out.push({ tipo: 'destaque', texto: m[1] }); }
    else if ((m = l.match(/^\[[ xX]?\]\s+(.*)/))) {
      if (!grupo || grupo.tipo !== 'checklist') { fechar(); grupo = { tipo: 'checklist', itens: [] }; }
      grupo.itens.push(m[1]);
    } else if ((m = l.match(/^\d+[.)]\s+(.*)/))) {
      if (!grupo || grupo.tipo !== 'passos') { fechar(); grupo = { tipo: 'passos', itens: [] }; }
      grupo.itens.push(m[1]);
    } else if ((m = l.match(/^[-•]\s+(.*)/))) {
      if (!grupo || grupo.tipo !== 'lista') { fechar(); grupo = { tipo: 'lista', itens: [] }; }
      grupo.itens.push(m[1]);
    } else { fechar(); out.push({ tipo: 'paragrafo', texto: l }); }
  }
  fechar();
  return out;
}

/* ══════════ enviar por WhatsApp ══════════ */
// O POP mora no app (é lá que ele fica versionado e a leitura fica registrada),
// mas a conversa da empresa acontece no WhatsApp. Este botão faz a ponte: manda
// o TRECHO que interessa agora — "olha o ponto de atenção antes de sair" — com
// o link para abrir o resto no app. Sem número de telefone: quem escolhe o
// destinatário é o próprio WhatsApp, com os contatos do aparelho.
const LINK_APP = new URL(location.pathname, location.origin).href;

// Formatação do WhatsApp: *negrito*, e nada de HTML.
function blocosParaWhats(blocos) {
  return (blocos || []).map(b => {
    if (b.tipo === 'subtitulo') return '*' + b.texto + '*';
    if (b.tipo === 'passos') return (b.itens || []).map((i, n) => (n + 1) + '. ' + i).join('\n');
    if (b.tipo === 'lista') return (b.itens || []).map(i => '• ' + i).join('\n');
    if (b.tipo === 'checklist') return (b.itens || []).map(i => '☐ ' + i).join('\n');
    if (b.tipo === 'destaque') return '👉 ' + b.texto;
    if (b.tipo === 'alerta') return '⚠️ ' + b.texto;
    return b.texto || '';
  }).filter(Boolean).join('\n\n');
}

// Fatia o conteúdo em seções pelos subtítulos — são elas que viram as opções
// de envio ("Passo a passo", "Pontos de atenção", "Checklist final"...).
function secoesDe(blocos) {
  const out = [];
  let atual = { titulo: 'Início', blocos: [] };
  (blocos || []).forEach(b => {
    if (b.tipo === 'subtitulo') {
      if (atual.blocos.length) out.push(atual);
      atual = { titulo: b.texto, blocos: [] };
    } else atual.blocos.push(b);
  });
  if (atual.blocos.length) out.push(atual);
  return out;
}

const LIMITE_WHATS = 1500;   // acima disso a mensagem vira parede no celular

function abrirEnviarWhats(item, tipo) {
  const rota = tipo === 'pop' ? '#/pop/' : tipo === 'treinamento' ? '#/treinamento/' : '#/jornada/';
  const link = LINK_APP + rota + encodeURIComponent(item.id);
  const cab = '*' + (item.codigo ? item.codigo + ' · ' : '') + item.titulo + '*' +
    (item.setor ? '\n_' + item.setor + ' · v' + (item.versao || '1.0') + '_' : '');
  const secoes = secoesDe(item.blocos);
  const opcoes = [{ k: 'resumo', rot: '📌 Resumo + link (recomendado)', corpo: item.objetivo || item.resumo || '' }]
    .concat(item.epis && item.epis.length ? [{ k: 'epi', rot: '🦺 EPIs obrigatórios', corpo: '*EPIs obrigatórios*\n' + item.epis.map(e => '• ' + e).join('\n') }] : [])
    .concat(secoes.map((sc, i) => ({ k: 's' + i, rot: '📄 ' + sc.titulo, corpo: '*' + sc.titulo + '*\n' + blocosParaWhats(sc.blocos) })))
    .concat([{ k: 'tudo', rot: '📚 O conteúdo inteiro', corpo: blocosParaWhats(item.blocos) }]);

  const m = abrirModal(
    '<h3>Enviar por WhatsApp</h3>' +
    '<p class="dica">Escolha o que mandar. O link para abrir no app vai junto — assim quem recebe lê a versão sempre atualizada.</p>' +
    '<div class="campo"><label>Recado (opcional)</label>' +
    '<input type="text" id="wa-nota" placeholder="Ex.: Marcos, confere isso antes de sair"></div>' +
    '<div class="campo"><label>O que enviar</label><div id="wa-ops">' +
    opcoes.map(o => '<button class="botao suave largo" style="margin-bottom:8px;text-align:left" data-wa="' + o.k + '">' +
      esc(o.rot) + '</button>').join('') + '</div></div>' +
    '<div class="acoes-modal"><button class="botao fantasma btn-fechar">Cancelar</button></div>'
  );
  $('.btn-fechar', m).onclick = () => m.remove();
  $$('[data-wa]', m).forEach(b => b.onclick = () => {
    const o = opcoes.find(x => x.k === b.dataset.wa);
    const nota = ($('#wa-nota', m).value || '').trim();
    let corpo = o.corpo || '';
    let cortado = false;
    if (corpo.length > LIMITE_WHATS) { corpo = corpo.slice(0, LIMITE_WHATS).replace(/\s+\S*$/, ''); cortado = true; }
    const txt = [
      nota, cab, corpo,
      cortado ? '_(trecho — o conteúdo completo está no app)_' : '',
      'Abrir no app: ' + link,
    ].filter(Boolean).join('\n\n');
    // wa.me SEM número: o próprio WhatsApp pergunta para quem — nenhum telefone
    // sai do RH para cá, e quem escolhe o destinatário é quem está enviando.
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    m.remove();
  });
}

/* ══════════ leituras e progresso ══════════ */
function registroDaPessoa(colecao, prefixo, campo, refId, usuario) {
  const u=norm(usuario), pessoa=u===norm(SESSAO?.usuario)?minhaPessoa():pessoas().find(p=>norm(p.usuario)===u);
  const rhId=pessoa?.colaboradorId;
  const atuais=STORE.col(colecao).filter(r=>r[campo]===refId && (rhId?r.colaboradorId===rhId || (!r.colaboradorId && norm(r.usuario)===u):norm(r.usuario)===u));
  atuais.sort((a,b)=>String(b.em || b.atualizadoEm || '').localeCompare(String(a.em || a.atualizadoEm || '')));
  const legado=STORE.um(colecao,prefixo+'-'+u+'-'+refId);
  return atuais[0] || (legado && (!rhId || !legado.colaboradorId || legado.colaboradorId===rhId)?legado:null);
}
function minhaLeitura(popId) { return registroDaPessoa('leituras','l','popId',popId,SESSAO.usuario); }

function registrarLeitura(pop) {
  return salvarLocal('leituras', {
    id: 'l-' + norm(SESSAO.usuario) + '-' + pop.id,
    usuario: norm(SESSAO.usuario), nome: SESSAO.nome,
    popId: pop.id, versaoLida: pop.versao || '1.0', em: new Date().toISOString(),
  });
}
function meuProgresso(jId) {
  const anterior=registroDaPessoa('progresso','j','jornadaId',jId,SESSAO.usuario);
  return anterior ? {...anterior,id:'j-'+norm(SESSAO.usuario)+'-'+jId,usuario:norm(SESSAO.usuario),nome:SESSAO.nome} :
    { id: 'j-' + norm(SESSAO.usuario) + '-' + jId, usuario: norm(SESSAO.usuario), nome: SESSAO.nome, jornadaId: jId, etapas: {} };
}

/* ══════════ pessoas, atribuições e treinamentos ══════════ */
// A pessoa vem do RH (espelho mínimo). A CONTA vem da Central. O elo entre as
// duas é o campo `usuario` da pessoa — é ele que faz "o treinamento do Fulano"
// virar "o que EU tenho para fazer" quando o Fulano entra no app.
function pessoas() { return STORE.col('pessoas').sort((a, b) => a.nome.localeCompare(b.nome)); }
function minhaPessoa() {
  if (!SESSAO) return null;
  if (SESSAO.pessoaRH) return {...(STORE.um('pessoas', SESSAO.pessoaRH.id) || {}),...SESSAO.pessoaRH};
  if (SESSAO.identidadeConferida) return null;
  return pessoas().find(p => p.usuario && norm(p.usuario) === norm(SESSAO.usuario)) || null;
}
function podeRegistrarAprendizado() {
  return !(SESSAO?.identidadeConferida && !SESSAO.pessoaRH && SESSAO.vinculoRH !== 'sem_vinculo_central');
}
let identidadeEmCurso = null;
async function atualizarIdentidadeRH() {
  if (identidadeEmCurso) return identidadeEmCurso;
  identidadeEmCurso = conferirIdentidadeRH();
  try { await identidadeEmCurso; } finally { identidadeEmCurso = null; }
}
async function conferirIdentidadeRH() {
  const usuario = SESSAO?.usuario, cracha = AUTH.cracha();
  if (!usuario) return;
  try {
    const r = await STORE.api('identidadeRH');
    if (SESSAO?.usuario !== usuario || AUTH.cracha() !== cracha) return;
    const proxima = { ...SESSAO, pessoaRH:r.vinculada ? r.pessoa : null, vinculoRH:r.motivo || '', identidadeConferida:true };
    if (JSON.stringify(proxima) !== JSON.stringify(SESSAO) && STORE.setUser(proxima)) SESSAO = STORE.getUser();
  } catch { /* Offline conserva o último vínculo validado, sem inventar uma pessoa. */ }
}
async function sincronizarAgora() {
  await atualizarIdentidadeRH();
  if (!SESSAO) return;
  STORE.trySync(); await STORE.pull();
}
function catalogoLocal() { return {pops:STORE.col('pops'),jornadas:STORE.col('jornadas'),treinamentos:STORE.col('treinamentos')}; }
function revisaoPop(p) { return window.POPS_ORGANIZACAO.revisao(p); }
function cartaoConteudo(p) {
  const tipo=p.tipo || 'pop', t=TIPOS_CONTEUDO[tipo];
  return '<a class="item-lista" href="'+t.rota+encodeURIComponent(p.id)+'"><div class="cod">'+esc(p.codigo || t.rot)+'</div><h3>'+esc(p.titulo)+'</h3><p class="dica">'+esc(p.objetivo || p.resumo || p.descricao || p.setor || '')+'</p><div class="meta"><span class="selo setor">'+esc(t.rot)+'</span>'+(p.setor?'<span>'+esc(p.setor)+'</span>':'')+'</div></a>';
}
function htmlVinculoRH() {
  const p=minhaPessoa();
  return '<div class="card vinculo-rh"><div class="sub">Sua identidade na equipe</div>'+(p ? '<h2>'+esc(p.nome)+'</h2><p>'+esc([p.funcao,p.area,p.setor].filter(Boolean).join(' · '))+'</p><span class="selo lido">Vinculado ao RH</span><p class="dica">Seus procedimentos e treinamentos acompanham sua ficha de colaborador.</p>' : '<h2>'+esc(SESSAO.nome)+'</h2><p>O vínculo com sua ficha do RH ainda precisa ser conferido na Central de Acessos.</p><p class="dica">Você pode consultar a biblioteca. As atribuições pessoais aparecem depois do vínculo.</p>')+'</div>';
}

const TIPOS_CONTEUDO = {
  pop: { rot: 'POP', col: 'pops', rota: '#/pop/' },
  jornada: { rot: 'Jornada', col: 'jornadas', rota: '#/jornada/' },
  treinamento: { rot: 'Treinamento', col: 'treinamentos', rota: '#/treinamento/' },
};
function conteudoDe(a) {
  const t = TIPOS_CONTEUDO[a.tipo];
  return t ? STORE.um(t.col, a.refId) : null;
}
function atribuicoesDe(pessoaId) {
  return STORE.col('atribuicoes').filter(a => a.pessoaId === pessoaId);
}
// Atribuição cujo conteúdo foi APAGADO depois (o POP saiu do ar, a jornada foi
// removida). Ela não some sozinha: sem tratar, a pessoa nunca consegue concluir
// (a tela nem mostra) e o gestor vê "0/1" para sempre, sem entender por quê.
// Então: não conta contra a pessoa, e aparece para o gestor limpar.
function atribuicaoOrfa(a) { return !conteudoDe(a); }
function atribuicoesValidasDe(pessoaId) {
  return atribuicoesDe(pessoaId).filter(a => !atribuicaoOrfa(a));
}
// Concluído? Cada tipo tem a sua prova: POP = leitura; jornada = todas as
// etapas; treinamento = registro de conclusão (com aceite, quando exigido).
function conclusaoDe(a, usuario) {
  const u = norm(usuario);
  if (a.tipo === 'pop') {
    const l = registroDaPessoa('leituras','l','popId',a.refId,usuario);
    const pop = STORE.um('pops', a.refId);
    if (!l) return null;
    if (pop && l.versaoLida !== (pop.versao || '1.0')) return { em: l.em, desatualizado: true };
    return { em: l.em };
  }
  if (a.tipo === 'jornada') {
    const pr = registroDaPessoa('progresso','j','jornadaId',a.refId,usuario);
    const j = STORE.um('jornadas', a.refId);
    if (!pr || !j) return null;
    const feitas = etapasFeitas(j, pr);
    return (j.etapas || []).length > 0 && feitas === j.etapas.length ? { em: pr.concluidaEm } : null;
  }
  const l = registroDaPessoa('leituras','t','treinamentoId',a.refId,usuario);
  if (!l) return null;
  const t = STORE.um('treinamentos', a.refId);
  if (t && l.versaoLida !== (t.versao || '1.0')) return { em: l.em, desatualizado: true };
  // Reciclagem: treinamento com validade vence e volta a aparecer como pendente.
  if (t && t.validadeMeses && l.em) {
    const venceEm = expiracaoTreinamento(t, l.em);
    if (venceEm && venceEm < new Date()) return { em: l.em, vencido: true, venceuEm: venceEm.toISOString() };
  }
  return { em: l.em };
}
function minhasPendencias() {
  const p = minhaPessoa();
  if (!p) return [];
  return atribuicoesValidasDe(p.id).map(a => ({ a, c: conclusaoDe(a, SESSAO.usuario), item: conteudoDe(a) }))
    .filter(x => !x.c || x.c.vencido || x.c.desatualizado);
}

/* ══════════ shell ══════════ */
function rotuloSync(st) {
  const escola=typeof window!=='undefined'?window.EDUCACAO?.estadoEnvio():null;
  if(escola?.enviando)return 'Confirmando atividade…';
  if(escola?.pendente)return 'Atividade sem confirmação';
  if(escola?.erro)return 'Escola: conferir atualização';
  if(escola?.consultando)return 'Consultando escola…';
  if (!st) return STORE.lastSync() ? 'Atualizado' : 'Atualizando…';
  if (st.status === 'erro') return st.naoGravados ? 'Alteração não salva' : 'Atualização pendente';
  if (st.status === 'parcial') return 'Atualização parcial';
  if (st.status === 'aguardando') return 'Aguardando atualização';
  if (st.status === 'sincronizando') return 'Sincronizando…';
  if (st.status === 'ok') return STORE.lastSync() ? 'Sincronizado' : 'Conferindo dados…';
  if (st.status === 'revisar') return st.pendentes + ' para revisar';
  if (st.status === 'pendente') return st.pendentes + ' pendente(s)';
  if (st.status === 'offline') return 'Sem internet';
  return 'Servidor fora';
}
let _ultimoSync = STORE.resumoSync();
if(typeof window!=='undefined' && typeof window.addEventListener==='function')window.addEventListener('educacao:estado',()=>{const chip=$('#chip-sync');if(chip){chip.textContent=rotuloSync(_ultimoSync);const e=window.EDUCACAO.estadoEnvio();chip.classList.toggle('pendente',_ultimoSync?.status!=='ok'||!!(e.pendente||e.erro||e.enviando));}});
let _avisoConhecimento = '';
let _avisoCache = '';
STORE.on('conhecimentoErro', erro => { _avisoConhecimento=erro?'A base de conhecimento não pôde ser atualizada. Os procedimentos continuam disponíveis; tente sincronizar novamente.':''; });
STORE.on('cachePreservado', info => { if (info.pendentes || info.rascunhos) _avisoCache='Alterações do acesso anterior foram preservadas para conferência. Elas não serão enviadas com a nova identidade.'; });
STORE.on('sync', st => {
  _ultimoSync = st;
  const chip = $('#chip-sync');
  if (chip) { chip.textContent = rotuloSync(st); chip.classList.toggle('pendente', st.status !== 'ok'); }
});
STORE.on('pull', () => { if(STORE.getConhecimento().versao===window.CONHECIMENTO_VERSAO) _avisoConhecimento=''; if (!document.querySelector('dialog[open], textarea:focus, input:focus, select:focus') && !['editor','formacao-editor','formacao','material-editor','material','perfil-editor','perfil-teste'].includes(ROTA.nome)) renderApp(); });
STORE.on('escopoGestor', () => {if(SESSAO?.papel==='gestor' && ['pessoas','mapa','meus'].includes(ROTA.nome))renderApp();});
STORE.on('pullErro', msg => { _ultimoSync = { status: 'erro' }; const chip = $('#chip-sync'); if (chip) { chip.textContent = 'Atualização pendente'; chip.title = msg; } });
STORE.on('sessao', msg => { AUTH.esquecer(); STORE.setUser(null); SESSAO = null; _ultimoSync = null; renderApp(); toast(msg, 'erro'); });
STORE.on('quota', () => { _ultimoSync=STORE.resumoSync(); const chip=$('#chip-sync'); if(chip){chip.textContent=rotuloSync(_ultimoSync);chip.classList.add('pendente');} toast('Não foi possível gravar neste aparelho. Abra o estado de sincronização para tentar novamente ou baixar uma cópia.', 'erro'); });

function htmlTopo(aba) {
  const links=[['inicio','Minha formação','#/'],['pops','POPs','#/pops'],['fab','Fabricação','#/fab'],['meus','Meu aprendizado','#/meus'],['conhecimento','Biblioteca e vídeos','#/biblioteca']];
  if (souAdmin() || meusSetores().length) links.push(['pessoas','Equipe','#/pessoas'],['mapa','Acompanhamento','#/mapa']);
  if(souAdmin() || meusSetores().length || window.EDUCACAO?.podeAcompanhar())links.push(['escola','Gestão da escola','#/escola'],['alunos','Alunos','#/alunos']);
  links.push(['menu','Minha conta','#/menu']);
  return '<a class="pular" href="#conteudo">Ir para o conteúdo</a><header class="app-cab"><div class="topo">' +
    '<a href="#/" aria-label="Início"><img src="./logo-impresilk.png" alt="Impresilk"></a>' +
    '<div class="tit"><b>Painel de Educação</b><span>Impresilk · '+esc(SESSAO.nome)+'</span></div>'+
    '<button class="chip-sync" id="chip-sync" title="Conferir sincronização">'+rotuloSync(_ultimoSync)+'</button></div>'+
    '<nav class="abas" aria-label="Navegação principal">'+links.map(([id,nome,url])=>'<a href="'+url+'" '+(aba===id?'class="ativa" aria-current="page"':'')+'>'+nome+(id==='meus' && minhasPendencias().length?' <b>('+minhasPendencias().length+')</b>':'')+'</a>').join('')+'</nav></header>'+(_avisoConhecimento?'<div class="aviso amarelo aviso-app" role="status">'+esc(_avisoConhecimento)+'</div>':'')+(_avisoCache?'<div class="aviso amarelo aviso-app" role="status">'+esc(_avisoCache)+'</div>':'');
}

function ligarTopo() {
  if (!podeRegistrarAprendizado()) $$('#bt-li, #bt-ok, #bt-concluir').forEach(bt => {
    bt.disabled=true;
    bt.insertAdjacentHTML('afterend','<p class="aviso amarelo">Você pode consultar este conteúdo. Para registrar seu aprendizado, a gestão precisa conferir seu vínculo com o RH.</p>');
  });
  const chip = $('#chip-sync');
  if (chip) chip.onclick = () => { const escola=window.EDUCACAO?.estadoEnvio();if(escola?.pendente || escola?.erro){window.EDUCACAO.conferirEstado();return;} if (STORE.resumoSync().pendentes || ['erro','revisar'].includes(STORE.resumoSync().status)) abrirPendencias(); else { sincronizarAgora(); toast('Conferindo atualizações…'); } };
  associarRotulos($('#app'));
  const conteudo=$('.miolo'); if(conteudo){conteudo.id='conteudo';conteudo.tabIndex=-1;}
  const pular=$('.pular'); if(pular) pular.onclick=e=>{e.preventDefault();conteudo?.focus();};
  $$('[data-etapa], [data-pessoa]').forEach(el => { el.setAttribute('role','button'); el.tabIndex=0; el.onkeydown=e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); el.click(); } }; });
}

/* ══════════ telas ══════════ */
function renderLogin(app) {
  document.title="📋 POPs · Entrada";
  app.innerHTML='<div class="tela-login"><div class="login-layout"><section class="login-apresentacao"><div class="eyebrow">IMPRESILK · CONHECIMENTO EM PRÁTICA</div><h1>O jeito certo de fazer.<br>Ao alcance da equipe.</h1><p>Procedimentos, jornadas de fabricação e aprendizado reunidos em um só lugar.</p><div class="login-beneficios"><p><b>01</b> Encontre o procedimento da sua tarefa.</p><p><b>02</b> Siga cada etapa com clareza.</p><p><b>03</b> Acompanhe o que precisa aprender.</p></div></section><div class="cartao-login"><img src="./logo-impresilk.png" alt="Impresilk"><h2>Entre com sua conta da equipe</h2><p class="sub2">O mesmo usuário e senha da Entrada Única. Sua ficha do RH acompanha você.</p><form id="lg-form"><div class="campo"><label for="lg-u">Usuário da equipe</label><input id="lg-u" type="text" autocomplete="username" autocapitalize="none" required></div><div class="campo"><label for="lg-s">Senha</label><input id="lg-s" type="password" autocomplete="current-password" required></div><div id="lg-erro" role="alert"></div><button class="botao largo" id="lg-entrar" type="submit">Entrar</button><details class="login-alternativo"><summary>Outras formas de acesso</summary><div class="campo"><label for="lg-tipo">Tipo de conta</label><select id="lg-tipo"><option value="rh">Conta da equipe / RH</option><option value="legado">Senha própria antiga dos POPs</option></select></div><a href="https://leogpereira-afk.github.io/painel-impresilk/">Abrir a Entrada Única</a></details></form><p class="dica">O primeiro acesso precisa de internet. Depois de sincronizar, consulte os conteúdos disponíveis mesmo sem sinal.</p></div></div></div>';
  $('#lg-form').onsubmit=async e=>{
    e.preventDefault(); const u=$('#lg-u').value.trim(), senha=$('#lg-s').value;
    if(!u || !senha) return;
    const bt=$('#lg-entrar');bt.disabled=true;bt.textContent='Entrando…';$('#lg-erro').textContent='';
    try {
      const rh=$('#lg-tipo').value==='rh', r=await (rh?AUTH.loginRH(u,senha):AUTH.login(u,senha));
      if(rh && r.trocarSenha){$('#lg-erro').innerHTML='<div class="aviso amarelo">Antes do primeiro acesso, crie sua senha na <a href="https://leogpereira-afk.github.io/painel-impresilk/">Entrada Única</a>. Depois volte aos POPs.</div>';return;}
      if(!STORE.setUser({usuario:r.usuario,nome:r.nome,papel:r.papel,trocarSenha:!!r.trocarSenha,origemLogin:rh?'rh':'legado'}))throw new Error('Não consegui guardar a sessão neste aparelho.');
      SESSAO=STORE.getUser();_ultimoSync=null;await atualizarIdentidadeRH();STORE.trySync();STORE.pull();location.hash=r.trocarSenha?'#/senha':'#/';renderApp();
    } catch(err){$('#lg-erro').innerHTML='<div class="aviso vermelho">'+esc(err.erro || err.message || 'Não foi possível entrar. Tente novamente.')+'</div>';}
    finally {if(bt.isConnected){bt.disabled=false;bt.textContent='Entrar';}}
  };
}
function renderInicio(app) { return window.EDUCACAO.render(app); }
function renderInicioLegado(app) {
  const p=minhaPessoa(), pend=minhasPendencias(), pops=STORE.col('pops'), jornadas=STORE.col('jornadas');
  const atribuicoes=p?atribuicoesValidasDe(p.id):[], concluidas=atribuicoes.length-pend.length;
  const revisar=pops.filter(x=>!revisaoPop(x).validada).length;
  app.innerHTML=htmlTopo('inicio')+'<div class="miolo"><section class="painel-hero"><div class="eyebrow">APRENDER · EXECUTAR · EVOLUIR</div><h1>Seu trabalho, com o próximo passo claro.</h1><p>Encontre orientações, retome seu aprendizado e leve o conhecimento da Impresilk para a prática.</p><div class="acoes"><a class="botao" href="#/meus">Meu aprendizado'+(pend.length?' · '+pend.length+' pendentes':'')+'</a><a class="botao suave" href="#/pops">Explorar procedimentos</a></div></section><div class="indicadores"><div class="indicador"><b>'+pops.length+'</b><span>Procedimentos disponíveis</span></div><div class="indicador"><b>'+jornadas.length+'</b><span>Jornadas de fabricação</span></div><div class="indicador"><b>'+concluidas+'/'+atribuicoes.length+'</b><span>Atribuições em dia</span></div>'+(souAdmin()?'<div class="indicador"><b>'+revisar+'</b><span>POPs para revisar</span></div>':'')+'</div><section class="card"><div class="secao-titulo"><h2>Encontre o que precisa</h2></div><div class="campo busca-global"><label for="inicio-busca">Buscar por tarefa, material, código ou palavra</label><input id="inicio-busca" type="search" placeholder="Ex.: lona, ACM, expedição, POP-CMP-01"></div><div id="inicio-resultados" aria-live="polite"><p class="dica">Busca nos POPs, jornadas e treinamentos já sincronizados.</p></div></section><div class="painel-grid"><section class="card"><div class="secao-titulo"><h2>Seu próximo passo</h2><a href="#/meus">Ver todos</a></div>'+(pend.length?pend.slice(0,3).map(x=>cartaoConteudo({...x.item,tipo:x.a.tipo})).join(''):'<div class="aprendizado-vazio"><h3>'+(p?'Nenhuma atribuição pendente':'Conheça a biblioteca')+'</h3><p>'+(p?'Explore os procedimentos ou retome uma jornada. Novas atribuições aparecem aqui.':'Enquanto a gestão confere seu vínculo, você já pode consultar os procedimentos.')+'</p><a class="botao suave" href="#/fab">Ver jornadas</a></div>')+'</section>'+htmlVinculoRH()+'</div><section class="card"><div class="secao-titulo"><h2>Conhecimento da Impresilk</h2><a href="#/conhecimento">Abrir base</a></div><p>Entenda como as áreas se conectam, consulte os princípios da empresa e veja as oportunidades de evolução identificadas.</p><p class="dica">Os conteúdos de referência indicam sua fonte. Sugestões de melhoria não substituem procedimentos validados.</p></section></div>';
  ligarTopo();$('#inicio-busca').oninput=e=>{const q=e.target.value.trim(),rs=q?window.POPS_ORGANIZACAO.buscar(catalogoLocal(),q):[];$('#inicio-resultados').innerHTML=q?'<p class="dica">'+rs.length+' resultado(s)</p>'+rs.slice(0,12).map(cartaoConteudo).join(''):'<p class="dica">Busca nos POPs, jornadas e treinamentos já sincronizados.</p>';};
}

// A lista de POPs com 21 setores não cabe numa fileira de chips no celular.
// Então são dois níveis: primeiro a MACROÁREA, depois os setores dela — e cada
// setor mostra quantos POPs tem, inclusive ZERO. Ver o vazio é o mais útil:
// é assim que se enxerga onde falta procedimento escrito.
function renderPops(app) {
  const todos=STORE.col('pops'), alvo=ROTA.arg || '', asAreas=areas();
  const areaSel=asAreas.find(a=>norm(a.nome)===norm(alvo)), setorSel=!areaSel && alvo?alvo:'';
  const areaAberta=areaSel || (setorSel?areaDoSetor(setorSel):null);
  const daTela=todos.filter(p=>setorSel?norm(p.setor)===norm(setorSel):areaAberta?(areaAberta.setores || []).some(x=>norm(x)===norm(p.setor)):true).sort((a,b)=>String(a.codigo || '').localeCompare(String(b.codigo || '')));
  app.innerHTML=htmlTopo('pops')+'<div class="miolo"><section class="painel-hero"><div class="eyebrow">BIBLIOTECA DE PROCEDIMENTOS</div><h1>Encontre. Confira. Execute.</h1><p>Busque pela tarefa ou navegue pelas áreas. A versão e a situação da revisão acompanham cada procedimento.</p></section><div class="chips"><a class="chip '+(!alvo?'marcado':'')+'" href="#/pops">Todos · '+todos.length+'</a>'+asAreas.map(a=>'<a class="chip '+(areaAberta===a?'marcado':'')+'" href="#/pops/'+encodeURIComponent(a.nome)+'">'+esc(a.nome)+'</a>').join('')+'</div>'+(areaAberta?'<div class="chips">'+(areaAberta.setores || []).map(st=>'<a class="chip '+(st===setorSel?'marcado':'')+'" href="#/pops/'+encodeURIComponent(st)+'">'+esc(st)+' · '+todos.filter(p=>p.setor===st).length+'</a>').join('')+'</div>':'')+'<section class="card"><div class="painel-grid"><div class="campo busca-global"><label for="pop-busca">Buscar neste grupo</label><input id="pop-busca" type="search" placeholder="Código, material ou instrução"></div><div class="campo"><label for="pop-filtro">Mostrar</label><select id="pop-filtro"><option value="todos">Todos os procedimentos</option><option value="pendentes">Minha leitura pendente</option><option value="lidos">Minha leitura em dia</option><option value="revisar">Precisam de revisão</option></select></div></div><p id="pop-contagem" class="dica" aria-live="polite"></p></section><div id="pop-resultados" class="conteudo-grid"></div>'+(souAdmin() || meusSetores().length?'<div class="acoes"><a class="botao" href="#/editor/pop/novo">Criar procedimento</a></div>':'')+'</div>';
  const pintar=()=>{
    const busca=$('#pop-busca').value, filtro=$('#pop-filtro').value;
    const encontrados=window.POPS_ORGANIZACAO.buscar({pops:daTela},busca).filter(p=>{const l=minhaLeitura(p.id),emDia=l?.versaoLida===(p.versao || '1.0');return filtro==='pendentes'?!emDia:filtro==='lidos'?emDia:filtro==='revisar'?!revisaoPop(p).validada:true;});
    $('#pop-contagem').textContent=encontrados.length+' procedimento(s) neste filtro';
    $('#pop-resultados').innerHTML=encontrados.length?encontrados.map(p=>{const l=minhaLeitura(p.id),ok=l?.versaoLida===(p.versao || '1.0'),r=revisaoPop(p);return '<a class="item-lista" href="#/pop/'+encodeURIComponent(p.id)+'"><div class="cod">'+esc(p.codigo || 'POP')+' · v'+esc(p.versao || '1.0')+'</div><h2>'+esc(p.titulo)+'</h2><p>'+esc(p.objetivo || '')+'</p><div class="meta"><span class="selo setor">'+esc(p.setor || 'Geral')+'</span><span class="selo '+(ok?'lido':'pendente')+'">'+(ok?'Leitura em dia':l?'Mudou · releia':'Não lido')+'</span><span class="selo '+(r.validada?'lido':'pendente')+'">'+esc(r.rotulo)+'</span></div></a>';}).join(''):'<div class="card"><h2>Nenhum procedimento encontrado</h2><p>Tente outra palavra ou altere os filtros.</p></div>';
  };$('#pop-busca').oninput=pintar;$('#pop-filtro').onchange=pintar;pintar();ligarTopo();
}
function baseConhecimento() { return window.POPS_CONHECIMENTO.criar(STORE.getConhecimento()); }
function htmlRelacionados(p) {
  const dados=catalogoLocal(), base=baseConhecimento(), sugestoes=base.relacionados(p);
  const vinculados=window.POPS_ORGANIZACAO.relacionados(p,dados);
  const ids=new Set(vinculados.map(x=>x.tipo+':'+x.id));
  const relacionados=dados.pops.filter(x=>sugestoes.pops.includes(x.codigo) && !ids.has('pop:'+x.id));
  const jornadas=dados.jornadas.filter(x=>sugestoes.jornadas.some(j=>j.id===x.id) && !ids.has('jornada:'+x.id));
  return '<section class="card conteudo-relacionado"><h2>Conexões deste procedimento</h2>'+(vinculados.length?'<h3>Vínculos registrados</h3>'+vinculados.map(cartaoConteudo).join(''):'<p class="dica">Ainda não há vínculos registrados pela gestão.</p>')+(relacionados.length || jornadas.length?'<h3>Referências relacionadas</h3><p class="dica">Sugestões da base documental para consultar o processo completo.</p><div class="conteudo-grid">'+relacionados.slice(0,4).map(x=>cartaoConteudo({...x,tipo:'pop'})).join('')+jornadas.slice(0,3).map(x=>cartaoConteudo({...x,tipo:'jornada'})).join('')+'</div>':'')+sugestoes.topicos.map(t=>'<a class="botao suave" href="#/conhecimento/'+encodeURIComponent(t.id)+'">'+esc(t.titulo)+'</a>').join(' ')+'</section>';
}
function abasConhecimento(referencias) {
  return '<nav class="chips treino-abas" aria-label="Base de conhecimento"><a class="chip '+(!referencias?'marcado':'')+'" href="#/conhecimento"'+(!referencias?' aria-current="page"':'')+'>Treinamentos</a><a class="chip '+(referencias?'marcado':'')+'" href="#/conhecimento/referencias"'+(referencias?' aria-current="page"':'')+'>Referências da empresa</a></nav>';
}
function atribuirTreinamento(t) {
  if (!souAdmin()) return;
  abrirLote([{tipo:'treinamento',id:t.id,titulo:t.titulo,grupo:'Treinamentos'}]);
}
function renderConhecimento(app) {
  if (ROTA.arg) { renderReferencias(app); return; }
  const lista=STORE.col('treinamentos').slice().sort((a,b)=>String(a.titulo).localeCompare(String(b.titulo),'pt-BR'));
  const ss=[...new Set(lista.map(t=>t.setor || 'Geral'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  app.innerHTML=htmlTopo('conhecimento')+'<div class="miolo"><header class="treino-cab"><div><div class="eyebrow">BASE DE CONHECIMENTO</div><h1>Aprender para fazer melhor.</h1><p>Treinamentos e orientações para consultar no dia a dia.</p></div>'+(souAdmin()?'<a class="botao" href="#/editor/treinamento/novo">+ Novo treinamento</a>':'')+'</header>'+abasConhecimento(false)+
    '<section class="card treino-filtros"><div class="campo"><label for="treino-busca">Encontrar treinamento</label><input id="treino-busca" type="search" placeholder="Título, assunto ou instrução"></div><div class="campo"><label for="treino-setor">Setor</label><select id="treino-setor"><option value="">Todos os setores</option>'+ss.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></div><p id="treino-contagem" class="dica" aria-live="polite"></p></section><div id="treino-lista" class="conteudo-grid"></div></div>';
  function pintar() {
    const q=norm($('#treino-busca').value), setor=$('#treino-setor').value;
    const encontrados=lista.filter(t=>(!setor || (t.setor || 'Geral')===setor) && norm([t.titulo,t.resumo,t.setor,t.responsavel,blocosParaTexto(t.blocos),(t.materiais || []).map(m=>m.titulo).join(' ')].join(' ')).includes(q));
    $('#treino-contagem').textContent=encontrados.length+' de '+lista.length+' treinamento(s)';
    $('#treino-lista').innerHTML=encontrados.length?encontrados.map(t=>{
      const c=conclusaoDe({tipo:'treinamento',refId:t.id},SESSAO.usuario), emDia=c && !c.desatualizado && !c.vencido;
      const status=emDia?'Leitura em dia':c?.desatualizado?'Nova versão · releia':c?.vencido?'Reciclagem pendente':'Ainda não concluído';
      return '<article class="card treino-card"><div class="meta"><span class="selo setor">'+esc(t.setor || 'Geral')+'</span><span class="selo '+(emDia?'lido':'pendente')+'">'+status+'</span></div><h2><a href="#/treinamento/'+encodeURIComponent(t.id)+'">'+esc(t.titulo)+'</a></h2><p>'+esc(t.resumo || 'Abra para consultar as instruções e os materiais de apoio.')+'</p><div class="dica">Versão '+esc(t.versao || '1.0')+((t.materiais || []).length?' · '+t.materiais.length+' material(is) de apoio':'')+'</div>'+(t.revisadoEm?'<p class="dica">Atualizado em '+fmtData(t.revisadoEm)+(t.revisadoPor?' por '+esc(t.revisadoPor):'')+'</p>':'')+'<div class="acoes"><a class="botao mini suave" href="#/treinamento/'+encodeURIComponent(t.id)+'">Abrir treinamento</a>'+(souAdmin()?'<a class="botao mini fantasma" href="#/editor/treinamento/'+encodeURIComponent(t.id)+'">Editar</a><button class="botao mini fantasma" data-atribuir-treino="'+esc(t.id)+'" aria-label="Atribuir '+esc(t.titulo)+'">Atribuir</button>':'')+'</div></article>';
    }).join(''):'<section class="card treino-vazio"><h2>'+(lista.length?'Nenhum resultado':'O conhecimento da equipe começa aqui')+'</h2><p>'+(lista.length?'Tente outra palavra ou selecione todos os setores.':souAdmin()?'Cadastre um treinamento específico com instruções e materiais de apoio. Depois, escolha quem precisa fazê-lo.':'Os treinamentos cadastrados pela gestão aparecerão aqui.')+'</p></section>';
    $$('[data-atribuir-treino]').forEach(bt=>bt.onclick=()=>atribuirTreinamento(STORE.um('treinamentos',bt.dataset.atribuirTreino)));
  }
  $('#treino-busca').oninput=pintar;$('#treino-setor').onchange=pintar;pintar();ligarTopo();
}

function renderReferencias(app) {
  const k=baseConhecimento(), alvo=ROTA.arg;
  const fontesHtml=t=>(t.fontes || []).map(id=>{const f=k.fonteDe(id);return f?'<li>'+esc(f.titulo)+' · '+fmtData(f.data)+(f.url && /^https:\/\//.test(f.url)?' · <a href="'+esc(f.url)+'" target="_blank" rel="noopener noreferrer">Abrir documento</a>':'')+'</li>':'';}).join('');
  const topico=t=>'<article class="card conhecimento-card"><div class="meta"><span class="selo setor">'+esc(k.status[t.status] || t.status || 'Referência')+'</span></div><h2>'+esc(t.titulo)+'</h2><p>'+esc(t.resumo)+'</p><ol>'+t.passos.map(x=>'<li>'+esc(x)+'</li>').join('')+(t.pendencias.length?'<div class="aviso amarelo"><b>Pontos para conferir</b><ul>'+t.pendencias.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'')+'<div class="chips">'+STORE.col('pops').filter(p=>t.codigos.includes(p.codigo)).map(p=>'<a class="chip" href="#/pop/'+encodeURIComponent(p.id)+'">'+esc(p.codigo)+'</a>').join('')+'</div><details class="fonte-nota"><summary>Fontes desta orientação</summary><ul>'+fontesHtml(t)+'</ul></details></article>';
  app.innerHTML=htmlTopo('conhecimento')+'<div class="miolo"><header class="treino-cab"><div><div class="eyebrow">BASE DE CONHECIMENTO</div><h1>Referências da empresa</h1><p>'+esc(k.aviso || 'A base de conhecimento será carregada na próxima sincronização com internet.')+'</p></div></header>'+abasConhecimento(true)+(k.identidade?.missao?'<div class="painel-grid"><section class="card"><div class="sub">Nossa missão</div><h2>'+esc(k.identidade.missao)+'</h2></section><section class="card"><div class="sub">Nossa visão</div><h2>'+esc(k.identidade.visao)+'</h2></section></div>':'')+'<div class="card"><div class="campo busca-global"><label for="conhecimento-busca">Buscar na base</label><input id="conhecimento-busca" type="search" placeholder="Compras, preços, passagem de setor, comissões…"></div><div class="chips"><button class="chip" id="conhecimento-todos">Todos os temas</button></div><p class="dica">Organizado em '+fmtData(k.compiladoEm)+'. A data de cada fonte aparece no tema.</p></div><div id="conhecimento-lista"></div>'+(k.identidade?.missao?'<details class="card"><summary>Os 12 valores da Impresilk</summary>'+k.identidade.valores.map(v=>'<h3>'+esc(v.titulo)+'</h3><p>'+esc(v.texto)+'</p>').join('')+'</details>':'')+'</div>';
  const pintar=q=>{const itens=k.buscar(q);$('#conhecimento-lista').innerHTML=itens.length?itens.map(topico).join(''):'<div class="card">Nenhum tema encontrado. Confira a sincronização ou tente outra busca.</div>';};
  const escolhido=k.topicos.find(t=>t.id===alvo);if(escolhido)$('#conhecimento-lista').innerHTML=topico(escolhido);else pintar('');
  $('#conhecimento-busca').oninput=e=>pintar(e.target.value);$('#conhecimento-todos').onclick=()=>{$('#conhecimento-busca').value='';pintar('');};ligarTopo();
}

function renderPop(app) {
  const p = STORE.um('pops', ROTA.arg);
  if (!p) { location.hash = '#/pops'; return; }
  const li = minhaLeitura(p.id);
  const desatualizada = li && li.versaoLida !== (p.versao || '1.0');
  const quemLeu = (souAdmin() || possoEditar(p))
    ? STORE.col('leituras').filter(l => l.popId === p.id)
    : [];
  app.innerHTML = htmlTopo('pops') +
    '<div class="miolo">' +
    '<div class="card pop-cab">' +
    (p.codigo ? '<div class="cod" style="color:var(--cinza-4); font-weight:700; font-size:12.5px">' + esc(p.codigo) + '</div>' : '') +
    '<h1>' + esc(p.titulo) + '</h1>' +
    '<div class="linha-meta"><span class="selo setor">' + esc(p.setor || 'Geral') + '</span>' +
    '<span>versão ' + esc(p.versao || '1.0') + '</span>' +
    (p.revisadoEm ? '<span>atualizado em ' + fmtData(p.revisadoEm) + '</span>' : '') +
    (p.responsavel ? '<span>executa: ' + esc(p.responsavel) + '</span>' : '') + '</div>' +
    (p.objetivo ? '<div class="aviso azul" style="margin-bottom:0"><b>Objetivo:</b> ' + esc(p.objetivo) + '</div>' : '') +
    '</div>' +
    (p.epis && p.epis.length ? '<div class="card"><div class="sub">EPIs obrigatórios</div><div class="chips" style="margin:0">' +
      p.epis.map(e => '<span class="chip">🦺 ' + esc(e) + '</span>').join('') + '</div></div>' : '') +
    '<div class="aviso '+(revisaoPop(p).validada?'verde':'amarelo')+'"><b>'+esc(revisaoPop(p).rotulo)+'</b> · '+(revisaoPop(p).validada?'Conferido por '+esc(revisaoPop(p).por)+' em '+fmtData(revisaoPop(p).em):'Este conteúdo ainda precisa de conferência do responsável. O registro de leitura não comprova habilitação técnica.')+'</div>' +
    '<div class="card pop-leitura">' + blocosParaHtml(p.blocos) + '</div>' +
    ((p.fontes || []).length?'<div class="card fonte-nota"><h2>Fontes registradas</h2><ul>'+p.fontes.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul></div>':'') +
    htmlRelacionados(p) +
    (desatualizada ? '<div class="aviso amarelo">Este POP mudou desde a sua última leitura (você leu a v' + esc(li.versaoLida) + '). Releia e confirme de novo.</div>' : '') +
    '<div class="acoes">' +
    (li && !desatualizada
      ? '<div class="aviso verde" style="flex:1">✓ Você leu e confirmou em ' + fmtDataHora(li.em) + '</div>'
      : '<button class="botao verde largo" id="bt-li">✔ Li e entendi este procedimento</button>') +
    '</div>' +
    '<div class="acoes"><button class="botao suave" id="bt-whats">💬 Enviar por WhatsApp</button>' +
    (possoEditar(p) ? '<a class="botao suave" href="#/editor/pop/' + p.id + '">✏️ Editar</a>' : '') + '</div>' +
    (quemLeu.length ? '<div class="card"><div class="sub">Quem já leu (' + quemLeu.length + ')</div>' +
      quemLeu.map(l => '<div style="padding:4px 0; border-bottom:1px dashed var(--borda); font-size:14.5px">' +
        esc(l.nome || l.usuario) + ' · v' + esc(l.versaoLida) + ' · ' + fmtDataHora(l.em) +
        (l.versaoLida !== (p.versao || '1.0') ? ' <span class="selo pendente">versão antiga</span>' : '') + '</div>').join('') + '</div>' : '') +
    '</div>';
  ligarTopo();
  const bt = $('#bt-li');
  if (bt) bt.onclick = () => { if (!registrarLeitura(p)) return; toast(mensagemSalvo()); renderApp(); };
  $('#bt-whats').onclick = () => abrirEnviarWhats(p, 'pop');
}

// A fabricação não é uma lista de cursos: é a PEÇA andando pela fábrica. Por
// isso a tela é organizada pelas 4 linhas de produção, mostrando o fluxo real
// (Corte → Metalurgia → Pintura → ...) e, em cada etapa, a jornada que a
// ensina. Etapa sem jornada aparece assim mesmo — o buraco no treinamento fica
// visível em vez de escondido.
function renderFab(app) {
  const js = STORE.col('jornadas');
  const ls = linhas();
  const jornadaDe = setor => js.find(j => norm(j.setor) === norm(setor));
  const pctDe = j => {
    if (!j) return null;
    const total = (j.etapas || []).length;
    const feitas = etapasFeitas(j, meuProgresso(j.id));
    return total ? Math.round(feitas / total * 100) : 0;
  };
  const semLinha = js.filter(j => !j.linha);

  app.innerHTML = htmlTopo('fab') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">Como a peça é feita</div>' +
    '<p class="bloco-par">A Impresilk tem <b>' + ls.length + ' linhas de produção</b>. Cada etapa abaixo tem uma jornada que ensina aquele processo do começo ao fim — na ordem em que a peça anda pela fábrica.</p></div>' +
    ls.map(l => {
      const fluxo = l.fluxo || [];
      const comJornada = fluxo.filter(f => jornadaDe(f.setor)).length;
      return '<div class="card">' +
        '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">' +
        '<h3 style="margin:0;font-size:17.5px">' + esc(l.ic || '') + ' ' + esc(l.nome) + '</h3>' +
        '<span class="selo setor">' + comJornada + '/' + fluxo.length + ' com jornada</span></div>' +
        (l.resumo ? '<p class="bloco-par" style="margin-top:4px">' + esc(l.resumo) + '</p>' : '') +
        '<div class="fluxo">' +
        fluxo.map((f, i) => {
          const j = jornadaDe(f.setor);
          const pct = pctDe(j);
          const cls = !j ? ' sem' : (pct >= 100 ? ' feita' : (pct ? ' andando' : ''));
          const dentro =
            '<div class="fx-etapa' + cls + '">' +
            '<div class="fx-n">' + (i + 1) + '</div>' +
            '<div class="fx-t"><b>' + esc(f.etapa) + '</b>' +
            '<span>' + esc(f.setor) + '</span></div>' +
            '<div class="fx-st">' + (!j ? 'sem jornada'
              : (pct >= 100 ? '🎓' : (pct ? pct + '%' : 'começar'))) + '</div>' +
            '</div>';
          return j ? '<a href="#/jornada/' + j.id + '" class="fx-link">' + dentro + '</a>' : dentro;
        }).join('') +
        '</div></div>';
    }).join('') +
    (semLinha.length ? '<div class="card"><div class="sub">Fora das linhas</div>' +
      semLinha.map(j => '<a class="item-lista" href="#/jornada/' + j.id + '" style="margin-bottom:6px">' +
        '<h3>' + esc(j.titulo) + '</h3></a>').join('') + '</div>' : '') +
    (souAdmin() ? '<div class="acoes"><a class="botao suave largo" href="#/editor/jornada/novo">➕ Nova jornada</a></div>' : '') +
    '</div>';
  ligarTopo();
}

function renderJornada(app) {
  const j = STORE.um('jornadas', ROTA.arg);
  if (!j) { location.hash = '#/fab'; return; }
  const pr = meuProgresso(j.id);
  const etapas = j.etapas || [];
  const feitas = etapasFeitas(j, pr);
  const pct = etapas.length ? Math.round(feitas / etapas.length * 100) : 0;
  app.innerHTML = htmlTopo('fab') +
    '<div class="miolo">' +
    '<div class="card pop-cab"><h1>' + esc(j.titulo) + '</h1>' +
    '<div class="linha-meta">' + (j.nivel ? '<span class="selo setor">' + esc(j.nivel) + '</span>' : '') +
    '<span>' + etapas.length + ' etapas</span><span>v' + esc(j.versao || '1.0') + '</span></div>' +
    (j.descricao ? '<p class="bloco-par">' + esc(j.descricao) + '</p>' : '') +
    '<div class="prog-barra"><i style="width:' + pct + '%"></i></div>' +
    (pct >= 100 ? '<div class="aviso verde">🎓 Jornada concluída em ' + fmtDataHora(pr.concluidaEm) + ' — você domina este processo.</div>' : '') +
    '</div>' +
    '<div class="card">' +
    etapas.map((e, i) => {
      const feita = !!(pr.etapas || {})[e.id];
      const liberada = i === 0 || !!(pr.etapas || {})[(etapas[i - 1] || {}).id];
      return '<div class="etapa-linha" data-etapa="' + i + '">' +
        '<div class="etapa-num' + (feita ? ' feita' : '') + '">' + (feita ? '✓' : (i + 1)) + '</div>' +
        '<div class="t"><b>' + esc(e.titulo) + '</b>' +
        '<span>' + (feita ? 'concluída' : (liberada ? 'disponível' : 'conclua a etapa anterior')) + '</span></div>' +
        '<div>›</div></div>';
    }).join('') +
    '</div>' +
    '<div class="acoes"><button class="botao suave" id="bt-whats">💬 Enviar por WhatsApp</button>' +
    (souAdmin() ? '<a class="botao suave" href="#/editor/jornada/' + j.id + '">✏️ Editar</a>' : '') + '</div>' +
    '</div>';
  ligarTopo();
  // A jornada não tem `blocos` — o conteúdo mora nas etapas. Manda a trilha:
  // título, descrição e a lista das etapas, com o link para fazer no app.
  $('#bt-whats').onclick = () => abrirEnviarWhats({
    id: j.id, titulo: j.titulo, versao: j.versao, setor: j.setor,
    objetivo: j.descricao || '',
    blocos: [{ tipo: 'subtitulo', texto: 'Etapas' },
             { tipo: 'passos', itens: (j.etapas || []).map(e => e.titulo) }],
  }, 'jornada');
  $$('[data-etapa]').forEach(l => l.onclick = () => {
    location.hash = '#/etapa/' + j.id + '/' + l.dataset.etapa;
  });
}

function renderEtapa(app) {
  const [jId, nStr] = (ROTA.arg || '').split('~');
  const j = STORE.um('jornadas', jId);
  const n = Number(nStr);
  if (!j || !(j.etapas || [])[n]) { location.hash = '#/fab'; return; }
  const e = j.etapas[n];
  const pr = meuProgresso(j.id);
  const feita = !!(pr.etapas || {})[e.id];
  const liberada = n === 0 || !!(pr.etapas || {})[(j.etapas[n - 1] || {}).id];
  app.innerHTML = htmlTopo('fab') +
    '<div class="miolo">' +
    '<a href="#/jornada/' + j.id + '" style="color:var(--azul); font-weight:600; text-decoration:none">← ' + esc(j.titulo) + '</a>' +
    '<div class="card pop-cab" style="margin-top:10px"><h1>Etapa ' + (n + 1) + ' · ' + esc(e.titulo) + '</h1></div>' +
    '<div class="card">' + blocosParaHtml(e.blocos) + '</div>' +
    (!liberada ? '<div class="aviso amarelo">Conclua a etapa anterior primeiro — a ordem faz parte do aprendizado.</div>' : '') +
    '<div class="acoes">' +
    (feita ? '<div class="aviso verde" style="flex:1">✓ Etapa concluída em ' + fmtDataHora(pr.etapas[e.id]) + '</div>'
      : (liberada ? '<button class="botao verde largo" id="bt-concluir">✔ Concluí esta etapa</button>' : '')) +
    '</div>' +
    (n + 1 < j.etapas.length && feita ? '<div class="acoes"><a class="botao largo" href="#/etapa/' + j.id + '/' + (n + 1) + '">Próxima etapa →</a></div>' : '') +
    '</div>';
  ligarTopo();
  const bt = $('#bt-concluir');
  if (bt) bt.onclick = () => {
    pr.etapas = pr.etapas || {};
    pr.etapas[e.id] = new Date().toISOString();
    if (j.etapas.length && etapasFeitas(j, pr) === j.etapas.length && !pr.concluidaEm) pr.concluidaEm = new Date().toISOString();
    pr.etapas = Object.fromEntries((j.etapas || []).filter(e => pr.etapas[e.id]).map(e => [e.id, pr.etapas[e.id]]));
    if (!salvarLocal('progresso', pr)) return;
    toast(mensagemSalvo());
    renderApp();
  };
}

/* ══════════ treinamento: ler, aceitar, concluir ══════════ */
function renderTreinamento(app) {
  const t = STORE.um('treinamentos', ROTA.arg);
  if (!t) { location.hash = '#/meus'; return; }
  const u = norm(SESSAO.usuario);
  const feito = registroDaPessoa('leituras','t','treinamentoId',t.id,u);
  const venc = expiracaoTreinamento(t, feito?.em);
  const desatualizado = feito && feito.versaoLida !== (t.versao || '1.0');
  const vencido = venc && venc < new Date();
  app.innerHTML = htmlTopo('conhecimento') +
    '<div class="miolo"><div class="acoes treino-navegacao"><a class="botao mini fantasma" href="#/conhecimento">← Treinamentos</a>' + (souAdmin()?'<a class="botao mini suave" href="#/editor/treinamento/'+encodeURIComponent(t.id)+'">Editar treinamento</a><button class="botao mini" id="treino-atribuir">Atribuir à equipe</button>':'') + '</div>' +
    '<div class="card pop-cab">' +
    '<div class="cod" style="color:var(--cinza-4);font-weight:700;font-size:12.5px">' +
    (t.tipo === 'etica' ? 'CÓDIGO DE ÉTICA' : t.tipo === 'norma' ? 'NORMA' : 'TREINAMENTO') + '</div>' +
    '<h1>' + esc(t.titulo) + '</h1>' +
    '<div class="linha-meta"><span>versão ' + esc(t.versao || '1.0') + '</span>' +
    (t.validadeMeses ? '<span>reciclagem a cada ' + esc(t.validadeMeses) + ' meses</span>' : '') + (t.setor?'<span>'+esc(t.setor)+'</span>':'') + '</div>' +
    (t.responsavel?'<p class="dica">Responsável pelo conteúdo: '+esc(t.responsavel)+'</p>':'') +
    (t.revisadoEm?'<p class="dica">Atualizado em '+fmtDataHora(t.revisadoEm)+(t.revisadoPor?' por '+esc(t.revisadoPor):'')+'</p>':'') +
    (t.resumo ? '<div class="aviso azul" style="margin-bottom:0">' + esc(t.resumo) + '</div>' : '') +
    '</div>' +
    '<div class="card">' + blocosParaHtml(t.blocos) + '</div>' +
    htmlMateriaisTreinamento(t.materiais) +
    (desatualizado ? '<div class="aviso amarelo">O documento mudou. Leia a versão atual e confirme novamente.</div>' : '') +
    (vencido ? '<div class="aviso amarelo">Sua confirmação venceu em ' + fmtData(venc.toISOString()) + '. Releia e confirme de novo.</div>' : '') +
    '<div class="acoes">' +
    (feito && !vencido && !desatualizado
      ? '<div class="aviso verde" style="flex:1">✓ ' + (t.exigeAceite ? 'Aceito' : 'Concluído') + ' em ' + fmtDataHora(feito.em) +
        (venc ? ' · vale até ' + fmtData(venc.toISOString()) : '') + '</div>'
      : '<button class="botao verde largo" id="bt-ok">' +
        (t.exigeAceite ? '✔ Li, entendi e me comprometo' : '✔ Concluí este treinamento') + '</button>') +
    '</div>' +
    '<div class="acoes"><button class="botao suave" id="bt-whats">💬 Enviar por WhatsApp</button></div>' +
    '</div>';
  ligarTopo();
  $('#bt-whats').onclick = () => abrirEnviarWhats(t, 'treinamento');
  if ($('#treino-atribuir')) $('#treino-atribuir').onclick=()=>atribuirTreinamento(t);
  const bt = $('#bt-ok');
  if (bt) bt.onclick = () => {
    if (t.exigeAceite && !confirm('Confirmar o aceite de "' + t.titulo + '"?\n\nFica registrado com o seu nome, a data e a versão do documento.')) return;
    if (!salvarLocal('leituras', {
      id: 't-' + u + '-' + t.id, usuario: u, nome: SESSAO.nome, treinamentoId: t.id,
      versaoLida: t.versao || '1.0', aceite: !!t.exigeAceite, em: new Date().toISOString(),
    })) return;
    toast(mensagemSalvo());
    renderApp();
  };
}

/* ══════════ meus treinamentos ══════════ */
function renderMeus(app) {
  const p = minhaPessoa();
  const ts = STORE.col('treinamentos').sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
  const atrib = p ? atribuicoesDe(p.id) : [];
  const linha = (item, tipo, refId, obrigatorio) => {
    const c = conclusaoDe({ tipo, refId }, SESSAO.usuario);
    const t = TIPOS_CONTEUDO[tipo];
    const ok = c && !c.vencido && !c.desatualizado;
    return '<a class="item-lista" href="' + t.rota + refId + '">' +
      '<div class="cod">' + t.rot + (obrigatorio ? ' · ATRIBUÍDO A VOCÊ' : '') + '</div>' +
      '<h3>' + esc(item.titulo) + '</h3>' +
      '<div class="meta">' +
      (ok ? '<span class="selo lido">✓ feito</span>'
          : c && c.vencido ? '<span class="selo pendente">venceu — refazer</span>'
          : c && c.desatualizado ? '<span class="selo pendente">mudou — releia</span>'
          : '<span class="selo pendente">pendente</span>') +
      (item.setor ? '<span class="selo setor">' + esc(item.setor) + '</span>' : '') +
      '</div></a>';
  };
  const pend = minhasPendencias();
  app.innerHTML = htmlTopo('meus') +
    '<div class="miolo">' +
    (!p ? '<div class="aviso amarelo">Sua conta ainda não está ligada a uma ficha de colaborador. ' +
      'A gestão confere o ID do colaborador na <b>Central de Acessos</b>. Depois, suas atribuições aparecem aqui.</div>' : '') +
    (p ? '<div class="card"><div class="sub">Você</div>' +
      '<p class="bloco-par" style="margin:0"><b>' + esc(p.nome) + '</b>' +
      (p.funcao ? ' · ' + esc(p.funcao) : '') + (p.area ? ' · ' + esc(p.area) : '') + '</p>' +
      (pend.length
        ? '<div class="aviso amarelo" style="margin-bottom:0">Você tem <b>' + pend.length + '</b> pendência(s) de treinamento.</div>'
        : (atrib.length ? '<div class="aviso verde" style="margin-bottom:0">Tudo em dia ✓</div>' : '')) +
      '</div>' : '') +
    (atrib.length ? '<div class="card"><div class="sub">Atribuído a você</div>' +
      atrib.map(a => { const it = conteudoDe(a); return it ? linha(it, a.tipo, a.refId, true) : ''; }).join('') +
      '</div>' : '') +
    '<div class="card"><div class="sub">Treinamentos da empresa</div>' +
    (ts.length ? ts.map(t => linha(t, 'treinamento', t.id, false)).join('')
      : '<p class="bloco-par">Nenhum treinamento publicado.</p>') +
    '</div></div>';
  ligarTopo();
}

/* ══════════ pessoas: vincular conta e atribuir treinamento ══════════ */
function renderPessoas(app) {
  if (!souAdmin() && !meusSetores().length) { location.hash = '#/'; return; }
  const ps = pessoas();
  const semConta = ps.filter(p => !p.usuario).length;
  const conteudos = []
    .concat(STORE.col('treinamentos').map(t => ({ tipo: 'treinamento', id: t.id, titulo: t.titulo, grupo: 'Treinamentos' })))
    .concat(STORE.col('jornadas').map(j => ({ tipo: 'jornada', id: j.id, titulo: j.titulo, grupo: 'Jornadas' })))
    .concat(STORE.col('pops').map(o => ({ tipo: 'pop', id: o.id, titulo: (o.codigo ? o.codigo + ' · ' : '') + o.titulo, grupo: 'POPs' })))
    .filter(c => souAdmin() || (c.tipo === 'pop' && possoEditar(STORE.um('pops', c.id))));
  app.innerHTML = htmlTopo('pessoas') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">Pessoas</div>' +
    '<p class="bloco-par">Vindas do RH (' + ps.length + ' cadastros). As contas são ligadas pelo ID do colaborador cadastrado no RH e na Central de Acessos.</p>' +
    (semConta ? '<div class="aviso amarelo"><b>' + semConta + ' pessoa(s) sem conta vinculada.</b> Os treinamentos atribuídos só aparecem em Meus depois desse vínculo.</div>' : '') +
    (souAdmin() ? '<button class="botao suave" id="bt-sinc-pessoas">🔄 Atualizar do RH</button> ' +
      '<button class="botao suave" id="bt-lote">📤 Atribuir em lote</button>' : '') + '</div>' +
    (ps.length ? ps.map(p => {
      const at = atribuicoesValidasDe(p.id);
      const orfas = atribuicoesDe(p.id).length - at.length;
      const feitos = p.usuario ? at.filter(a => { const c = conclusaoDe(a, p.usuario); return c && !c.vencido && !c.desatualizado; }).length : 0;
      return '<div class="item-lista" data-pessoa="' + p.id + '">' +
        '<h3>' + esc(p.nome) + '</h3>' +
        '<div class="meta">' +
        (p.funcao ? '<span>' + esc(p.funcao) + '</span>' : '') +
        (p.area ? '<span class="selo setor">' + esc(p.area) + '</span>' : '') +
        (p.usuario ? '<span class="selo lido">conta: ' + esc(p.usuario) + '</span>'
                   : '<span class="selo pendente">sem conta</span>') +
        (at.length ? '<span class="selo ' + (feitos >= at.length ? 'lido' : 'pendente') + '">' +
          feitos + '/' + at.length + ' treinamentos</span>' : '') +
        (orfas ? '<span class="selo pendente">' + orfas + ' sem conteúdo</span>' : '') +
        '</div></div>';
    }).join('') : '<div class="card">Nenhuma pessoa ainda. Toque em “Atualizar do RH”.</div>') +
    '</div>';
  ligarTopo();
  const bs = $('#bt-sinc-pessoas');
  if (bs) bs.onclick = async () => {
    bs.disabled = true; bs.textContent = 'Atualizando…';
    try {
      const r = await STORE.api('sincronizarPessoas');
      await STORE.pull();
      toast(r.ativos + ' pessoa(s) atualizadas do RH'+(r.conflitos ? ' · '+r.conflitos+' vínculo(s) para conferir' : ''), 'sucesso');
      await atualizarIdentidadeRH();
      renderApp();
    } catch { toast('Não consegui falar com o servidor agora.', 'erro'); bs.disabled = false; bs.textContent = '🔄 Atualizar do RH'; }
  };
  const bl = $('#bt-lote');
  if (bl) bl.onclick = () => abrirLote(conteudos);
  $$('[data-pessoa]').forEach(el => el.onclick = () => abrirPessoa(el.dataset.pessoa, conteudos));
}

/* ══════════ atribuir em lote ══════════ */
// O Código de Ética vale para as 38 pessoas da casa. Uma a uma são 38 vezes
// abrir ficha, escolher no select, tocar em Atribuir — e no meio disso alguém
// fica de fora sem ninguém notar. Aqui é uma escolha e uma confirmação.
//
// Só admin: dar isto ao gestor exigiria casar `p.area` (texto do RH) com os
// setores dos POPs, e os nomes não batem sempre. Um alcance que o gestor não
// consegue conferir na tela é pior que não ter o botão.
//
// Grava pela fila normal (STORE.salvar, um registro por pessoa): é mais lento
// que um pedido único, mas é o caminho que sobrevive a sinal ruim e que repete
// item a item sem duplicar — o id da atribuição é derivado de pessoa+conteúdo.
function abrirLote(conteudos) {
  const grupos = [...new Set(conteudos.map(c => c.grupo))];
  const areas = [...new Set(pessoas().map(p => p.area).filter(Boolean))].sort();
  let escolhido = conteudos[0] ? conteudos[0].tipo + '|' + conteudos[0].id : '';
  let area = '';
  let busca = '';
  const marcados = new Set();

  const alvo = () => {
    const [tipo, refId] = escolhido.split('|');
    return pessoas().filter(p =>
      (!area || p.area === area) &&
      (!busca || norm(p.nome).includes(norm(busca)))
    ).map(p => ({
      p, jaTem: atribuicoesDe(p.id).some(a => a.tipo === tipo && a.refId === refId),
    }));
  };

  const m = abrirModal(
    '<h3>Atribuir em lote</h3>' +
    '<div class="campo"><label>O que atribuir</label>' +
    '<select id="lo-conteudo">' + grupos.map(g =>
      '<optgroup label="' + esc(g) + '">' + conteudos.filter(c => c.grupo === g)
        .map(c => '<option value="' + c.tipo + '|' + c.id + '">' + esc(c.titulo) + '</option>').join('') +
      '</optgroup>').join('') + '</select></div>' +
    '<div class="campo"><label>Filtrar</label>' +
    '<select id="lo-area"><option value="">Todas as áreas</option>' +
    areas.map(a => '<option value="' + esc(a) + '">' + esc(a) + '</option>').join('') + '</select>' +
    '<input type="text" id="lo-busca" placeholder="parte do nome" autocapitalize="none" style="margin-top:8px"></div>' +
    '<div style="display:flex;gap:8px;margin:10px 0">' +
    '<button class="botao mini fantasma" id="lo-todos">Marcar todos</button>' +
    '<button class="botao mini fantasma" id="lo-nenhum">Limpar</button></div>' +
    '<div id="lo-lista" class="lista-lote"></div>' +
    '<div id="lo-aviso"></div>' +
    '<button class="botao mini fantasma" id="lo-tirar" style="margin-top:10px;display:none"></button>' +
    '<div class="acoes-modal" style="display:flex;gap:10px;margin-top:14px">' +
    '<button class="botao fantasma btn-fechar">Fechar</button>' +
    '<button class="botao btn-ok" id="lo-ok">Atribuir</button></div>'
  );

  // Só a lista e o rodapé se redesenham. Redesenhar o modal inteiro apagaria o
  // que está sendo digitado na busca a cada tecla.
  function pintar() {
    const itens = alvo();
    $('#lo-lista', m).innerHTML = itens.length
      ? itens.map(({ p, jaTem }) =>
        '<label class="linha-lote' + (jaTem ? ' ja' : '') + '">' +
        '<input type="checkbox" data-lote="' + esc(p.id) + '"' +
        (jaTem ? ' checked disabled' : (marcados.has(p.id) ? ' checked' : '')) + '>' +
        '<span class="nome">' + esc(p.nome) + '</span>' +
        (p.usuario ? '' : '<span class="selo pendente">sem conta</span>') +
        (jaTem ? '<span class="selo lido">já tem</span>' : '') +
        '</label>').join('')
      : '<p class="dica">Ninguém neste filtro.</p>';
    const novos = itens.filter(x => !x.jaTem && marcados.has(x.p.id));
    const semConta = novos.filter(x => !x.p.usuario).length;
    $('#lo-aviso', m).innerHTML = semConta
      ? '<div class="aviso amarelo">' + semConta + ' pessoa(s) sem conta ligada. A atribuição fica registrada, ' +
        'mas só aparece pra pessoa depois que a conta dela for ligada na ficha.</div>'
      : '';
    const ok = $('#lo-ok', m);
    ok.textContent = novos.length ? 'Atribuir a ' + novos.length + ' pessoa(s)' : 'Atribuir';
    ok.disabled = !novos.length;
    // Volta atrás. Sem isto, atribuir o conteúdo errado a 38 pessoas custava 38
    // idas à ficha pra desfazer — e ninguém desfaz, fica todo mundo com uma
    // pendência falsa no mapa pra sempre.
    const tirar = $('#lo-tirar', m);
    const quemTem = itens.filter(x => x.jaTem).length;
    tirar.style.display = quemTem ? '' : 'none';
    tirar.textContent = 'Tirar de ' + quemTem + ' que já tem';
    $$('[data-lote]', m).forEach(cb => cb.onchange = () => {
      if (cb.checked) marcados.add(cb.dataset.lote); else marcados.delete(cb.dataset.lote);
      pintar();
    });
  }

  $('#lo-conteudo', m).onchange = e => { escolhido = e.target.value; pintar(); };
  $('#lo-area', m).onchange = e => { area = e.target.value; pintar(); };
  $('#lo-busca', m).oninput = e => { busca = e.target.value; pintar(); };
  $('#lo-todos', m).onclick = () => { alvo().forEach(x => { if (!x.jaTem) marcados.add(x.p.id); }); pintar(); };
  $('#lo-nenhum', m).onclick = () => { marcados.clear(); pintar(); };
  $('.btn-fechar', m).onclick = () => m.remove();

  $('#lo-tirar', m).onclick = () => {
    const [tipo, refId] = escolhido.split('|');
    const item = conteudos.find(c => c.tipo === tipo && c.id === refId);
    const tem = alvo().filter(x => x.jaTem);
    if (!tem.length) return;
    // Quem já CONCLUIU não entra: tirar a atribuição apagaria a pendência, mas o
    // registro de conclusão continua no banco — e a pessoa sumiria do mapa como
    // se nunca tivesse feito. Prova que existe não se esconde.
    const feitos = tem.filter(({ p }) => p.usuario &&
      conclusaoDe({ tipo, refId }, p.usuario));
    const podem = tem.filter(x => !feitos.includes(x));
    if (!podem.length) {
      toast('Todos já concluíram — não dá pra tirar sem esconder a prova.', 'erro');
      return;
    }
    if (!confirm('Tirar “' + (item ? item.titulo : '') + '” de ' + podem.length + ' pessoa(s)?' +
      (feitos.length ? '\n\n' + feitos.length + ' já concluíram e ficam como estão.' : ''))) return;
    const salvos = podem.filter(({ p }) => arquivarLocal('atribuicoes', 'a-' + p.id + '-' + tipo + '-' + refId));
    toast(salvos.length + ' de ' + podem.length + ' alterações guardadas · aguardando sincronização');
    m.remove(); renderApp();
  };

  $('#lo-ok', m).onclick = () => {
    const [tipo, refId] = escolhido.split('|');
    const item = conteudos.find(c => c.tipo === tipo && c.id === refId);
    const novos = alvo().filter(x => !x.jaTem && marcados.has(x.p.id));
    if (!novos.length) return;
    if (!confirm('“' + (item ? item.titulo : '') + '” vai para ' + novos.length + ' pessoa(s).\n\n' +
      'Dá pra tirar de cada uma depois, na ficha dela.')) return;
    const agora = new Date().toISOString();
    const salvos = novos.filter(({ p }) => salvarLocal('atribuicoes', {
      id: 'a-' + p.id + '-' + tipo + '-' + refId,
      pessoaId: p.id, tipo, refId, atribuidoPor: SESSAO.nome, em: agora,
    }));
    toast(salvos.length + ' de ' + novos.length + ' atribuições guardadas · aguardando sincronização');
    m.remove(); renderApp();
  };

  pintar();
}

function abrirPessoa(pessoaId, conteudos) {
  const p = STORE.um('pessoas', pessoaId);
  if (!p) return;
  const at = atribuicoesDe(p.id);
  const grupos = [...new Set(conteudos.map(c => c.grupo))];
  const m = abrirModal(
    '<h3>' + esc(p.nome) + '</h3>' +
    '<p class="dica">' + esc([p.funcao, p.area].filter(Boolean).join(' · ')) + '</p>' +
    '<div class="aviso azul"><b>Cadastro do RH</b><p>'+esc(p.usuario?'Conta da equipe: '+p.usuario:'Sem conta vinculada na Central de Acessos.')+'</p><p class="dica">A ficha profissional vem do RH. A conta é ligada pelo identificador do colaborador na Central de Acessos; nomes parecidos não criam vínculos.</p></div>' +
    '<div class="sub" style="margin-top:16px">Treinamentos atribuídos</div>' +
    '<div id="pe-lista">' +
    (at.length ? at.map(a => {
      const it = conteudoDe(a);
      const c = p.usuario ? conclusaoDe(a, p.usuario) : null;
      const ok = c && !c.vencido && !c.desatualizado;
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--borda)">' +
        '<span style="flex:1;font-size:14.5px">' + esc(it ? it.titulo : '(removido)') + '</span>' +
        '<span class="selo ' + (ok ? 'lido' : 'pendente') + '">' + (ok ? '✓' : 'pendente') + '</span>' +
        (souAdmin() ? '<button class="botao mini fantasma" data-tirar="' + esc(a.id) + '">tirar</button>' : '') + '</div>';
    }).join('') : '<p class="dica">Nada atribuído ainda.</p>') +
    '</div>' +
    '<div class="campo" style="margin-top:14px"><label>Adicionar</label>' +
    '<select id="pe-novo">' + grupos.map(g =>
      '<optgroup label="' + esc(g) + '">' + conteudos.filter(c => c.grupo === g)
        .map(c => '<option value="' + c.tipo + '|' + c.id + '">' + esc(c.titulo) + '</option>').join('') +
      '</optgroup>').join('') + '</select></div>' +
    '<div class="acoes-modal" style="display:flex;gap:10px;margin-top:14px">' +
    '<button class="botao fantasma btn-fechar">Fechar</button>' +
    '<button class="botao suave btn-add">➕ Atribuir</button>' +
    '</div>'
  );
  $('.btn-fechar', m).onclick = () => m.remove();
  $('.btn-add', m).onclick = () => {
    const [tipo, refId] = $('#pe-novo', m).value.split('|');
    if (!tipo || !refId) { toast('Não há conteúdo disponível para atribuir neste setor.', 'erro'); return; }
    if (atribuicoesDe(p.id).some(a => a.tipo === tipo && a.refId === refId)) {
      toast('Já está atribuído.', 'erro'); return;
    }
    if (!salvarLocal('atribuicoes', {
      id: 'a-' + p.id + '-' + tipo + '-' + refId,
      pessoaId: p.id, tipo, refId,
      atribuidoPor: SESSAO.nome, em: new Date().toISOString(),
    })) return;
    toast(mensagemSalvo());
    m.remove(); abrirPessoa(pessoaId, conteudos);
  };
  $$('[data-tirar]', m).forEach(b => b.onclick = () => {
    if (!arquivarLocal('atribuicoes', b.dataset.tirar)) return;
    m.remove(); abrirPessoa(pessoaId, conteudos);
  });
}

/* ══════════ mapa de treinamento (admin/gestor) ══════════ */
function renderMapa(app) {
  if (!souAdmin() && !meusSetores().length) { location.hash = '#/'; return; }
  const meus = meusSetores();
  const pops = STORE.col('pops').filter(p => souAdmin() || meus.some(s => norm(s) === norm(p.setor)))
    .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || '')));
  const jornadas = STORE.col('jornadas');
  const leituras = STORE.col('leituras');
  const progresso = STORE.col('progresso');
  const pessoas = new Map();
  STORE.col('pessoas').forEach(p => { if (p.usuario) pessoas.set(norm(p.usuario), p.nome); });
  const contaAtual=r=>STORE.col('pessoas').find(p=>r.colaboradorId && p.colaboradorId===r.colaboradorId && p.usuario);
  leituras.forEach(l => { if (!contaAtual(l) && !pessoas.has(l.usuario)) pessoas.set(l.usuario, l.nome || l.usuario); });
  progresso.forEach(p => { if(!contaAtual(p)) pessoas.set(p.usuario, p.nome || p.usuario); });
  const nomes = [...pessoas.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  app.innerHTML = htmlTopo('mapa') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">Mapa de treinamento</div>' +
    '<p class="bloco-par">Quem leu cada POP e quem concluiu cada jornada. Inclui as pessoas com conta vinculada, mesmo sem nenhuma leitura. Pessoas sem conta aparecem em Pessoas para a gestão vincular.</p></div>' +
    '<div class="card rolagem-x"><div class="sub">POPs</div>' +
    '<table class="tab-mapa"><tr><th>Pessoa</th>' +
    pops.map(p => '<th title="' + esc(p.titulo) + '">' + esc(p.codigo || p.titulo.slice(0, 10)) + '</th>').join('') + '</tr>' +
    (nomes.length ? nomes.map(([u, nome]) => '<tr><td>' + esc(nome) + '</td>' +
      pops.map(p => {
        const l = registroDaPessoa('leituras','l','popId',p.id,u);
        const ok = l && l.versaoLida === (p.versao || '1.0');
        return '<td class="' + (ok ? 'ok' : 'nao') + '">' + (ok ? '✓' : (l ? 'v.antiga' : '—')) + '</td>';
      }).join('') + '</tr>').join('') : '<tr><td colspan="' + (pops.length + 1) + '">Ninguém registrou leitura ainda.</td></tr>') +
    '</table></div>' +
    '<div class="card rolagem-x"><div class="sub">Jornadas</div>' +
    '<table class="tab-mapa"><tr><th>Pessoa</th>' +
    jornadas.map(j => '<th>' + esc(j.titulo.slice(0, 18)) + '</th>').join('') + '</tr>' +
    (nomes.length ? nomes.map(([u, nome]) => '<tr><td>' + esc(nome) + '</td>' +
      jornadas.map(j => {
        const pr = registroDaPessoa('progresso','j','jornadaId',j.id,u);
        const total = (j.etapas || []).length;
        const feitas = etapasFeitas(j, pr);
        return '<td class="' + (feitas >= total && total ? 'ok' : 'nao') + '">' +
          (feitas >= total && total ? '🎓' : (feitas ? feitas + '/' + total : '—')) + '</td>';
      }).join('') + '</tr>').join('') : '<tr><td colspan="' + (jornadas.length + 1) + '">Ninguém começou ainda.</td></tr>') +
    '</table></div>' +
    '</div>';
  ligarTopo();
}

/* ══════════ editores ══════════ */
function htmlMateriaisTreinamento(materiais) {
  const links=(Array.isArray(materiais)?materiais:[]).filter(m=>m && window.POPS_TREINAMENTOS.urlSegura(m.url));
  if (!links.length) return '';
  return '<section class="card"><h2>Materiais de apoio</h2><p class="dica">Os links abrem em outra aba. Alguns materiais podem exigir acesso do responsável.</p><div class="treino-materiais">'+links.map(m=>'<a class="treino-material" href="'+esc(m.url)+'" target="_blank" rel="noopener noreferrer"><b>'+esc(m.titulo)+'</b><span>'+esc(new URL(m.url).hostname)+' · Abrir ↗</span></a>').join('')+'</div></section>';
}
function renderEditorTreinamento(app) {
  if (!souAdmin()) { location.hash='#/conhecimento'; return; }
  const novo=ROTA.arg==='novo';
  const t=novo?{id:uuid(),titulo:'',tipo:'treinamento',setor:'',resumo:'',blocos:[],materiais:[],versao:'1.0',exigeAceite:false,validadeMeses:0}:STORE.um('treinamentos',ROTA.arg);
  if (!t) { location.hash='#/conhecimento'; return; }
  const textoOriginal=blocosParaTexto(t.blocos);
  let materiais=(t.materiais || []).map(m=>({...m}));
  const tipos=[...new Set([t.tipo || '', 'treinamento','norma','etica'])];
  const tiposRot={treinamento:'Treinamento',norma:'Norma',etica:'Código de ética','':'Treinamento (cadastro anterior)'};
  const ss=[...new Set(['',...(t.setor?[t.setor]:[]),...setores()])];
  app.innerHTML=htmlTopo('conhecimento')+'<div class="miolo treino-editor"><div class="treino-cab"><div><div class="eyebrow">BASE DE CONHECIMENTO</div><h1>'+(novo?'Novo treinamento':'Editar treinamento')+'</h1><p>Transforme uma orientação em conteúdo que a equipe pode consultar.</p></div><a class="botao fantasma" href="'+(novo?'#/conhecimento':'#/treinamento/'+encodeURIComponent(t.id))+'">Voltar</a></div><form id="treino-form" novalidate>'+
    '<section class="card"><h2>Sobre o treinamento</h2><div class="campo"><label for="tr-titulo">Título *</label><input id="tr-titulo" maxlength="200" required value="'+esc(t.titulo)+'" placeholder="Ex.: Conferência antes de sair para instalação"></div><div class="painel-grid"><div class="campo"><label for="tr-setor">Setor</label><select id="tr-setor">'+ss.map(x=>'<option value="'+esc(x)+'"'+(x===(t.setor || '')?' selected':'')+'>'+esc(x || 'Geral · todos os setores')+'</option>').join('')+'</select></div><div class="campo"><label for="tr-resp">Responsável pelo conteúdo</label><input id="tr-resp" maxlength="200" value="'+esc(t.responsavel || '')+'" placeholder="Nome ou função"></div></div><div class="campo"><label for="tr-resumo">Resumo</label><textarea id="tr-resumo" class="treino-resumo" maxlength="2000" placeholder="O que a pessoa aprenderá e quando usar">'+esc(t.resumo || '')+'</textarea></div></section>'+
    '<section class="card"><h2>O que precisa ser aprendido</h2><div class="campo"><label for="tr-conteudo">Conteúdo e instruções *</label><textarea id="tr-conteudo" class="treino-conteudo" required placeholder="Explique a atividade, os cuidados e como conferir o resultado.">'+esc(textoOriginal)+'</textarea><p class="dica">Use ## para subtítulo, 1. para passo, - para lista, ! para destaque, !! para alerta e [ ] para checklist.</p></div><details id="tr-previa"><summary>Ver como ficará a leitura</summary><div id="tr-previa-corpo" class="treino-previa"></div></details></section>'+
    '<section class="card"><h2>Materiais de apoio</h2><p class="dica">Inclua links HTTPS de vídeos, PDFs, apresentações ou outros documentos. Até 20 materiais.</p><div id="tr-materiais"></div><button type="button" id="tr-add-material" class="botao mini suave">+ Adicionar material</button></section>'+
    '<section class="card"><h2>Versão e confirmação</h2><div class="painel-grid"><div class="campo"><label for="tr-versao">Versão *</label><input id="tr-versao" maxlength="40" required value="'+esc(t.versao || '1.0')+'"><p class="dica">Ao mudar as instruções, use outra versão (ex.: 1.1). Quem já concluiu verá que precisa reler.</p></div><div class="campo"><label for="tr-validade">Reciclagem a cada (meses)</label><input id="tr-validade" type="number" min="0" max="120" step="1" value="'+esc(t.validadeMeses || 0)+'"><p class="dica">0 = sem vencimento programado.</p></div><div class="campo"><label for="tr-tipo">Tipo de conteúdo</label><select id="tr-tipo">'+tipos.map(x=>'<option value="'+esc(x)+'"'+(x===(t.tipo || '')?' selected':'')+'>'+esc(tiposRot[x] || x)+'</option>').join('')+'</select></div></div><label class="linha-lote"><input type="checkbox" id="tr-aceite"'+(t.exigeAceite?' checked':'')+'><span>Pedir confirmação de leitura e compromisso com as orientações.</span></label><p class="dica">O conteúdo fica disponível à equipe. Depois de salvar, use “Atribuir à equipe” para indicar quem precisa fazê-lo.</p></section>'+
    '<div id="tr-erro" class="aviso amarelo" role="alert" tabindex="-1" hidden></div><div class="acoes treino-salvar"><button class="botao" type="submit" id="tr-salvar">Salvar treinamento</button>'+(!novo?'<button class="botao fantasma" type="button" id="tr-arquivar">Arquivar treinamento</button>':'')+'</div></form></div>';
  function lerMateriais() {
    $$('[data-material]').forEach((el,i)=>{materiais[i]={...materiais[i],titulo:$('[data-material-titulo]',el).value.trim(),url:$('[data-material-url]',el).value.trim()};});
  }
  function pintarMateriais() {
    $('#tr-materiais').innerHTML=materiais.map((m,i)=>'<div class="treino-material-editor" data-material="'+i+'"><div class="campo"><label for="tr-mtitulo-'+i+'">Nome do material '+(i+1)+'</label><input id="tr-mtitulo-'+i+'" data-material-titulo maxlength="200" value="'+esc(m.titulo)+'" placeholder="Ex.: Vídeo de demonstração"></div><div class="campo"><label for="tr-murl-'+i+'">Link HTTPS</label><input id="tr-murl-'+i+'" data-material-url type="url" maxlength="2000" value="'+esc(m.url)+'" placeholder="https://…"></div><button type="button" class="botao mini fantasma" data-remover-material="'+i+'" aria-label="Remover material '+(i+1)+'">Remover</button></div>').join('');
    $('#tr-add-material').disabled=materiais.length>=20;
    $$('[data-remover-material]').forEach(bt=>bt.onclick=()=>{lerMateriais();materiais.splice(Number(bt.dataset.removerMaterial),1);pintarMateriais();$('#tr-add-material').focus();});
  }
  $('#tr-add-material').onclick=()=>{lerMateriais();if(materiais.length>=20)return;materiais.push({titulo:'',url:''});pintarMateriais();$('#tr-mtitulo-'+(materiais.length-1)).focus();};
  $('#tr-previa').ontoggle=()=>{if($('#tr-previa').open)$('#tr-previa-corpo').innerHTML=blocosParaHtml(textoParaBlocos($('#tr-conteudo').value)) || '<p class="dica">Escreva as instruções para visualizar.</p>';};
  $('#tr-conteudo').oninput=()=>{if($('#tr-previa').open)$('#tr-previa').ontoggle();};
  function erro(msg) {const el=$('#tr-erro');el.hidden=false;el.textContent=msg;el.focus();}
  $('#treino-form').onsubmit=e=>{
    e.preventDefault();lerMateriais();
    const textoAtual=$('#tr-conteudo').value;
    const salvo={...t,titulo:$('#tr-titulo').value.trim(),tipo:$('#tr-tipo').value,setor:$('#tr-setor').value,responsavel:$('#tr-resp').value.trim(),resumo:$('#tr-resumo').value.trim(),versao:$('#tr-versao').value.trim(),validadeMeses:Number($('#tr-validade').value),exigeAceite:$('#tr-aceite').checked,materiais,
      blocos:(!novo && textoAtual===textoOriginal)?t.blocos:textoParaBlocos(textoAtual)};
    const problema=window.POPS_TREINAMENTOS.validar(novo?null:t,salvo);
    if(problema){erro(problema);return;}
    // Autoria provisória local; o servidor confirma estes carimbos no envio.
    salvo.revisadoEm=new Date().toISOString();salvo.revisadoPor=SESSAO.nome;
    if(novo){salvo.criadoEm=salvo.revisadoEm;salvo.criadoPor=SESSAO.nome;}
    if(!salvarLocal('treinamentos',salvo)){erro('Não foi possível guardar. Seu formulário continua aqui para tentar novamente.');return;}
    toast(mensagemSalvo());location.hash='#/treinamento/'+encodeURIComponent(salvo.id);
  };
  if($('#tr-arquivar'))$('#tr-arquivar').onclick=()=>{
    if(!confirm('Arquivar “'+t.titulo+'”? Ele sairá do catálogo. O conteúdo e os registros de leitura serão preservados; você poderá restaurá-lo em Minha conta.'))return;
    if(!arquivarLocal('treinamentos',t.id))return;
    toast('Arquivamento salvo neste aparelho · aguardando sincronização');location.hash='#/conhecimento';
  };
  pintarMateriais();ligarTopo();
}

function renderEditorPop(app) {
  const novo = ROTA.arg === 'novo';
  const p = novo
    ? { id: uuid(), titulo: '', codigo: '', setor: meusSetores()[0] || setores()[0], objetivo: '', epis: [], blocos: [], versao: '1.0' }
    : STORE.um('pops', ROTA.arg);
  if (!p || !possoEditar(p)) { location.hash = '#/pops'; return; }
  const meusS = meusSetores();
  const candidatos=window.POPS_ORGANIZACAO.catalogo(catalogoLocal()).filter(x=>!(x.tipo==='pop' && x.id===p.id));
  app.innerHTML = htmlTopo('pops') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">' + (novo ? 'Novo POP' : 'Editar POP') + '</div>' +
    '<div class="campo"><label>Título</label><input type="text" id="e-titulo" value="' + esc(p.titulo) + '" placeholder="Ex: Instalação de letra caixa cega"></div>' +
    '<div class="campo"><label>Código</label><input type="text" id="e-codigo" value="' + esc(p.codigo) + '" placeholder="Ex: POP-MONT-03"></div>' +
    '<div class="campo"><label>Setor</label><select id="e-setor">' +
    meusS.map(s => '<option' + (norm(s) === norm(p.setor) ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></div>' +
    '<div class="campo"><label>Objetivo (uma frase: o que este procedimento garante)</label><input type="text" id="e-objetivo" value="' + esc(p.objetivo) + '"></div>' +
    '<div class="campo"><label>Quem executa</label><input type="text" id="e-resp" value="' + esc(p.responsavel || '') + '" placeholder="Ex: Líder de Instalações"></div>' +
    '<div class="campo"><label>EPIs (separados por vírgula)</label><input type="text" id="e-epis" value="' + esc((p.epis || []).join(', ')) + '" placeholder="Luva, Óculos de proteção"></div>' +
    '<div class="campo"><label>Versão</label><input type="text" id="e-versao" value="' + esc(p.versao || '1.0') + '"><div class="dica">Suba a versão quando o conteúdo mudar de verdade — quem já leu vai ver "mudou — releia".</div></div>' +
    '<div class="campo"><label>Conteúdo</label><textarea id="e-conteudo">' + esc(blocosParaTexto(p.blocos)) + '</textarea>' +
    '<div class="dica">## Subtítulo &nbsp;·&nbsp; 1. passo numerado &nbsp;·&nbsp; - item de lista &nbsp;·&nbsp; ! destaque &nbsp;·&nbsp; !! alerta &nbsp;·&nbsp; [ ] item de checklist &nbsp;·&nbsp; linha solta = parágrafo</div></div>' +
    '<div class="campo"><label for="e-fontes">Fontes e documentos usados (um por linha)</label><textarea id="e-fontes" style="min-height:90px">'+esc((p.fontes || []).join('\n'))+'</textarea></div>'+
    '<details class="card"><summary>Vincular procedimentos, jornadas e treinamentos</summary>'+candidatos.map(c=>'<label class="linha-lote"><input type="checkbox" data-vinculo="'+esc(c.tipo+'|'+c.id)+'"'+((p.relacionados || []).some(r=>r.tipo===c.tipo && r.refId===c.id)?' checked':'')+'><span>'+esc((c.codigo || TIPOS_CONTEUDO[c.tipo].rot)+' · '+c.titulo)+'</span></label>').join('')+'</details>'+
    '<label class="linha-lote"><input type="checkbox" id="e-validar"><span>Conferi as instruções e quero validar esta revisão como responsável.</span></label><p class="dica">Sem esta confirmação, mudanças nas instruções ficam marcadas para revisão. A validação registra responsável e data no servidor.</p>'+
    '<div class="acoes">' +
    '<button class="botao largo" id="e-salvar">💾 Salvar POP</button>' +
    (!novo && souAdmin() ? '<button class="botao fantasma" id="e-apagar">🗃 Arquivar</button>' : '') +
    '</div></div></div>';
  ligarTopo();
  $('#e-salvar').onclick = () => {
    const titulo = $('#e-titulo').value.trim();
    if (!titulo) { toast('Dê um título ao POP.', 'erro'); return; }
    const salvo = Object.assign({}, p, {
      titulo,
      codigo: $('#e-codigo').value.trim(),
      setor: $('#e-setor').value,
      objetivo: $('#e-objetivo').value.trim(),
      responsavel: $('#e-resp').value.trim(),
      epis: $('#e-epis').value.split(',').map(s => s.trim()).filter(Boolean),
      versao: $('#e-versao').value.trim() || '1.0',
      blocos: textoParaBlocos($('#e-conteudo').value),
      revisadoEm: new Date().toISOString(),
      revisadoPor: SESSAO.nome,
      fontes:$('#e-fontes').value.split('\n').map(x=>x.trim()).filter(Boolean),
      relacionados:$$('[data-vinculo]:checked').map(x=>{const [tipo,refId]=x.dataset.vinculo.split('|');return {tipo,refId};}),
    });
    const problema=window.POPS_ORGANIZACAO.validarEdicao(novo?null:p,salvo);
    if(problema){toast(problema,'erro');return;}
    if(novo || window.POPS_ORGANIZACAO.mudouInstrucao(p,salvo)) salvo.revisao={status:'revisar'};
    const confirmarRevisao=$('#e-validar').checked;
    if(confirmarRevisao) salvo.revisao={status:'validado'};
    if (!STORE.salvar('pops', salvo, {confirmarRevisao})) { toast('Não consegui salvar (memória cheia?)', 'erro'); return; }
    toast(mensagemSalvo());
    location.hash = '#/pop/' + salvo.id;
  };
  const ap = $('#e-apagar');
  if (ap) ap.onclick = () => {
    if (!confirm('Arquivar este POP? O conteúdo será preservado. Quem já registrou leitura mantém o registro.')) return;
    if (!arquivarLocal('pops', p.id)) return;
    toast('POP apagado');
    location.hash = '#/pops';
  };
}

function renderEditorJornada(app) {
  if (!souAdmin()) { location.hash = '#/fab'; return; }
  const novo = ROTA.arg === 'novo';
  const j = novo ? { id: uuid(), titulo: '', descricao: '', nivel: 'Técnico', versao: '1.0', etapas: [] } : STORE.um('jornadas', ROTA.arg);
  if (!j) { location.hash = '#/fab'; return; }
  // Cada cartão conserva o identificador ao renomear/reordenar a etapa.
  let etapas = (j.etapas || []).map(e => ({ ...e, texto: blocosParaTexto(e.blocos) }));
  app.innerHTML = htmlTopo('fab') + '<div class="miolo"><div class="card"><h1>' + (novo ? 'Nova jornada' : 'Editar jornada') + '</h1>' +
    '<div class="campo"><label>Título</label><input type="text" id="e-titulo" value="' + esc(j.titulo) + '"></div>' +
    '<div class="campo"><label>Descrição</label><input type="text" id="e-desc" value="' + esc(j.descricao) + '"></div>' +
    '<div class="campo"><label>Nível</label><select id="e-nivel">' + ['Introdutório','Técnico','Avançado'].map(n => '<option' + (j.nivel === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<div class="campo"><label>Versão</label><input type="text" id="e-versao" value="' + esc(j.versao || '1.0') + '"></div></div>' +
    '<div id="editor-etapas"></div><button class="botao suave" id="e-nova-etapa">➕ Adicionar etapa</button>' +
    '<div class="acoes"><button class="botao" id="e-salvar">💾 Salvar jornada</button>' + (!novo && souAdmin() ? '<button class="botao fantasma" id="e-apagar">🗃 Arquivar</button>' : '') + '</div></div>';
  function lerEtapas() { $$('[data-etapa-editor]').forEach((el,i) => { etapas[i].titulo = $('input',el).value.trim(); etapas[i].texto = $('textarea',el).value; }); }
  function pintarEtapas() {
    $('#editor-etapas').innerHTML = etapas.map((e,i) => '<details class="card editor-etapa" data-etapa-editor="' + esc(e.id) + '" open><summary>Etapa ' + (i+1) + ' · ' + esc(e.titulo || 'Sem título') + '</summary>' +
      '<div class="campo"><label>Título da etapa</label><input type="text" value="' + esc(e.titulo) + '"></div>' +
      '<div class="campo"><label>Instruções</label><textarea>' + esc(e.texto) + '</textarea><p class="dica">## título · 1. passo · - item · ! destaque · !! alerta · [ ] checklist</p></div>' +
      '<div class="acoes"><button class="botao mini fantasma" data-mover="-1"' + (!i ? ' disabled' : '') + '>↑ Subir</button><button class="botao mini fantasma" data-mover="1"' + (i === etapas.length-1 ? ' disabled' : '') + '>↓ Descer</button><button class="botao mini fantasma" data-remover>Remover etapa</button></div></details>').join('');
    associarRotulos($('#editor-etapas'));
    $$('[data-etapa-editor]').forEach((el,i) => {
      $$('[data-mover]',el).forEach(bt => bt.onclick = () => { lerEtapas(); const para=i+Number(bt.dataset.mover); [etapas[i],etapas[para]]=[etapas[para],etapas[i]]; pintarEtapas(); });
      $('[data-remover]',el).onclick = () => { if (!confirm('Remover esta etapa da jornada? Ela deixará de contar no progresso.')) return; lerEtapas(); etapas.splice(i,1); pintarEtapas(); };
    });
  }
  $('#e-nova-etapa').onclick = () => { lerEtapas(); etapas.push({ id:uuid(),titulo:'',texto:'' }); pintarEtapas(); $$('[data-etapa-editor] input').at(-1).focus(); };
  $('#e-salvar').onclick = () => {
    lerEtapas(); const titulo=$('#e-titulo').value.trim();
    if (!titulo || !etapas.length || etapas.some(e => !e.titulo)) { toast('Preencha o título da jornada e de cada etapa.', 'erro'); return; }
    const salvo={ ...j,titulo,descricao:$('#e-desc').value.trim(),nivel:$('#e-nivel').value,versao:$('#e-versao').value.trim() || '1.0',
      etapas:etapas.map(({texto,...e}) => ({ ...e,blocos:textoParaBlocos(texto) })),revisadoEm:new Date().toISOString(),revisadoPor:SESSAO.nome };
    if (!salvarLocal('jornadas',salvo)) return;
    toast(mensagemSalvo()); location.hash='#/jornada/'+salvo.id;
  };
  const ap=$('#e-apagar'); if (ap) ap.onclick=() => { if (confirm('Arquivar esta jornada? O conteúdo será preservado.') && arquivarLocal('jornadas',j.id)) location.hash='#/fab'; };
  pintarEtapas(); ligarTopo();
}

/* ══════════ trocar a senha ══════════ */
// Senha criada por outra pessoa (a Central) nasce TEMPORÁRIA: a pessoa é
// obrigada a trocar antes de usar. Assim ninguém trabalha com uma senha que
// um terceiro conhece.
function renderTrocarSenha(app) {
  const obrigado = !!(SESSAO && SESSAO.trocarSenha);
  document.title = 'Trocar a senha';
  app.innerHTML =
    '<div class="tela-login"><div class="cartao-login">' +
    '<img src="./logo-impresilk.png" alt="Impresilk">' +
    '<h1>' + (obrigado ? 'Crie a sua senha' : 'Trocar a senha') + '</h1>' +
    '<div class="sub2">' + (obrigado
      ? 'A senha atual foi criada por outra pessoa. Escolha a sua para continuar.'
      : esc((SESSAO && SESSAO.nome) || '')) + '</div>' +
    (obrigado ? '' : '<div class="campo"><label>Senha atual</label><input id="sn-atual" type="password" autocomplete="current-password"></div>') +
    '<div class="campo"><label>Senha nova (mínimo 6)</label><input id="sn-nova" type="password" autocomplete="new-password"></div>' +
    '<div class="campo"><label>Repita a senha nova</label><input id="sn-rep" type="password" autocomplete="new-password"></div>' +
    '<div id="sn-erro"></div>' +
    '<button class="botao largo" id="sn-salvar">Salvar</button>' +
    (obrigado
      // Sem esta saída, quem cai aqui sem saber a senha fica preso na tela.
      ? '<button class="botao fantasma largo" id="sn-outro" style="margin-top:10px">Entrar com outro usuário</button>'
      : '<a href="#/menu" class="botao fantasma largo" style="margin-top:10px">← voltar</a>') +
    '</div></div>';
  associarRotulos(app);
  const outro = $('#sn-outro');
  if (outro) outro.onclick = () => {
    AUTH.esquecer(); STORE.setUser(null); SESSAO = null; location.hash = '#/'; renderApp();
  };
  const erro = html => { $('#sn-erro').innerHTML = '<div class="aviso vermelho">' + html + '</div>'; };
  $('#sn-salvar').onclick = async () => {
    const atual = obrigado ? '' : ($('#sn-atual').value || '');
    const nova = $('#sn-nova').value || '';
    if (nova.length < 6) { erro('A senha nova precisa de ao menos 6 caracteres.'); return; }
    if (nova !== ($('#sn-rep').value || '')) { erro('As duas senhas novas não são iguais.'); return; }
    const bt = $('#sn-salvar'); bt.disabled = true; bt.textContent = 'Salvando…';
    try {
      await AUTH.trocarMinhaSenha(atual, nova);
    } catch (e) {
      bt.disabled = false; bt.textContent = 'Salvar';
      erro(esc(e.erro || 'Não consegui trocar a senha agora. Tente de novo com internet.'));
      return;
    }
    STORE.setUser(Object.assign({}, SESSAO, { trocarSenha: false }));
    SESSAO = STORE.getUser();
    toast('Senha trocada ✓', 'sucesso');
    location.hash = '#/';
  };
}

/* ══════════ menu ══════════ */
function baixarRascunhos() {
  const dados = STORE.exportarRecuperacao();
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'pops-meus-rascunhos.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function abrirPendencias() {
  const fila = STORE.getFila(), estado=STORE.resumoSync();
  const m = abrirModal('<h3>Conferir gravação e sincronização</h3><p class="dica">Cada envio aguarda a confirmação do servidor.</p>'+ (estado.erro?'<p class="aviso amarelo">'+esc(estado.erro)+'</p>':'')+(estado.naoGravados?'<p class="aviso amarelo">'+estado.naoGravados+' alteração(ões) ainda não gravada(s), disponível(is) somente nesta sessão. Não feche antes de baixar uma cópia ou tentar novamente.</p>':'') +
    (fila.length ? fila.map(it => '<div class="card"><b>' + esc(it.registro?.titulo || it.colecao) + '</b><p>' + esc(it.erro || 'Aguardando envio') + '</p>' +
      (it.bloqueado ? '<button class="botao suave" data-recuperar="' + esc(it.mutationId) + '">Usar versão do servidor</button><p class="dica">Seu rascunho será preservado e poderá ser baixado em Minha conta.</p>' : '') + '</div>').join('') : estado.pendentes?'<p>Há '+estado.pendentes+' envio(s) preservado(s). Atualize seu acesso para conferir os registros autorizados; você também pode baixar uma cópia.</p>':'<p>Nenhum envio pendente.</p>') +
    '<div class="acoes"><button class="botao" id="p-enviar">Tentar sincronizar</button><button class="botao fantasma" id="p-baixar">Baixar cópia</button><button class="botao fantasma" id="p-fechar">Fechar</button></div>');
  $('#p-fechar', m).onclick = () => m.remove(); $('#p-baixar', m).onclick = baixarRascunhos;
  $('#p-enviar', m).onclick = async () => { await STORE.tentarNovamente(); if (m.isConnected) { m.remove(); abrirPendencias(); } };
  $$('[data-recuperar]', m).forEach(bt => bt.onclick = async () => {
    bt.disabled = true;
    try { await STORE.recuperarServidor(bt.dataset.recuperar); m.remove(); renderApp(); abrirPendencias(); }
    catch (e) { toast(e.message, 'erro'); bt.disabled = false; }
  });
}
function abrirArquivados() {
  if (!souAdmin()) return;
  const m = abrirModal('<h3>Itens arquivados</h3><div class="campo"><label>Tipo de item</label><select id="arq-col"><option value="pops">POPs</option><option value="jornadas">Jornadas</option><option value="atribuicoes">Atribuições</option><option value="treinamentos">Treinamentos</option></select></div><div id="arq-lista">Carregando…</div><div class="acoes"><button class="botao fantasma" id="arq-fechar">Fechar</button></div>');
  $('#arq-fechar', m).onclick = () => m.remove();
  let carga = 0;
  async function carregar() {
    const ordem = ++carga, colecao = $('#arq-col', m).value; $('#arq-lista', m).textContent = 'Carregando…';
    try {
      let desde = null, itens = [], vistos = new Set();
      do {
        const r = await STORE.api('list', { colecao, protocolo: 2, limite: 500, desde: desde || undefined });
        if (!m.isConnected || ordem !== carga) return;
        itens = itens.concat((r.itens || []).filter(x => x.apagado)); desde = r.proximo;
        if (desde) { const k = JSON.stringify(desde); if (vistos.has(k)) throw new Error('Lista incompleta. Tente novamente.'); vistos.add(k); }
      } while (desde);
      $('#arq-lista', m).innerHTML = itens.length ? itens.map((it, i) => '<div class="card"><b>' + esc(it.registro?.titulo || it.registro?.nome || 'Item arquivado') + '</b><div class="acoes"><button class="botao suave" data-restaurar="' + i + '">Restaurar</button></div></div>').join('') : '<p>Nenhum item arquivado deste tipo.</p>';
      $$('[data-restaurar]', m).forEach(bt => bt.onclick = async () => {
        bt.disabled = true; const it = itens[Number(bt.dataset.restaurar)];
        try { await STORE.api('restore', { colecao, id: it.id, expectedRevision: it.revision, mutationId: uuid() }); await STORE.pull(); toast('Item restaurado.', 'sucesso'); if (m.isConnected) await carregar(); }
        catch (e) { toast(e.message, 'erro'); bt.disabled = false; }
      });
    } catch (e) { if (m.isConnected && ordem === carga) $('#arq-lista', m).textContent = e.message; }
  }
  $('#arq-col', m).onchange = carregar; carregar();
}

function renderMenu(app) {
  const cfgInicial = STORE.getCFG();
  app.innerHTML = htmlTopo('menu') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">Sua conta</div>' +
    '<p class="bloco-par"><b>' + esc(SESSAO.nome) + '</b> · ' + esc(SESSAO.papel) + '</p>' +
    '<p class="dica">Última sincronização: ' + (STORE.lastSync() ? fmtDataHora(STORE.lastSync()) : 'ainda não sincronizou') + '</p>' +
    '<div class="acoes">'+(SESSAO.origemLogin==='rh'?'<a class="botao suave" href="https://leogpereira-afk.github.io/painel-impresilk/">Gerenciar minha conta na Entrada Única</a>':'<a class="botao suave" href="#/senha">Trocar a minha senha dos POPs</a>') +
    '<button class="botao fantasma" id="bt-sair">Sair</button></div></div>' +
    '<div class="card"><h2>Sincronização e recuperação</h2><p class="dica">Revise envios pendentes e recupere rascunhos deste aparelho.</p><div class="acoes"><button class="botao suave" id="bt-pendencias">Ver pendências</button><button class="botao fantasma" id="bt-rascunhos">Baixar rascunhos</button>' + (souAdmin() ? '<button class="botao fantasma" id="bt-arquivados">Itens arquivados</button>' : '') + '</div></div>' +
    (souAdmin() ? '<div class="card"><div class="sub">Gestores por setor</div>' +
      '<p class="dica">Formato: um por linha, <b>usuario: Setor A, Setor B</b>. Gestor edita os POPs dos setores dele.</p>' +
      '<div class="campo"><textarea id="cfg-gestores" style="min-height:120px">' +
      esc(Object.entries(STORE.getCFG().gestores || {}).map(([u, ss]) => u + ': ' + ss.join(', ')).join('\n')) +
      '</textarea></div>' +
      '<div class="campo"><label>Setores (um por linha)</label><textarea id="cfg-setores" style="min-height:120px">' +
      esc(setores().join('\n')) + '</textarea></div>' +
      '<button class="botao" id="bt-salvar-cfg">💾 Salvar configuração</button></div>' : '') +
    '</div>';
  ligarTopo();
  $('#bt-pendencias').onclick = abrirPendencias;
  $('#bt-rascunhos').onclick = baixarRascunhos;
  if ($('#bt-arquivados')) $('#bt-arquivados').onclick = abrirArquivados;
  $('#bt-sair').onclick = () => {
    AUTH.esquecer(); STORE.setUser(null); SESSAO = null; location.hash = '#/'; renderApp();
  };
  const sc = $('#bt-salvar-cfg');
  if (sc) sc.onclick = async () => {
    const gestores = {};
    $('#cfg-gestores').value.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      const [u, ss] = l.split(':');
      if (u && ss) gestores[norm(u)] = ss.split(',').map(s => s.trim()).filter(Boolean);
    });
    const lista = $('#cfg-setores').value.split('\n').map(s => s.trim()).filter(Boolean);
    try {
      await STORE.salvarCFG({ gestores, setores: lista }, cfgInicial);
      toast('Configuração salva ✓', 'sucesso');
    } catch (e) { toast(e.message || 'Não consegui salvar a configuração.', 'erro'); }
  };
}

/* ══════════ rotas ══════════ */
let ROTA = { nome: 'inicio', arg: '' };
function lerRota() {
  const h = location.hash.replace(/^#\/?/, '');
  const [nome, ...resto] = h.split('/');
  try { ROTA = { nome: nome || 'inicio', arg: decodeURIComponent(resto.join('~') || '') }; }
  catch { ROTA = { nome: 'inicio', arg: '' }; }
}
function renderApp() {
  const app = $('#app');
  if (!SESSAO) { renderLogin(app); return; }
  lerRota();
  document.title = 'Educação Impresilk · ' + (({biblioteca:'Biblioteca',videos:'Vídeos',material:'Material de estudo','material-editor':'Preparar material',nrs:'Normas Regulamentadoras',perfil:'Perfil e Desenvolvimento','perfil-editor':'Preparar instrumento','perfil-teste':'Autoconhecimento',alunos:'Alunos',aluno:'Formação do aluno',avaliacoes:'Minhas avaliações',escola:'Gestão da escola',formacao:'Minha jornada','formacao-editor':'Preparar jornada',conquistas:'Meu histórico',conhecimento:'Conhecimento',inicio:'Início',pops:'POPs',fab:'Fabricação',pessoas:'Pessoas',mapa:'Mapa de treinamento',meus:'Meus treinamentos',menu:'Minha conta'})[ROTA.nome] || 'Fabricação');
  // Enquanto a senha for a temporária, o app inteiro fica atrás desta tela.
  if (SESSAO.trocarSenha && ROTA.nome !== 'senha') { location.hash = '#/senha'; return; }
  const R = {
    'inicio': renderInicio, '': renderInicio,
    'formacao': a => window.EDUCACAO.render(a),
    'formacao-editor': a => window.EDUCACAO.render(a),
    'escola': a => window.EDUCACAO.render(a),
    'conquistas': a => window.EDUCACAO.render(a),
    'conhecimento': renderConhecimento,
    'biblioteca': a => ACADEMIA.render(a),
    ...Object.fromEntries(['nrs','perfil','perfil-editor','perfil-teste','alunos','aluno','avaliacoes'].map(r=>[r,a=>ESCOLA_GESTAO.render(a)])),
    'videos': a => ACADEMIA.render(a),
    'material': a => ACADEMIA.render(a),
    'material-editor': a => ACADEMIA.render(a),
    'pops': (a) => renderPops(a),
    'pop': renderPop,
    'fab': renderFab,
    'jornada': renderJornada,
    'etapa': renderEtapa,
    'mapa': renderMapa,
    'meus': renderMeus,
    'treinamento': renderTreinamento,
    'pessoas': renderPessoas,
    'menu': renderMenu,
    'senha': renderTrocarSenha,
    'editor': (a) => {
      const [tipo] = (ROTA.arg || '').split('~');
      ROTA.arg = (ROTA.arg || '').split('~').slice(1).join('~');
      if (tipo === 'pop') renderEditorPop(a); else if (tipo === 'treinamento') renderEditorTreinamento(a); else if (tipo === 'jornada') renderEditorJornada(a); else location.hash='#/conhecimento';
    },
  };
  (R[ROTA.nome] || renderInicio)(app);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderApp);

(function boot() {
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('./sw.js'); } catch {} }
  renderApp();
  // O Painel guarda o crachá, mas não cria pops_user neste aparelho.
  // Só o servidor pode transformar esse crachá em uma sessão dos POPs.
  if (SESSAO || AUTH.temCracha()) {
    const usuario = SESSAO?.usuario, cracha = AUTH.cracha();
    AUTH.eu().then(async r => {
      if (AUTH.cracha() !== cracha || SESSAO?.usuario !== usuario) return;
      if (r === false) { AUTH.esquecer(); STORE.setUser(null); SESSAO = null; renderApp(); return; }
      if (r && r.usuario && r.papel) {
        const trocarSenha = r.trocarSenha === undefined
          ? (SESSAO?.usuario === r.usuario && !!SESSAO.trocarSenha) : !!r.trocarSenha;
        if (!STORE.setUser({ ...SESSAO, usuario: r.usuario, nome: r.nome, papel: r.papel, trocarSenha })) return;
        SESSAO = STORE.getUser();
        if (!['editor','formacao-editor','formacao','material-editor','material','perfil-editor','perfil-teste'].includes(ROTA.nome)) renderApp();
      }
      if (!SESSAO) return;
      await atualizarIdentidadeRH();
      STORE.trySync(); STORE.pull().then(() => { if (!['editor','formacao-editor','formacao','material-editor','material','perfil-editor','perfil-teste'].includes(ROTA.nome)) renderApp(); });
    });
  }
  setInterval(() => { if (SESSAO && document.visibilityState === 'visible') { sincronizarAgora(); } }, 90000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && SESSAO) { sincronizarAgora(); }
  });
})();
