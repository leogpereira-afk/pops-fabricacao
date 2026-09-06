import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { createHmac, webcrypto } from 'node:crypto';

export const root = new URL('../', import.meta.url);
export const tick = () => new Promise(resolve => setImmediate(resolve));
const secret = 'segredo-ficticio-exclusivo-dos-testes';
export function jwt(payload = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify({ sis: 'pops', sub: 'ana', papel: 'equipe', exp: Math.floor(Date.now()/1000)+600, ...payload })).toString('base64url');
  return `${header}.${data}.${createHmac('sha256', secret).update(`${header}.${data}`).digest('base64url')}`;
}

export function backend({ rows = [], config = {}, queryError = false, revocationError = false, revoked = false } = {}) {
  let handler;
  const writes = [];
  const queries = [];
  const sb = {
    rpc: async (name, args) => {
      if (name === 'acesso_revogado') return { data: revoked, error: revocationError ? { message: 'banco fora' } : null };
      writes.push({ rpc: name, args });
      return { data: { ok: true, revision: 2, registro: args?.p_registro }, error: null };
    },
    from(table) {
      const q = { table, filters: [], orders: [], range: null, limit: Infinity, single: false, mutation: null };
      queries.push(q);
      const chain = {
        select() { return chain; },
        eq(k,v) { q.filters.push(r=>(k.startsWith('registro->>')?r.registro?.[k.slice(11)]:r[k])===v); return chain; },
        gt(k,v) { q.filters.push(r=>r[k]>v); return chain; },
        gte(k,v) { q.filters.push(r=>r[k]>=v); return chain; },
        lte(k,v) { q.filters.push(r=>r[k]<=v); return chain; },
        in(k,v) { q.filters.push(r=>v.includes(r[k])); return chain; },
        or(expr) {
          // Real PostgREST composite cursor emitted by the production handler.
          const m=expr.match(/^atualizado_em.gt.([^,]+),and\(atualizado_em.eq.([^,]+),id.gt.(.+)\)$/);
          if (!m) throw new Error('Filtro de cursor não reconhecido: '+expr);
          q.filters.push(r=>r.atualizado_em>m[1] || (r.atualizado_em===m[2] && r.id>m[3])); return chain;
        },
        order(k) { q.orders.push(k); return chain; },
        limit(n) { q.limit=n; return chain; },
        range(a,b) { q.range=[a,b]; return chain; },
        maybeSingle() { q.single=true; return chain; },
        upsert(value) { q.mutation=value; writes.push({table,value}); return chain; },
        update(value) { q.mutation=value; writes.push({table,value}); return chain; },
        then(resolve,reject) {
          return Promise.resolve().then(()=>{
            if(queryError) return {data:null,error:{message:'leitura indisponível'},count:null};
            let data = table==='pops_config_global' ? [{id:true,config}] : table==='pops_meta' ? [{chave:'rev',valor:{rev:1,porColecao:{pops:1}}}] : rows;
            data=data.filter(r=>q.filters.every(f=>f(r))).slice().sort((a,b)=>{for(const k of q.orders){if(a[k]!==b[k])return a[k]<b[k]?-1:1;}return 0;});
            const count=data.length;
            if(q.range)data=data.slice(q.range[0],q.range[1]+1);
            data=data.slice(0,q.limit);
            return {data:q.single?(data[0]||null):data,error:null,count};
          }).then(resolve,reject);
        }
      }; return chain;
    }
  };
  const ctx = vm.createContext({ __sb: sb, Deno:{env:{get:k=>k==='EQUIPE_JWT_SECRET'?secret:k==='POPS_TOKEN'?'maquina-ficticia':'http://exemplo.test'},serve:fn=>handler=fn}, crypto:webcrypto, TextEncoder,TextDecoder,Uint8Array,atob,btoa,Request,Response,console:{error(){}} });
  const source=fs.readFileSync(new URL('supabase/functions/pops-sync/index.ts',root),'utf8').replace(/^import .*createClient.*;$/m,'const createClient = () => __sb;');
  vm.runInContext(stripTypeScriptTypes(source),ctx);
  async function call(body,payload={}) {
    const response=await handler(new Request('http://local.test',{method:'POST',headers:{authorization:'Bearer '+jwt(payload),'content-type':'application/json'},body:JSON.stringify(body)}));
    return {status:response.status,body:await response.json()};
  }
  return {call,writes,queries};
}

export function store({initial={},fetcher=async()=>({ok:true,json:async()=>({ok:true})}),online=false}={}) {
  const storage=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
  let failWrites=false;
  const navigator={onLine:online};
  const ctx=vm.createContext({ console:{error(){}},crypto:webcrypto,AbortController, navigator,AUTH:{cracha:()=>jwt()},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(failWrites)throw new Error('quota');storage.set(k,v);},removeItem:k=>storage.delete(k)},
    window:{API_BASE:'http://local.test',API_FN:{sync:'sync'},addEventListener(){}},fetch:(...args)=>fetcher(...args),setTimeout:()=>1,clearTimeout(){},
  });
  vm.runInContext(fs.readFileSync(new URL('store.js',root),'utf8')+'\nglobalThis.store = STORE;',ctx);
  const api=ctx.store;
  if(!api.getUser())api.setUser({usuario:'ana',nome:'Ana fictícia',papel:'equipe'});
  return {store:api,storage,navigator,quota:()=>{failWrites=true;}};
}
