# -*- coding: utf-8 -*-
"""
TREINAMENTOS — o terceiro tipo de conteúdo do sistema.

POP    = o procedimento do setor (consulta na bancada)
Jornada= a trilha de fabricação (aprender o processo)
Treinamento = conteúdo pontual, ATRIBUÍDO a pessoas: código de ética, normas
              de segurança, integração e o que aparecer no meio do ano.

Campos próprios:
  tipo          'etica' | 'norma' | 'esporadico'
  exigeAceite   pede aceite formal ("li, entendi e me comprometo")
  validadeMeses reciclagem: depois disso o treinamento vence e volta a aparecer
"""

P  = lambda t: {"tipo": "paragrafo", "texto": t}
S  = lambda t: {"tipo": "subtitulo", "texto": t}
PS = lambda *i: {"tipo": "passos", "itens": list(i)}
L  = lambda *i: {"tipo": "lista", "itens": list(i)}
D  = lambda t: {"tipo": "destaque", "texto": t}
A  = lambda t: {"tipo": "alerta", "texto": t}
CK = lambda *i: {"tipo": "checklist", "itens": list(i)}

def tre(idn, titulo, tipo, resumo, blocos, exigeAceite=False, validadeMeses=None, ordem=99):
    r = {"id": "tre-" + idn, "titulo": titulo, "tipo": tipo, "resumo": resumo,
         "blocos": blocos, "exigeAceite": exigeAceite, "versao": "1.0", "ordem": ordem,
         "revisadoEm": "2026-08-04T12:00:00.000Z", "revisadoPor": "Semente inicial"}
    if validadeMeses:
        r["validadeMeses"] = validadeMeses
    return r

TREINAMENTOS = [

# ═══════════════════════ CÓDIGO DE ÉTICA ═══════════════════════
tre('etica', 'Código de Ética e Conduta', 'etica', ordem=1, exigeAceite=True, validadeMeses=12,
    resumo='O combinado de como a gente se comporta na Impresilk — com o cliente, com o colega e com o dinheiro da empresa.',
    blocos=[
    P('Este código não é papel de gaveta. Ele descreve o que se espera de cada pessoa que trabalha na Impresilk, todos os dias — do chão de fábrica à direção. Ler e aceitar faz parte de trabalhar aqui.'),
    D('A regra que resume todas as outras: se você ficaria constrangido de contar ao cliente, ao colega ou à sua família o que está prestes a fazer, não faça. Pergunte antes.'),

    S('1. Como tratamos as pessoas'),
    L('Respeito não depende de cargo, tempo de casa, gênero, cor, religião, orientação, idade ou origem.',
      'Não se tolera humilhação, apelido ofensivo, grito, ameaça ou "brincadeira" que constrange.',
      'Assédio moral ou sexual é motivo de desligamento — sem exceção, em qualquer nível hierárquico.',
      'Discordar faz parte do trabalho. Desrespeitar, não.',
      'Quem lidera dá o exemplo: liderança que grita autoriza todo mundo a gritar.'),

    S('2. Segurança: a regra que ninguém pode flexibilizar'),
    L('EPI não é opcional e não é escolha pessoal — é condição para operar.',
      'Ninguém trabalha em altura sem treinamento válido e sem ancoragem.',
      'Máquina com proteção removida não roda. Nunca.',
      'Parar um serviço por segurança NUNCA gera punição — nem para quem parou, nem para a equipe.',
      'Presenciar risco e não avisar é participar do risco.'),
    A('Pressa nunca justifica improviso em segurança. Prazo se renegocia; acidente, não.'),

    S('3. Com o cliente'),
    L('Prometer o que a empresa consegue entregar — prazo inventado é problema adiado.',
      'Erro nosso se assume e se corrige rápido, sem empurrar a culpa para o cliente ou para outro setor.',
      'Não se fala mal de cliente, nem em grupo interno, nem na obra.',
      'Informação do cliente (arte, marca, projeto, preço) é confidencial: não circula fora do necessário e não vira exemplo público sem autorização.',
      'Foto de obra só é publicada com autorização.'),

    S('4. Com o dinheiro e o material da empresa'),
    L('Material da empresa é da empresa: sobra, retalho e consumível não vão para casa sem autorização.',
      'Serviço particular não se faz com máquina, material ou horário da empresa.',
      'Nenhum pagamento, desconto ou compra fora do processo — tudo passa pelo sistema, com registro.',
      'Não se aceita presente, comissão ou vantagem de fornecedor que possa influenciar uma compra. Cortesia simbólica (brinde, café) se informa ao gestor.',
      'Registrar hora, material e serviço com honestidade: número errado vira decisão errada lá na frente.'),

    S('5. Conflito de interesse'),
    L('Trabalhar, prestar serviço ou ter sociedade em concorrente precisa ser declarado ao gestor.',
      'Indicar parente ou amigo como fornecedor: pode, desde que declarado e sem participar da decisão de compra.',
      'Contratar ou avaliar parente direto exige que outra pessoa decida.'),

    S('6. Informação, sistemas e imagem'),
    L('Sua senha é sua: não se empresta, não se compartilha, não se cola no monitor.',
      'Acesso é para trabalhar — não para bisbilhotar dado de colega (salário, ficha, avaliação).',
      'Nada de dado de cliente ou da empresa em aparelho pessoal sem necessidade.',
      'Ao falar da Impresilk em rede social, você está representando a empresa.'),

    S('7. O que fazer quando algo está errado'),
    PS('Se for seguro e simples, fale direto com a pessoa envolvida.',
       'Se não for, leve ao seu gestor.',
       'Se o assunto for com o gestor, leve ao RH ou à direção.',
       'Assédio, fraude ou risco grave: leve direto ao RH ou à direção.'),
    D('Quem relata de boa-fé é protegido. Retaliar alguém que relatou é, em si, uma violação grave deste código.'),

    S('8. O que acontece se descumprir'),
    L('A resposta é proporcional: conversa e orientação · advertência · suspensão · desligamento.',
      'Assédio, violência, furto, fraude e risco deliberado à segurança podem levar ao desligamento imediato.',
      'Desconhecer o código não isenta — por isso ele é lido e aceito por todos, uma vez por ano.'),

    S('Aceite'),
    P('Ao confirmar abaixo, você declara que leu, entendeu e se compromete com este código de conduta. Em caso de dúvida sobre qualquer ponto, fale com o RH antes de agir.'),
]),

# ═══════════════════════ NORMAS DE SEGURANÇA ═══════════════════════
tre('nr06', 'EPI e segurança no trabalho (NR-06)', 'norma', ordem=2, validadeMeses=12,
    resumo='Qual EPI cada setor exige, como usar, como guardar e quando trocar.',
    blocos=[
    P('A NR-06 obriga a empresa a fornecer o EPI adequado, gratuitamente, e obriga o colaborador a usá-lo. As duas partes respondem — por isso a entrega é assinada.'),
    S('O EPI de cada setor'),
    L('Corte e usinagem — óculos, protetor auricular, luva para manuseio de chapa.',
      'Metalurgia — óculos de LASER FIBRA (não é o do CO2), máscara de solda automática, luva de raspa, avental, sapato fechado.',
      'Pintura — máscara com filtro para VAPORES ORGÂNICOS (a de poeira não protege), luva nitrílica, óculos, avental.',
      'Impressão — luva no manuseio; máscara na troca de tinta solvente.',
      'Instalação — capacete com jugular, cinto com talabarte, luva, óculos, calçado de segurança.',
      'Almoxarifado — luva e sapato fechado na movimentação de chapa.'),
    A('Óculos de laser são específicos por comprimento de onda: o de CO2 NÃO protege do fibra. Usar o errado dá a sensação de proteção sem a proteção.'),
    S('Uso e conservação'),
    PS('Conferir o EPI antes de cada uso: trincado, furado, vencido ou sujo de solvente não protege.',
       'Usar durante TODA a exposição — tirar "só um minuto" é quando acontece.',
       'Guardar limpo e no lugar próprio; máscara com filtro fica fechada quando não está em uso.',
       'Solicitar a troca ao gestor assim que houver dano ou vencimento — a troca é gratuita.',
       'Assinar a ficha de entrega a cada recebimento.'),
    S('Trabalho em altura (NR-35)'),
    L('Acima de 2 m: treinamento válido, cinto com talabarte e ancoragem em ponto firme.',
      'Área isolada embaixo. Ferramenta que cai de 6 m mata.',
      'Ninguém sobe sozinho.',
      'Chuva, vento forte ou trovoada: para o serviço.'),
    CK('Sei quais EPIs a minha função exige',
       'Sei conferir se o EPI está em condição de uso',
       'Sei a quem pedir a troca',
       'Entendi que parar por segurança nunca gera punição'),
]),

# ═══════════════════════ ESPORÁDICOS (modelos vivos) ═══════════════════════
tre('integracao', 'Integração: como a Impresilk funciona', 'esporadico', ordem=3,
    resumo='Para quem está chegando: o que a empresa faz, como o pedido anda e onde a sua função entra.',
    blocos=[
    S('O que a Impresilk faz'),
    P('Comunicação visual completa: letreiros e letras caixa, fachadas em ACM, portas e revestimentos, impressos (adesivo, lona, chapa), brindes personalizados — do projeto à instalação, com equipe própria.'),
    S('Como um pedido anda'),
    PS('O Comercial atende, mede e abre a O.S.',
       'O Design cria a arte e o cliente aprova.',
       'A Arte-final fecha o arquivo e gera a prancha de produção.',
       'O PCP programa a produção e o prazo.',
       'A fábrica executa pela linha do produto (são 4 linhas).',
       'A Expedição confere e embarca.',
       'A Instalação entrega na obra e registra com foto.',
       'O Pós-venda acompanha e resolve o que aparecer.'),
    S('As 4 linhas de produção'),
    L('Projeto e letras — Corte + Metalurgia → Pintura → Montagem → Embarque → Instalação.',
      'Arquitetônica — Corte → Dobra → Pintura → Portas de ACM → Instalação.',
      'Impressos — Impressão → Recorte → Acabamento → Entrega.',
      'Brindes — DTF UV + Gravação → entrega rápida.'),
    S('Onde você encontra o que precisa'),
    L('Este app: o POP do seu setor e a jornada da sua função.',
      'Seu gestor: dúvida de processo e prioridade.',
      'RH: documentos, EPI, benefícios e qualquer situação de conduta.'),
    D('Nas duas primeiras semanas, pergunte MUITO. Perguntar cedo custa um minuto; errar calado custa uma peça, uma viagem e a confiança do cliente.'),
]),

tre('qualidade-2026', 'Padrão de qualidade Impresilk', 'esporadico', ordem=4,
    resumo='As réguas que valem para qualquer peça que sai daqui, em qualquer linha.',
    blocos=[
    P('Qualidade aqui não é opinião: são réguas objetivas, iguais para todo mundo, que qualquer pessoa consegue conferir sozinha antes de liberar a peça.'),
    S('As réguas'),
    L('De LONGE (5–10 m): alinhamento, nível e espaçamento. É a distância em que o cliente vê.',
      'De PERTO: acabamento de borda, cantos fechados, sem risco, sem cola aparente, sem marca de dedo.',
      'ACESA (peça luminosa): luz uniforme, sem mancha escura, todas as partes acendendo.',
      'FUNCIONANDO (porta): abre e fecha com um dedo, sem arrastar e sem bater.',
      'CONTRA A O.S.: medida, cor pelo código e quantidade.'),
    S('Antes de liberar qualquer peça'),
    CK('Conferi a medida contra a O.S. (não de memória)',
       'Olhei de longe e de perto',
       'Testei o que precisa ser testado (luz, abertura, aderência)',
       'A peça está identificada com o nº da O.S.',
       'A proteção da face de vista está intacta'),
    D('Se você não liberaria essa peça na fachada da sua própria casa, ela não sai. Chamar o gestor antes é sempre mais barato que a viagem de retorno.'),
]),
]
