import test from 'node:test';
import assert from 'node:assert/strict';
import {backend} from './helpers.mjs';
export const row=(colecao,registro)=>({colecao,id:registro.id,registro,revision:1,apagado:false});
export const tables={acesso_conta:['ana','bruno','gestao'].map(u=>({id:u,usuario:u,colaborador_id:'rh-'+u,ativo:true})),acesso_papel:['ana','bruno','gestao'].map(u=>({conta_id:u,login:u,sistema:'pops',ativo:true})),registros:['ana','bruno','gestao'].map(u=>row('colaboradores',{id:'rh-'+u,nome:u,setor:u==='bruno'?'Comercial':'Produção',cargoId:'c1'}))};
export const mat=(extra={})=>({id:'v1',tipo:'video',titulo:'Conferência',objetivo:'Conferir antes de executar',versao:'1',setor:'Produção',publicada:true,ativa:true,liberacao:{pessoas:['rh-ana']},url:'https://youtu.be/dQw4w9WgXcQ',categoria:'Rotina',...extra});
export const app=(rows=[])=>backend({tables,rows,persistWrites:true});
let seq=0;
export const cmd=(b,operacao,args={},gestor=false)=>b.call({action:'escola',operacao:'academia.'+operacao,mutationId:'academia-'+(++seq),...args},gestor?{sub:'gestao',papel:'admin'}:{});
test('gestão cadastra YouTube normalizado; aluno vê apenas vídeos liberados',async()=>{
 const b=app();let r=await cmd(b,'salvarMaterial',{material:mat(),expectedRevision:0},true);assert.equal(r.status,200);assert.equal(r.body.registro.youtubeId,'dQw4w9WgXcQ');
 r=await cmd(b,'biblioteca');assert.equal(r.body.materiais.length,1);assert.equal(r.body.materiais[0].embed,'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 const outro=await b.call({action:'escola',operacao:'academia.biblioteca'},{sub:'bruno'});assert.equal(outro.body.materiais.length,0);
});
test('rejeita URLs falsas, HTML e escrita de aluno',async()=>{
 const b=app();assert.equal((await cmd(b,'salvarMaterial',{material:mat()})).status,403);
 for(const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://youtu.be/invalid','<iframe>'])assert.equal((await cmd(b,'salvarMaterial',{material:mat({url})},true)).status,400);
});
test('abertura e estudo declarado são diferentes, identidade é RH e repetição não duplica',async()=>{
 const b=app([row('materiais',mat({youtubeId:'dQw4w9WgXcQ'}))]);
 assert.equal((await cmd(b,'registrarMaterial',{materialId:'v1',versao:'1',evento:'leitura'})).status,409);
 const open=await cmd(b,'registrarMaterial',{materialId:'v1',versao:'1',evento:'abrir',colaboradorId:'rh-bruno'});assert.equal(open.status,200);assert.equal(open.body.registro.colaboradorId,'rh-ana');assert.equal(open.body.registro.leituraEm,undefined);
 const payload={materialId:'v1',versao:'1',evento:'leitura',mutationId:'unico'};
 const read=await cmd(b,'registrarMaterial',payload);assert.equal(read.status,200);assert.ok(read.body.registro.leituraEm);assert.equal(read.body.registro.pontos,undefined);
 const retry=await cmd(b,'registrarMaterial',payload);assert.equal(retry.body.registro.eventos.length,2);
 assert.equal((await cmd(b,'registrarMaterial',{...payload,evento:'abrir'})).status,409);
 assert.equal((await cmd(b,'registrarMaterial',{materialId:'v1',versao:'antiga',evento:'abrir'})).status,409);
});
test('leitor integral guarda página por pessoa e mantém versão anterior',async()=>{
 const b=app([row('materiais',mat({tipo:'texto',url:'',paginas:['Texto integral página um','Texto integral página dois']}))]);
 let r=await cmd(b,'abrirMaterial',{materialId:'v1'});assert.deepEqual(r.body.material.paginas,['Texto integral página um','Texto integral página dois']);
 await cmd(b,'registrarMaterial',{materialId:'v1',versao:'1',evento:'abrir'});
 r=await cmd(b,'registrarMaterial',{materialId:'v1',versao:'1',evento:'pagina',pagina:2});assert.equal(r.body.registro.pagina,2);
 assert.equal((await cmd(b,'registrarMaterial',{materialId:'v1',versao:'1',evento:'pagina',pagina:9})).status,400);
 r=await cmd(b,'salvarMaterial',{material:mat({tipo:'texto',url:'',paginas:['Nova versão'],versao:'2'}),expectedRevision:1},true);assert.equal(r.status,200);assert.equal(r.body.registro.versoesAnteriores[0].paginas.length,2);
 r=await cmd(b,'biblioteca');assert.equal(r.body.estudos[0].versao,'1');
});

test('NR separa consulta, evidências e validação final por outro responsável',async()=>{
 const nr=mat({tipo:'nr',url:'https://www.gov.br/trabalho-e-emprego/pt-br',paginas:['Norma integral de demonstração'],nr:{numero:'35',fonte:'https://www.gov.br/trabalho-e-emprego/pt-br',versaoOficial:'Versão fictícia de teste',publico:'Equipe definida pelo responsável',responsavel:'gestao',requisitos:['Teoria','Prática acompanhada'],validadeMeses:12}});
 const b=app([row('materiais',nr)]);
 const pendentes=await cmd(b,'capacitacoes',{},true);assert.equal(pendentes.body.pendencias[0].situacao,'Não iniciado');
 let r=await cmd(b,'salvarCapacitacao',{materialId:'v1',colaboradorId:'rh-ana',etapas:[{titulo:'Teoria',cumprida:true,evidencia:'Avaliação teórica acompanhada'},{titulo:'Prática acompanhada',cumprida:false,evidencia:''}],concluir:true,expectedRevision:0},true);assert.equal(r.status,409);
 r=await cmd(b,'salvarCapacitacao',{materialId:'v1',colaboradorId:'rh-ana',etapas:[{titulo:'Teoria',cumprida:true,evidencia:'Registro teórico'},{titulo:'Prática acompanhada',cumprida:true,evidencia:'Registro de prática'}],concluir:true,dataRealizacao:'2026-10-08',expectedRevision:0},true);assert.equal(r.status,200);assert.equal(r.body.registro.vencimento,'2027-10-08');assert.equal(r.body.registro.status,'concluida');
 assert.equal((await cmd(b,'salvarCapacitacao',{materialId:'v1',colaboradorId:'rh-ana',concluir:true})).status,403);
 r=await cmd(b,'capacitacoes');assert.equal(r.body.registros.length,1);assert.equal(r.body.registros[0].validadoPor,'gestao');assert.equal(r.body.pendencias.length,0);
 const outro=await b.call({action:'escola',operacao:'academia.capacitacoes'},{sub:'bruno'});assert.equal(outro.body.registros.length,0);
});
const instrumento=()=>({id:'i1',titulo:'Organização no trabalho — exemplo',objetivo:'Refletir sobre hábitos',instrucoes:'Responda conforme sua experiência',versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh-ana']},metodologia:'Média por dimensão de autorrelato, sem diagnóstico nem validação científica.',autorizacao:'Instrumento original aprovado para demonstração.',visibilidade:['rh-gestao'],escala:['Nunca','Às vezes','Sempre'],dimensoes:[{id:'org',titulo:'Organização',forte:'Você relata organização frequente.',desenvolver:'Experimente planejar três prioridades.',recomendacoes:['Planejamento diário']}],questoes:[{id:'p1',texto:'Planejo minhas prioridades?',dimensao:'org'},{id:'p2',texto:'Deixo de conferir as entregas?',dimensao:'org',inversa:true}]});
test('perfil exige instrumento revisado, calcula sem aprovação/reprovação e mantém resultado privado',async()=>{
 const b=app();let r=await cmd(b,'salvarInstrumento',{instrumento:instrumento(),expectedRevision:0},true);assert.equal(r.status,200);assert.equal(r.body.registro.aprovacao,undefined);
 assert.equal((await cmd(b,'responderPerfil',{instrumentoId:'i1',versao:'1',respostas:{p1:2,p2:0},ciente:true})).status,409);
 r=await cmd(b,'aprovarInstrumento',{instrumentoId:'i1',expectedRevision:1,parecer:'Revisei metodologia e autorização de aplicação.'},true);assert.equal(r.status,200);
 r=await cmd(b,'responderPerfil',{instrumentoId:'i1',versao:'1',respostas:{p1:2,p2:0},ciente:true});assert.equal(r.status,200);assert.equal(r.body.registro.resultado[0].percentual,100);assert.equal(r.body.registro.aprovado,undefined);assert.equal(r.body.registro.colaboradorId,'rh-ana');
 const id=r.body.registro.id;r=await cmd(b,'perfis');assert.equal(r.body.resultados.length,1);assert.equal(r.body.resultados[0].id,id);
 assert.equal((await cmd(b,'perfis',{},true)).body.resultados.length,1);
 const outro=await b.call({action:'escola',operacao:'academia.perfis'},{sub:'bruno',papel:'admin'});assert.equal(outro.body.resultados.length,0);
 const forged=await cmd(b,'responderPerfil',{instrumentoId:'i1',versao:'1',respostas:{p1:2,p2:0},ciente:false});assert.equal(forged.status,400);
});
test('PDF original fica privado, exige versão nova para troca e usa permissão da biblioteca',async()=>{
 const b=app([row('materiais',mat({tipo:'documento',url:'',publicada:false}))]);const base64=Buffer.from('%PDF-1.4\nPDF fictício exclusivo do teste').toString('base64');
 let r=await cmd(b,'enviarPDF',{materialId:'v1',versao:'1',base64,expectedRevision:1},true);assert.equal(r.status,200);assert.ok(r.body.registro.arquivoHash);
 const revision=r.body.revision;const material=r.body.registro;material.publicada=true;
 r=await cmd(b,'salvarMaterial',{material,expectedRevision:revision},true);assert.equal(r.status,200);
 r=await cmd(b,'arquivoPDF',{materialId:'v1'});assert.equal(r.status,200);assert.equal(r.body.base64,base64);
 const outro=await b.call({action:'escola',operacao:'academia.arquivoPDF',materialId:'v1'},{sub:'bruno'});assert.equal(outro.status,403);
 const alterado=await cmd(b,'enviarPDF',{materialId:'v1',versao:'1',base64:Buffer.from('%PDF-1.4\nOutro documento').toString('base64'),expectedRevision:3},true);assert.equal(alterado.status,409);
 assert.equal((await cmd(b,'enviarPDF',{materialId:'v1',versao:'1',base64:Buffer.from('<script>x</script>').toString('base64'),expectedRevision:3},true)).status,400);
});
test('gestor não usa um curso para liberar material de outro setor',async()=>{
 const material=mat({setor:'Financeiro',liberacao:{pessoas:['rh-bruno']}});const b=backend({tables,rows:[row('materiais',material)],persistWrites:true,config:{gestores:{ana:['Produção']}}});
 const formacao={id:'f2',titulo:'Tentativa',versao:'1',setor:'Produção',publicada:true,ativa:true,liberacao:{pessoas:['rh-ana']},etapas:[{id:'e1',titulo:'Etapa',tipo:'cultura',obrigatoria:true,pontos:10,conteudo:{aprender:'A',importancia:'B',comoFazer:'C',erros:'D',evidencia:'E'},materiais:[{id:'v1',versao:'1'}]}]};
 const r=await b.call({action:'escola',operacao:'salvarFormacao',formacao,mutationId:'cross',expectedRevision:0},{sub:'ana',papel:'gestor'});assert.equal(r.status,403);
});
test('instrutor designado registra NR apenas no seu setor e não gerencia a biblioteca',async()=>{
 const nr=mat({tipo:'nr',nr:{numero:'35',responsavel:'bruno',requisitos:['Prática'],validadeMeses:null}});
 const b=backend({tables,rows:[row('materiais',nr)],persistWrites:true,config:{educacao:{instrutores:{bruno:['Produção']}}}});
 const r=await b.call({action:'escola',operacao:'academia.capacitacoes'},{sub:'bruno'});assert.equal(r.status,200);assert.equal(r.body.normas[0].podeRegistrar,true);assert.equal(r.body.podeGerir,false);
 const salvo=await b.call({action:'escola',operacao:'academia.salvarCapacitacao',materialId:'v1',colaboradorId:'rh-ana',etapas:[{titulo:'Prática',cumprida:true,evidencia:'Atividade acompanhada'}],concluir:true,dataRealizacao:'2026-10-08',expectedRevision:0,mutationId:'instrutor-nr'},{sub:'bruno'});assert.equal(salvo.status,200);assert.equal(salvo.body.registro.validadoPor,'bruno');
 const edit=await b.call({action:'escola',operacao:'academia.salvarMaterial',material:nr,expectedRevision:1,mutationId:'edit-nr'},{sub:'bruno'});assert.equal(edit.status,403);
});
