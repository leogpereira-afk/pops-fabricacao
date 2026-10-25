// POPs: credencial pessoal conferida no servidor; x-token exclusivo da automação.
// verify_jwt=false: esta porta valida o JWT da equipe, não um JWT Supabase Auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { criarMaquinasEscola } from "../_shared/maquinas-escola.ts";
import { escola, entradaAlunoCfg } from "../_shared/escola.ts";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TOKEN = Deno.env.get("POPS_TOKEN") ?? "";
const JWT_SECRET = Deno.env.get("EQUIPE_JWT_SECRET") ?? "";
const T_REG = "pops_registros", T_CFG = "pops_config_global", T_META = "pops_meta", BUCKET = "pops-arquivos";
const COLS = new Set(["pops", "jornadas", "treinamentos", "pessoas", "atribuicoes", "leituras", "progresso"]);
// Coleções da escola: só a ação "escola" lê e grava. Entram na listagem completa
// apenas para o backup do Hub (x-token de serviço), nunca para a tela.
const COLS_ESCOLA = ["formacoes", "aprendizagem", "materiais", "estudos", "instrumentos", "perfis", "capacitacoes", "planos_aprendizagem"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-token, x-painel-cracha", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const resp = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
class Falha extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function conferir(result: any) { if (result.error) throw new Error("Não foi possível consultar ou salvar os dados. Tente novamente."); return result.data; }
function idValido(id: unknown) { if (typeof id !== "string" || !/^[a-zA-Z0-9._:-]{1,160}$/.test(id)) throw new Falha("Identificador inválido."); return id; }
function colValida(col: unknown) { if (typeof col !== "string" || !COLS.has(col)) throw new Falha("Coleção inválida."); return col; }
async function registro(col: string, id: string) { return conferir(await sb.from(T_REG).select("registro, apagado, revision, mutation_id").eq("colecao", col).eq("id", id).maybeSingle()); }
async function config() { const r = conferir(await sb.from(T_CFG).select("config").eq("id", true).maybeSingle()); return r?.config ?? {}; }
function negar() { throw new Falha("Seu acesso não permite esta alteração.", 403); }

// A ficha do RH é a identidade estável. O login identifica a conta, nunca é
// usado como palpite de nome. Não expor documento, id_pessoa ou outros dados do RH.
const semVinculo = (motivo: string) => ({ ok: true, vinculada: false, pessoa: null, motivo });
// Pessoa a partir da ficha viva do RH, pelo ID da ficha (registros.id). Projeção
// só com campos profissionais: nunca CPF, idPessoa, salário ou endereço.
async function pessoaDaFicha(colaboradorId: string, usuario: string, vinculoOrigem: string): Promise<any> {
  const ficha = conferir(await sb.from("registros").select("id,nome:registro->>nome,cargoId:registro->>cargoId,areaId:registro->>areaId,setor:registro->>setor,statusId:registro->>statusId,dataDesligamento:registro->>dataDesligamento,cargoLivre:registro->>cargoLivre,funcao:registro->>funcao").eq("colecao", "colaboradores").eq("id", colaboradorId).eq("apagado", false).maybeSingle());
  if (!ficha) return semVinculo("ficha_indisponivel");
  const r = ficha.registro || ficha;
  if (String(r.dataDesligamento || "").trim() || ["inativo", "abandono"].includes(r.statusId)) return semVinculo("pessoa_desligada");
  const resumo = async (colecao: string, id: string) => {
    if (!id) return "";
    const row = conferir(await sb.from("registros").select("nome:registro->>nome").eq("colecao", colecao).eq("id", id).eq("apagado", false).maybeSingle());
    return row?.nome || row?.registro?.nome || "";
  };
  const [cargo, area] = await Promise.all([resumo("cargos", r.cargoId), resumo("areas", r.areaId)]);
  return { ok: true, vinculada: true, pessoa: {
    id: "p-" + ficha.id, colaboradorId: ficha.id, nome: String(r.nome || ""),
    funcao: cargo || String(r.cargoLivre || r.funcao || ""), cargoId: r.cargoId || null,
    areaId: r.areaId || null, area, setor: r.setor || "", statusId: r.statusId || "",
    usuario, vinculoOrigem,
  } };
}
// O aluno não tem conta na Central: a identidade é a ficha do crachá, conferida
// de novo a cada chamada (pessoa desligada perde a entrada na hora). Uma leitura
// por requisição: o crachá é um objeto novo a cada chamada.
const identidadesAluno = new WeakMap<object, Promise<any>>();
function identidadeAluno(cracha: any): Promise<any> {
  let p = identidadesAluno.get(cracha);
  if (!p) { p = pessoaDaFicha(cracha.colaboradorId, norm(cracha.sub), "entrada_aluno"); identidadesAluno.set(cracha, p); }
  return p;
}
async function identidadeRH(cracha: any): Promise<any> {
  if (cracha?.papel === "aluno" && cracha?.sis === "pops-aluno") return identidadeAluno(cracha);
  const sem = semVinculo;
  const usuario = norm(cracha?.sub);
  if (!usuario) return sem("sem_conta_pessoal");
  const diretas = conferir(await sb.from("acesso_conta").select("id,usuario,ativo,colaborador_id").eq("usuario", usuario).limit(2));
  const papeisLogin = conferir(await sb.from("acesso_papel").select("conta_id,login,ativo").eq("sistema", "pops").eq("login", usuario).limit(3));
  const ids = [...new Set(papeisLogin.map((p: any) => p.conta_id))];
  const porLogin = ids.length ? conferir(await sb.from("acesso_conta").select("id,usuario,ativo,colaborador_id").in("id", ids)) : [];
  const candidatas = [...new Map([...diretas, ...porLogin].map((c: any) => [c.id, c])).values()] as any[];
  if (!candidatas.length) return sem("sem_vinculo_central");
  if (candidatas.length !== 1) return sem("vinculo_ambiguo");
  const conta = candidatas[0];
  if (conta.ativo === false) return sem("conta_inativa");
  const papel = conferir(await sb.from("acesso_papel").select("ativo,papel,login").eq("conta_id", conta.id).eq("sistema", "pops").maybeSingle());
  if (!papel || papel.ativo === false) return sem("sem_acesso_pops");
  const colaboradorId = String(conta.colaborador_id || "");
  if (!colaboradorId) return sem("sem_ficha_rh");
  return pessoaDaFicha(colaboradorId, usuario, "central_rh");
}

// O gestor consulta dados pessoais somente dos setores atuais sob sua gestão.
// Registros antigos sem identificação RH ficam preservados para reconciliação
// administrativa; um login solto não prova a identidade histórica do autor.
async function filtroGestor(col: string, cracha: any) {
  if (!["pessoas", "atribuicoes", "leituras", "progresso"].includes(col)) return null;
  const cfg = await config(), permitidos = (cfg.gestores?.[norm(cracha.sub)] || []).map(norm);
  if (!permitidos.length) return { campo: "id", valores: [] as string[] };
  const todas = async (tabela: string, colecao: string, campos: string) => {
    const registros: any[] = []; let offset = 0;
    for (;;) {
      const rs = conferir(await sb.from(tabela).select(campos).eq("colecao", colecao).eq("apagado", false).order("id").range(offset, offset + 499));
      registros.push(...rs); if (rs.length < 500) return registros; offset += 500;
    }
  };
  const [rh, areas] = await Promise.all([
    todas("registros", "colaboradores", "id,setor:registro->>setor,areaId:registro->>areaId,statusId:registro->>statusId,dataDesligamento:registro->>dataDesligamento"),
    todas("registros", "areas", "id,nome:registro->>nome"),
  ]);
  const nomes = new Map(areas.map((r: any) => [r.id, r.nome || r.registro?.nome || ""]));
  const ids = new Set(rh.filter((row: any) => {
    const r = row.registro || row;
    return !r.dataDesligamento && !["inativo", "abandono"].includes(r.statusId) && [r.setor, r.areaId, nomes.get(r.areaId)].some(s => permitidos.includes(norm(s)));
  }).map((r: any) => String(r.id)));
  const pessoas = [...ids].map(i => "p-" + i);
  if (col === "pessoas") return { campo: "id", valores: pessoas };
  if (col === "atribuicoes") return { campo: "registro->>pessoaId", valores: pessoas };
  const historicos = await todas(T_REG, col, "id,colaboradorId:registro->>colaboradorId,pessoaId:registro->>pessoaId");
  const autorizados = historicos.filter((row: any) => {
    const r = row.registro || row;
    // Um carimbo RH explícito prevalece sobre qualquer campo antigo contraditório.
    return r.colaboradorId ? ids.has(r.colaboradorId) : typeof r.pessoaId === "string" && pessoas.includes(r.pessoaId);
  }).map((r: any) => r.id);
  return { campo: "id", valores: autorizados };
}

// A visibilidade do menu não protege os históricos: o filtro pertence à consulta.
async function filtroLeitura(col: string, cracha: any, maquina: boolean) {
  if (maquina || cracha.papel === "admin") return null;
  if (cracha.papel === "aluno") {
    // Aluno: conteúdo da casa (POPs, jornadas, treinamentos) como a equipe; das
    // coleções pessoais, só o que é dele, pelo ID da ficha do crachá. Nada por
    // login: o aluno não tem histórico legado sem carimbo do RH.
    const id = idValido(cracha.colaboradorId);
    if (col === "pessoas") return { campo: "id", valor: "p-" + id };
    if (col === "atribuicoes") return { campo: "registro->>pessoaId", valor: "p-" + id };
    if (["leituras", "progresso"].includes(col)) return { campo: "registro->>colaboradorId", valor: id };
    return null;
  }
  if (cracha.papel === "gestor") return filtroGestor(col, cracha);
  const usuario = norm(cracha.sub);
  if (["leituras", "progresso"].includes(col)) {
    const identidade = await identidadeRH(cracha);
    if (identidade.vinculada) return { expressao: `registro->>colaboradorId.eq.${idValido(identidade.pessoa.colaboradorId)},and(registro->>colaboradorId.is.null,registro->>usuario.eq.${JSON.stringify(usuario)})` };
    // Um login desvinculado não herda a história da pessoa que o usava antes.
    // Somente a conta legada, ainda ausente da Central, conserva seu histórico
    // antigo sem carimbo RH. Vínculo conhecido inválido não autoriza fallback.
    if (identidade.motivo !== "sem_vinculo_central") return { campo: "id", valor: "" };
    return { expressao: `and(registro->>colaboradorId.is.null,registro->>usuario.eq.${JSON.stringify(usuario)})` };
  }
  if (["pessoas", "atribuicoes"].includes(col)) {
    const identidade = await identidadeRH(cracha);
    if (identidade.vinculada) return { campo: col === "pessoas" ? "id" : "registro->>pessoaId", valor: identidade.pessoa!.id };
    // Compatibilidade só para conta antiga que ainda não existe na Central.
    // Um vínculo incompleto/ambíguo conhecido nunca autoriza uma pessoa por texto.
    if (identidade.motivo !== "sem_vinculo_central") return { campo: "id", valor: "" };
    if (col === "pessoas") return { campo: "registro->>usuario", valor: usuario };
    const pessoa = conferir(await sb.from(T_REG).select("id").eq("colecao", "pessoas").eq("apagado", false).eq("registro->>usuario", usuario).maybeSingle());
    // Sem vínculo confirmado não há atribuições pessoais disponíveis.
    return pessoa ? { campo: "registro->>pessoaId", valor: pessoa.id } : { campo: "id", valor: "" };
  }
  return null;
}

const enc = (s: string) => new TextEncoder().encode(s);
const b64url = (bytes: Uint8Array) => { let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
// Assinatura e conferência HS256 com a chave dada (bytes crus).
async function chaveHmac(bytes: Uint8Array, usos: KeyUsage[]) { return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, usos); }
async function conferirJWT(token: string, chave: Uint8Array): Promise<any | null> {
  const partes = token.split("."); if (partes.length !== 3) return null;
  const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
  const cab = JSON.parse(new TextDecoder().decode(decode(partes[0])));
  if (cab.alg !== "HS256") return null;
  if (!await crypto.subtle.verify("HMAC", await chaveHmac(chave, ["verify"]), decode(partes[2]), enc(`${partes[0]}.${partes[1]}`))) return null;
  return JSON.parse(new TextDecoder().decode(decode(partes[1])));
}
// Chaves derivadas da base: HMAC-SHA256(EQUIPE_JWT_SECRET, rótulo). A base é
// dividida com os outros sistemas (Painel, RH, PCP); o crachá do aluno nunca é
// assinado com ela, então nenhum outro sistema o confunde com o seu.
const derivadas = new Map<string, Promise<Uint8Array>>();
function derivada(rotulo: string): Promise<Uint8Array> {
  let p = derivadas.get(rotulo);
  if (!p) {
    p = chaveHmac(enc(JWT_SECRET), ["sign"]).then(k => crypto.subtle.sign("HMAC", k, enc(rotulo))).then(b => new Uint8Array(b));
    derivadas.set(rotulo, p); p.catch(() => derivadas.delete(rotulo));
  }
  return p;
}

// Crachá da Central (admin, gestão, equipe): chave base, sis "pops". Não aceita o do aluno.
async function lerCracha(token: string): Promise<any | null> {
  try {
    if (!JWT_SECRET || !token) return null;
    const p = await conferirJWT(token, enc(JWT_SECRET));
    if (!p || p.sis !== "pops" || typeof p.sub !== "string" || !norm(p.sub) || !["admin", "gestor", "equipe"].includes(p.papel)) return null;
    if (!Number.isFinite(p.exp) || p.exp <= Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}

// Crachá do aluno: chave derivada, sis "pops-aluno", papel "aluno", e a ficha do
// RH como identidade (sub = "aluno:" + colaboradorId). Não aceita o da Central.
const ALUNO_MAX_DIAS = 30;
async function lerCrachaAluno(token: string): Promise<any | null> {
  try {
    if (!JWT_SECRET || !token) return null;
    const p = await conferirJWT(token, await derivada("pops-aluno-v1"));
    if (!p || p.sis !== "pops-aluno" || p.papel !== "aluno") return null;
    if (typeof p.colaboradorId !== "string" || !/^[a-zA-Z0-9._:-]{1,150}$/.test(p.colaboradorId) || p.sub !== "aluno:" + p.colaboradorId) return null;
    const agora = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(p.iat) || !Number.isFinite(p.exp) || p.exp <= agora || p.iat > agora + 300 || p.exp - p.iat > ALUNO_MAX_DIAS * 86400) return null;
    return p;
  } catch { return null; }
}
async function assinarAluno(payload: any): Promise<string> {
  const corpo = b64url(enc(JSON.stringify({ alg: "HS256", typ: "JWT" }))) + "." + b64url(enc(JSON.stringify(payload)));
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(await derivada("pops-aluno-v1"), ["sign"]), enc(corpo)));
  return corpo + "." + b64url(assinatura);
}

// Configuração da entrada do aluno: entradaAlunoCfg (_shared/escola.ts), a mesma
// regra da tela da administração. ligadaEm: crachá emitido antes de a
// administração religar a entrada não vale mais (desligar encerra).
const FIM_ALUNO = "Sua entrada de aluno terminou. Entre de novo com seu ID do RH e primeiro nome.";
// A cada chamada: a entrada segue ligada, o crachá cabe na validade de agora e a
// ficha segue viva no RH. Qualquer "não" encerra a sessão (401).
async function conferirAluno(cracha: any, cfg: any) {
  const e = entradaAlunoCfg(cfg), agora = Math.floor(Date.now() / 1000);
  if (!e.ativa || cracha.iat + e.validadeDias * 86400 <= agora) throw new Falha(FIM_ALUNO, 401);
  if (e.ligadaEm && Number.isFinite(Date.parse(e.ligadaEm)) && cracha.iat < Math.floor(Date.parse(e.ligadaEm) / 1000)) throw new Falha(FIM_ALUNO, 401);
  const identidade = await identidadeAluno(cracha);
  if (!identidade.vinculada) throw new Falha(FIM_ALUNO, 401);
}

// Entrada do aluno: ID do RH (idPessoa, 6 dígitos) e primeiro nome, sem senha.
// Porta pública e estreita: a mesma resposta para ID inexistente, nome errado,
// pessoa desligada e entrada desligada; nada da ficha sai antes de conferir; cada
// tentativa conta no banco (pops_entrada_aluno) antes da conferência.
const ERRO_ALUNO = "ID ou nome não conferem.";
const MUITAS_ALUNO = "Muitas tentativas. Tente de novo em 15 minutos.";
const INDISPONIVEL_ALUNO = "Não consegui conferir sua entrada agora. Tente novamente.";
// IP em forma única: IPv4 como veio (cada parte até 255); IPv6 agrupado pela rede
// /64 (quem tem um /64 tem 2^64 endereços, um balde só); IPv4 dentro de IPv6 vira
// IPv4. Fora do formato: "" (não serve de chave).
function ipNormal(bruto: string): string {
  let ip = String(bruto || "").trim().toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split(".").every(n => Number(n) <= 255) ? ip.split(".").map(n => String(Number(n))).join(".") : "";
  ip = ip.replace(/^\[|\]$/g, "").split("%")[0];
  const v4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return ipNormal(v4[1]);
  if (!/^[0-9a-f:]{2,39}$/.test(ip) || (ip.match(/::/g) || []).length > 1) return "";
  const [esq, dir] = ip.split("::");
  const a = esq ? esq.split(":") : [], b = dir === undefined ? null : dir ? dir.split(":") : [];
  if (b && a.length + b.length > 7) return "";
  const grupos = b ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
  if (grupos.length !== 8 || grupos.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return "";
  return grupos.slice(0, 4).map(g => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}
// IP de quem chama, só do que o cliente não escolhe: o cf-connecting-ip, que a
// Cloudflare (na frente da Supabase) sobrescreve; sem ele, o item mais à DIREITA
// do x-forwarded-for, o que o proxy acrescentou. O da esquerda é do cliente: um
// "x-forwarded-for: 198.18.0.N" diferente a cada pedido criaria um balde novo a
// cada vez. Sem IP válido, um balde só para todos ("desconhecido"), o lado
// seguro. O teto do total (na rotina do banco) não depende do IP.
function ipDe(req: Request) {
  const cf = ipNormal(req.headers.get("cf-connecting-ip") || "");
  if (cf) return cf;
  const itens = (req.headers.get("x-forwarded-for") || "").split(",").map(s => s.trim()).filter(Boolean);
  return (itens.length && ipNormal(itens[itens.length - 1])) || "desconhecido";
}
async function entrarAluno(body: any, req: Request) {
  if (!JWT_SECRET) throw new Falha(INDISPONIVEL_ALUNO, 503);
  const id = typeof body.id === "string" && /^\d{6}$/.test(body.id.trim()) ? body.id.trim() : "";
  const nome = typeof body.nome === "string" && body.nome.length <= 120 ? norm(body.nome) : "";
  // Chaves do limite cifradas com segredo do servidor: o banco não guarda ID, nome
  // nem IP. O nome tem contador próprio: fixar um nome comum e percorrer os IDs
  // de muitos endereços esbarra nele (e no teto do total, que o banco soma sozinho).
  const k = await chaveHmac(await derivada("pops-aluno-tentativas-v1"), ["sign"]);
  const cifrar = async (s: string) => hex(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc(s))));
  const chaves = { p_chave_id: id ? "id:" + await cifrar("id:" + id) : null, p_chave_nome: nome ? "nome:" + await cifrar("nome:" + nome) : null, p_chave_ip: "ip:" + await cifrar("ip:" + ipDe(req)) };
  const tentativa = await sb.rpc("pops_entrada_aluno", { p_acao: "tentar", ...chaves });
  if (tentativa.error || !tentativa.data || typeof tentativa.data !== "object") throw new Falha(INDISPONIVEL_ALUNO, 503);
  if (tentativa.data.bloqueado) throw new Falha(MUITAS_ALUNO, 429);
  const cfg = await config(), e = entradaAlunoCfg(cfg);
  let ficha: { id: string; primeiro: string } | null = null;
  if (e.ativa && id && nome) {
    const rows = conferir(await sb.from("registros").select("id,nome:registro->>nome,statusId:registro->>statusId,dataDesligamento:registro->>dataDesligamento").eq("colecao", "colaboradores").eq("apagado", false).eq("registro->>idPessoa", id).limit(5));
    // Mesma régua de pessoasRH (escola): sem desligamento e fora de inativo/abandono.
    const vivas = rows.filter((row: any) => { const r = row.registro || row; return !r.dataDesligamento && !["inativo", "abandono"].includes(r.statusId); });
    if (vivas.length === 1) {
      const r = vivas[0].registro || vivas[0], primeiro = String(r.nome || "").trim().split(/\s+/)[0] || "";
      if (primeiro && norm(primeiro) === nome && /^[a-zA-Z0-9._:-]{1,150}$/.test(String(vivas[0].id))) ficha = { id: String(vivas[0].id), primeiro };
    }
  }
  if (!ficha) throw new Falha(ERRO_ALUNO, 401);
  // Entrada certa zera o ID; falha ao zerar não barra quem conferiu (a contagem vence sozinha).
  try { await sb.rpc("pops_entrada_aluno", { p_acao: "sucesso", ...chaves }); } catch { /* idem */ }
  const iat = Math.floor(Date.now() / 1000), exp = iat + e.validadeDias * 86400;
  const token = await assinarAluno({ sis: "pops-aluno", papel: "aluno", sub: "aluno:" + ficha.id, colaboradorId: ficha.id, nome: ficha.primeiro, iat, exp });
  return { ok: true, token, usuario: "aluno:" + ficha.id, nome: ficha.primeiro, papel: "aluno", colaboradorId: ficha.id, validoAte: new Date(exp * 1000).toISOString() };
}

// Falha de consulta não concede acesso; o conteúdo já baixado segue disponível offline.
async function conferirAcesso(cracha: any) {
  const { data, error } = await sb.rpc("acesso_revogado", { p_sistema: "pops", p_sub: cracha.sub, p_papel: cracha.papel });
  if (error || typeof data !== "boolean") throw new Falha("Não consegui conferir seu acesso agora. Tente novamente.", 503);
  if (data) throw new Falha("Seu acesso foi encerrado. Fale com a gestão.", 401);
}

async function autorizarEscrita(col: string, novo: any, anterior: any, cracha: any, maquina: boolean, apagar = false) {
  if (maquina) return;
  const u = norm(cracha.sub), papel = cracha.papel;
  if (apagar) { if (papel !== "admin") negar(); return; }
  if (["leituras", "progresso"].includes(col)) {
    if (norm(novo.usuario) !== u || (anterior && norm(anterior.usuario) !== u)) negar();
    const ref = col === "progresso" ? novo.jornadaId : novo.popId || novo.treinamentoId;
    const origem = col === "progresso" ? "jornadas" : novo.popId ? "pops" : "treinamentos";
    const prefixo = col === "progresso" ? "j" : novo.popId ? "l" : "t";
    if (novo.id !== `${prefixo}-${u}-${ref}`) negar();
    const item = await registro(origem, idValido(ref));
    if (!item || item.apagado) throw new Falha("Este conteúdo não está mais disponível. Atualize a lista.", 409);
    if (col === "leituras") {
      if (novo.versaoLida !== (item.registro.versao || "1.0")) throw new Falha("O conteúdo mudou. Leia a versão atual antes de confirmar.", 409);
      if (origem === "treinamentos" && item.registro.exigeAceite && novo.aceite !== true) throw new Falha("Confirme o aceite do treinamento.");
    } else {
      const validas = new Set((item.registro.etapas || []).map((e: any) => e.id));
      if (!novo.etapas || Array.isArray(novo.etapas) || typeof novo.etapas !== "object" || Object.keys(novo.etapas).some(k => !validas.has(k))) throw new Falha("As etapas mudaram. Atualize a jornada antes de continuar.", 409);
      if (!validas.size || Object.keys(novo.etapas).length < validas.size) delete novo.concluidaEm;
    }
    novo.usuario = u;
    // Identidade e autoria não são delegáveis pelo formulário.
    novo.nome = String(cracha.nome || cracha.sub);
    const identidade = await identidadeRH(cracha);
    if (!identidade.vinculada && identidade.motivo !== "sem_vinculo_central") throw new Falha("Confira o vínculo da sua conta com o RH antes de registrar aprendizado pessoal.", 403);
    if (anterior?.colaboradorId && (!identidade.vinculada || anterior.colaboradorId !== identidade.pessoa.colaboradorId)) negar();
    // Campos fornecidos pelo cliente jamais escolhem a ficha de outra pessoa.
    delete novo.pessoaId; delete novo.colaboradorId;
    if (identidade.vinculada) {
      novo.pessoaId = identidade.pessoa!.id;
      novo.colaboradorId = identidade.pessoa!.colaboradorId;
      novo.nome = identidade.pessoa!.nome;
    }
    return;
  }
  if (papel === "admin") return;
  if (papel !== "gestor" || !["pops", "atribuicoes"].includes(col)) negar();
  const cfg = await config();
  const meus = (cfg.gestores?.[u] || []).map(norm);
  if (col === "pops") {
    if (!meus.includes(norm(novo.setor)) || (anterior && !meus.includes(norm(anterior.setor)))) negar();
  } else {
    if (novo.tipo !== "pop" || (anterior && (anterior.tipo !== "pop" || anterior.refId !== novo.refId || anterior.pessoaId !== novo.pessoaId))) negar();
    const pop = await registro("pops", idValido(novo.refId));
    if (!pop || pop.apagado || !meus.includes(norm(pop.registro.setor))) negar();
    const escopo = await filtroGestor("pessoas", cracha);
    if (!escopo?.valores.includes(novo.pessoaId)) negar();
  }
}

// Mudança operacional invalida leitura anterior. Metadados de navegação não
// promovem procedimento a validado: só a confirmação explícita do revisor.
function estavel(valor: any): string {
  if (Array.isArray(valor)) return "[" + valor.map(estavel).join(",") + "]";
  if (valor && typeof valor === "object") return "{" + Object.keys(valor).sort().map(k => JSON.stringify(k) + ":" + estavel(valor[k])).join(",") + "}";
  return JSON.stringify(valor) ?? "null";
}
function prepararTreinamento(novo: any, anterior: any, cracha: any) {
  // A edição do treinamento conserva campos anteriores que este formulário não
  // conhece. Campos enviados explicitamente continuam sujeitos à validação.
  if (anterior) for (const [campo, valor] of Object.entries(anterior)) {
    if (!Object.hasOwn(novo, campo)) novo[campo] = valor;
  }
  const texto = (valor: any, limite: number, rotulo: string, obrigatorio = false) => {
    if (typeof valor !== "string" || valor.length > limite || (obrigatorio && !valor.trim())) {
      throw new Falha(`${rotulo}: informe um texto ${obrigatorio ? "não vazio " : ""}com até ${limite} caracteres.`);
    }
    return valor.trim();
  };
  novo.titulo = texto(novo.titulo, 200, "Título", true);
  novo.versao = texto(novo.versao, 40, "Versão", true);
  for (const [campo, limite] of [["tipo", 80], ["setor", 200], ["resumo", 2000], ["responsavel", 200]] as const) {
    if (novo[campo] !== undefined) novo[campo] = texto(novo[campo], limite, campo);
  }
  if (novo.exigeAceite !== undefined && typeof novo.exigeAceite !== "boolean") throw new Falha("Confirmação de aceite inválida.");
  if (novo.validadeMeses !== undefined && (!Number.isInteger(novo.validadeMeses) || novo.validadeMeses < 0 || novo.validadeMeses > 120)) {
    throw new Falha("Informe uma validade inteira entre 0 e 120 meses.");
  }
  const tiposTexto = new Set(["paragrafo", "texto", "subtitulo", "destaque", "alerta"]);
  const tiposLista = new Set(["passos", "lista", "checklist"]);
  if (!Array.isArray(novo.blocos) || !novo.blocos.length || novo.blocos.length > 300) throw new Falha("Informe o conteúdo do treinamento em até 300 blocos.");
  let temConteudo = false;
  for (const bloco of novo.blocos) {
    if (!bloco || Array.isArray(bloco) || typeof bloco !== "object") throw new Falha("Bloco de conteúdo inválido.");
    if (tiposTexto.has(bloco.tipo)) {
      if (texto(bloco.texto, 20000, "Texto do bloco")) temConteudo = true;
    } else if (tiposLista.has(bloco.tipo)) {
      if (!Array.isArray(bloco.itens) || bloco.itens.length > 200) throw new Falha("Informe até 200 itens por lista.");
      for (const item of bloco.itens) if (texto(item, 2000, "Item da lista")) temConteudo = true;
    } else throw new Falha("Tipo de bloco de conteúdo inválido.");
  }
  if (!temConteudo) throw new Falha("Informe um conteúdo não vazio para o treinamento.");
  if (novo.materiais !== undefined) {
    if (!Array.isArray(novo.materiais) || novo.materiais.length > 20) throw new Falha("Informe até 20 materiais de apoio.");
    for (const material of novo.materiais) {
      if (!material || Array.isArray(material) || typeof material !== "object") throw new Falha("Material de apoio inválido.");
      material.titulo = texto(material.titulo, 200, "Título do material", true);
      material.url = texto(material.url, 2000, "Link do material", true);
      let url: URL;
      try { url = new URL(material.url); } catch { throw new Falha("Use um link HTTPS completo para o material de apoio."); }
      if (!/^https:\/\//i.test(material.url) || url.protocol !== "https:" || !url.hostname || url.username || url.password || /[\u0000-\u0020\u007f\\]/.test(material.url)) {
        throw new Falha("Use um link HTTPS completo, sem credenciais, para o material de apoio.");
      }
    }
  }
  const defaults: Record<string, any> = { tipo: "", setor: "", resumo: "", exigeAceite: false, validadeMeses: 0, materiais: [] };
  const campos = ["titulo", "tipo", "setor", "resumo", "blocos", "exigeAceite", "validadeMeses", "materiais"];
  const valorComparavel = (registro: any, campo: string) => registro[campo] === undefined ? defaults[campo] : registro[campo];
  const mudou = !!anterior && campos.some(campo => estavel(valorComparavel(novo, campo)) !== estavel(valorComparavel(anterior, campo)));
  if (mudou && novo.versao === String(anterior.versao || "1.0").trim()) throw new Falha("O treinamento mudou. Informe uma nova versão para renovar as conclusões.", 409);
  const agora = new Date().toISOString(), autor = String(cracha?.nome || cracha?.sub || "Automação");
  for (const campo of ["criadoEm", "criadoPor"]) {
    if (!anterior) novo[campo] = campo === "criadoEm" ? agora : autor;
    else if (Object.hasOwn(anterior, campo)) novo[campo] = anterior[campo];
    else delete novo[campo];
  }
  novo.revisadoEm = agora;
  novo.revisadoPor = autor;
  if (JSON.stringify(novo).length > 500_000) throw new Falha("Registro inválido ou muito grande.");
}
async function prepararPOP(novo: any, anterior: any, cracha: any, confirmar: boolean) {
  const campos = ["titulo", "setor", "objetivo", "epis", "blocos", "responsavel"];
  const mudou = !!anterior && campos.some(k => estavel(novo[k] ?? null) !== estavel(anterior[k] ?? null));
  if (mudou && String(novo.versao || "1.0") === String(anterior.versao || "1.0")) throw new Falha("O procedimento mudou. Informe uma nova versão para renovar as leituras.", 409);
  if (novo.revisao != null && (!novo.revisao || typeof novo.revisao !== "object" || !["revisar", "validado"].includes(novo.revisao.status))) throw new Falha("Situação de revisão inválida.");
  if (confirmar && novo.revisao?.status === "validado") novo.revisao = { status: "validado", por: String(cracha.nome || cracha.sub), em: new Date().toISOString() };
  else if (mudou || (anterior && String(novo.versao || "1.0") !== String(anterior.versao || "1.0")) || (!anterior && novo.revisao) || novo.revisao?.status === "revisar") novo.revisao = { status: "revisar" };
  else if (anterior?.revisao) novo.revisao = anterior.revisao;
  else delete novo.revisao;
  if (novo.fontes !== undefined && (!Array.isArray(novo.fontes) || novo.fontes.length > 30 || novo.fontes.some((f: any) => typeof f !== "string" || f.length > 1000))) throw new Falha("Informe até 30 fontes em texto.");
  if (novo.relacionados !== undefined) {
    if (!Array.isArray(novo.relacionados) || novo.relacionados.length > 50) throw new Falha("Informe até 50 conteúdos relacionados.");
    const origens: Record<string, string> = { pop: "pops", jornada: "jornadas", treinamento: "treinamentos" };
    const unicos = new Set<string>();
    for (const rel of novo.relacionados) {
      if (!rel || !origens[rel.tipo] || typeof rel.refId !== "string" || (rel.tipo === "pop" && rel.refId === novo.id)) throw new Falha("Conteúdo relacionado inválido.", 409);
      const chave = rel.tipo + ":" + rel.refId;
      if (unicos.has(chave)) throw new Falha("Remova o conteúdo relacionado repetido.", 409);
      unicos.add(chave);
      const item = await registro(origens[rel.tipo], idValido(rel.refId));
      if (!item || item.apagado) throw new Falha("Um conteúdo relacionado não está mais disponível. Atualize os vínculos.", 409);
    }
    novo.relacionados = novo.relacionados.map((r: any) => ({ tipo: r.tipo, refId: r.refId }));
  }
}

// O que o crachá do aluno alcança (porta estreita). Tudo o que não está aqui é
// recusado com 403 antes de qualquer leitura: conhecimento (base de referências),
// setCfg, delete, restore, sincronizarPessoas, fotos, saúde, listagem completa.
// Dentro de "escola", a lista de operações fica em _shared/escola.ts.
const ACOES_ALUNO = new Set(["ping", "identidadeRH", "rev", "list", "get", "upsert", "getCfg", "escola"]);
const COLS_ALUNO_LEITURA = new Set(["pops", "jornadas", "treinamentos", "pessoas", "atribuicoes", "leituras", "progresso"]);
// Só o "li e entendi" e o progresso das jornadas de fabricação, do próprio aluno.
const COLS_ALUNO_ESCRITA = new Set(["leituras", "progresso"]);
// Configuração que a tela do aluno usa para ler POPs e jornadas: sem gestores,
// instrutores, catálogo da escola nem a configuração da entrada.
const CFG_ALUNO = ["areas", "setores", "linhas", "resumoSetor"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);
  try {
    const maquina = !!TOKEN && req.headers.get("x-token") === TOKEN;
    const bruto = await req.text();
    let body: any, jsonValido = true;
    try { body = JSON.parse(bruto); } catch { jsonValido = false; }
    // Entrada do aluno: a única ação sem crachá. Não lê nem escreve nada além da
    // conferência do ID e do nome e do limite de tentativas.
    if (jsonValido && body && typeof body === "object" && !Array.isArray(body) && body.action === "entrarAluno") return resp(await entrarAluno(body, req));
    const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    const cracha = m ? (await lerCracha(m[1]) ?? await lerCrachaAluno(m[1])) : null;
    const aluno = cracha?.papel === "aluno";
    // Configuração lida uma vez nesta chamada do aluno (conferência e escola).
    let cfgAluno: Promise<any> | null = null;
    const configAluno = () => (cfgAluno ??= config());
    if (!maquina) {
      if (!cracha) throw new Falha("Entre no sistema.", 401);
      if (aluno) await conferirAluno(cracha, await configAluno()); else await conferirAcesso(cracha);
    }
    const admin = maquina || cracha?.papel === "admin";
    if (!jsonValido) throw new Falha("JSON inválido.");
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Falha("Requisição inválida.");
    const action = String(body.action ?? "");
    if (aluno && !maquina) {
      const negarAluno = () => { throw new Falha("A entrada de aluno não permite esta ação.", 403); };
      if (!ACOES_ALUNO.has(action)) negarAluno();
      if (["list", "get"].includes(action) && !COLS_ALUNO_LEITURA.has(body.colecao)) negarAluno();
      if (action === "upsert" && !COLS_ALUNO_ESCRITA.has(body.colecao)) negarAluno();
    }
    if (["delete", "restore", "setCfg", "sincronizarPessoas", "putFoto", "deleteFoto"].includes(action) && !admin) negar();
    switch (action) {
      case "escola": return resp(await escola(body, { sb, cracha, maquina, identidadeRH, config: aluno && !maquina ? configAluno : config, registro, conferir, Falha, criarMaquinasEscola, painelToken: req.headers.get("x-painel-cracha") }));
      case "ping": return resp({ ok: true, agora: new Date().toISOString() });
      case "identidadeRH": return resp(await identidadeRH(cracha));
      case "conhecimento": {
        // Conteúdo empresarial fica no banco privado; repositório e site contêm só o leitor.
        const base = (await config()).conhecimentoBase;
        return resp({ ok: true, conhecimento: base && typeof base === "object" && !Array.isArray(base) ? base : null });
      }
      case "rev": {
        const data = conferir(await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle());
        return resp({ rev: data?.valor ?? { rev: 0, porColecao: {} } });
      }
      case "list": {
        if (body.colecao == null) {
          if (!admin) negar();
          const de = Number(body.after ?? 0);
          if (!Number.isSafeInteger(de) || de < 0) throw new Falha("Página inválida.");
          // O backup diário do Hub chama sem crachá, com o x-token de serviço, e
          // precisa da escola inteira para restaurar. O admin pela tela continua
          // vendo só as coleções antigas: a escola tem leitura própria e filtrada.
          const colecoes = maquina ? [...COLS, ...COLS_ESCOLA] : [...COLS];
          const data = conferir(await sb.from(T_REG).select("colecao, id, registro, apagado").in("colecao", colecoes).order("colecao").order("id").range(de, de + 499));
          return resp({ registros: data.filter((l: any) => !l.apagado).map((l: any) => ({ ...l.registro, _col: l.colecao })), nextAfter: data.length === 500 ? de + 500 : null });
        }
        const col = colValida(body.colecao), limite = Number(body.limite ?? 200);
        if (!Number.isInteger(limite) || limite < 1 || limite > 500) throw new Falha("Limite de página inválido.");
        let q = sb.from(T_REG).select("id, registro, apagado, atualizado_em, revision").eq("colecao", col);
        const filtro = await filtroLeitura(col, cracha, maquina);
        if (filtro) q = "expressao" in filtro ? q.or(filtro.expressao!) : "valores" in filtro ? q.in(filtro.campo!, filtro.valores) : q.eq(filtro.campo!, filtro.valor!);
        if (body.desde) {
          // A dupla data/id não perde registros quando um lote compartilha a data.
          if (typeof body.desde === "object") {
            const { em, id } = body.desde;
            if (typeof em !== "string" || !/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(em) || !Number.isFinite(Date.parse(em))) throw new Falha("Cursor inválido.");
            q = q.or(`atualizado_em.gt.${em},and(atualizado_em.eq.${em},id.gt.${idValido(id)})`);
          } else {
            // Compatibilidade temporária com o app anterior; o novo cliente usa a dupla.
            if (typeof body.desde !== "string" || !Number.isFinite(Date.parse(body.desde))) throw new Falha("Cursor inválido.");
            q = q.gt("atualizado_em", body.desde);
          }
        }
        const data = conferir(await q.order("atualizado_em").order("id").limit(limite));
        const ultimo = data[data.length - 1];
        return resp({ itens: data, proximo: data.length === limite ? (body.protocolo === 2 ? { em: ultimo.atualizado_em, id: ultimo.id } : ultimo.atualizado_em) : null });
      }
      case "get": {
        const col = colValida(body.colecao), filtro = await filtroLeitura(col, cracha, maquina);
        let q = sb.from(T_REG).select("registro, apagado, revision").eq("colecao", col).eq("id", idValido(body.id));
        if (filtro) q = "expressao" in filtro ? q.or(filtro.expressao!) : "valores" in filtro ? q.in(filtro.campo!, filtro.valores) : q.eq(filtro.campo!, filtro.valor!);
        const data = conferir(await q.maybeSingle());
        return resp({ registro: data && !data.apagado ? data.registro : null, revision: data?.revision ?? 0 });
      }
      case "upsert":
      case "delete":
      case "restore": {
        const col = colValida(body.colecao);
        const reg = body.registro;
        if (action === "upsert" && (!reg || Array.isArray(reg) || typeof reg !== "object" || JSON.stringify(reg).length > 500_000)) throw new Falha("Registro inválido ou muito grande.");
        const id = idValido(action === "upsert" ? reg.id : body.id);
        const atual = await registro(col, id);
        await autorizarEscrita(col, reg, atual?.registro, cracha, maquina, action !== "upsert");
        if (action === "upsert" && col === "treinamentos") prepararTreinamento(reg, atual?.registro, cracha);
        if (action === "upsert" && col === "pops" && !maquina) await prepararPOP(reg, atual?.registro, cracha, body.confirmarRevisao === true);
        if (action === "upsert" && col === "pessoas" && !maquina) {
          if (!atual || atual.apagado) throw new Falha("Atualize a pessoa a partir do RH antes de vincular sua conta.", 409);
          const usuario = norm(reg.usuario), observacao = reg.observacao ?? atual.registro.observacao;
          if (usuario) {
            const conta = conferir(await sb.from("equipe_contas").select("usuario, ativo").eq("sistema", "pops").eq("usuario", usuario).maybeSingle());
            if (!conta || conta.ativo === false) throw new Falha("Escolha uma conta ativa do POPs na Central de Acessos.", 409);
            const identidade = await identidadeRH({ sub: usuario });
            if (!identidade.vinculada || identidade.pessoa!.id !== id) throw new Falha("O vínculo deve corresponder ao ID da pessoa no RH e na Central de Acessos.", 409);
          }
          // Nome, função e área continuam sendo responsabilidade do RH.
          for (const k of Object.keys(reg)) delete reg[k];
          Object.assign(reg, atual.registro, { usuario });
          if (observacao !== undefined) reg.observacao = observacao;
        }
        if (action === "upsert" && col === "atribuicoes") {
          const origens: Record<string, string> = { pop: "pops", jornada: "jornadas", treinamento: "treinamentos" };
          if (!origens[reg.tipo]) throw new Falha("Tipo de atribuição inválido.");
          const pessoa = await registro("pessoas", idValido(reg.pessoaId));
          const item = await registro(origens[reg.tipo], idValido(reg.refId));
          if (!pessoa || pessoa.apagado || !item || item.apagado) throw new Falha("Pessoa ou conteúdo indisponível.", 409);
        }
        const expected = body.expectedRevision;
        if (expected != null && (!Number.isSafeInteger(expected) || expected < 0)) throw new Falha("Versão inválida.");
        const mutation = body.mutationId == null ? null : idValido(body.mutationId);
        const result = await sb.rpc("pops_gravar", { p_colecao: col, p_id: id, p_registro: action === "upsert" ? reg : null, p_acao: action, p_expected: expected ?? atual?.revision ?? 0, p_mutation: mutation });
        if (result.error?.code === "40001") throw new Falha("Outra pessoa atualizou este item. Sua alteração foi preservada para revisão.", 409);
        if (result.error?.code === "23505") throw new Falha("Essa conta já está vinculada a outra pessoa.", 409);
        return resp(conferir(result));
      }
      case "getCfg": {
        // Configuração completa (base de conhecimento e escola inclusive) só vai
        // para o backup do Hub; a tela segue sem a base privada, como antes.
        const completa = await config();
        if (maquina) return resp({ config: completa, cfg: completa });
        if (aluno) {
          const cfg = Object.fromEntries(CFG_ALUNO.filter(k => Object.hasOwn(completa, k)).map(k => [k, completa[k]]));
          return resp({ config: cfg, cfg });
        }
        const { conhecimentoBase: _basePrivada, ...cfg } = completa;
        return resp({ config: cfg, cfg });
      }
      case "setCfg": {
        if (!body.config || Array.isArray(body.config) || typeof body.config !== "object") throw new Falha("Configuração inválida.");
        // Somente campos enviados são modificados; omissão não apaga os demais.
        const result = await sb.rpc("pops_configurar", { p_patch: body.config, p_anterior: body.anterior ?? null });
        if (result.error?.code === "40001") throw new Falha("A configuração mudou. Atualize antes de salvar.", 409);
        return resp(conferir(result));
      }
      case "putFoto": {
        const id = idValido(body.id), tipo = String(body.tipo || "image/jpeg");
        if (!["image/jpeg", "image/png", "image/webp"].includes(tipo)) throw new Falha("Use uma imagem JPG, PNG ou WebP.");
        const b64 = String(body.base64 || "").replace(/^data:[^;]+;base64,/, "");
        if (!b64 || b64.length > 7_000_000) throw new Falha("A imagem deve ter até 5 MB.");
        let bytes: Uint8Array; try { bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); } catch { throw new Falha("Imagem inválida."); }
        if (bytes.length > 5_000_000) throw new Falha("A imagem deve ter até 5 MB.");
        conferir(await sb.storage.from(BUCKET).upload(id, bytes, { contentType: tipo, upsert: true })); return resp({ ok: true });
      }
      case "getFoto": {
        const { data, error } = await sb.storage.from(BUCKET).download(idValido(body.id));
        if (error || !data) throw new Falha("Não consegui carregar a imagem. Tente novamente.", 502);
        const buf = new Uint8Array(await data.arrayBuffer()); let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return resp({ base64: `data:${data.type || "image/jpeg"};base64,${btoa(bin)}` });
      }
      case "deleteFoto": conferir(await sb.storage.from(BUCKET).remove([idValido(body.id)])); return resp({ ok: true });
      // Uma transação lê o espelho completo e preserva vínculos locais; falha desfaz tudo.
      case "sincronizarPessoas": return resp(conferir(await sb.rpc("pops_sincronizar_pessoas")));
      case "saude": {
        const result = await sb.from(T_REG).select("id", { count: "exact", head: true }); conferir(result);
        return resp({ ok: true, registros: result.count });
      }
      default: throw new Falha("Ação desconhecida.");
    }
  } catch (e) {
    const status = e instanceof Falha ? e.status : 500;
    return resp({ erro: e instanceof Error ? e.message : "Falha interna.", ...(status === 401 ? { semSessao: true } : {}), ...(status === 403 ? { semPermissao: true } : {}) }, status);
  }
});
