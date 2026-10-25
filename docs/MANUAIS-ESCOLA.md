# Manuais na Escola

Publicação autorizada em 25/10/2026. Cursos vinculados são criados somente em rascunho; liberação requer vídeo e revisão técnica. Interface `2026.10.24-manuais-escola`, shell `pops-shell-v26-manuais-escola`.

## Como preparar

1. Entrar na Escola como administração e no Painel, no mesmo navegador/origem, com permissão para os manuais. A credencial do Painel segue apenas no cabeçalho da chamada administrativa e não é gravada no curso ou na fila de envios.
2. Gestão de cursos → Treinar por máquina. Atualizar o catálogo e escolher Montar treinamento, ou preparar os que faltam. O curso tem ID estável derivado do ID do manual; repetir a criação não sobrescreve o curso.
3. Preparar aulas e vídeos: conferir as oito etapas, textos extraídos, pontos, vídeos da biblioteca, prova e instrutor. O modelo sugere 130 pontos, editáveis. Não se inventam instruções operacionais nem vídeos. Conteúdo pendente permanece bloqueado.
4. Revisar e aprovar tecnicamente o manual no Painel. A Escola confere seu estado, revisão e existência da máquina antes da liberação e dos avanços. A avaliação tem sua própria aprovação; a prática exige outro responsável autorizado.
5. Pessoas e equipes do RH → Montar jornada. Escolher a pessoa do cadastro e sua equipe existente, ordenar cursos, definir prazo/contexto e salvar. Não há vínculo por semelhança de nome nem cadastro paralelo de pessoa ou máquina.
6. O aluno recebe a sequência e o Silk. Abrir uma aula não dá pontos. A leitura reconhece estudo; avaliação e prática mantêm seus critérios. A conclusão não autoriza operar o equipamento.

## Revisões e proteção

- Manual novo: o curso sinaliza revisão e impede novos avanços; pontos e histórico existentes são preservados.
- Revisar com novo manual atualiza os textos das oito etapas e volta o curso para rascunho. Vídeos, avaliações, pontos e responsáveis configurados são preservados para revisão; aulas extras ficam pendentes. A versão anterior permanece no histórico.
- Fotos privadas só recebem URL temporária quando pertencem ao caminho livre do manual. Mídias do Inventário restritas não são propagadas. A página não traz preços, notas fiscais ou contatos privados do cadastro patrimonial.
- Os links ao Painel e ao Drive conservam o controle de acesso de origem.
- Falha na origem não libera conteúdo; conflitos de revisão impedem sobrescrever outro aparelho.

## Verificado

Suite Node 24: 464 testes aprovados, incluindo 16 casos específicos da ponte e tela. Cobertura: administração/origem, criação idempotente, revisão, histórico, fontes indisponíveis, máquina retirada, vídeo obrigatório, fotos restritas, nomes iguais com IDs distintos, pontos sem duplicação e rotas administrativas bloqueadas ao aluno. Regressões existentes de RH, equipes, biblioteca, avaliações, práticas, armazenamento e sincronização também passaram.

Navegador: criação de rascunhos, editor com oito etapas, salvar curso, seleção RH/equipe, salvar jornada, primeira aula, 10 pontos e incentivo do Silk. Conferência visual em desktop e iframe com viewport real de 390 px, sem aparelho físico. Imagens da prévia são ilustrações e os registros são fictícios.

## Retomar a prévia

`ESCOLA_MAQUINAS_DEMO=1 PORT=5440 node scripts/revisao-educacao.mjs`

- Gestão: `http://127.0.0.1:5440/?pessoa=gestao#/maquinas-escola`
- Aluno: `http://127.0.0.1:5440/?pessoa=ana#/`
- Viewport de celular: `http://127.0.0.1:5440/mobile.html`

A prévia usa servidor e banco simulados em memória: reiniciar restaura fixtures. Não acessa o Supabase produtivo. O service worker fica desabilitado na prévia para não guardar fixtures.

## Publicação e conferência — 25/10/2026

Servidor `pops-sync` v65 publicado antes da tela. Interface `2026.10.24-manuais-escola`, shell `pops-shell-v26-manuais-escola`. Deploys 40163563948 e 40163785707 concluídos; pacote público de 45 arquivos conferido byte a byte.

Importação real feita pela aplicação autenticada, com vínculo único por ID/revisão do manual. Cursos mantidos em rascunho, oito etapas, vídeo obrigatório pendente e sem público liberado. Persistência conferida por nova consulta, reabertura do editor e leitura independente no servidor. Salvamento de um rascunho pelo editor confirmado sem liberação. Registros anteriores comparados por assinatura e preservados. Nenhuma atribuição a aluno criada.

Foto pública com parâmetros de revisão do fabricante é aceita; parâmetros de credenciais e fotos do Inventário restrito continuam bloqueados. Onde só existe foto restrita, a tela indica fotografia autorizada a conferir.

## Para liberar o treinamento

Revisar tecnicamente cada manual, incluir vídeo real do modelo, preparar e aprovar a avaliação e definir os responsáveis pela prática. Depois escolher público ou jornada pelo RH/equipe. O curso não autoriza operar o equipamento. Conferência móvel desta implementação foi feita em viewport de 390 px na prévia; não houve teste em aparelho físico.
