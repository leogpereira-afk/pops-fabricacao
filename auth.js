// auth.js — o login da equipe, conferido no SERVIDOR.
//
// POR QUE ISTO EXISTE
// Até aqui, a conta de cada pessoa morava dentro do pacote de configuração que
// todo aparelho baixa (cfg.usuarios), com a SENHA EM TEXTO PURO, e a conferência
// acontecia aqui no navegador. Como o TOKEN que autoriza esse download vai no
// bundle público do site, qualquer pessoa que abrisse o endereço lia o usuário e
// a senha da equipe inteira. Agora a senha é PBKDF2 no banco, a conferência é do
// outro lado, e o que fica no aparelho é um CRACHÁ assinado.
//
// O CRACHÁ VALE 30 DIAS de propósito: o vendedor entra uma vez com internet e
// segue trabalhando na rua sem sinal. Ele não é conferido aqui (o aparelho não
// tem o segredo) — quem confere é o servidor. Aqui ele só destranca a tela,
// exatamente o mesmo grau de confiança de antes, com a diferença de que a senha
// não anda mais junto.

const AUTH = (() => {
  const URL_AUTH = window.API_BASE + '/equipe-auth';
  const SISTEMA = 'pops';
  const K_TOKEN = 'pops_cracha';
  // O crachá do aluno mora numa chave só dele. 'pops_cracha' é também a chave que
  // a Entrada Única do Painel grava e apaga nesta mesma origem (github.io) com o
  // crachá da Central de quem entrou lá: dividida, ela trocava o crachá da aluna
  // pelo do gestor no meio da aula, e o Sair da aluna apagava o do gestor.
  const K_ALUNO = 'pops_cracha_aluno';

  const pegar = () => localStorage.getItem(K_TOKEN) || '';
  const guardar = t => { if (t) { localStorage.setItem(K_TOKEN, t); localStorage.removeItem(K_ALUNO); } };
  const esquecer = () => { localStorage.removeItem(K_TOKEN); localStorage.removeItem(K_ALUNO); };
  const pegarAluno = () => localStorage.getItem(K_ALUNO) || '';
  const esquecerAluno = () => localStorage.removeItem(K_ALUNO);
  // Corpo do crachá, só para saber de quem é. Não confere a assinatura (o aparelho
  // não tem o segredo); quem confere é o servidor.
  function corpo(t) {
    try {
      const p = String(t || '').split('.')[1];
      if (!p) return null;
      const b64 = p.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(p.length / 4) * 4, '=');
      const bin = atob(b64), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const dados = JSON.parse(new TextDecoder().decode(bytes));
      return dados && typeof dados === 'object' ? dados : null;
    } catch { return null; }
  }
  // O crachá do aluno só serve à sessão daquele aluno: sis e papel de aluno, e
  // sub e ficha do RH iguais aos da sessão. Qualquer outro (de outro aluno, ou um
  // da Central que alguém tenha posto ali) não sai daqui: devolve vazio.
  function crachaAlunoDe(sessao) {
    const t = pegarAluno(), p = corpo(t);
    if (!sessao || !p || p.sis !== 'pops-aluno' || p.papel !== 'aluno' || typeof p.sub !== 'string' || p.sub !== sessao.usuario) return '';
    if (sessao.colaboradorId && p.colaboradorId !== sessao.colaboradorId) return '';
    return t;
  }

  async function chamar(acao, corpo, comCracha) {
    const cab = { 'Content-Type': 'application/json' };
    if (comCracha) cab['Authorization'] = 'Bearer ' + pegar();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(URL_AUTH, {
        method: 'POST', headers: cab, signal: ctrl.signal,
        body: JSON.stringify(Object.assign({ acao, sistema: SISTEMA }, corpo || {})),
      });
      let dados;
      try { dados = await r.json(); } catch { throw new Error('Resposta incompleta do servidor.'); }
      if (!dados || typeof dados !== 'object') throw new Error('Resposta inválida do servidor.');
      if (!r.ok || dados.ok === false || dados.erro || dados.error) throw Object.assign(new Error(dados.erro || dados.error || ('HTTP ' + r.status)), { status: r.status, erro: dados.erro });
      return dados;
    } finally { clearTimeout(timer); }

  }

  return {
    temCracha: () => !!pegar(),
    // O store precisa do crachá para assinar cada chamada ao servidor.
    cracha: pegar,
    // Crachá de quem está na sessão: o do aluno (conferido contra a sessão) ou o da Central.
    crachaDe: sessao => sessao && sessao.papel === 'aluno' ? crachaAlunoDe(sessao) : pegar(),
    crachaAluno: pegarAluno,
    esquecer,
    // Sair do aluno: só o crachá dele. O da Central é da Entrada Única do Painel.
    esquecerAluno,

    async loginRH(usuario, senha) {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 15000);
      try {
        const response = await fetch(window.API_BASE + '/acesso-entrar', {
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario,senha}),signal:ctrl.signal,
        });
        const r = await response.json();
        if (!response.ok || !r?.ok) throw Object.assign(new Error(r?.erro || 'Não foi possível entrar. Confira seu usuário e senha.'), {status:response.status});
        if (r.trocarSenha) return {trocarSenha:true,origemLogin:'rh'};
        const c = r.crachas?.pops;
        if (!r.usuario || !c?.token || !['admin','gestor','equipe'].includes(c.papel)) throw new Error('Sua conta ainda não tem acesso aos POPs. Peça à gestão a liberação na Central de Acessos.');
        guardar(c.token);
        // Sessão RH e crachás de outros sistemas nunca são persistidos aqui.
        return {usuario:r.usuario,nome:r.nome,papel:c.papel,trocarSenha:false,origemLogin:'rh'};
      } finally { clearTimeout(timer); }
    },

    // Entrada do aluno (pedido do Léo, 14/10/2026): ID do RH (6 números) e primeiro
    // nome, sem senha. Quem confere é o servidor (pops-sync, ação pública
    // entrarAluno), com limite de tentativas no banco; o crachá do aluno é outro
    // (sis "pops-aluno", chave própria) e só alcança o próprio aprendizado. Fica
    // em 'pops_cracha_aluno', que o Painel não grava nem apaga; Sair apaga.
    async entrarAluno(id, nome) {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 15000);
      try {
        let response;
        try {
          response = await fetch(window.API_BASE + '/' + window.API_FN.sync, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
            body: JSON.stringify({ action: 'entrarAluno', id: String(id || ''), nome: String(nome || '') }),
          });
        } catch { throw Object.assign(new Error('Sem conexão com o servidor. A primeira entrada precisa de internet.'), { status: 0 }); }
        let r; try { r = await response.json(); } catch { r = null; }
        if (!response.ok || !r?.ok) {
          const msg = response.status === 429 ? 'Muitas tentativas. Tente de novo em 15 minutos.'
            : response.status === 401 ? 'ID ou nome não conferem.'
            : (r?.erro || 'Não consegui conferir sua entrada agora. Tente novamente.');
          throw Object.assign(new Error(msg), { status: response.status });
        }
        if (typeof r.token !== 'string' || r.token.split('.').length !== 3 || r.papel !== 'aluno' || !/^aluno:/.test(r.usuario || '') || !r.colaboradorId)
          throw new Error('Resposta de entrada incompleta. Tente novamente.');
        localStorage.setItem(K_ALUNO, r.token);
        return { usuario: r.usuario, nome: r.nome || 'Aluno', papel: 'aluno', colaboradorId: r.colaboradorId, validoAte: r.validoAte || null, origemLogin: 'aluno' };
      } finally { clearTimeout(timer); }
    },

    async login(usuario, senha) {
      const r = await chamar('login', { usuario, senha });
      if (!r.token || !r.usuario || !r.papel) throw new Error('Resposta de login incompleta. Tente novamente.');
      guardar(r.token);
      return r;
    },

    // Confere o crachá com o servidor. Sem internet devolve null — e quem chama
    // decide seguir com o que já está no aparelho (é o caso do campo).
    async eu() {
      try { return await chamar('eu', {}, true); } catch (e) { return e.status === 401 ? false : null; }
    },

    trocarMinhaSenha(senhaAtual, novaSenha) {
      return chamar('trocarMinhaSenha', { senhaAtual, novaSenha }, true);
    },

    listarContas() { return chamar('listarContas', {}, true); },
    salvarConta(c) { return chamar('salvarConta', c, true); },
    removerConta(usuario) { return chamar('removerConta', { usuario }, true); },
  };
})();
