import test from 'node:test';
import assert from 'node:assert/strict';
import { telaEscola } from './escola-tela-harness.mjs';

const aula=(id,extra={})=>({id,titulo:'Aula '+id,tipo:'aula',pontos:10,obrigatoria:true,prerequisitos:[],quiz:[],conteudo:{aprender:'Conferir o exemplo fictício',comoFazer:'Seguir o roteiro'},...extra});
const curso=etapas=>({id:'curso-ficticio',titulo:'Montagem fictícia',versao:'2',publicada:true,ativa:true,liberada:true,etapas});
function tela(f,aprendizagem=[],extra={}){
 const dados={ok:true,pessoa:{nome:'Ana Fictícia',funcao:'Montadora'},formacoes:[f],aprendizagem,gestao:{},...extra};
 return telaEscola({api:async()=>structuredClone(dados)});
}

test('próximo passo salta aula concluída, validação pendente e conteúdo bloqueado',async()=>{
 const f=curso([aula('feita',{status:'concluida'}),aula('validacao',{tipo:'pratica',status:'aguardando_validacao'}),aula('bloqueada',{motivoBloqueio:'Conteúdo em preparação.'}),aula('disponivel')]);
 const t=tela(f,[{formacaoId:f.id,atualizadoEm:'2026-01-01',etapas:{}}]);
 await t.route();
 assert.equal(t.node('.edu-proximo').querySelector('a').attributes.href,'#/formacao/curso-ficticio/disponivel');
 await t.route('formacao',f.id);
 assert.equal(t.node('.edu-missao').querySelector('a').attributes.href,'#/formacao/curso-ficticio/disponivel');
 const abertos=t.app.querySelectorAll('.edu-etapa').filter(n=>Object.hasOwn(n.attributes,'open'));
 assert.equal(abertos.length,1);
 assert.match(abertos[0].textContent,/Aula disponivel/);
});

test('curso bloqueado não se anuncia em dia nem oferece começar uma aula indisponível',async()=>{
 const f=curso([aula('pendente',{motivoBloqueio:'Conteúdo em preparação pela gestão.'})]);
 const t=tela(f);await t.route();
 assert.doesNotMatch(t.node('.edu-proximo').textContent,/estão em dia|Começar/);
 assert.match(t.node('.edu-proximo').textContent,/gestão|preparação/);
 assert.equal(t.node('.edu-proximo').querySelector('a').attributes.href,'#/formacao/curso-ficticio');
});

test('mapa separa aulas complementares da contagem obrigatória',async()=>{
 const f=curso([aula('feita',{status:'concluida'}),aula('atual'),aula('extra',{obrigatoria:false})]);
 const t=tela(f);await t.route('formacao',f.id);
 assert.match(t.text(),/1 de 2 aulas obrigatórias/);
 assert.match(t.text(),/1 aula complementar/);
 assert.equal(t.node('.edu-mapa').querySelectorAll('.edu-etapa').length,2);
 assert.equal(t.node('.edu-complementares').querySelectorAll('.edu-etapa').length,1);
});

test('leitura tem uma única ação e não confirma conquista se envio falhar',async()=>{
 const f=curso([aula('atual')]),dados={ok:true,pessoa:{nome:'Ana Fictícia'},formacoes:[f],aprendizagem:[],gestao:{}};
 const t=telaEscola({api:async p=>{if(p.operacao==='painel')return dados;throw new Error('Sem conexão para confirmar.');}});
 await t.route('formacao',f.id+'~atual');
 assert.equal(t.app.querySelectorAll('[data-evento=leitura]').length,1);
 await t.click('[data-evento=leitura]');
 assert.doesNotMatch(t.text(),/Aula concluída|Conquista confirmada/);
 assert.match(t.text(),/Sem conexão/);
});

test('conquistas mostram pontos, versão, data e prática apenas como o servidor registrou',async()=>{
 const f=curso([aula('proxima')]),p={formacaoId:f.id,pontos:35,conquistas:[
  {chave:'a',titulo:'Prática fictícia',pontos:25,tipo:'pratica_validada',formacaoVersao:'1',em:'2026-01-02T12:00:00Z'},
  {chave:'b',titulo:'Leitura fictícia',pontos:10,tipo:'etapa_concluida',formacaoVersao:'2',em:'2026-01-03T12:00:00Z'}
 ],etapas:{},historico:[]};
 const t=tela(f,[p]);await t.route('conquistas');
 const marcos=t.app.querySelectorAll('.edu-conquista');
 assert.equal(marcos.length,2);
 assert.match(marcos.find(n=>n.textContent.includes('Prática fictícia')).textContent,/25 pontos/);
 assert.match(t.text(),/Prática validada/);assert.match(t.text(),/versão 1/);assert.match(t.text(),/2026-01-02T12:00:00Z/);
 assert.match(t.node('.edu-marco-proximo').textContent,/10 pontos ao cumprir o critério/);
 assert.match(t.node('.edu-metricas').textContent,/35/);
 assert.doesNotMatch(t.text(),/ranking|nível ouro|XP/i);
 assert.equal(t.calls.filter(c=>c.operacao!=='painel').length,0);
});

test('histórico sem curso acessível permanece sem link para conteúdo indisponível',async()=>{
 const t=tela(curso([aula('atual')]),[{formacaoId:'curso-antigo',pontos:7,conquistas:[{titulo:'Aula histórica',pontos:7,em:'2025-01-01',tipo:'etapa_concluida'}]}]);
 await t.route('conquistas');
 const marco=t.node('.edu-conquista');
 assert.match(marco.textContent,/Aula histórica/);
 assert.equal(marco.querySelector('a'),null);
 assert.doesNotMatch(marco.textContent,/versão undefined|DATA AUSENTE/);
});

test('revisão de aula já premiada preserva conquista sem prometer novos pontos',async()=>{
 const f=curso([aula('revisao',{status:'revisar',pontos:20})]);
 const p={formacaoId:f.id,formacaoVersao:'1',etapas:{},pontos:10,conquistas:[{chave:f.id+':revisao',titulo:'Revisão fictícia',pontos:10,formacaoVersao:'1',em:'2025-01-01'}]};
 const t=tela(f,[p]);await t.route('conquistas');
 assert.equal(t.node('.edu-marco-proximo'),null);
 await t.route('formacao',f.id);
 assert.match(t.node('.edu-etapa-detalhe').textContent,/Conquista já registrada · 10 pontos no histórico/);
 assert.doesNotMatch(t.text(),/20 pontos ao cumprir o critério/);
 await t.route('formacao',f.id+'~revisao');
 assert.match(t.node('.edu-resumo').textContent,/Conquista já registrada · 10 pontos no histórico/);
 assert.doesNotMatch(t.node('.edu-resumo').textContent,/20 pontos ao cumprir/);
});
