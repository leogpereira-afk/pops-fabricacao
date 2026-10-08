/* Cadastro de conteúdos próprios. A base documental permanece independente. */
(function (root) {
  'use strict';
  function urlSegura(valor) {
    if (typeof valor !== 'string' || valor.length > 2000 || !/^https:\/\//i.test(valor) || /[\u0000-\u0020\u007f\\]/.test(valor)) return false;
    try { const u = new URL(valor); return u.protocol === 'https:' && !u.username && !u.password && !!u.hostname; }
    catch { return false; }
  }
  const texto = (s, max, obrigatorio = false) => typeof s === 'string' && s.length <= max && (!obrigatorio || !!s.trim());
  function validar(anterior, novo) {
    if (!texto(novo.titulo, 200, true)) return 'Informe um título com até 200 caracteres.';
    if (!texto(novo.versao, 40, true)) return 'Informe a versão do treinamento (até 40 caracteres).';
    for (const [campo, limite] of [['tipo',80],['setor',200],['responsavel',200],['resumo',2000]]) {
      if (novo[campo] != null && !texto(novo[campo], limite)) return 'Revise o campo ' + campo + ': limite de ' + limite + ' caracteres.';
    }
    if (!Number.isInteger(novo.validadeMeses ?? 0) || (novo.validadeMeses ?? 0) < 0 || novo.validadeMeses > 120) return 'A reciclagem deve ser de 0 a 120 meses inteiros.';
    if (novo.exigeAceite != null && typeof novo.exigeAceite !== 'boolean') return 'Confira a confirmação de aceite.';
    if (!Array.isArray(novo.blocos) || !novo.blocos.length || novo.blocos.length > 300) return 'Escreva o conteúdo do treinamento (até 300 blocos).';
    for (const b of novo.blocos) {
      if (!b || !['paragrafo','texto','subtitulo','destaque','alerta','passos','lista','checklist'].includes(b.tipo)) return 'Confira os blocos do conteúdo.';
      if (['passos','lista','checklist'].includes(b.tipo)) {
        if (!Array.isArray(b.itens) || !b.itens.length || b.itens.length > 200 || b.itens.some(x => !texto(x,2000,true))) return 'Confira os itens de lista: cada item precisa de texto (até 2.000 caracteres).';
      } else if (!texto(b.texto,20000,true)) return 'Cada bloco precisa de texto (até 20.000 caracteres).';
    }
    const materiais = novo.materiais ?? [];
    if (!Array.isArray(materiais) || materiais.length > 20) return 'Adicione até 20 materiais de apoio.';
    for (const m of materiais) {
      if (!m || !texto(m.titulo,200,true) || !texto(m.url,2000,true) || !urlSegura(m.url)) return 'Cada material precisa de título e link HTTPS válido, sem usuário ou senha no endereço.';
    }
    const defaults = {tipo:'',setor:'',resumo:'',exigeAceite:false,validadeMeses:0,materiais:[]};
    const mudou = anterior && ['titulo','tipo','setor','resumo','blocos','exigeAceite','validadeMeses','materiais'].some(k => JSON.stringify(anterior[k] ?? defaults[k]) !== JSON.stringify(novo[k] ?? defaults[k]));
    if (mudou && novo.versao.trim() === (anterior.versao || '1.0').trim()) return 'O conteúdo mudou. Informe uma nova versão para solicitar a releitura e preservar o histórico.';
    return '';
  }
  root.POPS_TREINAMENTOS = Object.freeze({validar, urlSegura});
})(typeof window === 'undefined' ? globalThis : window);
