// ============================================================================
// config.js — endereço do backend do Pops & Fabricação.
// PONTO ÚNICO DE SAÍDA: o resto do app chama apiFn() no store e não sabe onde
// o backend mora.
//
// NÃO existe mais token aqui. Havia um (APP_TOKEN), e ele autorizava sozinho
// toda leitura e escrita — num repositório PÚBLICO. Quem quisesse os POPs só
// precisava abrir este arquivo no GitHub; o login era enfeite. Quem autoriza
// agora é o crachá da pessoa, guardado no localStorage depois do login.
// Credencial NUNCA aqui.
// ============================================================================
window.API_BASE = "https://heveemylixartyijxewh.supabase.co/functions/v1";
window.CONHECIMENTO_VERSAO = '2026.10.05';
// Versão da tela. Sobe a cada publicação da tela: aparece em Minha conta e
// carimba o cache da escola no aparelho (pacote de outra versão não é lido).
// CONHECIMENTO_VERSAO acima é outra coisa: acompanha a base no servidor.
window.ESCOLA_TELA_VERSAO = '2026.10.15-silk';
window.API_FN = { sync: "pops-sync" };
