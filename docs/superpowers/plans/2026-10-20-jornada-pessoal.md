# Jornada pessoal e incentivo com Silk

> Execução: subagent-driven-development, tarefas delimitadas e revisão integrada.

**Objetivo:** melhorar a experiência visual e permitir que a administração organize o desenvolvimento de uma pessoa identificada pelo RH, com equipe de trabalho existente, cursos/vídeos e atividades flexíveis.
**Arquitetura:** preservar o motor de aprendizagem; planos pessoais referenciam cursos por ID e têm armazenamento próprio. Equipe é consultada do cadastro existente, sem equipe paralela nem associação por nome. O aluno recebe somente seu plano e seus registros autorizados.
**Tecnologia:** JavaScript/CSS existentes, Supabase Edge Functions, Node 24 e testes DOM/banco.
**Especificação:** pedido do Léo neste turno, autorizado para implementação local. Não publicar nem executar mudanças produtivas.

## Restrições
- Preservar IDs, históricos e pontuação; eventos celebrados somente após confirmação do servidor.
- Nenhum ponto por abrir página ou repetir atividade já premiada.
- Pessoas vêm do RH e equipe de trabalho vem da origem confirmada por ID. Sem inferência por nome, cargo ou setor.
- Sem cadastro de turmas, ranking público ou comparação entre funcionários.
- Atividades flexíveis podem ser estudadas em casa. Práticas de equipamento continuam acompanhadas.
- Cards compactos, teclado, celular, redução de movimento; nenhum som automático, explosão de confetes ou animação interminável.
- Conteúdo empresarial real e dados de pessoas permanecem fora do repositório público.

## 1. Servidor: planos e equipe
Arquivos: supabase/functions/_shared/escola.ts; pops-sync/index.ts; migração aditiva; testes de servidor e banco.
- [x] Confirmar a origem de equipes nos contratos atuais do PCP/RH em leitura.
- [x] Criar coleção `planos_aprendizagem`, operações `salvarPlano` (admin) e retorno filtrado no painel.
- [x] Contrato: plano `{id,colaboradorId,titulo,objetivo,equipeId,itens:[{formacaoId,prazo,contexto,orientacao}],ativa,_serverRevision}`; contexto `empresa` ou `flexivel`. IDs por pessoa, itens únicos em ordem, datas válidas e limites de texto.
- [x] Painel: `planoPessoal`, `equipeTrabalho`; gestão recebe `planos`, `equipesTrabalho` e `podeMontarJornada`. Equipes `{id,nome,colaboradorIds}` e estados de vínculo explícitos.
- [x] Salvar exige RH ativo, cursos existentes e publicados, autorização, revisão concorrente e reenvio idempotente. Plano ativo libera os cursos referenciados para a pessoa; inativação não apaga histórico.
- [x] Testar privacidade no painel/list/get/backup, equipes inválidas, cursos fora do escopo, duplicação, concorrência e conservação de histórico.

## 2. Gestão: montar a jornada da pessoa
Arquivos: novo escola-jornadas.js, escola-gestao.js, app.js/index.html/workflow se necessário; CSS próprio; testes UI.
- [x] Em Alunos, ação `Montar jornada` abre pessoa RH por ID.
- [x] Lista compacta de cursos, busca, adição e remoção, botões subir/descer acessíveis; título, objetivo, equipe existente, prazo e orientação por curso; contexto empresa/flexível.
- [x] Prévia da ordem antes de salvar; sucesso somente confirmado; conflito preserva formulário.
- [x] Atalhos para criar curso e adicionar vídeo usando os editores existentes, sem vídeo fictício nem confirmação automática de avaliação.
- [x] Testar payload, ordem, pessoa, contexto, erro e acesso restrito.

## 3. Experiência do aluno
Arquivos: educacao.js e styles.css; testes de jornada.
- [x] Home prioriza a ordem do plano pessoal, mostra objetivo e equipe e oferece próximo passo elegível.
- [x] Cartões visuais por tipo de atividade, trilha e progresso; incentivo Silk no estudo e avanço confirmado, diferente para leitura, compreensão, espera de validação e curso concluído.
- [x] Retomada de cursos sem prêmios duplicados; falha de gravação não mostra celebração.
- [x] Preparar modelos editáveis de habilidades: atendimento ao cliente, comunicação em situações difíceis e organização pessoal; exercícios de reflexão fictícios, sem promessas de certificação.
- [x] Testar próximos passos, contexto, conteúdo em preparação, confirmação e acessibilidade básica.

## 4. Integração e entrega
- [x] Rodar testes focados e suíte completa, sintaxe, pacote estático e diff-check.
- [x] Conferir criação de jornada e aluno na prévia isolada, desktop/celular, com dados fictícios.
- [x] Revisão independente, registro de limitações reais e arquivos de recuperação locais. Não publicar.

## Verificação final · 20/10/2026

- Node 24: `node --test tests/*.test.mjs`, 442 testes, 442 aprovados, nenhum cancelado ou ignorado; saída 0.
- Sintaxe de todos os JavaScript públicos e pacote estático conforme a lista do workflow: 34 arquivos, 1.260.210 bytes; scripts do HTML e arquivos do cache presentes.
- Prévia isolada: criação de plano administrativo, equipe existente, dois cursos, prazo, orientação e estudo flexível; confirmação do servidor e plano visível somente à aluna correspondente.
- Incentivo após registro confirmado, pontos históricos sem duplicação e acesso ao próximo aprendizado; conferência com teclado e em 320/390 px, sem rolagem lateral.
- Revisão independente encontrou e levou à correção da liberação de cursos para acompanhamento do gestor, preservação de texto durante atualização e descarte de resposta atrasada após navegação. A conferência visual identificou a chegada tardia do vínculo RH na abertura direta; correção, regressões e salvamento revalidados.
- Nenhuma migração, implantação ou atribuição real executada. A integração produtiva exige publicação ordenada e verificação com os acessos reais, conforme o contrato.
