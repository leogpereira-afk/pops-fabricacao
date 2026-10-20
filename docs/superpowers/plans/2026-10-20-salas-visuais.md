# Salas visuais e cards do topo

Pedido: usar https://gamefik.com/escolas como referência visual na Escola Impresilk e melhorar os cards superiores. A referência consultada foi a página pública, com exemplos de trilhas, cartões e próximo passo. A interface mantém a identidade e os recursos existentes da Impresilk.

## Implementação local

- Catálogo: áreas existentes apresentadas como salas, com capa gráfica, título, quantidade de cursos e conclusão pessoal. Contagens usam somente os registros recebidos para a sessão.
- Selecionar a sala filtra os cursos e leva o foco aos resultados; não cria novas turmas nem libera cursos. Busca e situação continuam combináveis, com limpeza de filtros quando não há resultado.
- Cursos: capas por área, hierarquia de título e duração, progresso das aulas obrigatórias e recomendações recolhíveis. Rascunhos, arquivados e histórico sem acesso mantêm as ações próprias.
- Início: cursos concluídos, pontos e conquistas ficam acima do próximo passo acompanhado pelo Silk.
- Mobile: salas em duas colunas e cursos em uma; indicadores compactos sem rolagem horizontal. Cores acompanham textos, foco visível e movimento reduzido.

## Verificação

Testes do projeto, sintaxe dos arquivos alterados e pacote estático da CI. Testes adicionais cobrem contagem de cursos autorizados, progresso com aula opcional e limpeza combinada de filtros. Revisão visual em desktop e 390 px, incluindo entrada no curso e registro de leitura no servidor fictício.

## Entrega

Implementação local; publicação depende de autorização e das dependências já descritas em VEZ.md para o ramo. A prévia usa somente dados fictícios. O conteúdo financeiro real continua separado da demonstração de layout.
