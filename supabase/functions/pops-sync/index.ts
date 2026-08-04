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

      // ── Protocolo do BACKUP DO HUB (painel-backup) ───────────────────────
      // O Painel puxa {action:"list", after} até nextAfter null e depois
      // {action:"getCfg"}. O list SEM colecao é o modo backup: devolve TODAS
      // as coleções, com _col em cada linha (mesmo desenho do Compras).
      case "list": {
        if (body.colecao == null) {
          const PASSO = 500;
          const de = Number(body.after ?? 0) || 0;
          const { data, error } = await sb.from(T_REG)
            .select("colecao, id, registro, apagado")
            .order("colecao").order("id").range(de, de + PASSO - 1);
          if (error) throw error;
          const linhas = (data ?? []).filter((l: any) => !l.apagado)
            .map((l: any) => ({ _col: l.colecao, ...l.registro }));
          // nextAfter só com página CHEIA (página parcial é o fim).
          return resp({ registros: linhas, nextAfter: (data ?? []).length === PASSO ? de + PASSO : null });
        }
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
        // `cfg` é o nome que o backup do Hub espera; `config` é o do app.
        return resp({ config: data?.config ?? null, cfg: data?.config ?? null });
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

      // ── pessoas: espelho MÍNIMO dos colaboradores do RH ──────────────────
      // O RH é a base de gente da empresa (tabela `registros`, coleção
      // `colaboradores`). Aqui só se LÊ — escrever no RH a partir daqui seria
      // invadir o sistema do vizinho.
      //
      // PRIVACIDADE: copia-se APENAS o que treinamento precisa (nome, função,
      // área, gestor e um id estável). Salário, endereço, CPF, dados do cônjuge
      // e avaliação comportamental NÃO passam para cá — quem precisa disso é o
      // RH, e é lá que eles ficam.
      case "sincronizarPessoas": {
        const { data, error } = await sb.from("registros")
          .select("id, registro").eq("colecao", "colaboradores");
        if (error) throw error;
        const areas = await sb.from("registros").select("id, registro").eq("colecao", "areas");
        const nomeArea = new Map((areas.data ?? []).map((a: any) => [a.id, a.registro?.nome ?? null]));
        const agora = new Date().toISOString();
        // O QUE É NOSSO NÃO PODE SER APAGADO PELA SINCRONIZAÇÃO. O vínculo com
        // a conta da Central (`usuario`) é decisão do admin, mora só aqui e não
        // existe no RH — um upsert cru o apagaria a cada rodada, e com a
        // sincronização automática isso viraria "todo dia de manhã ninguém tem
        // treinamento atribuído". Por isso lemos o que já existe e preservamos.
        const { data: jaAqui } = await sb.from(T_REG).select("id, registro").eq("colecao", "pessoas");
        const local = new Map((jaAqui ?? []).map((x: any) => [x.id, x.registro ?? {}]));
        const CAMPOS_NOSSOS = ["usuario", "observacao"];
        let ativos = 0, desligados = 0;
        const linhas: any[] = [];
        for (const r of data ?? []) {
          const c = r.registro ?? {};
          if (!c.nome) continue;
          const saiu = String(c.dataDesligamento ?? "").trim() !== "";
          if (saiu) { desligados++; continue; }   // desligado não entra no espelho
          ativos++;
          const id = "p-" + r.id;
          const antes = local.get(id) ?? {};
          const registro: Record<string, unknown> = {
            id, nome: c.nome, funcao: c.funcao ?? c.cargoLivre ?? "",
            area: nomeArea.get(c.areaId) ?? null, gestorId: c.gestorId ? "p-" + c.gestorId : null,
            admissao: c.dataAdmissao ?? null, origem: "rh", atualizadoEm: agora,
          };
          for (const campo of CAMPOS_NOSSOS) {
            if (antes[campo] !== undefined && antes[campo] !== null && antes[campo] !== "") {
              registro[campo] = antes[campo];
            }
          }
          linhas.push({ colecao: "pessoas", id, apagado: false, atualizado_em: agora, registro });
        }
        if (linhas.length) {
          const { error: e2 } = await sb.from(T_REG).upsert(linhas, { onConflict: "colecao,id" });
          if (e2) throw e2;
        }
        // Quem saiu do RH (ou foi desligado) vira lápide aqui: some da lista de
        // atribuição, mas o histórico de treinamento dele continua existindo.
        const vivos = new Set(linhas.map((l) => l.id));
        const { data: aqui } = await sb.from(T_REG).select("id").eq("colecao", "pessoas").eq("apagado", false);
        const sumiram = (aqui ?? []).map((x: any) => x.id).filter((id: string) => !vivos.has(id));
        if (sumiram.length) {
          await sb.from(T_REG).update({ apagado: true, atualizado_em: agora })
            .eq("colecao", "pessoas").in("id", sumiram);
        }
        // Bump só quando algo mudou de verdade: sem isto, a rodada diária faria
        // TODO aparelho rebaixar as 38 pessoas toda manhã, sem novidade nenhuma.
        const mudou = linhas.some((l) => {
          const antes = local.get(l.id);
          if (!antes) return true;
          // Comparação por chave ORDENADA: o jsonb do Postgres devolve as
          // chaves em ordem própria e o objeto montado aqui vem na ordem de
          // escrita — sem ordenar, "igual" nunca dá igual e o bump acontecia
          // toda rodada (que é exatamente o que se queria evitar).
          const semCarimbo = (o: any) => JSON.stringify(
            Object.keys(o).filter((k) => k !== "atualizadoEm").sort().map((k) => [k, o[k]]));
          return semCarimbo(antes) !== semCarimbo(l.registro);
        }) || sumiram.length > 0;
        if (mudou) await bump("pessoas");
        return resp({ ok: true, ativos, desligados, arquivados: sumiram.length, mudou });
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
