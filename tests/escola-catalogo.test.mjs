import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {backend} from './helpers.mjs';

// Aula, catálogo, famílias de cargo, grade do RH e cache de leituras da escola.
// Todos os nomes, cargos e vagas abaixo são fictícios.
const conteudo={aprender:'Aprender exemplo',importancia:'Aplicação no trabalho',comoFazer:'Passo a passo fictício',erros:'Erros comuns',evidencia:'Demonstrar corretamente'};
const quiz=[{id:'q1',pergunta:'Exemplo?',opcoes:['Correto','Errado'],correta:0,explicacao:'O motivo da resposta é este',revisar:'Passo a passo fictício'}];
const row=(colecao,registro,revision=1)=>({colecao,id:registro.id,registro,revision,apagado:false});
const etapa=(id,tipo='aula',extra={})=>({id,titulo:'Etapa '+id,tipo,obrigatoria:true,prerequisitos:[],pontos:10,conteudo,quiz:[],minimoAcerto:70,maxTentativas:2,fontes:[],documentos:[],...extra});
const formacao=(extra={})=>({id:'f1',titulo:'Curso fictício',versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},etapas:[etapa('aula1')],...extra});
const tabelas=()=>({
 acesso_conta:[{id:'acc1',usuario:'ana',ativo:true,colaborador_id:'rh1'},{id:'acc2',usuario:'bruno',ativo:true,colaborador_id:'rh2'},{id:'acc3',usuario:'gestao',ativo:true,colaborador_id:'rh4'}],
 acesso_papel:[{conta_id:'acc1',sistema:'pops',login:'ana',ativo:true,papel:'equipe'},{conta_id:'acc2',sistema:'pops',login:'bruno',ativo:true,papel:'equipe'},{conta_id:'acc3',sistema:'pops',login:'gestao',ativo:true,papel:'gestor'}],
 registros:[
  row('colaboradores',{id:'rh1',nome:'Ana Fictícia',setor:'Produção',cargoId:'operador-ficticio',areaId:'area-producao',salario:999}),
  row('colaboradores',{id:'rh2',nome:'Bruno Fictício',setor:'Produção',cargoId:'designer-ficticio',areaId:'area-producao'}),
  row('colaboradores',{id:'rh3',nome:'Carla Fictícia',setor:'Financeiro',cargoId:'analista-ficticio',areaId:'area-adm'}),
  row('colaboradores',{id:'rh4',nome:'Gestora Fictícia',setor:'Produção',areaId:'area-producao'}),
  row('cargos',{id:'operador-ficticio',nome:'Operador fictício',areaId:'area-producao',trilha:'Produção / Operação',faixas:[1,2,3,4,5],salarioPraticado:999}),
  row('cargos',{id:'designer-ficticio',nome:'Designer fictício',areaId:'area-producao',trilha:'Produção / Operação',faixas:[1,2,3,4,5]}),
  row('cargos',{id:'analista-ficticio',nome:'Analista fictício',areaId:'area-adm',trilha:'Administrativo',faixas:[1,2,3,4,5]}),
  row('cargos',{id:'cargo-vago-ficticio',nome:'Cargo vago fictício',areaId:'area-adm',faixas:[1,2,3,4,5]}),
  row('areas',{id:'area-producao',nome:'Produção fictícia'}),
  row('areas',{id:'area-adm',nome:'Gestão fictícia'}),
  row('vagas',{id:'v1',titulo:'Vaga aberta fictícia',cargoId:'designer-ficticio',areaId:'area-producao',nivelId:'N1',status:'Aberta',descricao:'Descrição interna',requisitos:'Requisitos internos'}),
  row('vagas',{id:'v2',titulo:'Vaga fechada fictícia',status:'Fechada'}),
  row('vagas',{id:'v3',titulo:'Vaga prevista fictícia',cargoId:null,areaId:'area-adm',nivelId:'N2',status:'Prevista'}),
  row('vagas',{id:'v4',titulo:'Vaga cancelada fictícia',status:'Cancelada'}),
  row('candidatos',{id:'cand1',nome:'Candidato Fictício',vagaId:'v1',telefone:'0000-0000'}),
 ]});
const configBase=()=>({gestores:{gestao:['Produção']},educacao:{instrutores:{bruno:['Produção']},catalogo:{familias:{'operacao-ficticia':{nome:'Operação fictícia',descricao:'',cargos:['operador-ficticio']}},trilhas:{mubisys:{nome:'Sistema de gestão',descricao:'',ordem:1}}}}});
const app=(opts={})=>backend({tables:opts.tables||tabelas(),config:opts.config||configBase(),persistWrites:true,rows:opts.rows||[]});
const admin={sub:'admin',papel:'admin'},gestor={sub:'gestao',papel:'gestor'};
const cmd=(b,operacao,args={},who={sub:'ana'})=>b.call({action:'escola',operacao,...args},who);
let seq=0;
const registrar=(b,args,who={sub:'ana'})=>cmd(b,'registrar',{formacaoId:'f1',formacaoVersao:'1',mutationId:'reg-'+(++seq),...args},who);
const lidoRH=(b,colecao)=>b.queries.filter(q=>q.table==='registros'&&!q.single&&q.eqs.some(([k,v])=>k==='colecao'&&v===colecao)).length;

test('aula de conteúdo próprio conclui pela leitura, sem POP, treinamento ou material, e segue a regra de versão',async()=>{
 const b=app();
 let r=await cmd(b,'salvarFormacao',{formacao:formacao(),expectedRevision:0,mutationId:'aula-nova'},admin);
 assert.equal(r.status,200);assert.equal(r.body.registro.etapas[0].tipo,'aula');
 assert.equal((await cmd(b,'painel')).body.formacoes[0].etapas[0].statusFonte,'disponivel');
 r=await registrar(b,{etapaId:'aula1',evento:'leitura'});
 assert.equal(r.status,200);assert.equal(r.body.registro.etapas.aula1.status,'concluida');assert.equal(r.body.registro.pontos,10);
 const editada=formacao();editada.etapas[0].conteudo={...conteudo,comoFazer:'Novo passo a passo fictício'};
 assert.equal((await cmd(b,'salvarFormacao',{formacao:editada,expectedRevision:1,mutationId:'aula-mesma-versao'},admin)).status,409);
 editada.versao='2';r=await cmd(b,'salvarFormacao',{formacao:editada,expectedRevision:1,mutationId:'aula-v2'},admin);
 assert.equal(r.status,200);assert.equal(r.body.registro.versoesAnteriores[0].versao,'1');
});

test('aula com avaliação exige compreensão e documento sem conferência deixa a aula pendente',async()=>{
 const comQuiz=formacao({etapas:[etapa('aula1','aula',{quiz,aprovacao:{por:'admin',em:'2026-10-01T00:00:00Z',versao:'1'}})]});
 const b=app({rows:[row('formacoes',comQuiz)]});
 let r=await registrar(b,{etapaId:'aula1',evento:'leitura'});assert.equal(r.body.registro.etapas.aula1.status,'em_andamento');
 r=await registrar(b,{etapaId:'aula1',evento:'responder',respostas:{q1:0}});assert.equal(r.body.registro.etapas.aula1.status,'concluida');
 const comDocumento=formacao({etapas:[etapa('aula1','aula',{documentos:[{titulo:'Ajuda do sistema',url:'https://exemplo.test/ajuda',versao:'1'}]})]});
 const c=app({rows:[row('formacoes',comDocumento)]});
 assert.equal((await cmd(c,'painel')).body.formacoes[0].etapas[0].statusFonte,'pendente');
 assert.equal((await registrar(c,{etapaId:'aula1',evento:'leitura'})).status,409);
});

test('catálogo do curso é validado e mudar o catálogo não pede versão nova nem derruba a avaliação aprovada',async()=>{
 const aprovada=etapa('aula1','aula',{quiz,aprovacao:{por:'admin',em:'2026-10-01T00:00:00Z',versao:'1',parecer:'Conferida'}});
 const b=app({rows:[row('formacoes',formacao({id:'f0',titulo:'Fundamentos fictícios'})),row('formacoes',formacao({etapas:[aprovada]}))]});
 const cat={trilha:'mubisys',area:'Comercial',nivel:'essencial',cargaMinutos:90,ordem:2,familias:['operacao-ficticia'],preRequisitos:['f0'],codigo:'SIS-01',resumo:'Resumo fictício do curso',palavrasChave:['cnc','router']};
 const r=await cmd(b,'salvarFormacao',{formacao:formacao({etapas:[aprovada],catalogo:cat}),expectedRevision:1,mutationId:'cat-ok'},admin);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.catalogo,cat);assert.equal(r.body.registro.versao,'1');
 assert.equal(r.body.registro.etapas[0].aprovacao.por,'admin');assert.equal(r.body.registro.versoesAnteriores.length,0);
 const invalidos=[[{trilha:'Mubisys'},400],[{trilha:'trilha-inexistente'},409],[{nivel:'basico'},400],[{cargaMinutos:0},400],[{cargaMinutos:100001},400],[{ordem:10001},400],[{ordem:1.5},400],
  [{familias:['familia-inexistente']},409],[{familias:Array.from({length:21},(_,i)=>'f'+i)},400],[{familias:['Com Espaco']},400],[{preRequisitos:['f1']},400],[{preRequisitos:['curso-inexistente']},409],
  [{preRequisitos:['f0','f0']},400],[{codigo:'x'.repeat(41)},400],[{resumo:'x'.repeat(201)},400],[{palavrasChave:'cnc'},400],[{palavrasChave:['']},400],[{palavrasChave:['x'.repeat(41)]},400],[{palavrasChave:Array.from({length:21},(_,i)=>'p'+i)},400],[{area:'x'.repeat(121)},400],['texto',400]];
 for(const [i,[c,status]] of invalidos.entries()){
  const x=await cmd(b,'salvarFormacao',{formacao:formacao({etapas:[aprovada],catalogo:typeof c==='string'?c:{...cat,...c}}),expectedRevision:r.body.revision,mutationId:'cat-invalido-'+i},admin);
  assert.equal(x.status,status,JSON.stringify(c).slice(0,60));
 }
});

test('tela antiga sem catálogo conserva o anterior, null retira e recomendação em círculo é recusada',async()=>{
 const b=app({rows:[row('formacoes',formacao({id:'f0',titulo:'Fundamentos fictícios'})),row('formacoes',formacao({catalogo:{trilha:'mubisys',preRequisitos:['f0']}}))]});
 let r=await cmd(b,'salvarFormacao',{formacao:formacao(),expectedRevision:1,mutationId:'tela-antiga'},admin);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.catalogo,{trilha:'mubisys',preRequisitos:['f0']});
 r=await cmd(b,'salvarFormacao',{formacao:formacao({id:'f0',titulo:'Fundamentos fictícios',catalogo:{preRequisitos:['f1']}}),expectedRevision:1,mutationId:'circulo'},admin);
 assert.equal(r.status,409);assert.match(r.body.erro,/círculo/);
 r=await cmd(b,'salvarFormacao',{formacao:formacao({catalogo:null}),expectedRevision:2,mutationId:'retira'},admin);
 assert.equal(r.status,200);assert.equal(r.body.registro.catalogo,undefined);
});

test('aluno vê o catálogo e o curso recomendado antes, sem bloqueio; rascunho só para quem gerencia',async()=>{
 const b=app({rows:[row('formacoes',formacao({id:'f0',titulo:'Fundamentos fictícios',etapas:[etapa('base')]})),row('formacoes',formacao({catalogo:{trilha:'mubisys',ordem:2,preRequisitos:['f0','rascunho']}})),row('formacoes',formacao({id:'rascunho',titulo:'Rascunho fictício',publicada:false}))]});
 let p=await cmd(b,'painel');
 const f1=p.body.formacoes.find(f=>f.id==='f1');
 // O id do rascunho não chega ao aluno nem em catalogo.preRequisitos.
 assert.deepEqual(f1.catalogo,{trilha:'mubisys',ordem:2,preRequisitos:['f0']});
 assert.equal(JSON.stringify(p.body.formacoes).includes('"rascunho"'),false);
 assert.deepEqual(f1.recomendadas,[{id:'f0',titulo:'Fundamentos fictícios',concluida:false,liberada:true}]);
 assert.equal(p.body.catalogo.trilhas.mubisys.nome,'Sistema de gestão');
 // Recomendação não bloqueia: dá para estudar o curso seguinte primeiro.
 assert.equal((await registrar(b,{etapaId:'aula1',evento:'leitura'})).status,200);
 await registrar(b,{formacaoId:'f0',etapaId:'base',evento:'leitura'});
 p=await cmd(b,'painel');assert.equal(p.body.formacoes.find(f=>f.id==='f1').recomendadas[0].concluida,true);
 const g=await cmd(b,'painel',{},admin);assert.deepEqual(g.body.formacoes.find(f=>f.id==='f1').recomendadas.map(x=>x.id),['f0','rascunho']);
 // O campo calculado não volta para o banco quando a tela salva o que recebeu.
 const salvo=await cmd(b,'salvarFormacao',{formacao:g.body.formacoes.find(f=>f.id==='f1'),expectedRevision:1,mutationId:'salva-decorada'},admin);
 assert.equal(salvo.status,200);assert.equal(salvo.body.registro.recomendadas,undefined);
});

test('só a administração configura o catálogo, com identificadores, tamanhos e cargos do RH conferidos',async()=>{
 const b=app();
 const novo={familias:{'operacao-ficticia':{nome:'Operação fictícia',cargos:['operador-ficticio','cargo-vago-ficticio']},'design-ficticio':{nome:'Design fictício',descricao:'Criação',cargos:['designer-ficticio']}},trilhas:{mubisys:{nome:'Sistema de gestão',ordem:1},lideranca:{nome:'Liderança',descricao:'Gestão de equipe'}}};
 assert.equal((await cmd(b,'configurarCatalogo',{catalogo:novo},gestor)).status,403);
 assert.equal((await cmd(b,'configurarCatalogo',{catalogo:novo})).status,403);
 const ruins=[[{familias:{'Operacao':{nome:'X',cargos:[]}}},400],[{familias:{'sem-nome':{cargos:[]}}},400],[{familias:{x:{nome:'X',cargos:['cargo com espaço']}}},400],
  [{familias:{x:{nome:'X',cargos:['cargo-inexistente']}}},409],[{familias:{x:{nome:'X',cargos:['operador-ficticio','operador-ficticio']}}},400],[{familias:{x:{nome:'X',descricao:'d'.repeat(2001)}}},400],
  [{familias:{x:{nome:'n'.repeat(121)}}},400],[{trilhas:{t:{nome:'T',ordem:-1}}},400],[{trilhas:{['t'.repeat(81)]:{nome:'T'}}},400],
  [{familias:Object.fromEntries(Array.from({length:51},(_,i)=>['f'+i,{nome:'F'}]))},400],[{familias:[]},400],[[],400]];
 for(const [catalogo,status] of ruins)assert.equal((await cmd(b,'configurarCatalogo',{catalogo},admin)).status,status,JSON.stringify(catalogo).slice(0,80));
 assert.equal(b.writes.length,0);
 const r=await cmd(b,'configurarCatalogo',{catalogo:novo},admin);
 assert.equal(r.status,200);
 const {p_patch,p_anterior}=b.writes.at(-1).args;
 assert.deepEqual(Object.keys(p_patch),['educacao']);assert.deepEqual(p_patch.educacao.instrutores,{bruno:['Produção']});assert.deepEqual(JSON.parse(JSON.stringify(p_anterior)),{educacao:configBase().educacao});
 assert.deepEqual(r.body.catalogo.familias['design-ficticio'],{nome:'Design fictício',descricao:'Criação',cargos:['designer-ficticio']});
 assert.deepEqual(r.body.catalogo.trilhas.lideranca,{nome:'Liderança',descricao:'Gestão de equipe',ordem:0});
});

test('configurar catálogo grava só educacao.catalogo e preserva instrutores, base de conhecimento e o resto (banco real)',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean);create table public.registros(colecao text,id text,registro jsonb,apagado boolean default false,primary key(colecao,id));');
  for(const nome of ['0001_init.sql','0002_auditoria_integridade.sql'])await db.exec(fs.readFileSync(new URL('../supabase/migrations/'+nome,import.meta.url),'utf8'));
  const inicial={setores:['Produção','Financeiro'],areas:[{nome:'Operações',setores:['Produção']}],gestores:{gestao:['Produção']},linhas:[{id:'linha-1'}],resumoSetor:{'Produção':'Resumo fictício'},conhecimentoBase:{versao:'teste',topicos:[{id:'t1',titulo:'Tópico fictício'}]},educacao:{instrutores:{bruno:['Produção']},outraChave:{manter:true}}};
  await db.query('select pops_configurar($1)',[inicial]);
  const b=app({config:structuredClone(inicial)});
  const r=await cmd(b,'configurarCatalogo',{catalogo:{familias:{'operacao-ficticia':{nome:'Operação fictícia',cargos:['operador-ficticio']}},trilhas:{mubisys:{nome:'Sistema de gestão'}}}},admin);
  assert.equal(r.status,200);
  const {p_patch,p_anterior}=b.writes.at(-1).args;
  await db.query('select pops_configurar($1,$2)',[p_patch,p_anterior]);
  const final=(await db.query('select config from pops_config_global where id=true')).rows[0].config;
  assert.deepEqual(final,{...inicial,educacao:{...inicial.educacao,catalogo:r.body.catalogo}});
  // Instrutores trocados por outra pessoa entre a leitura e a gravação: o banco recusa.
  await db.query('select pops_configurar($1)',[{educacao:{instrutores:{}}}]);
  await assert.rejects(db.query('select pops_configurar($1,$2)',[p_patch,p_anterior]),{code:'40001'});
 }finally{await db.close();}
});

test('família ou trilha em uso por curso não sai do catálogo',async()=>{
 const b=app({rows:[row('formacoes',formacao({liberacao:{familias:['operacao-ficticia']},catalogo:{trilha:'mubisys'}}))]});
 let r=await cmd(b,'configurarCatalogo',{catalogo:{familias:{},trilhas:{mubisys:{nome:'Sistema'}}}},admin);assert.equal(r.status,409);assert.match(r.body.erro,/família operacao-ficticia/);
 r=await cmd(b,'configurarCatalogo',{catalogo:{familias:{'operacao-ficticia':{nome:'Operação',cargos:['operador-ficticio']}},trilhas:{}}},admin);assert.equal(r.status,409);assert.match(r.body.erro,/trilha mubisys/);
 r=await cmd(b,'configurarCatalogo',{catalogo:{familias:{'operacao-ficticia':{nome:'Operação renomeada',cargos:['operador-ficticio']}},trilhas:{mubisys:{nome:'Sistema'}}}},admin);assert.equal(r.status,200);
});

test('liberação por família alcança quem tem o cargo no RH e só a administração escolhe a família',async()=>{
 const cfg=configBase(),b=app({config:cfg,rows:[row('formacoes',formacao({liberacao:{pessoas:[],cargos:[],setores:[],todos:false}}))]});
 const porFamilia=formacao({liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-ficticia']}});
 assert.equal((await cmd(b,'salvarFormacao',{formacao:porFamilia,expectedRevision:1,mutationId:'fam-gestor'},gestor)).status,403);
 assert.equal((await cmd(b,'salvarFormacao',{formacao:formacao({liberacao:{familias:['familia-inexistente']}}),expectedRevision:1,mutationId:'fam-inexistente'},admin)).status,409);
 assert.equal((await cmd(b,'salvarFormacao',{formacao:formacao({liberacao:{familias:'operacao-ficticia'}}),expectedRevision:1,mutationId:'fam-texto'},admin)).status,400);
 let r=await cmd(b,'salvarFormacao',{formacao:porFamilia,expectedRevision:1,mutationId:'fam-admin'},admin);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.liberacao.familias,['operacao-ficticia']);
 assert.equal((await cmd(b,'painel')).body.formacoes[0].liberada,true);
 assert.equal((await registrar(b,{etapaId:'aula1',evento:'leitura'})).status,200);
 assert.equal((await cmd(b,'painel',{},{sub:'bruno'})).body.formacoes.length,0);
 assert.equal((await registrar(b,{etapaId:'aula1',evento:'leitura'},{sub:'bruno'})).status,403);
 assert.deepEqual((await cmd(b,'painel',{},admin)).body.formacoes[0].pessoasLiberadas,['rh1']);
 // O gestor do setor salva o curso mantendo a família escolhida pela administração.
 r=await cmd(b,'salvarFormacao',{formacao:porFamilia,expectedRevision:2,mutationId:'fam-gestor-mantem'},gestor);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.liberacao.familias,['operacao-ficticia']);
 // Tela antiga, que não conhece o campo, não apaga a família.
 const antiga=formacao({liberacao:{pessoas:[],cargos:[],setores:[],todos:false}});
 r=await cmd(b,'salvarFormacao',{formacao:antiga,expectedRevision:3,mutationId:'fam-tela-antiga'},admin);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.liberacao.familias,['operacao-ficticia']);
 // A família acompanha o catálogo: cargo incluído passa a receber, sem editar o curso.
 cfg.educacao.catalogo.familias['operacao-ficticia'].cargos.push('designer-ficticio');
 assert.equal((await cmd(b,'painel',{},{sub:'bruno'})).body.formacoes[0].liberada,true);
 r=await cmd(b,'salvarFormacao',{formacao:{...antiga,liberacao:{...antiga.liberacao,familias:[]}},expectedRevision:r.body.revision,mutationId:'fam-vazia'},admin);
 assert.equal(r.status,200);assert.equal(r.body.registro.liberacao.familias,undefined);
});

test('material só recebe público por família pela administração',async()=>{
 const b=app();
 const material={id:'mat1',tipo:'texto',titulo:'Material fictício',versao:'1',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página fictícia'],publicada:true,ativa:true,liberacao:{pessoas:[],cargos:[],setores:[],familias:['operacao-ficticia']}};
 assert.equal((await cmd(b,'academia.salvarMaterial',{material,expectedRevision:0,mutationId:'mat-gestor'},gestor)).status,403);
 const r=await cmd(b,'academia.salvarMaterial',{material,expectedRevision:0,mutationId:'mat-admin'},admin);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.liberacao.familias,['operacao-ficticia']);
 assert.equal((await cmd(b,'academia.biblioteca')).body.materiais.length,1);
 assert.equal((await cmd(b,'academia.biblioteca',{},{sub:'bruno'})).body.materiais.length,0);
});

test('gestão recebe todos os cargos e as vagas vivas do RH, sem pessoa, salário nem candidato',async()=>{
 const b=app();
 const r=await cmd(b,'painel',{},admin);assert.equal(r.status,200);
 const {cargosRH,vagasRH,catalogo}=r.body.gestao;
 assert.deepEqual(cargosRH.map(c=>c.id).sort(),['analista-ficticio','cargo-vago-ficticio','designer-ficticio','operador-ficticio']);
 for(const c of cargosRH)assert.deepEqual(Object.keys(c),['id','nome','areaId','area','trilha','familias']);
 assert.deepEqual(cargosRH.find(c=>c.id==='operador-ficticio'),{id:'operador-ficticio',nome:'Operador fictício',areaId:'area-producao',area:'Produção fictícia',trilha:'Produção / Operação',familias:['operacao-ficticia']});
 assert.deepEqual(vagasRH.map(v=>v.id),['v1','v3']);
 for(const v of vagasRH)assert.deepEqual(Object.keys(v),['id','titulo','cargoId','areaId','area','status','nivelId']);
 assert.deepEqual(vagasRH[0],{id:'v1',titulo:'Vaga aberta fictícia',cargoId:'designer-ficticio',areaId:'area-producao',area:'Produção fictícia',status:'Aberta',nivelId:'N1'});
 assert.equal(vagasRH[1].cargoId,'');
 const texto=JSON.stringify({cargosRH,vagasRH});
 for(const proibido of ['faixas','salario','999','Candidato','Requisitos internos','Descrição interna','Ana Fictícia'])assert.equal(texto.includes(proibido),false,proibido);
 assert.deepEqual(catalogo,r.body.catalogo);assert.equal(catalogo.familias['operacao-ficticia'].nome,'Operação fictícia');
 const rh=b.queries.filter(q=>q.table==='registros');
 assert.equal(rh.some(q=>q.eqs.some(([k,v])=>k==='colecao'&&v==='candidatos')),false);
 for(const q of rh)assert.equal(/faixas|salario|(^|,)\s*registro\s*(,|$)/.test(q.select),false,q.select);
 // Nenhuma das vagas deste cenário tem divulgação interna: ficam com a administração.
 const g=await cmd(b,'painel',{},gestor);assert.equal(g.body.gestao.cargosRH.length,4);assert.equal(g.body.gestao.vagasRH.length,0);
 const e=await cmd(b,'painel');assert.equal(e.body.gestao.cargosRH,undefined);assert.equal(e.body.gestao.vagasRH,undefined);assert.equal(e.body.gestao.catalogo,undefined);
 assert.equal(e.body.catalogo.trilhas.mubisys.nome,'Sistema de gestão');
});

test('painel lê cada material, fonte e cadastro do RH uma vez por chamada',async()=>{
 // Limite anterior 18; duas consultas adicionais são plano pessoal e equipes do PCP.
 const fonte={tipo:'treinamento',refId:'t1',versao:'1',oficialConfirmado:true,conferidoPor:'admin',conferidoEm:'2026-10-01T00:00:00Z'};
 const passo=i=>etapa('e'+i,'cultura',{materiais:[{id:'m1',versao:'1'}],fontes:[fonte]});
 const tables=tabelas();tables.acesso_conta.push({id:'acc0',usuario:'admin',ativo:true,colaborador_id:'rh4'});tables.acesso_papel.push({conta_id:'acc0',sistema:'pops',login:'admin',ativo:true,papel:'admin'});
 const rows=[...Array.from({length:4},(_,i)=>row('formacoes',formacao({id:'f'+i,etapas:[passo(1),passo(2),passo(3)]}))),row('materiais',{id:'m1',versao:'1',publicada:true,ativa:true,setor:'Produção'}),row('treinamentos',{id:'t1',versao:'1'})];
 const b=app({tables,rows});
 const r=await cmd(b,'painel',{},admin);assert.equal(r.status,200);assert.equal(r.body.formacoes.length,4);
 assert.equal(r.body.formacoes.every(f=>f.etapas.every(e=>e.statusFonte==='disponivel')),true);
 assert.ok(b.queries.length<=20,'consultas: '+b.queries.length);
 for(const c of ['colaboradores','areas','cargos','vagas'])assert.equal(lidoRH(b,c),1,c);
 const porId=id=>b.queries.filter(q=>q.table==='pops_registros'&&q.eqs.some(([k,v])=>k==='id'&&v===id)).length;
 assert.equal(porId('m1'),1);assert.equal(porId('t1'),1);
 assert.equal(b.queries.filter(q=>q.table==='pops_config_global').length,1);
});

test('cadastro do RH vale 60 s na instância, sem dado de quem chama, e renova ao gravar a configuração',async()=>{
 const tables=tabelas(),b=app({tables});
 await cmd(b,'painel',{},admin);assert.equal(lidoRH(b,'colaboradores'),1);
 // Cargo criado agora no RH aparece em até 60 s, nunca depois.
 tables.registros.push(row('cargos',{id:'cargo-novo-ficticio',nome:'Cargo novo fictício',areaId:'area-adm'}));
 const ana=await cmd(b,'painel');assert.equal(lidoRH(b,'colaboradores'),1);assert.equal(ana.body.gestao.cargosRH,undefined);
 let a=await cmd(b,'painel',{},admin);assert.equal(a.body.gestao.cargosRH.some(c=>c.id==='cargo-novo-ficticio'),false);
 b.avancar(61_000);
 a=await cmd(b,'painel',{},admin);assert.equal(lidoRH(b,'colaboradores'),2);assert.equal(a.body.gestao.cargosRH.some(c=>c.id==='cargo-novo-ficticio'),true);
 assert.equal((await cmd(b,'configurarCatalogo',{catalogo:{familias:{'operacao-ficticia':{nome:'Operação',cargos:['operador-ficticio','cargo-novo-ficticio']}},trilhas:{mubisys:{nome:'Sistema'}}}},admin)).status,200);
 await cmd(b,'painel',{},admin);assert.equal(lidoRH(b,'colaboradores'),3);
 // Contas da Central não entram no cache da instância: uma leitura por painel.
 assert.equal(b.queries.filter(q=>q.table==='acesso_conta'&&q.range).length,5);
});

test('leitura do RH que falha não fica guardada no cache',async()=>{
 const tables=tabelas(),b=app({tables});
 const original=tables.registros;tables.registros={filter(){throw new Error('RH fora do ar');}};
 assert.equal((await cmd(b,'painel',{},admin)).status,500);
 tables.registros=original;
 const r=await cmd(b,'painel',{},admin);assert.equal(r.status,200);assert.equal(r.body.gestao.cargosRH.length,4);
});

test('biblioteca consulta as formações uma vez, não uma por material',async()=>{
 // Antes: 5 leituras de formações para 5 materiais (19 consultas); agora 1 (15).
 const mats=Array.from({length:5},(_,i)=>row('materiais',{id:'m'+i,titulo:'Material '+i,tipo:'texto',versao:'1',publicada:true,ativa:true,setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página fictícia']}));
 const b=app({rows:[...mats,row('formacoes',formacao({etapas:[etapa('aula1','aula',{materiais:mats.map(m=>({id:m.id,versao:'1'}))})]}))]});
 const r=await cmd(b,'academia.biblioteca');assert.equal(r.status,200);assert.equal(r.body.materiais.length,5);
 assert.equal(b.queries.filter(q=>q.table==='pops_registros'&&q.eqs.some(([k,v])=>k==='colecao'&&v==='formacoes')).length,1);
});

// ───── Correções da revisão de 14/10 (servidor) ─────
const materialFicticio=(extra={})=>({id:'mat1',tipo:'texto',titulo:'Material fictício',versao:'1',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página fictícia'],publicada:true,ativa:true,liberacao:{pessoas:[],cargos:[],setores:[],todos:false},...extra});

test('catálogo lido pela tela: dado antigo não grava por cima de outra administração e reenvio igual não regrava',async()=>{
 const config=configBase(),b=app({config});
 // A administração 1 abre a Matriz; a administração 2 grava logo depois.
 const lido=structuredClone((await cmd(b,'painel',{},admin)).body.catalogo);
 const da2={familias:{'operacao-ficticia':{nome:'Operação fictícia',cargos:['operador-ficticio','designer-ficticio']},'design-ficticio':{nome:'Design fictício',cargos:['designer-ficticio']}},trilhas:lido.trilhas};
 let r=await cmd(b,'configurarCatalogo',{catalogo:da2,catalogoAnterior:lido},{sub:'admin2',papel:'admin'});
 assert.equal(r.status,200);config.educacao.catalogo=r.body.catalogo;// o sandbox não grava a configuração
 // A administração 1 só acrescenta uma trilha, com a tela antiga: 409, nada gravado.
 const escritas=b.writes.length;
 r=await cmd(b,'configurarCatalogo',{catalogo:{familias:lido.familias,trilhas:{...lido.trilhas,'trilha-nova':{nome:'Trilha nova fictícia'}}},catalogoAnterior:lido},admin);
 assert.equal(r.status,409);assert.match(r.body.erro,/O catálogo mudou desde que você abriu esta tela/);assert.equal(b.writes.length,escritas);
 assert.deepEqual(config.educacao.catalogo.familias['operacao-ficticia'].cargos,['operador-ficticio','designer-ficticio']);
 // Lendo de novo, a mesma alteração passa e conserva o que a outra pessoa gravou.
 const atual=structuredClone((await cmd(b,'painel',{},admin)).body.catalogo);
 const pedido={catalogo:{familias:atual.familias,trilhas:{...atual.trilhas,'trilha-nova':{nome:'Trilha nova fictícia'}}},catalogoAnterior:atual};
 r=await cmd(b,'configurarCatalogo',pedido,admin);
 assert.equal(r.status,200);assert.deepEqual(Object.keys(r.body.catalogo.familias).sort(),['design-ficticio','operacao-ficticia']);assert.ok(r.body.catalogo.trilhas['trilha-nova']);
 config.educacao.catalogo=r.body.catalogo;
 // Resposta perdida: o reenvio do mesmo pedido devolve o gravado, sem 409 e sem gravar.
 const antes=b.writes.length;r=await cmd(b,'configurarCatalogo',pedido,admin);
 assert.equal(r.status,200);assert.equal(r.body.repetido,true);assert.equal(b.writes.length,antes);
 // Catálogo lido malformado é recusado; tela antiga, sem o campo, segue como antes.
 assert.equal((await cmd(b,'configurarCatalogo',{catalogo:da2,catalogoAnterior:[]},admin)).status,400);
 assert.equal((await cmd(b,'configurarCatalogo',{catalogo:da2},admin)).status,200);
});

test('gestor vê só as vagas divulgadas e abertas; prevista e não divulgada ficam com a administração',async()=>{
 const tables=tabelas();
 tables.registros.push(
  row('vagas',{id:'v5',titulo:'Substituição planejada fictícia',cargoId:'operador-ficticio',status:'Prevista',divulgacaoInterna:false}),
  row('vagas',{id:'v6',titulo:'Vaga não divulgada fictícia',cargoId:'operador-ficticio',status:'Aberta',divulgacaoInterna:false}),
  row('vagas',{id:'v7',titulo:'Vaga do mural fictícia',cargoId:'designer-ficticio',status:'Aberta',divulgacaoInterna:true}),
  // O ->> do banco devolve texto: 'true' também vale.
  row('vagas',{id:'v8',titulo:'Vaga em triagem fictícia',cargoId:'designer-ficticio',status:'Em triagem',divulgacaoInterna:'true'}),
  row('vagas',{id:'v9',titulo:'Prevista divulgada fictícia',status:'Prevista',divulgacaoInterna:true}));
 const b=app({tables});
 const g=await cmd(b,'painel',{},gestor);
 assert.deepEqual(g.body.gestao.vagasRH.map(v=>v.id),['v7','v8']);
 for(const v of g.body.gestao.vagasRH)assert.deepEqual(Object.keys(v),['id','titulo','cargoId','areaId','area','status','nivelId']);
 for(const proibido of ['Substituição planejada','Vaga não divulgada','Prevista'])assert.equal(JSON.stringify(g.body).includes(proibido),false,proibido);
 const a=await cmd(b,'painel',{},admin);
 assert.deepEqual(a.body.gestao.vagasRH.map(v=>v.id).sort(),['v1','v3','v5','v6','v7','v8','v9']);
 assert.ok(b.queries.some(q=>q.table==='registros'&&q.eqs.some(([k,v])=>k==='colecao'&&v==='vagas')&&/divulgacaoInterna:registro->>divulgacaoInterna/.test(q.select)));
 assert.equal((await cmd(b,'painel')).body.gestao.vagasRH,undefined);
});

test('famílias: null vale como ausente, e o gestor não apaga a liberação por família do curso nem do material',async()=>{
 const b=app({rows:[row('formacoes',formacao({liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-ficticia']}})),row('materiais',materialFicticio({liberacao:{pessoas:[],cargos:[],setores:[],todos:false,familias:['operacao-ficticia']}}))]});
 const semFamilia=familias=>({pessoas:[],cargos:[],setores:[],todos:false,familias});
 let r=await cmd(b,'salvarFormacao',{formacao:formacao({liberacao:semFamilia(null)}),expectedRevision:1,mutationId:'fam-null-gestor'},gestor);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.liberacao.familias,['operacao-ficticia']);
 assert.equal((await cmd(b,'painel')).body.formacoes[0].liberada,true,'Quem tem o cargo da família continua recebendo');
 // Com a lista vazia, a recusa de antes continua.
 assert.equal((await cmd(b,'salvarFormacao',{formacao:formacao({liberacao:semFamilia([])}),expectedRevision:r.body.revision,mutationId:'fam-vazia-gestor'},gestor)).status,403);
 r=await cmd(b,'academia.salvarMaterial',{material:materialFicticio({liberacao:semFamilia(null)}),expectedRevision:1,mutationId:'mat-null-gestor'},gestor);
 assert.equal(r.status,200);assert.deepEqual(r.body.registro.liberacao.familias,['operacao-ficticia']);
 // A administração continua retirando com a lista vazia.
 r=await cmd(b,'salvarFormacao',{formacao:formacao({liberacao:semFamilia([])}),expectedRevision:2,mutationId:'fam-vazia-admin'},admin);
 assert.equal(r.status,200);assert.equal(r.body.registro.liberacao.familias,undefined);
});

test('gestor salva curso e material liberados para todos sem mexer no público, mas não liga "todos"',async()=>{
 const todos=v=>({pessoas:[],cargos:[],setores:[],todos:v});
 const b=app({rows:[row('formacoes',formacao({liberacao:todos(true)})),row('formacoes',formacao({id:'f2',liberacao:todos(false)})),row('materiais',materialFicticio({liberacao:todos(true)})),row('materiais',materialFicticio({id:'mat2',liberacao:todos(false)}))]});
 // Corrige um texto (versão nova) e salva com o "todos" herdado.
 const revisto=formacao({liberacao:todos(true),versao:'2'});revisto.etapas[0].titulo='Etapa revista';
 let r=await cmd(b,'salvarFormacao',{formacao:revisto,expectedRevision:1,mutationId:'todos-mantem'},gestor);
 assert.equal(r.status,200);assert.equal(r.body.registro.liberacao.todos,true);assert.equal(r.body.registro.versao,'2');
 assert.equal(r.body.registro.atribuicoesAnteriores.length,0,'Público igual não abre atribuição nova');
 assert.equal((await cmd(b,'painel',{},{sub:'bruno'})).body.formacoes.find(f=>f.id==='f1').liberada,true);
 // Ligar "todos" continua sendo da administração.
 r=await cmd(b,'salvarFormacao',{formacao:formacao({id:'f2',liberacao:todos(true)}),expectedRevision:1,mutationId:'todos-liga'},gestor);
 assert.equal(r.status,403);assert.match(r.body.erro,/Somente a administração/);
 r=await cmd(b,'academia.salvarMaterial',{material:materialFicticio({liberacao:todos(true)}),expectedRevision:1,mutationId:'mat-todos-mantem'},gestor);
 assert.equal(r.status,200);assert.equal(r.body.registro.liberacao.todos,true);
 assert.equal((await cmd(b,'academia.salvarMaterial',{material:materialFicticio({id:'mat2',liberacao:todos(true)}),expectedRevision:1,mutationId:'mat-todos-liga'},gestor)).status,403);
 // Retirar "todos" continua permitido ao gestor do setor.
 r=await cmd(b,'salvarFormacao',{formacao:{...revisto,liberacao:{...todos(false),pessoas:['rh1']}},expectedRevision:2,mutationId:'todos-retira'},gestor);
 assert.equal(r.status,200);assert.equal(r.body.registro.liberacao.todos,false);
});

test('curso que deixou de ser liberado fica na trilha certa do catálogo, sem recomendados, e o bloqueio fala em curso',async()=>{
 const b=app({rows:[row('formacoes',formacao({id:'f0',titulo:'Fundamentos fictícios'})),row('formacoes',formacao({catalogo:{trilha:'mubisys',ordem:3,area:'Comercial',preRequisitos:['f0']}}))]});
 assert.equal((await registrar(b,{etapaId:'aula1',evento:'leitura'})).status,200);
 const atual=(await cmd(b,'painel',{},admin)).body.formacoes.find(f=>f.id==='f1');
 assert.equal((await cmd(b,'salvarFormacao',{formacao:{...atual,liberacao:{pessoas:[],cargos:[],setores:[],todos:false}},expectedRevision:1,mutationId:'retira-ana'},admin)).status,200);
 const f=(await cmd(b,'painel')).body.formacoes.find(x=>x.id==='f1');
 assert.equal(f.somenteHistorico,true);assert.deepEqual(f.catalogo,{trilha:'mubisys',ordem:3});
 assert.equal(f.etapas[0].motivoBloqueio,'Este curso não está mais liberado para você. Seu histórico continua preservado em Meu histórico.');
});

test('mensagens do servidor falam curso e aula, sem jornada, formação nem etapa',async()=>{
 const b=app({rows:[row('formacoes',formacao({id:'f9',setor:'Financeiro',liberacao:{pessoas:[],cargos:[],setores:[],todos:false}}))]});
 const erros=[];
 const pedir=async(...a)=>{const r=await cmd(...a);assert.ok(r.status>=400,JSON.stringify(r.body));erros.push(r.body.erro);return r;};
 await pedir(b,'salvarFormacao',{formacao:formacao({id:'f-nova',etapas:[etapa('a1','aula',{obrigatoria:false})]}),expectedRevision:0,mutationId:'sem-obrigatoria'},admin);
 assert.equal(erros.at(-1),'Defina pelo menos uma aula obrigatória para concluir o curso.');
 await pedir(b,'salvarFormacao',{formacao:formacao({id:'f-nova',etapas:[]}),expectedRevision:0,mutationId:'sem-aula'},admin);
 await pedir(b,'salvarFormacao',{formacao:formacao({id:'f9',setor:'Financeiro'}),expectedRevision:1,mutationId:'outro-setor'},gestor);
 await pedir(b,'salvarFormacao',{formacao:formacao({id:'f-nova',etapas:[etapa('a1'),etapa('a1')]}),expectedRevision:0,mutationId:'repetida'},admin);
 await pedir(b,'salvarFormacao',{formacao:formacao({id:'f-nova',etapas:[etapa('a1','aula',{prerequisitos:['a2']}),etapa('a2')]}),expectedRevision:0,mutationId:'ordem'},admin);
 await pedir(b,'salvarFormacao',{formacao:formacao({id:'f-nova',catalogo:'texto'}),expectedRevision:0,mutationId:'catalogo-texto'},admin);
 await pedir(b,'salvarFormacao',{formacao:formacao({id:'f-nova',prazo:'amanhã'}),expectedRevision:0,mutationId:'prazo'},admin);
 await pedir(b,'registrar',{formacaoId:'f9',formacaoVersao:'1',etapaId:'aula1',evento:'leitura',mutationId:'nao-liberada'});
 await pedir(b,'registrar',{formacaoId:'inexistente',formacaoVersao:'1',etapaId:'aula1',evento:'leitura',mutationId:'inexistente'});
 for(const m of erros)assert.doesNotMatch(m,/jornada|forma[cç][aã]o|etapa/i,m);
});

test('salvar sem resumo e palavras-chave (editor que não os mostra) conserva os que o pacote gravou',async()=>{
 const b=app();const cat={trilha:'mubisys',area:'Comercial',resumo:'Resumo fictício',palavrasChave:['cnc']};
 let r=await cmd(b,'salvarFormacao',{formacao:formacao({catalogo:cat}),expectedRevision:0,mutationId:'cat-res-1'},admin);assert.equal(r.status,200);
 r=await cmd(b,'salvarFormacao',{formacao:formacao({prazo:'2026-12-01',catalogo:{trilha:'mubisys',area:'Comercial'}}),expectedRevision:r.body.revision,mutationId:'cat-res-2'},admin);
 assert.equal(r.status,200);assert.equal(r.body.registro.catalogo.resumo,'Resumo fictício');assert.deepEqual(r.body.registro.catalogo.palavrasChave,['cnc']);
 // Mandar vazio de propósito apaga.
 r=await cmd(b,'salvarFormacao',{formacao:formacao({prazo:'2026-12-01',catalogo:{trilha:'mubisys',area:'Comercial',resumo:'',palavrasChave:[]}}),expectedRevision:r.body.revision,mutationId:'cat-res-3'},admin);
 assert.equal(r.status,200);assert.equal(r.body.registro.catalogo.resumo,undefined);assert.equal(r.body.registro.catalogo.palavrasChave,undefined);
});
