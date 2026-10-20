# Jornada, conquistas e importação: plano de implementação

> Para execução: subagent-driven-development, tarefas independentes com revisão final.

**Objetivo:** modernizar as três etapas aprovadas com Silk, cards compactos e navegação no celular.
**Arquitetura:** renderizadores vanilla existentes; servidor e modelo de pontuação preservados. Estilos isolados por classes de componente em styles.css. Importação usa o planejamento e execução existentes.
**Stack:** JavaScript, CSS, Node 24, harness DOM e handler real em sandbox.
**Especificação:** proposta aprovada em 20/10/2026, guardada em Dre/outputs/escola-jornada-20261020/proposta.md.

## Restrições globais
- IDs, permissões, pré-requisitos, pontuação e histórico preservados.
- Nenhum dado real, publicação ou alteração no servidor.
- Mascote oficial, um por tela, fora de provas, erros e cursos de segurança.
- Critérios e pontuações somente dos registros confirmados; reenvio não duplica reconhecimento.
- Cores com texto/ícone, teclado, celular a 390 px, redução de movimento e impressão.

## 1. Jornada do aluno
Arquivos: educacao.js, styles.css, tests/jornada-silk-ui.test.mjs.
Interface: snapshot atual, progresso(f,p), bloqueio(f,e,p), rota(f.id,e.id), executar(...).
- [x] Acrescentar teste com curso de 3 etapas: uma concluída, uma aguardando validação e uma disponível; a próxima ação deve selecionar somente a disponível. Testar leitura única e ausência de sucesso após falha.
- [x] Rodar `node --test tests/jornada-silk-ui.test.mjs` e conferir falha esperada.
- [x] Criar mapa vertical, etapa atual destacada, resumo compacto e uma ação de leitura. CTA respeita bloqueio e versão.
- [x] Rodar testes de jornada, educacao-ui e escola-trilhas-ui.

## 2. Conquistas
Arquivos: educacao.js, styles.css, tests/jornada-silk-ui.test.mjs.
Interface: aprendizagem[].conquistas (chave,titulo,pontos,em,formacaoVersao,tipo), aprendizagem[].eventos/historico.
- [x] Testar que uma conquista mostra pontos reais, data, versão e tipo, preservando histórico quando curso não está liberado.
- [x] Renderizar resumo, marcos pessoais e próximo marco apenas com curso liberado e critério conhecido. Sem ranking, nível inventado ou nova pontuação.
- [x] Confirmar reenvio, mudança de versão e prática pendente nos testes existentes.

## 3. Importação e dados da gestão
Arquivos: escola-catalogo.js, CSS em bloco próprio de styles.css, tests/importacao-jornada-ui.test.mjs.
Interface: planejar(), previaHtml(), executarPlano(), aoProgresso(), ESTADO_ENVIO.
- [x] Testar filtro de situação/tipo/área e totais coerentes sem alterar plano.
- [x] Adicionar quatro etapas, seleção clara, filtros e exceções primeiro, detalhes recolhíveis, progresso confirmado e resultado com links aos rascunhos.
- [x] Preservar IDs usados pelos testes, proteção de alteração concorrente, falha parcial e repetição segura.
- [x] Rodar testes de importação e escola-trilhas-ui.

## 4. Integração e aceite
- [x] Rodar `node --test tests/*.test.mjs` (Node 24), checar sintaxe e `git diff --check`.
- [x] Montar pacote público com a lista explícita do workflow, sem conteúdo privado.
- [x] Conferir desktop e celular pela prévia isolada: início, curso, aula, conquistas, importação válida; erro e falha parcial cobertos pelos testes automatizados.
- [x] Revisão independente do diff e correção dos achados reais.
- [x] Registrar verificações e manter a implementação local para aprovação de publicação.

## Resultado da verificação — 20/10/2026

- Base: 386 testes. Entrega: **400 aprovados, zero falhas**, Node 24.19.0.
- 14 testes novos: 7 de jornada/conquistas e 7 de importação.
- Revisão independente identificou promessa indevida de pontos numa reciclagem: corrigida no próximo marco, mapa, cabeçalho e regras da aula, com teste de regressão.
- Prévia isolada: leitura confirmada, atualização de progresso e próxima aula; importação de um curso e um material fictícios, confirmados como rascunhos; filtros e ações de gestão.
- Responsividade: desktop de 1280 px e celular de 390 px; sem transbordamento horizontal na jornada. As etapas da importação recolhem a seleção anterior.
- JavaScript com sintaxe válida e pacote estático com 31 arquivos da lista pública do workflow. Este projeto não depende de um build de bundler.
- Prévia desativa o service worker: o 404 de `sw.js` nesse ambiente é esperado. Cache e arquivos de produção deverão ser conferidos somente depois de uma publicação autorizada.
- Nenhuma mudança em servidor, permissões, modelo de dados ou regras de pontuação. Nenhuma escrita de dados em produção.
- Implementação local concluída. **Publicação não realizada.**
