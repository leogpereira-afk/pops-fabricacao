import test from 'node:test';
import assert from 'node:assert/strict';
import { backend } from './helpers.mjs';
import { dados } from './fixtures.mjs';

const treinamento = { ...dados.treinamentos[0], tipo: 'esporadico', setor: 'Impressão', resumo: 'Orientação fictícia.', responsavel: 'Instrutor', validadeMeses: 12, materiais: [{ titulo: 'Manual', url: 'https://exemplo.test/manual.pdf' }] };
const linha = registro => ({ colecao: 'treinamentos', id: registro.id, apagado: false, revision: 3, registro });
const salvar = (b, registro, papel = 'admin', extra = {}) => b.call({ action: 'upsert', colecao: 'treinamentos', registro, ...extra }, { papel, nome: 'Administrador real' });

test('administrador cria treinamento com materiais HTTPS e autoria/data do servidor', async () => {
  const b = backend(), inicio = Date.now();
  const r = await salvar(b, { ...treinamento, criadoPor: 'Forjado', criadoEm: '1900-01-01', revisadoPor: 'Forjado', revisadoEm: '1900-01-01' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const salvo = r.body.registro;
  assert.equal(salvo.criadoPor, 'Administrador real');
  assert.equal(salvo.revisadoPor, 'Administrador real');
  assert.equal(salvo.criadoEm, salvo.revisadoEm);
  assert.ok(Date.parse(salvo.criadoEm) >= inicio && Date.parse(salvo.criadoEm) <= Date.now());
  assert.deepEqual(salvo.materiais, treinamento.materiais);
  assert.equal(b.writes.length, 1);
  assert.equal(b.writes[0].rpc, 'pops_gravar');
});

test('gestor e equipe não podem criar, editar nem arquivar treinamentos', async () => {
  for (const papel of ['gestor', 'equipe']) {
    for (const rows of [[], [linha(treinamento)]]) {
      const b = backend({ rows, config: { gestores: { ana: ['Impressão'] } } });
      const r = await salvar(b, treinamento, papel);
      assert.equal(r.status, 403, papel);
      assert.equal(b.writes.length, 0);
    }
    const b = backend({ rows: [linha(treinamento)] });
    const r = await b.call({ action: 'delete', colecao: 'treinamentos', id: treinamento.id }, { papel });
    assert.equal(r.status, 403);
    assert.equal(b.writes.length, 0);
  }
});

test('título, versão e conteúdo são obrigatórios e respeitam tipos e limites', async () => {
  const casos = [
    { titulo: '' }, { titulo: '   ' }, { titulo: null }, { titulo: 12 }, { titulo: 'a'.repeat(201) },
    { versao: '' }, { versao: '  ' }, { versao: 1 }, { versao: 'a'.repeat(41) },
    { blocos: null }, { blocos: [] }, { blocos: {} }, { blocos: Array.from({ length: 301 }, () => ({ tipo: 'texto', texto: 'a' })) },
    { blocos: [null] }, { blocos: [{ tipo: 'video', texto: 'https://exemplo.test' }] },
    { blocos: [{ tipo: 'paragrafo', texto: '   ' }, { tipo: 'lista', itens: [' ', ''] }] },
    { blocos: [{ tipo: 'paragrafo', texto: 123 }] }, { blocos: [{ tipo: 'paragrafo', texto: 'a'.repeat(20001) }] },
    { blocos: [{ tipo: 'lista', itens: 'texto' }] }, { blocos: [{ tipo: 'lista', itens: [123] }] },
    { blocos: [{ tipo: 'lista', itens: ['a'.repeat(2001)] }] }, { blocos: [{ tipo: 'lista', itens: Array(201).fill('a') }] }
  ];
  for (const patch of casos) {
    const b = backend(), r = await salvar(b, { ...treinamento, ...patch });
    assert.equal(r.status, 400, JSON.stringify(patch).slice(0, 100));
    assert.equal(b.writes.length, 0);
  }
});

test('campos opcionais rejeitam tipos ambíguos e excesso de texto', async () => {
  for (const patch of [{ tipo: [] }, { tipo: 'a'.repeat(81) }, { setor: null }, { setor: 'a'.repeat(201) }, { resumo: 'a'.repeat(2001) }, { responsavel: 'a'.repeat(201) }, { exigeAceite: 'false' }, { exigeAceite: 1 }]) {
    const b = backend(), r = await salvar(b, { ...treinamento, ...patch });
    assert.equal(r.status, 400);
    assert.equal(b.writes.length, 0);
  }
});

test('validade aceita apenas inteiros de 0 a 120 ou ausência legada', async () => {
  for (const validadeMeses of [0, 120, undefined]) {
    const r = await salvar(backend(), { ...treinamento, validadeMeses });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  for (const validadeMeses of [-1, 121, 1.5, '12', null, true]) {
    const b = backend(), r = await salvar(b, { ...treinamento, validadeMeses });
    assert.equal(r.status, 400);
    assert.equal(b.writes.length, 0);
  }
});

test('materiais exigem título e URL HTTPS absoluta sem credenciais ou controles', async () => {
  const urls = ['http://exemplo.test/manual', 'javascript:alert(1)', 'data:text/html,teste', 'file:///tmp/manual.pdf', '//exemplo.test', '/manual.pdf', 'https://', 'https:exemplo.test', 'https://usuario:senha@exemplo.test/manual', 'https://exemplo.test/uma pasta', 'https://exemplo.test/\nmanual', 'https://exemplo.test\\manual', 'https://exemplo.test/' + 'a'.repeat(2000)];
  const casos = [null, {}, [null], [{ titulo: '', url: 'https://exemplo.test/' }], [{ titulo: 'a'.repeat(201), url: 'https://exemplo.test/' }], [{ titulo: 'Manual' }], Array(21).fill(treinamento.materiais[0]), ...urls.map(url => [{ titulo: 'Manual', url }])];
  for (const materiais of casos) {
    const b = backend(), r = await salvar(b, { ...treinamento, materiais });
    assert.equal(r.status, 400, JSON.stringify(materiais).slice(0, 100));
    assert.equal(b.writes.length, 0);
  }
  const validos = [{ titulo: 'Vídeo', url: 'https://exemplo.test/assistir?v=a%20b#inicio' }, { titulo: 'Guia', url: 'HTTPS://exemplo.test/guia.pdf' }];
  assert.equal((await salvar(backend(), { ...treinamento, materiais: validos })).status, 200);
});

test('cada campo de instrução modificado exige versão diferente antes de gravar', async () => {
  const alteracoes = { titulo: 'Outro título', tipo: 'norma', setor: 'Metalurgia', resumo: 'Novo resumo', blocos: [{ tipo: 'paragrafo', texto: 'Nova instrução.' }], exigeAceite: false, validadeMeses: 24, materiais: [{ titulo: 'Novo material', url: 'https://exemplo.test/outro.pdf' }] };
  for (const [campo, valor] of Object.entries(alteracoes)) {
    const b = backend({ rows: [linha(treinamento)] }), r = await salvar(b, { ...treinamento, [campo]: valor });
    assert.equal(r.status, 409, campo);
    assert.match(r.body.erro, /nova versão/);
    assert.equal(b.writes.length, 0);
    const atualizado = await salvar(b, { ...treinamento, [campo]: valor, versao: '3.0' });
    assert.equal(atualizado.status, 200, campo + ': ' + JSON.stringify(atualizado.body));
  }
});

test('espaços na versão não contornam a renovação de conclusões', async () => {
  const b = backend({ rows: [linha(treinamento)] });
  assert.equal((await salvar(b, { ...treinamento, titulo: 'Novo conteúdo', versao: ' 2.0 ' })).status, 409);
  assert.equal(b.writes.length, 0);
});

test('metadados não renovam a conclusão nem removem campos legados ou autoria original', async () => {
  const anterior = { ...treinamento, criadoEm: '2026-08-04T12:00:00.000Z', criadoPor: 'Autora original', ordem: 4, legado: { observacao: 'Preservar' } };
  const b = backend({ rows: [linha(anterior)] });
  const r = await salvar(b, { id: anterior.id, responsavel: 'Outra responsável', ordem: 5, criadoEm: '1900-01-01', criadoPor: 'Forjado', revisadoEm: '1900-01-01', revisadoPor: 'Forjado' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.registro.versao, anterior.versao);
  assert.equal(r.body.registro.responsavel, 'Outra responsável');
  assert.equal(r.body.registro.ordem, 5);
  assert.deepEqual(r.body.registro.legado, anterior.legado);
  assert.deepEqual(r.body.registro.blocos, anterior.blocos);
  assert.deepEqual(r.body.registro.materiais, anterior.materiais);
  assert.equal(r.body.registro.criadoEm, anterior.criadoEm);
  assert.equal(r.body.registro.criadoPor, anterior.criadoPor);
  assert.equal(r.body.registro.revisadoPor, 'Administrador real');
  assert.notEqual(r.body.registro.revisadoEm, '1900-01-01');
});

test('ausência legada de criação não permite inventar a data e autora originais', async () => {
  const b = backend({ rows: [linha(treinamento)] });
  const r = await salvar(b, { ...treinamento, criadoEm: '1900-01-01', criadoPor: 'Forjado' });
  assert.equal(r.status, 200);
  assert.equal(r.body.registro.criadoEm, undefined);
  assert.equal(r.body.registro.criadoPor, undefined);
});

test('defaults explícitos equivalentes ao legado não exigem nova versão', async () => {
  const anterior = { ...dados.treinamentos[0] }; delete anterior.exigeAceite;
  const r = await salvar(backend({ rows: [linha(anterior)] }), { ...anterior, tipo: '', setor: '', resumo: '', exigeAceite: false, validadeMeses: 0, materiais: [] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.registro.versao, anterior.versao);
});

test('remoção explícita de aceite, validade e materiais requer nova versão', async () => {
  for (const patch of [{ exigeAceite: false }, { validadeMeses: 0 }, { materiais: [] }]) {
    const b = backend({ rows: [linha(treinamento)] });
    assert.equal((await salvar(b, { id: treinamento.id, ...patch })).status, 409);
    assert.equal(b.writes.length, 0);
  }
});

test('todos os blocos legados conservam estrutura e propriedades adicionais', async () => {
  const blocos = [
    ...['paragrafo', 'texto', 'subtitulo', 'destaque', 'alerta'].map(tipo => ({ tipo, texto: 'Instrução fictícia.', legado: 'preservado' })),
    ...['passos', 'lista', 'checklist'].map(tipo => ({ tipo, itens: ['Primeiro item', 'Segundo item'], legado: 'preservado' }))
  ];
  const anterior = { ...treinamento, blocos };
  const r = await salvar(backend({ rows: [linha(anterior)] }), { ...anterior, responsavel: 'Outra responsável' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.registro.blocos, blocos);
});

test('repetir o conteúdo já persistido não falha na validação antes da idempotência SQL', async () => {
  const registro = { ...treinamento, titulo: 'Novo conteúdo', versao: '3.0' }, extra = { mutationId: 'envio-treino-1', expectedRevision: 3 };
  const primeira = await salvar(backend({ rows: [linha(treinamento)] }), registro, 'admin', extra);
  assert.equal(primeira.status, 200);
  const b = backend({ rows: [linha(primeira.body.registro)] });
  const repetida = await salvar(b, registro, 'admin', extra);
  assert.equal(repetida.status, 200, JSON.stringify(repetida.body));
  assert.equal(b.writes[0].args.p_mutation, extra.mutationId);
  assert.equal(b.writes[0].args.p_expected, extra.expectedRevision);
  assert.equal(repetida.body.registro.criadoEm, primeira.body.registro.criadoEm);
});
