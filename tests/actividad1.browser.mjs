// Validación visual opcional, SIN RED: sitio, Supabase y cambios viven en memoria.
// PUPPETEER_MODULE=/ruta/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node tests/embudo.browser.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {entorno,read,Embudo} from './embudo-support.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const mock=entorno([{coleccion:'ideas',id:'antigua',data:{id:'antigua',horizonte:'corto',texto:'Innovación alianzas',createdAt:'2026-01-01'}}]);
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
   if(u.pathname==='/marco')return r.respond({status:200,contentType:'text/html',body:'<iframe title="Sitio a 390 px" style="border:0;width:390px;height:900px" src="/#actividad-1"></iframe>'});
   const path=u.pathname==='/'?'index.html':u.pathname.slice(1),body=await readFile(new URL('../public/'+path,import.meta.url));
   const type={js:'application/javascript',json:'application/json',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpeg:'image/jpeg',jpg:'image/jpeg',html:'text/html'}[path.split('.').pop()]||'application/octet-stream';
   return r.respond({status:200,contentType:type,body});
  }catch(e){return r.respond({status:404,body:String(e)});}
 });
 await page.goto('http://ruta.test/#actividad-1');
 await page.waitForSelector('#ideasBody-corto-sin-pregunta .idea-chip');
 assert.equal(await page.$$eval('.idea-input',xs=>xs.length),15);
 await page.type('#idea-corto-1','Innovación innovación');
 await page.keyboard.press('Enter');
 await page.waitForSelector('#ideasBody-corto-1 .idea-chip');
 assert.equal([...mock.bucket('ideas').values()].find(r=>r.preguntaId)?.preguntaId,'corto-1');
 assert.equal(await page.$$eval('#ideasBody-corto-2 .idea-chip',xs=>xs.length),0);
 await page.click('[data-subview="ideas-resultados"]');
 await page.waitForFunction(()=>document.getElementById('ideasNube-corto').textContent.includes('innovación: 3'));
 assert.match(await page.$eval('#ideasNube-medio',el=>el.textContent),/Aún no hay respuestas/);
 // Simula una respuesta de otro participante; el polling debe actualizar Resultados.
 mock.bucket('ideas').set('remota',{id:'remota',horizonte:'corto',preguntaId:'corto-2',texto:'Innovación'});
 await page.waitForFunction(()=>document.getElementById('ideasNube-corto').textContent.includes('innovación: 4'),{timeout:20000});
 await page.click('[data-subview="ideas-corto"]');
 await page.type('#idea-corto-2','Borrador conservado');
 mock.bucket('ideas').set('remota2',{id:'remota2',horizonte:'corto',preguntaId:'corto-2',texto:'Mercados'});
 await page.waitForFunction(()=>document.getElementById('ideasBody-corto-2').textContent.includes('Mercados'),{timeout:20000});
 assert.equal(await page.$eval('#idea-corto-2',el=>el.value),'Borrador conservado');
 await page.click('#ideasBody-corto-1 .idea-del');
 await page.waitForFunction(()=>!document.querySelector('#ideasBody-corto-1 .idea-chip'));
 await page.goto('http://ruta.test/marco');
 const frame=await (await page.waitForSelector('iframe')).contentFrame();
 await frame.waitForSelector('#ideasBody-corto-sin-pregunta .idea-chip');
 // Una palabra larga debe caber; el resto permite verificar colisiones.
 mock.bucket('ideas').set('larga',{id:'larga',horizonte:'largo',preguntaId:'largo-1',texto:'Internacionalización '.repeat(8)+'a'.repeat(35)});
 for(const theme of ['light','dark']){
  await frame.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  for(const tab of ['ideas-corto','ideas-medio','ideas-largo','ideas-resultados']){
   await frame.click('[data-subview="'+tab+'"]');
   if(tab==='ideas-resultados')await frame.waitForSelector('#ideasNube-largo .ideas-nube span');
   const size=await frame.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.equal(size.width,390);assert(size.scroll<=390,JSON.stringify({tab,theme,...size}));
  }
  const overlaps=await frame.$$eval('.ideas-nube',clouds=>clouds.some(cloud=>{
   const boxes=[...cloud.children].map(el=>el.getBoundingClientRect());
   return boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
  }));
  assert.equal(overlaps,false);
  await page.screenshot({path:'/tmp/actividad1-390-'+theme+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 assert(!mock.calls.some(([url])=>String(url).includes('ideas-sintesis')));
 console.log('Actividad 1: guardado, aislamiento, borrado, legado, polling, borrador, nubes, 390 px y temas claro/oscuro OK. Sin red externa.');
}finally{await browser.close();}
