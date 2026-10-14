# Vez do Pops & Fabricação

## Trabalho atual · Trilha do Mubisys, formações por função e auditoria da escola

Agente: claude. Pedido de Léo em 14/10/2026: "usar a inteligência adquirida do Mubisys e colocar uma trilha de curso dele de todas as áreas, financeiro, RH, comercial; pegar materiais no site e rodar uma auditoria de melhoria no site; colocar tudo no sistema; na formação colocar adm, financeiro, designer, vinculado a todos os tipos de vagas e vinculado ao RH também; fazer isso como um reitor de cursos profissionalizantes". Decisões dele na mesma conversa: assumir a vez e criar este protocolo (o repositório não tinha); materiais do site e da ajuda do Mubisys mais o que já existe; auditoria do próprio sistema de POPs; publicar depois da revisão. Ramo `claude/escola-mubisys-20261014`, worktree em ~/Projetos/pops-escola-20261014.

Pedido seguinte do Léo no mesmo dia, mesmo ramo: "o acesso na escola é feito pelo id do RH e o seu primeiro nome minúsculo. a senha isso fica pros adm e já faz automático na configuração da escola". Entrada do aluno feita como porta estreita (contrato em docs/INTEGRACAO-RH.md); publicar na ordem migração 0006, pops-sync, tela.

Revisão da entrada do aluno (14/10/2026, mesmo ramo): crachá do aluno em chave própria (`pops_cracha_aluno`), que a Entrada Única do Painel não toca; limite por IP só pelo `cf-connecting-ip` ou pelo item da direita do `x-forwarded-for`; contadores novos por primeiro nome (20) e do total (300); tentativa bloqueada sem linha nova; administração vê e libera os bloqueios. Antes de publicar: conferir num projeto de teste quais cabeçalhos de IP chegam à função. Decisão do dono em aberto: o limite de 30 por IP vale para a rede inteira da fábrica.

Estado: protocolo criado; levantamento em andamento. A vez é do Claude até a publicação; o Léo decide quem segue.
