// Sin red ni credenciales: el fetch nativo es un almacén Supabase simulado.
// Ejecutar: node --test tests/canvas.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const shim=read('../public/api-supabase.js'), html=read('../public/index.html');
const config=JSON.parse(read('../public/canvas-config.json'));
const criterios=JSON.parse(read('../public/priorizacion-criterios.json'));
const funcs=html.split('  // ACTIVIDAD 5: INICIO JS')[1].split('  (function iniciarCanvas(){')[0];
const ctx=vm.createContext({}); vm.runInContext(funcs,ctx);
const {canvasAliados,canvasRegla,canvasElegir,canvasOportunidades,canvasCSV}=ctx;
function entorno(){
 const db=new Map(), calls=[];
 const bucket=c=>{if(!db.has(c))db.set(c,new Map());return db.get(c);};
 const context=vm.createContext({Response,URL,console,location:{href:'https://local.invalid/'},window:{RADAR_CONFIG:{supabaseUrl:'https://supabase.invalid',supabaseAnonKey:'mock-only'},fetch:async(url,init={})=>{
  calls.push([url,init]);
  if(url==='canvas-config.json')return Response.json(config);
  if(url==='priorizacion-criterios.json')return Response.json(criterios);
  const u=new URL(url);assert.equal(u.origin,'https://supabase.invalid');assert.equal(u.pathname,'/rest/v1/registros');
  if(init.method==='POST'){const r=JSON.parse(init.body);bucket(r.coleccion).set(r.id,r.data);return new Response(null,{status:201});}
  const col=u.searchParams.get('coleccion').slice(3),id=u.searchParams.get('id')?.slice(3);
  if(init.method==='DELETE'){bucket(col).delete(id);return new Response(null,{status:204});}
  let rows=[...bucket(col)].filter(([k])=>id===undefined||id===k).map(([id,data])=>({id,data}));
  const range=init.headers.Range;if(range){const [a,b]=range.split('-').map(Number);rows=rows.slice(a,b+1);}
  return Response.json(rows);
 }}});
 vm.runInContext(shim,context);
 async function req(method='GET',body,route='canvas'){
  const r=await context.window.fetch('/api/'+route,{method,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json()};
 }
 bucket('matriz').set('m1',{id:'m1',cliente:'Cuenta Uno',sector:'Energía',necesidadCritica:'Problema',respuestaOlivia:'Oferta de H3',trigger:true});
 bucket('matriz').set('m2',{id:'m2',trigger:false});
 return {bucket,calls,req,context};
}
const body=(extra={})=>({id:'m1',matrizId:'m1',aliado:null,buyer:'Ana',sponsor:'Luis',cta:'Agendar reunión',ruta90:'Ruta manual',rutaAuto:false,editadoPor:' Ana ',...extra});
test('CRUD, copia de H3, un canvas por oportunidad, último guardado y DELETE',async()=>{
 const {req,bucket}=entorno();assert.deepEqual((await req()).data,[]);
 let r=await req('PUT',body({oferta:'No se puede cambiar desde H5',cliente:'Falso',updatedAt:'falso'}));
 assert.equal(r.status,200);assert.equal(r.data.oferta,'Oferta de H3');assert.equal(r.data.cliente,'Cuenta Uno');assert.equal(r.data.editadoPor,'Ana');assert.ok(Number.isFinite(Date.parse(r.data.updatedAt)));
 await req('PUT',body({editadoPor:'Pedro',buyer:'Comprador nuevo'}));
 assert.equal(bucket('canvas').size,1);assert.equal((await req()).data[0].buyer,'Comprador nuevo');assert.equal((await req()).data[0].editadoPor,'Pedro');
 assert.equal((await req('DELETE',{id:'m1'})).status,200);assert.deepEqual((await req()).data,[]);
});
test('Rechaza fila sin trigger, inexistente, nombre y longitudes inválidas, JSON y método',async()=>{
 const {req,bucket}=entorno();
 assert.equal((await req('PUT',body({id:'m2',matrizId:'m2'}))).status,400);
 assert.equal((await req('PUT',body({id:'ausente',matrizId:'ausente'}))).status,404);
 for(const b of [null,{},body({matrizId:'otro'}),body({editadoPor:' '}),body({editadoPor:'a'.repeat(61)}),body({buyer:'a'.repeat(301)}),body({sponsor:7}),body({cta:'a'.repeat(1001)}),body({ruta90:'a'.repeat(4001)}),body({rutaAuto:'true'}),body({aliado:{tipo:'otro'}}),body({aliado:{tipo:'gremio',id:'g',nombre:'G',promedio:4}}),body({aliado:{tipo:'actor',id:'a',nombre:'A'}})]) assert.equal((await req('PUT',b)).status,400,JSON.stringify(b));
 assert.equal((await req('PUT','{')).status,400);assert.equal((await req('POST',body())).status,405);assert.equal(bucket('canvas').size,0);
});
test('Sin triggers; igualdad exacta 2,5 excluida e inclusión configurable; votos válidos y gremios en vivo',()=>{
 assert.equal(canvasOportunidades([{trigger:false},{trigger:'true'},{}]).length,0);
 assert.equal(canvasOportunidades([{trigger:true}]).length,1);
 assert.equal(canvasAliados(config,[],[],[]).length,0);
 const gs=[{id:'g',nombre:'Fijo'},{id:'nuevo',nombre:'En vivo'},{id:'sin-votos',nombre:'Sin votos'}],vs=[{gremioId:'g',valor:2},{gremioId:'g',valor:3},{gremioId:'nuevo',valor:3},{gremioId:'nuevo',valor:8}];
 let lista=canvasAliados(config,[],gs,vs);assert.equal(lista.length,1);assert.equal(lista[0].id,'nuevo');assert.equal(lista[0].votos,1);
 lista=canvasAliados({...config,gremios:{umbral:2.5,estricto:false}},[],gs,vs);assert.equal(lista.length,2);assert.equal(lista.find(a=>a.id==='g').promedio,2.5);
});
test('Lista y rutas desde fetch simulado de Supabase, todos los cuadrantes y horizontes',async()=>{
 const {req,bucket}=entorno();
 const eje=(name,n)=>Object.fromEntries(criterios[name].map(c=>[c.id,n]));
 for(const [id,i,e] of [['a',3,2],['b',3,4],['c',2,2],['d',2,4]]){
  bucket('actors').set(id,{id,nombre:id,categoria:'aliados',estado:'verificado'});
  bucket('priorizacion-votos').set(id,{actorId:id,impacto:eje('impacto',i),esfuerzo:eje('esfuerzo',e)});
 }
 bucket('gremios-taller').set('g',{id:'g',nombre:'Gremio'});
 bucket('gremios-votos').set('g--ana',{gremioId:'g',votante:'Ana',valor:3});
 const lista=canvasAliados(config,(await req('GET',undefined,'priorizacion-votos?resumen=1')).data,(await req('GET',undefined,'gremios-taller')).data,(await req('GET',undefined,'gremios-votos')).data);
 assert.equal(lista.length,3);
 for(const a of lista){
  const d=canvasElegir(config,body({rutaAuto:true,ruta90:''}),a),regla=canvasRegla(config,a);
  assert.equal(d.ruta90,regla.texto);
  const r=await req('PUT',d);assert.equal(r.status,200);assert.equal(r.data.horizonte,a.id==='b'?'60–90':'30');
 }
 const manual=canvasElegir(config,body({rutaAuto:false,ruta90:'No sobrescribir'}),lista[0]);assert.equal(manual.ruta90,'No sobrescribir');
 assert.equal(canvasElegir(config,manual,lista[1]).ruta90,'No sobrescribir');
 assert.equal(canvasElegir(config,body({rutaAuto:true}),null).ruta90,'');assert.equal(canvasRegla(config,null),null);
});
test('CSV con BOM, todas las celdas protegidas, comillas y saltos',()=>{
 const csv=canvasCSV([['=1+1',' +CMD','@SUM','-2','"texto"','Línea\n2',null]]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"\' +CMD"'));assert.ok(csv.includes('"\'@SUM"'));assert.ok(csv.includes('"\'-2"'));assert.ok(csv.includes('"""texto"""'));assert.ok(csv.includes('"Línea\n2"'));
});
test('GET pagina más de 1000 canvas',async()=>{
 const {req,bucket}=entorno();for(let i=0;i<1002;i++)bucket('canvas').set(String(i),{id:String(i)});
 assert.equal((await req()).data.length,1002);
});
test('Actividades previas y Radar: igualdad exacta con respaldo al retirar solo las adiciones H5',{skip:!existsSync(new URL('../../Radar360-web-backups/index_20260924_pre-actividad5.html',import.meta.url))},()=>{
 const original=read('../../Radar360-web-backups/index_20260924_pre-actividad5.html');
 const sinH5=html.replace(/\/\* ACTIVIDAD 5: INICIO CSS \*\/[\s\S]*?\/\* ACTIVIDAD 5: FIN CSS \*\/\n/,'').replace(/<!-- ACTIVIDAD 5: INICIO HTML -->[\s\S]*?<!-- ACTIVIDAD 5: FIN HTML -->\n/,'').replace(/  \/\/ ACTIVIDAD 5: INICIO JS[\s\S]*?  \/\/ ACTIVIDAD 5: FIN JS\n\n/,'').replace('      <button data-view="canvas">De cuenta priorizada a oportunidad comercial</button>\n','');
 assert.equal(sinH5,original);
});
test('Vista H5 con DOM mínimo: carga, estado vacío, edición manual, guardado y borrador durante sondeo',async()=>{
 const {context,bucket}=entorno();bucket('matriz').get('m1').trigger=false;
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},handlers:{},addEventListener(t,fn){this.handlers[t]=fn;},classList:{contains:()=>true},contains:()=>false,focus(){}});return elements.get(id);};
 const nav=element('nav');
 context.document={getElementById:element,querySelector:()=>nav,activeElement:null};
 context.fetch=context.window.fetch;context.localStorage={getItem(){throw Error('Bloqueado');},setItem(){throw Error('Bloqueado');}};
 context.setInterval=()=>0;context.setTimeout=fn=>fn();context.GREMIOS_32=[];context.POLL_MS=6000;
 context.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 context.getLogo=()=>'';context.openActorDialog=()=>{};const toasts=[];context.showToast=m=>toasts.push(m);
 const code=html.split('  // ACTIVIDAD 5: INICIO JS')[1].split('  // ACTIVIDAD 5: FIN JS')[0];
 vm.runInContext(code,context);
 await nav.handlers.click();await new Promise(r=>setImmediate(r));
 assert.match(element('p5Tarjetas').innerHTML,/Trigger → H5/);assert.match(element('p5AliadosAviso').textContent,/no hay aliados/);
 bucket('matriz').get('m1').trigger=true;await element('p5Reintentar').onclick();
 assert.match(element('p5Tarjetas').innerHTML,/Cuenta Uno/);assert.match(element('p5Tarjetas').innerHTML,/Oferta de H3/);
 const card={dataset:{id:'m1'},querySelector:element};
 const fieldEvent=(field,value)=>({target:{dataset:{field},value,closest:()=>card}});
 element('p5Tarjetas').handlers.input(fieldEvent('buyer','Buyer local'));
 element('p5Tarjetas').handlers.input(fieldEvent('ruta90','Ruta manual'));
 bucket('matriz').get('m1').sector='Sector actualizado por otro participante';
 await element('p5Reintentar').onclick();
 assert.match(element('p5Tarjetas').innerHTML,/Sector actualizado por otro participante/);assert.match(element('p5Tarjetas').innerHTML,/Buyer local/);assert.match(element('p5Tarjetas').innerHTML,/Ruta manual/);
 element('p5Nombre').value='Laura';element('p5Nombre').oninput();
 const button={dataset:{action:'guardar'},closest:()=>card};
 await element('p5Tarjetas').handlers.click({target:{closest:()=>button}});
 assert.equal(bucket('canvas').get('m1').ruta90,'Ruta manual');assert.equal(bucket('canvas').get('m1').rutaAuto,false);assert.equal(bucket('canvas').get('m1').editadoPor,'Laura');
 assert.match(element('p5Hoja').innerHTML,/Guardado por Laura/);assert.match(element('p5Tarjetas').innerHTML,/Guardado por Laura/);assert.equal(toasts.at(-1),'Canvas guardado.');
});
