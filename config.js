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
window.API_FN = { sync: "pops-sync" };
