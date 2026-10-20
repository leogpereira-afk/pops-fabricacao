# Salas visuais e cards do topo

Pedido: usar https://gamefik.com/escolas como referência visual na Escola Impresilk e melhorar os cards superiores. A referência consultada foi a página pública, com exemplos de trilhas, cartões e próximo passo. A interface mantém a identidade e os recursos existentes da Impresilk.

## Implementação local

- Catálogo: áreas existentes apresentadas como salas, com ilustração 3D colorida, nome e quantidade de cursos. Contagens usam somente os registros recebidos para a sessão. O botão inteiro seleciona a área; o andamento pessoal permanece nos cursos.
- Selecionar a sala filtra os cursos e leva o foco aos resultados; não cria novas turmas nem libera cursos. Busca e situação continuam combináveis, com limpeza de filtros quando não há resultado.
- Cursos: capas por área, hierarquia de título e duração, progresso das aulas obrigatórias e recomendações recolhíveis. Rascunhos, arquivados e histórico sem acesso mantêm as ações próprias.
- Início: cursos concluídos, pontos e conquistas ficam acima do próximo passo acompanhado pelo Silk.
- Mobile: salas em duas colunas e cursos em uma; indicadores compactos sem rolagem horizontal. Cores acompanham textos, foco visível e movimento reduzido.

## Verificação

Testes do projeto, sintaxe dos arquivos alterados e pacote estático da CI. Testes adicionais cobrem contagem de cursos autorizados, progresso com aula opcional e limpeza combinada de filtros. Revisão visual em desktop e 390 px, incluindo entrada no curso e registro de leitura no servidor fictício.

Refinamento solicitado em 20/10: seleção por ícone e tecla Enter conferida, áreas em duas colunas no celular e filtro geral com contraste preservado ao passar o ponteiro. Suíte completa: 444 testes aprovados.

Segundo refinamento solicitado em 20/10: sete imagens próprias geradas com image_gen substituem os símbolos lineares, em WebP transparente (cerca de 216 KB ao todo). Prompts e origem em `areas/README.md`. Imagens da área e caminhos do shell presentes no pacote estático de 41 arquivos; carregamento das sete imagens e filtro pelo clique conferidos no navegador. Versão local `2026.10.20-areas-ilustradas`, shell `pops-shell-v22-areas-ilustradas`. Nova execução da suíte: 444 testes aprovados.

## Entrega

Implementação local; publicação depende de autorização e das dependências já descritas em VEZ.md para o ramo. A prévia usa somente dados fictícios. O conteúdo financeiro real continua separado da demonstração de layout.
