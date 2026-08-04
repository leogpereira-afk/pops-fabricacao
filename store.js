// ============================================================================
// store.js — persistência e sincronização do Pops & Fabricação.
// Offline-first: tudo grava LOCAL primeiro (o POP precisa abrir na bancada sem
// sinal); a fila sobe em segundo plano. Lições herdadas do Brief (v40-v42):
//  - a fila nunca trava atrás de um item que falha (backoff por item);
//  - falha de rede NUNCA descarta trabalho;
//  - o envio é agrupado (2,5s) pra não pesar no celular;
//  - o pull é econômico: pergunta o "rev" e só baixa coleção que mudou.
// Conteúdo (pops/jornadas) é editado por pouca gente: última escrita vence.
// Registros pessoais (leituras/progresso) têm id por usuário — não colidem.
// ============================================================================

const STORE = (() => {
  const K = {
    DADOS: 'pops_dados',      // { colecao: [registros] }
    CFG: 'pops_cfg',
    FILA: 'pops_fila',
    REV: 'pops_rev',          // último rev visto por coleção
    USER: 'pops_user',
    SYNCEM: 'pops_lastsync',
  };
  const COLS = ['pops', 'jornadas', 'leituras', 'progresso'];

  function lsGet(k, fb) {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : fb; }
    catch { return fb; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { console.error('[store] falha ao gravar', k, e); _avisar('quota', null); return false; }
  }

  // ── API (ponto único de saída) ──────────────────────────────────────────
  async function api(action, body, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
    try {
      const r = await fetch(window.API_BASE + '/' + window.API_FN.sync, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': window.APP_TOKEN },
        body: JSON.stringify(Object.assign({ action }, body || {})),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  // ── dados locais ─────────────────────────────────────────────────────────
  function dados() { return lsGet(K.DADOS, {}); }
  function col(nome) { return (dados()[nome] || []).filter(r => !r._apagado); }
  function um(nome, id) { return col(nome).find(r => r.id === id) || null; }
  function _gravarCol(nome, lista) {
    const d = dados(); d[nome] = lista; return lsSet(K.DADOS, d);
  }

  function getCFG() { return lsGet(K.CFG, {}); }

  function getUser() { return lsGet(K.USER, null); }
  function setUser(u) { if (u) lsSet(K.USER, u); else localStorage.removeItem(K.USER); }

  // ── escrita: local primeiro, fila depois ────────────────────────────────
  function salvar(colecao, registro) {
    if (!registro || !registro.id) return false;
    registro.atualizadoEm = new Date().toISOString();
    const lista = dados()[colecao] || [];
    const i = lista.findIndex(r => r.id === registro.id);
    if (i >= 0) lista[i] = registro; else lista.push(registro);
    if (!_gravarCol(colecao, lista)) return false;
    if (!_enfileirar({ action: 'upsert', colecao, registro })) return false;
    agendarSync();
    return true;
  }

  function apagar(colecao, id) {
    const lista = (dados()[colecao] || []).filter(r => r.id !== id);
    _gravarCol(colecao, lista);
    _enfileirar({ action: 'delete', colecao, id });
    agendarSync();
  }

  function getFila() { return lsGet(K.FILA, []); }
  function _sig(it) {
    return it.action + ':' + it.colecao + ':' + (it.id || (it.registro && it.registro.id) || '');
  }
  function _enfileirar(item) {
    const q = getFila();
    const i = q.findIndex(x => _sig(x) === _sig(item));
    if (i >= 0) q[i] = item; else q.push(item);
    return lsSet(K.FILA, q);
  }
  function _tirarDaFila(item) {
    lsSet(K.FILA, getFila().filter(x => _sig(x) !== _sig(item)));
  }

  // ── sync ────────────────────────────────────────────────────────────────
  let _syncing = false, _timer = null, _ultimo = 0, _reagendou = false;
  const _skipAte = new Map();   // backoff por item: um que falha não trava os outros
  const _fail = new Map();

  function agendarSync() {
    const desde = Date.now() - _ultimo;
    if (desde >= 2500) { _ultimo = Date.now(); trySync(); return; }
    if (!_timer) _timer = setTimeout(() => { _timer = null; _ultimo = Date.now(); trySync(); }, 2500 - desde);
  }

  async function trySync() {
    if (_syncing) return;
    const q = getFila();
    if (!q.length) { _avisar('sync', { status: 'ok', pendentes: 0 }); return; }
    if (!navigator.onLine) { _avisar('sync', { status: 'offline', pendentes: q.length }); return; }
    _syncing = true;
    _avisar('sync', { status: 'pendente', pendentes: q.length });
    let falhasSeguidas = 0;
    for (const item of [...q]) {
      const sig = _sig(item);
      if ((_skipAte.get(sig) || 0) > Date.now()) continue;
      try {
        await api(item.action, item.action === 'upsert'
          ? { colecao: item.colecao, registro: item.registro }
          : { colecao: item.colecao, id: item.id });
        _tirarDaFila(item);
        _fail.delete(sig); _skipAte.delete(sig);
        falhasSeguidas = 0;
      } catch (e) {
        const n = (_fail.get(sig) || 0) + 1;
        _fail.set(sig, n);
        _skipAte.set(sig, Date.now() + Math.min(120000, 8000 * Math.pow(2, Math.min(n - 1, 4))));
        falhasSeguidas++;
        if (falhasSeguidas >= 2) break;   // dois itens diferentes falhando = rede fora
      }
    }
    _syncing = false;
    const resto = getFila();
    _avisar('sync', { status: resto.length ? (navigator.onLine ? 'pendente' : 'offline') : 'ok', pendentes: resto.length });
    if (resto.length && navigator.onLine && !_reagendou) {
      _reagendou = true;
      setTimeout(() => { _reagendou = false; trySync(); }, 5000);
    }
  }

  // Pull econômico: pergunta o rev; só baixa coleção que mudou.
  let _pulling = false;
  async function pull() {
    if (_pulling || !navigator.onLine) return;
    _pulling = true;
    try {
      const r = await api('rev');
      const meu = lsGet(K.REV, { porColecao: {} });
      const deles = (r.rev && r.rev.porColecao) || {};
      const pendentes = new Set(getFila().map(x => _sig(x)));
      for (const c of COLS.concat(['cfg'])) {
        if ((deles[c] || 0) === (meu.porColecao[c] || 0)) continue;
        if (c === 'cfg') {
          const rc = await api('getCfg');
          if (rc.config && !lsSet(K.CFG, rc.config)) continue;
        } else {
          // baixa a coleção inteira em páginas (bases pequenas; POP é texto)
          let desde = '', tudo = [];
          for (let p = 0; p < 40; p++) {
            const rl = await api('list', { colecao: c, desde: desde || undefined, limite: 500 });
            tudo = tudo.concat(rl.itens || []);
            if (!rl.proximo) break;
            desde = rl.proximo;
          }
          const lista = dados()[c] || [];
          const porId = new Map(lista.map(x => [x.id, x]));
          for (const it of tudo) {
            const reg = it.registro;
            if (!reg || !reg.id) continue;
            // edição local pendente não é atropelada pelo pull
            if (pendentes.has('upsert:' + c + ':' + reg.id)) continue;
            if (it.apagado) { porId.delete(reg.id); continue; }
            const atual = porId.get(reg.id);
            if (!atual || String(reg.atualizadoEm || '') >= String(atual.atualizadoEm || '')) porId.set(reg.id, reg);
          }
          // Se a gravação falhar (memória cheia), NÃO avança o rev: senão o
          // app anota "já tenho a versão N" sem ter os dados, e o POP nunca
          // mais desce -- some da bancada e ninguém entende por quê.
          if (!_gravarCol(c, [...porId.values()])) continue;
        }
        meu.porColecao[c] = deles[c] || 0;
      }
      lsSet(K.REV, meu);
      lsSet(K.SYNCEM, new Date().toISOString());
      _avisar('pull', null);
    } catch { /* sem rede/servidor: o local continua valendo */ }
    finally { _pulling = false; }
  }

  // ── eventos ──────────────────────────────────────────────────────────────
  const _ouvintes = {};
  function on(ev, fn) { (_ouvintes[ev] = _ouvintes[ev] || []).push(fn); }
  function _avisar(ev, dado) { (_ouvintes[ev] || []).forEach(f => { try { f(dado); } catch {} }); }

  window.addEventListener('online', () => { trySync(); pull(); });

  return { api, col, um, salvar, apagar, getCFG, getUser, setUser, getFila, trySync, pull, agendarSync, on,
    lastSync: () => lsGet(K.SYNCEM, null) };
})();
