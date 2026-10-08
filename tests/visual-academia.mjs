import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {servidorRevisao} from '../scripts/revisao-educacao.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=servidorRevisao();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950},serviceWorkers:'block'});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?pessoa=gestao#/videos');await page.getByRole('heading',{name:'Vídeos para aprender e aplicar',exact:true}).waitFor();await page.getByRole('link',{name:'Cadastrar vídeo',exact:true}).click();
 await page.getByLabel('Título', {exact:true}).fill('Conferência de materiais');await page.getByLabel('Objetivo de aprendizagem').fill('Conferir os materiais antes de executar');await page.getByLabel('Setor responsável').fill('Produção');await page.getByLabel('Link do YouTube').fill('https://youtu.be/dQw4w9WgXcQ');await page.getByLabel('Pessoas do RH').selectOption('rh-ana');await page.getByLabel('Liberar para o público selecionado').check();await page.getByRole('button',{name:'Salvar material',exact:true}).click();await page.getByRole('heading',{name:'Conferência de materiais',exact:true}).waitFor();
 await page.goto(base+'/?pessoa=ana#/videos');await page.getByRole('link',{name:'Conferência de materiais',exact:true}).click();assert.equal(await page.locator('iframe').count(),0);await fs.mkdir('/tmp/educacao-impresilk-visual',{recursive:true});await page.screenshot({path:'/tmp/educacao-impresilk-visual/videos-previa.png',fullPage:true});await page.getByRole('button',{name:'Reproduzir aqui',exact:true}).click();await page.locator('iframe[title="Conferência de materiais"]').waitFor();assert.match(await page.locator('iframe').getAttribute('src'),/^https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ/);
 await page.getByRole('button',{name:'Registrar estudo concluído',exact:true}).click();await page.getByText('Estudo declarado em',{exact:false}).waitFor();await page.reload();await page.getByText('Estudo declarado em',{exact:false}).waitFor();
 for(const width of [1440,390]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 assert.deepEqual(errors,[]);console.log('Vídeo: cadastro, público RH, reprodução interna, registro, recarga e responsividade verificados.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
