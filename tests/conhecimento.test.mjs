import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Dados inteiramente fictícios: o repositório público não guarda a base interna.
const exemplo = {
  titulo: 'Biblioteca de exemplo',
  fontes: [{ id: 'fonte-a', titulo: 'Documento fictício A' }, { id: 'fonte-b', titulo: 'Documento fictício B' }],
  status: { referencia: 'Referência de exemplo', proposta: 'Proposta de exemplo' },
  identidade: { missao: 'Missão fictícia', valores: [{ titulo: 'Valor de exemplo', texto: 'Texto fictício.' }] },
  cargos: [
    { id: 'funcao-a', nome: 'Função A', tipoVinculo: 'sugestao_documental', pops: ['POP-TESTE-01'], jornadas: ['jornada-a'] },
    { id: 'funcao-b', nome: 'Função B', tipoVinculo: 'sugestao_documental', pops: ['POP-TESTE-02'], jornadas: [] }
  ],
  linhas: [{ id: 'linha-a', nome: 'Linha fictícia', etapas: ['Etapa A'], fontes: ['fonte-a'] }],
  jornadas: [{ id: 'jornada-a', titulo: 'Jornada fictícia', setor: 'Área A', codigos: ['POP-TESTE-01', 'POP-TESTE-02'] }],
  topicos: [
    { id: 'medicao', titulo: 'Medição de exemplo', resumo: 'Roteiro fictício para estudo.', status: 'referencia', fontes: ['fonte-a'], codigos: ['POP-TESTE-01'], passos: ['Conferir a dimensão de exemplo.'], pendencias: [], tags: ['medição', 'dimensão'] },
    { id: 'evolucao', titulo: 'Evolução de exemplo', resumo: 'Proposta fictícia.', status: 'proposta', fontes: ['fonte-b'], codigos: ['POP-TESTE-02'], passos: ['Experimentar a etapa B.'], pendencias: ['Validar o exemplo.'], tags: ['evolução', 'piloto'] },
    { id: 'revisao', titulo: 'Revisão de exemplo', resumo: 'Revisão transversal fictícia.', status: 'proposta', fontes: ['fonte-a', 'fonte-b'], codigos: ['POP-TESTE-01', 'POP-TESTE-02'], passos: [], pendencias: ['Conferir os dois exemplos.'], tags: ['revisão'] }
  ]
};

function fabrica() {
  const contexto = vm.createContext({ window: {} });
  const fonte = fs.readFileSync(new URL('../conhecimento.js', import.meta.url), 'utf8');
  vm.runInContext(fonte, contexto);
  return contexto.window.POPS_CONHECIMENTO;
}
function conhecimento() { return fabrica().criar(exemplo); }

test('arquivo público contém apenas helpers e exige dados recebidos após autenticação', () => {
  const fonte = fs.readFileSync(new URL('../conhecimento.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /Comissões OFICIAL|A decisão registrada da direção|outputs\/caderno-funcoes/);
  assert.equal(fs.existsSync(new URL('../supabase/functions/pops-sync/conhecimento.ts', import.meta.url)), false, 'o repositório público não pode guardar a base interna');
  const api = fabrica();
  assert.equal(typeof api.criar, 'function');
  const vazio = api.criar();
  assert.equal(vazio.topicos.length, 0);
  assert.equal(vazio.cargos.length, 0);
  assert.equal(vazio.buscar('').length, 0);
});

test('consulta encontra conteúdo pelo assunto, com acentos ou sem acentos', () => {
  const base = conhecimento();
  assert.ok(base.buscar('MEDICAO').some(t => t.id === 'medicao'));
  assert.ok(base.buscar('evolucao piloto').some(t => t.id === 'evolucao'));
  assert.equal(base.buscar('tema totalmente inexistente').length, 0);
});

test('código de POP só liga conteúdo por correspondência exata', () => {
  const base = conhecimento();
  assert.ok(base.porCodigo('pop-teste-01').some(t => t.id === 'medicao'));
  assert.equal(base.porCodigo('TESTE-001').length, 0, 'não transformar código antigo em outro procedimento');
  assert.equal(base.porCodigo('').length, 0);
});

test('sugestões por cargo usam o ID documental exato e nunca criam atribuições', () => {
  const base = conhecimento();
  assert.equal(base.cargos.length, 2);
  const sugestao = base.sugestoesPorCargo('funcao-a');
  assert.equal(sugestao.tipoVinculo, 'sugestao_documental');
  assert.ok(sugestao.pops.includes('POP-TESTE-01'));
  assert.equal(base.sugestoesPorCargo('funcao-antiga'), null);
  assert.equal(base.sugestoesPorCargo('Função A'), null, 'nome não equivale a ID');
  assert.equal(base.atribuir, undefined);
});

test('fontes são resolvidas por ID e os rótulos distinguem referência e proposta', () => {
  const base = conhecimento();
  assert.equal(base.fonteDe('fonte-a').titulo, 'Documento fictício A');
  assert.equal(base.fonteDe('inexistente'), null);
  assert.equal(base.topicos.find(t => t.id === 'medicao').status, 'referencia');
  assert.equal(base.topicos.find(t => t.id === 'evolucao').status, 'proposta');
  for (const topico of base.topicos) {
    assert.ok(base.status[topico.status]);
    for (const id of topico.fontes) assert.ok(base.fonteDe(id));
  }
});

test('relações exibem conteúdo conectado sem declarar leitura ou habilitação', () => {
  const base = conhecimento();
  const dados = base.relacionados({ codigo: 'POP-TESTE-01', setor: 'Area A' });
  assert.ok(dados.topicos.some(t => t.id === 'medicao'));
  assert.ok(dados.jornadas.some(j => j.id === 'jornada-a'));
  assert.ok(dados.pops.includes('POP-TESTE-02'));
  assert.ok(!dados.pops.includes('POP-TESTE-01'));
  assert.equal(dados.concluido, undefined);
  assert.equal(dados.habilitado, undefined);
  assert.equal(base.relacionados({ codigo: 'INEXISTENTE', setor: 'Setor inexistente' }).pops.length, 0);
});

test('base é imutável sem congelar nem alterar a entrada do cache', () => {
  const base = conhecimento();
  assert.equal(base.linhas.length, 1);
  assert.equal(base.identidade.missao, 'Missão fictícia');
  assert.ok(Object.isFrozen(base));
  assert.ok(Object.isFrozen(base.topicos[0].passos));
  assert.equal(Object.isFrozen(exemplo), false);
  assert.equal(Object.isFrozen(exemplo.topicos[0].passos), false);
  assert.throws(() => base.topicos[0].passos.push('regra não aprovada'), { name: 'TypeError' });
  assert.equal(exemplo.topicos[0].passos.length, 1);
});
