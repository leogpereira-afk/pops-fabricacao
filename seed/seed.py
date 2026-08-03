# -*- coding: utf-8 -*-
# Semente de conteúdo do Pops & Fabricação.
# Fontes: POPs reais do Google Drive da Impresilk (modelo institucional 2026 e
# legado de consultoria) + os 5 POPs de fluxo que moravam no RH + as 3 jornadas
# técnicas escritas para este sistema. Gera seed.sql (idempotente: upsert).
import json, os, uuid

AQUI = os.path.dirname(os.path.abspath(__file__))

def bid(nome):  # id estável a partir do nome (rodar de novo não duplica)
    return 'pop-' + nome

P  = lambda t: {"tipo": "paragrafo", "texto": t}
S  = lambda t: {"tipo": "subtitulo", "texto": t}
PS = lambda *i: {"tipo": "passos", "itens": list(i)}
L  = lambda *i: {"tipo": "lista", "itens": list(i)}
D  = lambda t: {"tipo": "destaque", "texto": t}
A  = lambda t: {"tipo": "alerta", "texto": t}
CK = lambda *i: {"tipo": "checklist", "itens": list(i)}

POPS = []
def pop(idn, codigo, setor, titulo, objetivo, resp, epis, blocos, versao='1.0'):
    POPS.append({"id": bid(idn), "codigo": codigo, "setor": setor, "titulo": titulo,
                 "objetivo": objetivo, "responsavel": resp, "epis": epis,
                 "blocos": blocos, "versao": versao,
                 "revisadoEm": "2026-08-03T12:00:00.000Z", "revisadoPor": "Semente inicial"})

# ═══════════════ INSTALAÇÃO (POP-MONT-01 a 06, do Drive) ═══════════════
pop('mont-01', 'POP-MONT-01', 'Instalação', 'Instalação externa — regras gerais (POP-mãe)',
    'Toda instalação externa sai com segurança, equipe preparada, material certo e registro formal — zero retrabalho por falta de ferramenta, peça ou informação.',
    'Líder de Instalações', ['Luva', 'Óculos de proteção', 'Cinto de segurança (acima de 3 m)'], [
    D('Este é o POP-mãe: os POPs de fachada, letra caixa, luminoso e placa complementam este. Na dúvida, a regra geral é esta aqui.'),
    S('Classificação de complexidade (o gerente define antes)'),
    L('BAIXA — até 3 m, superfície padrão (alvenaria/drywall), peça leve, acesso livre: escada simples, equipe de 2.',
      'MÉDIA — 3 a 8 m, superfície diferenciada (vidro, ACM, cerâmica), peça média: andaime ou escada extensível, cinto de segurança, equipe de 3.',
      'ALTA — acima de 8 m, peça pesada, viagem longa ou acesso adverso: andaime certificado, cinto, gerente no local, motorista, equipe completa.'),
    S('Antes de sair (checklist obrigatório)'),
    P('A OS desce ao almoxarifado, o material é separado e o LÍDER confere antes de carregar. Nenhuma equipe sai sem conferir — o líder assina a OS antes da saída.'),
    CK('OS em mãos: número, cliente, endereço, tipo de serviço',
       'Projeto/arte aprovada ou foto de referência',
       'Cliente avisado do horário (confirmar no dia anterior por WhatsApp)',
       'Peça confere com a OS: dimensão, arte, quantidade',
       'Proteção para transporte (embalagem, espuma)',
       'Fixadores certos para a superfície (parafuso, bucha, muck, cola)',
       'Material reserva além do previsto',
       'Furadeira e parafusadeira com bateria carregada',
       'Broca correta para a superfície · nível e trena',
       'Escada ou andaime compatível com a altura',
       'Cinto de segurança (obrigatório acima de 3 m) · EPI básico'),
    S('Vistoria no local (antes de instalar)'),
    PS('Identificar a superfície (alvenaria, drywall, vidro, ACM, cerâmica, madeira) e confirmar a compatibilidade dos fixadores.',
       'Verificar fiação elétrica, tubulação ou obstáculos ocultos.',
       'Conferir as medidas no local contra o projeto — divergência: acionar o gerente ANTES de iniciar.',
       'Checar a segurança do acesso: piso, espaço para andaime/escada, risco de queda.',
       'Cliente ausente ou acesso bloqueado: NÃO iniciar. Acionar o gerente e registrar no grupo.'),
    S('Execução'),
    PS('Marcar os pontos de fixação com trena e nível antes de furar.',
       'Fixar conforme o projeto, com os fixadores corretos para a superfície identificada.',
       'Instalar a peça e conferir nível, alinhamento e acabamento.',
       'Serviço com iluminação (LED, neon): testar o funcionamento completo no local antes de liberar.',
       'Limpar o local (embalagens, resíduo de broca, marcações) e deixar como encontrado.'),
    S('Registro de conclusão (obrigatório, os três)'),
    PS('Foto do serviço finalizado no grupo da Impresilk com o nº da OS na descrição.',
       'Relato no grupo: nº da OS, tipo de serviço, cliente e status (concluído, pendência ou problema).',
       'Aprovação do cliente no local: foto ao lado, confirmação por WhatsApp ou assinatura na OS.'),
    A('Erro ou não conformidade: registrar IMEDIATAMENTE no grupo com foto e descrição. Erro escondido vira problema maior — o gerente decide o encaminhamento.'),
    S('Pontos de atenção (onde mais se erra)'),
    L('Sair sem ferramenta ou peça certa → nunca pular o checklist; o líder assina antes.',
      'Superfície diferente do esperado → vistoria antes de furar; confirmar fixador com o gerente.',
      'Cliente ausente → confirmar presença no dia anterior.',
      'Instalação torta → nível antes E depois de fixar; conferência visual à distância.',
      'Erro não registrado → registrar mesmo pequeno.')])

pop('mont-02', 'POP-MONT-02', 'Instalação', 'Fachada em ACM',
    'Toda fachada em ACM instalada com segurança e acabamento padrão Impresilk.',
    'Líder de Instalações', ['Luva', 'Óculos de proteção'], [
    P('Complementa o POP-MONT-01. ACM é a placa composta de alumínio usada em fachadas de prédios, lojas e estabelecimentos.'),
    D('Regra de ouro do ACM: os dois erros que mais custam caro são TRANSPORTE e MEDIDA ERRADA. ACM riscado vira sucata; medida errada vira viagem perdida. Medidas conferidas DUAS vezes antes de fabricar.'),
    S('Antes de sair'),
    CK('Medidas do projeto conferidas duas vezes antes da fabricação',
       'Foto do local no celular para conferência visual',
       'Peça embalada com proteção em TODAS as faces (espuma ou papelão)',
       'Veículo com espaço; carga amarrada para não roçar',
       'Sistema de fixação do projeto identificado'),
    S('Sistemas de fixação (definidos no projeto)'),
    L('Rebite em estrutura — fachadas grandes, paredes irregulares, projeto com requadro: cantoneira/perfil metálico, rebites, broca para metal.',
      'Parafuso direto em alvenaria — bucha S8 ou S10, parafuso, broca de concreto.',
      'Fita dupla face + cola PU — paredes lisas e niveladas, peça pequena/média; superfícies lisas (vidro, cerâmica): fita 3M VHB ou similar, cola PU, limpador isopropílico.'),
    S('Passo a passo no local'),
    PS('Vistoria: confirmar a superfície e conferir as medidas com trena. Divergência → parar e acionar o gerente.',
       'Marcação: linha base nivelada (bolha ou laser); pontos de fixação a lápis.',
       'Estrutura (se houver): instalar cantoneira/perfil primeiro; conferir nível e prumo antes de fixar o ACM.',
       'Manuseio: retirar o filme protetor SÓ depois de instalado; manusear de pé, nunca arrastar.',
       'Fixação pelo sistema escolhido, conferindo o nível a cada peça.',
       'Vedação: silicone neutro nas juntas externas contra entrada de água; limpar o excesso com pano e álcool.',
       'Conferência final de longe: alinhamento, sem ondulação, sem marca de dedo ou cola.'),
    S('Pontos de atenção'),
    L('ACM riscado/amassado no transporte → proteção em todas as faces; filme só sai DEPOIS.',
      'Medida errada → conferir no local antes de fabricar (foto + trena).',
      'Junta entrando água → vedar TODAS as juntas externas com silicone neutro.',
      'Fachada torta de longe → nível a cada peça, não só no final.'),
    P('Registro de conclusão: conforme POP-MONT-01 + foto frontal e duas laterais para mostrar o alinhamento.')])

pop('mont-03', 'POP-MONT-03', 'Instalação', 'Letra caixa cega (sem iluminação)',
    'Letras caixa sem iluminação (galvânico, PVC, acrílico ou MDF) instaladas alinhadas, sem risco e sem trinca.',
    'Líder de Instalações', ['Luva limpa', 'Óculos de proteção'], [
    P('Complementa o POP-MONT-01. Fixação por parafuso frontal direto na parede.'),
    S('Antes de sair (além do checklist geral)'),
    CK('Letras conferidas: quantidade, tamanho, cor, sem risco',
       'Embaladas individualmente, separadas por papelão ou espuma',
       'Gabarito de instalação impresso, ou desenho com o espaçamento',
       'Parafusos compatíveis com o material da letra e o tipo de parede',
       'Buchas S6 ou S8 conforme o parafuso',
       'Nível a laser ou nível de bolha grande (1 m+)',
       'Fita crepe para marcação temporária'),
    S('Cuidado por material'),
    L('Galvânico — risca fácil: manusear com luva limpa; furação prévia com broca fina.',
      'PVC — quebra na borda se apertar demais: usar arruela.',
      'Acrílico — trinca se furar sem alívio: pré-furar com broca menor antes do parafuso.',
      'MDF — absorve umidade: conferir a borda selada; não instalar em dia de chuva.'),
    S('Passo a passo no local'),
    PS('Vistoria: parede lisa, reboco firme, sem trinca; conferir a medida disponível contra a medida do conjunto.',
       'Linha base horizontal com nível a laser ou linha de pedreiro — é ela que define o alinhamento.',
       'Marcar o espaçamento com gabarito de papel 1:1, ou medindo letra por letra (lápis + fita crepe).',
       'Conferência ANTES de furar: colar as letras com fita crepe na posição e olhar de longe (5 a 10 m).',
       'Furar a parede no ponto marcado e colocar a bucha (nunca furar "através" da letra direto na parede).',
       'Fixar: parafuso pelo furo da letra na bucha, SEM apertar demais (acrílico e PVC).',
       'Conferência final de longe: nível, espaçamento, sem risco. Limpar marcas de lápis com pano úmido.'),
    S('Pontos de atenção'),
    L('Letras desalinhadas (subindo ou descendo) → linha base sempre; fita crepe antes de furar; olhar de longe.',
      'Letras riscadas → embalar individualmente; luva; a proteção só sai depois de instalada.',
      'Espaçamento errado → gabarito 1:1; nunca "no olho".',
      'Trinca em acrílico/PVC → pré-furar com broca menor; não apertar demais; sempre arruela.'),
    P('Registro: conforme POP-MONT-01 + foto frontal a 5 metros mostrando o alinhamento.')])

pop('mont-04', 'POP-MONT-04', 'Instalação', 'Letra caixa luminosa (LED)',
    'Letras caixa com LED (frontal, halo ou lateral) instaladas, testadas acesas e com o cliente orientado sobre a fonte.',
    'Líder de Instalações', ['Luva', 'Óculos de proteção'], [
    P('Complementa o POP-MONT-01 e o POP-MONT-03 (alinhamento).'),
    A('Regra de orçamento: a Impresilk só executa a parte elétrica se o cliente JÁ TEM ponto elétrico disponível ao lado da placa, OU se o serviço elétrico extra está INCLUÍDO no pedido. Fora disso, NÃO executar — acionar o gerente.'),
    S('Antes de sair'),
    CK('Letras conferidas e LEDs TESTADOS na empresa',
       'Fontes corretas (potência compatível com o número de LEDs)',
       'Cabos, conectores, fita isolante',
       'Eletroduto ou canaleta, se a fiação ficar aparente',
       'Multímetro para testar tensão',
       'Confirmado no pedido se há serviço elétrico extra'),
    S('Tipos de iluminação'),
    L('Frontal — o LED ilumina o acrílico da frente: conferir distribuição uniforme, sem mancha escura.',
      'Retroiluminada (halo) — o LED ilumina a parede atrás: a distância da parede vem do projeto; a letra usa espaçador.',
      'Lateral — o acrílico lateral precisa estar bem encaixado para não vazar luz.'),
    S('Passo a passo no local'),
    PS('Vistoria + CONFIRMAR o ponto elétrico. Sem ponto e fora do pedido → parar e acionar o gerente.',
       'Planejar o trajeto do fio até a fonte e o ponto elétrico. Decidir canaleta/eletroduto ANTES de furar.',
       'Linha base e marcação (regra do POP-MONT-03: fita crepe antes de furar, olhar de longe).',
       'Furação + bucha + furo passante para o cabo, quando aplicável.',
       'Fixar as letras uma a uma sem apertar demais, conferindo o alinhamento a cada letra.',
       'Conexão elétrica: ligar TODAS as letras na fonte correta. NUNCA LED direto na rede 110/220V — queima na hora.',
       'Posicionar a fonte protegida de chuva e com acesso futuro para manutenção.',
       'Teste: energizar e conferir TODAS acendendo. Uma falhou? Identificar antes de finalizar.',
       'Vedação: selar a passagem do fio na parede com silicone.'),
    D('Entrega ao cliente (obrigatório): mostrar a fonte instalada e avisar VERBALMENTE que o luminoso só funciona ligado na fonte — ligar direto na tomada queima os LEDs e a garantia não cobre. Registrar a orientação no relato da OS.'),
    S('Pontos de atenção'),
    L('Cliente ligou direto na rede e queimou → sempre na fonte + aviso verbal (vira reclamação pra Impresilk mesmo sendo falha dele).',
      'Fiação aparente mal escondida → planejar o trajeto antes de furar; canaleta se precisar.',
      'Fonte inacessível → fonte queima e precisa de troca; pensar na manutenção futura.',
      'Infiltração → vedar a passagem do fio e conferir a vedação da letra.',
      'Mancha escura no acrílico → conferir a distribuição do LED ANTES de instalar.'),
    P('Registro: conforme POP-MONT-01 + foto com a luz ACESA (entardecer ou sombra).')])

pop('mont-05', 'POP-MONT-05', 'Instalação', 'Luminoso, LED e neon (placas luminosas)',
    'Placas luminosas (lona ou acrílico, LED interno ou lâmpadas) instaladas na altura certa, testadas acesas e vedadas.',
    'Líder de Instalações', ['Luva', 'Óculos de proteção', 'Cinto de segurança (altura)'], [
    P('Complementa o POP-MONT-01. Fixação em parede, suporte metálico ou estrutura no telhado.'),
    A('Regra de orçamento: igual ao POP-MONT-04 — parte elétrica só com ponto disponível ao lado da placa OU serviço elétrico incluído no pedido. Fora disso, acionar o gerente.'),
    S('Antes de sair'),
    CK('Placa conferida: tamanho, arte, sem risco; LEDs/lâmpadas TESTADOS na empresa',
       'Fonte correta enviada junto',
       'Tipo de fixação definido no projeto (parede, suporte, telhado)',
       'Suporte metálico compatível',
       'Cabos, conectores, eletroduto/canaleta · multímetro',
       'Serviço elétrico extra confirmado no pedido'),
    S('Tipos de placa'),
    L('Lona com LED interno — retroiluminada: a lona precisa estar BEM esticada para a luz sair uniforme; conferir a vedação.',
      'Acrílico com LED — risca fácil: o filme protetor só sai depois de instalada.',
      'Lâmpada tubular — conferir reator/driver correto e testar antes de fechar a caixa.'),
    S('Tipos de fixação'),
    L('Parede — suporte metálico com parafuso e bucha; conferir a ALTURA do projeto: o cliente lê de baixo.',
      'Suporte aéreo — estrutura metálica na fachada: conferir solda e estrutura, a placa pesa.',
      'Telhado — pé de fixação ou tirante: vedação do telhado contra infiltração é OBRIGATÓRIA.'),
    S('Passo a passo no local'),
    PS('Vistoria: local exato, altura do projeto, ponto elétrico. Divergência → gerente antes de furar.',
       'Conferir a altura: medir do chão até a base da placa — o cliente lê a 5-10 m de distância.',
       'Marcação da estrutura com nível a laser; marcar a fixação do suporte ou o apoio do tirante.',
       'Instalar o suporte/estrutura ANTES de pendurar a placa; conferir firmeza puxando o suporte.',
       'Manuseio de pé, com luva; filme protetor só sai depois.',
       'Fixar a placa conforme o projeto, conferindo o nível a cada ponto.',
       'Conexão elétrica na FONTE correta — nunca LED direto na rede. Fonte protegida de chuva e acessível.',
       'TESTE OBRIGATÓRIO: energizar e ver TODA a placa acesa, luz uniforme. De dia, testar cobrindo com lona/papelão.',
       'Vedação: silicone neutro na passagem de fios e bordas. No telhado, conferir contra chuva antes de descer.'),
    D('Entrega ao cliente: mostrar a fonte e avisar verbalmente — ligar direto na tomada queima os LEDs e a garantia não cobre. Registrar no relato da OS.'),
    S('Os 4 erros mais frequentes'),
    L('Placa que não acende depois que a equipe sai (conexão solta ou esqueceram de ligar) → teste obrigatório, não sair sem ver acesa.',
      'Fonte em local inadequado (chuva/sem acesso) → pensar em manutenção.',
      'Altura errada, cliente não lê → conferir ANTES de furar e olhar de longe.',
      'Placa arranhada → embalagem, luva, filme até o fim.'),
    P('Registro: conforme POP-MONT-01 + foto com a luz acesa mostrando a uniformidade.')])

pop('mont-06', 'POP-MONT-06', 'Instalação', 'Placa simples (sem eletricidade)',
    'Placas de lona, ACM fino ou MDF instaladas com a fixação certa para cada material × superfície — retas, sem risco e documentadas com foto antes/depois.',
    'Líder de Instalações', ['Luva', 'Óculos de proteção'], [
    P('Complementa o POP-MONT-01. Vale para lona vinílica, ACM fino com letras coladas, MDF e similares.'),
    D('Check-in fotográfico obrigatório: foto do LOCAL VAZIO antes de começar + foto do RESULTADO FINAL. As duas no grupo da OS. Sem as duas fotos, a instalação NÃO está formalmente concluída.'),
    S('Tabela de fixação (o coração deste POP)'),
    L('Lona vinílica em estrutura metálica (cavalete, suporte) → ilhós + corda elástica OU abraçadeira Hellermann.',
      'Lona em tapume/madeira → grampo ou parafuso com arruela larga.',
      'Lona em grade, corrimão ou poste → abraçadeira Hellermann nos ilhoses.',
      'ACM fino com letras, em alvenaria LISA → fita 3M VHB + cola PU (cordão perimetral).',
      'ACM fino em alvenaria RÚSTICA → parafuso + bucha (arruela para não marcar).',
      'ACM fino em vidro/cerâmica polida → fita 3M VHB + silicone neutro perimetral.',
      'MDF em qualquer superfície EXTERNA → parafuso + bucha. NUNCA só cola: MDF absorve umidade.',
      'MDF em ambiente coberto e seco → fita 3M VHB + cola PU em superfície lisa.',
      'Qualquer placa em estrutura metálica perfilada → rebite.'),
    S('Regras de cola e fita'),
    L('Fita 3M VHB — superfície LISA, limpa e seca; sempre com cola PU; limpar com álcool isopropílico e pressionar firme por 30 segundos.',
      'Cola PU — reforço estrutural junto com a fita, em cordão perimetral. Cura de 24h: só liberar para vento/chuva depois.',
      'Silicone NEUTRO — vedação perimetral; em vidro substitui o PU. NUNCA silicone acético: corrói metal e libera ácido.',
      'Parafuso — peça acima de 5 kg ou local com vento forte; sempre com arruela; furar antes em material rígido.',
      'Rebite — estrutura metálica; broca compatível com o rebite.',
      'Abraçadeira Hellermann — lona em grade/poste/corrimão: apertar firme sem cortar a lona no ilhós; cortar a sobra.'),
    S('Passo a passo no local'),
    PS('FOTO ANTES do local vazio no grupo da OS — sem essa foto, não iniciar.',
       'Vistoria: conferir a superfície e definir a fixação pela tabela. Dúvida → gerente.',
       'Linha base com nível a laser ou linha de pedreiro; marcar com lápis e fita crepe.',
       'Se for colar: limpar com álcool isopropílico e pano limpo. Superfície suja NÃO cola.',
       'Conferência antes de fixar: apoiar com fita crepe, olhar de longe (5-10 m), conferir alinhamento e altura.',
       'Fixar pelo sistema da tabela. Fita+PU: posicionar com calma — depois de pressionada NÃO volta atrás.',
       'Conferência final: nível, alinhamento, sem risco; limpar lápis e excesso de cola.',
       'FOTO DEPOIS frontal no grupo da OS.'),
    S('Pontos de atenção'),
    L('Placa torta → linha base sempre + conferir de longe antes do definitivo.',
      'Placa arranhada → luva; filme protetor só sai depois de instalada.',
      'Cola que solta no calor → seguir a tabela: lisa = VHB+PU; rústica = parafuso; MDF externo NUNCA só cola.',
      'Silicone errado → SEMPRE neutro em metal e vidro.',
      'Fita sem aderência → álcool isopropílico antes + 30 segundos de pressão.')])

# ═══════════════ SERRALHERIA ═══════════════
pop('ser-01', 'POP-SER-01', 'Serralheria', 'Produção de estrutura metálica',
    'Toda estrutura metálica produzida conforme o projeto aprovado pelo PCP, conferida antes de seguir para pintura ou montagem.',
    'Serralheiro', ['Luva de raspa', 'Óculos de proteção', 'Máscara de solda', 'Protetor auricular', 'Avental de raspa'], [
    S('Fluxo'),
    PS('O Projetista gera o Projeto da Estrutura: tamanho, cortes do metalon, quais barras serão usadas e como será o suporte.',
       'O projeto vai ao Gerente de PCP para aprovação.',
       'Aprovado, o PCP encaminha ao Serralheiro.',
       'O Serralheiro confere o projeto. Dúvida? Consultar o Projetista ANTES de cortar.',
       'Conferir os materiais em estoque.',
       'Material faltando → solicitar a compra ao Gerente de PCP (não improvisar bitola).',
       'Produzir a estrutura conforme o projeto aprovado.',
       'Ao finalizar, conferir a conformidade com o projeto e corrigir qualquer desvio.',
       'Estrutura segue para PINTURA, se o projeto pedir.',
       'Depois, para MONTAGEM ou INSTALAÇÃO, conforme o projeto.'),
    S('Responsabilidades'),
    L('Projetista — o projeto da estrutura.',
      'Gerente de PCP — aprovação, compra de material, encaminhamento para pintura/montagem.',
      'Serralheiro — produzir conforme o projeto e corrigir desvios.'),
    S('Registros'),
    L('Projeto da Estrutura', 'Solicitação de compra de materiais', 'Registro de produção'),
    A('Solda e corte só com EPI completo. Esmerilhadeira sem proteção ou máscara de solda levantada não é pressa — é acidente esperando.')])

# ═══════════════ DESIGN ═══════════════
pop('dsg-01', 'POP-DSG-01', 'Design', 'Desenvolvimento e exportação de artes',
    'Artes desenvolvidas com precisão a partir do briefing e exportadas prontas para os equipamentos — sem ajuste na produção.',
    'Designer', [], [
    S('Fluxo'),
    PS('Receber e analisar o briefing de Vendas; clarificar TODA dúvida com o vendedor antes de começar.',
       'Desenvolver a arte respeitando o briefing, a identidade visual da Impresilk e a do cliente.',
       'Apresentar o layout de aprovação a Vendas (e, por ele, ao cliente); ajustar conforme o retorno até a aprovação final.',
       'Exportar nos formatos dos equipamentos (impressão, corte, router, laser): conferir dimensão, resolução, sangria e aspectos técnicos ANTES de liberar.',
       'Alinhar com Produção e PCP a viabilidade e o cronograma; orientar a aplicação das artes nos materiais.',
       'Registrar tudo: versões, comentários do cliente e arte final aprovada, no padrão de pastas da empresa.',
       'Verificação final: a peça exportada atende exatamente à especificação aprovada.'),
    D('Arquivo liberado para a produção é arquivo SEM pendência: medida final, cor conferida, sangria e corte marcados. Ajuste em cima da máquina é retrabalho de todo o setor.'),
    S('Pontos de atenção'),
    L('Briefing incompleto → devolver a Vendas antes de desenhar, não adivinhar.',
      'Exportação com dimensão errada → conferir a medida FINAL contra a OS, não a do rascunho.',
      'Cores fora do perfil do equipamento → validar perfil de cor antes de mandar imprimir.',
      'Versão errada aplicada → nomenclatura de versões e pasta de "aprovados" separada.')])

# ═══════════════ COMERCIAL ═══════════════
pop('com-01', 'POP-COM-01', 'Comercial', 'Realizar venda (do primeiro contato ao pedido)',
    'Toda venda entra completa e rastreável no Mubisys: cliente cadastrado, briefing feito, orçamento correto e pedido aprovado com pagamento identificado.',
    'Vendedor(a)', [], [
    S('Fluxo'),
    PS('A Recepção recebe o cliente (presencial, telefone ou chat) e faz o cadastro; cliente de rede social → o vendedor repassa os dados à Recepção.',
       'Cadastro no Mubisys (carrinho → Clientes → adicionar): empresa, telefone, contato (nome, telefone, nascimento), endereço completo, CNPJ, razão social, e-mail, vendedor, tabela, tipo de atendimento, classificação, origem, entrada.',
       'Identificar a demanda: qual produto o cliente procura e qual o orçamento disponível — adequar a proposta à realidade financeira SEM abrir mão da qualidade.',
       'Fazer o briefing completo (é dele que o Designer tira o layout).',
       'Informação suficiente → solicitar o Layout de Aprovação ao Designer. Insuficiente → agendar visita.',
       'Na visita, colher TUDO que influencia o projeto e conferir o briefing. Pecar pelo excesso.',
       'Designer devolve o Layout de Aprovação.',
       'Elaborar o orçamento no Mubisys (carrinho → Orçamento): trabalho, logística, prazo (consultar a produção), validade, forma e condição de pagamento, faturamento, observações. Instalação em outro município → incluir o custo. Retirada de placa antiga → incluir o produto "Serviço de retirada".',
       'Enviar ao cliente: orçamento + layout de aprovação + valores e formas de pagamento.',
       'Pedido aprovado → aprovar o orçamento no Mubisys (ícone do polegar) e selecionar "solicitar aprovação do PCP".',
       'Identificar o pagamento nas observações, notificar o Financeiro e encaminhar o comprovante.',
       'Solicitar ao Designer o Layout de Produção e Instalação.'),
    S('Pontos de atenção'),
    L('Cadastro incompleto → orçamento trava mais na frente; preencher TODOS os campos obrigatórios.',
      'Prazo prometido sem consultar a produção → atraso e cliente frustrado.',
      'Retirada de material antigo esquecida no orçamento → a equipe de montagem trabalha de graça.',
      'Pedido sem comprovante identificado → Financeiro não baixa e o PCP não libera.')])

# ═══════════════ FINANCEIRO ═══════════════
pop('fin-01', 'POP-FIN-01', 'Financeiro', 'Preencher e interpretar o relatório DRE',
    'O DRE mensal preenchido a partir do Mubisys, com cada conta na categoria certa e os indicadores comparados às referências do segmento.',
    'Gerente Administrativo', [], [
    S('Extração da base'),
    PS('Mubisys → Administração → Relatórios → Plano de Contas.',
       'Exibição "comparativa"; empresa = Impresilk; busca por DATA DE PAGAMENTO.',
       'Inserir o período (data inicial e final) e buscar.',
       'Abrir a planilha "DRE Impresilk".'),
    S('Preenchimento'),
    PS('Receitas: somar separadamente Produtos, Serviços e Portas e Painéis.',
       'Impostos e deduções: só o que incide direto sobre a venda (ISS, ICMS).',
       'Custo operacional (ligado à fabricação): instalação externa, terceirização, materiais e insumos.',
       'Despesa operacional (manter o negócio): funcionários, administrativas, limpeza, fixas, máquinas, veículos, terceiros, segurança do trabalho.',
       'Despesas bancárias; depois empréstimos; ao final Distribuição de Lucro (retiradas + arrendamento).'),
    S('O que cada resultado significa'),
    L('Receitas — total faturado no mês.',
      'Receita Operacional Líquida — o valor real recebido, já sem impostos de venda.',
      'Resultado Operacional Bruto — o que sobra depois dos custos variáveis.',
      'Resultado Operacional Líquido — o que sobra depois de TODOS os custos e despesas.',
      'Resultado Caixa — o que sobra depois de toda a operação, bancos e retiradas.'),
    S('Análises'),
    L('Margem Bruta — % do faturamento que sobra após custos variáveis e impostos; enxerga item de baixa rentabilidade.',
      'Margem Líquida — lucro por real de receita (margem 10% = R$10 a cada R$100).',
      'Análise Vertical — o peso percentual de cada conta sobre o faturamento.'),
    D('Referências do segmento: impostos até 12% · custo operacional 45% · folha 15% · despesa operacional 20% · resultado operacional líquido (EBITDA) 20%. Fugiu disso? Investigar a conta na análise vertical.')])

# ═══════════════ PCP (reunião diária + os 5 POPs de fluxo do RH) ═══════════════
pop('pcp-01', 'POP-PCP-01', 'PCP & Expedição', 'Reunião diária de PCP (17h)',
    'Todos os pedidos revisados diariamente: pendências classificadas, entregas coordenadas e o sistema atualizado no mesmo dia.',
    'Gerente de PCP', [], [
    PS('Preparar os relatórios de status de pedidos e materiais; reunir os participantes.',
       'Começar PONTUALMENTE às 17h.',
       'Revisar os pedidos do mais antigo para o mais novo, atualizando o status de cada um no sistema.',
       'Classificar as pendências: prontos para entrega (Saída de Pedidos) · Pendência de Medida · Pendência de Compra · Pendência com Cliente.',
       'Dar baixa nos pedidos entregues no dia.',
       'Mandar as informações de entrega no grupo de WhatsApp da equipe de entrega.',
       'Confirmar os detalhes de entrega com o cliente e registrar a confirmação.',
       'Agendar as ligações de confirmação pós-entrega para o dia seguinte.',
       'Documentar decisões e novas pendências no sistema.',
       'Encerrar com o resumo das ações e a confirmação da próxima reunião.'),
    D('Reunião de PCP não é debate — é rito. 15 a 20 minutos, todo dia, mesma hora. O que não virou registro no sistema não aconteceu.')])

# Os 5 POPs de fluxo que moravam no RH: migram com os blocos originais.
with open(os.path.join(AQUI, 'rh-pops-conteudo.json')) as f:
    RH = json.load(f)
MAPA_RH = {
    'POP — Fluxo de Pedido (Comercial → PCP → Produção)': ('pcp-02', 'POP-PCP-02'),
    'POP — Fluxo de Design e Revisão': ('pcp-03', 'POP-PCP-03'),
    'POP — Fluxo de Produção': ('pcp-04', 'POP-PCP-04'),
    'POP — Fluxo de Urgência': ('pcp-05', 'POP-PCP-05'),
    'POP — Rotinas de Comunicação e Alinhamento': ('pcp-06', 'POP-PCP-06'),
}
for r in RH:
    chave = MAPA_RH.get(r.get('titulo'))
    if not chave:
        continue
    idn, cod = chave
    blocos = list(r.get('blocos') or [])
    if r.get('sla'):
        blocos.insert(0, D('SLA: ' + r['sla']))
    pop(idn, cod, 'PCP & Expedição',
        r['titulo'].replace('POP — ', ''),
        r.get('descricao') or '', 'Equipe', [], blocos, versao=str(r.get('versao') or '1.0'))

# ═══════════════ JORNADAS DE FABRICAÇÃO ═══════════════
def et(idn, titulo, blocos):
    return {"id": "et-" + idn, "titulo": titulo, "blocos": blocos}

JORNADAS = [
 {"id": "jor-pintura", "titulo": "Pintura de material", "ordem": 1, "nivel": "Técnico", "versao": "1.0",
  "descricao": "Da chapa crua ao acabamento que parece de fábrica: preparação, primer, tinta e cura — em ACM, PVC, MDF e metal.",
  "revisadoEm": "2026-08-03T12:00:00.000Z",
  "etapas": [
   et('pin-1', 'Por que a pintura começa antes da tinta', [
     P('Um letreiro pode ter o corte perfeito e a solda impecável — se a pintura falhar, é ELA que o cliente vê. Casca de laranja, escorrido, poeira presa no verniz: tudo isso nasce ANTES da pistola, na preparação.'),
     D('Regra nº 1 da pintura profissional: tinta não esconde defeito — tinta REVELA defeito. Risco de lixa grossa, dedo de gordura, poeira: tudo aparece dobrado depois de pintado.'),
     S('O que você vai dominar nesta jornada'),
     L('Preparar cada material (metal, MDF, PVC, ACM) do jeito que ele pede.',
       'Escolher primer e tinta certos para peça de comunicação visual exposta a sol e chuva.',
       'Aplicar sem escorrido e sem casca de laranja.',
       'Respeitar cura antes de manusear, adesivar ou instalar.'),
     A('EPIs desta jornada: máscara com filtro para vapores orgânicos (não é a de poeira!), luva nitrílica, óculos e avental. Pintar sem máscara de carvão ativado é intoxicação lenta.')]),
   et('pin-2', 'Preparação da superfície (o segredo dos 80%)', [
     P('80% do resultado da pintura é preparação. Cada material pede um caminho:'),
     S('Metal (metalon, chapa, galvanizado)'),
     PS('Remover óleo e graxa com desengraxante ou thinner limpo — pano sempre limpo, não o da bancada.',
        'Lixar para quebrar o brilho e dar ancoragem: lixa 220-320 a seco.',
        'Galvanizado: lixar de leve e usar primer específico (a tinta não agarra no zinco puro).',
        'Remover TODO o pó com pano umedecido em thinner (tack cloth se tiver) — soprar só espalha.'),
     S('MDF'),
     PS('Selar as bordas: o miolo do MDF bebe tinta como esponja. Selador ou cola branca diluída nas bordas, lixar depois de seco.',
        'Lixa 220 no plano, 320 nas bordas seladas.',
        'MDF vai pra área externa? Repense o material — MDF incha. Se for inevitável: selar TODAS as faces e arestas.'),
     S('PVC expandido e acrílico'),
     PS('Limpar com álcool isopropílico (nunca thinner forte no acrílico — ele TRINCA/embranquece).',
        'Lixar de leve com 400 só para fosquear onde a tinta vai pegar.',
        'Acrílico: preferir pintura na face INTERNA (a face lisa externa protege a tinta).'),
     S('ACM'),
     PS('O ACM já vem pintado de fábrica: em geral se ADESIVA, não se pinta. Quando o projeto pedir pintura: lixa 400, limpar com isopropílico, primer de aderência.',
        'Nunca lixar além da camada de pintura original — o alumínio exposto pede outro tratamento.'),
     CK('Superfície sem óleo, sem poeira e sem brilho', 'Bordas de MDF seladas e lixadas', 'Material conferido contra a OS antes de pintar')]),
   et('pin-3', 'Primer: quando usar e qual', [
     P('Primer é a ponte entre o material e a tinta. Pular o primer é pedir para a tinta descascar em 6 meses de sol.'),
     L('Metal ferroso (metalon, chapa preta) → fundo antiferrugem (zarcão ou primer sintético). SEMPRE — ferrugem sob a tinta continua trabalhando.',
       'Galvanizado e alumínio → primer de aderência (wash primer / epóxi). Tinta direto no zinco solta em placas.',
       'MDF → fundo preparador / selador, depois lixa 320 para nivelar.',
       'PVC → primer de aderência para plástico, se a tinta não for própria para plástico.',
       'ACM (quando pintado) → primer de aderência automotivo.'),
     D('Teste rápido de aderência depois do primer seco: fita crepe forte colada e arrancada de uma vez num canto escondido. Saiu primer na fita? A preparação falhou — voltar uma etapa.'),
     A('Respeite o tempo de lixamento do primer: lixar antes da cura embucha a lixa e arranca o fundo.')]),
   et('pin-4', 'A tinta certa para cada peça', [
     S('Para peça externa (letreiro, placa, estrutura)'),
     L('PU (poliuretano) bicomponente — o padrão profissional: resistência a sol e chuva, brilho que dura. Exige catalisador na proporção EXATA do fabricante e vida útil de mistura (pot life) — misturou, use.',
       'Esmalte sintético — aceitável em estrutura metálica simples; seca lenta, menos resistente a UV.',
       'Automotiva (base + verniz PU) — acabamento nobre em letra caixa e peças vistas de perto.'),
     S('Para peça interna'),
     L('Acrílica/esmalte à base d’água — sem cheiro forte, boa para MDF de ambientes internos.',
       'Spray de qualidade — retoques e peças pequenas; nunca spray de bazar em peça de cliente.'),
     S('Cores e padrão'),
     L('Cor fechada com o design pelo código (Pantone/RAL ou fórmula da loja) — nunca "azul parecido".',
       'Anotar o código da cor na OS: retoque futuro sem referência vira peça bicolor.'),
     A('Catalisador fora de proporção = tinta que nunca seca OU que trinca. Balança/copo graduado, não olhômetro.')]),
   et('pin-5', 'Aplicação: pistola, rolo e spray', [
     S('Pistola (o acabamento padrão da comunicação visual)'),
     PS('Diluir conforme o fabricante e COAR a tinta (meia de nylon/filtro) — grumo entope o bico e cospe na peça.',
        'Regular em papelão: leque aberto, pressão média; ajustar até sair névoa uniforme.',
        'Distância de 15-20 cm, pistola sempre PERPENDICULAR à peça, movimento contínuo do braço (não do punho).',
        'Passadas paralelas com 50% de sobreposição; começar e terminar FORA da peça.',
        'Demãos finas e cruzadas (uma horizontal, a próxima vertical) — 2 a 3 demãos finas > 1 grossa.',
        'Respeitar o intervalo entre demãos do fabricante (flash time).'),
     S('Rolo e trincha (estruturas e fundos)'),
     L('Rolo de espuma para esmalte em metal — sem textura de pelo.', 'Sem excesso no rolo: escorrido em quina é o defeito nº 1.'),
     S('Ambiente'),
     L('Área ventilada mas SEM vento e sem poeira em suspensão (varrer molhado antes, nunca durante).',
       'Peça na horizontal quando possível — escorrido não existe na horizontal.',
       'Nunca pintar em dia muito úmido ou frio: a tinta "vela" (embranquece) e não ancora.'),
     A('Escorreu? NÃO passe o dedo. Deixe secar por completo, lixe 600 e retoque a demão. Mexer na tinta fresca transforma um defeito pequeno num retrabalho inteiro.')]),
   et('pin-6', 'Cura, manuseio e verniz', [
     P('Seco ao toque NÃO é curado. A tinta seca em horas, mas cura (endurece de verdade) em DIAS.'),
     L('Manuseio leve: respeitar o mínimo do fabricante (em geral 24h).',
       'Adesivar/aplicar vinil sobre pintura: só após a cura indicada (PU: em geral 72h+). Adesivo em tinta verde solta junto com a tinta.',
       'Instalar peça externa: ideal após cura completa; transporte com manta/espuma, nunca peça sobre peça.',
       'Verniz PU sobre base: dá profundidade e proteção UV em cores intensas e letras nobres.'),
     CK('Peça sem marcas de dedo, poeira ou escorrido sob luz rasante',
        'Cor conferida contra o código da OS, à luz do dia',
        'Cura respeitada antes de embalar/adesivar/instalar',
        'Código da cor anotado na OS para retoque futuro')]),
   et('pin-7', 'Erros que a gente não repete', [
     L('Pintar sobre superfície engordurada → a tinta abre "olhos de peixe". Desengraxar SEMPRE.',
       'Misturar catalisador no olho → não cura ou trinca. Proporção do fabricante, medida.',
       'Pintar MDF sem selar borda → borda áspera que chupa tinta e incha na primeira chuva.',
       'Tinta direto no galvanizado → descasca em placas. Primer de aderência.',
       'Pressa entre demãos → enrugamento (a de baixo ainda tinha solvente).',
       'Adesivar no dia seguinte da pintura PU → o vinil arranca a tinta na primeira troca.',
       'Pintar com vento/poeira → acabamento lixa 40. Ambiente controlado.',
       'Sem máscara de vapores → dor de cabeça hoje, saúde amanhã. EPI não é opcional.'),
     D('Dominou esta jornada? Então na prática: acompanhe duas pinturas completas com quem já domina, execute a terceira sob supervisão — e registre no POP do setor.')]),
  ]},

 {"id": "jor-letracaixa", "titulo": "Fabricação de letra caixa", "ordem": 2, "nivel": "Técnico", "versao": "1.0",
  "descricao": "Do arquivo do designer à letra pronta para instalar: materiais, corte, montagem, LED e acabamento — o produto-assinatura da comunicação visual.",
  "revisadoEm": "2026-08-03T12:00:00.000Z",
  "etapas": [
   et('lc-1', 'O que é uma letra caixa bem feita', [
     P('Letra caixa é o produto que mais carrega a marca do cliente — e a nossa. É tridimensional, vista de perto e de longe, de dia e (quando luminosa) de noite. Não tem onde esconder defeito.'),
     S('Anatomia'),
     L('FACE — a frente da letra (acrílico, PVC, ACM, galvanizado).',
       'LATERAL (costela/alma) — dá a profundidade; define a "caixa".',
       'FUNDO — fecha a letra; na retroiluminada é por onde a luz sai para o halo.',
       'FIXAÇÃO — parafusos frontais, prisioneiros (pinos atrás) ou espaçadores.',
       'ILUMINAÇÃO (quando luminosa) — módulos de LED + fonte.'),
     S('Os 3 tipos de iluminação (mesmo vocabulário do POP-MONT-04)'),
     L('Frontal — face de acrílico translúcido, luz atravessa a face.',
       'Retroiluminada (halo) — face fechada, luz sai por trás e desenha um halo na parede.',
       'Lateral — a lateral translúcida deixa a luz sair pelo contorno.'),
     D('A régua de qualidade: de PERTO, cantos fechados e acabamento limpo; de LONGE, espessuras e profundidades iguais em todas as letras; ACESA, luz uniforme sem manchas nem pontos de LED marcados.')]),
   et('lc-2', 'Do arquivo ao corte', [
     PS('Receber do design o arquivo vetorial FINAL (curvas fechadas, sem contorno aberto), na medida real de instalação.',
        'Conferir a medida contra a OS: altura da letra, comprimento total do conjunto, profundidade da caixa.',
        'Definir o aproveitamento de chapa (nesting): girar letras para caber, respeitando o sentido do material quando houver.',
        'Cortar a FACE (router para PVC/acrílico/ACM; laser para acrílico fino; guilhotina+dobra para galvanizado).',
        'Cortar/preparar LATERAIS na altura da profundidade do projeto.',
        'Cortar o FUNDO (quando o projeto tiver) já marcando a posição de fontes e passagem de fio.'),
     L('Router em acrílico: fresa própria e avanço certo — avanço errado DERRETE a borda.',
       'Laser em acrílico: acabamento de borda superior (flame polish natural); nunca laser em PVC — gera gás corrosivo e tóxico (cloro).',
       'Galvanizado: cortar com tesoura de chapa/guilhotina; rebarbar SEMPRE — borda de chapa corta a mão de quem instala.'),
     A('Conferência antes de montar: pousar as faces cortadas sobre a impressão 1:1 do conjunto (ou medir letra a letra). Erro de corte descoberto na montagem custa a chapa inteira.')]),
   et('lc-3', 'Montagem da caixa', [
     S('PVC e acrílico'),
     PS('Laterais em fita: colar a lateral acompanhando o contorno da face, canto a canto.',
        'Cola própria (para acrílico, cola de acrílico/clorofórmio aplicado fino; para PVC, adesivo de PVC) — pouca cola bem posta > muita cola escorrendo.',
        'Cantos e curvas fechadas: aquecer levemente a lateral de PVC para acompanhar a curva sem vincar.',
        'Reforçar internamente os pontos de fixação (blocos onde entram parafusos/prisioneiros).'),
     S('Galvanizado'),
     PS('Dobrar a lateral acompanhando o desenho (viradeira/calandra nas curvas).',
        'Soldar ou rebitar lateral à face por DENTRO; esmerilhar respingos.',
        'Tratar os pontos de solda antes da pintura (POP de pintura: primer antiferrugem).'),
     S('Regras de sempre'),
     L('Esquadro e profundidade iguais em TODAS as letras do conjunto — o olho percebe 2 mm de diferença na sombra.',
       'Letra luminosa: pintar/forrar o INTERIOR de branco para render a luz.',
       'Prever dreno (furinho baixo) em letra externa: condensação acumulada mata LED.'),
     CK('Cantos fechados, sem fresta de luz', 'Profundidade uniforme no conjunto', 'Pontos de fixação reforçados', 'Interior branco (se luminosa)')]),
   et('lc-4', 'Iluminação: LED e fonte', [
     PS('Calcular os módulos: distribuir em linhas uniformes, respeitando a distância face-LED do projeto (LED perto demais da face = bolinhas marcadas; longe demais = luz fraca).',
        'Somar a potência dos módulos e dimensionar a FONTE com folga de ~20%.',
        'Fixar os módulos no fundo (adesivo do módulo + ponto de silicone neutro nos externos).',
        'Cabear em paralelo conforme o fabricante; respeitar polaridade; emendas soldadas e isoladas.',
        'Furo passante do cabo com passa-fio vedado.',
        'TESTAR TUDO ACESO NA BANCADA antes de fechar e antes de embalar — é a regra que o POP-MONT-04/05 cobra na entrega.'),
     L('Face acrílica leitosa (branca) difunde melhor que cristal; cores intensas pedem LED mais forte.',
       'Halo: fundo da letra afastado da parede pelos espaçadores do projeto — halo bonito é projeto + instalação, e começa aqui.',
       'Fonte NUNCA dentro de letra sem ventilação/acesso — ela queima e precisa de troca (POP-MONT-04).'),
     A('LED é 12V/24V na FONTE. Deixar isso claro na etiqueta da peça: "LIGAR SOMENTE NA FONTE" — o instalador e o cliente agradecem, a garantia também.')]),
   et('lc-5', 'Acabamento e preparação para instalação', [
     PS('Acabamento de borda: lixar/polir as laterais; acrílico ganha polimento (flame/massa de polir).',
        'Pintura (quando o projeto pedir): seguir a jornada de Pintura — preparação, primer, PU.',
        'Conferir a peça sob luz rasante: risco, poeira na tinta, cola aparente.',
        'Marcar no verso a POSIÇÃO da letra no conjunto (numeração) — o instalador monta o "quebra-cabeça" pelo gabarito.',
        'Imprimir o GABARITO 1:1 do conjunto (o POP-MONT-03 depende dele).',
        'Embalar INDIVIDUALMENTE (papelão/espuma entre letras) e etiquetar com o nº da OS.'),
     CK('Todas as letras testadas acesas (se luminosas)', 'Gabarito 1:1 impresso junto com a peça',
        'Fixadores + buchas + espaçadores no kit da OS', 'Etiqueta "ligar somente na fonte" (se LED)',
        'Embalagem individual, OS identificada')]),
   et('lc-6', 'Erros que a gente não repete', [
     L('Corte sem conferir medida contra a OS → conjunto que não cabe na fachada.',
       'Laser em PVC → gás tóxico e corrosivo. NUNCA.',
       'Cola escorrida na face → aparece de noite, iluminada. Pouca cola, bem posta.',
       'LED colado sem teste → letra apagada na entrega e desmontagem no cliente.',
       'Fonte subdimensionada → luz fraca e fonte quente; 20% de folga sempre.',
       'Interior escuro em letra luminosa → luz morta; interior branco.',
       'Sem dreno em letra externa → água acumulada, LED morto em 3 meses.',
       'Embalar letras em contato → risco na face; papelão entre CADA letra.'),
     D('Fechou a jornada: monte um conjunto completo de 3+ letras sob supervisão, com teste aceso e gabarito — e registre a leitura dos POPs MONT-03 e MONT-04, que são a continuação natural desta trilha na rua.')]),
  ]},

 {"id": "jor-portas", "titulo": "Produção de portas e painéis", "ordem": 3, "nivel": "Técnico", "versao": "1.0",
  "descricao": "A linha de Portas e Painéis da Impresilk: estrutura em metalon, fechamento, ferragens, pintura e entrega — serralheria de precisão.",
  "revisadoEm": "2026-08-03T12:00:00.000Z",
  "etapas": [
   et('po-1', 'O produto e o padrão', [
     P('Portas e Painéis são linha própria de receita da Impresilk (têm até linha separada no DRE). Diferente de um letreiro, uma porta é produto de USO: abre e fecha milhares de vezes, segura peso, leva chuva e sol. O padrão aqui é serralheria de precisão.'),
     S('O que compõe'),
     L('QUADRO (estrutura) — metalon soldado no esquadro; é o esqueleto que define se a porta fecha redonda pelos próximos 10 anos.',
       'FECHAMENTO — chapa galvanizada, ACM, ripado metálico ou tela, conforme o projeto.',
       'FERRAGENS — dobradiças, roldanas/trilho (correr), fechadura, puxador, mola quando especificada.',
       'ACABAMENTO — pintura PU/esmalte conforme a jornada de Pintura.'),
     D('Régua de qualidade: esquadro com diagonais IGUAIS (diferença máxima de 2 mm), folgas uniformes ao redor da folha, abre e fecha com um dedo, sem arrastar nem bater.')]),
   et('po-2', 'Projeto e medidas no local', [
     PS('Medir o VÃO no local, não confiar em medida por telefone: largura em 3 alturas, altura nos 2 lados, e as DIAGONAIS do vão.',
        'Verificar prumo e nível do vão: vão fora de esquadro muda o projeto da folha.',
        'Definir o sentido de abertura com o cliente (abre pra dentro/fora, esquerda/direita) e ONDE ficam dobradiça e fechadura.',
        'Porta de correr: conferir espaço de deslizamento na parede e estrutura para o trilho.',
        'Registrar tudo no projeto: medidas, sentido, ferragens, fechamento e cor (código).'),
     L('Folga padrão da folha: ~5 mm por lado e embaixo o que o piso pedir (conferir se o piso é nivelado!).',
       'Peso do fechamento muda a dobradiça: chapa cheia pede dobradiça reforçada ou 3ª dobradiça.'),
     A('Diagonais do VÃO diferentes = vão torto. Resolver no projeto (folga assimétrica planejada), não no improviso da instalação.')]),
   et('po-3', 'Corte e solda do quadro', [
     PS('Cortar o metalon na esquadria certa: 45° nos encontros aparentes, 90° nos internos, conforme o projeto.',
        'Montar o quadro na BANCADA PLANA, travado com esquadros/grampos.',
        'Conferir as DIAGONAIS antes de soldar de vez: iguais = esquadro perfeito.',
        'Pontear primeiro (solda a ponto nos 4 cantos), conferir de novo as diagonais, SÓ ENTÃO fechar o cordão.',
        'Travessas intermediárias conforme o projeto (reforço de fechadura SEMPRE: caixa de fechadura pede chapa/tubo de reforço).',
        'Esmerilhar os cordões aparentes; rebarbar tudo.'),
     L('Soldar tudo de uma vez sem pontear → o calor puxa o quadro e ele "empena" fora do esquadro.',
       'Sequência de solda em X (cantos opostos) distribui o calor.',
       'Solda em galvanizado: lixar o zinco no ponto da solda e retocar depois com primer rico em zinco (galvanização a frio).'),
     CK('Diagonais do quadro iguais (±2 mm)', 'Reforço interno no ponto da fechadura', 'Cordões esmerilhados, sem respingo', 'Quadro plano na bancada (não balança)')]),
   et('po-4', 'Fechamento e ferragens', [
     S('Fechamento'),
     PS('Cortar o fechamento (chapa/ACM/ripado) com folga mínima interna.',
        'Fixar: solda a ponto (chapa), rebite (ACM sobre quadro) ou parafuso autobrocante — conforme projeto.',
        'Chapa grande: fixar do centro para as bordas para não ondular.'),
     S('Ferragens'),
     PS('Dobradiças: 2 reforçadas até ~20 kg de folha; acima, 3. Soldar/parafusar NO REFORÇO, alinhadas no mesmo eixo (senão a porta "manca").',
        'Fechadura: abrir a caixa no reforço; testar o giro da chave e o encaixe do trinco ANTES da pintura.',
        'Porta de correr: trilho nivelado A LASER, roldanas conforme o peso, batentes de fim de curso nas duas pontas e GUIA inferior (porta de correr sem guia bate com o vento).',
        'Puxador na altura do projeto (padrão ~1,00-1,10 m do piso ao centro).'),
     A('TESTE DE BANCADA obrigatório: pendurar a folha no quadro (ou simular no cavalete) e abrir/fechar 10 vezes ANTES de pintar. Ferragem que prende depois de pintada = retrabalho de pintura inteiro.')]),
   et('po-5', 'Pintura e proteção', [
     PS('Seguir a jornada de Pintura: desengraxar, lixar, primer antiferrugem (ou galvanização a frio nos pontos de solda), tinta PU/esmalte na cor de código da OS.',
        'Pintar com as ferragens PROTEGIDAS (fita crepe) ou antes de instalá-las, conforme o caso.',
        'Não esquecer: topo e base da folha também levam tinta — são as faces que mais pegam água.',
        'Cura antes de embalar (PU: 72h ideal) — porta empilhada com tinta verde cola uma na outra.'),
     CK('Cor conferida pelo código da OS', 'Topo e base pintados', 'Ferragens limpas, sem tinta', 'Cura respeitada antes de embalar')]),
   et('po-6', 'Entrega, instalação e conferência final', [
     PS('Conferir o kit da OS: folha, batente/trilho, ferragens, parafusos/buchas, chaves (todas as cópias!).',
        'Transporte em pé, amarrada, com manta — nunca deitada sobre outra peça.',
        'Na instalação: nivelar e aprumar o batente/trilho ANTES de pendurar a folha; calçar as folgas uniformes.',
        'Teste final na frente do cliente: abrir, fechar, travar e destravar com TODAS as chaves.',
        'Registro padrão POP-MONT-01: foto antes/depois, relato com nº da OS, aprovação do cliente.'),
     S('Erros que a gente não repete'),
     L('Medida por telefone → folha que não entra no vão.',
       'Soldar sem pontear → quadro empenado.',
       'Fechadura aberta depois da pintura → risco e retrabalho.',
       'Correr sem guia inferior → porta batendo com o vento na primeira semana.',
       'Entregar sem testar todas as chaves → chamado de assistência no dia seguinte.'),
     D('Jornada concluída: produza uma porta completa sob supervisão — do vão medido à chave entregue — e o gestor valida no mapa de treinamento.')]),
  ]},
]

CFG = {
    "setores": ['Instalação', 'Serralheria', 'Impressão', 'Acabamento & Pintura', 'Design',
                'Comercial', 'PCP & Expedição', 'Financeiro', 'Administrativo'],
    "gestores": {},
}

# ─── gera o SQL ───
def sql_str(o):
    return "$json$" + json.dumps(o, ensure_ascii=False) + "$json$"

linhas = []
for p in POPS:
    linhas.append(
        "insert into pops_registros (colecao, id, registro, atualizado_em) values "
        f"('pops', '{p['id']}', {sql_str(p)}::jsonb, now()) "
        "on conflict (colecao, id) do update set registro = excluded.registro, atualizado_em = now(), apagado = false;")
for j in JORNADAS:
    linhas.append(
        "insert into pops_registros (colecao, id, registro, atualizado_em) values "
        f"('jornadas', '{j['id']}', {sql_str(j)}::jsonb, now()) "
        "on conflict (colecao, id) do update set registro = excluded.registro, atualizado_em = now(), apagado = false;")
linhas.append(
    "insert into pops_config_global (id, config, atualizado_em) values (true, "
    + sql_str(CFG) + "::jsonb, now()) on conflict (id) do update set config = excluded.config, atualizado_em = now();")
linhas.append(
    "insert into pops_meta (chave, valor, atualizado_em) values ('rev', "
    "$json${\"rev\": 1, \"porColecao\": {\"pops\": 1, \"jornadas\": 1, \"cfg\": 1}}$json$::jsonb, now()) "
    "on conflict (chave) do update set valor = jsonb_set(jsonb_set(pops_meta.valor, '{porColecao,pops}', "
    "(coalesce((pops_meta.valor->'porColecao'->>'pops')::int, 0) + 1)::text::jsonb), '{porColecao,jornadas}', "
    "(coalesce((pops_meta.valor->'porColecao'->>'jornadas')::int, 0) + 1)::text::jsonb), atualizado_em = now();")

with open(os.path.join(AQUI, 'seed.sql'), 'w') as f:
    f.write('\n'.join(linhas) + '\n')
print(f"seed.sql gerado: {len(POPS)} POPs + {len(JORNADAS)} jornadas "
      f"({sum(len(j['etapas']) for j in JORNADAS)} etapas)")
