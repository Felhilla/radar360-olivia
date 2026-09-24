// Navegador local sin red: todas las solicitudes se resuelven desde disco o mocks.
// PUPPETEER_MODULE=/ruta/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node tests/landing.browser.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--no-first-run']});
try{
 const page=await browser.newPage(), errors=[], calls=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  const url=new URL(request.url());
  // Nunca se permite continuar una solicitud hacia una red real.
  if(url.origin!=='http://ruta.test')return request.abort();
  const path=url.pathname;
  if(path==='/config.js'||path==='/api-supabase.js')return request.respond({status:200,contentType:'application/javascript',body:''});
  if(path.startsWith('/api/')){calls.push(path);return request.respond({status:200,contentType:'application/json',body:'[]'});}
  try{
   const body=await readFile(new URL('../public/'+(path==='/'?'index.html':path.slice(1)),import.meta.url));
   const ext=path.split('.').pop();
   await request.respond({status:200,contentType:({'json':'application/json','js':'application/javascript','png':'image/png','jpeg':'image/jpeg','svg':'image/svg+xml'}[ext]||'text/html'),body});
  }catch{await request.respond({status:404,body:''});}
 });
 const views=['inicio','ideas','radar','matriz','priorizacion','canvas'];
 const ready=()=>page.waitForFunction(()=>document.querySelectorAll('#rutaEnlaces a').length===6);
 async function check(i){
  assert.equal(await page.$eval('section.view.active',el=>el.id),'view-'+views[i]);
  assert.equal(new URL(page.url()).hash,i?'#actividad-'+i:'#inicio');
  assert.equal(await page.$eval('[aria-current="page"]',el=>el.dataset.view),views[i]);
 }
 await page.setViewport({width:1440,height:1000});
 await page.goto('http://ruta.test/');await ready();await check(0);
 assert(!calls.includes('/api/canvas'));assert(!calls.some(x=>x.includes('priorizacion')));
 for(let i=1;i<=5;i++){await page.click('#rutaEnlaces [data-view="'+views[i]+'"]');await check(i);}
 await page.waitForFunction(()=>document.getElementById('p5Estado').textContent.includes('Actualizado'));
 assert(calls.includes('/api/canvas'));assert(calls.some(x=>x.includes('priorizacion-votos')));
 for(let i=4;i>=0;i--){await page.click('#rutaAnterior');await check(i);}
 assert(await page.$eval('#rutaAnterior',el=>el.disabled));
 for(let i=1;i<=5;i++){await page.click('#rutaSiguiente');await check(i);}
 assert(await page.$eval('#rutaSiguiente',el=>el.disabled));
 await page.goBack();await check(4);await page.goForward();await check(5);
 await page.evaluate(()=>{location.hash='#actividad-2';});await page.waitForFunction(()=>document.querySelector('section.view.active').id==='view-radar');await check(2);
 await page.goto('http://ruta.test/#actividad-5');await ready();await check(5);
 await page.goto('http://ruta.test/#actividad-4');await ready();await check(4);
 await page.goto('http://ruta.test/#desconocido');await ready();await check(0);
 await page.click('#landingContenido [data-view="canvas"]');await check(5);
 await page.setViewport({width:390,height:844});
 for(let i=0;i<=5;i++){
  await page.select('#rutaSelector',views[i]);await check(i);
  assert(await page.$eval('.ruta-nav',el=>el.getBoundingClientRect().right<=390 && el.scrollWidth<=el.clientWidth),'barra sin desborde '+views[i]);
  if(i===0)assert(await page.evaluate(()=>document.documentElement.scrollWidth<=390),'landing sin desborde');
 }
 await page.select('#rutaSelector','inicio');
 await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
 await page.screenshot({path:'/tmp/olivia-landing-mobile.png',fullPage:true});
 await page.setViewport({width:1440,height:1000});
 await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'light'}]);
 await page.screenshot({path:'/tmp/olivia-landing-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('OK: inicio, seis accesos, anterior/siguiente, hash, historial, enlaces directos, cargas 4/5, 390 px y modo oscuro. Todas las solicitudes interceptadas localmente.');
}finally{await browser.close();}
