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
