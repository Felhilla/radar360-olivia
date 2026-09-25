import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import Ideas from '../public/ideas.js';
import {entorno,html} from './embudo-support.mjs';

test('Guardado independiente de las 15 preguntas, lectura y borrado en Supabase simulado',async()=>{
 const s=entorno();
 for(const [horizonte,ps] of Object.entries(Ideas.preguntas))for(const p of ps){
  const r=await s.req('ideas','POST',{horizonte,preguntaId:p.id,texto:'  Acceso a mercados  '});
  assert.equal(r.status,201);assert.equal(r.data.sticker.preguntaId,p.id);assert.equal(r.data.sticker.texto,'Acceso a mercados');
  assert.deepEqual(Object.keys(r.data.sticker),['id','horizonte','preguntaId','texto','createdAt']);
 }
 const rows=(await s.req('ideas')).data.stickers;
 assert.equal(rows.length,15);assert.equal(new Set(rows.map(r=>r.preguntaId)).size,15);
 assert.equal((await s.req('ideas','DELETE',{id:rows[0].id})).status,200);
 assert.equal((await s.req('ideas')).data.stickers.length,14);
});
test('preguntaId obligatorio, conocido y correspondiente al horizonte; no escribe al rechazar',async()=>{
 const s=entorno();
 for(const preguntaId of [undefined,null,1,{},'','corto-5','medio-1','__proto__']){
  const r=await s.req('ideas','POST',{horizonte:'corto',preguntaId,texto:'Mercado'});
  assert.equal(r.status,400);assert.equal(r.data.error,'invalid_preguntaId');
 }
 assert.equal(s.calls.length,0);
 assert.equal((await s.req('ideas','POST',{horizonte:'otro',preguntaId:'corto-1',texto:'Mercado'})).status,400);
 for(const texto of ['', ' '.repeat(2), 'x'.repeat(201)])assert.equal((await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto})).status,400);
});
test('Nube: puntuación, tildes, forma más frecuente, vacías, límite y Olivia configurable',()=>{
 const rs=[{texto:'La innovación, INNOVACION e innovación; alianzas y alianzas. Olivia ha sido nuestra aliada.'}];
 assert.deepEqual(Ideas.contar(rs),[{palabra:'innovación',frecuencia:3},{palabra:'alianzas',frecuencia:2},{palabra:'aliada',frecuencia:1}]);
 assert(Ideas.contar(rs,{excluirOlivia:false}).some(p=>p.palabra==='olivia'));
 assert.equal(Ideas.contar(rs,{maxPalabras:1}).length,1);
 assert.deepEqual(Ideas.contar([{texto:Ideas.palabrasVacias.join(' ')}]),[]);
 assert.deepEqual(Ideas.contar([]),[]);
 assert.deepEqual(Ideas.contar([{texto:'innovacio\u0301n innovación'}]),[{palabra:'innovación',frecuencia:2}]);
 const many=Array.from({length:60},(_,i)=>({texto:'palabra'+String.fromCharCode(97+Math.floor(i/26),97+i%26)}));
 assert.equal(Ideas.contar(many).length,40);
});
test('Registros antiguos sin preguntaId siguen disponibles, cuentan en la nube y se pueden borrar',async()=>{
 const old={id:'antigua',horizonte:'corto',texto:'Alianzas alianzas',createdAt:'2026-01-01'};
 const s=entorno([{coleccion:'ideas',id:old.id,data:old}]);
 await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-2',texto:'Alianzas mercado'});
 const rs=(await s.req('ideas')).data.stickers;
 assert.deepEqual(rs.find(r=>r.id===old.id),old);
 assert.equal(Ideas.preguntaValida('corto',old.preguntaId),false);
 assert.deepEqual(Ideas.contar(rs),[{palabra:'alianzas',frecuencia:3},{palabra:'mercado',frecuencia:1}]);
 assert.equal((await s.req('ideas','DELETE',{id:old.id})).status,200);
});
test('Sintaxis de todos los scripts incrustados y retiro completo de síntesis',()=>{
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!m[1].includes('src='))new vm.Script(m[2]);
 assert(!/fetchSintesis|saveSintesis|ideas-sintesis|sintesis-input/.test(html));
 assert.match(html,/data-subview="ideas-resultados"/);
 assert(html.indexOf('src="ideas.js"')<html.indexOf('src="api-supabase.js"'));
 assert.deepEqual(Object.values(Ideas.preguntas).map(ps=>ps.length),[4,6,5]);
});

test('Vista: respuestas por pregunta, legado, guardado, actualización sin perder borradores y borrado',async()=>{
 const s=entorno([{coleccion:'ideas',id:'vieja',data:{id:'vieja',horizonte:'corto',texto:'Alianzas'}}]);
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},children:[],handlers:{},addEventListener(t,f){this.handlers[t]=f;},setAttribute(){},appendChild(e){this.children.push(e);},focus(){}});
  return elements.get(id);
 };
 Object.assign(s.context,{
  document:{getElementById:element,querySelector:element,querySelectorAll:()=>[],createElement:()=>({children:[],setAttribute(){},addEventListener(t,f){this[t]=f;},appendChild(e){this.children.push(e);}})},
  fetch:s.context.window.fetch,esc:s=>String(s).replaceAll('<','&lt;'),showToast:()=>{}
 });
 vm.runInContext(html.split('// ---------------- lluvia de ideas ----------------')[1].split('// ACTIVIDAD 3 EMBUDO: INICIO JS')[0],s.context);
 await element('view-ideas').handlers['vista:activar']();
 await new Promise(r=>setImmediate(r));
 assert.equal(element('ideasAntiguas-corto').hidden,false);
 assert.match(element('ideasNube-corto').innerHTML,/alianzas: 1/);
 const input=element('idea-corto-1');input.value='Innovación';
 await s.context.addIdea('corto','corto-1',input);
 assert.equal(input.value,'');assert.equal(input.disabled,false);
 assert.equal(element('ideasBody-corto-1').children.at(-1).children[0].textContent,'Innovación');
 assert.match(element('ideasBody-corto-2').innerHTML,/Aún no hay respuestas/);
 input.value='Mi borrador';
 s.bucket('ideas').set('remota',{id:'remota',horizonte:'corto',preguntaId:'corto-2',texto:'Innovación'});
 await s.context.fetchIdeas(true);
 assert.equal(input.value,'Mi borrador');assert.match(element('ideasNube-corto').innerHTML,/innovación: 2/);
 await s.context.deleteIdea('vieja');assert.equal(element('ideasAntiguas-corto').hidden,true);
 assert(!s.calls.some(([url])=>String(url).includes('ideas-sintesis')));
 // Error de guardado: conserva el texto y habilita de nuevo el campo.
 s.context.fetch=async()=>Response.json({error:'simulado'},{status:500});
 await s.context.addIdea('corto','corto-1',input);
 assert.equal(input.value,'Mi borrador');assert.equal(input.disabled,false);
});
