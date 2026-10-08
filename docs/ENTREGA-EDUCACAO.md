# Painel de Educação Impresilk — entrega

08/10/2026 · publicação autorizada pelo usuário. Migração aditiva e função versão 47 verificadas em produção; a interface será entregue pelo fluxo de publicação deste commit.

## O que muda para quem aprende

A entrada passa a ser o Painel de Educação. A primeira área mostra a formação pessoal e o próximo passo, com cartões compactos, progresso, conquistas e referências de trabalho. POPs, Fabricação, Meu aprendizado, Conhecimento, Equipe e Acompanhamento anteriores continuam acessíveis conforme as permissões existentes.

Uma nova jornada começa com sete etapas editáveis: cultura, Código de Ética, caderno da função, POPs, prática acompanhada, avaliação e educação contínua. A gestão pode alterar a ordem, os pré-requisitos, a obrigatoriedade, os critérios, os pontos e a duração quando conhecida. A estrutura inicial fica em preparação: não contém procedimentos inventados nem avaliações presumidas.

Cada unidade reúne objetivo, importância, execução correta, erros a evitar e evidência esperada. Pode referenciar POPs e treinamentos existentes, além de documentos, imagens e vídeos por links HTTPS autorizados. Os registros de abertura, leitura, ciência, compreensão e validação prática são separados.

As avaliações mostram nota, explicação e orientação sobre o que revisar. Há limite configurável de tentativas. A prática exige evidência, checklist e avaliação por outra pessoa autorizada. A própria pessoa não pode validar sua prática.

## Identidade, permissões e acompanhamento

- A autenticação pessoal existente é mantida. O servidor resolve a conta e seu ID único no RH; digitar um número não concede acesso.
- Nome, função e setor vêm do vínculo RH. Escolher uma formação não altera cargo ou setor.
- A atribuição aceita pessoa, função e setor. A liberação por função feita por gestor fica limitada aos setores que ele pode gerir, inclusive quando seu escopo diminui posteriormente.
- O colaborador consulta seu aprendizado. O instrutor é uma capacidade específica, com setores e etapas designados; não recebe acesso administrativo nem respostas privadas de outras avaliações.
- Gestores acompanham as pessoas dos seus setores. Administradores organizam a escola e os responsáveis. Históricos legados sem vínculo confiável permanecem preservados para conferência administrativa.
- A gestão vê jornadas iniciadas e concluídas, pessoas que ainda não começaram, práticas aguardando validação e necessidades de revisão. A busca localiza pessoa ou jornada.

## Como progresso, pontos e versões funcionam

- Progresso: etapas obrigatórias concluídas e com fonte vigente, dividido pelo total de etapas obrigatórias. Etapas complementares não impedem a conclusão da parte obrigatória.
- Pontos: quantidade configurada na etapa, concedida pelo servidor ao cumprir seu critério. Aberturas repetidas e reenvios não geram pontos extras. Uma reciclagem da mesma etapa mantém as conquistas anteriores sem conceder os pontos novamente.
- Avaliação: percentual de respostas corretas, comparado ao mínimo configurado. Gabaritos não são enviados ao aluno antes da resposta.
- Prática: o envio fica aguardando validação; somente a aprovação do responsável permite concluir. Pontos não constituem autorização operacional.
- Versão: alterações pedagógicas exigem nova versão. Fontes mudadas ou não conferidas bloqueiam a etapa e indicam revisão. Conclusões, tentativas, ciência e validações anteriores são preservadas com datas e referências.
- Reciclagem: a gestão registra motivo e reinicia o acompanhamento atual mantendo a evidência anterior no histórico.
- Não foi criado ranking público. O reconhecimento é pessoal, por etapas e competências demonstradas.

## Correção da gravação e do aviso contraditório

A falha reproduzida estava no tratamento de armazenamento: uma falha ao gravar podia deixar a fila aparentemente vazia, e a interface interpretava a ausência de itens como sincronização concluída. A migração de cache também precisava preservar a origem quando não houvesse espaço para gravar a nova cópia.

O estado agora distingue confirmação, consulta parcial, falha, envio pendente e alteração não gravada. O cabeçalho também considera os envios da escola. A fila só é confirmada após resposta válida do servidor. O cache antigo não é apagado para liberar espaço.

Na escola, cada comando recebe um identificador persistido antes do envio. Se a conexão cair depois de o servidor gravar, recarregar e tentar novamente usa o mesmo identificador. O servidor confere também ação e autor; não duplica pontos nem retorna uma resposta privada de outra atividade.

Quando não for possível nem preservar o envio no aparelho, ele não é enviado e o formulário permanece aberto com orientação. Rascunhos legados que só estejam em memória podem ser baixados; fechar o navegador antes disso pode perdê-los. Não existe recuperação garantida de conteúdo que o aparelho nunca conseguiu gravar.

O cache de gestores foi separado e os dados pessoais exigem consulta completa autorizada na sessão. Mudanças de escopo não deixam o acompanhamento mostrando registros antigos de outros setores. Filas anteriores permanecem preservadas para conferência.

## Fontes conferidas e preparação ainda necessária

O levantamento está em [FONTES-EDUCACAO.md](./FONTES-EDUCACAO.md). Foram conferidos os 11 PDFs do pacote de cadernos, suas versões, páginas e hashes. O Código integral localizado é a versão 2026.2, com 50 páginas. O treinamento legado de ética é um resumo de versão 1.0; não foi tratado como o documento integral.

Os 31 POPs e quatro treinamentos do retrato consultado estavam identificados como semente inicial, sem evidência suficiente para considerar toda a formação tecnicamente homologada. A gestão precisa confirmar fontes oficiais, preparar os recortes de cada função, suas perguntas e os checklists, e designar responsáveis pela prática.

Os arquivos empresariais não foram colocados no site público. O pacote privado de preparação está em `outputs/Educacao_Impresilk_2026-10-08/fontes-para-preparacao.json`, fora deste repositório. Links de documentos externos precisam ter sua versão e o acesso dos colaboradores conferidos. O editor aceita referências HTTPS; não foi criado um novo serviço de upload privado de PDFs.

## Verificação

A simulação utiliza a interface real e o handler do servidor com uma base fictícia isolada. Não cria alunos, leituras, avaliações ou conquistas em produção.

Foram exercitados o ciclo completo de aprendizado, nova tentativa com feedback, validação por outra pessoa, recarga, consulta em outra sessão autorizada e uma resposta perdida após gravação no servidor. A conferência visual inclui computador e celular, sem transbordamento horizontal. A suíte também cobre permissões, paginação, conflitos, idempotência, alterações de versão, cache cheio, preservação do legado e a migração SQL em banco de teste.

Verificação para publicação: suíte automatizada e **14 verificações no navegador, sem erros de execução da página**. Os detalhes e hashes estão em `VERIFICACAO-EDUCACAO.json`. A simulação entre sessões prova a persistência no servidor de teste; não constitui homologação entre aparelhos reais com o serviço publicado.

## Publicação e limites da prévia

Prévia local: `http://127.0.0.1:5216/`. As pessoas, conteúdos e resultados dessa prévia são fictícios e sinalizados na própria tela. É possível alternar entre colaboradora, instrutor e gestão.

A migração aditiva `0004_escola.sql` e `pops-sync` com `_shared/escola.ts` (versão 47) foram publicadas. O código publicado foi comparado com o código testado. As contagens do acervo permaneceram iguais, e as permissões do banco continuam restritas ao servidor. A interface segue pelo GitHub Pages; o encerramento da publicação depende da confirmação do fluxo e dos arquivos públicos.

A conferência da Central encontrou 11 contas ativas com acesso à escola: 10 com ID RH válido, sem IDs compartilhados, e a conta administrativa `teste` sem vínculo. Nenhum vínculo foi criado por aproximação de nome. A escola mantém vários conteúdos e jornadas por pessoa, com progresso independente. Leituras avulsas podem ser cadastradas em Conhecimento e atribuídas individualmente; jornadas podem ser liberadas por pessoa, função e setor.

Os registros novos da escola precisam de conexão e confirmação do servidor. A consulta aos procedimentos já sincronizados conserva o funcionamento anterior sem internet. A prévia não certifica pessoas nem libera atividades de trabalho.
