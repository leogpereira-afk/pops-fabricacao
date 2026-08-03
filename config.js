// ============================================================================
// config.js — endereço do backend do Pops & Fabricação.
// PONTO ÚNICO DE SAÍDA: o resto do app chama apiFn() no store e não sabe onde
// o backend mora. O TOKEN viaja no bundle público — decisão explícita do
// Leonardo (31/07/2026) para apps de campo. Credencial de terceiros NUNCA aqui.
// ============================================================================
window.API_BASE = "https://heveemylixartyijxewh.supabase.co/functions/v1";
window.API_FN = { sync: "pops-sync" };
window.APP_TOKEN = "pops-d4174559f1b1c243d26da51b6071c2d502076ea9";
