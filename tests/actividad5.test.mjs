// Actividad 5 (reenfoque D, E, H, I): ruta de acción por actor de la lista confirmada.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import Rutas from '../public/rutas.js';
import {entorno,html,read,calificacion} from './embudo-support.mjs';

const actores=JSON.parse(read('../public/data/actores.json'));
const empresa=actores.find(a=>a.id==='mercados-ecopetrol-nacion-88-5');
const gremio=actores.find(a=>a.tipo==='gremio'&&a.propuesta_gh);
const completa=(extra={})=>({actorId:empresa.id,etiqueta:'venta_inmediata',responsable:'Diego Espejo',aporte:'Diagnóstico',accionesQ4:'Reunión',accionesQ1:'Propuesta',acciones2027:'Contrato marco',indicador:'Propuestas y cierres',...extra});

function conSeleccion(actorIds=[empresa.id,gremio.id]){
 const s=entorno();actorIds.forEach(id=>s.nivel1(id));
 s.bucket('seleccion').set('vigente',{actorIds,confirmadoPor:'Felipe Hillón',confirmadoEn:'2026-10-02T15:00:00Z',sorteoId:'s-1'});
 return s;
}

test('Rutas.validar: la etiqueta y el responsable son obligatorios',()=>{
 const sin=Rutas.validar(completa({etiqueta:''}),[empresa.id]);
 assert.equal(sin.ok,false);assert.match(sin.errores.etiqueta,/Venta inmediata/);
 assert.equal(Rutas.validar(completa({etiqueta:'otra'}),[empresa.id]).ok,false);
 assert.match(Rutas.validar(completa({responsable:'  '}),[empresa.id]).errores.responsable,/responsable/);
 assert.equal(Rutas.validar(completa(),[empresa.id]).ok,true);
});

test('Rutas.validar: solo actores de la lista confirmada y límites de texto',()=>{
 assert.match(Rutas.validar(completa(),['otro']).errores.actorId,/Tier 1 o 2/);
 assert.equal(Rutas.validar(completa({accionesQ4:'a'.repeat(2001)}),[empresa.id]).ok,false);
 assert.equal(Rutas.validar(completa({indicador:7}),[empresa.id]).ok,false);
 assert.equal(Rutas.validar(completa({responsable:'r'.repeat(121)}),[empresa.id]).ok,false);
});

test('Rutas.validar: las aristas solo se conservan con «Posicionamiento»',()=>{
 const aristas={marca:{activa:true,accion:'Webinar con el gremio'},leads:{activa:false,accion:'x'},inventada:{activa:true}};
 const venta=Rutas.validar(completa({aristas}),[empresa.id]);
 assert.equal(venta.ok,true);assert.deepEqual(venta.valor.aristas,{});
 const pos=Rutas.validar(completa({etiqueta:'posicionamiento',aristas}),[empresa.id]);
 assert.deepEqual(pos.valor.aristas,{marca:{activa:true,accion:'Webinar con el gremio'}});
});

test('Rutas.validar: guarda los tres horizontes recortados',()=>{
 const v=Rutas.validar(completa({accionesQ4:' Q4 ',accionesQ1:' Q1 ',acciones2027:' 2027 '}),[empresa.id]).valor;
 assert.deepEqual([v.accionesQ4,v.accionesQ1,v.acciones2027],['Q4','Q1','2027']);
});

test('Tarjeta de contexto: contacto de entrada en rojo con confianza, gremio con tema propuesto y escape de HTML',()=>{
 const h=Rutas.htmlContexto(empresa,{contactoInforme:{actor_id:empresa.id,nombre:'Ana <b>',cargo:'Presidenta',confianza:'baja'},contactos:[{nombre:'Luis',cargo:'VP',correo:'l@x.co'}]});
 assert.match(h,/class="p5-ctx-contacto"><strong>Ana &lt;b&gt;<\/strong>/);
 assert.match(h,/Confianza baja · por verificar/);
 assert.match(h,/Olivia tiene contratos marco activos/);
 assert.match(h,/Luis<\/strong> · VP<br>l@x.co/);
 assert.match(Rutas.htmlContexto(empresa,{}),/no sugiere contacto/);
 assert.match(Rutas.htmlContexto({...empresa,nombre:'x',contacto:'y'},{contactoInforme:{nombre:'Por identificar',cargo:'VP'}}),/Nombre por identificar/);
 const g=Rutas.htmlContexto(gremio,{});
 assert.match(g,/Tema de charla o taller/);assert.match(g,/Propuesta GH · por validar/);
 assert.doesNotMatch(Rutas.htmlContexto(empresa,{}),/Tema de charla/);
});

test('Ruta /api/rutas: sin actores en Nivel 1 responde 409; guarda, actualiza y lee',async()=>{
 const vacio=entorno();
 assert.equal((await vacio.req('rutas','PUT',completa())).status,409);
 const s=conSeleccion();
 let r=await s.req('rutas','PUT',{...completa(),editadoPor:'Diego Espejo'});
 assert.equal(r.status,200);assert.equal(r.data.id,empresa.id);assert.equal(r.data.acciones2027,'Contrato marco');assert.equal(r.data.editadoPor,'Diego Espejo');
 r=await s.req('rutas','PUT',completa({accionesQ1:'Piloto'}));
 assert.equal(s.bucket('rutas').size,1);assert.equal(s.bucket('rutas').get(empresa.id).accionesQ1,'Piloto');
 assert.equal((await s.req('rutas')).data.length,1);
});

test('Ruta /api/rutas: rechaza etiqueta faltante, actor fuera de la lista y métodos no permitidos',async()=>{
 const s=conSeleccion([empresa.id]);
 const sin=await s.req('rutas','PUT',completa({etiqueta:''}));
 assert.equal(sin.status,400);assert.ok(sin.data.errores.etiqueta);
 assert.equal((await s.req('rutas','PUT',completa({actorId:gremio.id}))).status,400);
 assert.equal((await s.req('rutas','DELETE',{})).status,405);
 assert.equal(s.bucket('rutas').size,0);
});

test('Ruta /api/rutas: con «Venta inmediata» no se guardan aristas',async()=>{
 const s=conSeleccion();
 await s.req('rutas','PUT',completa({aristas:{eventos:{activa:true,accion:'Congreso'}}}));
 assert.deepEqual(s.bucket('rutas').get(empresa.id).aristas,{});
 await s.req('rutas','PUT',completa({etiqueta:'posicionamiento',aristas:{eventos:{activa:true,accion:'Congreso'}}}));
 assert.equal(s.bucket('rutas').get(empresa.id).aristas.eventos.accion,'Congreso');
});

test('Hoja consolidada: filas en el orden confirmado, con aristas y vacíos',()=>{
 const filas=Rutas.filasHoja(['b','a'],[{actorId:'a',etiqueta:'posicionamiento',responsable:'Julio',aristas:{alianzas:{activa:true,accion:'ANDI'}}}],{a:'Actor A',b:'Actor B'});
 assert.equal(filas[0][0],'posicion');
 assert.deepEqual(filas[1].slice(0,4),[1,'Actor B','','']);
 assert.deepEqual(filas[2].slice(0,4),[2,'Actor A','Posicionamiento','Julio']);
 assert.match(filas[2].join('|'),/Alianzas: ANDI/);
});

test('Vista: la Actividad 5 usa la lista confirmada y la colección rutas, no el embudo viejo',()=>{
 const js=html.split('// ACTIVIDAD 5: INICIO JS')[1].split('// ACTIVIDAD 5: FIN JS')[0];
 assert.match(js,/\/api\/lista-rutas/);assert.match(js,/\/api\/rutas/);
 assert.doesNotMatch(js,/activacion-votos|Embudo\.elegibles|\/api\/canvas/);
 assert.match(html,/<script src="rutas\.js"><\/script>\s*<script src="ideas\.js"|<script src="rutas\.js"><\/script>/);
 assert.ok(html.indexOf('rutas.js')<html.indexOf('api-supabase.js'));
});

test('Paso automático: pasan todos los Tier 1–2, sin máximo y con no calificados',async()=>{
 const s=entorno();
 const ids=actores.filter(a=>a.tipo==='empresa').slice(0,40).map(a=>a.id);
 assert.deepEqual((await s.req('lista-rutas')).data,{actorIds:[],origen:'vacia',detalles:{}});
 ids.forEach(id=>{s.actor(id,'mercados',{nombre:actores.find(a=>a.id===id).nombre});s.nivel1(id,ids.indexOf(id)%2+1);});
 assert.equal((await s.req('priorizacion-votos','PUT',calificacion(ids[5],4,2))).status,200);
 await s.req('priorizacion-votos','PUT',calificacion(ids[7],5,4));
 const l=(await s.req('lista-rutas')).data;
 assert.equal(l.origen,'automatica');assert.equal(l.actorIds.length,40);
 assert.deepEqual(l.actorIds.slice(0,2),[ids[5],ids[7]]);
 // Permite guardar rutas tanto de calificados como de pendientes.
 assert.equal((await s.req('rutas','PUT',completa({actorId:ids[5]}))).status,200);
 assert.equal(l.detalles[ids[0]].cuadrante,'Interés futuro');
 const sinCalificar=ids[0];assert.equal((await s.req('rutas','PUT',completa({actorId:sinCalificar}))).status,200);
 s.nivel1(sinCalificar,3);assert(!(await s.req('lista-rutas')).data.actorIds.includes(sinCalificar));
});

test('Paso automático: la selección histórica se ignora',async()=>{
 const s=entorno();s.bucket('seleccion').set('vigente',{actorIds:[gremio.id],confirmadoPor:'Felipe Hillón'});
 s.nivel1(empresa.id);
 const l=(await s.req('lista-rutas')).data;
 assert.equal(l.origen,'automatica');assert.deepEqual(l.actorIds,[empresa.id]);assert.equal(s.bucket('seleccion').get('vigente').confirmadoPor,'Felipe Hillón');
 assert.equal((await s.req('rutas','PUT',completa())).status,200);
 assert.equal((await s.req('lista-rutas','PUT',{})).status,405);
});

test('Tarjeta de contexto: «Qué hace», «Por qué se priorizó» con el resultado del taller y necesidad en lenguaje claro',()=>{
 const h=Rutas.htmlContexto(empresa,{taller:{grupos:2,cuadrante:'Victorias tempranas',posicion:1}});
 assert.match(h,/<h4>Qué hace<\/h4>/);assert.match(h,/<h4>Por qué se priorizó<\/h4>/);
 assert.match(h,/En el taller: Ubicado por 2 grupos · cuadrante «Victorias tempranas» en la Actividad 4 · puesto 1 del orden sugerido\./);
 assert.ok(h.indexOf(empresa.necesidad.slice(0,40).replace(/[&<>"']/g,''))>0||h.includes('acaba de cambiar de presidente'));
 assert.match(Rutas.htmlContexto(empresa,{taller:{grupos:1,posicion:3}}),/Interés futuro en la Actividad 4/);
 assert.doesNotMatch(Rutas.htmlContexto(empresa,{}),/En el taller/);
});

test('Interés futuro: sin votos pasa automáticamente y admite ruta',async()=>{
 const s=entorno();s.actor(empresa.id);s.nivel1(empresa.id);
 assert.deepEqual((await s.req('lista-rutas')).data.actorIds,[empresa.id]);
 assert.equal((await s.req('seleccion','PUT',{actorIds:[empresa.id],confirmadoPor:'Felipe Hillón'})).status,405);
 const lista=(await s.req('lista-rutas')).data;
 assert.equal(lista.origen,'automatica');assert.deepEqual(lista.actorIds,[empresa.id]);assert.equal(lista.detalles[empresa.id].cuadrante,'Interés futuro');
 assert.equal((await s.req('rutas','PUT',completa())).status,200);
});

test('A5: selector busca entre 40 actores y conserva las diez rutas, incluso fuera del universo',async()=>{
 const {default:vm}=await import('node:vm');const {dom}=await import('./embudo-support.mjs');
 const s=entorno(),$=dom(s.context);
 for(let i=1;i<=40;i++){s.actor('cuenta'+i,'mercados',{nombre:'Cuenta '+String(i).padStart(2,'0'),sector:i%2?'Energía':'Retail'});s.nivel1('cuenta'+i,i%2+1);}
 for(let i=1;i<=10;i++)s.bucket('rutas').set('cuenta'+i,completa({actorId:'cuenta'+i,aporte:'Aporte guardado '+i}));
 s.nivel1('cuenta1',4);
 vm.runInContext(html.split('// ACTIVIDAD 5: INICIO JS')[1].split('// ACTIVIDAD 5: FIN JS')[0],s.context);
 $('view-canvas').handlers['vista:activar']();await new Promise(r=>setImmediate(r));
 // Diseño por Tier: la cuadrícula aparece al tocar la tarjeta del Tier (Tier 1 = pares, Tier 2 = impares salvo cuenta1, que bajó a Tier 4).
 assert.equal($('p5Lista').hidden,true);assert.match($('p5Tiers').innerHTML,/Tier 1: 20/);assert.match($('p5Tiers').innerHTML,/Tier 2: 19/);
 assert.match($('p5Editor').innerHTML,/Elige Tier 1 o Tier 2/);
 const tier=n=>$('p5Tiers').handlers.click({target:{closest:()=>({dataset:{p5Tier:String(n)}})}});
 tier(1);assert.equal($('p5Lista').hidden,false);assert.equal(($('p5Lista').innerHTML.match(/data-p5-actor=/g)||[]).length,20);assert.match($('p5Lista').innerHTML,/Tier 1 \(20\)/);assert.match($('p5Lista').innerHTML,/Ruta guardada/);
 tier(2);assert.equal(($('p5Lista').innerHTML.match(/data-p5-actor=/g)||[]).length,19);
 tier(2);assert.equal($('p5Lista').hidden,true);
 for(let i=2;i<=10;i++)assert($('p5Hoja').innerHTML.includes('Aporte guardado '+i));
 assert.match($('p5Historicos').innerHTML,/Cuenta 01/);assert.match($('p5Historicos').innerHTML,/Aporte guardado 1/);
 $('p5Buscar').value='Cuenta 39';$('p5Buscar').handlers.input();assert.equal(($('p5Lista').innerHTML.match(/data-p5-actor=/g)||[]).length,1);assert.match($('p5Lista').innerHTML,/Cuenta 39/);
 $('p5Buscar').value='Retail';$('p5Buscar').handlers.input();assert.equal(($('p5Lista').innerHTML.match(/data-p5-actor=/g)||[]).length,20);
 assert.equal(s.bucket('rutas').size,10);assert.match($('p5Hoja').innerHTML,/Ruta por construir/);
});
