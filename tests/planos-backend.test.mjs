import test from 'node:test';
import assert from 'node:assert/strict';
import {backend,jwtAluno} from './helpers.mjs';
const row=(colecao,registro,revision=1)=>({colecao,id:registro.id,registro,revision,apagado:false});
const course=(id='f1',extra={})=>({id,titulo:'Curso fictício '+id,versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:[]},etapas:[{id:'e1',titulo:'Aula fictícia',tipo:'aula',obrigatoria:true,conteudo:{aprender:'Exemplo',comoFazer:'Exemplo fictício',importancia:'Aplicação fictícia',erros:'Erro fictício',evidencia:'Reflexão fictícia'},quiz:[],pontos:10,fontes:[],documentos:[],prerequisitos:[]}],...extra});
const team={id:'equipe-a',nome:'Equipe fictícia',ativo:true,membros:[{chave:'900001'},{chave:'rh2'},{chave:'Pessoa sem ID'}]};
const tables=()=>({registros:[row('colaboradores',{id:'rh1',nome:'Ana fictícia',idPessoa:'900001',setor:'Produção'}),row('colaboradores',{id:'rh2',nome:'Bruno fictício',idPessoa:'900002',setor:'Produção'}),row('colaboradores',{id:'rh3',nome:'Pessoa sem ID',setor:'Produção'})],acesso_conta:[{id:'a1',usuario:'ana',ativo:true,colaborador_id:'rh1'},{id:'a2',usuario:'bruno',ativo:true,colaborador_id:'rh2'}],acesso_papel:[{conta_id:'a1',sistema:'pops',ativo:true},{conta_id:'a2',sistema:'pops',ativo:true}],pcp_config_global:[{id:true,config:{performancePCP:{equipes:[structuredClone(team)]}}}]});
const plan=(extra={})=>({colaboradorId:'rh1',titulo:'Jornada fictícia',objetivo:'Desenvolver uma habilidade',equipeId:'equipe-a',itens:[{formacaoId:'f1',prazo:'2028-02-29',contexto:'flexivel',orientacao:'Refletir sobre o exemplo'}],ativa:true,...extra});
const app=(opts={})=>backend({tables:tables(),rows:[row('formacoes',course()),row('formacoes',course('f2',{liberacao:{pessoas:['rh1']}}))],persistWrites:true,...opts});
const admin={sub:'admin',papel:'admin'};
const cmd=(b,operacao,args={},who={})=>b.call({action:'escola',operacao,...args},who);
const save=(b,plano=plan(),args={})=>cmd(b,'salvarPlano',{plano,expectedRevision:0,mutationId:'plano-1',...args},admin);

test('admin salva plano pessoal e liberação por plano alcança somente a pessoa e cursos publicados',async()=>{
 const b=app();const r=await save(b);assert.equal(r.status,200);assert.equal(r.body.registro.colaboradorId,'rh1');assert.ok(r.body.registro.id);assert.equal(r.body.registro.atualizadoPor,'admin');
 const a=await cmd(b,'painel');assert.equal(a.body.planoPessoal.id,r.body.registro.id);assert.equal(a.body.formacoes.find(f=>f.id==='f1').liberadaParaMim,true);assert.equal(a.body.formacoes.find(f=>f.id==='f2').liberadaParaMim,true);
 const other=await cmd(b,'painel',{}, {sub:'bruno'});assert.equal(other.body.planoPessoal,null);assert.equal(other.body.formacoes.some(f=>f.id==='f1'),false);assert.deepEqual(other.body.gestao.planos,[]);
 const student=await b.call({action:'escola',operacao:'painel'},{},{token:jwtAluno()});assert.equal(student.status,200);assert.equal(student.body.planoPessoal.id,r.body.registro.id);assert.deepEqual(student.body.gestao.equipesTrabalho,[]);assert.equal(student.body.gestao.podeMontarJornada,false);
});
test('equipes do PCP mapeiam somente identificadores exatos, sem nomes ou dados sensíveis',async()=>{
 const b=app();const r=await cmd(b,'painel',{},admin);assert.equal(r.status,200);assert.equal(r.body.gestao.podeMontarJornada,true);assert.deepEqual(r.body.gestao.equipesTrabalho,[{id:'equipe-a',nome:'Equipe fictícia',colaboradorIds:['rh1','rh2']}]);
 assert.deepEqual((await cmd(b,'painel')).body.equipeTrabalho,{estado:'vinculada',id:'equipe-a',nome:'Equipe fictícia'});assert.equal(JSON.stringify(r.body).includes('900001'),false);
 const q=b.queries.find(q=>q.table==='pcp_config_global');assert.equal(q.select,'equipes:config->performancePCP->equipes');
});
test('equipes ambiguas, inativas e IDs bloqueados não autorizam associação',async()=>{
 for(const mutate of [t=>t.registros.push(row('colaboradores',{id:'dup',idPessoa:'900001'})),t=>t.registros[0].registro.idPessoaBloqueado=true,t=>t.pcp_config_global[0].config.performancePCP.equipes[0].ativo=false]){const t=tables();mutate(t);const b=app({tables:t});assert.equal((await save(b)).status,409);assert.equal(b.writes.filter(w=>w.rpc==='pops_gravar').length,0);}
 const t=tables();t.pcp_config_global[0].config.performancePCP.equipes.push({...team,id:'equipe-b'});assert.equal((await cmd(app({tables:t}),'painel')).body.equipeTrabalho.estado,'multipla');
 assert.equal((await save(app(),plan({equipeId:'nao-existe'}))).status,409);assert.equal((await save(app(),plan({colaboradorId:'rh3'}))).status,409);
});
test('salvar plano é exclusivo da administração e exige RH ativo consultado novamente',async()=>{
 for(const who of [{},{sub:'admin',papel:'gestor'}])assert.equal((await cmd(app(),'salvarPlano',{plano:plan(),expectedRevision:0,mutationId:'x'},who)).status,403);
 const t=tables(),b=app({tables:t});await cmd(b,'painel',{},admin);t.registros[0].registro.dataDesligamento='2026-10-20';assert.equal((await save(b)).status,409);
});
test('validação de plano recusa curso ausente, rascunho, inativo, duplicado, data impossível e campos extras',async()=>{
 for(const f of [null,course('f1',{publicada:false}),course('f1',{ativa:false})])assert.equal((await save(app({rows:f?[row('formacoes',f)]:[]}))).status,409);
 const good=plan();for(const p of [plan({itens:[good.itens[0],good.itens[0]]}),plan({itens:[{...good.itens[0],prazo:'2026-02-29'}]}),plan({itens:[{...good.itens[0],contexto:'livre'}]}),plan({pontos:999}),plan({titulo:'x'.repeat(161)}),plan({itens:[{...good.itens[0],aprovado:true}]})])assert.equal((await save(app(),p)).status,400);
});
test('reenvio idêntico preserva revisão; comando reaproveitado e concorrência não sobrescrevem',async()=>{
 const b=app(),a=await save(b);assert.equal(a.status,200);const r=await save(b);assert.equal(r.status,200);assert.equal(r.body.revision,a.body.revision);assert.equal(r.body.repetido,true);
 assert.equal((await save(b,plan({titulo:'Outro título'}))).status,409);assert.equal((await save(b,plan(),{mutationId:'m2'})).status,409);
 const edit=await save(b,{...plan(),id:a.body.registro.id,titulo:'Atualizado'},{mutationId:'m2',expectedRevision:a.body.revision});assert.equal(edit.status,200);assert.equal(edit.body.revision,a.body.revision+1);
});
test('inativar plano preserva pontos e histórico e não revoga concessões anteriores do curso',async()=>{
 const b=app(),p=await save(b);assert.equal(p.status,200);const a=await cmd(b,'registrar',{formacaoId:'f1',formacaoVersao:'1',etapaId:'e1',evento:'leitura',mutationId:'a1'});assert.equal(a.status,200,JSON.stringify(a.body));assert.equal(a.body.registro.pontos,10);
 assert.equal((await save(b,plan({ativa:false}),{mutationId:'off',expectedRevision:p.body.revision})).status,200);
 const r=await cmd(b,'painel');assert.equal(r.body.planoPessoal,null);assert.equal(r.body.aprendizagem[0].pontos,10);assert.equal(r.body.formacoes.find(f=>f.id==='f1').somenteHistorico,true);assert.equal(r.body.formacoes.find(f=>f.id==='f2').liberadaParaMim,true);
 assert.equal((await cmd(b,'registrar',{formacaoId:'f1',formacaoVersao:'1',etapaId:'e1',evento:'leitura',mutationId:'a2'})).status,403);
});
test('planos ficam fora das portas genéricas mas entram no backup de serviço',async()=>{
 const b=app();assert.equal((await save(b)).status,200);
 for(const action of ['list','get','upsert','delete','restore'])assert.equal((await b.call({action,colecao:'planos_aprendizagem',id:'x',registro:{id:'x'}},admin)).status,400);
 assert.equal((await b.call({action:'list'},admin)).body.registros.some(r=>r._col==='planos_aprendizagem'),false);
 const backup=await b.call({action:'list'},{},{semCracha:true,xToken:'maquina-ficticia'});assert.equal(backup.body.registros.filter(r=>r._col==='planos_aprendizagem').length,1);
});
test('plano libera apenas materiais publicados na versão referenciada pelo curso',async()=>{
 const f=course();f.etapas[0].materiais=[{id:'m1',versao:'1'},{id:'m2',versao:'1'},{id:'m3',versao:'1'}];
 const mat=(id,extra={})=>row('materiais',{id,titulo:id,tipo:'youtube',youtubeId:'abcdefghijk',versao:'1',publicada:true,ativa:true,liberacao:{},...extra});
 const b=app({rows:[row('formacoes',f),mat('m1'),mat('m2',{publicada:false}),mat('m3',{versao:'2'}),mat('m4')]});assert.equal((await save(b)).status,200);
 for(const [mid,status] of [['m1',200],['m2',403],['m3',403],['m4',403]])assert.equal((await cmd(b,'academia.abrirMaterial',{materialId:mid})).status,status);
});

test('equipe indisponível não derruba painel nem impede plano sem equipe',async()=>{
 const t=tables();t.pcp_config_global={filter(){throw new Error('PCP fora do ar');}};const b=app({tables:t});
 const r=await cmd(b,'painel');assert.equal(r.status,200);assert.equal(r.body.equipeTrabalho.estado,'indisponivel');assert.equal((await save(b,plan({equipeId:''}))).status,200);assert.equal((await save(app({tables:t}))).status,409);
});
test('inativação permite revogar plano quando curso ou equipe de origem deixou de estar disponível',async()=>{
 const t=tables(),rows=[row('formacoes',course())],b=app({tables:t,rows});const a=await save(b);assert.equal(a.status,200);rows[0].registro.publicada=false;t.pcp_config_global[0].config.performancePCP.equipes[0].ativo=false;
 assert.equal((await save(b,plan({ativa:false}),{expectedRevision:a.body.revision,mutationId:'desativar'})).status,200);assert.equal((await cmd(b,'painel')).body.planoPessoal,null);
});
test('mutação antiga após uma edição posterior e autoria diferente não geram confirmação enganosa',async()=>{
 const b=app(),a=await save(b);const second=await save(b,plan({titulo:'Segundo envio'}),{expectedRevision:a.body.revision,mutationId:'segundo'});assert.equal(second.status,200);assert.equal((await save(b)).status,409);
 assert.equal((await cmd(b,'salvarPlano',{plano:plan({titulo:'Segundo envio'}),expectedRevision:a.body.revision,mutationId:'segundo'},{papel:'admin',sub:'outro-admin'})).status,409);
});
test('ID RH anterior explícito vale; identificação bloqueada e somente nome nunca valem',async()=>{
 const t=tables();t.registros[0].registro.idPessoa='900009';t.registros[0].registro.idPessoaAnteriores=['900001'];const b=app({tables:t});assert.equal((await save(b)).status,200);
 const t2=tables();delete t2.registros[0].registro.idPessoa;t2.pcp_config_global[0].config.performancePCP.equipes[0].membros=[{chave:'Ana fictícia'}];assert.equal((await save(app({tables:t2}))).status,409);
});

test('motivo textual de bloqueio do RH impede vínculo e IDs anteriores serializados são resolvidos explicitamente',async()=>{
 const t=tables();t.registros[0].registro.idPessoaBloqueado='id-de-outra-pessoa';assert.equal((await save(app({tables:t}))).status,409);
 const t2=tables();t2.registros[0].registro.idPessoa='900009';t2.registros[0].registro.idPessoaAnteriores='["900001"]';assert.equal((await save(app({tables:t2}))).status,200);
});

test('gestor acompanha concessão por plano antes do primeiro avanço sem receber plano alheio ou pessoas fora do setor',async()=>{
 const t=tables();t.registros[2].registro.setor='Financeiro';
 const b=app({tables:t,config:{gestores:{bruno:['Produção']}}});
 assert.equal((await save(b,plan({titulo:'Título reservado da pessoa',objetivo:'Objetivo pessoal reservado'}))).status,200);
 assert.equal((await save(b,plan({colaboradorId:'rh3',equipeId:'',titulo:'Título reservado de outro setor'}),{mutationId:'fora-do-setor'})).status,200);
 const antes=await cmd(b,'painel',{},admin);assert.deepEqual(antes.body.formacoes.find(f=>f.id==='f1').pessoasLiberadas,['rh1','rh3']);
 const from=b.queries.length;
 const g=await cmd(b,'painel',{}, {sub:'bruno',papel:'gestor'});assert.equal(g.status,200);
 assert.deepEqual(g.body.formacoes.find(f=>f.id==='f1').pessoasLiberadas,['rh1']);
 assert.equal(g.body.formacoes.find(f=>f.id==='f1').liberadaParaMim,false);
 assert.equal(g.body.gestao.pessoas.some(p=>p.colaboradorId==='rh1'),true);assert.equal(g.body.gestao.pessoas.some(p=>p.colaboradorId==='rh3'),false);
 assert.deepEqual(g.body.gestao.registros,[]);assert.deepEqual(g.body.gestao.planos,[]);assert.equal(g.body.planoPessoal,null);
 assert.equal(JSON.stringify(g.body).includes('reservado'),false);
 assert.ok(b.queries.slice(from).some(q=>q.table==='pops_registros'&&q.select==='colaboradorId:registro->>colaboradorId,ativa:registro->>ativa,itens:registro->itens'));
 const student=await b.call({action:'escola',operacao:'painel'},{},{token:jwtAluno()});assert.equal(student.body.planoPessoal.colaboradorId,'rh1');assert.deepEqual(student.body.gestao.planos,[]);assert.equal(JSON.stringify(student.body).includes('Título reservado de outro setor'),false);
});
