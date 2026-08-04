# -*- coding: utf-8 -*-
"""
Jornadas novas para fechar as 4 linhas de produção.

As 3 primeiras (Pintura, Letra caixa, Portas) já existiam e ganharam `linha` e
`setor`. Estas cinco cobrem as etapas que estavam sem treinamento nenhum:
corte/usinagem, metalurgia, impressão+recorte, acabamento e DTF/brindes.
"""

P  = lambda t: {"tipo": "paragrafo", "texto": t}
S  = lambda t: {"tipo": "subtitulo", "texto": t}
PS = lambda *i: {"tipo": "passos", "itens": list(i)}
L  = lambda *i: {"tipo": "lista", "itens": list(i)}
D  = lambda t: {"tipo": "destaque", "texto": t}
A  = lambda t: {"tipo": "alerta", "texto": t}
CK = lambda *i: {"tipo": "checklist", "itens": list(i)}

def et(idn, titulo, blocos):
    return {"id": "et-" + idn, "titulo": titulo, "blocos": blocos}

JORNADAS_NOVAS = [

# ═══════════════════ CORTE DE CHAPAS E USINAGEM ═══════════════════
{"id": "jor-corte", "titulo": "Corte de chapas e usinagem", "ordem": 4,
 "nivel": "Técnico", "versao": "1.0", "linha": "linha-letras", "setor": "Corte de chapas e usinagem",
 "descricao": "Seccionadora, router CNC e laser CO2: transformar a chapa no que o projeto pediu, sem desperdício e sem peça fora de medida.",
 "revisadoEm": "2026-08-04T12:00:00.000Z",
 "etapas": [
  et('cor-1', 'As três máquinas e o que cada uma faz melhor', [
    P('Corte é a primeira etapa de DUAS linhas (Projeto e letras, e Arquitetônica). Erro aqui não fica no corte: ele viaja para a pintura, para a montagem e chega na fachada do cliente.'),
    S('Seccionadora'),
    L('Corte reto em chapa grande (ACM, PVC, MDF, poliondas).',
      'Rápida e precisa em esquadro — é ela que dá o retângulo base.',
      'Não faz curva, não faz furo interno.'),
    S('Router CNC'),
    L('Corte de contorno: letras, curvas, furos internos, rebaixos e canaletas.',
      'Aceita ACM, PVC, acrílico, MDF e alumínio composto.',
      'É a máquina do letreiro e da porta: o desenho vira peça aqui.'),
    S('Laser CO2'),
    L('Acrílico (e só): borda sai POLIDA, transparente, sem lixar.',
      'Corta acrílico fino e médio com acabamento que o router não alcança.',
      'NUNCA PVC — o laser em PVC libera cloro: corrói a máquina e faz mal a quem respira.'),
    A('Regra que não se discute: PVC no laser, jamais. Se a dúvida for "isso é PVC ou acrílico?", pergunte ANTES de ligar. Acrílico afunda na água morna? Não — este teste não vale; confira a etiqueta ou pergunte ao almoxarifado.'),
    D('Escolha certa = menos retrabalho: reto e grande → seccionadora. Contorno e furo → router. Acrílico com borda à vista → laser.')]),
  et('cor-2', 'Antes de ligar: arquivo, chapa e plano de corte', [
    PS('Conferir o arquivo com a O.S.: medida FINAL da peça, quantidade e material. Divergência → falar com a arte-final antes de cortar.',
       'Conferir se o vetor está fechado (contorno aberto vira caminho errado e peça perdida).',
       'Conferir a chapa: espessura certa, sem empeno, sem risco na face que fica à vista.',
       'Montar o plano de corte (nesting): encaixar as peças para sobrar o menor retalho possível.',
       'Marcar qual face é a de VISTA — a proteção dela só sai no fim.',
       'Conferir fresa/lente: fresa cega queima a borda; lente suja tira potência do laser.'),
    D('Nesting bem feito é dinheiro: a mesma O.S. pode consumir uma chapa ou uma chapa e meia. Gire as peças, aproveite as bordas, e guarde o retalho grande identificado com a medida.'),
    CK('Arquivo confere com a O.S. (medida final, quantidade, material)',
       'Vetores fechados', 'Chapa sem empeno e sem risco na face de vista',
       'Plano de corte aproveitando a chapa', 'Fresa/lente em condição')]),
  et('cor-3', 'Parâmetros: o que muda por material', [
    S('Router'),
    L('ACM — fresa própria para composto; avanço rápido demais descola as faces do alumínio.',
      'PVC expandido — avanço médio; PVC derrete se a fresa girar sem avançar.',
      'Acrílico no router — fresa de acrílico e avanço constante; parada no meio do corte deixa marca que não sai.',
      'MDF — fresa de topo; atenção ao arranque de fibra na saída.'),
    S('Laser CO2'),
    L('Acrílico fundido corta melhor que extrudado (borda mais limpa).',
      'Potência alta demais = borda com bolha; baixa demais = não atravessa e queima.',
      'Sempre com exaustão ligada.'),
    S('Seccionadora'),
    L('Lâmina afiada e esquadro conferido: 1 mm de erro no esquadro vira 4 mm na porta montada.'),
    A('Máquina cortando NÃO se deixa sozinha. Fresa que quebra, acrílico que pega fogo no laser e chapa que escorrega acontecem em segundos.')]),
  et('cor-4', 'Depois do corte: conferência e entrega para a próxima etapa', [
    PS('Conferir a primeira peça contra a medida da O.S. ANTES de cortar o lote inteiro.',
       'Rebarbar: router e seccionadora deixam fio de corte — a mão de quem monta agradece.',
       'Identificar as peças (nº da O.S. e posição) — letra sem identificação vira quebra-cabeça na montagem.',
       'Separar por destino: o que vai para a Metalurgia, o que vai direto para a Pintura, o que vai para a célula de Portas.',
       'Guardar o retalho aproveitável com a medida escrita.',
       'Registrar o consumo de chapa (é ele que sustenta o custo por centro no Financeiro).'),
    S('Erros que a gente não repete'),
    L('Cortar o lote sem conferir a primeira peça → chapa inteira perdida.',
      'Tirar o filme de proteção no corte → peça riscada na fábrica inteira.',
      'Laser em PVC → gás corrosivo e tóxico.',
      'Peça sem identificação → montagem parada esperando alguém adivinhar.',
      'Retalho jogado no chão → compra de chapa que não precisava.')]),
 ]},

# ═══════════════════ METALURGIA ═══════════════════
{"id": "jor-metalurgia", "titulo": "Metalurgia: laser fibra e solda", "ordem": 5,
 "nivel": "Avançado", "versao": "1.0", "linha": "linha-letras", "setor": "Metalurgia",
 "descricao": "Corte de metais a laser fibra, solda de letra a laser e solda MIG: a estrutura que sustenta o letreiro por dez anos.",
 "revisadoEm": "2026-08-04T12:00:00.000Z",
 "etapas": [
  et('met-1', 'Segurança primeiro (aqui não é frase de efeito)', [
    A('Laser fibra queima retina em reflexo — óculos específicos para o comprimento de onda da FIBRA (os do CO2 não servem). Solda pede máscara de escurecimento automático, luva de raspa, avental e sapato fechado. Bermuda e tênis de pano não entram no setor.'),
    S('Os riscos reais deste setor'),
    L('Reflexo do laser fibra em superfície polida — nunca olhar o ponto de corte sem proteção.',
      'Fumo metálico da solda — exaustão ligada, sempre.',
      'Peça quente parecendo fria: metal recém-cortado não muda de cor e queima igual.',
      'Faísca de esmerilhadeira perto de solvente ou lona — o setor pega fogo em segundos.'),
    CK('Óculos de laser fibra (não é o do CO2)', 'Máscara de solda automática',
       'Luva de raspa e avental', 'Exaustão ligada', 'Extintor no lugar e desobstruído')]),
  et('met-2', 'Corte a laser fibra', [
    PS('Conferir o arquivo contra a O.S.: espessura e tipo do metal mudam TUDO (aço carbono, inox, galvanizado, alumínio).',
       'Escolher os parâmetros pela tabela do material e da espessura — não pelo "que estava do jeito da última vez".',
       'Conferir gás de assistência e pressão.',
       'Limpar a lente e conferir o bico: bico gasto abre o corte e deixa rebarba.',
       'Cortar UMA peça de teste e conferir medida e qualidade da borda antes do lote.',
       'Acompanhar o corte: chapa que levanta bate no cabeçote.'),
    D('Borda com rebarba grossa é sintoma, não destino: quase sempre é foco desregulado, bico gasto ou pressão de gás errada. Ajuste na máquina em vez de resolver no esmeril depois.'),
    L('Alumínio e inox refletem mais: parâmetros próprios e atenção redobrada ao reflexo.',
      'Galvanizado libera fumo de zinco — exaustão obrigatória.')]),
  et('met-3', 'Solda de letra a laser', [
    P('A solda a laser é o que dá o acabamento fino da letra caixa metálica: cordão pequeno, pouca deformação e quase nada para lixar.'),
    PS('Encostar as peças SEM fresta: a solda a laser não preenche vão — ela funde o que está encostado.',
       'Fixar/gabaritar a peça: 1 mm de folga vira letra torta.',
       'Ajustar potência e foco pela espessura; teste em retalho do MESMO material.',
       'Soldar em pontos alternados para distribuir o calor (evita empeno).',
       'Conferir o cordão por dentro e por fora antes de liberar.'),
    A('Peça que vai receber pintura precisa de solda LIMPA: respingo e óxido viram bolha na tinta três semanas depois, no cliente.')]),
  et('met-4', 'Solda MIG: estrutura que sustenta', [
    P('MIG é a solda da estrutura — metalon do quadro, suporte, mão francesa. Não é a solda do acabamento: é a que segura o peso.'),
    PS('Limpar a região: ferrugem, tinta e óleo viram porosidade na solda.',
       'Regular tensão e velocidade de arame pela espessura; testar em retalho.',
       'Gás e vazão conferidos (sem gás, o cordão fica poroso e fraco).',
       'PONTEAR primeiro, conferir esquadro e diagonais, e só então fechar o cordão.',
       'Sequência alternada (cantos opostos) para o calor não puxar a estrutura.',
       'Esmerilhar respingo e cordão aparente; rebarbar tudo.',
       'Tratar a solda antes da pintura: galvanização a frio ou primer rico em zinco nos pontos.'),
    S('Como reconhecer solda ruim'),
    L('Cordão alto e irregular → velocidade de arame alta demais.',
      'Furinhos (porosidade) → falta de gás, peça suja ou úmida.',
      'Mordedura na borda → tensão alta ou ângulo errado da tocha.',
      'Peça empenada → soldou tudo de uma vez, sem pontear e sem alternar.')]),
  et('met-5', 'Entrega para a Pintura', [
    CK('Medidas conferidas contra o projeto (inclusive diagonais do quadro)',
       'Respingos removidos e cordões esmerilhados onde ficam à vista',
       'Sem óleo e sem óxido — a pintura não corrige o que a metalurgia deixou',
       'Pontos de solda tratados contra ferrugem',
       'Peças identificadas com o nº da O.S.'),
    D('A Metalurgia entrega para a Pintura, que entrega para a Montagem. Cada uma só consegue fazer o próprio trabalho bem se a anterior fez. Peça mal soldada não vira letra bonita — vira retrabalho de três setores.')]),
 ]},

# ═══════════════════ IMPRESSÃO E RECORTE ═══════════════════
{"id": "jor-impressao", "titulo": "Impressão digital e recorte", "ordem": 6,
 "nivel": "Técnico", "versao": "1.0", "linha": "linha-impressos", "setor": "Impressão digital e recorte",
 "descricao": "Ampla, MyPrint, UV e plotter de recorte: cor fiel, material certo e recorte no lugar — do RIP à peça pronta para o acabamento.",
 "revisadoEm": "2026-08-04T12:00:00.000Z",
 "etapas": [
  et('imp-1', 'O que cada equipamento resolve', [
    L('Ampla / MyPrint (solvente ou eco-solvente) — lona, vinil adesivo, grandes formatos. É o volume da casa.',
      'Impressora UV — imprime DIRETO em chapa rígida (ACM, PVC, acrílico, MDF) e em material que não aceita solvente. Cura na hora com luz UV.',
      'Plotter de recorte — corta vinil de cor (sem impressão) e faz o recorte de contorno do que foi impresso.'),
    D('A pergunta que define a máquina: o material é FLEXÍVEL (lona, vinil) ou RÍGIDO (chapa)? Flexível vai para a impressora de rolo; rígido vai para a UV — ou imprime-se em vinil e aplica-se na chapa.')]),
  et('imp-2', 'Antes de imprimir: o arquivo e o material', [
    PS('Conferir o arquivo contra a O.S.: medida FINAL, quantidade e onde a peça vai ser aplicada.',
       'Conferir resolução na medida real — arte boa em 30 cm pode ser lixo em 3 metros.',
       'Conferir sangria e margem de acabamento: peça com ilhós precisa de borda; peça com refile precisa de sobra.',
       'Perfil de cor certo para o material — o mesmo arquivo sai diferente em lona e em vinil.',
       'Conferir o material: lote, largura e face de impressão (vinil tem lado certo).',
       'Ver se há cor crítica (a cor da marca do cliente) e comparar com a referência antes do lote.'),
    A('Cor crítica NÃO se aprova na tela. Imprima uma tira de teste e compare com a referência física, na luz do dia. Monitor mente; papel e lona não.')]),
  et('imp-3', 'Imprimir: RIP, perfil e teste', [
    PS('Enviar pelo RIP com o perfil do material — não pelo "perfil genérico".',
       'Conferir passagem/qualidade conforme a distância de leitura: fachada lida a 20 m não precisa da mesma resolução de um adesivo de vitrine.',
       'Rodar tira de teste: cor, nitidez e faixas (banding).',
       'Conferir bicos ANTES do lote — bico entupido faz faixa branca que só aparece na peça inteira.',
       'Imprimir o lote acompanhando as primeiras passadas.',
       'Respeitar a secagem/cura antes de enrolar ou empilhar: peça enrolada úmida transfere tinta para o verso.'),
    S('Defeitos e o que cada um está dizendo'),
    L('Faixas claras (banding) → bico entupido ou avanço desregulado.',
      'Cor fora do esperado → perfil errado, material diferente do perfilado, ou tinta acabando.',
      'Borrado/esfumaçado → cabeçote muito alto, material ondulado ou tinta demais.',
      'Marca de roda → material ainda molhado ao passar pelo rolete.')]),
  et('imp-4', 'Recorte de contorno e vinil de cor', [
    PS('Conferir a marca de registro impressa (crop marks) antes de mandar cortar — sem ela o contorno sai deslocado.',
       'Escolher a lâmina e a pressão pelo material: vinil fino, lona e refletivo pedem pressões diferentes.',
       'Regular a profundidade: tem que cortar o vinil e NÃO o liner (papel de trás). Teste no canto.',
       'Cortar uma peça e descascar antes do lote — vinil que corta o liner rasga na aplicação.',
       'Descascar (weeding) com paciência; peça com letra fina exige lupa e bisturi.',
       'Aplicar a fita de transporte quando a peça vai ser aplicada inteira.'),
    D('A régua do recorte: descascou fácil e o liner ficou inteiro? Está certo. Se a peça rasga ao descascar, a pressão está alta; se não sai, está baixa.')]),
  et('imp-5', 'Conferência e passagem para o Acabamento', [
    CK('Medida final conferida com trena (não só na tela)',
       'Cor comparada com a referência do cliente',
       'Sem banding, sem borrado, sem marca de roda',
       'Recorte de contorno alinhado com a impressão',
       'Peça seca/curada antes de enrolar',
       'Identificada com o nº da O.S. e o destino (ilhós? refile? aplicação?)'),
    P('Daqui a peça vai para o Acabamento (solda de lona, refile, ilhós) ou direto para a expedição, conforme a O.S.')]),
 ]},

# ═══════════════════ ACABAMENTO ═══════════════════
{"id": "jor-acabamento", "titulo": "Acabamento de lona e impressos", "ordem": 7,
 "nivel": "Introdutório", "versao": "1.0", "linha": "linha-impressos", "setor": "Acabamento",
 "descricao": "Solda de banner, carrinho de soldar lona, refile e ilhós: o que separa uma lona que dura anos de uma que rasga no primeiro vento.",
 "revisadoEm": "2026-08-04T12:00:00.000Z",
 "etapas": [
  et('aca-1', 'O acabamento é o que segura a peça no mundo', [
    P('A impressão pode estar perfeita: quem decide se a lona sobrevive ao vento é a bainha, a solda e o ilhós. É o último setor a tocar na peça antes do cliente.'),
    S('O que se faz aqui'),
    L('Bainha: dobra da borda soldada, que dá corpo e evita rasgo.',
      'Solda de emenda: unir duas lonas para formar uma peça maior que a largura da bobina.',
      'Refile: cortar a peça na medida final, reto e limpo.',
      'Ilhós: o olhal metálico por onde a lona é amarrada.',
      'Reforço: fita ou lona extra nos pontos de tensão.'),
    D('A régua: a lona rasga NO ILHÓS quando o ilhós foi colocado no lugar errado ou sem reforço. Ilhós bem posto rasga a lona antes de sair — e é assim que tem que ser.')]),
  et('aca-2', 'Refile e bainha', [
    PS('Conferir a medida FINAL da O.S. — a peça impressa tem sobra de propósito.',
       'Refilar sobre superfície plana, com régua/guia; corte torto aparece de longe na fachada.',
       'Marcar a dobra da bainha (em geral 3 a 5 cm, conforme o tamanho da peça).',
       'Soldar a bainha com o carrinho ou a máquina de solda de lona, na temperatura e velocidade do material.',
       'Conferir a solda puxando: bainha que abre com a mão abre com o vento.'),
    A('Temperatura alta demais QUEIMA a lona (fica quebradiça e amarela na dobra); baixa demais não funde e abre depois. Teste sempre num retalho do mesmo material antes da peça do cliente.')]),
  et('aca-3', 'Solda de emenda', [
    PS('Alinhar as duas partes pela ARTE, não pela borda — o desenho tem que continuar.',
       'Sobreposição conforme o material (em geral 2 a 3 cm).',
       'Soldar com passagem contínua, sem parar no meio (parada marca).',
       'Conferir a emenda contra a luz: falha aparece como ponto claro.',
       'Reforçar as pontas da emenda, que é onde a tensão concentra.'),
    D('Emenda bem feita quase some quando a lona está esticada. Emenda torta chama atenção mais que a arte — e o cliente vê primeiro o defeito.')]),
  et('aca-4', 'Ilhós: onde e por quê', [
    PS('Definir o espaçamento pelo tamanho e pela exposição ao vento (regra prática: a cada 40 a 50 cm; menos em local de vento forte).',
       'Ilhós SEMPRE na bainha (dupla camada) — nunca na lona simples.',
       'Reforçar os cantos: é o ponto que mais rompe.',
       'Furar centralizado na bainha e prensar com a matriz certa para o tamanho do ilhós.',
       'Conferir um a um: ilhós solto sai no primeiro puxão.'),
    CK('Ilhós em toda a volta, espaçamento uniforme',
       'Todos na dupla camada da bainha', 'Cantos reforçados',
       'Nenhum ilhós girando ou solto', 'Peça dobrada com a arte para dentro e identificada com a O.S.')]),
 ]},

# ═══════════════════ DTF UV E BRINDES ═══════════════════
{"id": "jor-brindes", "titulo": "DTF UV e gravação de brindes", "ordem": 8,
 "nivel": "Introdutório", "versao": "1.0", "linha": "linha-brindes", "setor": "DTF UV e brindes",
 "descricao": "A linha de giro rápido: aplicar marca em copo, caneta, garrafa e brinde com qualidade de fachada — e sair no mesmo dia.",
 "revisadoEm": "2026-08-04T12:00:00.000Z",
 "etapas": [
  et('bri-1', 'Duas técnicas, dois resultados', [
    S('DTF UV (adesivo transferível)'),
    L('Imprime-se o desenho em filme e transfere-se para o objeto — colorido, com branco de apoio.',
      'Serve em superfície lisa: copo, garrafa, caneca, plástico, metal, vidro.',
      'Ganha em COR: logo colorido, degradê, foto.'),
    S('Gravação (laser)'),
    L('Remove/marca a superfície do objeto — não adiciona nada.',
      'Serve em metal, madeira, couro, acrílico e alguns plásticos.',
      'Ganha em DURABILIDADE e sofisticação: não descola nunca, mas é monocromática.'),
    D('A escolha é do resultado, não do gosto: logo colorido → DTF UV. Peça premium, marca discreta e eterna → gravação. Na dúvida com o cliente, mostre uma amostra de cada.')]),
  et('bri-2', 'DTF UV passo a passo', [
    PS('Conferir a arte: tamanho real na peça, e se o logo tem área mínima legível (logo de 8 mm em caneta some).',
       'Preparar o branco de apoio — sem ele a cor some em objeto escuro.',
       'Imprimir no filme e conferir a cura antes de destacar.',
       'LIMPAR o objeto com álcool isopropílico. Gordura de mão é o motivo nº 1 de adesivo que descola.',
       'Posicionar com gabarito ou fita: peça torta em brinde é o que o cliente mais reclama.',
       'Aplicar pressionando do centro para as bordas, sem bolha.',
       'Remover o transporte devagar, no ângulo raso.',
       'Curar/descansar conforme o material antes de embalar.'),
    A('Superfície com silicone ou verniz solto (alguns copos e garrafas baratos) NÃO segura adesivo. Teste UMA peça do lote antes de aplicar em 500.')]),
  et('bri-3', 'Gravação a laser', [
    PS('Identificar o material — plástico com cloro NÃO entra no laser (mesma regra do PVC).',
       'Fixar o objeto em gabarito: peça redonda precisa de rotativo ou berço.',
       'Focar na altura certa da superfície curva (o foco muda no copo).',
       'Testar em uma peça igual, do MESMO lote: cada material reage diferente.',
       'Gravar e conferir contraste e profundidade.',
       'Limpar resíduo conforme o material.'),
    L('Metal pintado → o laser remove a tinta e aparece o metal (alto contraste).',
      'Inox e alumínio cru → marcação por oxidação/annealing, mais escura e sem relevo.',
      'Madeira → queima; potência demais deixa fuligem que suja a mão do cliente.',
      'Couro → cheiro forte; exaustão obrigatória.')]),
  et('bri-4', 'Lote, conferência e entrega', [
    P('Brinde é volume: o erro não acontece uma vez, acontece quinhentas. Por isso a regra é sempre PEÇA-PILOTO.'),
    PS('Fazer 1 peça-piloto completa e conferir com a O.S. (e com o cliente, quando for a primeira vez).',
       'Só depois liberar o lote, conferindo por amostragem a cada bandeja.',
       'Separar as peças com defeito na hora — não misturar "para conferir depois".',
       'Contar o lote antes de embalar: brinde conta-se em unidade, e falta gera nova viagem.',
       'Embalar protegendo a área aplicada.'),
    CK('Peça-piloto aprovada antes do lote', 'Posição igual em todas (gabarito)',
       'Contagem confere com a O.S.', 'Peças com defeito separadas',
       'Embalagem protege a marca aplicada')]),
 ]},
]

# As 3 jornadas que já existiam ganham lugar nas linhas.
LINHA_DAS_ANTIGAS = {
    "jor-pintura":     {"linha": "linha-letras",        "setor": "Pintura"},
    "jor-letracaixa":  {"linha": "linha-letras",        "setor": "Montagem de letras"},
    "jor-portas":      {"linha": "linha-arquitetonica", "setor": "Portas de ACM"},
}
