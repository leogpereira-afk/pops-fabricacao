import test from 'node:test';
import assert from 'node:assert/strict';
import { backend } from './helpers.mjs';
import { telaEscola, esperar } from './escola-tela-harness.mjs';

// Tela e handler reais, dados fictícios e persistência somente no sandbox.
const admin={usuario:'admin',nome:'Administração fictícia',papel:'admin',pessoaRH:null};
const conteudo={aprender:'Aprender exemplo',importancia:'Aplicar no trabalho',comoFazer:'Seguir o exemplo',erros:'Evitar improviso',evidencia:'Demonstrar o passo'};
const material=(id,extra={})=>({id,tipo:'texto',titulo:'Material '+id,versao:'1',setor:'Produção',objetivo:'Objetivo fictício',paginas:['Página fictícia'],...extra});
const curso=(id,extra={})=>({id,titulo:'Curso '+id,versao:'1',setor:'Produção',catalogo:{area:'Acabamento'},etapas:[{id:id+'-aula',titulo:'Aula fictícia',tipo:'aula',conteudo}],...extra});
const pacote=()=>({versao:'1',materiais:[material('material-exemplo')],cursos:[curso('curso-exemplo')]});
function ambiente(interceptar){
 const rows=[],config={educacao:{catalogo:{familias:{},trilhas:{}}}};
 const b=backend({rows,config,persistWrites:true});
 const chamar=async(p,action)=>{
  const r=await b.call({action,...p},{sub:'admin',papel:'admin'});
  if(r.status>=400)throw Object.assign(new Error(r.body.erro),{status:r.status});
  if(p.operacao==='configurarCatalogo')config.educacao.catalogo=r.body.catalogo;
  return r.body;
 };
 const t=telaEscola({sessao:admin,api:(p,action)=>interceptar?interceptar(p,action,chamar):chamar(p,action)});
 return {t,rows,b};
}
async function escolher(t,p){
 const input=t.node('#imp-arquivo');
 input.files=[{name:'pacote-exemplo.json',size:1000,text:async()=>JSON.stringify(p)}];
 await input.onchange();await esperar();
}
function filtrar(t,id,value){const el=t.node(id);assert.ok(el,'Filtro '+id+' disponível');el.value=value;el.onchange();}
const visiveis=t=>t.node('#imp-previa').querySelectorAll('.imp-item').filter(n=>!n.hidden);
const gravacoes=t=>t.calls.filter(p=>['configurarCatalogo','academia.salvarMaterial','salvarFormacao'].includes(p.operacao));
const passo=t=>t.node('#imp-etapas').querySelectorAll('li').find(n=>n.attributes['aria-current']==='step')?.dataset.passo;
const adiado=()=>{let resolver;const p=new Promise(r=>{resolver=r;});return {p,resolver};};

test('prévia filtra tipo, área e situação sem esconder o bloqueio nem alterar os totais',async()=>{
 const {t}=ambiente();await t.route('importar');assert.equal(passo(t),'1');
 const p=pacote();p.cursos.push(curso('curso-com-erro',{titulo:'',catalogo:{area:'Financeiro'}}));
 await escolher(t,p);
 assert.equal(passo(t),'2');
 assert.equal(t.node('.imp-selecao').hidden,true,'A etapa anterior deixa espaço para a conferência');
 assert.equal(visiveis(t)[0].dataset.situacao,'erro','Exceção vem antes dos itens válidos');
 assert.equal(visiveis(t).length,3);
 assert.equal(t.node('#imp-total-novos').textContent,'2');
 assert.equal(t.node('#imp-total-erros').textContent,'1');
 const detalhes=visiveis(t)[1].querySelector('details');
 assert.ok(detalhes);assert.equal(detalhes.open,false);assert.match(detalhes.textContent,/Identificador|Versão/);
 filtrar(t,'#imp-filtro-tipo','curso');assert.equal(visiveis(t).length,2);
 filtrar(t,'#imp-filtro-area','Acabamento');assert.equal(visiveis(t).length,1);
 filtrar(t,'#imp-filtro-situacao','erro');assert.equal(visiveis(t).length,0);
 assert.match(t.node('#imp-contagem').textContent,/0 de 3/);
 assert.equal(t.node('#imp-vazio').hidden,false);
 assert.equal(t.node('#imp-confirmar').disabled,true,'Filtrar erros não remove o bloqueio do pacote');
 assert.equal(t.node('#imp-total-erros').textContent,'1');
 await t.click('#imp-confirmar');assert.equal(gravacoes(t).length,0);
});

test('filtros não selecionam itens para envio e a revisão leva apenas aos rascunhos confirmados',async()=>{
 const {t,rows}=ambiente();await t.route('importar');await escolher(t,pacote());
 filtrar(t,'#imp-filtro-tipo','curso');assert.equal(visiveis(t).length,1);
 await t.click('#imp-confirmar');
 assert.equal(passo(t),'4');
 assert.deepEqual(gravacoes(t).map(p=>p.operacao),['academia.salvarMaterial','salvarFormacao']);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.registro.publicada===false));
 assert.match(t.node('#imp-progresso').textContent,/2 de 2 itens conferidos no servidor/);
 assert.equal(t.node('#imp-confirmados').textContent,'2');
 assert.equal(t.node('#imp-resultado').querySelector('[href="#/formacao-editor/curso-exemplo"]').textContent,'Revisar curso');
 assert.equal(t.node('#imp-resultado').querySelector('[href="#/material-editor/material-exemplo"]').textContent,'Revisar material');
 assert.equal(t.node('#imp-previa').hidden,true);
});

test('enquanto o servidor não responde, progresso mantém só o confirmado e impede trocar o plano',{timeout:10000},async()=>{
 const espera=adiado(),iniciou=adiado();let enviando=false;
 const {t}=ambiente(async(p,action,chamar)=>{
  if(p.operacao==='salvarFormacao'){enviando=true;iniciou.resolver();await espera.p;}
  return chamar(p,action);
 });
 await t.route('importar');await escolher(t,pacote());
 // A consulta e a assinatura usam tarefas assíncronas; voltas do event loop
 // não comprovam que o curso começou a ser enviado em outra máquina.
 const envio=t.click('#imp-confirmar');await iniciou.p;
 assert.equal(enviando,true);assert.equal(passo(t),'3');
 assert.equal(t.node('#imp-confirmados').textContent,'1');
 assert.match(t.node('#imp-progresso').textContent,/1 de 2 itens conferidos no servidor/);
 assert.match(t.node('#imp-em-processamento').textContent,/Curso curso-exemplo/);
 assert.equal(t.node('#imp-arquivo').disabled,true);
 assert.equal(t.node('#imp-outro').disabled,true);
 await t.click('#imp-outro');
 assert.ok(t.node('#imp-previa'),'A troca de pacote não apaga o plano em execução');
 espera.resolver();await envio;
 assert.equal(t.node('#imp-confirmados').textContent,'2');assert.equal(passo(t),'4');
});

test('falha parcial diferencia erro e não enviado e só oferece revisão do curso confirmado',async()=>{
 const {t}=ambiente(async(p,action,chamar)=>{
  if(p.operacao==='salvarFormacao'&&p.formacao.id==='curso-falha')throw new Error('Conexão interrompida');
  return chamar(p,action);
 });
 await t.route('importar');
 const p={versao:'1',materiais:[],cursos:[curso('curso-ok'),curso('curso-falha'),curso('curso-pendente')]};
 await escolher(t,p);await t.click('#imp-confirmar');
 assert.equal(t.node('#imp-confirmados').textContent,'1');
 assert.equal(t.node('#imp-falhas').textContent,'1');
 assert.equal(t.node('#imp-nao-enviados').textContent,'1');
 const res=t.node('#imp-resultado');
 assert.ok(res.querySelector('[href="#/formacao-editor/curso-ok"]'));
 assert.equal(res.querySelector('[href="#/formacao-editor/curso-falha"]'),null);
 assert.equal(res.querySelector('[href="#/formacao-editor/curso-pendente"]'),null);
 assert.match(res.textContent,/Erro|Não enviado/);
 assert.equal(passo(t),'4');
 await t.click('#imp-reconferir');
 assert.equal(passo(t),'2');assert.equal(t.node('#imp-resultado').textContent,'');
 assert.equal(t.node('#imp-confirmar').disabled,false);
});

test('arquivo inválido retorna à seleção e leitura antiga não substitui o arquivo mais recente',async()=>{
 const {t}=ambiente();await t.route('importar');const input=t.node('#imp-arquivo');
 input.files=[{name:'ruim.json',size:10,text:async()=>'{ruim'}];await input.onchange();
 assert.equal(passo(t),'1');assert.match(t.node('#imp-area').textContent,/não é um JSON válido/);
 const antigo=adiado();
 input.files=[{name:'antigo.json',size:10,text:()=>antigo.p}];const lendo=input.onchange();
 await escolher(t,{versao:'2',materiais:[],cursos:[curso('curso-recente')]});
 antigo.resolver(JSON.stringify(pacote()));await lendo;
 assert.match(t.node('#imp-previa').textContent,/curso-recente/);
 assert.doesNotMatch(t.node('#imp-previa').textContent,/material-exemplo/);
});

test('área malformada permanece como erro do item, sem quebrar a prévia e os filtros',async()=>{
 const {t}=ambiente();await t.route('importar');
 const p=pacote();p.cursos[0].catalogo.area={nome:'Área inválida fictícia'};
 p.cursos.push(curso('outro-curso-invalido',{catalogo:{area:['Área em lista']}}));
 await escolher(t,p);
 assert.ok(t.node('#imp-previa'),t.node('#imp-area').textContent);
 assert.match(t.node('#imp-previa').textContent,/Área com até 120 caracteres/);
 assert.equal(t.node('#imp-confirmar').disabled,true);
 assert.doesNotMatch(t.node('#imp-filtro-area').textContent,/\[object Object\]/);
 filtrar(t,'#imp-filtro-situacao','erro');assert.equal(visiveis(t).length,2);
});

test('mudança no servidor depois da prévia volta à conferência sem gravar',async()=>{
 const {t,rows}=ambiente();await t.route('importar');const p=pacote();await escolher(t,p);
 rows.push({colecao:'formacoes',id:'curso-exemplo',registro:{...p.cursos[0],publicada:true,ativa:true,liberacao:{pessoas:[],cargos:[],setores:[],todos:false}},revision:1,apagado:false});
 await t.click('#imp-confirmar');
 assert.equal(passo(t),'2');assert.equal(gravacoes(t).length,0);
 assert.match(t.node('#imp-resultado').textContent,/A escola mudou desde a prévia/);
 assert.match(t.node('#imp-previa').textContent,/Já está liberado para os alunos/);
 assert.equal(t.node('#imp-confirmar').disabled,true);
});
