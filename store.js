// Offline-first: dados e fila são gravados juntos, por conta e papel. A confirmação
// de um envio só remove aquela versão; edição feita durante a rede é preservada.
const STORE = (() => {
  const USER = 'pops_user';
  const COLS = ['pops', 'jornadas', 'treinamentos', 'pessoas', 'atribuicoes', 'leituras', 'progresso'];
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const novoEnvio = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
  const perfil = u => ['admin','gestor','equipe'].includes(u?.papel) ? u.papel : 'sem-perfil';
  // O v3 de gestores continha acompanhamento amplo. A nova chave nunca adota
  // esses dados pessoais ou sua fila automaticamente; a origem fica preservada.
  const perfilV3 = u => 'pops_v3_' + encodeURIComponent(norm(u && u.usuario)) + '_' + perfil(u);
  const perfilKey = u => (perfil(u) === 'gestor' ? 'pops_v4_' : 'pops_v3_') + encodeURIComponent(norm(u && u.usuario)) + '_' + perfil(u);
  const sufixoRH = u => u?.identidadeConferida === true ? '_rh_' + encodeURIComponent(u.pessoaRH?.colaboradorId || 'sem-vinculo') : '';
  const key = u => perfilKey(u) + sufixoRH(u);
  const PESSOAIS_GESTOR = new Set(['pessoas','atribuicoes','leituras','progresso']);
  const restritaGestor = c => perfil(getUser()) === 'gestor' && PESSOAIS_GESTOR.has(c);
  const legacyKey = u => 'pops_v2_' + encodeURIComponent(norm(u && u.usuario));
  const vazio = () => ({ dados: {}, cfg: {}, fila: [], rev: { porColecao: {} }, syncEm: null });
  const ouvintes = {};
  const avisar = (ev, dado) => (ouvintes[ev] || []).forEach(f => { try { f(dado); } catch {} });
  function ler(k, fallback) { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
  function getUser() { try { return ler(USER, null); } catch { return null; } }
  let epoch = 0, syncing = null, pulling = null, timer = null, reagendo = null;
  // Uma fila vazia não prova gravação nem atualização. Os erros pertencem à
  // mesma conta/papel/ID RH do cache, inclusive antes de a interface assinar eventos.
  const estados = new Map();
  const copia = x => x == null ? x : JSON.parse(JSON.stringify(x));
  function estadoLocal() {
    const u = getUser(), k = u ? key(u) : 'sem-sessao';
    if (!estados.has(k)) estados.set(k, { naoGravados:new Map(), confirmado:false, armazenamento:'', leitura:'', atualizacao:'', conhecimento:'' });
    return estados.get(k);
  }
  function state() {
    const u = getUser(); if (!u) return vazio();
    try {
      const s = ler(key(u), copia(estadoLocal().migracaoPendente) || vazio());
      if (!s || typeof s !== 'object' || !s.dados || !Array.isArray(s.fila) || !s.rev?.porColecao) throw new Error('Cache inválido');
      return s;
    } catch (e) {
      estadoLocal().leitura = 'Não foi possível ler os dados deste aparelho. Preserve uma cópia antes de qualquer recuperação.';
      throw e;
    }
  }
  function falhaGravacao() {
    const st = estadoLocal();
    const primeira = !st.armazenamento;
    st.armazenamento = 'Não foi possível gravar neste aparelho. Os dados anteriores foram preservados; libere espaço e tente novamente.';
    if (primeira) avisar('quota', st.armazenamento);
    avisar('sync', resumoSync());
  }
  function gravar(s) {
    if (!getUser()) return false;
    try {
      localStorage.setItem(key(getUser()), JSON.stringify(s));
      estadoLocal().armazenamento = ''; delete estadoLocal().migracaoPendente;
      return true;
    } catch { falhaGravacao(); return false; }
  }
  function getNaoGravados() { return copia([...estadoLocal().naoGravados.values()]); }

  // O conteúdo comum continua útil offline, mas um vínculo RH diferente não
  // herda confirmações, atribuições ou rascunhos da pessoa anterior. A origem
  // inteira fica guardada na própria chave; nada dela é reenviado automaticamente.
  function compartilharCatalogo(s, origem, chaveOrigem) {
    const novo = vazio();
    for (const c of ['pops','jornadas','treinamentos']) {
      const pendentes = new Set((s.fila || []).filter(x => x.colecao === c).map(x => x.id || x.registro?.id));
      novo.dados[c] = (s.dados?.[c] || []).filter(x => !pendentes.has(x.id));
    }
    novo.cfg = s.cfg || {};
    if (s.conhecimento) novo.conhecimento = s.conhecimento;
    novo.preservacao = { chave: chaveOrigem, usuario: norm(origem?.usuario), papel: perfil(origem), colaboradorId: origem?.identidadeConferida ? origem.pessoaRH?.colaboradorId || null : null, pendentes: (s.fila || []).length, rascunhos: (s.rascunhos || []).length };
    return novo;
  }
  function avisarPreservacao(s) {
    const p = s?.preservacao;
    if (p && (p.pendentes || p.rascunhos)) avisar('cachePreservado', p);
  }
  function setUser(u) {
    try {
      const anterior = getUser();
      if (u && anterior && perfilKey(u) === perfilKey(anterior) && key(u) !== key(anterior) && localStorage.getItem(key(u)) === null) {
        const origem = ler(key(anterior), vazio());
        localStorage.setItem(key(u), JSON.stringify(compartilharCatalogo(origem, anterior, key(anterior))));
      }
      if (u) localStorage.setItem(USER, JSON.stringify(u)); else localStorage.removeItem(USER);
      epoch++; clearTimeout(timer); clearTimeout(reagendo); timer = reagendo = null;
      if (u) { estadoLocal().confirmado = false; estadoLocal().gestorConfirmado = false; avisarPreservacao(state()); if (perfil(u) === 'gestor') avisar('escopoGestor', {confirmado:false,motivo:'sessao'}); }
      return true;
    } catch { falhaGravacao(); return false; }
  }
  // Migra somente o usuário E papel que já estavam identificados no boot,
  // antes da conferência online. Login posterior nunca adota dados sem origem.
  // Ao mudar de papel, outro cache começa vazio e a fila anterior fica intacta.
  try {
    const antigo = getUser();
    if (antigo && perfil(antigo) !== 'sem-perfil' && localStorage.getItem(key(antigo)) === null) {
      const temPerfil = key(antigo) !== perfilKey(antigo) && localStorage.getItem(perfilKey(antigo)) !== null;
      const origemGestor = !temPerfil && perfil(antigo) === 'gestor' ? [perfilV3(antigo) + sufixoRH(antigo), perfilV3(antigo)].find(k => localStorage.getItem(k) !== null) : null;
      const temV2 = localStorage.getItem(legacyKey(antigo)) !== null;
      const fila = temV2 || temPerfil || origemGestor ? [] : ler('pops_fila', []).map(it => ({ ...it, mutationId: novoEnvio(), tentado: true }));
      let s = origemGestor ? ler(origemGestor, vazio()) : temPerfil ? ler(perfilKey(antigo), vazio()) : temV2 ? ler(legacyKey(antigo), vazio())
        : { dados: ler('pops_dados', {}), cfg: ler('pops_cfg', {}), fila, rev: { porColecao: {} }, syncEm: null };
      if (antigo.identidadeConferida === true || perfil(antigo) === 'gestor') {
        // Cache anterior à separação por RH não prova a identidade dos dados.
        // Guardar a origem antes de limpar dados/revisões pessoais.
        const origemKey = origemGestor || (temPerfil ? perfilKey(antigo) : legacyKey(antigo));
        if (!origemGestor && !temPerfil && !temV2) localStorage.setItem(origemKey, JSON.stringify(s));
        s = compartilharCatalogo(s, origemGestor ? antigo : { ...antigo, identidadeConferida: false }, origemKey);
      }
      // Enquanto a chave nova não couber, a origem continua íntegra e legível.
      // Uma retentativa não pode começar uma fila vazia por engano.
      estadoLocal().migracaoPendente = copia(s);
      if (gravar(s) && !temV2 && !temPerfil && !origemGestor) ['pops_dados','pops_cfg','pops_fila','pops_rev','pops_lastsync'].forEach(k => localStorage.removeItem(k));
    }
  } catch { falhaGravacao(); }

  async function api(action, body, timeoutMs) {
    const sessaoDaChamada = epoch;
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
    try {
      const r = await fetch(window.API_BASE + '/' + window.API_FN.sync, {
        method: 'POST', headers: { 'Content-Type': 'application/json', authorization: 'Bearer ' + (typeof AUTH !== 'undefined' ? AUTH.cracha() : '') },
        body: JSON.stringify({ action, ...(body || {}) }), signal: ctrl.signal,
      });
      let data; try { data = await r.json(); } catch { throw new Error('Resposta incompleta do servidor.'); }
      if (!r.ok || data?.ok === false || data?.erro || data?.error) {
        const erro = Object.assign(new Error(data?.erro || data?.error || ('Falha ao sincronizar (' + r.status + ').')), { status: r.status });
        if (r.status === 401 && sessaoDaChamada === epoch) avisar('sessao', erro.message);
        throw erro;
      }
      return data;
    } finally { clearTimeout(t); }
  }
  const sig = it => it.colecao + ':' + (it.id || it.registro?.id || '');
  function visivelGestor(colecao, registro) {
    if (!restritaGestor(colecao)) return true;
    const st = estadoLocal();
    if (!navigator.onLine || !st.gestorConfirmado) return false;
    // IDs vêm da consulta filtrada do servidor nesta sessão. Uma edição em fila
    // não pode recolocar dados de alguém que deixou o setor do gestor.
    if (st.gestorIds?.[colecao]?.has(registro?.id)) return true;
    // Novas atribuições podem aparecer pendentes para uma pessoa autorizada.
    return colecao === 'atribuicoes' && st.gestorIds?.pessoas?.has(registro?.pessoaId);
  }
  function col(nome) { try { return (state().dados[nome] || []).filter(r => !r._apagado && visivelGestor(nome,r)); } catch { return []; } }
  const um = (nome, id) => col(nome).find(r => r.id === id) || null;
  function filaInterna() { try { return state().fila || []; } catch { return []; } }
  function getFila() { return filaInterna().filter(it => visivelGestor(it.colecao,it.registro || {id:it.id})); }
  function alterar(action, colecao, reg, id, opcoes = {}) {
    try {
      if (!COLS.includes(colecao) || !id || !getUser()) return false;
      const s = state(), lista = s.dados[colecao] || [], anterior = lista.find(r => r.id === id);
      const i = s.fila.findIndex(x => sig(x) === colecao + ':' + id), pendente = s.fila[i];
      const expectedRevision = pendente?.expectedRevision ?? anterior?._serverRevision ?? (anterior ? null : 0);
      // Falha local não é sucesso. Guarda a tentativa só nesta sessão, com seu
      // ID idempotente, para retentativa/exportação explícita sem perder o formulário.
      const baseRegistro = copia(anterior || null), baseMutationId = pendente?.mutationId || null;
      const guardarAlteracao = () => {
        const item = s.fila.find(x => sig(x) === colecao + ':' + id);
        if (!gravar(s)) {
          estadoLocal().naoGravados.set(colecao + ':' + id, { action, colecao, id, registro:copia(s.dados[colecao]?.find(x => x.id === id) || null), mutationId:item?.mutationId || null, item:copia(item || null), baseRegistro, baseMutationId, falhouEm:new Date().toISOString() });
          avisar('sync', resumoSync()); return false;
        }
        estadoLocal().naoGravados.delete(colecao + ':' + id);
        avisar('sync', resumoSync()); agendarSync(); return true;
      };
      if (action === 'delete' && pendente?.action === 'upsert' && expectedRevision === 0 && !pendente.tentado && syncing !== epoch) {
        s.fila.splice(i,1); s.dados[colecao] = lista.filter(r => r.id !== id);
        return guardarAlteracao();
      }
      const item = { action, colecao, id, expectedRevision, mutationId: novoEnvio(), tentado: !!pendente?.tentado };
      if (opcoes.confirmarRevisao === true && colecao === 'pops') item.confirmarRevisao = true;
      if (action === 'upsert') {
        item.registro = { ...reg, atualizadoEm: new Date().toISOString() };
        s.dados[colecao] = lista.filter(r => r.id !== id).concat([item.registro]);
      } else s.dados[colecao] = lista.filter(r => r.id !== id);
      if (i >= 0) s.fila[i] = item; else s.fila.push(item);
      return guardarAlteracao();
    } catch { avisar('sync', resumoSync()); return false; }
  }
  const salvar = (colecao, registro, opcoes) => alterar('upsert', colecao, registro, registro?.id, opcoes);
  const apagar = (colecao, id) => alterar('delete', colecao, null, id);
  function agendarSync() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; trySync(); }, 2500);
  }
  function resumoSync() {
    let s; try { s = state(); } catch { s = vazio(); }
    const q = s.fila || [], st = estadoLocal(), naoGravados = st.naoGravados.size;
    const erro = st.leitura || st.armazenamento || (naoGravados ? 'Há alterações não gravadas. Elas estão apenas nesta sessão; tente novamente ou baixe uma cópia antes de sair.' : '') || st.atualizacao || q.find(x => x.erro)?.erro || st.conhecimento || '';
    const status = st.leitura || st.armazenamento || naoGravados ? 'erro'
      : q.some(x => x.bloqueado) ? 'revisar'
      : !navigator.onLine ? 'offline'
      : pulling === epoch || syncing === epoch ? 'sincronizando'
      : st.atualizacao || q.some(x => x.erro) ? 'erro'
      : q.length ? 'pendente'
      : st.conhecimento ? 'parcial'
      : st.confirmado ? 'ok' : 'aguardando';
    return { status, pendentes:q.length, naoGravados, erro, ultimaAtualizacao:s.syncEm || null, confirmado:st.confirmado };
  }
  function exportarRecuperacao() {
    const u = getUser(); let cacheOriginal = null;
    try { cacheOriginal = u ? localStorage.getItem(key(u)) : null; } catch {}
    let dados = null; try { dados = state(); } catch {}
    return { formato:'impresilk-pops-recuperacao-v1', exportadoEm:new Date().toISOString(), conta:u ? { usuario:u.usuario, papel:u.papel, colaboradorId:u.pessoaRH?.colaboradorId || null } : null,
      dados:copia(dados), naoGravados:getNaoGravados(), cacheOriginal, estado:resumoSync() };
  }
  async function tentarNovamente() {
    if (!getUser()) return false;
    const inicio = epoch, st = estadoLocal();
    let s; try { s = state(); } catch { avisar('sync', resumoSync()); return false; }
    for (const tentativa of [...st.naoGravados.values()]) {
      const assinatura = tentativa.colecao + ':' + tentativa.id;
      const atual = s.fila.find(x => sig(x) === assinatura);
      const registro = (s.dados[tentativa.colecao] || []).find(x => x.id === tentativa.id) || null;
      if ((atual?.mutationId || null) !== tentativa.baseMutationId || JSON.stringify(registro) !== JSON.stringify(tentativa.baseRegistro)) {
        st.armazenamento = 'O registro mudou depois da falha. Confira o formulário e a cópia de recuperação antes de substituir a versão atual.';
        avisar('sync', resumoSync()); return false;
      }
      s.fila = s.fila.filter(x => sig(x) !== assinatura);
      if (tentativa.item) s.fila.push(copia(tentativa.item));
      s.dados[tentativa.colecao] = (s.dados[tentativa.colecao] || []).filter(x => x.id !== tentativa.id);
      if (tentativa.registro) s.dados[tentativa.colecao].push(copia(tentativa.registro));
      if (!gravar(s)) return false;
      st.naoGravados.delete(assinatura);
    }
    // Botão manual pode antecipar falhas transitórias; conflito e falta de
    // permissão continuam bloqueados até uma revisão explícita.
    for (const item of s.fila) if (!item.bloqueado) item.tentarEm = 0;
    if (!gravar(s)) return false;
    avisar('sync', resumoSync());
    if (!navigator.onLine) return true;
    await trySync(); if (inicio !== epoch) return false;
    return pull();
  }
  async function trySync() {
    const inicio = epoch;
    if (syncing === inicio || !getUser()) return;
    if (!navigator.onLine) { avisar('sync', resumoSync()); return; }
    syncing = inicio; avisar('sync', resumoSync());
    try {
      for (const item of filaInterna()) {
        if (inicio !== epoch) return;
        if (item.bloqueado || (item.tentarEm || 0) > Date.now()) continue;
        try {
          const antes = state(), enviando = antes.fila.find(x => x.mutationId === item.mutationId);
          if (!enviando) continue;
          enviando.tentado = true;
          if (!gravar(antes)) break;
          const { registro: reg, id, action, colecao, expectedRevision, mutationId } = item;
          const r = await api(action, { colecao, ...(action === 'upsert' ? { registro: reg } : { id }), expectedRevision, mutationId, ...(item.confirmarRevisao ? {confirmarRevisao:true} : {}) });
          if (inicio !== epoch) return;
          if (r?.ok !== true || !Number.isSafeInteger(r.revision) || r.revision < 1) throw new Error('O servidor não confirmou a gravação. A alteração continua pendente.');
          const s = state(), atual = s.fila.find(x => sig(x) === sig(item));
          if (!atual) continue;
          if (atual.mutationId === item.mutationId) {
            s.fila = s.fila.filter(x => x.mutationId !== item.mutationId);
            if (action === 'upsert' && r.registro) s.dados[colecao] = (s.dados[colecao] || []).filter(x => x.id !== id).concat([{ ...r.registro, _serverRevision: r.revision }]);
          } else if (r.revision != null) {
            // Edição B parte da versão A que acabou de chegar ao servidor.
            atual.expectedRevision = r.revision;
            if (atual.registro) atual.registro._serverRevision = r.revision;
          }
          if (!gravar(s)) break;
        } catch (e) {
          if (inicio !== epoch) return;
          const s = state(), atual = s.fila.find(x => x.mutationId === item.mutationId);
          if (atual) {
            atual.erro = e.message; atual.bloqueado = [400,403,409].includes(e.status);
            atual.falhas = (atual.falhas || 0) + 1;
            atual.tentarEm = Date.now() + Math.min(120000, 5000 * 2 ** Math.min(atual.falhas, 4));
            gravar(s);
          }
          if (e.status === 401) break;
        }
      }
    } finally {
      if (syncing === inicio) syncing = null;
      if (inicio === epoch) {
        avisar('sync', resumoSync());
        if (filaInterna().some(x => !x.bloqueado) && navigator.onLine && !reagendo) reagendo = setTimeout(() => { reagendo = null; trySync(); }, 10000);
      }
    }
  }
  async function pull() {
    const inicio = epoch;
    if (pulling === inicio || !getUser() || !navigator.onLine) return false;
    const gestor = perfil(getUser()) === 'gestor', gestorIds = {};
    if (gestor) { estadoLocal().gestorConfirmado = false; avisar('escopoGestor', {confirmado:false,motivo:'atualizacao'}); }
    pulling = inicio; avisar('sync', resumoSync());
    try {
      avisarPreservacao(state());
      const r = await api('rev'); if (inicio !== epoch) return false;
      if (!r.rev?.porColecao || typeof r.rev.porColecao !== 'object' || Array.isArray(r.rev.porColecao)) throw new Error('Resposta de atualização incompleta. Os últimos dados válidos foram preservados.');
      const deles = r.rev.porColecao;
      if (window.CONHECIMENTO_VERSAO && state().conhecimento?.versao !== window.CONHECIMENTO_VERSAO) {
        // A base complementar pode estar temporariamente indisponível sem
        // impedir a atualização dos procedimentos e dos registros pessoais.
        try {
          const resposta = await api('conhecimento');
          if (inicio !== epoch) return false;
          if (resposta.conhecimento?.versao !== window.CONHECIMENTO_VERSAO) throw new Error('A base de conhecimento ainda não pôde ser atualizada.');
          const s = state(); s.conhecimento = resposta.conhecimento;
          if (!gravar(s)) throw new Error('Sem espaço para guardar a base de conhecimento.');
          estadoLocal().conhecimento = ''; avisar('conhecimentoErro', null);
        } catch (e) {
          if (inicio !== epoch) return false;
          if (e.status === 401) throw e;
          estadoLocal().conhecimento = e.message; avisar('conhecimentoErro', e.message);
        }
      }
      for (const c of COLS.concat(['cfg'])) {
        if (inicio !== epoch) return false;
        const local = state();
        if (!restritaGestor(c) && Object.hasOwn(local.rev.porColecao, c) && local.rev.porColecao[c] === (deles[c] || 0)) continue;
        let dados;
        if (c === 'cfg') dados = (await api('getCfg')).config || {};
        else {
          let desde = null, tudo = [], vistos = new Set();
          while (true) {
            const rl = await api('list', { colecao: c, protocolo: 2, desde: desde || undefined, limite: 500 });
            if (inicio !== epoch) return false;
            if (!Array.isArray(rl.itens)) throw new Error('Lista incompleta recebida do servidor.');
            tudo = tudo.concat(rl.itens);
            if (!rl.proximo) break;
            const cursor = JSON.stringify(rl.proximo);
            if (vistos.has(cursor)) throw new Error('Não consegui completar a atualização. Tente novamente.');
            vistos.add(cursor); desde = rl.proximo;
          }
          dados = tudo;
        }
        if (inicio !== epoch) return false;
        const s = state();
        if (c === 'cfg') s.cfg = dados;
        else {
          // Coleção inteira confirmada: elimina ausências antigas, preservando
          // toda edição/exclusão local, inclusive as feitas DURANTE o download.
          const porId = new Map(dados.filter(x => !x.apagado && x.registro?.id).map(x => [x.registro.id, { ...x.registro, _serverRevision: x.revision }]));
          if (gestor && PESSOAIS_GESTOR.has(c)) gestorIds[c] = new Set(porId.keys());
          for (const it of s.fila.filter(x => x.colecao === c)) {
            const id = it.id || it.registro?.id;
            if (it.action === 'delete') porId.delete(id);
            else { const atual = (s.dados[c] || []).find(x => x.id === id); if (atual) porId.set(id, atual); }
          }
          s.dados[c] = [...porId.values()];
        }
        s.rev.porColecao[c] = deles[c] || 0;
        if (!gravar(s)) throw new Error('Sem espaço para guardar a atualização.');
      }
      const s = state(); s.syncEm = new Date().toISOString(); if (!gravar(s)) return false;
      estadoLocal().atualizacao = ''; estadoLocal().leitura = ''; estadoLocal().confirmado = true;
      if (gestor) { estadoLocal().gestorIds = gestorIds; estadoLocal().gestorConfirmado = true; avisar('escopoGestor', {confirmado:true}); }
      avisar('pull', null); return true;
    } catch (e) {
      if (inicio === epoch) { estadoLocal().atualizacao = e.message; avisar('pullErro', e.message); }
      return false;
    } finally {
      if (pulling === inicio) pulling = null;
      if (inicio === epoch) avisar('sync', resumoSync());
    }
  }
  async function salvarCFG(patch, anterior) {
    const inicio = epoch;
    const r = await api('setCfg', { config: patch, anterior });
    if (inicio !== epoch) return false;
    const s = state(); s.cfg = r.config || { ...s.cfg, ...patch };
    if (!gravar(s)) throw new Error('Configuração salva no servidor, mas falta espaço no aparelho.');
    return true;
  }
  // Revisão explícita de um conflito: conserva uma cópia do rascunho antes de
  // recuperar o servidor. Nunca sobrescreve silenciosamente o trabalho alheio.
  async function recuperarServidor(mutationId) {
    const inicio = epoch, item = getFila().find(x => x.mutationId === mutationId);
    if (!item) return;
    const id = item.id || item.registro?.id;
    const remoto = await api('get', { colecao: item.colecao, id });
    if (inicio !== epoch) return;
    const s = state();
    if (!s.fila.some(x => x.mutationId === mutationId)) return;
    s.rascunhos = (s.rascunhos || []).concat([{ ...item, guardadoEm: new Date().toISOString() }]);
    s.fila = s.fila.filter(x => x.mutationId !== mutationId);
    s.dados[item.colecao] = (s.dados[item.colecao] || []).filter(x => x.id !== id);
    if (remoto.registro) s.dados[item.colecao].push({ ...remoto.registro, _serverRevision: remoto.revision });
    if (!gravar(s)) throw new Error('Não consegui preservar o rascunho neste aparelho.');
    avisar('sync', resumoSync()); avisar('pull', null);
  }
  window.addEventListener('online', () => { trySync(); pull(); });
  window.addEventListener('offline', () => {
    if (perfil(getUser()) === 'gestor') { estadoLocal().gestorConfirmado = false; avisar('escopoGestor', {confirmado:false,motivo:'offline'}); }
    avisar('sync', resumoSync());
  });
  window.addEventListener('beforeunload', e => {
    if (!estadoLocal().naoGravados.size) return;
    e.preventDefault(); e.returnValue = '';
  });
  return { api, col, um, salvar, apagar, getUser, setUser, getFila, trySync, pull, agendarSync, salvarCFG, recuperarServidor, resumoSync, tentarNovamente, getNaoGravados, exportarRecuperacao,
    getCFG: () => { try { return state().cfg; } catch { return {}; } },
    getConhecimento: () => { try { return state().conhecimento || {}; } catch { return {}; } },
    getRascunhos: () => (state().rascunhos || []).filter(it => visivelGestor(it.colecao,it.registro || {id:it.id})),
    lastSync: () => { try { return state().syncEm; } catch { return null; } },
    on: (ev, fn) => (ouvintes[ev] = ouvintes[ev] || []).push(fn) };
})();
