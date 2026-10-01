// Actividad 5 (reenfoque D, E, H, I): ruta de acción por actor de la lista confirmada.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import Rutas from '../public/rutas.js';
import {entorno,html,read} from './embudo-support.mjs';

const actores=JSON.parse(read('../public/data/actores.json'));
const empresa=actores.find(a=>a.id==='mercados-ecopetrol-nacion-88-5');
const gremio=actores.find(a=>a.tipo==='gremio'&&a.propuesta_gh);
const completa=(extra={})=>({actorId:empresa.id,etiqueta:'venta_inmediata',responsable:'Diego Espejo',aporte:'Diagnóstico',accionesQ4:'Reunión',accionesQ1:'Propuesta',acciones2027:'Contrato marco',indicador:'Propuestas y cierres',...extra});

function conSeleccion(actorIds=[empresa.id,gremio.id]){
 const s=entorno();
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
 assert.match(Rutas.validar(completa(),['otro']).errores.actorId,/lista confirmada/);
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

test('Ruta /api/rutas: sin lista confirmada responde 409; guarda, actualiza y lee',async()=>{
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
 assert.match(js,/\/api\/seleccion/);assert.match(js,/\/api\/rutas/);
 assert.doesNotMatch(js,/activacion-votos|Embudo\.elegibles|\/api\/canvas/);
 assert.match(html,/<script src="rutas\.js"><\/script>\s*<script src="ideas\.js"|<script src="rutas\.js"><\/script>/);
 assert.ok(html.indexOf('rutas.js')<html.indexOf('api-supabase.js'));
});
