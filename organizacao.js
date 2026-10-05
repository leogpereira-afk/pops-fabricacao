// Organização de conteúdo. Não cria atribuições, revisões nem aceites.
window.POPS_ORGANIZACAO = (() => {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const tipos = { pop: 'pops', jornada: 'jornadas', treinamento: 'treinamentos' };
  function revisao(p) {
    const r = p.revisao;
    const validada = r?.status === 'validado' && !!r.por && !!r.em;
    return { validada, rotulo: validada ? 'Revisão validada' : 'Revisão necessária', por: validada ? r.por : '', em: validada ? r.em : '' };
  }
  function catalogo(dados) { return Object.entries(tipos).flatMap(([tipo, col]) => (dados[col] || []).map(p => ({ ...p, tipo }))); }
  function buscar(dados, termo) {
    const termos = norm(termo).split(/\s+/).filter(Boolean);
    return catalogo(dados).filter(p => {
      const texto = norm([p.codigo,p.titulo,p.setor,p.objetivo,p.resumo,p.descricao,p.responsavel,...(p.blocos || []).flatMap(b => [b.texto,...(b.itens || [])]),...(p.etapas || []).flatMap(e => [e.titulo,...(e.blocos || []).flatMap(b => [b.texto,...(b.itens || [])])])].join(' '));
      return termos.every(t => texto.includes(t));
    });
  }
  function relacionados(p, dados) {
    const seen = new Set();
    return (p.relacionados || []).flatMap(r => {
      const col = tipos[r.tipo], key = r.tipo + ':' + r.refId;
      if (!col || (r.tipo === 'pop' && r.refId === p.id) || seen.has(key)) return [];
      seen.add(key); const it = (dados[col] || []).find(x => x.id === r.refId);
      return it ? [{...it, tipo:r.tipo}] : [];
    });
  }
  function mudouInstrucao(a, b) {
    return ['titulo','objetivo','responsavel','setor','blocos','epis'].some(k => JSON.stringify(a?.[k] ?? (['blocos','epis'].includes(k) ? [] : '')) !== JSON.stringify(b?.[k] ?? (['blocos','epis'].includes(k) ? [] : '')));
  }
  function validarEdicao(a, b) {
    if (a && mudouInstrucao(a,b) && (a.versao || '1.0') === (b.versao || '1.0')) return 'Atualize a versão ao mudar uma instrução. Assim a equipe confirma a nova leitura.';
    return '';
  }
  return { revisao, buscar, catalogo, relacionados, mudouInstrucao, validarEdicao };
})();
