// Offline-first: dados e fila são gravados juntos, por conta. A confirmação
// de um envio só remove aquela versão; edição feita durante a rede é preservada.
const STORE = (() => {
  const USER = 'pops_user';
  const COLS = ['pops', 'jornadas', 'treinamentos', 'pessoas', 'atribuicoes', 'leituras', 'progresso'];
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const novoEnvio = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
  const key = u => 'pops_v2_' + encodeURIComponent(norm(u && u.usuario));
  const vazio = () => ({ dados: {}, cfg: {}, fila: [], rev: { porColecao: {} }, syncEm: null });
  const ouvintes = {};
  const avisar = (ev, dado) => (ouvintes[ev] || []).forEach(f => { try { f(dado); } catch {} });
  function ler(k, fallback) { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
  function getUser() { try { return ler(USER, null); } catch { return null; } }
  let epoch = 0, syncing = null, pulling = null, timer = null, reagendo = null;
  function state() { return getUser() ? ler(key(getUser()), vazio()) : vazio(); }
  function gravar(s) {
    if (!getUser()) return false;
    try { localStorage.setItem(key(getUser()), JSON.stringify(s)); return true; }
    catch { avisar('quota', null); return false; }
  }
  function setUser(u) {
    try {
      if (u) localStorage.setItem(USER, JSON.stringify(u)); else localStorage.removeItem(USER);
      epoch++; clearTimeout(timer); clearTimeout(reagendo); timer = reagendo = null; return true;
    } catch { avisar('quota', null); return false; }
  }
  // Migra apenas a conta que já estava identificada ao carregar esta versão.
  // Se não há dono conhecido, os arquivos antigos ficam guardados, sem entrega
  // automática a quem fizer o próximo login neste aparelho.
  try {
    const antigo = getUser();
    if (antigo && localStorage.getItem(key(antigo)) === null) {
      const fila = ler('pops_fila', []).map(it => ({ ...it, mutationId: novoEnvio(), tentado: true }));
      const s = { dados: ler('pops_dados', {}), cfg: ler('pops_cfg', {}), fila, rev: { porColecao: {} }, syncEm: null };
      if (gravar(s)) ['pops_dados','pops_cfg','pops_fila','pops_rev','pops_lastsync'].forEach(k => localStorage.removeItem(k));
    }
  } catch { avisar('quota', null); }

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
  function col(nome) { try { return (state().dados[nome] || []).filter(r => !r._apagado); } catch { avisar('quota', null); return []; } }
  const um = (nome, id) => col(nome).find(r => r.id === id) || null;
  function getFila() { try { return state().fila || []; } catch { return []; } }
  function alterar(action, colecao, reg, id) {
    try {
      if (!COLS.includes(colecao) || !id || !getUser()) return false;
      const s = state(), lista = s.dados[colecao] || [], anterior = lista.find(r => r.id === id);
      const i = s.fila.findIndex(x => sig(x) === colecao + ':' + id), pendente = s.fila[i];
      const expectedRevision = pendente?.expectedRevision ?? anterior?._serverRevision ?? (anterior ? null : 0);
      if (action === 'delete' && pendente?.action === 'upsert' && expectedRevision === 0 && !pendente.tentado && syncing !== epoch) {
        s.fila.splice(i,1); s.dados[colecao] = lista.filter(r => r.id !== id);
        return gravar(s);
      }
      const item = { action, colecao, id, expectedRevision, mutationId: novoEnvio(), tentado: !!pendente?.tentado };
      if (action === 'upsert') {
        item.registro = { ...reg, atualizadoEm: new Date().toISOString() };
        s.dados[colecao] = lista.filter(r => r.id !== id).concat([item.registro]);
      } else s.dados[colecao] = lista.filter(r => r.id !== id);
      if (i >= 0) s.fila[i] = item; else s.fila.push(item);
      if (!gravar(s)) return false;
      avisar('sync', { status: navigator.onLine ? 'pendente' : 'offline', pendentes: s.fila.length });
      agendarSync(); return true;
    } catch { avisar('quota', null); return false; }
  }
  const salvar = (colecao, registro) => alterar('upsert', colecao, registro, registro?.id);
  const apagar = (colecao, id) => alterar('delete', colecao, null, id);
  function agendarSync() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; trySync(); }, 2500);
  }
  function resumoSync() {
    const q = getFila();
    return { status: !navigator.onLine ? 'offline' : q.some(x => x.bloqueado) ? 'revisar' : q.length ? 'pendente' : 'ok', pendentes: q.length, erro: q.find(x => x.erro)?.erro };
  }
  async function trySync() {
    const inicio = epoch;
    if (syncing === inicio || !getUser()) return;
    if (!navigator.onLine) { avisar('sync', resumoSync()); return; }
    syncing = inicio;
    try {
      for (const item of getFila()) {
        if (inicio !== epoch) return;
        if (item.bloqueado || (item.tentarEm || 0) > Date.now()) continue;
        try {
          const antes = state(), enviando = antes.fila.find(x => x.mutationId === item.mutationId);
          if (!enviando) continue;
          enviando.tentado = true;
          if (!gravar(antes)) break;
          const { registro: reg, id, action, colecao, expectedRevision, mutationId } = item;
          const r = await api(action, { colecao, ...(action === 'upsert' ? { registro: reg } : { id }), expectedRevision, mutationId });
          if (inicio !== epoch) return;
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
        if (getFila().some(x => !x.bloqueado) && navigator.onLine && !reagendo) reagendo = setTimeout(() => { reagendo = null; trySync(); }, 10000);
      }
    }
  }
  async function pull() {
    const inicio = epoch;
    if (pulling === inicio || !getUser() || !navigator.onLine) return false;
    pulling = inicio;
    try {
      const r = await api('rev'); if (inicio !== epoch) return false;
      const deles = r.rev?.porColecao || {};
      for (const c of COLS.concat(['cfg'])) {
        if (inicio !== epoch) return false;
        const local = state();
        if (Object.hasOwn(local.rev.porColecao, c) && local.rev.porColecao[c] === (deles[c] || 0)) continue;
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
      avisar('pull', null); return true;
    } catch (e) { if (inicio === epoch) avisar('pullErro', e.message); return false; }
    finally { if (pulling === inicio) pulling = null; }
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
  return { api, col, um, salvar, apagar, getUser, setUser, getFila, trySync, pull, agendarSync, salvarCFG, recuperarServidor,
    getCFG: () => { try { return state().cfg; } catch { return {}; } },
    getRascunhos: () => state().rascunhos || [],
    lastSync: () => { try { return state().syncEm; } catch { return null; } },
    on: (ev, fn) => (ouvintes[ev] = ouvintes[ev] || []).push(fn) };
})();
