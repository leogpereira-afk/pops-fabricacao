# Auditoria de 06/09/2026

Esta rodada revisou o aplicativo POPs & Fabricação, sua persistência offline, autenticação cliente, função de dados, banco, publicação e telas. Não certifica o conteúdo técnico dos procedimentos de fabricação: materiais, máquinas, EPIs e instruções devem ser validados pelos responsáveis pelo processo.

## Correções

- Equipe registra a própria leitura/progresso; gestor só altera POPs dos setores atribuídos. Alterar o setor do envio não contorna essa regra.
- A equipe consulta somente seus próprios históricos, cadastro vinculado e atribuições. A restrição vale também para consultas diretas, sem depender dos menus.
- Credenciais sem validade futura são recusadas. Erro na consulta de revogação não libera acesso.
- Dados e fila local são guardados juntos e por usuário. Cada confirmação remove somente o envio correspondente; sessões antigas não alteram a nova sessão.
- Erros de gravação e conflitos ficam visíveis. Rascunhos podem ser baixados e são preservados quando o usuário recupera a versão do servidor.
- Paginação usa data e identificador; coleções não são silenciosamente cortadas em 40 páginas.
- Escrita e revisão do banco são atômicas; versões concorrentes são rejeitadas. Arquivamento conserva conteúdo e permite restauração.
- O espelho mínimo do RH preserva vínculos locais, ignora arquivados, consulta a base inteira e recusa arquivar a equipe inteira quando a origem está inesperadamente vazia.
- Etapas removidas não contam no progresso. Jornada vazia não é concluída. Treinamento com versão nova exige nova confirmação. Datas sem horário mantêm o dia no Brasil.
- Menu adaptado a celular, títulos azuis, textos auxiliares cinza, logomarca e emojis. Diálogos com foco e Escape; campos rotulados e cartões acessíveis por teclado.
- Etapas da jornada têm cartões próprios, recolhíveis e reordenáveis, conservando o identificador quando o título muda.
- Tela de Pessoas destaca contas não vinculadas e oferece contas ativas da Central. O servidor recusa vínculo com conta inexistente; não há associação automática por semelhança de nomes.

## Verificação local

Requer Node 24 e pnpm 11.19.0:

    pnpm install --frozen-lockfile --ignore-scripts
    pnpm test

Os testes executam o código real da função com banco simulado, a fila em armazenamento simulado e a migração em PostgreSQL local (PGlite). Os testes de banco cobrem restauração, conflito, repetição do mesmo envio, revisões, configuração parcial, privilégios e espelho com 1.001 pessoas fictícias.

A conferência do navegador está em `tests/visual.mjs`. Requer Playwright; `PLAYWRIGHT_MODULE` pode apontar para uma instalação existente e `CHROME_PATH` para o navegador. Todas as chamadas são interceptadas com dados fictícios. `AUDIT_OUTPUT` define a pasta das imagens. Foram realizadas 68 verificações de tela: 13 rotas de gestão, 12 de gestor e 9 de equipe, em duas larguras; além de leitura, edição de etapa, mapa, permissões de formulários e diálogo. Isso não equivale a verificar toda combinação de dados reais, todos os navegadores ou acessibilidade assistiva completa.

## Publicação e retorno

1. Preservar cópia da versão anterior e verificar os testes.
2. Aplicar `supabase/migrations/0002_auditoria_integridade.sql` no projeto do sistema. Não executar os arquivos de `seed/` sobre uma base já utilizada: são scripts históricos de implantação e podem substituir conteúdo.
3. Publicar `pops-sync` com autenticação própria e `verify_jwt=false`.
4. Publicar o site; a integração do GitHub executa os testes antes de publicar somente a lista explícita de arquivos públicos.
5. Conferir a função ativa, o workflow e o site publicado. Não criar leituras, contas ou vínculos fictícios em produção.

A migração é aditiva e preserva os registros existentes. Se for necessário retornar o site/função anterior, manter as colunas e rotinas do banco: não desfazer com exclusão de dados. O app anterior usa o armazenamento legado; a migração do cache ocorre por conta. Rascunhos e fila da versão nova devem ser exportados antes de qualquer retorno ao app antigo.

## Pendências de cadastro observadas

Na consulta de 06/09/2026 havia 40 pessoas ativas e nenhuma conta vinculada. A gestão precisa confirmar a identidade de cada conta para os treinamentos atribuídos aparecerem em “Meus”. Não foram criados vínculos ou alteradas senhas reais nesta auditoria. O bucket privado de arquivos do POPs estava vazio.
