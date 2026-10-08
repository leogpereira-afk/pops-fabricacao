# Escola Impresilk — revisão local de 8 de outubro de 2026

Registro da revisão local. Em 08/10/2026, Léo autorizou publicar a evolução. O relato abaixo documenta a preparação; documentos, provas propostas e atribuições da simulação permanecem privados e não são importados por esta publicação.

## Diagnóstico e decisões

A base existente já oferecia autenticação, identidade pelo RH, POPs, jornadas, registros de leitura, avaliações e validação prática. A evolução reaproveita esses mecanismos. As principais lacunas eram a leitura dos documentos completos dentro do ambiente, a aprovação das provas antes da aplicação, a visão central por aluno e as áreas específicas de NRs, desenvolvimento e vídeos.

As novas áreas usam comandos autenticados no servidor, associados ao ID do RH. Um número de matrícula não dá acesso a outra conta. O histórico anterior de POPs, treinamentos, jornadas e conclusões foi preservado; a base de conhecimento anterior continua acessível pela biblioteca.

## O que foi implementado

- **Biblioteca:** materiais integrais, versão, assunto, objetivo, tempo opcional e atribuição por pessoa, cargo e setor. Busca e acesso aos conteúdos anteriores.
- **Vídeos:** cadastro por link do YouTube, reprodução incorporada acionada pelo aluno, busca por assunto, público autorizado e vínculo com etapas dos cursos. Não é necessário colar código HTML. O vídeo permanece no YouTube.
- **Leitor:** texto integral paginado, marcação do ponto de leitura e acesso ao PDF original protegido. Abertura, estudo declarado e resultado da avaliação são registros distintos.
- **Avaliações:** revisão e aprovação por responsável antes da aplicação. Mudanças pedagógicas exigem nova versão e nova revisão. Feedback por questão, nota, tentativas, versão e fontes preservados no histórico. Materiais vinculados precisam ter o estudo declarado antes da prova.
- **Alunos:** pesquisa por nome e filtros por cargo, setor, treinamento e situação, incluindo prazo vencido. Ficha com atribuições, progresso, tentativas, notas, prática, NRs e resultados de desenvolvimento autorizados.
- **NRs:** biblioteca com fonte oficial, versão consultada, aplicabilidade, responsável, requisitos separados, evidências, comprovantes/certificados por link, validade configurada, pendências desde a atribuição e ciclos de reciclagem preservados. Conclusão exige todos os requisitos e o responsável configurado; ninguém valida a própria capacitação. Instrutor designado atua apenas no seu escopo.
- **Perfil e Desenvolvimento:** cadastro de instrumentos originais ou autorizados, metodologia documentada, revisão, aplicação individual, dimensões, itens inversos, orientações e recomendações. O cálculo disponível é média normalizada por dimensão. Não há classificação automática de aprovado/reprovado, diagnóstico ou decisão sobre o colaborador. Resultados ficam restritos ao próprio aluno e às pessoas expressamente autorizadas.
- **Experiência:** navegação da escola, cards compactos, estados textuais, leitor responsivo, formulários com foco visível e ações adequadas ao celular.
- **Gravação:** envio de PDF pendente preservado em IndexedDB; reenvio com o mesmo identificador evita duplicação. A pendência continua visível após recarregar. O cabeçalho só confirma o envio após resposta do servidor.

## Materiais preparados

Foram conferidos os hashes de 11 documentos locais, com 448 páginas: cadernos de funções e Código de Ética. Os PDFs originais e o pacote de texto integral ficaram fora dos arquivos públicos do site.

Pacote privado: `../outputs/Escola_Impresilk_2026-10-08/materiais-integrais-privados.json`.

Também foi preparado um **rascunho não aprovado** de oito questões do Código de Ética, com situações de aplicação, gabaritos, explicações e páginas de referência. É uma amostra inicial; a gestão precisa revisar a cobertura pedagógica e aprovar os critérios antes de liberar. Não foi atribuído a funcionários reais.

Na prévia, pessoas e registros são fictícios; os documentos integrais são reais e estão identificados como materiais em revisão. A liberação dos documentos para a personagem de demonstração existe somente na simulação local.

## Conferência normativa

Consultados o [catálogo oficial de NRs vigentes](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes) e a [NR-1 oficial, redação vigente desde 26/05/2026](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-01-atualizada-2025-i-3.pdf), especialmente o item 1.7 e a referência ao Anexo II.

O sistema registra evidências; não presume que um questionário atende a todos os requisitos de capacitação. A emissão de certificados legais não foi automatizada. Aplicabilidade, conteúdo programático, carga horária, qualificação dos instrutores, assinatura, requisitos práticos e reciclagem devem ser conferidos pelo responsável conforme a NR específica. Nenhum prazo legal foi inventado ou aplicado em produção.

## Verificações realizadas

- **253 testes automatizados aprovados**, sem falhas: identidade, permissões, validação de conteúdo, aprovação das avaliações, versões, idempotência, escopo de gestão, privacidade de perfil, PDF protegido e persistência SQL local.
- Fluxo de formação existente: **14 conferências no navegador**, incluindo reprovação, nova tentativa, prática acompanhada, validação por instrutor, conquistas, outra sessão e resposta perdida após gravação.
- Jornada integrada nova: atribuição, revisão da prova pela gestão, estudo integral, declaração de leitura/ciência, reprovação, nova tentativa, recarga e consulta das duas notas na ficha do aluno.
- Vídeos: cadastro, atribuição por ID do RH, criação do player interno, registro de estudo, recarga e ausência de transbordamento a 1440 e 390 pixels.
- Gestão: cadastro e liberação de instrumento, cálculo e histórico do perfil, bloqueio de leitura por pessoa não autorizada; NR com etapas pendentes impedindo conclusão e registro completo após evidências.
- PDF real do Código de Ética: envio privado, perda simulada da resposta após gravação, recarga, recuperação pelo mesmo identificador, leitura e retomada na página marcada.
- Sintaxe dos scripts alterados e diferenças sem erros de espaçamento; arquivos novos incluídos explicitamente na preparação de publicação e no cache do aplicativo.

As verificações de servidor usaram o manipulador real com banco/armazenamento de teste; SQL foi exercitado em PGlite. Não equivalem à verificação do Supabase em produção.

## Pendências e limites reais

1. **Publicação depende da autorização de Léo.** Migração `0005_academia.sql`, função `pops-sync` e arquivos estáticos estão somente preparados.
2. A sessão oficial solicitou novo login. As jornadas e permissões com contas reais ainda precisam de conferência no ambiente publicado, após autorização.
3. Os documentos precisam de conferência final da versão oficial; as avaliações existentes sem registro de aprovação aguardam revisão. Notas e conclusões anteriores permanecem preservadas.
4. NRs reais precisam de cadastro e definição pelo responsável habilitado. A área pronta não representa certificação automática nem comprovação de todos os requisitos normativos.
5. Nenhum instrumento proprietário ou supostamente validado foi instalado. A empresa precisa fornecer ou aprovar os instrumentos e seus critérios. O cálculo implementado é o modelo de autorrelato documentado no cadastro.
6. Comprovantes de NRs são vinculados por link HTTPS. O sistema não emite nem assina certificados nesta entrega.
7. O player do YouTube e seu endereço incorporado foram verificados. A disponibilidade de cada vídeo e a autorização de incorporação dependem do autor e do YouTube; há alternativa para abrir a fonte original. Não foi validado um vídeo de treinamento real porque nenhum link foi fornecido.
8. A biblioteca preparada para revisão não foi importada no banco oficial. Os arquivos privados não entram na publicação estática.

## Próxima implantação, somente após autorização

Aplicar a migração aditiva e conferir permissões do bucket privado `pops-escola-documentos`; publicar a função autenticada; publicar os arquivos estáticos com cache `pops-shell-v16-escola`; conferir login RH, consulta e gravação com aluno, instrutor e gestor reais. Importar/liberar documentos e avaliações apenas após a revisão pedagógica correspondente.

Prévia local: http://127.0.0.1:5221/?pessoa=gestao#/videos
