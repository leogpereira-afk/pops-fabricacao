# Manuais na Escola Implementation Plan

**Goal:** Preparar treinamento vinculado a cada manual, preservando identidade, revisões e recompensas.
**Architecture:** Adaptador de origem autenticada em módulo próprio; formações e aprendizagem continuam nas coleções existentes. Interface compacta de preparação liga os editores e a jornada RH existentes.
**Tech Stack:** JavaScript, TypeScript/Deno, Supabase, testes Node 24 e prévia HTTP.
**Spec:** docs/superpowers/specs/2026-10-24-manuais-escola.md

## Global Constraints
- Sem publicar ou gravar dados reais.
- Vínculos por ID; pontos confirmados no servidor; histórico preservado.
- Origem pendente bloqueia publicação e avanço. Fotos restritas não são propagadas.

### 1. Integração e regressões
- [x] Criar tests/maquinas-escola.test.mjs: admin sem origem recebe 403; aluno não consulta; criar duas vezes conserva ID; fonte pendente impede publicação; fonte alterada impede avanço; foto restrita não sai.
- [x] Executar `node --test tests/maquinas-escola.test.mjs` antes e depois do módulo.
- [x] Criar supabase/functions/_shared/maquinas-escola.ts: `criarMaquinasEscola(ctx)` produz `operar(body)`, `pendencia(f)`, `decorar(f)`, `validarEdicao(f,anterior)`.
- [x] Integrar escola.ts e pops-sync; conferir a origem em leitura, publicação, aprovação e registro, sem mudar motor de pontos.

### 2. Gestão e aluno
- [x] Criar escola-maquinas.js com renderização administrativa, busca, foto, revisão, botão gerar/abrir/atualizar rascunho e atalhos para vídeo e alunos.
- [x] Integrar app, catálogo, editor, pacote estático e service worker. Exibir origem e pendência em curso, foto autorizada e Silk existente.
- [x] Usar mutationId estável em reenvio, revisão esperada e guardas de identidade/rota em respostas tardias.
- [x] Conferir UI com fixtures, sem aluno real.

### 3. Prévia e fechamento
- [x] Adicionar fonte fictícia e sessão de origem simulada ao servidor de revisão.
- [x] Rodar `node --test tests/*.test.mjs`, sintaxe e `git diff --check`.
- [x] Conferir geração, edição, vínculo de vídeo, pessoa/equipe, incentivo e celular. Salvar captura privada.
- [x] Registrar resultados e limitações, manter ramo local sem publicação.

Conferência concluída com fixtures e interface local. Vídeos reais e a integração publicada não foram ativados nesta etapa. A biblioteca de vídeos existente foi reutilizada; não se declarou que há vídeos reais para cada modelo.
