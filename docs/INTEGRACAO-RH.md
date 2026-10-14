# POPs — contrato de identidade RH e revisão

Data de referência: 05/10/2026. Alterações deste documento descrevem código local; publicação e sincronização dependem da execução controlada posterior.

## Escopo

Este contrato documenta mecanismos de integração. Diagnósticos com dados reais, contagens da equipe e conteúdo empresarial ficam fora do repositório público. Nenhuma alteração de papel ou concessão de acesso faz parte desta integração.

## Identidade e entrada

- A chave estável é `registros.id` da coleção `colaboradores`, referenciada pela Central em `acesso_conta.colaborador_id`.
- O ID das pessoas POPs permanece `p-<colaborador_id>`. Atribuições, etapas e históricos existentes não são renumerados.
- `apelido` é o login da Entrada Única; não é matrícula nova e não identifica sozinho a ficha.
- Nenhum documento pessoal ou identificador derivado de documento é copiado.
- A tela pode chamar `POST /acesso-entrar` com `{usuario,senha}`. Deve usar apenas `crachas.pops.token`, `crachas.pops.papel`, `usuario`, `nome` e `trocarSenha`; descartar sessões e credenciais dos outros sistemas. Ausência de `crachas.pops` não autoriza fallback automático.
- Se `trocarSenha` estiver ativo, encaminhar para o Painel: a senha provisória da Entrada Única não é a senha legada de `equipe-auth`.

## Consulta `identidadeRH`

Recebe `{action:"identidadeRH"}` com crachá POPs válido. Não aceita identidade indicada no corpo e não escreve dados.

Sucesso: `{ok:true,vinculada:true,pessoa:{id,colaboradorId,nome,funcao,cargoId,areaId,area,setor,statusId,usuario,vinculoOrigem:"central_rh"}}`.

Sem vínculo: `{ok:true,vinculada:false,pessoa:null,motivo}`. Motivos: `sem_conta_pessoal`, `sem_vinculo_central`, `vinculo_ambiguo`, `conta_inativa`, `sem_acesso_pops`, `sem_ficha_rh`, `ficha_indisponivel`, `pessoa_desligada`.

A resolução exige exatamente uma conta, permissão ativa POPs e ficha RH existente, sem desligamento. Não compara nomes parecidos. O banco é consultado com projeção de campos profissionais; CPF, salário, endereço, saúde e identificador pessoal não fazem parte da consulta ou resposta.

A equipe consulta pessoa e atribuições pelo ID RH, mesmo antes de o espelho receber o usuário. Registros de leitura/progresso com `colaboradorId` são recuperados pelo ID; registros legados sem esse campo permanecem filtrados pelo usuário do crachá. A interface deve reconhecer ambos sem renomear IDs históricos. Novo histórico recebe `pessoaId`, `colaboradorId` e nome da ficha conferida pelo servidor. Login reutilizado não permite sobrescrever histórico de outra ficha.

## Sincronização explícita pelo administrador

A migração `0003_identidade_rh.sql` substitui somente a rotina `pops_sincronizar_pessoas`; não a executa. Não altera contas nem permissões.

A ação existente `sincronizarPessoas` continua administrativa. Ela adiciona `colaboradorId`, `cargoId`, `areaId`, setor e situação ao espelho mínimo, com função e área atuais. Preserva observações, usuários antigos, IDs, atribuições e históricos. Somente vínculos já existentes e exatos da Central podem preencher um usuário vazio. Vínculo conflitante não é trocado: ganha `vinculoStatus:"conflito"` e é contado no resultado.

Retorno adicional: `vinculados`, `semConta`, `conflitos`. Mantidos: `ativos`, `desligados`, `arquivados`, `mudou`. A regra de inclusão existente continua baseada em ausência de data de desligamento; uma ficha marcada inativa sem data permanece no espelho como pendência, mas `identidadeRH` não a associa ao usuário.

## Revisão e vínculos do conteúdo

- Alteração de título, setor, objetivo, EPIs, blocos ou responsável exige versão diferente.
- Versão ou conteúdo novo não herda aprovação anterior.
- Para validar, `upsert` precisa de `confirmarRevisao:true` e `revisao.status:"validado"`. O servidor carimba o revisor autenticado e a data; campos de autoria enviados pelo cliente não têm autoridade.
- Fontes: até 30 textos de até 1.000 caracteres.
- Relacionados: até 50 referências únicas `{tipo,refId}` a POP, jornada ou treinamento ativos; rejeita autorreferência, conteúdo ausente/arquivado e tipo inválido.
- `conhecimento` devolve a compilação documental interna mediante autenticação, sem escrita. O conteúdo permanece em `pops_config_global.config.conhecimentoBase`, nunca em arquivo do repositório público. O endpoint de configuração geral omite a base documental para evitar duplicação de tráfego e armazenamento; somente a consulta dedicada a retorna.

## Ordem de entrega

1. Revisar e testar função e migração em ambiente local.
2. Aplicar a migração da rotina; ela não sincroniza dados automaticamente.
3. Carregar a compilação documental no campo privado `conhecimentoBase`, preservando os demais campos de configuração. Publicar `pops-sync/index.ts`, sem arquivos de conteúdo empresarial.
4. Publicar a interface compatível.
5. Rodar sincronização administrativa explícita, conferir contagens e pendências sem criar acessos para os demais colaboradores.
6. Verificar entrada, contexto pessoal, leituras e revisão em ambiente publicado. Nunca declarar que teste local prova publicação.

## Catálogo, famílias de cargo e vagas na escola (14/10/2026)

Código local do ramo `claude/escola-mubisys-20261014`; vale depois de publicar `pops-sync` (servidor antes da tela).

- **Tipo de etapa `aula`.** Conteúdo próprio da escola, inclusive aula de sistema. Conclui pela leitura e, se houver avaliação aprovada, pela compreensão. Não exige POP, treinamento nem material; documentos HTTPS e materiais são opcionais e, quando existem, seguem as mesmas conferências das outras etapas. Mudar a aula exige versão nova.
- **`formacao.catalogo` (opcional, não pedagógico).** `{trilha, area, nivel, cargaMinutos, ordem, familias[], preRequisitos[], codigo}`. Mudar o catálogo não pede versão nova nem derruba avaliação aprovada. Trilha e famílias novas precisam existir no catálogo da escola; pré-requisito entre cursos só recomenda, não bloqueia, e não pode formar círculo. Envio sem o campo conserva o catálogo anterior; `null` retira.
- **Catálogo da escola.** `config.educacao.catalogo = {familias:{id:{nome,descricao,cargos[]}}, trilhas:{id:{nome,descricao,ordem}}}`, gravado só pela operação de administração `configurarCatalogo` (mesmo `pops_configurar`, preservando instrutores e o resto da configuração). Cargo novo de uma família precisa existir no RH. Família ou trilha em uso não pode ser excluída.
- **Liberação por família.** `liberacao.familias[]`, só pela administração (como "todos"). Recebe quem tem, no RH, um `cargoId` listado na família. O gestor pode salvar o curso mantendo as famílias que já estavam. Envio sem o campo conserva as famílias anteriores; lista vazia retira. Vale também para materiais e instrumentos.
- **Grade do RH para quem gerencia.** O painel da escola devolve a admin e gestor `gestao.cargosRH` (todos os cargos do RH, inclusive vazios: `id, nome, areaId, area, trilha, familias`) e `gestao.vagasRH` (vagas prevista, aberta ou em triagem: `id, titulo, cargoId, areaId, area, status, nivelId`). A consulta ao banco projeta só esses campos: nunca faixas, salário praticado, descrição de vaga ou candidatos.
- **Desempenho.** Cada chamada lê uma vez cada registro, coleção e cadastro do RH. Fichas, cargos, áreas e vagas do RH ficam até 60 s na instância da função (sem dado de quem chama) e são relidos ao gravar a configuração da escola; contas e papéis da Central são lidos a cada chamada.
- **Backup do Hub.** Com o x-token de serviço, `list` sem coleção inclui também `formacoes, aprendizagem, materiais, estudos, instrumentos, perfis, capacitacoes` (mesmo formato `_col`, mesma paginação `after`/`nextAfter`), e `getCfg` devolve a configuração completa, com `conhecimentoBase` e `educacao`. Pelo crachá, inclusive de admin, a listagem e a configuração continuam como antes.

## Entrada do aluno pelo ID do RH e primeiro nome (14/10/2026)

Pedido do Léo: "o acesso na escola é feito pelo id do RH e o seu primeiro nome minúsculo. a senha isso fica pros adm e já faz automático na configuração da escola". Código local do ramo `claude/escola-mubisys-20261014`; vale depois de aplicar a migração `0006_entrada_aluno.sql` e publicar `pops-sync` (banco, servidor e só então a tela).

- **Ação pública `entrarAluno` `{id, nome}`**, sem crachá. Confere, nesta ordem: o limite de tentativas no banco; a entrada ligada (`config.educacao.entradaAluno.ativa`, ausente vale como ligada); `id` com exatamente 6 dígitos; exatamente uma ficha viva do RH (`registros`, coleção `colaboradores`, não apagada, sem `dataDesligamento`, `statusId` fora de inativo e abandono) com `registro.idPessoa` igual ao `id`; o primeiro nome da ficha, sem acento e em minúsculas, igual ao informado. Qualquer "não" responde 401 com a mesma mensagem, "ID ou nome não conferem.". A consulta ao RH projeta só `id`, `nome`, `statusId` e `dataDesligamento`; o `idPessoa` serve de filtro e nunca sai. Sucesso: `{ok, token, usuario:"aluno:<colaboradorId>", nome:<primeiro nome>, papel:"aluno", colaboradorId, validoAte}`.
- **Limite de tentativas** (`pops_entrada_aluno` e tabela privada `pops_entrada_tentativas`, RLS ligada, sem acesso de anon e authenticated): cada tentativa conta antes da conferência; 5 erradas do mesmo ID em 15 minutos bloqueiam o ID por 15 minutos; 30 erradas do mesmo IP (`cf-connecting-ip`, senão o primeiro do `x-forwarded-for`) bloqueiam o IP por 15 minutos; entrada certa zera o ID. Bloqueado responde 429 "Muitas tentativas. Tente de novo em 15 minutos.". As chaves chegam cifradas (HMAC com chave derivada do segredo do servidor): o banco não guarda ID nem IP. Banco fora responde 503 e não entrega crachá.
- **Crachá do aluno**: JWT HS256 assinado com a chave derivada `HMAC-SHA256(EQUIPE_JWT_SECRET, "pops-aluno-v1")`, nunca com a chave base (dividida com Painel, RH e PCP). Payload `{sis:"pops-aluno", papel:"aluno", sub:"aluno:"+colaboradorId, colaboradorId, nome, iat, exp}`; validade `config.educacao.entradaAluno.validadeDias` (1 a 30, padrão 7). O verificador da Central só aceita `sis:"pops"` com a chave base; o do aluno só aceita `sis:"pops-aluno"` com a derivada.
- **A cada chamada do aluno**: a entrada segue ligada, `iat` cabe na validade atual, o crachá não é anterior a `ligadaEm` (religar depois de desligar encerra os crachás antigos) e a ficha segue viva no RH. Qualquer "não" responde 401 "Sua entrada de aluno terminou...". Não passa por `acesso_conta` nem pela revogação da Central.
- **O que o aluno alcança**: `ping`, `identidadeRH` (a própria ficha, `vinculoOrigem:"entrada_aluno"`), `rev`, `getCfg` (só `areas`, `setores`, `linhas`, `resumoSetor`), `list`/`get` de POPs, jornadas e treinamentos como a equipe e, de `pessoas`, `atribuicoes`, `leituras` e `progresso`, só o que tem o ID da ficha dele; `upsert` só de `leituras` e `progresso` dele (carimbados com a ficha pelo servidor). Na escola: `painel` (visão de aluno, `gestao` vazia), `registrar`, `academia.biblioteca`, `abrirMaterial`, `registrarMaterial`, `arquivoPDF`, `capacitacoes`, `perfis` e `responderPerfil`, sempre só do próprio. Todo o resto responde 403, inclusive `conhecimento` (referências da empresa), `setCfg`, `delete`, `restore`, `sincronizarPessoas`, fotos, `saude`, salvar, aprovar, validar, reciclar e configurar.
- **Configuração** (`escola`, operação de administração `configurarEntradaAluno {ativa, validadeDias, entradaAnterior}`): grava `config.educacao.entradaAluno {ativa, validadeDias, ligadaEm, atualizadoEm, atualizadoPor}` pelo `pops_configurar`, levando o resto de `educacao` e o valor anterior (409 se outra pessoa mudou antes). O painel da administração devolve `gestao.entradaAluno`. Na tela, cartão "Entrada do aluno" em Gestão de cursos (`#/escola/entrada`).
- **Tela**: a entrada tem duas portas, "Sou aluno" (padrão) e "Administração" (usuário e senha da Central, sem mudança). O aluno vê só Início, Catálogo, POPs e Fabricação e Conhecimento (sem Referências); Sair apaga o crachá, o cache e a fila dele no aparelho e o cache da escola; a entrada de outro aluno apaga o cache dos alunos anteriores.
