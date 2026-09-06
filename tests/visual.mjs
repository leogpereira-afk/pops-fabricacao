import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {cfg,dados} from './fixtures.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));const output=process.env.AUDIT_OUTPUT || '/tmp/pops-auditoria-visual';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const resultados=[];const before=process.env.AUDIT_BASELINE==='1';
try{
 for(const role of (before?['admin']:['admin','gestor','equipe'])) for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  const page=await ctx.newPage();const erros=[];page.on('pageerror',e=>erros.push(e.message));
  const user={usuario:'ana',nome:'Ana Exemplo',papel:role};
  await page.addInitScript(({user,cfg,dados})=>{
    localStorage.setItem('pops_user',JSON.stringify(user));localStorage.setItem('pops_cracha','credencial-ficticia');
    localStorage.setItem('pops_v2_ana',JSON.stringify({dados,cfg,fila:[],rev:{porColecao:{}},syncEm:null}));
  },{user,cfg,dados});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='pops-auditoria.local'){
      const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!['index.html','app.js','store.js','auth.js','config.js','styles.css','logo-impresilk.png','manifest.webmanifest','icone-192.png'].includes(name))return route.abort();
      const mime=name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html';
      return route.fulfill({contentType:mime,body:await fs.readFile(path.join(root,name))});
    }
    if(url.hostname.endsWith('.supabase.co')){
      let b={};try{b=route.request().postDataJSON()||{};}catch{}
      let data={ok:true};
      if(b.acao==='listarContas')data={contas:[{usuario:'ana',nome:'Ana Exemplo',ativo:true}]};
      else if(b.acao==='eu'||b.acao==='login')data={...user,token:'credencial-ficticia'};
      else if(b.action==='rev')data={rev:{porColecao:Object.fromEntries(Object.keys(dados).concat('cfg').map(c=>[c,1]))}};
      else if(b.action==='list')data={itens:(dados[b.colecao]||[]).map(registro=>({registro,apagado:false,revision:1})),proximo:null};
      else if(b.action==='getCfg')data={config:cfg};
      else if(b.action==='upsert')data={ok:true,registro:b.registro,revision:2};
      return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    }
    throw new Error('Requisição externa bloqueada: '+url.hostname);
  });
  await page.goto('http://pops-auditoria.local/');
  for(const route of ['#/','#/pops','#/pop/p1','#/fab','#/jornada/j1','#/etapa/j1/0','#/meus','#/treinamento/t1','#/pessoas','#/mapa','#/editor/pop/p1','#/editor/jornada/j1','#/menu']){
    if(role==='equipe' && ['#/pessoas','#/mapa','#/editor/pop/p1','#/editor/jornada/j1'].includes(route))continue;
    if(role==='gestor' && route==='#/editor/jornada/j1')continue;
    await page.goto('http://pops-auditoria.local/'+route);await page.locator('.miolo').waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    const nome=route.replace(/[^a-z0-9]/gi,'_');
    await page.screenshot({path:path.join(output,`${role==='admin'?'':role+'-'}${width}-${nome}.png`),fullPage:true});
    resultados.push({role,width,route,overflow,erros:erros.splice(0)});
  }
  if(!before){
    await page.goto('http://pops-auditoria.local/#/pop/p1');await page.getByRole('button',{name:'Li e entendi este procedimento',exact:false}).click();
    if (!await page.getByText('Você leu e confirmou').count()) console.log(await page.evaluate(() => ({randomUUID:typeof crypto.randomUUID,avisos:document.getElementById('toasts').textContent,leituras:JSON.parse(localStorage.getItem('pops_v2_ana')).dados.leituras})));
    assert.ok(await page.getByText('Você leu e confirmou').count());
    await page.getByRole('button',{name:'Enviar por WhatsApp',exact:false}).click();
    await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
    if(role==='admin'){
    await page.goto('http://pops-auditoria.local/#/editor/jornada/j1');
    const titulo=page.locator('[data-etapa-editor] input');await titulo.first().fill('Preparação revisada');
    await page.getByRole('button',{name:'Salvar jornada',exact:false}).click();
    const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem('pops_v2_ana')).dados.jornadas[0].etapas.map(e=>e.id));assert.deepEqual(ids,['e1','e2']);
    }
    if(role!=='equipe'){
      await page.goto('http://pops-auditoria.local/#/mapa');assert.ok(await page.getByText('Bia Exemplo',{exact:true}).count());
      await page.goto('http://pops-auditoria.local/#/pessoas');await page.locator('[data-pessoa]').first().click();await page.getByRole('dialog').waitFor();
      assert.equal(await page.getByRole('button',{name:'Salvar conta',exact:true}).count(),role==='admin'?1:0);
      await page.keyboard.press('Escape');
    }else{
      await page.goto('http://pops-auditoria.local/#/editor/pop/novo');await page.waitForURL('**/#/pops');
      assert.equal(await page.getByRole('link',{name:'Pessoas',exact:false}).count(),0);
    }
  }
  await ctx.close();
 }
 await fs.writeFile(path.join(output,'resultado.json'),JSON.stringify(resultados,null,2));
 console.log(JSON.stringify({telas:resultados.length,quebras:resultados.filter(r=>r.overflow),erros:resultados.filter(r=>r.erros.length)},null,2));
 if(!before){assert.equal(resultados.filter(r=>r.overflow).length,0);assert.equal(resultados.filter(r=>r.erros.length).length,0);}
}finally{await browser.close();}
