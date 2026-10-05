/* Helpers públicos sem conteúdo empresarial. A base vem do servidor autenticado
 * e é mantida no cache individual pelo STORE. Nenhum vínculo é gravado aqui.
 */
(() => {
  'use strict';
  function criar(entrada) {
    // A cópia impede que o congelamento da consulta altere objetos do cache.
    const origem = entrada && typeof entrada === 'object' ? JSON.parse(JSON.stringify(entrada)) : {};
    const dados = {
      ...origem,
      fontes: Array.isArray(origem.fontes) ? origem.fontes : [],
      cargos: Array.isArray(origem.cargos) ? origem.cargos : [],
      linhas: Array.isArray(origem.linhas) ? origem.linhas : [],
      jornadas: Array.isArray(origem.jornadas) ? origem.jornadas : [],
      topicos: Array.isArray(origem.topicos) ? origem.topicos : [],
      status: origem.status || {},
      identidade: origem.identidade || { valores: [] }
    };
    const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
    const codigo = valor => String(valor || '').trim().toUpperCase();
    const fonteDe = id => dados.fontes.find(f => f.id === id) || null;
    function buscar(termo) {
      const partes = normalizar(termo).split(/\s+/).filter(Boolean);
      return dados.topicos.filter(t => {
        const texto = normalizar([t.titulo, t.resumo, ...t.passos, ...t.pendencias, ...t.tags, ...t.codigos].join(' '));
        return partes.every(p => texto.includes(p));
      });
    }
    function porCodigo(valor) {
      const alvo = codigo(valor);
      if (!alvo) return [];
      return dados.topicos.filter(t => t.codigos.includes(alvo));
    }
    function sugestoesPorCargo(id) {
      // Correspondência exata: nenhum nome semelhante vira vínculo RH por inferência.
      return dados.cargos.find(c => c.id === id) || null;
    }
    function relacionados(registro = {}) {
      const atual = codigo(registro.codigo);
      const topicos = porCodigo(atual);
      const jornadas = dados.jornadas.filter(j => j.codigos.includes(atual) ||
        (registro.setor && normalizar(j.setor) === normalizar(registro.setor)));
      // O tópico transversal de revisão não transforma todos os POPs em relacionados.
      const especificos = topicos.filter(t => t.id !== 'revisao' && t.id !== 'identidade' && t.id !== 'evolucao-mubisys');
      const pops = [...new Set(especificos.flatMap(t => t.codigos).concat(jornadas.flatMap(j => j.codigos)))].filter(c => c !== atual);
      return { topicos, jornadas, pops };
    }
    function congelar(objeto) {
      if (!objeto || typeof objeto !== 'object' || Object.isFrozen(objeto)) return objeto;
      Object.values(objeto).forEach(congelar);
      return Object.freeze(objeto);
    }
    return congelar({ ...dados, fonteDe, buscar, porCodigo, sugestoesPorCargo, relacionados });
  }
  window.POPS_CONHECIMENTO = Object.freeze({ criar });
})();
