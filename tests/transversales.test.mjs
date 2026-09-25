// Plan 10: disclaimer, filtro de entrada, identidad en Actividades 3 y 4, informe PDF y validaciones de seguridad.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {entorno,dom,html,read,config,canvasConfig,criterios} from './embudo-support.mjs';
import Embudo from '../public/embudo.js';
import Ideas from '../public/ideas.js';
const require=createRequire(import.meta.url);
const Asistentes=require('../public/asistentes.js');
const Informe=require('../public/informe.js');
const asistentes=JSON.parse(read('../public/asistentes-config.json'));

test('Transversales: lista de asistentes completa y sin ambigüedades',()=>{
 assert.equal(asistentes.participantes.length,7);assert.deepEqual(asistentes.administradores,['Germán Hillón','Felipe Hillón','Julio Ochoa']);
 assert.deepEqual(Asistentes.ambiguedades(asistentes),[]);
});
test('Transversales: coincidencia de 2 palabras sin tildes ni mayúsculas',()=>{
 const id=n=>Asistentes.identificar(n,asistentes);
 assert.deepEqual(id('felipe hillon').persona,{nombre:'Felipe Hillón',rol:'administrador'});
 assert.equal(id('GERMÁN HILLON').persona.nombre,'Germán Hillón');
 assert.equal(id('Hernán Tello García').persona.rol,'participante');
 assert.equal(id('Luis Barrientos').persona.nombre,'Luis Felipe Barrientos');
 assert.equal(id('Angela de Urbano').persona.nombre,'Angela Urbano');
 assert.equal(id('Felipe').motivo,'corto');assert.equal(id('Hillón').motivo,'corto');
 assert.equal(id('Juan Pérez').motivo,'ninguna');assert.equal(id('Felipe Ramos').motivo,'ninguna');
 assert.equal(id('Felipe Hillón Barrientos').motivo,'ambigua');
});
test('Transversales: disclaimer definitivo en el pie y celda de acciones como celda de tabla',()=>{
 assert.match(html,/<footer class="credit">&copy; La información contenida en Ruta Colombia - Olivia es propiedad intelectual de GH Estudio[\s\S]*?de manera indebida\.<\/footer>/);
 assert(!/\.row-actions\{[^}]*display:flex/.test(html.replace(/\s/g,'')));
 assert.match(html,/<body class="sin-acceso">/);
});
test('Transversales: Actividades 3 y 4 toman el nombre validado y no se edita',async()=>{
 for(const [inicio,fin,campo,vista] of [['// ACTIVIDAD 3 EMBUDO: INICIO JS','// ACTIVIDAD 3 EMBUDO: FIN JS','a3Nombre','view-matriz'],['// ACTIVIDAD 4: INICIO JS','// ACTIVIDAD 4: FIN JS','p4Nombre','view-priorizacion']]){
  const s=entorno();s.actor('e');const $=dom(s.context);s.context.window.Identidad={nombre:'Diana Ramos',rol:'participante'};
  vm.runInContext(html.split(inicio)[1].split(fin)[0],s.context);
  await $(vista).handlers['vista:activar']();await new Promise(r=>setImmediate(r));
  assert.equal($(campo).value,'Diana Ramos');assert.equal($(campo).readOnly,true);
 }
});
test('Transversales: PATCH de actores solo acepta campos editables y valores válidos',async()=>{
 const s=entorno();s.actor('m1','mercados',{confianza:'media'});
 assert.equal((await s.req('actors','PATCH',{id:'m1',patch:{categoria:'x" onmouseover="alert(1)'}})).status,400);
 assert.equal((await s.req('actors','PATCH',{id:'m1',patch:{estado:'raro'}})).status,400);
 assert.equal((await s.req('actors','PATCH',{id:'m1',patch:{createdAt:'x'}})).status,400);
 assert.equal((await s.req('actors','PATCH',{id:'m1',patch:{nombre:''}})).status,400);
 const ok=await s.req('actors','PATCH',{id:'m1',patch:{estado:'descartado',mostrarEnRadar:false,sector:'Minero'}});
 assert.equal(ok.status,200);assert.equal(s.bucket('actors').get('m1').estado,'descartado');
 assert.equal((await s.req('actors','POST',{nombre:'Nuevo',categoria:'aliados',confianza:'total'})).status,400);
});
test('Transversales: al leer actores se descartan categorías inválidas y se normalizan confianza y estado',()=>{
 const bloque=html.match(/list\.forEach\(function\(a\)\{\n\s*if\(!a \|\|[\s\S]*?next\[a\.id\] = a;\n\s*\}\);/)[0];
 const ctx=vm.createContext({next:{},list:[{id:'a',nombre:'A',categoria:'mercados',confianza:'x',estado:'y'},{id:'b',nombre:'B',categoria:'x"><img>'},{nombre:'sin id',categoria:'mercados'}],
  CATS:{mercados:{}},CONF:{por_identificar:{}},EST:{por_validar:{}}});
 vm.runInContext(bloque,ctx);
 assert.deepEqual(Object.keys(ctx.next),['a']);assert.equal(ctx.next.a.confianza,'por_identificar');assert.equal(ctx.next.a.estado,'por_validar');
});
test('Transversales: informe PDF reúne las 5 actividades con datos en vivo',async()=>{
 const actores=[{id:'m1',nombre:'Empresa Uno',categoria:'mercados',sector:'Financiero',estado:'verificado'},{id:'a1',nombre:'Gremio Uno',categoria:'aliados',sector:'Prioridad alta',estado:'verificado'},{id:'d1',nombre:'Descartado',categoria:'mercados',estado:'descartado'}];
 const votos=[{actorId:'m1',grupo:'empresas',votante:'Diana Ramos',valor:2},{actorId:'a1',grupo:'aliados',votante:'Diana Ramos',valor:2}];
 const resumen=[{actorId:'m1',nombre:'Empresa Uno',categoria:'mercados',indiceImpacto:4,indiceEsfuerzo:2,cuadrante:{id:'victorias-tempranas',nombre:'Victorias tempranas'},votos:1},{actorId:'a1',nombre:'Gremio Uno',categoria:'aliados',indiceImpacto:2,indiceEsfuerzo:4,cuadrante:{id:'racionalizacion',nombre:'Racionalización'},votos:1}];
 const R={'/api/actors':actores,'/api/ideas':{stickers:[{horizonte:'corto',texto:'Clientes y clientes en Colombia'}]},'/api/activacion-votos':votos,'embudo-config.json':config,
  '/api/priorizacion-votos?resumen=1':resumen,'priorizacion-criterios.json':criterios,'/api/canvas':[{id:'empresa:m1',actorId:'m1',grupo:'empresas',acciones30:'Reunión'}],'canvas-config.json':canvasConfig};
 const d=await Informe.recopilar(async u=>{assert(u in R,u);return R[u];},{Embudo,Ideas});
 assert.equal(d.a1[0].palabras[0].palabra,'clientes');assert.equal(d.a1[0].palabras[0].frecuencia,2);
 assert.equal(d.a2.find(c=>c.id==='mercados').total,1);
 assert.deepEqual(d.a3.map(g=>g.actores.map(a=>a.nombre)),[['Empresa Uno'],['Gremio Uno']]);
 assert.deepEqual(d.a4.priorizados.map(r=>r.nombre),['Empresa Uno','Gremio Uno']);
 assert.equal(d.a5[1].fichas[0].ficha.acciones30,'Reunión');assert.equal(d.a5[0].fichas.length,0);
 const textos=[];class Falso{constructor(){this.internal={pageSize:{getWidth:()=>595,getHeight:()=>842},getNumberOfPages:()=>1};}
  text(t){textos.push(Array.isArray(t)?t.join(' '):t);}splitTextToSize(t){return [t];}getTextWidth(t){return t.length*5;}}
 for(const m of ['setFont','setFontSize','setTextColor','setDrawColor','setLineWidth','line','addPage','setPage','setFillColor','rect','circle','setLineDashPattern'])Falso.prototype[m]=function(){return this;};
 Informe.generar(d,Falso);const todo=textos.join('\n');
 for(const t of ['Ruta Colombia - Olivia','propiedad intelectual de GH Estudio','Alinear el juego','Radar 360','Empresa Uno','Victorias tempranas','Acciones a 30 días: Reunión'])assert(todo.includes(t),t);
 assert.match(Informe.nombreArchivo(new Date('2026-10-06T12:00:00Z')),/^Ruta-Colombia-Olivia_informe_2026-10-06\.pdf$/);
});
