import {readFileSync} from 'node:fs';
// Ejemplos de facilitador: lo que registran Julio, Germán y Felipe se ve solo en su pantalla, con la etiqueta
// «Ad. Facilitador», y nunca llega a Supabase ni a los resultados del taller (corte, Actividad 5, CSV, informe).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import Rutas from '../public/rutas.js';
import {entorno,read,calificacion} from './embudo-support.mjs';

const actores=JSON.parse(read('../public/data/actores.json'));
const asistentes=JSON.parse(read('../public/asistentes-config.json'));
const empresa=actores.find(a=>a.id==='mercados-ecopetrol-nacion-88-5');
const ruta=(extra={})=>({actorId:empresa.id,etiqueta:'venta_inmediata',responsable:'Diego Espejo',aporte:'Diagnóstico',accionesQ4:'Reunión',accionesQ1:'Propuesta',acciones2027:'Contrato',indicador:'Cierres',...extra});
const como=(s,rol)=>{s.context.window.Identidad=rol?{nombre:rol==='administrador'?'Germán Hillón':'Diego Espejo',rol}:null;};

test('Responsables: los facilitadores no son elegibles, ni escritos a mano',()=>{
 const f={facilitadores:asistentes.administradores};
 for(const nombre of ['Julio Ochoa','Germán Hillón','felipe hillon','Germán'.concat(' Hillon'),'J. Ochoa'])
  assert.match(Rutas.validar(ruta({responsable:nombre}),[empresa.id],f).errores.responsable,/facilitadores/,nombre);
 // Comparten nombre de pila con facilitadores, pero no apellido: sí son elegibles.
 for(const nombre of ['Luis Felipe Barrientos','Diego Espejo','Julio César Pérez'])assert.equal(Rutas.validar(ruta({responsable:nombre}),[empresa.id],f).ok,true,nombre);
 assert(!asistentes.participantes.some(n=>asistentes.administradores.includes(n)));
 const html=read('../public/index.html');
 assert.match(html,/responsables=cfg\?\(cfg\.participantes\|\|\[\]\)\.filter\(n=>!\(cfg\.noResponsables\|\|\[\]\)\.includes\(n\)\):responsables;/);
 const cfgA=JSON.parse(readFileSync(new URL('../public/asistentes-config.json',import.meta.url),'utf8'));
 assert.deepEqual(cfgA.noResponsables,['Luis Felipe Barrientos','Hernan Tello']);
 assert(cfgA.noResponsables.every(n=>cfgA.participantes.includes(n)),'siguen pudiendo entrar al sitio');
});

test('Ideas y contactos del facilitador: etiquetados, visibles solo para él y fuera de la base',async()=>{
 const s=entorno();como(s,'administrador');
 const idea=(await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto:'Ejemplo de respuesta'})).data.sticker;
 assert.equal(idea.facilitador,true);assert.equal(s.bucket('ideas').size,0);
 const contacto=(await s.req('contactos','POST',{actorId:empresa.id,registradoPor:'Germán Hillón',nombre:'Ana Pérez',cargo:'VP Talento'})).data;
 assert.equal(contacto.facilitador,true);assert.equal(s.bucket('contactos').size,0);
 assert.equal((await s.req('ideas')).data.stickers.length,1);
 assert.equal((await s.req('contactos?actorId='+empresa.id)).data.length,1);
 // Un participante no ve los ejemplos y sus registros sí van a la base.
 como(s,'participante');
 assert.equal((await s.req('ideas')).data.stickers.length,0);
 assert.equal((await s.req('contactos')).data.length,0);
 await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto:'Respuesta real'});
 assert.equal(s.bucket('ideas').size,1);
 // El facilitador puede borrar su ejemplo sin tocar la base.
 como(s,'administrador');
 assert.equal((await s.req('ideas','DELETE',{id:idea.id})).status,200);
 assert.equal((await s.req('contactos?id='+encodeURIComponent(contacto.id),'DELETE')).status,200);
 assert.deepEqual([(await s.req('ideas')).data.stickers.length,s.bucket('ideas').size],[1,1]);
});

test('Calificación del facilitador: se ve en su lista, no entra al resumen ni al corte',async()=>{
 const s=entorno();s.actor(empresa.id);s.nivel1(empresa.id);como(s,'administrador');
 const r=await s.req('priorizacion-votos','PUT',{...calificacion(empresa.id),votante:'Germán Hillón'});
 assert.equal(r.status,200);assert.equal(r.data.facilitador,true);assert.equal(s.bucket('priorizacion-votos').size,0);
 assert.equal((await s.req('priorizacion-votos')).data.length,1);
 assert.deepEqual((await s.req('priorizacion-votos?resumen=1')).data,[]);
 const lista=(await s.req('lista-rutas')).data;assert.equal(lista.detalles[empresa.id].calificaciones,0);
});

test('Ruta del facilitador: ejemplo propio, la del grupo sigue intacta y la hoja usa solo la del grupo',async()=>{
 const s=entorno();s.bucket('seleccion').set('vigente',{actorIds:[empresa.id],confirmadoPor:'Felipe Hillón',confirmadoEn:'2026-10-07T15:00:00Z',sorteoId:'s-1'});
 como(s,'participante');assert.equal((await s.req('rutas','PUT',{...ruta(),editadoPor:'Diego Espejo'})).status,200);
 como(s,'administrador');
 assert.equal((await s.req('rutas','PUT',ruta({responsable:'Julio Ochoa'}))).status,400);
 const ej=(await s.req('rutas','PUT',{...ruta({aporte:'Ejemplo'}),editadoPor:'Germán Hillón'})).data;
 assert.equal(ej.facilitador,true);assert.equal(s.bucket('rutas').get(empresa.id).aporte,'Diagnóstico');
 const todas=(await s.req('rutas')).data;assert.equal(todas.length,2);
 const hoja=Rutas.filasHoja([empresa.id],todas,{[empresa.id]:'Ecopetrol'});
 assert(hoja[1].includes('Diagnóstico'));
 assert(!hoja[1].includes('Ejemplo'));
 como(s,'participante');assert.equal((await s.req('rutas')).data.length,1);
});

test('Interfaz: etiqueta «Ad. Facilitador», avisos por rol y exclusión en nubes, CSV e informe',()=>{
 const html=read('../public/index.html'),informe=read('../public/informe.js');
 assert.match(html,/Ad\. Facilitador/);assert.match(html,/data-solo-facilitador/);
 assert.match(html,/return s\.horizonte === hz && !s\.facilitador;/);
 assert.match(html,/!v\.borrador&&!v\.facilitador/);
 assert.match(informe,/filter\(r => !r\.facilitador\)/);
 assert.match(read('../public/rutas.js'),/x\.actorId===id && !x\.facilitador/);
});

test('Ejemplos compartidos: visibles para todos en /api/ejemplos y fuera del Nivel 1, el corte, la A5 y las listas',async()=>{
 const s=entorno(),ej={facilitador:true,ejemploCompartido:true};s.actor(empresa.id);
 s.bucket('parejas').set('ejemplo-facilitador',{id:'s-ej',grupos:[{id:'s-ej-g1',integrantes:['Ana','Luis'],industrias:['energia']}],iniciado:true,...ej});
 s.bucket('tierlist').set('s-ej-g1:'+empresa.id,{sorteoId:'s-ej',grupoId:'s-ej-g1',actorId:empresa.id,nivel:1,editadoPor:'Julio Ochoa',...ej});
 s.bucket('priorizacion-votos').set(empresa.id+'--julio-ochoa',{...calificacion(empresa.id),votante:'Julio Ochoa',...ej});
 s.bucket('rutas').set('ejemplo-facilitador:'+empresa.id,{...ruta(),id:'ejemplo-facilitador:'+empresa.id,editadoPor:'Julio Ochoa',...ej});
 como(s,'participante');
 const v=(await s.req('ejemplos')).data;
 assert.deepEqual([v.sorteo.id,v.tierlist.length,v.votos.length,v.rutas.length],['s-ej',1,1,1]);
 assert.equal((await s.req('parejas')).data,null);
 for(const r of ['tierlist','rutas','priorizacion-votos','priorizacion-votos?resumen=1'])assert.deepEqual((await s.req(r)).data,[],r);
 assert.deepEqual((await s.req('lista-rutas')).data.actorIds,[]);
 assert.match(read('../public/index.html'),/data-ejemplo-compartido="a3"[\s\S]*data-ejemplo-compartido="a4"|data-ejemplo-compartido="a4"[\s\S]*data-ejemplo-compartido="a3"/);
});
