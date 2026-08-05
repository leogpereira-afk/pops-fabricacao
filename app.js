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
const fmtData = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR'); };
const fmtDataHora = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

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
function abrirModal(html) {
  const veu = document.createElement('div');
  veu.className = 'veu';
  veu.innerHTML = '<div class="modal">' + html + '</div>';
  veu.onclick = e => { if (e.target === veu) veu.remove(); };
  $('#overlays').appendChild(veu);
  return veu;
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
const LINK_APP = 'https://impresilk.com.br/pops';

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
  const link = LINK_APP + rota + item.id;
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
function minhaLeitura(popId) {
  return STORE.um('leituras', 'l-' + norm(SESSAO.usuario) + '-' + popId);
}
function registrarLeitura(pop) {
  STORE.salvar('leituras', {
    id: 'l-' + norm(SESSAO.usuario) + '-' + pop.id,
    usuario: norm(SESSAO.usuario), nome: SESSAO.nome,
    popId: pop.id, versaoLida: pop.versao || '1.0', em: new Date().toISOString(),
  });
}
function meuProgresso(jId) {
  return STORE.um('progresso', 'j-' + norm(SESSAO.usuario) + '-' + jId) ||
    { id: 'j-' + norm(SESSAO.usuario) + '-' + jId, usuario: norm(SESSAO.usuario), nome: SESSAO.nome, jornadaId: jId, etapas: {} };
}

/* ══════════ pessoas, atribuições e treinamentos ══════════ */
// A pessoa vem do RH (espelho mínimo). A CONTA vem da Central. O elo entre as
// duas é o campo `usuario` da pessoa — é ele que faz "o treinamento do Fulano"
// virar "o que EU tenho para fazer" quando o Fulano entra no app.
function pessoas() { return STORE.col('pessoas').sort((a, b) => a.nome.localeCompare(b.nome)); }
function minhaPessoa() {
  if (!SESSAO) return null;
  return pessoas().find(p => p.usuario && norm(p.usuario) === norm(SESSAO.usuario)) || null;
}
// Sugestão de vínculo: nome da pessoa parecido com o nome/usuário da conta.
// É só sugestão — quem confirma é o admin (nome igual não é prova).
function sugerirUsuario(pessoa, contas) {
  const alvo = norm(pessoa.nome).split(' ').filter(Boolean);
  if (!alvo.length) return '';
  const achou = contas.find(c => {
    const n = norm(c.nome || c.usuario).split(' ').filter(Boolean);
    return n.length && n[0] === alvo[0] && (n.length === 1 || alvo.length === 1 || n[1] === alvo[1]);
  });
  return achou ? achou.usuario : '';
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
    const l = STORE.um('leituras', 'l-' + u + '-' + a.refId);
    const pop = STORE.um('pops', a.refId);
    if (!l) return null;
    if (pop && l.versaoLida !== (pop.versao || '1.0')) return { em: l.em, desatualizado: true };
    return { em: l.em };
  }
  if (a.tipo === 'jornada') {
    const pr = STORE.um('progresso', 'j-' + u + '-' + a.refId);
    const j = STORE.um('jornadas', a.refId);
    if (!pr || !j) return null;
    const feitas = Object.keys(pr.etapas || {}).length;
    return feitas >= (j.etapas || []).length ? { em: pr.concluidaEm } : null;
  }
  const l = STORE.um('leituras', 't-' + u + '-' + a.refId);
  if (!l) return null;
  const t = STORE.um('treinamentos', a.refId);
  // Reciclagem: treinamento com validade vence e volta a aparecer como pendente.
  if (t && t.validadeMeses && l.em) {
    const venceEm = new Date(l.em);
    venceEm.setMonth(venceEm.getMonth() + Number(t.validadeMeses));
    if (venceEm < new Date()) return { em: l.em, vencido: true, venceuEm: venceEm.toISOString() };
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
  if (!st || st.status === 'ok') return 'Sincronizado';
  if (st.status === 'pendente') return st.pendentes + ' pendente(s)';
  if (st.status === 'offline') return 'Sem internet';
  return 'Servidor fora';
}
let _ultimoSync = null;
STORE.on('sync', st => {
  _ultimoSync = st;
  const chip = $('#chip-sync');
  if (chip) { chip.textContent = rotuloSync(st); chip.classList.toggle('pendente', st.status !== 'ok'); }
});
STORE.on('pull', () => { if (!document.querySelector('textarea:focus, input:focus')) renderApp(); });
STORE.on('quota', () => toast('Memória do aparelho cheia — o registro pode não ter sido salvo.', 'erro'));

function htmlTopo(aba) {
  return '<div class="topo">' +
    '<a href="#/"><img src="./logo-impresilk.png" alt=""></a>' +
    '<div class="tit"><b>Pops & Fabricação</b><span>Impresilk · ' + esc(SESSAO.nome) + '</span></div>' +
    '<button class="chip-sync" id="chip-sync" title="Tocar para sincronizar">' + rotuloSync(_ultimoSync) + '</button>' +
    '</div>' +
    '<div class="abas">' +
    '<a href="#/pops" class="' + (aba === 'pops' ? 'ativa' : '') + '">📋 POPs</a>' +
    '<a href="#/fab" class="' + (aba === 'fab' ? 'ativa' : '') + '">🏭 Fabricação</a>' +
    '<a href="#/meus" class="' + (aba === 'meus' ? 'ativa' : '') + '">🎓 Meus' +
    (minhasPendencias().length ? ' <b>(' + minhasPendencias().length + ')</b>' : '') + '</a>' +
    ((souAdmin() || meusSetores().length) ? '<a href="#/pessoas" class="' + (aba === 'pessoas' ? 'ativa' : '') + '">👥 Pessoas</a>' : '') +
    ((souAdmin() || meusSetores().length) ? '<a href="#/mapa" class="' + (aba === 'mapa' ? 'ativa' : '') + '">📊 Mapa</a>' : '') +
    '<a href="#/menu" class="' + (aba === 'menu' ? 'ativa' : '') + '">☰</a>' +
    '</div>';
}
function ligarTopo() {
  const chip = $('#chip-sync');
  if (chip) chip.onclick = () => { STORE.trySync(); STORE.pull(); toast('Sincronizando…'); };
}

/* ══════════ telas ══════════ */
function renderLogin(app) {
  app.innerHTML =
    '<div class="tela-login"><div class="cartao-login">' +
    '<img src="./logo-impresilk.png" alt="Impresilk">' +
    '<h1>Pops & Fabricação</h1>' +
    '<div class="sub2">Entre com a sua conta da equipe (a mesma do Painel)</div>' +
    '<div class="campo"><label>Usuário</label><input id="lg-u" type="text" autocomplete="username" autocapitalize="none"></div>' +
    '<div class="campo"><label>Senha</label><input id="lg-s" type="password" autocomplete="current-password"></div>' +
    '<div id="lg-erro"></div>' +
    '<button class="botao largo" id="lg-entrar">Entrar</button>' +
    '<p class="dica" style="text-align:center; margin-top:14px">O primeiro acesso neste aparelho precisa de internet. Depois, os POPs abrem até sem sinal.</p>' +
    '</div></div>';
  const entrar = async () => {
    const u = $('#lg-u').value.trim(), s = $('#lg-s').value;
    if (!u || !s) { $('#lg-erro').innerHTML = '<div class="aviso vermelho">Preencha usuário e senha.</div>'; return; }
    const bt = $('#lg-entrar'); bt.disabled = true; bt.textContent = 'Entrando…';
    try {
      const r = await AUTH.login(u, s);
      STORE.setUser({ usuario: r.usuario, nome: r.nome, papel: r.papel, trocarSenha: !!r.trocarSenha });
      SESSAO = STORE.getUser();
      STORE.pull();
      // Senha feita por outra pessoa: trocar é a primeira coisa.
      location.hash = r.trocarSenha ? '#/senha' : '#/';
    } catch (e) {
      bt.disabled = false; bt.textContent = 'Entrar';
      $('#lg-erro').innerHTML = '<div class="aviso vermelho">' +
        esc(e.erro || (e.status ? 'Usuário ou senha incorretos.' : 'Sem conexão — o primeiro acesso precisa de internet.')) + '</div>';
    }
  };
  $('#lg-entrar').onclick = entrar;
  $('#lg-s').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
}

function renderInicio(app) {
  const pops = STORE.col('pops');
  const lidas = pops.filter(p => minhaLeitura(p.id)).length;
  const jornadas = STORE.col('jornadas');
  app.innerHTML = htmlTopo('') +
    '<div class="miolo">' +
    '<div class="portas">' +
    '<a class="porta" href="#/pops"><div class="ico">📋</div><h2>POPs</h2>' +
    '<p>O procedimento oficial de cada setor. Você já leu ' + lidas + ' de ' + pops.length + '.</p></a>' +
    '<a class="porta" href="#/fab"><div class="ico">🏭</div><h2>Fabricação</h2>' +
    '<p>' + jornadas.length + ' jornada(s) técnicas passo a passo: aprenda o processo do começo ao fim.</p></a>' +
    '</div></div>';
  ligarTopo();
}

// A lista de POPs com 21 setores não cabe numa fileira de chips no celular.
// Então são dois níveis: primeiro a MACROÁREA, depois os setores dela — e cada
// setor mostra quantos POPs tem, inclusive ZERO. Ver o vazio é o mais útil:
// é assim que se enxerga onde falta procedimento escrito.
function renderPops(app) {
  const todos = STORE.col('pops');
  const alvo = ROTA.arg || '';                 // pode ser área OU setor
  const asAreas = areas();
  const areaSel = asAreas.find(a => norm(a.nome) === norm(alvo));
  const setorSel = !areaSel && alvo ? alvo : '';
  const areaDoSel = setorSel ? areaDoSetor(setorSel) : null;
  const areaAberta = areaSel || areaDoSel;

  const quantos = st => todos.filter(p => norm(p.setor) === norm(st)).length;
  const daTela = setorSel
    ? todos.filter(p => norm(p.setor) === norm(setorSel))
    : (areaAberta ? todos.filter(p => (areaAberta.setores || []).some(x => norm(x) === norm(p.setor))) : todos);
  daTela.sort((a, b) => String(a.codigo || 'zz').localeCompare(String(b.codigo || 'zz')));

  const lidos = todos.filter(p => minhaLeitura(p.id)).length;

  app.innerHTML = htmlTopo('pops') +
    '<div class="miolo">' +
    // nível 1: macroáreas
    '<div class="chips">' +
    '<button class="chip' + (!alvo ? ' marcado' : '') + '" data-ir="">Todos · ' + todos.length + '</button>' +
    asAreas.map(a => {
      const n = (a.setores || []).reduce((t, st) => t + quantos(st), 0);
      const on = areaAberta && norm(areaAberta.nome) === norm(a.nome);
      return '<button class="chip' + (on ? ' marcado' : '') + '" data-ir="' + esc(a.nome) + '">' +
        (a.ic || '') + ' ' + esc(a.nome) + ' · ' + n + '</button>';
    }).join('') +
    '</div>' +
    // nível 2: setores da área aberta (com os vazios à vista)
    (areaAberta ? '<div class="chips" style="margin-top:-6px">' +
      (areaAberta.setores || []).map(st => {
        const n = quantos(st);
        const on = norm(st) === norm(setorSel);
        return '<button class="chip' + (on ? ' marcado' : '') + (n ? '' : ' vazio') + '" data-ir="' + esc(st) + '">' +
          esc(st) + ' · ' + n + '</button>';
      }).join('') + '</div>' : '') +
    (setorSel && resumoDoSetor(setorSel)
      ? '<div class="aviso azul" style="margin-top:0">' + esc(resumoDoSetor(setorSel)) + '</div>' : '') +
    (!alvo ? '<div class="card"><div class="sub">Seus POPs</div>' +
      '<p class="bloco-par">Você já leu <b>' + lidos + ' de ' + todos.length + '</b>. Toque numa área acima para ver os setores dela.</p></div>' : '') +
    (daTela.length ? daTela.map(p => {
      const li = minhaLeitura(p.id);
      const desatualizada = li && li.versaoLida !== (p.versao || '1.0');
      return '<a class="item-lista" href="#/pop/' + p.id + '">' +
        (p.codigo ? '<div class="cod">' + esc(p.codigo) + '</div>' : '') +
        '<h3>' + esc(p.titulo) + '</h3>' +
        '<div class="meta"><span class="selo setor">' + esc(p.setor || 'Geral') + '</span>' +
        (li && !desatualizada ? '<span class="selo lido">✓ lido</span>' : '') +
        (desatualizada ? '<span class="selo pendente">mudou — releia</span>' : '') +
        (!li ? '<span class="selo pendente">não lido</span>' : '') +
        '<span>v' + esc(p.versao || '1.0') + '</span></div></a>';
    }).join('')
      : '<div class="card"><b>Nenhum POP aqui ainda.</b>' +
        (setorSel ? '<p class="bloco-par" style="margin-bottom:0">Este setor ainda não tem procedimento escrito. ' +
          (souAdmin() || meusSetores().some(x => norm(x) === norm(setorSel))
            ? 'Toque em “Novo POP” para começar.' : 'Fale com a gestão do setor.') + '</p>' : '') +
        '</div>') +
    (souAdmin() || meusSetores().length ? '<div class="acoes"><a class="botao suave largo" href="#/editor/pop/novo">➕ Novo POP</a></div>' : '') +
    '</div>';
  ligarTopo();
  $$('[data-ir]').forEach(c => c.onclick = () => {
    location.hash = c.dataset.ir ? '#/pops/' + encodeURIComponent(c.dataset.ir) : '#/pops';
  });
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
    (p.revisadoEm ? '<span>revisado em ' + fmtData(p.revisadoEm) + '</span>' : '') +
    (p.responsavel ? '<span>executa: ' + esc(p.responsavel) + '</span>' : '') + '</div>' +
    (p.objetivo ? '<div class="aviso azul" style="margin-bottom:0"><b>Objetivo:</b> ' + esc(p.objetivo) + '</div>' : '') +
    '</div>' +
    (p.epis && p.epis.length ? '<div class="card"><div class="sub">EPIs obrigatórios</div><div class="chips" style="margin:0">' +
      p.epis.map(e => '<span class="chip">🦺 ' + esc(e) + '</span>').join('') + '</div></div>' : '') +
    '<div class="card">' + blocosParaHtml(p.blocos) + '</div>' +
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
  if (bt) bt.onclick = () => { registrarLeitura(p); toast('Leitura registrada ✓', 'sucesso'); renderApp(); };
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
    const feitas = Object.keys(meuProgresso(j.id).etapas || {}).length;
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
        '<h3 style="margin:0;font-size:17.5px">' + (l.ic || '') + ' ' + esc(l.nome) + '</h3>' +
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
  const feitas = Object.keys(pr.etapas || {}).length;
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
    if (Object.keys(pr.etapas).length >= j.etapas.length && !pr.concluidaEm) pr.concluidaEm = new Date().toISOString();
    STORE.salvar('progresso', pr);
    toast(pr.concluidaEm && Object.keys(pr.etapas).length >= j.etapas.length ? '🎓 Jornada concluída!' : 'Etapa concluída ✓', 'sucesso');
    renderApp();
  };
}

/* ══════════ treinamento: ler, aceitar, concluir ══════════ */
function renderTreinamento(app) {
  const t = STORE.um('treinamentos', ROTA.arg);
  if (!t) { location.hash = '#/meus'; return; }
  const u = norm(SESSAO.usuario);
  const feito = STORE.um('leituras', 't-' + u + '-' + t.id);
  const venc = feito && t.validadeMeses ? (() => {
    const d = new Date(feito.em); d.setMonth(d.getMonth() + Number(t.validadeMeses)); return d;
  })() : null;
  const vencido = venc && venc < new Date();
  app.innerHTML = htmlTopo('meus') +
    '<div class="miolo">' +
    '<div class="card pop-cab">' +
    '<div class="cod" style="color:var(--cinza-4);font-weight:700;font-size:12.5px">' +
    (t.tipo === 'etica' ? 'CÓDIGO DE ÉTICA' : t.tipo === 'norma' ? 'NORMA' : 'TREINAMENTO') + '</div>' +
    '<h1>' + esc(t.titulo) + '</h1>' +
    '<div class="linha-meta"><span>versão ' + esc(t.versao || '1.0') + '</span>' +
    (t.validadeMeses ? '<span>reciclagem a cada ' + esc(t.validadeMeses) + ' meses</span>' : '') + '</div>' +
    (t.resumo ? '<div class="aviso azul" style="margin-bottom:0">' + esc(t.resumo) + '</div>' : '') +
    '</div>' +
    '<div class="card">' + blocosParaHtml(t.blocos) + '</div>' +
    (vencido ? '<div class="aviso amarelo">Sua confirmação venceu em ' + fmtData(venc.toISOString()) + '. Releia e confirme de novo.</div>' : '') +
    '<div class="acoes">' +
    (feito && !vencido
      ? '<div class="aviso verde" style="flex:1">✓ ' + (t.exigeAceite ? 'Aceito' : 'Concluído') + ' em ' + fmtDataHora(feito.em) +
        (venc ? ' · vale até ' + fmtData(venc.toISOString()) : '') + '</div>'
      : '<button class="botao verde largo" id="bt-ok">' +
        (t.exigeAceite ? '✔ Li, entendi e me comprometo' : '✔ Concluí este treinamento') + '</button>') +
    '</div>' +
    '<div class="acoes"><button class="botao suave" id="bt-whats">💬 Enviar por WhatsApp</button></div>' +
    '</div>';
  ligarTopo();
  $('#bt-whats').onclick = () => abrirEnviarWhats(t, 'treinamento');
  const bt = $('#bt-ok');
  if (bt) bt.onclick = () => {
    if (t.exigeAceite && !confirm('Confirmar o aceite de "' + t.titulo + '"?\n\nFica registrado com o seu nome, a data e a versão do documento.')) return;
    STORE.salvar('leituras', {
      id: 't-' + u + '-' + t.id, usuario: u, nome: SESSAO.nome, treinamentoId: t.id,
      versaoLida: t.versao || '1.0', aceite: !!t.exigeAceite, em: new Date().toISOString(),
    });
    toast(t.exigeAceite ? 'Aceite registrado ✓' : 'Treinamento concluído ✓', 'sucesso');
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
      'A gestão faz esse vínculo em <b>Pessoas</b> — depois disso, o que for atribuído a você aparece aqui.</div>' : '') +
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
  const conteudos = []
    .concat(STORE.col('treinamentos').map(t => ({ tipo: 'treinamento', id: t.id, titulo: t.titulo, grupo: 'Treinamentos' })))
    .concat(STORE.col('jornadas').map(j => ({ tipo: 'jornada', id: j.id, titulo: j.titulo, grupo: 'Jornadas' })))
    .concat(STORE.col('pops').map(o => ({ tipo: 'pop', id: o.id, titulo: (o.codigo ? o.codigo + ' · ' : '') + o.titulo, grupo: 'POPs' })));
  app.innerHTML = htmlTopo('pessoas') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">Pessoas</div>' +
    '<p class="bloco-par">Vindas do RH (' + ps.length + ' ativas). Ligue cada pessoa à conta dela para que os treinamentos apareçam no app dela.</p>' +
    (souAdmin() ? '<button class="botao suave" id="bt-sinc-pessoas">🔄 Atualizar do RH</button>' : '') + '</div>' +
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
      toast(r.ativos + ' pessoa(s) do RH ✓', 'sucesso');
      renderApp();
    } catch { toast('Não consegui falar com o servidor agora.', 'erro'); bs.disabled = false; bs.textContent = '🔄 Atualizar do RH'; }
  };
  $$('[data-pessoa]').forEach(el => el.onclick = () => abrirPessoa(el.dataset.pessoa, conteudos));
}

function abrirPessoa(pessoaId, conteudos) {
  const p = STORE.um('pessoas', pessoaId);
  if (!p) return;
  const at = atribuicoesDe(p.id);
  const grupos = [...new Set(conteudos.map(c => c.grupo))];
  const m = abrirModal(
    '<h3>' + esc(p.nome) + '</h3>' +
    '<p class="dica">' + esc([p.funcao, p.area].filter(Boolean).join(' · ')) + '</p>' +
    '<div class="campo"><label>Conta no app (Central de Acessos)</label>' +
    '<input type="text" id="pe-usuario" value="' + esc(p.usuario || '') + '" placeholder="ex.: barbara" autocapitalize="none">' +
    '<div class="dica">É o usuário com que a pessoa entra. Sem isso, o treinamento não chega até ela.</div></div>' +
    '<div class="sub" style="margin-top:16px">Treinamentos atribuídos</div>' +
    '<div id="pe-lista">' +
    (at.length ? at.map(a => {
      const it = conteudoDe(a);
      const c = p.usuario ? conclusaoDe(a, p.usuario) : null;
      const ok = c && !c.vencido && !c.desatualizado;
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--borda)">' +
        '<span style="flex:1;font-size:14.5px">' + esc(it ? it.titulo : '(removido)') + '</span>' +
        '<span class="selo ' + (ok ? 'lido' : 'pendente') + '">' + (ok ? '✓' : 'pendente') + '</span>' +
        '<button class="botao mini fantasma" data-tirar="' + a.id + '">tirar</button></div>';
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
    '<button class="botao btn-salvar">Salvar conta</button></div>'
  );
  $('.btn-fechar', m).onclick = () => m.remove();
  $('.btn-salvar', m).onclick = () => {
    const u = norm($('#pe-usuario', m).value);
    // Uma conta = uma pessoa. Com a mesma conta em duas fichas, minhaPessoa()
    // pega a primeira e os treinamentos da outra ficam invisíveis PARA SEMPRE.
    const jaTem = u && pessoas().find(x => x.id !== p.id && norm(x.usuario || '') === u);
    if (jaTem) {
      toast('A conta "' + u + '" já está ligada a ' + jaTem.nome + '. Tire de lá antes.', 'erro');
      return;
    }
    STORE.salvar('pessoas', Object.assign({}, p, { usuario: u }));
    toast(u ? 'Conta vinculada ✓' : 'Vínculo removido', 'sucesso');
    m.remove(); renderApp();
  };
  $('.btn-add', m).onclick = () => {
    const [tipo, refId] = $('#pe-novo', m).value.split('|');
    if (atribuicoesDe(p.id).some(a => a.tipo === tipo && a.refId === refId)) {
      toast('Já está atribuído.', 'erro'); return;
    }
    STORE.salvar('atribuicoes', {
      id: 'a-' + p.id + '-' + tipo + '-' + refId,
      pessoaId: p.id, tipo, refId,
      atribuidoPor: SESSAO.nome, em: new Date().toISOString(),
    });
    toast('Atribuído ✓', 'sucesso');
    m.remove(); abrirPessoa(pessoaId, conteudos);
  };
  $$('[data-tirar]', m).forEach(b => b.onclick = () => {
    STORE.apagar('atribuicoes', b.dataset.tirar);
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
  leituras.forEach(l => pessoas.set(l.usuario, l.nome || l.usuario));
  progresso.forEach(p => pessoas.set(p.usuario, p.nome || p.usuario));
  const nomes = [...pessoas.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  app.innerHTML = htmlTopo('mapa') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">Mapa de treinamento</div>' +
    '<p class="bloco-par">Quem leu cada POP e quem concluiu cada jornada. Aparece aqui quem já registrou pelo menos uma leitura.</p></div>' +
    '<div class="card rolagem-x"><div class="sub">POPs</div>' +
    '<table class="tab-mapa"><tr><th>Pessoa</th>' +
    pops.map(p => '<th title="' + esc(p.titulo) + '">' + esc(p.codigo || p.titulo.slice(0, 10)) + '</th>').join('') + '</tr>' +
    (nomes.length ? nomes.map(([u, nome]) => '<tr><td>' + esc(nome) + '</td>' +
      pops.map(p => {
        const l = leituras.find(x => x.usuario === u && x.popId === p.id);
        const ok = l && l.versaoLida === (p.versao || '1.0');
        return '<td class="' + (ok ? 'ok' : 'nao') + '">' + (ok ? '✓' : (l ? 'v.antiga' : '—')) + '</td>';
      }).join('') + '</tr>').join('') : '<tr><td colspan="' + (pops.length + 1) + '">Ninguém registrou leitura ainda.</td></tr>') +
    '</table></div>' +
    '<div class="card rolagem-x"><div class="sub">Jornadas</div>' +
    '<table class="tab-mapa"><tr><th>Pessoa</th>' +
    jornadas.map(j => '<th>' + esc(j.titulo.slice(0, 18)) + '</th>').join('') + '</tr>' +
    (nomes.length ? nomes.map(([u, nome]) => '<tr><td>' + esc(nome) + '</td>' +
      jornadas.map(j => {
        const pr = progresso.find(x => x.usuario === u && x.jornadaId === j.id);
        const total = (j.etapas || []).length;
        const feitas = pr ? Object.keys(pr.etapas || {}).length : 0;
        return '<td class="' + (feitas >= total && total ? 'ok' : 'nao') + '">' +
          (feitas >= total && total ? '🎓' : (feitas ? feitas + '/' + total : '—')) + '</td>';
      }).join('') + '</tr>').join('') : '<tr><td colspan="' + (jornadas.length + 1) + '">Ninguém começou ainda.</td></tr>') +
    '</table></div>' +
    '</div>';
  ligarTopo();
}

/* ══════════ editores ══════════ */
function renderEditorPop(app) {
  const novo = ROTA.arg === 'novo';
  const p = novo
    ? { id: uuid(), titulo: '', codigo: '', setor: meusSetores()[0] || setores()[0], objetivo: '', epis: [], blocos: [], versao: '1.0' }
    : STORE.um('pops', ROTA.arg);
  if (!p || (!novo && !possoEditar(p))) { location.hash = '#/pops'; return; }
  const meusS = meusSetores();
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
    '<div class="acoes">' +
    '<button class="botao largo" id="e-salvar">💾 Salvar POP</button>' +
    (!novo && souAdmin() ? '<button class="botao fantasma" id="e-apagar">🗑 Apagar</button>' : '') +
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
    });
    if (!STORE.salvar('pops', salvo)) { toast('Não consegui salvar (memória cheia?)', 'erro'); return; }
    toast('POP salvo ✓', 'sucesso');
    location.hash = '#/pop/' + salvo.id;
  };
  const ap = $('#e-apagar');
  if (ap) ap.onclick = () => {
    if (!confirm('Apagar este POP? Quem já registrou leitura mantém o registro.')) return;
    STORE.apagar('pops', p.id);
    toast('POP apagado');
    location.hash = '#/pops';
  };
}

function renderEditorJornada(app) {
  if (!souAdmin()) { location.hash = '#/fab'; return; }
  const novo = ROTA.arg === 'novo';
  const j = novo
    ? { id: uuid(), titulo: '', descricao: '', nivel: 'Técnico', versao: '1.0', etapas: [] }
    : STORE.um('jornadas', ROTA.arg);
  if (!j) { location.hash = '#/fab'; return; }
  // etapas viram texto: separador de etapa é uma linha "=== Título da etapa ==="
  const texto = (j.etapas || []).map(e => '=== ' + e.titulo + ' ===\n\n' + blocosParaTexto(e.blocos)).join('\n\n');
  app.innerHTML = htmlTopo('fab') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">' + (novo ? 'Nova jornada' : 'Editar jornada') + '</div>' +
    '<div class="campo"><label>Título</label><input type="text" id="e-titulo" value="' + esc(j.titulo) + '" placeholder="Ex: Fabricação de letra caixa"></div>' +
    '<div class="campo"><label>Descrição (o que a pessoa vai dominar)</label><input type="text" id="e-desc" value="' + esc(j.descricao) + '"></div>' +
    '<div class="campo"><label>Nível</label><select id="e-nivel">' +
    ['Introdutório', 'Técnico', 'Avançado'].map(n => '<option' + (j.nivel === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<div class="campo"><label>Versão</label><input type="text" id="e-versao" value="' + esc(j.versao || '1.0') + '"></div>' +
    '<div class="campo"><label>Etapas</label><textarea id="e-conteudo" style="min-height:340px">' + esc(texto) + '</textarea>' +
    '<div class="dica">Cada etapa começa com uma linha <b>=== Título da etapa ===</b>. Dentro dela vale a mesma sintaxe dos POPs (##, 1., -, !, !!, [ ]).</div></div>' +
    '<div class="acoes">' +
    '<button class="botao largo" id="e-salvar">💾 Salvar jornada</button>' +
    (!novo ? '<button class="botao fantasma" id="e-apagar">🗑 Apagar</button>' : '') +
    '</div></div></div>';
  ligarTopo();
  $('#e-salvar').onclick = () => {
    const titulo = $('#e-titulo').value.trim();
    if (!titulo) { toast('Dê um título à jornada.', 'erro'); return; }
    const partes = $('#e-conteudo').value.split(/^===\s*(.+?)\s*===\s*$/m);
    const etapas = [];
    // partes = [antes, titulo1, corpo1, titulo2, corpo2, ...]
    const antigas = j.etapas || [];
    for (let i = 1; i < partes.length; i += 2) {
      const tituloEtapa = partes[i].trim();
      // preserva o id da etapa pelo título: o progresso já registrado não se perde
      const antiga = antigas.find(e => norm(e.titulo) === norm(tituloEtapa));
      etapas.push({ id: antiga ? antiga.id : uuid(), titulo: tituloEtapa, blocos: textoParaBlocos(partes[i + 1] || '') });
    }
    if (!etapas.length) { toast('A jornada precisa de pelo menos uma etapa (=== Título ===).', 'erro'); return; }
    const salvo = Object.assign({}, j, {
      titulo, descricao: $('#e-desc').value.trim(), nivel: $('#e-nivel').value,
      versao: $('#e-versao').value.trim() || '1.0', etapas,
      revisadoEm: new Date().toISOString(), revisadoPor: SESSAO.nome,
    });
    if (!STORE.salvar('jornadas', salvo)) { toast('Não consegui salvar (memória cheia?)', 'erro'); return; }
    toast('Jornada salva ✓', 'sucesso');
    location.hash = '#/jornada/' + salvo.id;
  };
  const ap = $('#e-apagar');
  if (ap) ap.onclick = () => {
    if (!confirm('Apagar esta jornada?')) return;
    STORE.apagar('jornadas', j.id);
    location.hash = '#/fab';
  };
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
function renderMenu(app) {
  app.innerHTML = htmlTopo('menu') +
    '<div class="miolo">' +
    '<div class="card"><div class="sub">Sua conta</div>' +
    '<p class="bloco-par"><b>' + esc(SESSAO.nome) + '</b> · ' + esc(SESSAO.papel) + '</p>' +
    '<p class="dica">Última sincronização: ' + (STORE.lastSync() ? fmtDataHora(STORE.lastSync()) : 'ainda não sincronizou') + '</p>' +
    '<div class="acoes"><a class="botao suave" href="#/senha">🔑 Trocar a minha senha</a>' +
    '<button class="botao fantasma" id="bt-sair">Sair</button></div></div>' +
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
    const cfg = Object.assign({}, STORE.getCFG(), { gestores, setores: lista });
    try {
      await STORE.api('setCfg', { config: cfg });
      localStorage.setItem('pops_cfg', JSON.stringify(cfg));
      toast('Configuração salva ✓', 'sucesso');
    } catch { toast('Sem conexão — tente de novo com internet.', 'erro'); }
  };
}

/* ══════════ rotas ══════════ */
let ROTA = { nome: 'inicio', arg: '' };
function lerRota() {
  const h = location.hash.replace(/^#\/?/, '');
  const [nome, ...resto] = h.split('/');
  ROTA = { nome: nome || 'inicio', arg: decodeURIComponent(resto.join('~') || '') };
}
function renderApp() {
  const app = $('#app');
  if (!SESSAO) { renderLogin(app); return; }
  lerRota();
  // Enquanto a senha for a temporária, o app inteiro fica atrás desta tela.
  if (SESSAO.trocarSenha && ROTA.nome !== 'senha') { location.hash = '#/senha'; return; }
  const R = {
    'inicio': renderInicio, '': renderInicio,
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
      if (tipo === 'pop') renderEditorPop(a); else renderEditorJornada(a);
    },
  };
  (R[ROTA.nome] || renderInicio)(app);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderApp);

(function boot() {
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('./sw.js'); } catch {} }
  renderApp();
  if (SESSAO) STORE.pull().then(() => renderApp());
  setInterval(() => { if (SESSAO && document.visibilityState === 'visible') { STORE.pull(); } }, 90000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && SESSAO) { STORE.trySync(); STORE.pull(); }
  });
})();
