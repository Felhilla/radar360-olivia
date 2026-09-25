// Validación visual opcional, SIN RED: sitio, Supabase y cambios viven en memoria.
// PUPPETEER_MODULE=/ruta/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node tests/embudo.browser.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {entorno,read,Embudo} from './embudo-support.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const seed=JSON.parse(read('../../Radar360-web-backups/supabase_20260925_pre-radar09.json'));
const patches=JSON.parse(read('../supabase/patches_radar09_20260925.json'));
const mock=entorno(seed), empresa=seed.find(r=>r.coleccion==='actors'&&Embudo.grupo(r.data)==='empresas').id, aliado='aliados-andesco';
for(const r of patches)mock.bucket('actors').set(r.id,r.data);
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--no-first-run','--disable-sync']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1440,height:1000});
 await page.setRequestInterception(true);
 page.on('request',async r=>{
  const u=new URL(r.url());
  try{
   if(u.origin==='https://supabase.invalid'){
    if(r.method()==='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS'}});
    const headers=r.headers();headers.Range=headers.range;
    const res=await mock.context.window.fetch(r.url(),{method:r.method(),headers,body:r.postData()});
    return r.respond({status:res.status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*',...Object.fromEntries(res.headers)},body:await res.text()});
   }
   if(u.origin!=='http://ruta.test')return r.abort();
   if(u.pathname==='/config.js')return r.respond({status:200,contentType:'application/javascript',body:'window.RADAR_CONFIG={supabaseUrl:"https://supabase.invalid",supabaseAnonKey:"mock-only"};'});
   if(u.pathname==='/marco')return r.respond({status:200,contentType:'text/html',body:'<iframe title="Sitio a 390 px" style="border:0;width:390px;height:900px" src="/#actividad-3"></iframe>'});
   const path=u.pathname==='/'?'index.html':u.pathname.slice(1),body=await readFile(new URL('../public/'+path,import.meta.url));
   const type={js:'application/javascript',json:'application/json',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpeg:'image/jpeg',jpg:'image/jpeg',html:'text/html'}[path.split('.').pop()]||'application/octet-stream';
   return r.respond({status:200,contentType:type,body});
  }catch(e){return r.respond({status:404,body:String(e)});}
 });
 await page.goto('http://ruta.test/#actividad-2');
 await page.waitForSelector('#boardGrid .cat-mercados');
 await page.click('#boardGrid .cat-mercados');
 await page.waitForSelector('#drawerBody .radar-contexto');
 assert.equal(await page.$$eval('#drawerBody .sector-block',els=>els.length),9);
 assert.equal(await page.$$eval('#drawerBody .radar-contexto article',els=>els.length),4);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  await page.screenshot({path:'/tmp/radar09-'+theme+'.png',fullPage:true});
 }
 await page.evaluate(()=>Array.from(document.querySelectorAll('#drawerBody button')).find(el=>el.textContent.includes('Minero')).click());
 await page.waitForSelector('#sectorDialog[open]');
 assert.match(await page.$eval('#sectorDialog',el=>el.textContent),/PENDIENTE DE CONFIRMAR/);
 await page.click('#sectorDialog [data-close]');
 await page.evaluate(()=>Array.from(document.querySelectorAll('#drawerBody .actor-card')).find(el=>el.textContent.includes('Grupo Coquecol')).click());
 await page.waitForSelector('#actorDialog[open]');
 assert.match(await page.$eval('#actorDialog',el=>el.textContent),/Necesidad y posibilidad/);
 assert.match(await page.$eval('#actorDialog',el=>el.textContent),/PENDIENTE DE CONFIRMAR/);
 await page.screenshot({path:'/tmp/radar09-actor.png',fullPage:true});
 await page.click('#actorDialog [data-close]');
 await page.setViewport({width:390,height:844});
 for(const theme of ['light','dark']){
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert(dims.scroll<=dims.width,JSON.stringify(dims));
  await page.screenshot({path:'/tmp/radar09-mobile-'+theme+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('Radar09 navegador: cuatro frentes, nueve sectores, diálogos, claro/oscuro, móvil; sin errores JS. Red interceptada.');
}finally{await browser.close();}
