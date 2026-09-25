// Validación visual opcional, SIN RED: sitio, Supabase y cambios viven en memoria.
// PUPPETEER_MODULE=/ruta/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node tests/embudo.browser.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {entorno,read,Embudo} from './embudo-support.mjs';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const seed=JSON.parse(read('../../Radar360-web-backups/supabase_20260925_pre-embudo.json'));
const mock=entorno(seed), empresa=seed.find(r=>r.coleccion==='actors'&&Embudo.grupo(r.data)==='empresas').id, aliado='aliados-andesco';
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
 await page.goto('http://ruta.test/#actividad-3');
 await page.waitForFunction(()=>document.getElementById('a3Estado').textContent.startsWith('Actualizado'));
 assert.equal(await page.$$eval('#view-matriz > nav button',xs=>xs.length),4);
 await page.type('#a3Nombre','Prueba local');
 await page.click('[data-activar="'+empresa+'"][data-valor="2"]');
 await page.waitForFunction(()=>document.getElementById('a3Estado').textContent==='Voto guardado.');
 await page.click('[data-subview="a3-aliados"]');
 await page.click('[data-activar="'+aliado+'"][data-valor="2"]');
 await page.waitForFunction(()=>document.getElementById('a3Estado').textContent==='Voto guardado.');
 await page.click('#rutaEnlaces [data-view="priorizacion"]');
 await page.waitForSelector('[data-actor="'+empresa+'"]');
 await page.type('#p4Nombre','Prueba local');
 for(const id of [empresa,aliado]){
  await page.click('[data-actor="'+id+'"]');
  await page.evaluate(()=>{for(const el of document.querySelectorAll('#p4Formulario input[type=radio]'))if(Number(el.value)===(el.dataset.eje==='impacto'?4:2))el.click();});
  await page.click('#p4Formulario button[value="guardar"]');
  await page.waitForFunction(id=>document.querySelector('[data-actor="'+id+'"] small').textContent.includes('Ya calificado'),{},id);
 }
 await page.click('#rutaEnlaces [data-view="canvas"]');
 await page.waitForSelector('[data-id="aliado:'+aliado+'"]');
 await page.type('[data-field="aporteOlivia"]','Facilitación grupal');
 for(const [field,value] of [['acciones30','Reunión'],['acciones60','Piloto'],['acciones90','Evaluar']])await page.type('#p5Tarjetas-aliados [data-field="'+field+'"]',value);
 await page.click('#p5Tarjetas-aliados [data-guardar]');
 await page.waitForFunction(()=>document.getElementById('p5Estado').textContent.startsWith('Ficha guardada'));
 await page.click('[data-subview="p5-empresas"]');
 await page.select('#p5Tarjetas-empresas [data-field="aliado"]',aliado);
 await page.type('#p5Tarjetas-empresas [data-field="acciones30"]','Presentar oferta');
 await page.click('#p5Tarjetas-empresas [data-guardar]');
 await page.waitForFunction(()=>document.getElementById('p5Estado').textContent.startsWith('Ficha guardada'));
 assert.equal(mock.bucket('canvas').size,2);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  await page.screenshot({path:'/tmp/olivia-embudo-'+theme+'.png',fullPage:true});
 }
 // Iframe: ancho real 390 px, independiente del mínimo headless de 500 px.
 await page.goto('http://ruta.test/marco');
 const frame=await (await page.waitForSelector('iframe')).contentFrame();
 await frame.waitForSelector('#a3Cards-empresas article');
 for(const theme of ['light','dark']){
  await frame.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  for(const [vista,tabs] of [['matriz',['a3-empresas','a3-empresas-activadas','a3-aliados','a3-aliados-activados']],['priorizacion',['p4-calificar','p4-matriz']],['canvas',['p5-aliados','p5-empresas']]]){
   await frame.select('#rutaSelector',vista);
   for(const tab of tabs){
    await frame.click('[data-subview="'+tab+'"]');
    const size=await frame.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.equal(size.width,390);assert(size.scroll<=390,JSON.stringify({vista,tab,theme,...size}));
   }
  }
  await page.screenshot({path:'/tmp/olivia-embudo-390-'+theme+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('OK: recorrido 3 → 4 → 5, guardado grupal, temas e iframe de 390 px. Sin red real.');
}finally{await browser.close();}
