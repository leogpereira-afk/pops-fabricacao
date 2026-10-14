import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {backend,jwt,jwtAluno,lerPayload} from './helpers.mjs';

// Entrada do aluno pelo ID do RH (6 dígitos) e primeiro nome, crachá próprio com
// chave derivada e porta estreita. Pessoas, IDs, nomes e IPs são fictícios.
// O limite de tentativas roda na rotina real do banco (PGlite, migração 0006).
let db;
before(async()=>{
 db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role;');
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/0006_entrada_aluno.sql',import.meta.url),'utf8'));
});
after(async()=>await db?.close());
const sql=async(texto,params)=>{try{const r=await db.query(texto,params);return {data:r.rows[0].r,error:null};}catch(e){return {data:null,error:{message:e.message}};}};
const limiteReal={
 pops_entrada_aluno:a=>sql('select pops_entrada_aluno(p_acao=>$1,p_chave_id=>$2,p_chave_ip=>$3,p_chave_nome=>$4) r',[a.p_acao,a.p_chave_id,a.p_chave_ip,a.p_chave_nome]),
 pops_entrada_aluno_bloqueios:a=>sql('select pops_entrada_aluno_bloqueios($1) r',[a.p_liberar]),
};
const zerarLimite=()=>db.exec('delete from pops_entrada_tentativas');
// IP fictício por teste: o limite do IP não vaza de um teste para outro. Como chega
// pela Supabase: o item da esquerda é o que o cliente mandou (aqui, um falso fixo);
// o proxy acrescenta o IP real à direita.
let ipSeq=0;const novoIp=()=>({'x-forwarded-for':'198.18.0.1, 203.0.113.'+(++ipSeq)});

const row=(colecao,registro,extra={})=>({colecao,id:registro.id,registro,revision:1,apagado:false,...extra});
const conteudo={aprender:'Aprender exemplo',importancia:'Aplicação no trabalho',comoFazer:'Instrução revisada',erros:'Erros comuns',evidencia:'Demonstrar corretamente'};
const curso={id:'f1',titulo:'Curso fictício',versao:'1',setor:'Produção',ativa:true,publicada:true,liberacao:{pessoas:['rh1'],cargos:[],setores:[],todos:false},etapas:[{id:'e1',titulo:'Aula fictícia',tipo:'cultura',obrigatoria:true,prerequisitos:[],pontos:10,conteudo,aprovacao:{por:'gestao',em:'2026-10-08T12:00:00Z',versao:'1'},quiz:[],minimoAcerto:70,maxTentativas:2,fontes:[],documentos:[]}]};
const rh=()=>[
 row('colaboradores',{id:'rh1',nome:'Ana Exemplo Fictícia',idPessoa:'100001',setor:'Produção',cargoId:'c1',cpf:'000.000.000-00',salario:1}),
 row('colaboradores',{id:'rh2',nome:'Bruno Fictício',idPessoa:'100002',setor:'Produção'}),
 row('colaboradores',{id:'rh3',nome:'Carla Fictícia',idPessoa:'100003',dataDesligamento:'2026-09-01'}),
 row('colaboradores',{id:'rh4',nome:'Davi Fictício',idPessoa:'100004',statusId:'inativo'}),
 row('colaboradores',{id:'rh5',nome:'Elis Fictícia',idPessoa:'100005'}),row('colaboradores',{id:'rh6',nome:'Elis Outra',idPessoa:'100005'}),
 row('colaboradores',{id:'rh7',nome:'Érica Fictícia',idPessoa:'100007',setor:'Produção'}),
 row('colaboradores',{id:'rh8',nome:'Fábio Apagado',idPessoa:'100008'},{apagado:true}),
 row('colaboradores',{id:'rh9',nome:'Gil Abandono',idPessoa:'100009',statusId:'abandono'}),
 row('cargos',{id:'c1',nome:'Montadora'}),
];
const tabelas=()=>({registros:rh(),acesso_conta:[{id:'acc2',usuario:'bruno',ativo:true,colaborador_id:'rh2'},{id:'acc9',usuario:'gestao',ativo:true,colaborador_id:'rh2'}],acesso_papel:[{conta_id:'acc2',sistema:'pops',login:'bruno',ativo:true,papel:'equipe'}]});
function app({config={},rows=[],rpcs=limiteReal,...resto}={}){return backend({tables:tabelas(),config,persistWrites:true,rpcs,rows:[row('formacoes',curso),...rows],...resto});}
const entrar=(b,id,nome,headers=novoIp())=>b.call({action:'entrarAluno',id,nome},{}, {semCracha:true,headers});
const comoAluno=(b,body,token=jwtAluno())=>b.call(body,{}, {token});
const gravacoes=b=>b.writes.filter(w=>['pops_gravar','pops_configurar','pops_sincronizar_pessoas'].includes(w.rpc)||(w.rpc==='pops_entrada_aluno_bloqueios'&&w.args?.p_liberar)||w.table);

test('aluno entra com o ID do RH e o primeiro nome; crachá próprio, sem dado da ficha',async()=>{
 await zerarLimite();const b=app();
 for(const nome of ['ana','  ANA ','Ána']){
  const r=await entrar(b,'100001',nome);assert.equal(r.status,200,nome);
  assert.deepEqual(Object.keys(r.body).sort(),['colaboradorId','nome','ok','papel','token','usuario','validoAte']);
  assert.equal(r.body.nome,'Ana');assert.equal(r.body.papel,'aluno');assert.equal(r.body.usuario,'aluno:rh1');
  const p=lerPayload(r.body.token);
  assert.deepEqual(Object.keys(p).sort(),['colaboradorId','exp','iat','nome','papel','sis','sub']);
  assert.equal(p.sis,'pops-aluno');assert.equal(p.papel,'aluno');assert.equal(p.sub,'aluno:rh1');assert.equal(p.colaboradorId,'rh1');assert.equal(p.exp-p.iat,7*86400);
  assert.doesNotMatch(JSON.stringify(r.body),/100001|Exemplo|cpf|salario/i,'nem ID do RH, nem nome completo, nem documento');
 }
 // Acento no primeiro nome da ficha: quem digita sem acento entra.
 assert.equal((await entrar(b,'100007','erica')).status,200);
 assert.equal(gravacoes(b).length,0,'entrar não grava nada além do limite');
});

test('mesma resposta para ID inexistente, nome errado, desligado, duplicado, apagado e entrada desligada',async()=>{
 await zerarLimite();
 const casos=[['999999','ana'],['100001','bruno'],['100001','ana exemplo'],['100001',''],['100003','carla'],['100004','davi'],['100009','gil'],['100005','elis'],['100008','fabio'],['12345','ana'],['1000011','ana'],[100001,'ana'],['10000a','ana'],['100001',['ana']]];
 const b=app();
 for(const [id,nome] of casos){const r=await entrar(b,id,nome);assert.equal(r.status,401,JSON.stringify([id,nome]));assert.deepEqual(r.body,{erro:'ID ou nome não conferem.',semSessao:true});}
 const desligada=app({config:{educacao:{entradaAluno:{ativa:false,validadeDias:7}}}});
 const r=await entrar(desligada,'100001','ana');assert.equal(r.status,401);assert.deepEqual(r.body,{erro:'ID ou nome não conferem.',semSessao:true});
 // Entrada desligada nem consulta o RH.
 assert.equal(desligada.queries.filter(q=>q.table==='registros').length,0);
});

test('a consulta ao RH projeta só o necessário e filtra pela ficha viva com aquele ID',async()=>{
 await zerarLimite();const b=app();await entrar(b,'100001','ana');
 const q=b.queries.find(q=>q.table==='registros');
 assert.deepEqual(q.eqs,[['colecao','colaboradores'],['apagado',false],['registro->>idPessoa','100001']]);
 assert.doesNotMatch(q.select,/cpf|salario|idPessoa|endereco/i);
});

test('limite de tentativas no banco: 5 erros por ID bloqueiam o ID com 429, sem conferir o nome',async()=>{
 await zerarLimite();const b=app(),ip=novoIp();
 for(let i=0;i<5;i++)assert.equal((await entrar(b,'100001','errado',ip)).status,401);
 const consultas=b.queries.filter(q=>q.table==='registros').length;
 const bloqueado=await entrar(b,'100001','ana',ip);
 assert.equal(bloqueado.status,429);assert.equal(bloqueado.body.erro,'Muitas tentativas. Tente de novo em 15 minutos.');assert.equal(bloqueado.body.token,undefined);
 assert.equal(b.queries.filter(q=>q.table==='registros').length,consultas,'bloqueado não chega a consultar o RH');
 // O bloqueio é do ID: de outro IP também espera; outro ID do mesmo IP segue.
 assert.equal((await entrar(b,'100001','ana')).status,429);
 assert.equal((await entrar(b,'100002','bruno',ip)).status,200);
 // Passados 15 minutos (no banco), entra.
 await db.exec("update pops_entrada_tentativas set janela_desde=janela_desde-interval '16 minutes',bloqueado_ate=bloqueado_ate-interval '16 minutes'");
 assert.equal((await entrar(b,'100001','ana',ip)).status,200);
});

test('entrada certa zera o ID; 30 erros do mesmo IP bloqueiam o IP',async()=>{
 await zerarLimite();const b=app(),ip=novoIp();
 for(let i=0;i<4;i++)await entrar(b,'100001','errado',ip);
 assert.equal((await entrar(b,'100001','ana',ip)).status,200);
 for(let i=0;i<4;i++)assert.equal((await entrar(b,'100001','errado',ip)).status,401,'nova janela para o ID depois da entrada certa');
 // IP: 30 erros com IDs e nomes diferentes (22 a mais, somando os 8 de cima).
 for(let i=0;i<22;i++)assert.equal((await entrar(b,String(200000+i),'ninguem'+String.fromCharCode(97+i),ip)).status,401);
 assert.equal((await entrar(b,'100002','bruno',ip)).status,429,'IP bloqueado vale para qualquer ID');
 assert.equal((await entrar(b,'100002','bruno')).status,200,'outro IP segue');
 // cf-connecting-ip vem antes do x-forwarded-for.
 assert.equal((await entrar(b,'100002','bruno',{'cf-connecting-ip':'198.51.100.7','x-forwarded-for':ip['x-forwarded-for']})).status,200);
});

test('o banco recebe o ID, o nome e o IP cifrados, nunca em claro',async()=>{
 await zerarLimite();const b=app();await entrar(b,'100001','Errado',{'x-forwarded-for':'192.0.2.44'});
 const chaves=(await db.query('select chave from pops_entrada_tentativas order by chave')).rows.map(r=>r.chave);
 assert.deepEqual(chaves.map(c=>c.split(':')[0]),['geral','id','ip','nome']);for(const c of chaves)assert.match(c,/^(id|nome|ip|geral):[0-9a-f]{64}$/);
 assert.doesNotMatch(chaves.join(' '),/100001|192\.0\.2\.44|errado/i);
 const chamada=b.writes.find(w=>w.rpc==='pops_entrada_aluno');assert.doesNotMatch(JSON.stringify(chamada.args),/100001|192\.0\.2\.44|errado/i);
 // O nome conta pela forma normalizada: "ERRADO", " errado " e "Érrado" caem no mesmo contador.
 for(const nome of ['ERRADO',' errado ','Érrado'])await entrar(b,'100002',nome,{'x-forwarded-for':'192.0.2.45'});
 assert.equal((await db.query("select count(*)::integer n from pops_entrada_tentativas where chave like 'nome:%'")).rows[0].n,1);
});

test('IP do limite: o item da esquerda do x-forwarded-for é do cliente e não abre balde novo',async()=>{
 await zerarLimite();const b=app();
 // O mesmo cliente real (à direita) forjando um endereço diferente à esquerda a cada pedido.
 const forjado=i=>({'x-forwarded-for':'198.18.'+(i>>8)+'.'+(i&255)+', 203.0.113.9'});
 for(let i=0;i<30;i++)assert.equal((await entrar(b,String(300000+i),'nome'+String.fromCharCode(97+(i%26))+i,forjado(i))).status,401,'tentativa '+(i+1));
 assert.equal((await entrar(b,'100002','bruno',forjado(99))).status,429,'o forjado da esquerda não muda o balde');
 // Sem forjar, outro cliente real segue entrando.
 assert.equal((await entrar(b,'100002','bruno',{'x-forwarded-for':'203.0.113.10'})).status,200);
});

test('IP do limite: cf-connecting-ip vence; IPv6 conta pela rede /64; endereço inválido não vira chave',async()=>{
 const {ipNormal,ipDe}=app().contexto;
 const casos=[['203.0.113.9','203.0.113.9'],['203.000.113.009','203.0.113.9'],['256.1.1.1',''],['2001:db8:a:b:1:2:3:4','2001:db8:a:b::/64'],['2001:DB8:a:b::99','2001:db8:a:b::/64'],['[2001:db8::1]','2001:db8:0:0::/64'],['::ffff:192.0.2.7','192.0.2.7'],['::1','0:0:0:0::/64'],['fe80::1%eth0','fe80:0:0:0::/64'],['1:2:3:4:5:6:7::8',''],['1::2::3',''],['abc',''],['',''],['10.0.0.1, 10.0.0.2','']];
 for(const [entrada,esperado] of casos)assert.equal(ipNormal(entrada),esperado,entrada);
 const req=h=>new Request('http://local.test',{method:'POST',headers:h});
 assert.equal(ipDe(req({'cf-connecting-ip':'198.51.100.7','x-forwarded-for':'1.1.1.1, 203.0.113.9'})),'198.51.100.7');
 assert.equal(ipDe(req({'cf-connecting-ip':'lixo','x-forwarded-for':'1.1.1.1, 203.0.113.9'})),'203.0.113.9','cf inválido: o da direita');
 assert.equal(ipDe(req({'x-forwarded-for':'1.1.1.1,  203.0.113.9 '})),'203.0.113.9');
 assert.equal(ipDe(req({'x-forwarded-for':'203.0.113.9, lixo'})),'desconhecido','o da direita inválido não cai para o da esquerda');
 assert.equal(ipDe(req({})),'desconhecido');
 // Na porta: dois endereços do mesmo /64 dividem o balde.
 await zerarLimite();const b=app();
 for(let i=0;i<30;i++)await entrar(b,String(400000+i),'nome'+i,{'cf-connecting-ip':'2001:db8:1:2::'+(i+1).toString(16)});
 assert.equal((await entrar(b,'100002','bruno',{'cf-connecting-ip':'2001:db8:1:2:ffff::1'})).status,429);
 assert.equal((await entrar(b,'100002','bruno',{'cf-connecting-ip':'2001:db8:1:3::1'})).status,200,'outra rede /64 segue');
});

test('varredura com um nome comum, cada pedido de um IP real diferente: o nome bloqueia no 21º',async()=>{
 await zerarLimite();const b=app();
 for(let i=0;i<20;i++)assert.equal((await entrar(b,String(500000+i),'Ana',{'cf-connecting-ip':'203.0.114.'+(i+1)})).status,401,'tentativa '+(i+1));
 for(let i=20;i<40;i++)assert.equal((await entrar(b,String(500000+i),'ana',{'cf-connecting-ip':'203.0.114.'+(i+1)})).status,429,'tentativa '+(i+1));
 // Até a Ana certa espera: o bloqueio é do nome. Outro nome segue.
 assert.equal((await entrar(b,'100001','ana',{'cf-connecting-ip':'203.0.114.200'})).status,429);
 assert.equal((await entrar(b,'100002','bruno',{'cf-connecting-ip':'203.0.114.201'})).status,200);
});

test('limite indisponível fecha a porta: 503 e nenhum crachá',async()=>{
 const b=app({rpcs:{pops_entrada_aluno:async()=>({data:null,error:{message:'banco fora'}})}});
 const r=await entrar(b,'100001','ana');assert.equal(r.status,503);assert.equal(r.body.token,undefined);
});

test('validade do crachá vem da configuração (1 a 30 dias); fora disso, 7',async()=>{
 await zerarLimite();
 for(const [dias,esperado] of [[3,3],[30,30],[1,1],[0,7],[31,7],['3',7],[2.5,7]]){
  const r=await entrar(app({config:{educacao:{entradaAluno:{validadeDias:dias}}}}),'100001','ana');
  const p=lerPayload(r.body.token);assert.equal(p.exp-p.iat,esperado*86400,String(dias));
 }
});

test('crachá do aluno não passa no verificador da Central, e o da Central não passa no do aluno',async()=>{
 const b=app(),{lerCracha,lerCrachaAluno}=b.contexto;
 const aluno=jwtAluno(),central=jwt({papel:'admin',sub:'gestao'});
 assert.equal((await lerCrachaAluno(aluno)).colaboradorId,'rh1');assert.equal(await lerCracha(aluno),null);
 assert.equal((await lerCracha(central)).papel,'admin');assert.equal(await lerCrachaAluno(central),null);
 // Payload de aluno assinado com a chave base: nenhum dos dois aceita.
 const naBase=jwtAluno({}, {chave:'base'});assert.equal(await lerCrachaAluno(naBase),null);assert.equal(await lerCracha(naBase),null);
 // Payload da Central assinado com a chave derivada: nenhum dos dois aceita.
 const centralDerivado=jwtAluno({sis:'pops',papel:'admin',sub:'gestao'});assert.equal(await lerCracha(centralDerivado),null);assert.equal(await lerCrachaAluno(centralDerivado),null);
 // E pela porta: 401 nos dois casos.
 for(const token of [naBase,centralDerivado]){const r=await b.call({action:'ping'},{}, {token});assert.equal(r.status,401);}
});

test('crachá do aluno adulterado, vencido, de outro sistema ou fora do formato é recusado',async()=>{
 const b=app(),agora=Math.floor(Date.now()/1000);
 const valido=jwtAluno(),[h,p,s]=valido.split('.');
 const outroCorpo=Buffer.from(JSON.stringify({...lerPayload(valido),colaboradorId:'rh2',sub:'aluno:rh2'})).toString('base64url');
 const casos={
  'assinatura trocada':h+'.'+p+'.'+(s[0]==='A'?'B':'A')+s.slice(1),
  'corpo trocado (outra pessoa) com a assinatura antiga':h+'.'+outroCorpo+'.'+s,
  'vencido':jwtAluno({iat:agora-8*86400,exp:agora-86400}),
  'sis da Central':jwtAluno({sis:'pops'}),'sis de outro sistema':jwtAluno({sis:'painel'}),
  'papel de administração':jwtAluno({papel:'admin'}),'papel de equipe':jwtAluno({papel:'equipe'}),
  'sub de outra pessoa':jwtAluno({sub:'aluno:rh2'}),'sub de login da Central':jwtAluno({sub:'gestao'}),
  'sem colaboradorId':jwtAluno({colaboradorId:undefined,sub:'aluno:undefined'}),
  'validade acima de 30 dias':jwtAluno({exp:agora+31*86400}),'emitido no futuro':jwtAluno({iat:agora+3600}),
  'sem iat':jwtAluno({iat:undefined}),'algoritmo none':jwtAluno({}, {cabecalho:{alg:'none',typ:'JWT'}}),
 };
 for(const [nome,token] of Object.entries(casos)){
  assert.equal(await b.contexto.lerCrachaAluno(token),null,nome);
  const r=await b.call({action:'escola',operacao:'painel'},{}, {token});assert.equal(r.status,401,nome);
 }
 assert.equal((await comoAluno(b,{action:'ping'},valido)).status,200);
});

test('a cada chamada: pessoa desligada, entrada desligada, validade reduzida ou entrada religada encerram com 401',async()=>{
 const agora=Math.floor(Date.now()/1000),fim='Sua entrada de aluno terminou. Entre de novo com seu ID do RH e primeiro nome.';
 const t=tabelas();t.registros[0].registro.dataDesligamento='2026-10-13';
 const desligada=backend({tables:t,rows:[row('formacoes',curso)]});
 let r=await comoAluno(desligada,{action:'escola',operacao:'painel'});assert.equal(r.status,401);assert.equal(r.body.erro,fim);assert.equal(r.body.semSessao,true);
 const t2=tabelas();t2.registros[0].registro.statusId='abandono';
 assert.equal((await comoAluno(backend({tables:t2}),{action:'ping'})).status,401);
 const t3=tabelas();t3.registros[0].apagado=true;
 assert.equal((await comoAluno(backend({tables:t3}),{action:'ping'})).status,401);
 assert.equal((await comoAluno(app({config:{educacao:{entradaAluno:{ativa:false}}}}),{action:'ping'})).status,401);
 // Crachá de 7 dias emitido há 4; a administração baixou a validade para 3.
 const antigo=jwtAluno({iat:agora-4*86400,exp:agora+3*86400});
 assert.equal((await comoAluno(app({config:{educacao:{entradaAluno:{validadeDias:3}}}}),{action:'ping'},antigo)).status,401);
 assert.equal((await comoAluno(app({config:{educacao:{entradaAluno:{validadeDias:7}}}}),{action:'ping'},antigo)).status,200);
 // Desligou e religou depois de emitido: o crachá anterior não volta a valer.
 const religada={educacao:{entradaAluno:{ativa:true,validadeDias:7,ligadaEm:new Date((agora-60)*1000).toISOString()}}};
 assert.equal((await comoAluno(app({config:religada}),{action:'ping'},jwtAluno({iat:agora-3600}))).status,401);
 assert.equal((await comoAluno(app({config:religada}),{action:'ping'},jwtAluno({iat:agora}))).status,200);
 // A conferência é pela ficha, não pela Central: não consulta revogação de conta.
 const b=app();await comoAluno(b,{action:'ping'});assert.equal(b.writes.some(w=>w.rpc==='acesso_revogado'),false);
});

test('aluno vê a visão de aluno do painel e registra só o próprio aprendizado',async()=>{
 const b=app({config:{gestores:{'aluno:rh1':['Produção']},educacao:{instrutores:{'aluno:rh1':['Produção']}}}});
 const p=await comoAluno(b,{action:'escola',operacao:'painel'});
 assert.equal(p.status,200);assert.equal(p.body.pessoa.colaboradorId,'rh1');assert.equal(p.body.pessoa.nome,'Ana Exemplo Fictícia');assert.equal(p.body.pessoa.funcao,'Montadora');
 assert.deepEqual(p.body.gestao,{podeGerir:false,podeValidar:false,pessoas:[],registros:[]});
 assert.deepEqual(p.body.formacoes.map(f=>f.id),['f1']);assert.equal(p.body.formacoes[0].liberacao,undefined);
 assert.equal(b.queries.some(q=>q.table==='acesso_conta'||q.table==='acesso_papel'),false,'o aluno não passa pela Central nem lê contas');
 const r=await comoAluno(b,{action:'escola',operacao:'registrar',formacaoId:'f1',etapaId:'e1',evento:'leitura',formacaoVersao:'1',mutationId:'m-aluno-1',colaboradorId:'rh2'});
 assert.equal(r.status,200);assert.equal(r.body.registro.colaboradorId,'rh1');assert.equal(r.body.registro.etapas.e1.status,'concluida');
 const id=await comoAluno(b,{action:'identidadeRH'});
 assert.equal(id.body.pessoa.colaboradorId,'rh1');assert.equal(id.body.pessoa.vinculoOrigem,'entrada_aluno');assert.doesNotMatch(JSON.stringify(id.body),/100001|cpf|salario/i);
 // Curso não liberado para ele continua recusado.
 const outro=app({rows:[row('formacoes',{...curso,id:'f2',liberacao:{pessoas:['rh2'],cargos:[],setores:[],todos:false}})]});
 assert.equal((await comoAluno(outro,{action:'escola',operacao:'registrar',formacaoId:'f2',etapaId:'e1',evento:'leitura',formacaoVersao:'1',mutationId:'m-aluno-2'})).status,403);
});

test('conteúdo da casa pelo caminho da equipe; das coleções pessoais, só o dele',async()=>{
 const pessoal=(col,id,registro)=>row(col,{id,...registro},{atualizado_em:'2026-10-01T00:00:00Z'});
 const rows=[pessoal('pops','p1',{titulo:'POP fictício',setor:'Produção',versao:'1.0'}),pessoal('jornadas','j1',{titulo:'Jornada fictícia'}),pessoal('treinamentos','t1',{titulo:'Treinamento fictício',versao:'1.0'}),
  pessoal('pessoas','p-rh1',{nome:'Ana'}),pessoal('pessoas','p-rh2',{nome:'Bruno'}),
  pessoal('atribuicoes','a1',{pessoaId:'p-rh1',tipo:'pop',refId:'p1'}),pessoal('atribuicoes','a2',{pessoaId:'p-rh2',tipo:'pop',refId:'p1'}),
  pessoal('leituras','l-ana-p1',{usuario:'ana',colaboradorId:'rh1',popId:'p1'}),pessoal('leituras','l-bruno-p1',{usuario:'bruno',colaboradorId:'rh2',popId:'p1'}),pessoal('leituras','l-aluno:rh1-legado',{usuario:'aluno:rh1',popId:'p1'}),
  pessoal('progresso','j-ana-j1',{usuario:'ana',colaboradorId:'rh1'}),pessoal('progresso','j-bruno-j1',{usuario:'bruno',colaboradorId:'rh2'})];
 const b=app({rows});
 const lista=async col=>(await comoAluno(b,{action:'list',colecao:col,protocolo:2})).body.itens.map(i=>i.id).sort();
 assert.deepEqual(await lista('pops'),['p1']);assert.deepEqual(await lista('jornadas'),['j1']);assert.deepEqual(await lista('treinamentos'),['t1']);
 assert.deepEqual(await lista('pessoas'),['p-rh1']);assert.deepEqual(await lista('atribuicoes'),['a1']);
 assert.deepEqual(await lista('leituras'),['l-ana-p1'],'só pela ficha: nada por login, nem histórico sem carimbo do RH');assert.deepEqual(await lista('progresso'),['j-ana-j1']);
 for(const [col,id] of [['pessoas','p-rh2'],['atribuicoes','a2'],['leituras','l-bruno-p1'],['progresso','j-bruno-j1']])
  assert.deepEqual((await comoAluno(b,{action:'get',colecao:col,id})).body,{registro:null,revision:0},col);
 assert.equal((await comoAluno(b,{action:'get',colecao:'pops',id:'p1'})).body.registro.titulo,'POP fictício');
 assert.equal((await comoAluno(b,{action:'rev'})).status,200);
});

test('"li e entendi" pela coleção genérica: só o registro do próprio colaboradorId',async()=>{
 const rows=[row('pops',{id:'p1',titulo:'POP fictício',setor:'Produção',versao:'1.0'}),row('jornadas',{id:'j1',titulo:'Jornada',etapas:[{id:'e1'}]}),row('leituras',{id:'l-aluno:rh1-p1',usuario:'aluno:rh1',colaboradorId:'rh2',popId:'p1',versaoLida:'1.0'})];
 const b=app({rows:rows.filter(r=>r.colecao!=='leituras')});
 const leitura={id:'l-aluno:rh1-p1',usuario:'aluno:rh1',nome:'Outro nome',popId:'p1',versaoLida:'1.0',em:'2026-10-14T10:00:00Z',colaboradorId:'rh2',pessoaId:'p-rh2'};
 const r=await comoAluno(b,{action:'upsert',colecao:'leituras',registro:leitura,mutationId:'l1'});
 assert.equal(r.status,200);assert.equal(r.body.registro.colaboradorId,'rh1');assert.equal(r.body.registro.pessoaId,'p-rh1');assert.equal(r.body.registro.nome,'Ana Exemplo Fictícia');
 const prog=await comoAluno(b,{action:'upsert',colecao:'progresso',registro:{id:'j-aluno:rh1-j1',usuario:'aluno:rh1',jornadaId:'j1',etapas:{e1:'2026-10-14'}},mutationId:'pr1'});
 assert.equal(prog.status,200);assert.equal(prog.body.registro.colaboradorId,'rh1');
 // Em nome de outra pessoa, com o ID de outra pessoa ou por cima do registro de outra ficha: 403.
 assert.equal((await comoAluno(b,{action:'upsert',colecao:'leituras',registro:{...leitura,usuario:'bruno'}})).status,403);
 assert.equal((await comoAluno(b,{action:'upsert',colecao:'leituras',registro:{...leitura,id:'l-bruno-p1',usuario:'bruno'}})).status,403);
 const tomado=app({rows});
 assert.equal((await comoAluno(tomado,{action:'upsert',colecao:'leituras',registro:leitura})).status,403);
 assert.equal(gravacoes(tomado).length,0);
});

test('configuração para o aluno: só áreas, setores, linhas e resumo dos setores',async()=>{
 const b=app({config:{areas:[{nome:'Operações',setores:['Produção']}],setores:['Produção'],linhas:[{id:'l1'}],resumoSetor:{Produção:'Resumo'},gestores:{gestao:['Produção']},educacao:{instrutores:{bruno:['Produção']},entradaAluno:{ativa:true}},conhecimentoBase:{versao:'1'}}});
 const r=await comoAluno(b,{action:'getCfg'});
 assert.deepEqual(Object.keys(r.body.config).sort(),['areas','linhas','resumoSetor','setores']);assert.deepEqual(r.body.cfg,r.body.config);
});

test('biblioteca, NRs e perfil do aluno: só o que é dele',async()=>{
 const material={id:'m1',titulo:'Material fictício',versao:'1',setor:'Produção',tipo:'texto',objetivo:'Exemplo',publicada:true,ativa:true,paginas:['Página fictícia'],liberacao:{pessoas:['rh1'],cargos:[],setores:[]}};
 const nr={id:'nr1',titulo:'NR fictícia',versao:'1',setor:'Produção',tipo:'nr',objetivo:'Exemplo',publicada:true,ativa:true,liberacao:{todos:true,pessoas:[],cargos:[],setores:[]},nr:{numero:'35',responsavel:'aluno:rh1',requisitos:['Requisito fictício']}};
 const instrumento={id:'i1',titulo:'Perfil fictício',versao:'1',publicada:true,ativa:true,aprovacao:{versao:'1'},liberacao:{todos:true},visibilidade:['rh1','rh2'],escala:['Pouco','Muito'],dimensoes:[{id:'d1',titulo:'Dimensão'}],questoes:[{id:'q1',texto:'Pergunta?',dimensao:'d1'}]};
 const rows=[row('materiais',material),row('materiais',{...material,id:'m2',liberacao:{pessoas:['rh2'],cargos:[],setores:[]}}),row('materiais',nr),row('instrumentos',instrumento),
  row('capacitacoes',{id:'cap1',colaboradorId:'rh1',materialId:'nr1',versao:'1',status:'pendente'}),row('capacitacoes',{id:'cap2',colaboradorId:'rh2',materialId:'nr1',versao:'1',status:'concluida'}),
  row('perfis',{id:'pf1',colaboradorId:'rh1',instrumentoId:'i1'}),row('perfis',{id:'pf2',colaboradorId:'rh2',instrumentoId:'i1'})];
 const b=app({rows,config:{educacao:{instrutores:{'aluno:rh1':['Produção']}}}});
 const bib=await comoAluno(b,{action:'escola',operacao:'academia.biblioteca'});
 assert.equal(bib.status,200);assert.deepEqual(bib.body.materiais.map(m=>m.id).sort(),['m1','nr1']);assert.deepEqual(bib.body.pessoas,[]);assert.equal(bib.body.podeGerir,false);
 assert.equal((await comoAluno(b,{action:'escola',operacao:'academia.abrirMaterial',materialId:'m2'})).status,403,'material de outra pessoa');
 assert.equal((await comoAluno(b,{action:'escola',operacao:'academia.abrirMaterial',materialId:'m1'})).body.material.paginas.length,1);
 const reg=await comoAluno(b,{action:'escola',operacao:'academia.registrarMaterial',materialId:'m1',versao:'1',evento:'abrir',mutationId:'est-1'});assert.equal(reg.status,200);assert.equal(reg.body.registro.colaboradorId,'rh1');
 const cap=await comoAluno(b,{action:'escola',operacao:'academia.capacitacoes'});
 assert.equal(cap.status,200);assert.deepEqual(cap.body.registros.map(r=>r.id),['cap1']);assert.deepEqual(cap.body.pessoas,[]);assert.ok(cap.body.pendencias.every(p=>p.colaboradorId==='rh1'));assert.equal(cap.body.normas[0].podeRegistrar,false,'nem sendo o responsável escrito na NR');
 const pf=await comoAluno(b,{action:'escola',operacao:'academia.perfis'});
 assert.equal(pf.status,200);assert.deepEqual(pf.body.resultados.map(r=>r.id),['pf1'],'nem sendo consultor do instrumento');assert.deepEqual(pf.body.pessoas,[]);
 assert.equal(pf.body.instrumentos[0].visibilidade,undefined);assert.deepEqual(pf.body.instrumentos[0].consultores,['Ana Exemplo Fictícia','Bruno Fictício'],'os nomes de quem consulta ficam, para o aceite');
});

test('cada ação fora da porta estreita é recusada com 403 e nada é gravado',async()=>{
 const rows=[row('pops',{id:'p1',titulo:'POP',setor:'Produção',versao:'1.0'})];
 const negadas=[
  {action:'conhecimento'},{action:'saude'},{action:'setCfg',config:{setores:['X']}},{action:'delete',colecao:'pops',id:'p1'},{action:'restore',colecao:'pops',id:'p1'},
  {action:'sincronizarPessoas'},{action:'putFoto',id:'f1',base64:'AAAA'},{action:'getFoto',id:'p-rh2'},{action:'deleteFoto',id:'p-rh2'},{action:'list'},{action:'list',after:0},
  {action:'upsert',colecao:'pops',registro:{id:'p1',titulo:'Troca',setor:'Produção',versao:'2.0'}},{action:'upsert',colecao:'pessoas',registro:{id:'p-rh1',usuario:'aluno:rh1'}},
  {action:'upsert',colecao:'atribuicoes',registro:{id:'a9',pessoaId:'p-rh1',tipo:'pop',refId:'p1'}},{action:'upsert',colecao:'treinamentos',registro:{id:'t9'}},{action:'upsert',colecao:'jornadas',registro:{id:'j9'}},
  {action:'upsert',colecao:'formacoes',registro:{id:'f9'}},{action:'get',colecao:'formacoes',id:'f1'},{action:'list',colecao:'aprendizagem'},{action:'acaoInventada'},
  ...['salvarFormacao','aprovarAvaliacao','validar','reciclar','configurarCatalogo','configurarInstrutores','configurarEntradaAluno','liberarEntradaAluno','academia.salvarMaterial','academia.enviarPDF','academia.salvarCapacitacao','academia.salvarInstrumento','academia.aprovarInstrumento','operacaoInventada']
   .map(operacao=>({action:'escola',operacao,formacao:curso,formacaoId:'f1',colaboradorId:'rh2',etapaId:'e1',ativa:false,validadeDias:1,instrutores:{},catalogo:{},mutationId:'x-'+operacao}))];
 for(const body of negadas){
  const b=app({rows});const r=await comoAluno(b,body);
  assert.equal(r.status,403,JSON.stringify(body).slice(0,90));assert.equal(r.body.semPermissao,true);
  assert.equal(gravacoes(b).length,0,body.action+' '+(body.operacao||''));
 }
});

test('administração liga, desliga e muda a validade; o resto da escola fica como estava',async()=>{
 const cfg={gestores:{gestao:['Produção']},educacao:{instrutores:{bruno:['Produção']},catalogo:{familias:{},trilhas:{}}}};
 const configurar={pops_configurar:async a=>{Object.assign(cfg,structuredClone(a.p_patch));return {data:{ok:true,config:cfg},error:null};},...limiteReal};
 const b=app({config:cfg,rpcs:configurar});const adm={sub:'gestao',papel:'admin'};
 let p=await b.call({action:'escola',operacao:'painel'},adm);assert.deepEqual(p.body.gestao.entradaAluno,{ativa:true,validadeDias:7,bloqueios:0},'sem configuração, ligada');
 assert.equal((await b.call({action:'escola',operacao:'painel'},{papel:'gestor',sub:'gestao'})).body.gestao.entradaAluno,undefined,'só a administração vê a configuração');
 for(const who of [{papel:'gestor',sub:'gestao'},{papel:'equipe',sub:'bruno'}])assert.equal((await b.call({action:'escola',operacao:'configurarEntradaAluno',ativa:false,validadeDias:7},who)).status,403);
 for(const [ativa,dias] of [['nao',7],[false,0],[false,31],[false,'7'],[undefined,7]])assert.equal((await b.call({action:'escola',operacao:'configurarEntradaAluno',ativa,validadeDias:dias},adm)).status,400);
 // Desligar: grava educacao inteira, com o anterior para o banco conferir.
 let r=await b.call({action:'escola',operacao:'configurarEntradaAluno',ativa:false,validadeDias:5,entradaAnterior:{ativa:true,validadeDias:7}},adm);
 assert.equal(r.status,200);assert.equal(r.body.entradaAluno.ativa,false);assert.equal(r.body.entradaAluno.validadeDias,5);
 const w=b.writes.filter(x=>x.rpc==='pops_configurar').at(-1);
 assert.deepEqual(Object.keys(w.args.p_patch),['educacao']);assert.deepEqual(w.args.p_anterior.educacao.instrutores,{bruno:['Produção']});
 assert.deepEqual(cfg.educacao.instrutores,{bruno:['Produção']});assert.deepEqual(cfg.educacao.catalogo,{familias:{},trilhas:{}});assert.deepEqual(cfg.gestores,{gestao:['Produção']});
 assert.equal((await entrar(b,'100001','ana')).status,401,'desligada: ninguém entra');
 assert.equal((await comoAluno(b,{action:'ping'})).status,401,'desligada: quem já entrou sai');
 // Tela com o estado antigo: 409, nada gravado.
 const antes=b.writes.length;
 r=await b.call({action:'escola',operacao:'configurarEntradaAluno',ativa:true,validadeDias:7,entradaAnterior:{ativa:true,validadeDias:7}},adm);
 assert.equal(r.status,409);assert.equal(b.writes.filter(x=>x.rpc==='pops_configurar').length,b.writes.slice(0,antes).filter(x=>x.rpc==='pops_configurar').length);
 // Repetir o pedido igual ao gravado não grava de novo.
 r=await b.call({action:'escola',operacao:'configurarEntradaAluno',ativa:false,validadeDias:5},adm);assert.equal(r.body.repetido,true);
 // Religar marca a hora: crachá emitido antes não volta a valer; entrada nova vale.
 const velho=jwtAluno({iat:Math.floor(Date.now()/1000)-3600});
 r=await b.call({action:'escola',operacao:'configurarEntradaAluno',ativa:true,validadeDias:5,entradaAnterior:{ativa:false,validadeDias:5}},adm);
 assert.equal(r.status,200);assert.ok(cfg.educacao.entradaAluno.ligadaEm);assert.equal(cfg.educacao.entradaAluno.atualizadoPor,'gestao');
 assert.equal((await comoAluno(b,{action:'ping'},velho)).status,401);
 await zerarLimite();const novo=await entrar(b,'100001','ana');assert.equal(novo.status,200);
 const pn=lerPayload(novo.body.token);assert.equal(pn.exp-pn.iat,5*86400);
 assert.equal((await comoAluno(b,{action:'ping'},novo.body.token)).status,200);
 p=await b.call({action:'escola',operacao:'painel'},adm);assert.equal(p.body.gestao.entradaAluno.validadeDias,5);assert.equal(p.body.gestao.entradaAluno.ativa,true);
});

test('a Central continua igual: crachá de equipe e administração não vira aluno',async()=>{
 const b=app();
 const r=await b.call({action:'identidadeRH'},{sub:'bruno'});assert.equal(r.body.pessoa.vinculoOrigem,'central_rh');
 assert.equal((await b.call({action:'conhecimento'},{sub:'bruno'})).status,200);
 // Equipe com payload de aluno no corpo do crachá (papel aluno) é recusada pela Central.
 assert.equal((await b.call({action:'ping'},{papel:'aluno',sub:'aluno:rh1',colaboradorId:'rh1'})).status,401);
});

test('administração vê os bloqueios da entrada do aluno e libera na hora; ninguém mais libera',async()=>{
 await zerarLimite();const b=app(),fabrica={'cf-connecting-ip':'203.0.113.200'},adm={sub:'gestao',papel:'admin'};
 // Dia de implantação: a turma inteira atrás do mesmo IP erra 30 vezes; a Ana certa espera.
 for(let i=0;i<30;i++)await entrar(b,String(600000+i),'turma'+i,fabrica);
 assert.equal((await entrar(b,'100001','ana',fabrica)).status,429);
 let p=await b.call({action:'escola',operacao:'painel'},adm);assert.equal(p.body.gestao.entradaAluno.bloqueios,1);
 for(const who of [{papel:'gestor',sub:'gestao'},{papel:'equipe',sub:'bruno'}]){const r=await b.call({action:'escola',operacao:'liberarEntradaAluno'},who);assert.equal(r.status,403);}
 assert.equal((await comoAluno(b,{action:'escola',operacao:'liberarEntradaAluno'})).status,403);
 assert.equal((await entrar(b,'100001','ana',fabrica)).status,429,'ninguém liberou ainda');
 const r=await b.call({action:'escola',operacao:'liberarEntradaAluno'},adm);
 assert.equal(r.status,200);assert.deepEqual(r.body,{ok:true,liberados:1,bloqueios:0});
 assert.equal((await entrar(b,'100001','ana',fabrica)).status,200,'liberada, a Ana entra');
 p=await b.call({action:'escola',operacao:'painel'},adm);assert.equal(p.body.gestao.entradaAluno.bloqueios,0);
 // Contagem fora do ar: o painel segue, sem a contagem; liberar responde 503.
 const fora=app({rpcs:{...limiteReal,pops_entrada_aluno_bloqueios:async()=>({data:null,error:{message:'banco fora'}})}});
 p=await fora.call({action:'escola',operacao:'painel'},adm);assert.equal(p.status,200);assert.deepEqual(p.body.gestao.entradaAluno,{ativa:true,validadeDias:7});
 assert.equal((await fora.call({action:'escola',operacao:'liberarEntradaAluno'},adm)).status,503);
});
