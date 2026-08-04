# -*- coding: utf-8 -*-
"""
A ESTRUTURA REAL DA IMPRESILK (definida pela direção em 04/08/2026).

Este arquivo é a fonte da verdade da organização do sistema:
  - 4 macroáreas com 21 setores  -> como os POPs se organizam
  - 4 linhas de produção          -> como a fabricação se ENSINA

Por que separado do seed.py: o conteúdo (texto dos POPs) muda toda semana;
a ESTRUTURA da empresa muda uma vez por ano. Misturar os dois faria a
estrutura ser reescrita a cada ajuste de texto.
"""

# ── 4 macroáreas × 21 setores ────────────────────────────────────────────────
AREAS = [
    {"nome": "Mercado e Vendas", "letra": "A", "ic": "📣", "setores": [
        "Comercial",
        "Marketing",
        "Pós-venda",
    ]},
    {"nome": "Criação e Engenharia", "letra": "B", "ic": "✏️", "setores": [
        "Design de criação",
        "Arte-final e pré-impressão",
        "Projetos técnicos",
    ]},
    {"nome": "Operações", "letra": "C", "ic": "🏭", "setores": [
        "PCP e Expedição",
        "Compras e almoxarifado",
        "Impressão digital e recorte",
        "DTF UV e brindes",
        "Corte de chapas e usinagem",
        "Metalurgia",
        "Pintura",
        "Montagem de letras",
        "Portas de ACM",
        "Acabamento",
        "Instalação de placas",
    ]},
    {"nome": "Apoio e Gestão", "letra": "D", "ic": "🧭", "setores": [
        "Financeiro",
        "RH e DP",
        "TI e sistemas",
        "Manutenção",
    ]},
]

# O que cada setor faz — aparece como legenda no app, para ninguém precisar
# adivinhar onde um POP mora.
RESUMO_SETOR = {
    "Comercial": "Atendimento externo (prospecção, visita, medição), balcão e orçamento. Abre a O.S.",
    "Marketing": "Geração de leads, Instagram, site e portfólio de cases.",
    "Pós-venda": "Garantia, manutenção de fachadas e recompra.",
    "Design de criação": "Arte e conceito para aprovação do cliente.",
    "Arte-final e pré-impressão": "Preparação de arquivos, RIP e pranchas de produção.",
    "Projetos técnicos": "Estrutura de fachadas, portas, totens e memoriais.",
    "PCP e Expedição": "Programação das O.S., prazos, capacidade, embarque e desembarque.",
    "Compras e almoxarifado": "Chapas (ACM, acrílico, PVC, poliondas, MDF), vinis, lonas, perfis, LED e ferragens.",
    "Impressão digital e recorte": "Ampla, MyPrint, impressora UV e plotter de recorte.",
    "DTF UV e brindes": "DTF UV e gravação de brindes.",
    "Corte de chapas e usinagem": "Seccionadora, router CNC e laser CO2 para acrílico.",
    "Metalurgia": "Corte de metais a laser fibra, solda de letra a laser e solda MIG.",
    "Pintura": "Peças da metalurgia e do corte, antes da montagem.",
    "Montagem de letras": "Junção de frente, corpo e LED, com teste elétrico.",
    "Portas de ACM": "Célula própria: seccionadora, router, dobra e pintura; montagem e ferragens.",
    "Acabamento": "Solda de banner, carrinho de soldar lona, refile e ilhós.",
    "Instalação de placas": "Equipes de campo, NR-35 e checklist fotográfico de conclusão.",
    "Financeiro": "Faturamento, contas a pagar e receber, custo por centro.",
    "RH e DP": "Contratação, treinamento e segurança do trabalho.",
    "TI e sistemas": "ERP Mubisys, painéis e automações.",
    "Manutenção": "Preventiva de laser fibra, CO2, router e UV — prioridade 1.",
}

# ── 4 linhas de produção ─────────────────────────────────────────────────────
# `fluxo` é a sequência REAL da peça no chão de fábrica. Cada etapa aponta para
# o setor dono — é assim que o app sabe qual jornada ensina aquela etapa e
# consegue mostrar, sem manutenção, onde AINDA NÃO há treinamento.
LINHAS = [
    {
        "id": "linha-letras", "nome": "Projeto e letras", "ic": "🔤", "ordem": 1,
        "resumo": "O letreiro completo: da chapa e do metal até a letra acesa na fachada.",
        "fluxo": [
            {"etapa": "Corte", "setor": "Corte de chapas e usinagem"},
            {"etapa": "Metalurgia", "setor": "Metalurgia"},
            {"etapa": "Pintura", "setor": "Pintura"},
            {"etapa": "Montagem", "setor": "Montagem de letras"},
            {"etapa": "Embarque", "setor": "PCP e Expedição"},
            {"etapa": "Instalação", "setor": "Instalação de placas"},
        ],
    },
    {
        "id": "linha-arquitetonica", "nome": "Arquitetônica", "ic": "🚪", "ordem": 2,
        "resumo": "Portas de ACM e revestimentos: a célula que faz do corte à ferragem.",
        "fluxo": [
            {"etapa": "Corte", "setor": "Corte de chapas e usinagem"},
            {"etapa": "Dobra", "setor": "Portas de ACM"},
            {"etapa": "Pintura", "setor": "Pintura"},
            {"etapa": "Portas de ACM", "setor": "Portas de ACM"},
            {"etapa": "Instalação", "setor": "Instalação de placas"},
        ],
    },
    {
        "id": "linha-impressos", "nome": "Impressos", "ic": "🖨", "ordem": 3,
        "resumo": "Adesivo, lona e chapa impressa: da arte no RIP à peça entregue.",
        "fluxo": [
            {"etapa": "Impressão", "setor": "Impressão digital e recorte"},
            {"etapa": "Recorte", "setor": "Impressão digital e recorte"},
            {"etapa": "Acabamento", "setor": "Acabamento"},
            {"etapa": "Entrega", "setor": "PCP e Expedição"},
        ],
    },
    {
        "id": "linha-brindes", "nome": "Brindes", "ic": "🎁", "ordem": 4,
        "resumo": "DTF UV e gravação: giro rápido, quase balcão.",
        "fluxo": [
            {"etapa": "DTF UV + Gravação", "setor": "DTF UV e brindes"},
            {"etapa": "Entrega rápida", "setor": "PCP e Expedição"},
        ],
    },
]

SETORES = [s for a in AREAS for s in a["setores"]]

# ── de onde para onde: os POPs que já existem mudam de setor ────────────────
# A estrutura antiga tinha 9 setores genéricos. Este mapa reposiciona cada POP
# no setor REAL. Sem ele, os POPs ficariam órfãos num setor que não existe mais.
DE_PARA_SETOR = {
    "Instalação": "Instalação de placas",
    "Serralheria": "Metalurgia",
    "Design": "Design de criação",
    "Comercial": "Comercial",
    "Financeiro": "Financeiro",
    "PCP & Expedição": "PCP e Expedição",
    "Impressão": "Impressão digital e recorte",
    "Acabamento & Pintura": "Pintura",
    "Administrativo": "TI e sistemas",
}

CFG = {
    "areas": AREAS,
    "setores": SETORES,          # lista plana: o editor e os gestores usam ela
    "resumoSetor": RESUMO_SETOR,
    "linhas": LINHAS,
    "gestores": {},
}
