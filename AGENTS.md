# Protocolo do Pops & Fabricação (Escola Impresilk)

## Antes de trabalhar

Atualize as referências com `git fetch origin` e leia `origin/main:AGENTS.md` e `origin/main:VEZ.md`. Se a vez for de outro agente, pare e consulte o dono. Trabalhe num clone ou worktree fora do iCloud, em `~/Projetos` ou `/tmp`, com ramo próprio. Preserve alterações de outras sessões e inclua somente arquivos da tarefa em cada commit.

## Registros e segurança

Este repositório é público. Não coloque dados reais, credenciais, documentos privados, conteúdo empresarial integral nem cópias do banco em arquivos versionados: o conteúdo da escola (base de conhecimento, unidades, avaliações, materiais) mora no servidor (`pops_config_global`, `pops_registros`, bucket privado), nunca no JavaScript público. Preserve IDs, atribuições, históricos, leituras e evidências. Mudanças de dados em produção exigem autorização específica e recuperação prevista; prefira os caminhos da própria aplicação (funções do `pops-sync` com crachá) a escrita direta no banco.

## Verificação e publicação

Rode `pnpm test` (ou `node --test tests/*.test.mjs`, Node 24) antes de declarar uma implementação concluída e confira o comportamento pedido e as regressões pertinentes na tela. Publicação e merge exigem autorização específica. O push na main publica a tela (workflow Deploy, que roda os testes antes); a função `pops-sync` e as migrações sobem separadas, e o servidor vai antes da tela que depende dele. Uma publicação só está concluída após a verificação da versão em produção; teste local ou commit não comprova publicação.

`AGENTS.md` e `CLAUDE.md` devem ter conteúdo idêntico. Registre a vez e o escopo em `VEZ.md`; não transfira a vez sem decisão do dono.
