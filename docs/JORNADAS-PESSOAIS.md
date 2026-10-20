# Contrato de jornadas pessoais

Implementação de 20/10/2026. Publicação autorizada por Léo após a aprovação da prévia, incluindo as salas ilustradas e o Silk.

## Origem da equipe de trabalho

Conferido em leitura após `git fetch origin`, com PCP e RH livres:

- PCP `7235623219bd16f6e75617d891925cd3646767f4`: `supabase/functions/pcp-sync/index.ts`, leitura de `config.performancePCP.equipes`; `supabase/functions/_shared/pcp-integridade.mjs`, `idDoMembro`, `idDoCadastroRH` e `idsAnterioresDoCadastro`.
- RH `7607baf367bbcc9be9a68dba2587fa739e0d9a1e`: `supabase/functions/rh-programacao/index.ts`, identidade da ficha separada do ID pessoal do PCP.

A consulta usa somente `pcp_config_global`, linha `id=true`, projeção `equipes:config->performancePCP->equipes`. Não cria equipes, turmas ou grupos de aprendizagem. Cada equipe ativa conserva seu `id` e `nome`; `membros[].chave` é relacionado com `registros.id` da ficha RH, `registro.idPessoa` ou um dos `idPessoaAnteriores` explícitos. Identificador ambíguo, ficha inativa/desligada ou bloqueada não gera associação. O motivo textual de `idPessoaBloqueado` também bloqueia. Nenhuma associação por nome, apelido, cargo, setor ou cálculo a partir de CPF.

A escola continua usando `colaboradorId = registros.id` e `pessoa.id = p-<colaboradorId>`. O ID pessoal do PCP e seus anteriores ficam somente na memória da requisição, nunca no plano, na resposta ou em arquivo. Uma equipe que usa apenas nome/apelido legado sem identificador exato pode ficar sem associação nesta integração. Corrigir a origem compete ao PCP/RH; a escola não a modifica.

## Painel

`{action:'escola',operacao:'painel'}` retorna os campos existentes mais:

- `planoPessoal`: plano ativo da própria ficha ou `null`.
- `equipeTrabalho`: `{estado:'vinculada',id,nome}` ou `{estado:'sem_equipe'|'multipla'|'sem_vinculo'|'indisponivel'}`. Se a pessoa está em mais de uma equipe, o plano pode selecionar uma delas; sem seleção, o estado é `multipla`.
- `gestao.podeMontarJornada`: apenas administração.
- `gestao.planos`: planos ativos/inativos, com `_serverRevision`, somente para administração; demais perfis recebem `[]`.
- `gestao.equipesTrabalho`: `[{id,nome,colaboradorIds}]`, somente para administração; demais perfis recebem `[]`.
- `gestao.estadoEquipesTrabalho`: `disponivel` ou `indisponivel` na visão da Central. A visão restrita de aluno não recebe esse campo nem listas de colegas.

Indisponibilidade do PCP é explícita e não derruba a aprendizagem. É possível salvar sem equipe (`equipeId:''`). Nenhuma equipe selecionada libera cursos para os colegas: a atribuição continua individual.

## Salvar

`{action:'escola',operacao:'salvarPlano',plano,expectedRevision,mutationId}` exige crachá administrativo.

```json
{
  "colaboradorId": "ficha-ficticia",
  "titulo": "Jornada fictícia",
  "objetivo": "Praticar uma habilidade",
  "equipeId": "",
  "itens": [
    {
      "formacaoId": "curso-ficticio",
      "prazo": "",
      "contexto": "flexivel",
      "orientacao": "Refletir sobre um exemplo fictício"
    }
  ],
  "ativa": true
}
```

`id` é opcional na criação e determinístico no servidor: `plano-` seguido do SHA-256 de `colaboradorId + '\nplano-pessoal'`. Na edição, se enviado, deve ser o mesmo ID. `_serverRevision` pode acompanhar o plano, mas a revisão usada para concorrência é `expectedRevision` (0 para criar). Demais campos do plano são recusados; autoria, horário, trilha de alterações e pontos nunca vêm do cliente.

Limites: título obrigatório com até 160 caracteres, objetivo e orientação com até 2.000, 1 a 100 cursos únicos na ordem enviada. Prazo é vazio ou uma data real `YYYY-MM-DD`, a partir de 1900. Contexto é `empresa` ou `flexivel`; não muda validação de prática nem regras de equipamento.

A gravação confere a ficha RH ativa diretamente no banco, sem usar o cache do painel. Equipe, quando selecionada, deve existir, estar ativa e conter a pessoa por identificador confirmado. Cursos novos/ativos no plano precisam existir, estar ativos e publicados. Inativar pode conservar referências anteriores de equipe/curso que deixaram de estar disponíveis; nenhuma liberação decorre de plano inativo.

Resposta: `{ok:true,registro,revision}`; repetição confirmada acrescenta `repetido:true`. A perda de resposta pode ser resolvida reenviando exatamente o mesmo comando e `mutationId`. Reutilização com conteúdo ou autor diferente e revisão desatualizada retornam 409. Um comando antigo repetido depois de uma edição posterior também retorna 409, sem desfazer o conteúdo novo. O formulário deve conservar os dados em caso de conflito.

## Acesso, histórico e banco

Coleção `planos_aprendizagem`, isolada das portas genéricas `list/get/upsert/delete/restore`. Somente o backup completo autenticado pelo token de serviço inclui essa coleção. Administração não a recebe no `list` genérico. Auditoria interna `alteracoes` conserva os anteriores, autor e horário; não sai no painel nem na confirmação de salvar, mas integra o backup de serviço.

Plano ativo é concessão adicional somente para os cursos referenciados e publicados/ativos. Preserva as liberações já existentes do curso. O aluno não recebe o plano de outra pessoa. Curso retirado deixa de liberar conteúdo mesmo que o plano ainda o referencie; o histórico de aprendizagem segue preservado. Bibliotecas e arquivos continuam exigindo material publicado/ativo e a versão exata referenciada pelo curso. IDs iguais de curso e material não criam liberação direta de material.

O motor de leitura, avaliação, prática, conquistas e pontos não muda. Desativar plano não exclui registros e não zera progresso. Alterações do plano não premiam o aluno.

A migração aditiva `0007_planos_aprendizagem.sql` estende `pops_gravar`, exige revisão/mutação para plano, mantém trava transacional, rejeita repetição concorrente com conteúdo diferente e cria índice único por ficha. Mantém RLS e execução SQL exclusiva de `service_role`. Não executa atualização ou exclusão de dados existentes. Ordem de publicação: migração, servidor, depois tela.


## Como usar

1. Entre pela administração em **Escola → Alunos**. Busque a pessoa e use **Montar jornada**. A ficha é selecionada pelo ID do RH.
2. Informe título e objetivo. A equipe pode ser escolhida somente entre as equipes de trabalho que já têm aquela pessoa vinculada no cadastro de origem.
3. Adicione os cursos publicados e organize com **Subir** e **Descer**. Combine prazo, orientação e contexto de cada curso. O contexto flexível permite estudar em casa ou em outro local tranquilo, no horário combinado.
4. Para material novo, **Adicionar vídeo** abre a biblioteca; vincule o vídeo a uma aula pelo editor do curso. Revise/publice o material e o curso conforme as permissões existentes. Volte e use **Atualizar cursos**; o formulário conserva sua sequência e suas orientações.
5. Em **Habilidades para a vida e o trabalho**, os três modelos — atendimento ao cliente, comunicação em situações difíceis e organização pessoal — abrem como rascunhos editáveis. São sugestões genéricas, sem dados de clientes, sem vídeo inventado e sem avaliação aprovada automaticamente. Escolha o setor e adapte antes de liberar.
6. Confira e salve. A confirmação vem do servidor. Em conflito, o formulário permanece preenchido. Em perda de resposta, **Conferir gravação** reenvia a mesma operação.
7. O aluno encontra objetivo, equipe, cursos em ordem e próximo passo na página inicial. O prazo e a orientação aparecem dentro do curso e das aulas. Pontos seguem os critérios já definidos em cada aula; montagem do plano não gera pontos.
8. Ao concluir uma etapa, o incentivo mostra o registro confirmado e oferece o próximo aprendizado. Uma leitura com prova pendente e uma prática aguardando avaliação têm mensagens próprias. Reabrir uma aula não dá novos pontos.
9. Desativar a jornada preserva o aprendizado e as versões anteriores. Liberações independentes do curso continuam valendo; a jornada não revoga acessos que foram concedidos por outro caminho.

## Material visual

`silk/silk-celebrando-g.webp` e `silk/silk-celebrando-p.webp`: nova ilustração de incentivo, gerada em 20/10/2026 a partir da pose oficial `silk-confiante-g.webp`, preservando a identidade do mascote. Fundo transparente; derivados WebP de 240×360 e 120×180 para reduzir transferência. As outras poses existentes continuam sendo utilizadas. Imagens são decorativas, com texto equivalente do progresso disponível na interface.

## Verificação e limites

A leitura dos contratos reais de PCP e RH foi verificada no código citado; a jornada foi exercitada com dados fictícios e o handler de servidor no ambiente isolado. A migração `pops_planos_aprendizagem_20261020` e a função `pops-sync` v61 foram aplicadas em 20/10/2026. Conferidos índice único, RLS e bloqueio sem sessão. Nenhuma pessoa real foi vinculada a um plano. A prévia reinicia seus registros ao reiniciar o servidor. Os modelos de habilidades precisam de revisão da gestão antes do uso; nenhum material foi publicado para funcionários nesta etapa.


## Publicação verificada

Em 20/10/2026, interface `2026.10.20-silk-salas-2` e shell v24 publicados pelo Deploy 39477017691 (commit c9081b3), após servidor v61. 445 testes aprovados, 41 arquivos públicos comparados e catálogo autenticado verificado em desktop e celular, incluindo Silk, imagens, filtros e ausência de transbordamento. Nenhum registro de aprendizagem real foi alterado durante a publicação.
