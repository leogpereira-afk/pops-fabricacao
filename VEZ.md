# Vez do Pops & Fabricação

## Trabalho atual · Jornada pessoal por RH e equipe existente

Agente: codex. Complemento autorizado por Léo em 20/10/2026: jornadas individuais, vídeos, habilidades de atendimento e situações difíceis, estudo flexível e incentivo visual com Silk. Equipe escolhida pelo dono: a equipe de trabalho já cadastrada. Mesmo ramo `codex/jornada-silk-20261020`, clone `/tmp/pops-jornada-20261020`.

Implementado e conferido localmente em 20/10/2026:
- plano individual pela ficha do RH e equipe de origem conferida por ID, sem cadastro paralelo;
- montagem administrativa com cursos, ordem, prazos, orientações e contexto;
- experiência do aluno com objetivo, próximo passo, equipe e incentivo após avanço confirmado;
- modelos editáveis de habilidades para a vida e o trabalho e atalhos para os editores de curso/vídeo;
- proteção de dados por perfil, revisão concorrente, reenvio idempotente e histórico preservado;
- 442 testes aprovados, sintaxe JavaScript, pacote estático de 34 arquivos, revisão independente e navegação em desktop e celular;
- abertura direta do editor e salvamento conferidos depois da confirmação do vínculo RH.

Contrato e uso em `docs/JORNADAS-PESSOAIS.md`; execução em `docs/superpowers/plans/2026-10-20-jornada-pessoal.md`. Prévia usa somente dados fictícios.

Não publicado. Para publicar, após autorização e nova leitura do protocolo remoto: migração aditiva `0007_planos_aprendizagem.sql`, função `pops-sync`, tela e conferência produtiva. Nenhuma pessoa real recebeu curso nesta etapa.

Vez: codex (implementação local concluída; publicação pendente).

## Trabalho atual · Jornada, conquistas e importação com Silk

Agente: codex. Léo aprovou em 20/10/2026 implementar as três etapas da proposta: jornada do aluno, conquistas e importação guiada, com cards compactos e celular. Ramo `codex/jornada-silk-20261020`, clone `/tmp/pops-jornada-20261020`. Preservar regras de dados e servidor. Publicação não autorizada nesta etapa.

Implementado e conferido localmente em 20/10/2026:
- jornada com próxima aula elegível, mapa vertical e uma ação para registrar leitura;
- conquistas com pontos, data e versão confirmados, sem promessa de pontos duplicados em reciclagens;
- importação em quatro passos, conferência filtrável e links somente para rascunhos confirmados;
- cards compactos, ações da gestão e conferência no desktop e no celular;
- 400 testes aprovados, sintaxe JavaScript e pacote estático conferidos. Detalhes em `docs/superpowers/plans/2026-10-20-jornada-silk.md`.

Não publicado. A prévia usa pessoas e registros fictícios. A publicação ainda requer autorização explícita e nova conferência do estado remoto.

Vez: codex (implementação local concluída; publicação pendente).

## Trabalho atual · Silk na jornada, cursos por área e auditoria de jornada e design

Agente: claude. Pedido do Léo em 15/10/2026: "vamos usar o Silk na jornada dos treinamentos, preciso de uma auditoria na qualidade de jornada e designer e preciso aprofundar nos cursos, eles vão ter áreas: comercial = vendas, atendimento e designer; produção = PCP, acabamento, serralheria, letras caixa, máquinas CNC, impressão, montagem interna e montagem externa; adm = financeiro e RH; me ajude a lembrar o que falta para a Impresilk". Ramo `claude/silk-areas-20261015`, worktree em ~/Projetos/pops-escola-20261014.

O pacote de 14/10 ainda não foi importado (só o curso de Ética existe em produção): os cursos são reorganizados e aprofundados no pacote, fora deste repositório. A prévia local (`scripts/revisao-educacao.mjs`) aceita `EDUCACAO_PACOTE` para mostrar a jornada com o pacote, sem dado real no repositório.

Publicado e conferido em 15/10/2026, com a autorização do Léo ("publica depois da revisão"):
- função pops-sync v60, do commit 73f02e2 (resumo e palavras-chave no catálogo do curso);
- tela pelo merge 101ce8a (PR 6), Deploy verde: ESCOLA_TELA_VERSAO 2026.10.15-silk e sw pops-shell-v20-silk, com os arquivos do ar iguais aos do commit e as imagens do Silk respondendo;
- revisão independente com 4 lentes e verificação adversarial: 11 achados confirmados, corrigidos em 73f02e2; 386 testes.

Cursos (19/10/2026): o pacote v2 (111 cursos por área, 57 aprofundados e 54 novos, cada um com redação e revisão) fica fora deste repositório e entra pela tela, em Escola > Importar pacote. Conferido antes com a tela e o servidor deste commit em sandbox: prévia sem erro, 111 cursos e o catálogo gravados como rascunho, repetir sem gravar de novo. Ainda não importado: em produção só existe o curso de Ética.

Fica com o dono: importar o pacote, aprovar as provas, conferir os documentos oficiais e responder as confirmações levantadas pelos cursos (quem valida a prática, cargos do RH, alçadas, nota mínima, entre outras).

Vez: LIVRE. O Léo decide quem segue.

## Trabalho atual · Trilha do Mubisys, formações por função e auditoria da escola

Agente: claude. Pedido de Léo em 14/10/2026: "usar a inteligência adquirida do Mubisys e colocar uma trilha de curso dele de todas as áreas, financeiro, RH, comercial; pegar materiais no site e rodar uma auditoria de melhoria no site; colocar tudo no sistema; na formação colocar adm, financeiro, designer, vinculado a todos os tipos de vagas e vinculado ao RH também; fazer isso como um reitor de cursos profissionalizantes". Decisões dele na mesma conversa: assumir a vez e criar este protocolo (o repositório não tinha); materiais do site e da ajuda do Mubisys mais o que já existe; auditoria do próprio sistema de POPs; publicar depois da revisão. Ramo `claude/escola-mubisys-20261014`, worktree em ~/Projetos/pops-escola-20261014.

Pedido seguinte do Léo no mesmo dia, mesmo ramo: "o acesso na escola é feito pelo id do RH e o seu primeiro nome minúsculo. a senha isso fica pros adm e já faz automático na configuração da escola". Entrada do aluno feita como porta estreita (contrato em docs/INTEGRACAO-RH.md); publicar na ordem migração 0006, pops-sync, tela.

Revisão da entrada do aluno (14/10/2026, mesmo ramo): crachá do aluno em chave própria (`pops_cracha_aluno`), que a Entrada Única do Painel não toca; limite por IP só pelo `cf-connecting-ip` ou pelo item da direita do `x-forwarded-for`; contadores novos por primeiro nome (20) e do total (300); tentativa bloqueada sem linha nova; administração vê e libera os bloqueios. Antes de publicar: conferir num projeto de teste quais cabeçalhos de IP chegam à função. Decisão do dono em aberto: o limite de 30 por IP vale para a rede inteira da fábrica.

Publicado e conferido em 14/10/2026, com a autorização do Léo:
- migração 0006 aplicada (pops_entrada_aluno_20261014);
- função pops-sync v59, do commit f6b172a;
- tela pelo merge 855298d (PR 2), Deploy verde: ESCOLA_TELA_VERSAO 2026.10.14-aluno-2 e sw pops-shell-v19-aluno, lidos no endereço público;
- na tela da administração: os quatro destinos e o menu Escola, a Matriz de cargos com os cargos do RH e as vagas sem cargo, e o cartão Entrada do aluno ligado e sem bloqueio.

Os cursos não moram neste repositório. O pacote (catálogo e cursos em rascunho) fica fora dele e entra pela tela, em Escola > Importar pacote, pela administração. Foi conferido antes com a tela e o servidor deste commit em sandbox: prévia sem erro, tudo gravado como rascunho e repetir sem gravar de novo.

Fica com o dono:
- importar o pacote, aprovar as provas e conferir os documentos oficiais de cada aula;
- definir quem valida as práticas (hoje só a administração);
- decidir se o aluno vê as Referências da empresa e os cursos que ainda não foram liberados para ele;
- o limite de 30 por rede da fábrica (o cartão libera na hora).

No RH, com a vez do RH: as vagas sem cargo e a área Direção.

Depois do PR 3, no mesmo dia: o Deploy de 30e647b caiu num teste da tela que esperava um número fixo de voltas pela gravação da validade (o submit não devolve a gravação; no CI mais lento ela não tinha chegado). A tela no ar não mudou. O teste passa a esperar a gravação (PR 4, só o teste).

Vez: LIVRE. O Léo decide quem segue.
