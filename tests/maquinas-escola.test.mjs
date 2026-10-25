import test from 'node:test';
import assert from 'node:assert/strict';
import {backend} from './helpers.mjs';
const row=(colecao,registro,revision=1)=>({colecao,id:registro.id,registro,revision,apagado:false});
const m=()=>({id:'ativo:maq-demo',referencia:{tipo:'ativo',id:'maq-demo'},referencias:[{tipo:'ativo',id:'maq-demo'}],revisao:1,estado:'rascunho',conteudo:{fabricante:'Fictício',modelo:'Exemplo',finalidade:'Conhecer o equipamento fictício.',seguranca:'Conferir orientação com instrutor.',preparacao:'Conferir o posto fictício.',operacao:'Acompanhar a demonstração fictícia.',qualidade:'Conferir resultado.',limpeza:'Limpeza conforme orientação.',encerramento:'Encerrar com acompanhamento.',foto:{url:'https://example.org/maquina.png',usoConfirmado:true},fontes:[],consumiveis:[]}});
const admin={sub:'gestao',papel:'admin'};
function app(manual=m()) {const rows=[],tables={painel_registros:[{colecao:'manuais_maquinas',id:manual.id,registro:manual},{colecao:'ativo',id:'maq-demo',registro:{tipo:'maquina'}}]};const b=backend({rows,tables,persistWrites:true,painel:async body=>({itens:body.action==='manuaisMaquinasCatalogo'?[{id:'maq-demo',nome:'Máquina exemplo',setor:'Produção',modelo:'Exemplo'}]:[manual]})});return {...b,manual,rows,tables};}
const cmd=(b,operacao,args={},who=admin,origin=true)=>b.call({action:'escola',operacao,...args},who,{headers:origin?{'x-painel-cracha':'origem-ficticia'}:{}});
test('importar exige administração e sessão da origem',async()=>{const b=app();assert.equal((await cmd(b,'maquinas.catalogo',{}, {sub:'ana',papel:'equipe'})).status,403);assert.equal((await cmd(b,'maquinas.catalogo',{},admin,false)).status,403);});
test('cria curso em rascunho com etapas e ID estável; repetir não sobrescreve',async()=>{const b=app();const x=await cmd(b,'maquinas.gerar',{manualId:b.manual.id,mutationId:'criar-1',revisaoManual:1});assert.equal(x.status,200);const f=x.body.registro;assert.equal(f.publicada,false);assert.equal(f.etapas.length,8);assert.equal(f.origemMaquina.manualId,b.manual.id);assert.equal(f.origemMaquina.revisao,1);assert.equal(f.etapas.at(-1).tipo,'pratica');assert.equal(f.etapas.at(-1).validadores.length,0);assert.equal(f.etapas.reduce((n,e)=>n+e.pontos,0),130);assert.equal((await cmd(b,'maquinas.gerar',{manualId:b.manual.id,mutationId:'criar-2',revisaoManual:1})).body.registro.id,f.id);assert.equal(b.rows.length,1);assert(!JSON.stringify(f).includes('origem-ficticia'));});
test('não permite forjar vínculo nem publicar manual pendente',async()=>{const b=app();const f=(await cmd(b,'maquinas.gerar',{manualId:b.manual.id,mutationId:'criar-1',revisaoManual:1})).body.registro;f.publicada=true;let x=await cmd(b,'salvarFormacao',{formacao:f,expectedRevision:1,mutationId:'salvar-1'});assert.equal(x.status,409);f.publicada=false;f.origemMaquina.manualId='outro';x=await cmd(b,'salvarFormacao',{formacao:f,expectedRevision:1,mutationId:'salvar-2'});assert.equal(x.status,409);});
test('atualizar exige revisão e preserva histórico, vídeos e pontos configurados',async()=>{const b=app();const f=(await cmd(b,'maquinas.gerar',{manualId:b.manual.id,mutationId:'criar-1',revisaoManual:1})).body.registro;const stored=b.rows[0];stored.registro.etapas[0].pontos=17;stored.registro.etapas[5].materiais=[{id:'video-demo',versao:'1'}];b.manual.revisao=2;b.manual.conteudo.operacao='Nova orientação fictícia';let x=await cmd(b,'maquinas.atualizar',{manualId:b.manual.id,revisaoManual:2,mutationId:'atualizar-1',expectedRevision:0});assert.equal(x.status,409);x=await cmd(b,'maquinas.atualizar',{manualId:b.manual.id,revisaoManual:2,mutationId:'atualizar-2',expectedRevision:1});assert.equal(x.status,200);assert.equal(x.body.registro.versoesAnteriores[0].origemMaquina.revisao,1);assert.equal(x.body.registro.origemMaquina.revisao,2);assert.equal(x.body.registro.etapas[0].pontos,17);assert.equal(x.body.registro.etapas[5].materiais[0].id,'video-demo');assert.equal(x.body.registro.publicada,false);assert.equal(x.body.registro.id,f.id);});
test('nenhuma foto restrita nem arquivo comercial sai pelo catálogo de treinamento',async()=>{const b=app();b.manual.conteudo.foto={url:'https://heveemylixartyijxewh.supabase.co/storage/v1/object/public/painel-arquivos/manuais/ativo/maq-demo/restrito/foto.png',usoConfirmado:true};b.manual.conteudo.notaFiscal='SEGREDO';b.manual.conteudo.assistencias=[{email:'privado@example.org'}];const x=await cmd(b,'maquinas.catalogo');assert.equal(x.status,200);assert.equal(x.body.itens[0].foto,'');assert(!JSON.stringify(x.body).includes('SEGREDO'));assert(!JSON.stringify(x.body).includes('privado@example.org'));});
test('foto livre é assinada; origem local e mídia restrita não são renderizadas',async()=>{
 const b=app();b.manual.conteudo.foto.url='https://heveemylixartyijxewh.supabase.co/storage/v1/object/public/painel-arquivos/manuais/ativo/maq-demo/livre/aabb-1234.webp';
 let x=await cmd(b,'maquinas.catalogo');assert.match(x.body.itens[0].foto,/signed/);
 b.manual.conteudo.foto.url='https://127.0.0.1/privado.png';x=await cmd(b,'maquinas.catalogo');assert.equal(x.body.itens[0].foto,'');
});
test('mudança do manual bloqueia avanços e preserva pontos já conquistados pelo ID do RH',async()=>{
 const b=app();b.manual.estado='aprovado';
 b.tables.acesso_conta=[{id:'a1',usuario:'ana',ativo:true,colaborador_id:'rh1'}];b.tables.acesso_papel=[{conta_id:'a1',sistema:'pops',login:'ana',ativo:true,papel:'equipe'}];b.tables.registros=[row('colaboradores',{id:'rh1',nome:'Pessoa fictícia',setor:'Produção'})];
 const f=(await cmd(b,'maquinas.gerar',{manualId:b.manual.id,revisaoManual:1,mutationId:'g'})).body.registro;
 // Simula curso já revisado; nenhum registro real é alterado.
 b.rows[0].registro.publicada=true;b.rows[0].registro.liberacao.pessoas=['rh1'];
 const event={formacaoId:f.id,formacaoVersao:f.versao,etapaId:'conhecer',evento:'leitura',mutationId:'leu-1'};
 let x=await cmd(b,'registrar',event,{sub:'ana',papel:'equipe'});assert.equal(x.status,200,JSON.stringify(x.body));assert.equal(x.body.registro.colaboradorId,'rh1');assert.equal(x.body.registro.pontos,10);
 x=await cmd(b,'registrar',event,{sub:'ana',papel:'equipe'});assert.equal(x.body.registro.pontos,10);assert.equal(x.body.registro.conquistas.length,1);
 b.manual.revisao=2;x=await cmd(b,'registrar',{...event,etapaId:'seguranca',mutationId:'leu-2'},{sub:'ana',papel:'equipe'});assert.equal(x.status,409);
 const p=await cmd(b,'painel',{}, {sub:'ana',papel:'equipe'});assert.equal(p.body.aprendizagem[0].pontos,10);assert.match(p.body.formacoes[0].maquina.pendencia,/manual mudou/i);assert.equal(p.body.formacoes[0].origemMaquina,undefined);
});
test('vídeo obrigatório não vira uma aula vazia só desmarcando preparação',async()=>{
 const b=app();b.manual.estado='aprovado';const f=(await cmd(b,'maquinas.gerar',{manualId:b.manual.id,revisaoManual:1,mutationId:'g'})).body.registro;
 f.publicada=true;f.versao='manual-1-r2';f.etapas.find(e=>e.id==='video').preparacaoPendente=false;
 const x=await cmd(b,'salvarFormacao',{formacao:f,expectedRevision:1,mutationId:'s'});assert.equal(x.status,409);assert.match(x.body.erro,/vídeo/);
});
test('atualização conserva aulas adicionais e coloca sua revisão em pendência',async()=>{
 const b=app();await cmd(b,'maquinas.gerar',{manualId:b.manual.id,revisaoManual:1,mutationId:'g'});
 b.rows[0].registro.etapas.push({id:'extra',titulo:'Aula própria',tipo:'aula',pontos:7,conteudo:{comoFazer:'Orientação criada pela gestão'}});b.manual.revisao=2;
 const x=await cmd(b,'maquinas.atualizar',{manualId:b.manual.id,revisaoManual:2,expectedRevision:1,mutationId:'u'});assert.equal(x.status,200);assert.equal(x.body.registro.etapas.at(-1).conteudo.comoFazer,'Orientação criada pela gestão');assert.equal(x.body.registro.etapas.at(-1).preparacaoPendente,true);
});
test('vínculo retirado do Patrimônio impede liberar curso; não depende de coluna apagado no Painel',async()=>{
 const b=app();b.manual.estado='aprovado';const f=(await cmd(b,'maquinas.gerar',{manualId:b.manual.id,revisaoManual:1,mutationId:'g'})).body.registro;f.publicada=true;
 b.tables.painel_registros.splice(1,1);const x=await cmd(b,'salvarFormacao',{formacao:f,expectedRevision:1,mutationId:'s'});assert.equal(x.status,409);assert.match(x.body.erro,/Patrimônio/);assert(!b.queries.filter(q=>q.table==='painel_registros').some(q=>q.eqs.some(([k])=>k==='apagado')));
});
test('cursos por nomes iguais permanecem distintos por ID',async()=>{
 const a=m(),outro={...m(),id:'ativo:segunda',referencia:{tipo:'ativo',id:'segunda'},referencias:[{tipo:'ativo',id:'segunda'}]};
 const b=backend({persistWrites:true,painel:async body=>({itens:body.action==='manuaisMaquinasCatalogo'?[{id:'maq-demo',nome:'Mesmo nome'},{id:'segunda',nome:'Mesmo nome'}]:[a,outro]})});
 const um=await cmd(b,'maquinas.gerar',{manualId:a.id,revisaoManual:1,mutationId:'a'}),dois=await cmd(b,'maquinas.gerar',{manualId:outro.id,revisaoManual:1,mutationId:'b'});assert.equal(um.status,200);assert.equal(dois.status,200);assert.notEqual(um.body.registro.id,dois.body.registro.id);
});
test('origem inacessível não gera conteúdo nem escrita parcial',async()=>{const b=backend({persistWrites:true,painel:async()=>{throw Error('Falha simulada');}});const x=await cmd(b,'maquinas.gerar',{manualId:'ativo:demo',revisaoManual:1,mutationId:'g'});assert.equal(x.status,503);assert.equal(b.writes.length,0);});
