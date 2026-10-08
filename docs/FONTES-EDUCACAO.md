# Fontes e compatibilidade do Painel de Educação Impresilk

Auditoria de 08/10/2026. Somente leitura dos repositórios, documentos e banco de produção. Nenhum conteúdo, papel, atribuição ou registro de aprendizado foi alterado por esta auditoria. Este relatório reúne metadados; o pacote de preparação com textos internos fica fora do repositório público.

## Conclusão

Há fontes suficientes para preparar jornadas, mas não para declarar automaticamente que toda formação foi revisada ou que uma leitura equivale a competência. A identidade empresarial foi localizada; os 11 PDFs do pacote de cadernos de 06/10 foram conferidos por hash e número de páginas. Os procedimentos e treinamentos presentes na base continuam marcados como semente inicial. A transformação deve preservar esses registros e deixar unidades sem preparação/validação identificadas como pendentes.

O Código de Ética integral localizado é versão **2026.2, 50 páginas**. O treinamento legado `tre-etica` é **versão 1.0**, com texto resumido de semente: não é o PDF 2026.2. Não trocar uma referência pela outra sem registrar a fonte, versão e nova revisão.

## Estrutura verificada no projeto

| Recurso | Estado atual confirmado | Reaproveitamento recomendado |
|---|---|---|
| `conhecimento.js` | Somente funções públicas de organização e consulta. O conteúdo vem do servidor autenticado. | Manter; não colocar conteúdo empresarial no JavaScript público. |
| `config.conhecimentoBase` | Versão 2026.10.05, 9 fontes, 24 funções documentais, 12 tópicos, identidade, linhas e jornadas de referência. | Fonte auxiliar com proveniência, não substituto de documento integral ou aprovação de treinamento. |
| `pops_registros` | POPs, jornadas, treinamentos, pessoas, atribuições, leituras e progresso. | Preservar IDs e histórico. Novas evidências pedagógicas devem usar vínculo próprio com fonte e versão. |
| Autenticação | Credencial da Central / crachá pessoal; ID profissional é consultado no servidor. | Nunca liberar sessão apenas pelo número RH. |
| Acervo | `pops-arquivos`, acesso de leitura via função autenticada `getFoto`; upload atual aceita imagens. | PDFs precisam de rota privada apropriada ou link HTTPS autorizado; não forçar PDF na API de foto. |

### Retrato do banco em 08/10/2026

Consultas somente de contagens e metadados, sem expor dados pessoais ou corpos dos documentos.

| Coleção | Total | Ativos |
|---|---:|---:|
| POPs | 31 | 31 |
| Jornadas | 10 | 10 |
| Treinamentos | 4 | 4 |
| Pessoas | 46 | 40 |
| Atribuições | 41 | 38 |
| Progresso legado | 1 | 0 |
| Leituras | 0 | 0 |

Os 31 POPs e quatro treinamentos são versão 1.0 com `revisadoPor: Semente inicial`. As dez jornadas são versão 1.0 sem estado explícito de revisão. Esses metadados não comprovam revisão técnica humana. Foram encontrados os treinamentos `tre-etica`, `tre-integracao`, `tre-nr06` e `tre-qualidade-2026`, todos sem materiais de apoio cadastrados.

A base de conhecimento possui missão, visão, valores e referências do Código de Ética; não contém uma unidade completa do Código nem os PDFs dos cadernos. O tópico de identidade e os resumos operacionais podem ser apoio à preparação. A ausência de módulos completos deve aparecer como **Conteúdo em preparação** na escola.

## Fontes documentais locais

Raiz dos documentos: `outputs/Cadernos_Impresilk_2026-10-06/`, no workspace Dre. Há 11 PDFs, sete arquivos Word e `Inventario.json`. As 11 cópias PDF correspondem ao hash SHA-256 registrado no inventário e às respectivas origens locais em 08/10/2026.

| Arquivo em `PDFs/` | Versão impressa | Páginas | Uso |
|---|---|---:|---|
| Caderno-00_Resumo-Total.pdf | 1.0 · setembro/2026 | 24 | Integração e visão da operação |
| Caderno-01_Comercial.pdf | 1.0 · setembro/2026 | 32 | Comercial e atendimento |
| Caderno-02_PCP.pdf | 1.0 · setembro/2026 | 35 | Planejamento e controle |
| Caderno-03_Operacoes-de-Maquinas.pdf | 1.0 · setembro/2026 | 33 | Operação por equipamento; depende de prática validada |
| Caderno-04_Almoxarifado-Compras-Ferramentas.pdf | 1.0 · setembro/2026 | 32 | Materiais, compras e ferramentas |
| Caderno-05_Producao-Interna-Acabamento.pdf | 1.0 · setembro/2026 | 34 | Produção interna e acabamento |
| Caderno-06_Especialista-em-Comunicacao-Visual.pdf | 1.0 · setembro/2026 | 11 | Função especialista |
| Caderno-07_Funcoes-Impresilk-2026.pdf | 2026.1 | 62 | Fichas de funções e competências |
| Caderno-08_Instalacao-Externa-Completo.pdf | 2026.1 · completa | 103 | Formação de instalação externa |
| Caderno-09_Instalacao-Externa-Resumido.pdf | 2026.2 · resumida | 32 | Consulta resumida de instalação |
| Caderno-10_Codigo-de-Etica-e-Conduta-2026-2.pdf | 2026.2 | 50 | Documento institucional integral |

O número do caderno 07 a 10 é organização do pacote, não revisão do documento. As edições completa e resumida de instalação são documentos distintos; o número 2026.2 da edição resumida não autoriza substituir automaticamente a edição completa.

**Confiança e limites:** integridade, localização, versões impressas e páginas foram verificadas. O inventário documental anterior classifica Ética e Funções como vigentes. Porém não foi localizado nesta auditoria um novo ato de aprovação da Diretoria nem homologação de cada pendência técnica dos cadernos. A gestão deve confirmar o recorte e a versão oficial antes de exigir ciência ou liberar competências.

### Identidade e cultura

Fonte central encontrada: `painel/src/lib/identidade.js`. Cópia para o RH: `rh/src/data/identidade.ts`. Os dois arquivos identificam o texto decidido pela direção e os 12 valores; missão e visão coincidem. A base privada de conhecimento já contém esses campos e a referência.

O arquivo de RH orienta explicitamente usar as frases, sem o contraponto editorial do Painel. Para a escola, usar o texto institucional existente sem criar regras adicionais. Exemplos, perguntas e critérios de compreensão precisam ser preparados e revisados pelo responsável. O nome documental de uma função não é seu ID no RH e não concede autorização operacional.

### Código de Ética

Origem local: `outputs/codigo-etica-2026-2/CODIGO DE ETICA E CONDUTA 2026-2.pdf`; fontes editáveis em `outputs/codigo-etica-2026-2/partes/`.

A base privada já guarda uma URL do Drive associada ao Código. A URL e o ID constam somente do pacote privado de preparação. O conteúdo remoto do Drive e o acesso com uma conta de colaborador não foram conferidos nesta auditoria; não declarar que esse link já entrega o mesmo arquivo local de 50 páginas. Confirmar versão/hash e acesso antes de liberar a unidade.

### POPs e pendências

Fontes auxiliares:

- `outputs/Impresilk_Cadernos_v1/REFERENCIA.md`: relação entre funções, cadernos, processos e códigos.
- `outputs/Impresilk_Cadernos_v1/fontes/POPS-INVENTARIO.md`: origem, código, situação e divergências dos procedimentos.
- `outputs/Impresilk_Cadernos_v1/PENDENCIAS.md`: 224 dados distintos indicados como pendentes, conflitos documentais e procedimentos a criar.

A compilação de conhecimento indica por engano `fontes/PENDENCIAS.md`; o arquivo realmente existente está na raiz de `Impresilk_Cadernos_v1`. A referência deve ser corrigida na próxima revisão explícita da base, sem apagar os demais campos da configuração.

Há procedimentos citados mas não localizados, versões antigas, códigos duplicados e conflitos de responsáveis, métodos e parâmetros. Não fabricar conteúdo a partir do título. Conteúdo de segurança, máquina e instalação não deve ser promovido a treinamento validado sem responsável técnico. Consulta diária aos POPs existentes permanece disponível com a indicação de revisão.

## Vínculo RH e papéis

A função `identidadeRH()` em `supabase/functions/pops-sync/index.ts` resolve a conta da Central, o acesso POPs ativo e `acesso_conta.colaborador_id`. Busca apenas nome, cargo, área, setor e situação profissional. O identificador POPs é `p-<id_RH>`. A migração `0003_identidade_rh.sql` preserva histórico e vínculo existente e não cria acesso por semelhança de nome.

Permissões existentes no código:

- `equipe`: leitura do acervo e registro pessoal; filtros no servidor restringem pessoas, atribuições, leituras e progresso.
- `gestor`: edição de POPs de setores configurados e respectivas atribuições; não possui automaticamente permissão para todo treinamento/jornada.
- `admin`: administração do acervo, equipe e configuração.

Em produção, `acesso_papel` mostrou nove acessos `equipe` e dois `admin`; não havia `gestor` nem `instrutor` ativo no sistema POPs naquele recorte. As listas de papéis de `auth.js`, `lerCracha()`, sincronização RH e do `equipe-auth` ainda aceitam apenas `admin`, `gestor`, `equipe`.

**Compatibilidade recomendada:** um instrutor pode ser uma capacidade explícita da escola, associada ao ID RH e à jornada/etapa que pode validar, sem elevar globalmente a conta. O servidor precisa conferir o vínculo e o escopo em cada validação. Caso se adote um quarto papel de autenticação, a Central, o emissor de crachá, a revogação, o leitor, o cache e a sincronização devem mudar em conjunto. Apenas acrescentar uma opção na interface não funciona e não garante autorização.

A jornada escolhida não escreve cargo ou setor no RH. Mudança de função deve alterar somente as novas atribuições e preservar evidências anteriores com pessoa, versão e data. Histórico legado identificado por login precisa ser mantido e tratado como legado, sem inferir domínio nem atribuir pontos retroativos.

## Trabalho reaproveitável de treinamentos

O checkout `pops-treinamentos-20261005` contém alterações não commitadas de cadastro de treinamentos, não presentes integralmente na base deste novo checkout. Foram examinadas sem alteração:

- `treinamentos.js`: validação de título, versão, blocos de conteúdo, links HTTPS, aceite e reciclagem.
- Alterações em `app.js`: cadastro, edição, materiais de apoio e arquivamento.
- Alterações no servidor: validação, carimbo de autoria/data e nova versão quando conteúdo muda.
- `tests/treinamentos-backend.test.mjs` e `tests/treinamentos-ui.test.mjs`: cenários de validação e permissões.

Reaproveitar seletivamente, após comparar o contrato da escola. Aquele trabalho permite cadastro apenas por administrador e ainda trata leitura/aceite, não avaliação objetiva nem validação prática. Não copiar o checkout inteiro e não usar seus testes como prova de publicação ou aprovação institucional.

## Pacote privado preparado

Arquivo fora do repositório público:

`outputs/Educacao_Impresilk_2026-10-08/fontes-para-preparacao.json`

Contém metadados e hashes dos 11 PDFs, origem/cópia dos textos de cultura, referências legadas, URL institucional já existente e pendências. Todos os documentos estão em estado `preparacao`, sem liberação e sem atribuição automática. Não é arquivo de seed ou migração. O texto de identidade vem da base local documentada, não de texto inventado.

Fluxo de preparação recomendado:

1. Gestor confirma fonte oficial, versão, responsável e escopo da função.
2. Cadastra unidade com referência `tipo: pop|treinamento` e `refId` existente; documento externo usa título, URL HTTPS autorizada e versão. Arquivo local é apenas indicação para o gestor, não URL para o colaborador.
3. Define objetivo, motivo, execução, erros, evidência de compreensão e prática quando necessária. Campo ausente bloqueia a liberação e informa o que falta.
4. Publica o documento em acervo privado com autorização própria ou confirma o link institucional já autorizado. Não incluir PDF empresarial em Pages, service worker público ou bundle JS.
5. Libera a unidade explicitamente; registra origem, versão e responsável. Só então atribui a jornada.
6. Nas evidências, grava pessoa RH, jornada/versão, etapa/versão, referência/versão e data do servidor. Abrir o material registra consulta, não compreensão.
7. Ao mudar o conteúdo, cria nova versão e indica reciclagem; mantém conclusões e ciência anteriores para auditoria.

## Verificações realizadas e limites

- 11 PDFs abertos com leitor PDF, páginas contadas e hashes comparados ao inventário e às origens: todos correspondem.
- Leitura das primeiras páginas confirmou as versões impressas e a diferença entre instalação completa e resumida.
- Consulta de metadados de produção confirmou as coleções, as versões de semente e o estado da base de conhecimento.
- Leitura do controle de acesso confirmou identidade pelo RH e limitações do papel instrutor.
- O pacote privado foi validado como JSON e todos os caminhos PDF nele indicados existem.
- Não houve importação de conteúdo, alteração do RH, liberação de acesso, registro fictício de aprendizado ou publicação.
- Não foram conferidos os documentos remotos do Drive nem a disponibilidade de todas as fontes para cada perfil de funcionário.
