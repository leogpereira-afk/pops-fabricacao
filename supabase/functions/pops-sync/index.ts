// ============================================================================
// pops-sync — Edge Function do sistema pops (MOLDE; trocar pops e POPS_TOKEN).
//
// Contrato: o app manda POST { action, ... } com header x-token e recebe JSON.
// É o mesmo desenho do brief-sync/pcp-sync que está em produção desde 31/07/2026.
//
// PROJETO COMPARTILHADO: o nome desta function PRECISA do prefixo. Publicar uma
// function chamada "sync" sobrescreve a do RH em produção.
//
// verify_jwt = false DE PROPÓSITO: o preflight CORS chega sem token e o gateway
// barraria antes de a função rodar. A autorização é feita AQUI DENTRO (x-token
// contra o secret POPS_TOKEN). Deploy sempre com --no-verify-jwt.
//
// Regras herdadas (cada uma custou horas):
//  - teto de 150s: nada de varredura longa aqui; página a página, cliente comanda
//  - lápide (apagado=true), nunca DELETE — o pull dos outros aparelhos precisa dela
//  - rev bump em pops_meta a cada escrita — é o que faz o pull econômico funcionar
//  - list pagina NO BANCO (keyset), nunca "carrega tudo e fatia na memória"
//  - foto: bytes PUROS no bucket; o formato de resposta segue o que o CLIENTE espera
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("POPS_TOKEN") ?? "";
const BUCKET = "pops-arquivos";
const T_REG = "pops_registros";
const T_CFG = "pops_config_global";
const T_META = "pops_meta";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Rev bump: um número por coleção + um global. O cliente compara e só baixa o
// que mudou — sem isso, todo pull é completo.
async function bump(colecao: string) {
  const agora = Date.now();
  const { data } = await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle();
  const atual = (data?.valor as { rev?: number; porColecao?: Record<string, number> }) ?? {};
  await sb.from(T_META).upsert({
    chave: "rev",
    valor: { rev: agora, porColecao: { ...(atual.porColecao ?? {}), [colecao]: agora } },
    atualizado_em: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);
  if (!TOKEN || req.headers.get("x-token") !== TOKEN) return resp({ erro: "Não autorizado." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return resp({ erro: "JSON inválido." }, 400); }
  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "ping":
        return resp({ ok: true, agora: new Date().toISOString() });

      case "rev": {
        const { data } = await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle();
        return resp({ rev: data?.valor ?? { rev: 0, porColecao: {} } });
      }

      case "list": {
        // Keyset por atualizado_em: estável sob escrita concorrente, e o banco
        // pagina — nunca "traz tudo e corta".
        const colecao = String(body.colecao ?? "");
        const desde = String(body.desde ?? "") || "1970-01-01";
        const limite = Math.min(Number(body.limite ?? 200), 500);
        const { data, error } = await sb.from(T_REG)
          .select("id, registro, apagado, atualizado_em")
          .eq("colecao", colecao).gt("atualizado_em", desde)
          .order("atualizado_em", { ascending: true }).limit(limite);
        if (error) throw error;
        const proximo = data.length === limite ? data[data.length - 1].atualizado_em : null;
        return resp({ itens: data, proximo });
      }

      case "get": {
        const { data } = await sb.from(T_REG).select("registro, apagado")
          .eq("colecao", String(body.colecao)).eq("id", String(body.id)).maybeSingle();
        return resp({ registro: data && !data.apagado ? data.registro : null });
      }

      case "upsert": {
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as Record<string, unknown>;
        if (!colecao || !registro?.id) return resp({ erro: "colecao e registro.id obrigatórios." }, 400);
        const { error } = await sb.from(T_REG).upsert({
          colecao, id: String(registro.id), registro,
          apagado: false, atualizado_em: new Date().toISOString(),
        });
        if (error) throw error;
        await bump(colecao);
        return resp({ ok: true });
      }

      case "delete": {
        // Lápide, nunca DELETE: o aparelho que estava offline precisa saber que morreu.
        const colecao = String(body.colecao ?? "");
        const id = String(body.id ?? "");
        const agora = new Date().toISOString();
        const { error } = await sb.from(T_REG).upsert({
          colecao, id, registro: { id, _apagado: true, atualizadoEm: agora },
          apagado: true, atualizado_em: agora,
        });
        if (error) throw error;
        await bump(colecao);
        return resp({ ok: true });
      }

      case "getCfg": {
        const { data } = await sb.from(T_CFG).select("config").eq("id", true).maybeSingle();
        return resp({ config: data?.config ?? null });
      }
      case "setCfg": {
        const { error } = await sb.from(T_CFG).upsert({
          id: true, config: body.config ?? {}, atualizado_em: new Date().toISOString(),
        });
        if (error) throw error;
        await bump("cfg");
        return resp({ ok: true });
      }

      case "putFoto": {
        // Bytes PUROS no bucket. Se o cliente manda data URL, tirar o prefixo aqui.
        const id = String(body.id ?? "");
        const b64 = String(body.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const { error } = await sb.storage.from(BUCKET).upload(id, bytes,
          { contentType: String(body.tipo ?? "image/jpeg"), upsert: true });
        if (error) throw error;
        return resp({ ok: true });
      }
      case "getFoto": {
        const { data, error } = await sb.storage.from(BUCKET).download(String(body.id ?? ""));
        if (error || !data) return resp({ base64: null });
        const buf = new Uint8Array(await data.arrayBuffer());
        // base64 SEM spread (String.fromCharCode(...buf) estoura a pilha) — blocos de 0x8000.
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        // DECISÃO POR CLIENTE: Brief espera data URL completa; Painel espera base64 puro.
        // Conferir o que o app faz com o valor ANTES de escolher a linha abaixo.
        return resp({ base64: `data:${data.type || "image/jpeg"};base64,${btoa(bin)}` });
      }
      case "deleteFoto": {
        await sb.storage.from(BUCKET).remove([String(body.id ?? "")]);
        return resp({ ok: true });
      }

      case "saude": {
        const { count } = await sb.from(T_REG).select("id", { count: "exact", head: true });
        return resp({ ok: true, registros: count ?? 0 });
      }

      default:
        return resp({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    // supabase-js: o query builder NÃO tem .catch (é thenable) — sempre try/await.
    return resp({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
