import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {ejecutar,validar} from '../supabase/aplicar_radar09.mjs';
import {html,read,entorno,dom,Embudo,gremios,calificacion} from './embudo-support.mjs';
const patches=JSON.parse(read('../supabase/patches_radar09_20260925.json'));
const manifest=JSON.parse(read('../supabase/radar09-base.json'));
const validarParches=p=>validar(p,manifest);
const base=JSON.parse(read('../../Radar360-web-backups/supabase_20260925_pre-radar09.json'));
const original=new Map(base.filter(r=>r.coleccion==='actors').map(r=>[r.id,r.data]));
const orderCode=html.slice(html.indexOf('  var SECTOR_ORDER ='),html.indexOf('  var GENERIC_LOGO ='));
const content=html.split('// RADAR09: INICIO CONTENIDO')[1].split('// RADAR09: FIN CONTENIDO')[0];
const expected=['Financiero','Energía','Servicios públicos','Minero','Retail','Consumo','Industrial','Telecomunicaciones','Salud'];
const forbidden=/días|Tello|Barrientos|por identificar|confianza|vía |interlocutor|contacto/iu;

test('Radar09: orden compartido, nueve fichas y cuatro frentes citados',()=>{
 const ctx=vm.createContext({});vm.runInContext(orderCode+content,ctx);
 assert.deepEqual(Array.from(ctx.SECTOR_ORDER.mercados),expected);
 assert.deepEqual(Array.from(ctx.sortedSectorKeys('mercados',[...expected].reverse())),expected);
 assert.deepEqual(Array.from(ctx.sortedSectorKeys('mercados',['Zulu','Minero','Otro'])),['Minero','Otro','Zulu']);
 const fichas=vm.runInContext('SECTOR_FICHAS',ctx);
 assert.deepEqual(Object.keys(fichas),expected);
 for(const ficha of Object.values(fichas)){assert.match(ficha.fuente,/informe v1.2/i);assert(ficha.estado.length && ficha.priorizacion.length);}
 assert(!forbidden.test(content));
});
test('Radar09: 48 registros completos preservados y siete altas mineras válidas',()=>{
 validarParches(patches,base);
 const counts={},sectorChanges=[];
 for(const {id,data:a} of patches){
  counts[a.sector]=(counts[a.sector]||0)+1;
  const old=original.get(id);
  if(old){
   assert.equal(a.id,old.id);assert.equal(a.nombre,old.nombre);
   assert.equal(Embudo.normalizar(a.nombre),Embudo.normalizar(old.nombre));
   for(const key of Object.keys(old))if(key!=='sector')assert.deepEqual(a[key],old[key],id+'.'+key);
   if(a.sector!==old.sector)sectorChanges.push(id);
  }else{
   assert.equal(a.sector,'Minero');assert(['verificado','por_validar'].includes(a.estado));
   for(const k of ['nombre','queHace','relevancia','justificacion'])assert(!forbidden.test(a[k]),id+'.'+k);
  }
  assert(!forbidden.test(a.articulacion),id);
  // Dos o tres frases completas; no se divide por abreviaturas corporativas del nombre.
  assert(a.articulacion.split(/\.(?:\s|$)/u).filter(x=>x.trim()).length>=2,id);
  assert(a.articulacion.split(/\.(?:\s|$)/u).filter(x=>x.trim()).length<=3,id);
 }
 assert.deepEqual(counts,{'Industrial':10,'Financiero':10,'Retail':6,'Consumo':4,'Energía':5,'Telecomunicaciones':3,'Salud':5,'Servicios públicos':5,'Minero':7});
 assert.equal(sectorChanges.length,9);
 assert(!patches.some(r=>r.id==='mercados-ds-consulting-mu4dp0a9-43bv'));
 const matriz=base.filter(r=>r.coleccion==='matriz').map(r=>r.data);
 for(const {id,data} of patches.filter(r=>original.has(r.id)))assert.deepEqual(Embudo.contexto(data,matriz,gremios),Embudo.contexto(original.get(id),matriz,gremios));
 for(const key of ['nombre','id','justificacion','queHace','relevancia','createdAt']){
  const bad=structuredClone(patches);delete bad[0].data[key];assert.throws(()=>validarParches(bad,base));
 }
});
test('Radar09: Actividad 3 agrupa los datos parcheados y activa mineras sin fila en Matriz',async()=>{
 const s=entorno(base);for(const r of patches)s.bucket('actors').set(r.id,structuredClone(r.data));
 const $=dom(s.context);vm.runInContext(orderCode,s.context);
 vm.runInContext(html.split('// ACTIVIDAD 3 EMBUDO: INICIO JS')[1].split('// ACTIVIDAD 3 EMBUDO: FIN JS')[0],s.context);
 await $('view-matriz').handlers['vista:activar']();await new Promise(r=>setImmediate(r));
 const output=$('a3Cards-empresas').innerHTML;
 const sectors=[...output.matchAll(/class="sector-title">([^<]+)</g)].map(m=>m[1]);assert.deepEqual(sectors,expected);
 for(const {data:a} of patches){
  const section=output.split('<h3 class="sector-title">'+a.sector+'</h3>')[1].split('</section>')[0];
  assert(section.includes(a.nombre),a.id);
 }
 assert.match(output,/<dt>Sector<\/dt><dd>Servicios públicos<\/dd>/);
 for(const {id} of patches.filter(r=>r.data.sector==='Minero')){
  assert.equal((await s.activar(id)).status,200);
  assert.equal((await s.req('priorizacion-votos','PUT',calificacion(id))).status,200);
 }
});
test('Radar09: diálogo muestra tercer bloque solo para mercados, escapa HTML y conserva cierre',()=>{
 const s=entorno(),$=dom(s.context),dlg=$('actorDialog');dlg.showModal=()=>{dlg.open=true;};dlg.close=()=>{dlg.open=false;};
 s.context.currentActors=()=>Object.fromEntries(s.bucket('actors'));
 s.context.CATS={mercados:{label:'Mercados'},aliados:{label:'Aliados'}};
 s.context.CONF={media:{label:'Media'}};
 const code=html.slice(html.indexOf('  function openActorDialog(id)'),html.indexOf('  document.getElementById("actorDialog").addEventListener("click"'));
 vm.runInContext(code,s.context);
 s.actor('m','mercados',{queHace:'Hace',relevancia:'Relevante',articulacion:'<img src=x onerror=alert(1)>'});
 s.context.openActorDialog('m');assert.equal(dlg.open,true);
 assert(dlg.innerHTML.indexOf('Qué hace')<dlg.innerHTML.indexOf('Relevancia para Olivia'));
 assert(dlg.innerHTML.indexOf('Relevancia para Olivia')<dlg.innerHTML.indexOf('Necesidad y posibilidad'));
 assert.match(dlg.innerHTML,/&lt;img/);assert(!dlg.innerHTML.includes('<img src=x'));
 dlg.querySelector('[data-close]').handlers.click();assert.equal(dlg.open,false);
 s.actor('a','aliados',{descripcion:'Aliado',confianza:'media',articulacion:'NO MOSTRAR'});s.context.openActorDialog('a');assert(!dlg.innerHTML.includes('NO MOSTRAR'));
 s.actor('m2','mercados',{queHace:'Hace',relevancia:'Relevante'});s.context.openActorDialog('m2');assert.match(dlg.innerHTML,/Sin información de articulación registrada/);
});
test('Radar09: sin panel de contexto regional en el Radar (retirado; queda como anexo del informe)',()=>{
 function el(){return {innerHTML:'',textContent:'',children:[],appendChild(c){this.children.push(c);},setAttribute(){},addEventListener(){}};}
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);};
 const ctx=vm.createContext({document:{getElementById:get,createElement:el},currentActors:()=>Object.fromEntries(patches.map(r=>[r.id,r.data])),activeCategory:'mercados',CAT_ORDER:['mercados'],CATS:{mercados:{label:'Mercados'}},GENERIC_LOGO_BY_CAT:{mercados:''},makeCard:a=>({id:a.id}),renderGapNote:()=>{},esc:s=>s,openSectorDialog(){}});
 vm.runInContext(orderCode+content+html.slice(html.indexOf('  function radarVisible'),html.indexOf('  var SECTOR_ORDER =')),ctx);
 ctx.renderRadar();assert(!get('drawerBody').children.some(c=>c.className==='radar-contexto'));assert(!html.includes('Contexto regional y sectorial'));
 get('drawerBody').children=[];ctx.activeCategory=null;ctx.renderRadar();assert.equal(get('drawer').hidden,true);
 ctx.activeCategory='aliados';ctx.CATS.aliados={label:'Aliados'};ctx.renderRadar();assert(!get('drawerBody').children.some(c=>c.className==='radar-contexto'));
});
const config={supabaseUrl:'https://supabase.invalid',supabaseAnonKey:'mock'};
test('Radar09: simulación no llama red',async()=>{
 const logs=[];await ejecutar({patches,base:manifest,config,log:s=>logs.push(s),fetchImpl:()=>{throw Error('No debe usar red');}});
 assert.match(logs[0],/sin solicitudes de red/);assert.match(logs.at(-1),/48 existentes \+ 7 nuevos/);
});
test('Radar09: aplicación REST explícita, prevalidación e idempotencia (red simulada)',async()=>{
 const calls=[];
 await ejecutar({patches,base:manifest,config,aplicar:true,log(){},fetchImpl:async(url,init)=>{
  calls.push({url,init});
  return init.method==='POST'?new Response(null,{status:201}):Response.json(base.filter(r=>r.coleccion==='actors'));
 }});
 assert.equal(calls.length,2);assert.equal(calls[0].url.searchParams.get('select'),'id,data');assert.equal(calls[1].init.method,'POST');
 assert.deepEqual(JSON.parse(calls[1].init.body),patches);assert.match(calls[1].init.headers.Prefer,/resolution=merge-duplicates/);
 let n=0;await ejecutar({patches,base:manifest,config,aplicar:true,log(){},fetchImpl:async()=>{n++;return Response.json(patches);}});assert.equal(n,1);
 const changed=structuredClone(base.filter(r=>r.coleccion==='actors'));changed.find(r=>r.id===patches[0].id).data.nombre='Cambio posterior';
 await assert.rejects(()=>ejecutar({patches,base:manifest,config,aplicar:true,log(){},fetchImpl:async(url,init)=>{assert.notEqual(init.method,'POST');return Response.json(changed);}}),/Conflicto con cambios posteriores/);
});
test('Radar09: todos los scripts inline tienen sintaxis válida',()=>{
 for(const [,attrs,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!attrs.includes('src=') && !attrs.includes('application/json'))new vm.Script(body);
});
