import test from 'node:test';
import assert from 'node:assert/strict';
import { backend } from './helpers.mjs';
import { telaEscola, esperar, indexedDBFicticio } from './escola-tela-harness.mjs';

// Catálogo, editor de curso, matriz de cargos, importação de pacote e cache no
// aparelho, com a tela real conversando com o servidor real (sandbox).
// Pessoas, cargos, vagas, cursos e materiais são todos fictícios.
const conteudo={aprender:'Aprender o passo fictício',importancia:'Fazer bem feito',comoFazer:'Seguir o roteiro fictício',erros:'Evitar improviso',evidencia:'Demonstrar o passo'};
const aula=(id,extra={})=>({id,titulo:'Aula '+id,tipo:'aula',obrigatoria:true,prerequisitos:[],pontos:10,conteudo,quiz:[],minimoAcerto:70,maxTentativas:3,fontes:[],documentos:[],...extra});
const curso=(id,extra={})=>({id,titulo:'Curso '+id,versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:[],cargos:[],setores:[],todos:false},etapas:[aula(id+'-a1')],...extra});
const row=(colecao,registro,revision=1)=>({colecao,id:registro.id,registro,revision,apagado:false});
const tabelas=()=>({
 acesso_conta:[{id:'c1',usuario:'ana',ativo:true,colaborador_id:'rh1'},{id:'c2',usuario:'bruno',ativo:true,colaborador_id:'rh2'},{id:'c4',usuario:'gestao',ativo:true,colaborador_id:'rh4'}],
 acesso_papel:[{conta_id:'c1',sistema:'pops',login:'ana',ativo:true,papel:'equipe'},{conta_id:'c2',sistema:'pops',login:'bruno',ativo:true,papel:'equipe'},{conta_id:'c4',sistema:'pops',login:'gestao',ativo:true,papel:'gestor'}],
 registros:[
  row('colaboradores',{id:'rh1',nome:'Ana Fictícia',setor:'Produção',cargoId:'operador-ficticio',areaId:'area-producao'}),
  row('colaboradores',{id:'rh2',nome:'Bruno Fictício',setor:'Produção',cargoId:'designer-ficticio',areaId:'area-producao'}),
  row('colaboradores',{id:'rh4',nome:'Gestora Fictícia',setor:'Produção',areaId:'area-producao'}),
  row('cargos',{id:'operador-ficticio',nome:'Operador fictício',areaId:'area-producao',faixas:[1,2]}),
  row('cargos',{id:'designer-ficticio',nome:'Designer fictício',areaId:'area-producao',faixas:[1,2]}),
  row('cargos',{id:'cargo-vago-ficticio',nome:'Cargo vago fictício',areaId:'area-gestao',faixas:[1,2]}),
  row('areas',{id:'area-producao',nome:'Produção fictícia'}),row('areas',{id:'area-gestao',nome:'Gestão fictícia'}),
  row('vagas',{id:'v1',titulo:'Vaga aberta fictícia',cargoId:'cargo-vago-ficticio',areaId:'area-gestao',status:'Aberta',nivelId:'N1'}),
  row('vagas',{id:'v2',titulo:'Vaga prevista fictícia',cargoId:null,areaId:'area-producao',status:'Prevista',nivelId:'N1'}),
 ]});
const configBase=()=>({gestores:{gestao:['Produção']},educacao:{catalogo:{familias:{'operacao-ficticia':{nome:'Operação fictícia',descricao:'',cargos:['operador-ficticio']}},trilhas:{'integracao-ficticia':{nome:'Integração fictícia',descricao:'Primeiros passos',ordem:0},'sistema-ficticio':{nome:'Sistema fictício',descricao:'',ordem:1}}}}});
// O sandbox não grava a configuração: a tela de teste aplica o catálogo que o
// servidor devolveu, como o pops_configurar faria no banco.
function servidor(rows=[],config=configBase()){
 const b=backend({tables:tabelas(),config,persistWrites:true,rows});
 const chamar=async(payload,acao,quem)=>{const r=await b.call({action:acao,...payload},quem);if(r.status>=400)throw Object.assign(new Error(r.body.erro),{status:r.status});if(payload.operacao==='configurarCatalogo')config.educacao={...(config.educacao||{}),catalogo:r.body.catalogo};return r.body;};
 return {b,config,rows,chamar};
}
const admin={usuario:'admin',nome:'Administração fictícia',papel:'admin',pessoaRH:null};
const gestor={usuario:'gestao',nome:'Gestora Fictícia',papel:'gestor',pessoaRH:{colaboradorId:'rh4'}};
function tela(s,sessao={},extra={}){const quem=()=>({sub:t.SESSAO.usuario,papel:t.SESSAO.papel});const t=telaEscola({sessao,api:(p,acao)=>s.chamar(p,acao,quem()),...extra});return t;}
const gravacoes=s=>s.b.writes.filter(w=>w.rpc==='pops_gravar').length;

test('catálogo agrupa por trilha e mostra o estado de cada curso para quem estuda',async()=>{
 const rows=[
  row('formacoes',curso('c-integracao',{liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},catalogo:{trilha:'integracao-ficticia',ordem:1,nivel:'essencial',cargaMinutos:90,codigo:'INT-01',area:'Integração'}})),
  row('formacoes',curso('c-gestao',{titulo:'Curso só para designer',liberacao:{pessoas:[],cargos:['designer-ficticio'],setores:[],todos:false},catalogo:{trilha:'sistema-ficticio',ordem:2}})),
  row('formacoes',curso('c-sistema',{liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-ficticia']},catalogo:{trilha:'sistema-ficticio',ordem:1,preRequisitos:['c-integracao','c-gestao']}})),
  row('formacoes',curso('c-solto',{titulo:'Curso sem trilha fictício',liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false}})),
  row('formacoes',curso('c-antigo',{titulo:'Curso antigo fictício',liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},catalogo:{trilha:'integracao-ficticia',ordem:2}})),
  row('formacoes',curso('c-rascunho',{publicada:false,catalogo:{trilha:'sistema-ficticio',ordem:3}})),
 ];
 const s=servidor(rows);const ana={sub:'ana',papel:'equipe'};
 for(const [fid,eid] of [['c-integracao','c-integracao-a1'],['c-antigo','c-antigo-a1']])assert.equal((await s.b.call({action:'escola',operacao:'registrar',formacaoId:fid,etapaId:eid,formacaoVersao:'1',evento:'leitura',mutationId:'leitura-'+fid},ana)).status,200);
 // O curso antigo deixa de ser liberado para a pessoa: o histórico continua.
 const antigo=rows.find(r=>r.id==='c-antigo');assert.equal((await s.b.call({action:'escola',operacao:'salvarFormacao',formacao:{...antigo.registro,liberacao:{pessoas:[],cargos:[],setores:[],todos:false}},expectedRevision:antigo.revision,mutationId:'retira-antigo'},{sub:'admin',papel:'admin'})).status,200);
 const t=tela(s);await t.route('catalogo');
 const secoes=t.app.querySelectorAll('.cat-trilha').map(x=>x.querySelector('h2').textContent);
 assert.deepEqual(secoes,['Integração fictícia','Sistema fictício','Cursos sem trilha']);
 const card=titulo=>t.app.querySelectorAll('.cat-curso').find(c=>c.querySelector('h3').textContent===titulo);
 assert.equal(card('Curso c-integracao').dataset.estado,'concluido');assert.match(card('Curso c-integracao').textContent,/Essencial · 1 h 30 min · INT-01/);
 // A sub-área (campo area) vira subtítulo dentro da área, não se repete no cartão.
 assert.equal(t.app.querySelectorAll('.cat-sub').find(sb=>sb.querySelectorAll('.cat-curso').some(c=>c.querySelector('h3').textContent==='Curso c-integracao')).querySelector('.cat-sub-titulo').textContent,'Integração');
 assert.equal(card('Curso c-sistema').dataset.estado,'disponivel');
 const recomenda=card('Curso c-sistema').querySelector('.cat-recomenda').textContent;assert.match(recomenda,/Recomendado antes:/);assert.match(recomenda,/Curso c-integracao \(concluído\) · Curso só para designer \(não liberado\)/);
 assert.equal(card('Curso só para designer'),undefined,'Curso fora do público não vira cartão para a pessoa');
 assert.equal(card('Curso c-rascunho'),undefined,'Rascunho não aparece para quem estuda');
 // Curso que a pessoa já fez e perdeu: fica na trilha dele e aponta para o histórico.
 const antigoCard=card('Curso antigo fictício');assert.equal(antigoCard.dataset.estado,'nao_liberado');
 assert.match(antigoCard.textContent,/Não está mais liberado para você\. Seu histórico continua em/);assert.equal(antigoCard.querySelector('a').textContent,'Meu histórico');assert.doesNotMatch(antigoCard.textContent,/ainda não foi liberado|Peça ao seu gestor/);
 assert.equal(antigoCard.querySelector('a').attributes.href,'#/conquistas');
 const trilhaDe=titulo=>t.app.querySelectorAll('.cat-trilha').find(sec=>sec.querySelectorAll('.cat-curso').some(c=>c.querySelector('h3').textContent===titulo))?.querySelector('h2').textContent;
 assert.equal(trilhaDe('Curso antigo fictício'),'Integração fictícia');
 assert.equal(card('Curso sem trilha fictício').dataset.estado,'disponivel');
 t.node('#cat-estado').value='nao_liberado';t.node('#cat-estado').onchange();
 assert.deepEqual(t.app.querySelectorAll('.cat-curso').filter(c=>!c.hidden).map(c=>c.querySelector('h3').textContent),['Curso antigo fictício']);
 assert.match(t.node('#cat-contagem').textContent,/1 curso neste filtro/);
 assert.doesNotMatch(t.text(),/jornada|forma[cç][aã]o/i);
});

test('editor de curso grava catálogo, famílias e cargos sem ninguém, com a aula própria',async()=>{
 const s=servidor([row('formacoes',curso('c-base',{titulo:'Curso base fictício'}))]);const t=tela(s,admin);
 await t.route('formacao-editor','novo');
 const cargos=t.node('#edu-lib-cargos');assert.ok(cargos,'Lista de funções do RH');
 const vago=cargos.querySelectorAll('label').find(l=>l.textContent.includes('Cargo vago fictício'));
 assert.match(vago.textContent,/Gestão fictícia · ninguém no cargo hoje · vaga aberta/);
 assert.equal(cargos.querySelectorAll('input').length,3,'Todos os cargos do RH, inclusive vazios');
 assert.ok(t.node('#edu-lib-familias'),'Administração escolhe famílias');
 assert.ok(t.node('select[data-campo=tipo]').children.some(o=>o.attributes.value==='aula'),'Tipo aula disponível');
 t.node('#edu-titulo').value='Curso de sistema fictício';t.node('#edu-setor').value='Produção';t.node('#edu-versao').value='1';
 t.node('#edu-cat-trilha').value='sistema-ficticio';t.node('#edu-cat-nivel').value='essencial';t.node('#edu-cat-carga').value='90';t.node('#edu-cat-ordem').value='3';t.node('#edu-cat-codigo').value='SIS-01';t.node('#edu-cat-area').value='Sistema';
 t.marcar('edu-cat-familias','operacao-ficticia');t.marcar('edu-cat-pre','c-base');t.marcar('edu-lib-familias','operacao-ficticia');t.marcar('edu-lib-cargos','cargo-vago-ficticio');
 assert.match(t.node('#edu-alcance').textContent,/Alcance estimado: 1 pessoa/);
 t.marcar('edu-lib-cargos','designer-ficticio');assert.match(t.node('#edu-alcance').textContent,/2 pessoas/);
 await t.click('#edu-add-etapa');
 const tipos=t.app.querySelectorAll('select[data-campo=tipo]');assert.equal(tipos.at(-1).value,'aula');
 await t.submit('#edu-editor');
 const enviado=t.calls.find(c=>c.operacao==='salvarFormacao').formacao;
 assert.deepEqual(enviado.catalogo,{trilha:'sistema-ficticio',area:'Sistema',nivel:'essencial',codigo:'SIS-01',cargaMinutos:90,ordem:3,familias:['operacao-ficticia'],preRequisitos:['c-base']});
 assert.deepEqual(enviado.liberacao.familias,['operacao-ficticia']);assert.deepEqual(enviado.liberacao.cargos,['cargo-vago-ficticio','designer-ficticio']);
 assert.equal(enviado.etapas.at(-1).tipo,'aula');
 const gravado=s.rows.find(r=>r.colecao==='formacoes'&&r.id===enviado.id).registro;
 assert.deepEqual(gravado.catalogo.familias,['operacao-ficticia']);assert.equal(gravado.catalogo.trilha,'sistema-ficticio');assert.deepEqual(gravado.liberacao.familias,['operacao-ficticia']);
 assert.equal(t.ctx.location.hash,'#/escola');assert.ok(t.toasts.some(x=>/Curso salvo/.test(x.m)));
});

test('gestor edita curso sem mexer nas famílias escolhidas pela administração',async()=>{
 const s=servidor([row('formacoes',curso('c-fam',{titulo:'Curso por família fictício',liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-ficticia']}}))]);const t=tela(s,gestor);
 await t.route('formacao-editor','c-fam');
 assert.equal(t.node('#edu-lib-familias'),null);assert.match(t.text(),/Também liberado para: Operação fictícia/);assert.match(t.text(),/Somente a administração libera por família/);
 assert.equal(t.node('#edu-todos').disabled,true);
 t.node('#edu-cat-area').value='Área fictícia';await t.submit('#edu-editor');
 const enviado=t.calls.find(c=>c.operacao==='salvarFormacao').formacao;assert.equal(Object.hasOwn(enviado.liberacao,'familias'),false);
 const gravado=s.rows.find(r=>r.id==='c-fam');assert.equal(gravado.revision,2);assert.deepEqual(gravado.registro.liberacao.familias,['operacao-ficticia']);assert.equal(gravado.registro.catalogo.area,'Área fictícia');
});

test('editor recusa carga inválida antes de enviar e explica o motivo',async()=>{
 const s=servidor([row('formacoes',curso('c-base'))]);const t=tela(s,admin);await t.route('formacao-editor','c-base');
 t.node('#edu-cat-carga').value='0';await t.submit('#edu-editor');
 assert.match(t.node('#edu-editor-erro').textContent,/carga do curso/i);assert.equal(t.node('#edu-editor-erro').hidden,false);
 assert.equal(t.calls.some(c=>c.operacao==='salvarFormacao'),false);
});

test('matriz mostra todos os cargos, vagas e como cada cargo recebe o curso',async()=>{
 const s=servidor([row('formacoes',curso('c-cargo',{titulo:'Curso por cargo',liberacao:{pessoas:[],cargos:['designer-ficticio'],setores:[],todos:false}})),row('formacoes',curso('c-familia',{titulo:'Curso por família',liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-ficticia']}})),row('formacoes',curso('c-todos',{titulo:'Curso para todos',publicada:false,liberacao:{pessoas:[],cargos:[],setores:[],todos:true}}))]);
 const t=tela(s,admin);await t.route('matriz');
 const linhas=t.node('tbody').querySelectorAll('tr');assert.equal(linhas.length,3);
 const linha=nome=>linhas.find(l=>l.querySelector('th').textContent.includes(nome));
 const colunas=t.node('thead').querySelectorAll('th').slice(1).map(th=>th.querySelector('span').textContent);
 const celula=(nome,cursoTitulo)=>linha(nome).querySelectorAll('td')[colunas.indexOf(cursoTitulo)];
 assert.match(linha('Cargo vago fictício').textContent,/1 vaga aberta/);
 assert.match(celula('Designer fictício','Curso por cargo').textContent,/Cargo/);
 assert.match(celula('Operador fictício','Curso por família').textContent,/Família: Operação fictícia/);
 assert.match(celula('Cargo vago fictício','Curso para todos').textContent,/Todos/);assert.match(celula('Cargo vago fictício','Curso para todos').attributes.class,/m-rascunho/);
 assert.match(celula('Cargo vago fictício','Curso por cargo').textContent,/não recebe/);
 assert.match(t.text(),/1 vaga sem cargo no RH/);assert.match(t.text(),/Vaga prevista fictícia \(Prevista\)\. Sem cargo, a vaga não recebe cursos pela matriz/);
 t.node('#mat-vagas').checked=true;t.node('#mat-vagas').onchange();assert.equal(t.node('tbody').querySelectorAll('tr').length,1);
});

test('administração cadastra família na matriz e o servidor recusa excluir família em uso',async()=>{
 const s=servidor([row('formacoes',curso('c-familia',{liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-ficticia']}}))]);const t=tela(s,admin);await t.route('matriz');
 await t.click('#cat-add-familia');
 const nova=t.node('[data-familia="1"]'),nome=nova.querySelector('[data-fam-nome]');nome.value='Gestão fictícia';nome.oninput();
 assert.equal(nova.querySelector('[data-fam-id]').value,'gestao-ficticia');
 t.marcar('cat-fam-cargos-1','cargo-vago-ficticio');await t.submit('#cat-form');
 const pedido=t.calls.find(c=>c.operacao==='configurarCatalogo');
 assert.deepEqual(Object.keys(pedido.catalogo.familias).sort(),['gestao-ficticia','operacao-ficticia']);
 assert.deepEqual(pedido.catalogo.familias['gestao-ficticia'].cargos,['cargo-vago-ficticio']);assert.deepEqual(pedido.catalogo.familias['operacao-ficticia'].cargos,['operador-ficticio']);
 assert.deepEqual(Object.keys(pedido.catalogo.trilhas).sort(),['integracao-ficticia','sistema-ficticio']);
 assert.ok(s.b.writes.some(w=>w.rpc==='pops_configurar'&&w.args.p_patch.educacao.catalogo.familias['gestao-ficticia']));
 // Excluir família em uso: o servidor recusa e a tela mostra o motivo.
 await t.route('matriz');const rem=t.app.querySelectorAll('[data-rem-familia]').find(b=>t.node('[data-familia="'+b.dataset.remFamilia+'"]').textContent.includes('Operação fictícia'));await t.click(rem);
 await t.submit('#cat-form');assert.match(t.node('#cat-erro').textContent,/Ainda há cursos ou materiais usando: família operacao-ficticia/);
});

test('gestor consulta a matriz sem editar famílias e trilhas',async()=>{
 const s=servidor([row('formacoes',curso('c-cargo',{liberacao:{pessoas:[],cargos:['designer-ficticio'],setores:[],todos:false}}))]);const t=tela(s,gestor);await t.route('matriz');
 assert.equal(t.node('#cat-form'),null);assert.match(t.text(),/Somente a administração organiza famílias de cargos e trilhas/);assert.equal(t.node('tbody').querySelectorAll('tr').length,3);
});

// ───── Importar pacote ─────
const pacoteBase=()=>({versao:'2026.10.14',
 catalogo:{familias:{'gestao-ficticia':{nome:'Gestão fictícia',cargos:['cargo-vago-ficticio']}},trilhas:{'sistema-ficticio':{nome:'Sistema fictício revisto',ordem:1}}},
 materiais:[{id:'m-novo',tipo:'texto',titulo:'Material novo fictício',versao:'1.0',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página fictícia'],publicada:true},{id:'m-antigo',tipo:'texto',titulo:'Material antigo fictício',versao:'2.0',setor:'Produção',objetivo:'Objetivo revisto',paginas:['Página revista']}],
 cursos:[
  {id:'k-b',titulo:'Curso B fictício',versao:'1',setor:'Produção',catalogo:{trilha:'sistema-ficticio',ordem:2,preRequisitos:['k-a']},etapas:[aula('kb1')]},
  {id:'k-a',titulo:'Curso A fictício',versao:'1',setor:'Produção',publicada:true,liberacao:{familias:['gestao-ficticia']},catalogo:{trilha:'sistema-ficticio',ordem:1,nivel:'essencial'},etapas:[aula('ka1',{materiais:[{id:'m-novo'}],quiz:[{id:'q1',pergunta:'Pergunta fictícia?',opcoes:['Certa','Errada'],correta:0,explicacao:'Explicação fictícia'}],aprovacao:{por:'alguem',em:'2026-10-14T00:00:00Z',versao:'1'}})]},
  {id:'k-antigo',titulo:'Curso antigo fictício',versao:'2',setor:'Produção',etapas:[aula('kx1')]},
 ]});
const rowsImport=()=>[row('materiais',{id:'m-antigo',tipo:'texto',titulo:'Material antigo fictício',versao:'1.0',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página antiga'],publicada:false,ativa:true,liberacao:{pessoas:[],cargos:[],setores:[],todos:false}}),row('formacoes',curso('k-antigo',{titulo:'Curso antigo fictício',publicada:false}))];
const itens=(t,onde)=>t.node(onde).querySelectorAll('li').filter(l=>(l.attributes.class||'').includes('imp-item')).map(l=>[l.querySelector('b').textContent,l.querySelector('.imp-situacao').textContent]);
async function escolher(t,pacote){const input=t.node('#imp-arquivo');input.files=[{size:1000,text:async()=>typeof pacote==='string'?pacote:JSON.stringify(pacote)}];await input.onchange();await esperar(60);}

test('importação mostra a prévia com erros por item e não deixa confirmar',async()=>{
 const s=servidor([row('formacoes',curso('c-publicado',{titulo:'Curso publicado fictício'}))]);const t=tela(s,admin);await t.route('importar');
 await escolher(t,'{ isto não é json');assert.match(t.node('#imp-area').textContent,/não é um JSON válido/);
 const ruim={versao:'1',materiais:[{id:'m1',tipo:'texto',titulo:'Material fictício',versao:'1.0',setor:'Produção',objetivo:'Objetivo'},{id:'m1',tipo:'texto',titulo:'Repetido',versao:'1.0',setor:'Produção',objetivo:'Objetivo'}],
  cursos:[{id:'k1',titulo:'Curso com problemas',versao:'1',setor:'Produção',liberacao:{cargos:['cargo-inexistente']},catalogo:{trilha:'trilha-inexistente'},etapas:[aula('a1',{materiais:[{id:'m-faltando'}]})]},{id:'c-publicado',titulo:'Por cima do publicado',versao:'2',setor:'Produção',etapas:[aula('a2')]}]};
 await escolher(t,ruim);
 const texto=t.node('#imp-area').textContent;
 for(const msg of [/Identificador repetido no pacote/,/Cargo não encontrado no RH: cargo-inexistente/,/Trilha não cadastrada no catálogo: trilha-inexistente/,/material m-faltando não está no pacote nem na biblioteca/,/Já está liberado para os alunos/])assert.match(texto,msg);
 assert.equal(t.node('#imp-confirmar').disabled,true);
 await t.click('#imp-confirmar');assert.equal(t.calls.some(c=>['academia.salvarMaterial','salvarFormacao','configurarCatalogo'].includes(c.operacao)),false);
});

test('importação grava catálogo, materiais e cursos como rascunho, na ordem, e repetir não duplica',async()=>{
 const s=servidor(rowsImport());const t=tela(s,admin);await t.route('importar');
 await escolher(t,pacoteBase());
 assert.deepEqual(itens(t,'#imp-area'),[['Família: Gestão fictícia','Nova'],['Trilha: Sistema fictício revisto','Atualizada'],['Material novo fictício','Novo'],['Material antigo fictício','Versão nova'],['Curso A fictício','Novo'],['Curso B fictício','Novo'],['Curso antigo fictício','Versão nova']]);
 assert.equal(t.node('#imp-confirmar').disabled,false);
 await t.click('#imp-confirmar');await esperar(80);
 const ops=t.calls.filter(c=>['configurarCatalogo','academia.salvarMaterial','salvarFormacao'].includes(c.operacao));
 assert.deepEqual(ops.map(c=>c.operacao+':'+(c.material?.id||c.formacao?.id||'')),['configurarCatalogo:','academia.salvarMaterial:m-novo','academia.salvarMaterial:m-antigo','salvarFormacao:k-a','salvarFormacao:k-b','salvarFormacao:k-antigo']);
 const cat=ops[0].catalogo;assert.deepEqual(Object.keys(cat.familias).sort(),['gestao-ficticia','operacao-ficticia']);assert.equal(cat.trilhas['integracao-ficticia'].nome,'Integração fictícia');assert.equal(cat.trilhas['sistema-ficticio'].nome,'Sistema fictício revisto');
 for(const c of ops.slice(1)){const reg=c.material||c.formacao;assert.equal(reg.publicada,false);assert.match(c.mutationId,/^imp-[mc]-[0-9a-f]{48}$/);}
 assert.equal(ops.find(c=>c.material?.id==='m-antigo').expectedRevision,1);assert.equal(ops.find(c=>c.material?.id==='m-novo').expectedRevision,0);assert.equal(ops.find(c=>c.formacao?.id==='k-antigo').expectedRevision,1);
 const ka=ops.find(c=>c.formacao?.id==='k-a').formacao;assert.equal(Object.hasOwn(ka.etapas[0],'aprovacao'),false,'Importar nunca aprova prova');assert.deepEqual(ka.etapas[0].materiais,[{id:'m-novo',versao:'1.0',titulo:'Material novo fictício'}]);
 const gravado=s.rows.find(r=>r.id==='k-a').registro;assert.equal(gravado.publicada,false);assert.deepEqual(gravado.liberacao.familias,['gestao-ficticia']);assert.equal(gravado.catalogo.trilha,'sistema-ficticio');assert.equal(gravado.etapas[0].aprovacao,undefined);
 assert.equal(s.rows.find(r=>r.id==='m-antigo').registro.versoesAnteriores[0].versao,'1.0');
 assert.match(t.node('#imp-resultado').textContent,/6 de 6 itens conferidos no servidor/);
 // Repetir o mesmo pacote: mesmos identificadores de envio, nenhuma gravação nova.
 const antes=gravacoes(s),ids=ops.slice(1).map(c=>c.mutationId);
 await escolher(t,pacoteBase());assert.match(t.node('#imp-area').textContent,/Mesma versão/);
 await t.click('#imp-confirmar');await esperar(80);
 const novas=t.calls.filter(c=>['configurarCatalogo','academia.salvarMaterial','salvarFormacao'].includes(c.operacao)).slice(ops.length);
 assert.equal(novas.some(c=>c.operacao==='configurarCatalogo'),false,'Catálogo igual não é regravado');
 assert.deepEqual(novas.map(c=>c.mutationId),ids);assert.equal(gravacoes(s),antes,'Repetir não grava de novo');
 assert.match(t.node('#imp-resultado').textContent,/Já estava gravado/);assert.match(t.node('#imp-resultado').textContent,/6 de 6 itens conferidos/);
});

test('falha de rede para a importação e repetir completa sem duplicar',async()=>{
 const s=servidor(rowsImport());let derrubar=true;
 const quem=()=>({sub:'admin',papel:'admin'});
 const t=telaEscola({sessao:admin,api:async(p,acao)=>{const r=await s.chamar(p,acao,quem());if(derrubar&&p.operacao==='academia.salvarMaterial'&&p.material.id==='m-antigo'){derrubar=false;throw new Error('Sem conexão');}return r;}});
 await t.route('importar');await escolher(t,pacoteBase());await t.click('#imp-confirmar');await esperar(80);
 const res=t.node('#imp-resultado').textContent;
 assert.match(res,/Sem resposta do servidor/);assert.match(res,/Não enviado/);assert.equal(t.calls.some(c=>c.operacao==='salvarFormacao'),false);
 assert.equal(s.rows.find(r=>r.id==='m-antigo').revision,2,'A resposta se perdeu, mas o servidor gravou');
 await escolher(t,pacoteBase());await t.click('#imp-confirmar');await esperar(80);
 assert.equal(s.rows.find(r=>r.id==='m-antigo').revision,2,'Repetir não grava o material de novo');
 assert.equal(s.rows.filter(r=>r.colecao==='formacoes').length,3);assert.match(t.node('#imp-resultado').textContent,/6 de 6 itens conferidos/);
});

test('quem não é administração não importa pacote',async()=>{
 const s=servidor();const t=tela(s,gestor);await t.route('importar');assert.equal(t.node('#imp-arquivo'),null);assert.match(t.text(),/Somente a administração importa pacotes/);
});

// ───── Cache no aparelho ─────
const painel=(titulo,extra={})=>({ok:true,pessoa:{colaboradorId:'rh1',nome:'Ana Fictícia',funcao:'Operador fictício'},formacoes:[{...curso('c1',{titulo}),liberada:true,progresso:{concluidas:0,total:1,percentual:0}}],aprendizagem:[],catalogo:{familias:{},trilhas:{}},gestao:{podeGerir:false,podeValidar:false,pessoas:[],registros:[]},atualizadoEm:'2026-10-14T12:00:00Z',...extra});
function adiado(){let resolver;const p=new Promise(r=>resolver=r);return {p,resolver};}

test('aparelho mostra a última consulta na hora e troca pela nova quando o servidor responde',async()=>{
 const idb=indexedDBFicticio();
 const primeira=telaEscola({idb,api:async()=>painel('Curso de ontem fictício')});await primeira.route('inicio');await esperar(40);
 assert.equal(idb.entradas().length,1);assert.match(idb.entradas()[0][0],/^painel\|ana\|equipe\|rh1$/);
 const resposta=adiado();const segunda=telaEscola({idb,api:()=>resposta.p});const indo=segunda.route('inicio');await esperar(40);
 assert.match(segunda.text(),/Curso de ontem fictício/,'Mostra a cópia do aparelho sem esperar o servidor');assert.match(segunda.text(),/Mostrando a última consulta deste aparelho/);
 resposta.resolver(painel('Curso de hoje fictício'));await indo;await esperar(40);
 assert.match(segunda.text(),/Curso de hoje fictício/);assert.doesNotMatch(segunda.text(),/Curso de ontem fictício|Mostrando a última consulta/);
});

test('dado novo não redesenha por cima de quem já mexeu na tela',async()=>{
 const idb=indexedDBFicticio();await telaEscola({idb,api:async()=>painel('Versão guardada fictícia')}).route('inicio');await esperar(40);
 const resposta=adiado(),t=telaEscola({idb,api:()=>resposta.p});const indo=t.route('inicio');await esperar(40);
 t.interagir();resposta.resolver(painel('Versão nova fictícia'));await indo;await esperar(40);
 assert.match(t.text(),/Versão guardada fictícia/);assert.match(t.text(),/Há informações novas da escola/);
 await t.click('#escola-mostrar-novo');assert.match(t.text(),/Versão nova fictícia/);
});

test('cache do aparelho é por pessoa, papel e versão da tela, e sai junto com a conta',async()=>{
 const idb=indexedDBFicticio();await telaEscola({idb,api:async()=>painel('Curso da Ana fictício')}).route('inicio');await esperar(40);
 for(const [sessao,versaoTela] of [[{usuario:'bruno',pessoaRH:{colaboradorId:'rh2'}},'teste-1'],[{papel:'gestor'},'teste-1'],[{},'teste-2']]){
  const resposta=adiado(),t=telaEscola({idb,sessao,versaoTela,api:()=>resposta.p});const indo=t.route('inicio');await esperar(40);
  assert.doesNotMatch(t.text(),/Curso da Ana fictício/,'Outra identidade ou versão não lê o pacote: '+JSON.stringify(sessao)+versaoTela);assert.match(t.text(),/Consultando cursos/);
  resposta.resolver(painel('Curso próprio fictício'));await indo;await esperar(40);
 }
 // Cada gravação apaga o que for de outra identidade (aparelho dividido).
 assert.equal(idb.entradas().length,1);
 const t=telaEscola({idb,api:async()=>painel('Qualquer')});await t.edu.limparCacheAparelho();await esperar(20);assert.equal(idb.entradas().length,0);
});

test('depois de gravar, a próxima tela espera o servidor em vez da cópia do aparelho',async()=>{
 const idb=indexedDBFicticio();let titulo='Antes do registro fictício';
 const t=telaEscola({idb,api:async p=>p.operacao==='painel'?painel(titulo):{ok:true,registro:{formacaoId:'c1',formacaoVersao:'1',etapas:{'c1-a1':{status:'concluida'}}}}});
 await t.route('formacao','c1~c1-a1');await esperar(40);assert.equal(idb.entradas().length,1);
 titulo='Depois do registro fictício';await t.click('[data-evento="leitura"]');await esperar(40);
 const nova=telaEscola({idb,api:async()=>painel('Servidor depois do registro')});const indo=nova.route('inicio');await esperar(5);
 assert.doesNotMatch(nova.text(),/Antes do registro fictício/,'Cópia anterior ao registro foi descartada');await indo;
});

test('biblioteca e vídeos usam a cópia do aparelho e conferem com o servidor',async()=>{
 const idb=indexedDBFicticio();const bib=t=>({ok:true,materiais:[{id:'m1',tipo:'texto',titulo:t,versao:'1',objetivo:'Objetivo fictício',publicada:true,ativa:true}],estudos:[],pessoa:{colaboradorId:'rh1'},podeGerir:false,pessoas:[],atualizadoEm:'2026-10-14T12:00:00Z'});
 await telaEscola({idb,api:async()=>bib('Material guardado fictício')}).route('biblioteca');await esperar(40);
 const resposta=adiado(),t=telaEscola({idb,api:()=>resposta.p});const indo=t.route('videos');await esperar(40);
 t.ctx.ROTA={nome:'biblioteca',arg:''};
 const r2=adiado(),t2=telaEscola({idb,api:()=>r2.p});const indo2=t2.route('biblioteca');await esperar(40);
 assert.match(t2.text(),/Material guardado fictício/);assert.match(t2.text(),/Mostrando a última consulta deste aparelho/);
 r2.resolver(bib('Material conferido fictício'));await indo2;await esperar(40);assert.match(t2.text(),/Material conferido fictício/);
 resposta.resolver(bib('Material guardado fictício'));await indo;
});

test('telas da escola falam curso, aula e trilha, sem jornada nem formação',async()=>{
 const s=servidor([row('formacoes',curso('c-voc',{titulo:'Curso de vocabulário',liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},catalogo:{trilha:'integracao-ficticia'},etapas:[aula('v1'),aula('v2',{tipo:'pratica',checklist:['Conferir'],validadores:['bruno'],prerequisitos:['v1']})]}))]);
 const aluno=tela(s);
 for(const [rota,arg] of [['inicio',''],['formacao','c-voc'],['formacao','c-voc~v1'],['conquistas',''],['catalogo',''],['avaliacoes','']]){await aluno.route(rota,arg);assert.doesNotMatch(aluno.text(),/jornada|forma[cç][aã]o|forma[cç][oõ]es/i,rota+' '+arg);}
 await aluno.route('formacao','c-voc');assert.match(aluno.text(),/aulas obrigatórias/);assert.match(aluno.text(),/Atividade prática/);
 const gestao=tela(s,admin);
 for(const [rota,arg] of [['escola',''],['formacao-editor','c-voc'],['formacao-editor','novo'],['alunos',''],['matriz','']]){await gestao.route(rota,arg);assert.doesNotMatch(gestao.text(),/jornada|forma[cç][aã]o|forma[cç][oõ]es/i,rota+' '+arg);}
});

test('avaliações mostram à gestão as provas que esperam aprovação, sem aprovar por ali',async()=>{
 const q=[{id:'q1',pergunta:'Pergunta fictícia?',opcoes:['Certa','Errada'],correta:0,explicacao:'Explicação fictícia'}];
 const s=servidor([row('formacoes',curso('c-prova',{titulo:'Curso com prova fictícia',etapas:[aula('p1',{tipo:'avaliacao',quiz:q})]}))]);
 const t=tela(s,admin);await t.route('avaliacoes');
 const sec=t.node('#eg-provas-aprovar');assert.match(sec.textContent,/Aula p1/);assert.match(sec.textContent,/Curso com prova fictícia/);
 assert.equal(sec.querySelector('a').attributes.href,'#/formacao-editor/c-prova');assert.equal(t.calls.some(c=>c.operacao==='aprovarAvaliacao'),false);
 const aluno=tela(s);await aluno.route('avaliacoes');assert.equal(aluno.node('#eg-provas-aprovar'),null);
});

test('material e instrumento listam todos os cargos do RH e famílias para a administração',async()=>{
 const s=servidor();const t=tela(s,admin);await t.route('material-editor','novo');
 assert.equal(t.node('#ac-cargos').tag,'fieldset','Lista de marcar, como no editor do curso');
 const cargo=t.node('#ac-cargos').querySelectorAll('label').find(l=>l.textContent.includes('Cargo vago fictício'));assert.match(cargo.textContent,/Gestão fictícia/);
 assert.ok(t.node('#ac-familias'),'Família só para a administração');t.marcar('ac-familias','operacao-ficticia');
 t.node('#ac-titulo').value='Material fictício';t.node('#ac-setor').value='Produção';t.node('#ac-objetivo').value='Objetivo fictício';
 await t.submit('#ac-editor');const enviado=t.calls.find(c=>c.operacao==='academia.salvarMaterial');assert.deepEqual(enviado.material.liberacao.familias,['operacao-ficticia']);
 assert.deepEqual(s.rows.find(r=>r.colecao==='materiais').registro.liberacao.familias,['operacao-ficticia']);
 const g=tela(s,gestor);await g.route('material-editor','novo');assert.equal(g.node('#ac-familias'),null);
});

test('prévia avisa quando o pacote troca o público de item que já existe',async()=>{
 const s=servidor([row('formacoes',curso('k-publico',{titulo:'Curso com público fictício',publicada:false,liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false}}))]);const t=tela(s,admin);await t.route('importar');
 await escolher(t,{versao:'1',materiais:[],cursos:[{id:'k-publico',titulo:'Curso com público fictício',versao:'2',setor:'Produção',liberacao:{cargos:['designer-ficticio']},etapas:[aula('p1')]}]});
 assert.match(t.node('#imp-area').textContent,/O público \(liberação\) do pacote substitui o público atual deste item/);assert.equal(t.node('#imp-confirmar').disabled,false);
 await escolher(t,{versao:'1',materiais:[],cursos:[{id:'k-publico',titulo:'Curso com público fictício',versao:'2',setor:'Produção',etapas:[aula('p1')]}]});
 assert.doesNotMatch(t.node('#imp-area').textContent,/substitui o público/,'Sem liberação no pacote, o público atual fica');
});

// ───── Correções da revisão de 14/10 (tela) ─────
test('matriz deixa o curso arquivado fora e só conta como coberto o cargo com curso liberado',async()=>{
 const s=servidor([
  row('formacoes',curso('c-ativo',{titulo:'Curso ativo fictício',liberacao:{pessoas:[],cargos:['designer-ficticio'],setores:[],todos:false}})),
  row('formacoes',curso('c-arquivado',{titulo:'Curso arquivado fictício',ativa:false,liberacao:{pessoas:[],cargos:['operador-ficticio'],setores:[],todos:false}})),
  row('formacoes',curso('c-rascunho',{titulo:'Curso rascunho fictício',publicada:false,liberacao:{pessoas:[],cargos:['cargo-vago-ficticio'],setores:[],todos:false}}))]);
 const t=tela(s,admin);await t.route('matriz');
 const colunas=t.node('thead').querySelectorAll('th').slice(1).map(th=>th.querySelector('span').textContent);
 assert.deepEqual(colunas.sort(),['Curso ativo fictício','Curso rascunho fictício']);
 const linha=nome=>t.node('tbody').querySelectorAll('tr').find(l=>l.querySelector('th').textContent.includes(nome));
 assert.match(linha('Operador fictício').textContent,/Nenhum curso liberado para este cargo/,'Curso arquivado não cobre o cargo');
 assert.match(linha('Cargo vago fictício').textContent,/Só curso em rascunho para este cargo/);
 assert.equal(linha('Designer fictício').querySelector('.mat-alerta'),null);
 assert.equal(t.node('#mat-sem-curso').textContent,'2');assert.match(t.text(),/1 curso arquivado fica fora da matriz/);
});

test('catálogo: arquivado tem estado próprio e trilha vazia fala com cada papel sem prometer o que não aparece',async()=>{
 const s=servidor([row('formacoes',curso('c-arq',{titulo:'Curso arquivado fictício',ativa:false,liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},catalogo:{trilha:'integracao-ficticia'}}))]);
 const t=tela(s,admin);await t.route('catalogo');
 const card=t.app.querySelectorAll('.cat-curso').find(c=>c.querySelector('h3').textContent==='Curso arquivado fictício');
 assert.equal(card.dataset.estado,'arquivado');assert.equal(card.querySelector('.edu-status').textContent,'Arquivado');assert.match(card.textContent,/Curso arquivado: não alcança ninguém/);
 assert.ok(t.node('#cat-estado').children.some(o=>o.attributes.value==='arquivado'));
 const vazio=t.app.querySelectorAll('.cat-trilha').find(x=>x.querySelector('h2').textContent==='Sistema fictício').querySelector('.cat-vazio').textContent;
 assert.match(vazio,/Nenhum curso nesta trilha ainda/);assert.doesNotMatch(vazio,/gestor/);
 const g=tela(s,gestor);await g.route('catalogo');
 assert.match(g.app.querySelectorAll('.cat-vazio')[0].textContent,/Nenhum curso desta trilha é do seu setor ou está liberado para você/);
 // A aluna não recebe o curso arquivado: nenhum cartão, nenhuma opção "Arquivado".
 const a=tela(s);await a.route('catalogo');
 assert.equal(a.app.querySelectorAll('.cat-curso').length,0);assert.equal(a.node('#cat-estado').children.some(o=>o.attributes.value==='arquivado'),false);
 assert.match(a.text(),/Trilhas e cursos liberados para você/);assert.match(a.app.querySelectorAll('.cat-vazio')[0].textContent,/Nenhum curso desta trilha está liberado para você ainda/);
 await a.route('inicio');assert.match(a.text(),/No catálogo você vê as trilhas e os cursos liberados para você/);assert.doesNotMatch(a.text(),/o que existe em cada trilha/);
});

test('matriz manda o catálogo que leu; se outra administração gravou depois, mostra o motivo e não apaga nada',async()=>{
 const s=servidor();const t=tela(s,admin);await t.route('matriz');
 // Outra administração grava uma família nova enquanto esta Matriz está aberta.
 const lido=structuredClone(s.config.educacao.catalogo);
 await s.chamar({operacao:'configurarCatalogo',catalogo:{familias:{...lido.familias,'design-ficticio':{nome:'Design fictício',cargos:['designer-ficticio']}},trilhas:lido.trilhas},catalogoAnterior:lido},'escola',{sub:'admin2',papel:'admin'});
 const novaTrilha=async()=>{await t.click('#cat-add-trilha');const box=t.node('[data-trilha-ed="2"]'),nome=box.querySelector('[data-tri-nome]');nome.value='Trilha nova fictícia';nome.oninput();await t.submit('#cat-form');};
 await novaTrilha();
 const pedido=t.calls.find(c=>c.operacao==='configurarCatalogo');
 assert.deepEqual(Object.keys(pedido.catalogoAnterior.familias),['operacao-ficticia'],'Vai junto o catálogo que a tela leu');
 assert.match(t.node('#cat-erro').textContent,/O catálogo mudou desde que você abriu esta tela/);assert.ok(t.node('#cat-recarregar'));
 assert.ok(s.config.educacao.catalogo.familias['design-ficticio'],'A família da outra pessoa continua');assert.equal(s.config.educacao.catalogo.trilhas['trilha-nova-ficticia'],undefined);
 // Recarregar e refazer: grava as duas mudanças juntas.
 await t.click('#cat-recarregar');await esperar(80);
 await novaTrilha();
 assert.ok(s.config.educacao.catalogo.familias['design-ficticio']);assert.equal(s.config.educacao.catalogo.trilhas['trilha-nova-ficticia'].nome,'Trilha nova fictícia');
});

test('prévia acusa conteúdo novo na mesma versão, de curso e de material, e não grava nada pela metade',async()=>{
 const s=servidor();const t=tela(s,admin);await t.route('importar');
 const base={versao:'1',materiais:[{id:'m-sis',tipo:'texto',titulo:'Material de sistema fictício',versao:'1.0',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página um']}],cursos:[{id:'k-sis',titulo:'Curso de sistema fictício',versao:'1.0',setor:'Produção',etapas:[aula('ks1',{materiais:[{id:'m-sis'}]})]}]};
 await escolher(t,base);await t.click('#imp-confirmar');await esperar(80);assert.match(t.node('#imp-resultado').textContent,/2 de 2 itens conferidos/);
 // O pacote volta com a trilha renomeada, o título de uma aula e uma página mudados, na mesma versão.
 const mudado=structuredClone(base);mudado.catalogo={familias:{},trilhas:{'sistema-ficticio':{nome:'Sistema fictício renomeado',ordem:1}}};mudado.cursos[0].etapas[0].titulo='Aula com título novo';mudado.materiais[0].paginas=['Página um revista'];
 const antes=t.calls.length;await escolher(t,mudado);
 const texto=t.node('#imp-area').textContent;
 assert.match(texto,/O título ou as aulas mudaram e a versão continua 1\.0/);assert.match(texto,/O conteúdo mudou e a versão continua 1\.0\. Suba a versão do material/);
 assert.equal(t.app.querySelectorAll('.imp-erro').length,2);assert.equal(t.node('#imp-confirmar').disabled,true);
 assert.ok(t.calls.slice(antes).some(c=>c.operacao==='academia.abrirMaterial'&&c.materialId==='m-sis'),'O material existente é aberto inteiro, com as páginas');
 await t.click('#imp-confirmar');assert.equal(t.calls.slice(antes).some(c=>['configurarCatalogo','academia.salvarMaterial','salvarFormacao'].includes(c.operacao)),false,'Nada é gravado, nem o catálogo');
 // Sem mudança de conteúdo, a mesma versão passa, com o aviso de repetição.
 await escolher(t,{...base,catalogo:mudado.catalogo});
 assert.match(t.node('#imp-area').textContent,/Já existe nesta versão, com o mesmo conteúdo/);assert.equal(t.app.querySelectorAll('.imp-erro').length,0);assert.equal(t.node('#imp-confirmar').disabled,false);
});

test('importação conserva assunto e tempo do material, manda o catálogo lido e limpa o campo do arquivo',async()=>{
 const s=servidor([row('materiais',{id:'m-cad',tipo:'texto',titulo:'Caderno fictício',versao:'1.0',setor:'Produção',objetivo:'Objetivo fictício',categoria:'Cadernos fictícios',duracaoMinutos:40,paginas:['Página antiga'],publicada:false,ativa:true,liberacao:{pessoas:[],cargos:[],setores:[],todos:false}})]);
 const t=tela(s,admin);await t.route('importar');
 const pacote={versao:'2',catalogo:{familias:{},trilhas:{'trilha-nova':{nome:'Trilha nova fictícia'}}},materiais:[{id:'m-cad',tipo:'texto',titulo:'Caderno fictício',versao:'2.0',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página nova']}],cursos:[]};
 const input=t.node('#imp-arquivo');input.value='C:\\fakepath\\pacote.json';input.files=[{name:'pacote.json',size:1000,text:async()=>JSON.stringify(pacote)}];await input.onchange();await esperar(60);
 assert.equal(input.value,'','Campo limpo: escolher de novo o mesmo arquivo, corrigido, lê outra vez');assert.match(t.node('#imp-area').textContent,/Arquivo lido: pacote\.json/);
 await t.click('#imp-confirmar');await esperar(80);
 const cat=t.calls.find(c=>c.operacao==='configurarCatalogo');assert.deepEqual(Object.keys(cat.catalogoAnterior.trilhas).sort(),['integracao-ficticia','sistema-ficticio']);
 const mat=t.calls.find(c=>c.operacao==='academia.salvarMaterial').material;assert.equal(mat.categoria,'Cadernos fictícios');assert.equal(mat.duracaoMinutos,40);
 const gravado=s.rows.find(r=>r.id==='m-cad').registro;assert.equal(gravado.versao,'2.0');assert.equal(gravado.categoria,'Cadernos fictícios');assert.equal(gravado.duracaoMinutos,40);
 // Assunto que vem no pacote vale sobre o atual.
 const plano=await t.cat.planejar({versao:'3',materiais:[{...pacote.materiais[0],versao:'3.0',categoria:'Assunto novo fictício'}],cursos:[]},{materiais:[{...gravado,_serverRevision:2}],formacoes:[],catalogo:s.config.educacao.catalogo});
 assert.equal(plano.materiais[0].payload.categoria,'Assunto novo fictício');assert.equal(plano.materiais[0].payload.duracaoMinutos,40);
});

test('biblioteca: a consulta em andamento de quem saiu não chega a quem entra no mesmo aparelho',async()=>{
 const pendenteA=adiado(),chamadas=[];
 const bibDe=(titulo,podeGerir)=>({ok:true,materiais:[{id:'m-'+chamadas.length,tipo:'video',titulo,versao:'1',objetivo:'Objetivo fictício',publicada:!podeGerir,ativa:true}],estudos:[],pessoa:{colaboradorId:podeGerir?'rh4':'rh2'},podeGerir,pessoas:[],atualizadoEm:'2026-10-14T12:00:00Z'});
 const t=telaEscola({sessao:{usuario:'admin-a',papel:'admin',pessoaRH:null},api:async p=>{chamadas.push(t.ctx.SESSAO.usuario+':'+p.operacao);if(p.operacao==='academia.biblioteca')return t.ctx.SESSAO.usuario==='admin-a'?pendenteA.p:bibDe('Vídeo da Bia fictício',false);return painel('Qualquer');}});
 const indoA=t.route('videos');await esperar(40);
 // A administração sai pela Minha conta e a Bia entra, sem recarregar a página.
 await t.edu.limparCacheAparelho();t.ctx.SESSAO={usuario:'bia',nome:'Bia Fictícia',papel:'equipe',pessoaRH:{colaboradorId:'rh2'}};
 const indoB=t.route('videos');await esperar(40);
 pendenteA.resolver(bibDe('Vídeo da administração fictício',true));await indoA;await indoB;await esperar(40);
 assert.deepEqual(chamadas.filter(x=>x.endsWith('academia.biblioteca')),['admin-a:academia.biblioteca','bia:academia.biblioteca'],'A Bia consulta com o próprio crachá');
 assert.match(t.text(),/Vídeo da Bia fictício/);assert.doesNotMatch(t.text(),/Vídeo da administração fictício|Cadastrar vídeo/);
});

test('gestor salva pela tela o curso e o material que a administração liberou para todos',async()=>{
 const s=servidor([row('formacoes',curso('c-todos',{titulo:'Curso para todos fictício',liberacao:{pessoas:[],cargos:[],setores:[],todos:true}})),row('materiais',{id:'m-todos',tipo:'texto',titulo:'Material para todos fictício',versao:'1',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página fictícia'],publicada:true,ativa:true,liberacao:{pessoas:[],cargos:[],setores:[],todos:true}})]);
 const t=tela(s,gestor);await t.route('formacao-editor','c-todos');
 assert.equal(t.node('#edu-todos').disabled,true);assert.equal(t.node('#edu-todos').checked,true);
 t.node('#edu-titulo').value='Curso para todos fictício revisto';t.node('#edu-versao').value='2';await t.submit('#edu-editor');
 assert.equal(t.node('#edu-editor-erro')?.hidden??true,true);
 const gravado=s.rows.find(r=>r.id==='c-todos');assert.equal(gravado.revision,2);assert.equal(gravado.registro.liberacao.todos,true);assert.equal(gravado.registro.titulo,'Curso para todos fictício revisto');
 await t.route('material-editor','m-todos');assert.equal(t.node('#ac-todos'),null);assert.match(t.text(),/Também liberado para todas as pessoas vinculadas ao RH/);
 assert.equal(t.node('#ac-pessoas').tag,'fieldset');
 t.node('#ac-categoria').value='Assunto fictício';await t.submit('#ac-editor');
 const mat=s.rows.find(r=>r.id==='m-todos');assert.equal(mat.revision,2);assert.equal(mat.registro.liberacao.todos,true);assert.equal(mat.registro.categoria,'Assunto fictício');
});

test('provas para aprovar abrem no recorte da gestão, sem a lista pessoal do aluno',async()=>{
 const q=[{id:'q1',pergunta:'Pergunta fictícia?',opcoes:['Certa','Errada'],correta:0,explicacao:'Explicação fictícia'}];
 const s=servidor([row('formacoes',curso('c-prova',{titulo:'Curso com prova fictícia',liberacao:{pessoas:['rh4'],cargos:[],setores:[],todos:false},etapas:[aula('p1',{tipo:'avaliacao',quiz:q})]}))]);
 const t=tela(s,gestor);await t.route('avaliacoes','equipe');
 assert.match(t.app.querySelector('h1').textContent,/Provas para aprovar/);assert.ok(t.node('#eg-provas-aprovar'));assert.match(t.node('#eg-provas-aprovar').textContent,/Curso com prova fictícia/);
 assert.equal(t.app.querySelectorAll('.edu-grid').length,0,'Sem a grade pessoal de avaliações');
 const a=tela(s);await a.route('avaliacoes','equipe');assert.equal(a.node('#eg-provas-aprovar'),null);assert.match(a.text(),/Somente quem gerencia cursos aprova provas/);
});

// Auditoria de 15/10/2026: catálogo por área e sub-área, filtro de área e busca
// pelo nome que o chão usa. Cursos e áreas fictícios.
test('catálogo por área: sub-áreas em ordem, filtro de área com o Silk dela e busca pelas palavras do chão',async()=>{
 const cfg={gestores:{gestao:['Produção']},educacao:{catalogo:{familias:{'operacao-ficticia':{nome:'Operação fictícia',descricao:'',cargos:['operador-ficticio']}},trilhas:{comercial:{nome:'Comercial',descricao:'',ordem:10},producao:{nome:'Produção',descricao:'',ordem:20}}}}};
 const lib={pessoas:['rh1'],cargos:[],setores:[],todos:false};
 const rows=[
  row('formacoes',curso('c-venda',{titulo:'Venda fictícia',liberacao:lib,catalogo:{trilha:'comercial',area:'Vendas',ordem:20}})),
  row('formacoes',curso('c-cnc',{titulo:'Router fictício',liberacao:lib,catalogo:{trilha:'producao',area:'Máquinas CNC',ordem:40,palavrasChave:['cnc','router']}})),
  row('formacoes',curso('c-letra',{titulo:'Letra-caixa fictícia',liberacao:lib,catalogo:{trilha:'producao',area:'Letras caixa',ordem:60,resumo:'Montar e testar a letra.'}})),
  row('formacoes',curso('c-pcp',{titulo:'Fila fictícia',liberacao:lib,catalogo:{trilha:'producao',area:'PCP',ordem:10}})),
 ];
 const s=servidor(rows,cfg),t=tela(s);await t.route('catalogo');
 const prod=t.app.querySelectorAll('.cat-trilha').find(x=>x.dataset.trilha==='producao');
 assert.deepEqual(prod.querySelectorAll('.cat-sub-titulo').map(x=>x.textContent),['PCP','Máquinas CNC','Letras caixa']);
 assert.match(prod.textContent,/Montar e testar a letra\./);
 // Todas as áreas: nenhum Silk à mostra (um por tela). Com a área escolhida, só o dela.
 assert.ok(t.app.querySelectorAll('.cat-silk').every(x=>x.hidden));
 const chip=t.app.querySelectorAll('[data-area]').find(b=>b.dataset.area==='producao');chip.onclick();
 assert.equal(t.app.querySelectorAll('.cat-trilha').find(x=>x.dataset.trilha==='comercial').hidden,true);
 assert.equal(prod.querySelector('.cat-silk').hidden,false);assert.equal(prod.querySelector('.cat-silk').querySelector('.silk').attributes.alt,'');
 const visiveis=()=>t.app.querySelectorAll('.cat-curso').filter(c=>!c.hidden).map(c=>c.querySelector('h3').textContent);
 const buscar=q=>{t.node('#cat-busca').value=q;t.node('#cat-busca').oninput();return visiveis();};
 t.app.querySelectorAll('[data-area]').find(b=>b.dataset.area==='').onclick();
 assert.deepEqual(buscar('cnc'),['Router fictício']);
 assert.deepEqual(buscar('letra caixa'),['Letra-caixa fictícia']);
 assert.deepEqual(buscar('vendas'),['Venda fictícia']);
 assert.deepEqual(buscar('serralheria'),[]);
});
