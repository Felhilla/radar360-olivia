import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import Corte from '../public/corte.js';
import TierList from '../public/tierlist.js';
import {entorno,dom,html,criterios,calificacion} from './embudo-support.mjs';
const corte=criterios.corte;
const tick=()=>new Promise(r=>setImmediate(r));
function universo(n=15){
 const s=entorno();
 for(let i=1;i<=n;i++){const id='a'+i;s.actor(id,'mercados',{nombre:'Actor '+String(i).padStart(2,'0')});s.nivel1(id);}
 return s;
}
test('Nivel 1 vigente: sin sorteo, nivel 2, sorteos viejos y grupos repetidos',async()=>{
 const s=entorno();s.actor('a');s.actor('b');s.actor('c');
 const sorteo={id:'actual',grupos:[{id:'g1'},{id:'g2'}]};
 const filas=[{actorId:'a',grupoId:'g1',sorteoId:'actual',nivel:1},{actorId:'a',grupoId:'g2',sorteoId:'actual',nivel:1},{actorId:'b',grupoId:'g1',sorteoId:'actual',nivel:2},{actorId:'c',grupoId:'g1',sorteoId:'viejo',nivel:1}];
 filas.push({...filas[0]});filas.forEach((f,i)=>s.bucket('tierlist').set('f'+i,f));
 assert.deepEqual(TierList.nivel1(null,filas),[]);
 assert.equal((await s.req('priorizacion-votos','PUT',calificacion('a'))).status,400);
 s.bucket('parejas').set('vigente',sorteo);
 assert.deepEqual(TierList.nivel1(sorteo,filas),[{actorId:'a',grupos:['g1','g2']}]);
 for(const id of ['b','c']){
  const r=await s.req('priorizacion-votos','PUT',calificacion(id));assert.equal(r.status,400);assert.equal(r.data.error,'El actor no está en el Nivel 1 de la Actividad 3.');
  s.bucket('priorizacion-votos').set(id,calificacion(id));
 }
 assert.equal((await s.req('priorizacion-votos','PUT',calificacion('a'))).status,200);
 assert.deepEqual((await s.req('priorizacion-votos?resumen=1')).data.map(r=>r.actorId),['a']);
 assert(!s.calls.some(([u])=>u.includes('activacion-votos')||u.includes('embudo-config')));
 s.bucket('parejas').set('vigente',{id:'nuevo',grupos:[{id:'g1'}]});
 assert.deepEqual((await s.req('priorizacion-votos?resumen=1')).data,[]);
});
test('Corte.ordenar: cuadrante, impacto, esfuerzo, grupos, nombre y sin calificar al final; sin mutar',()=>{
 const fila=(id,q=0,i=4,e=2,nombre=id)=>({actorId:id,nombre,cuadrante:{id:corte.ordenCuadrantes[q]},indiceImpacto:i,indiceEsfuerzo:e,votos:1});
 const filas=[fila('r',3,5,1),fila('m',2,5,1),fila('a',1,5,1),fila('b',0,4,2,'Beta'),fila('z',0,4,2,'Zeta'),fila('g',0,4,2,'Gamma'),fila('i',0,5,5),fila('e',0,4,1),{actorId:'u',nombre:'Alfa',votos:0},{actorId:'v',nombre:'Zeta',votos:0}];
 const antes=structuredClone(filas),grupos={g:['1','2','2'],b:['1'],z:['1']};
 const orden=Corte.ordenar(filas.reverse(),corte,grupos);
 assert.deepEqual(orden.map(r=>r.actorId),['i','e','g','b','z','a','m','r','u','v']);
 assert.equal(orden[2].grupos,2);assert(orden.slice(-2).every(r=>r.sinCalificar));
 assert.deepEqual(filas.reverse(),antes);
});
for(const n of [12,15])test('Propuesta de '+n+' calificados: máximo 10, sin incluir no calificados',()=>{
 const filas=Array.from({length:n},(_,i)=>({actorId:String(i),votos:1,sinCalificar:false}));
 const propuesta=Corte.propuesta([{actorId:'sin',votos:0,sinCalificar:true},...filas],corte);
 assert.deepEqual(propuesta,filas.slice(0,10));assert.equal(Corte.propuesta([],corte).length,0);
});
test('Selección pura: vacía, 10, 11, duplicados y ajenos al universo',()=>{
 const ids=Array.from({length:15},(_,i)=>'a'+i);
 for(const valor of [[],ids.slice(0,10)])assert(Corte.validarSeleccion(valor,ids,corte).ok);
 for(const valor of [null,ids.slice(0,11),['a1','a1'],['otro']])assert(!Corte.validarSeleccion(valor,ids,corte).ok);
});
test('Ruta seleccion: validación, persistencia ordenada, metadatos, lectura, borrado y métodos',async()=>{
 const s=universo(),ids=[...s.bucket('actors').keys()],put=(actorIds,confirmadoPor='Ana')=>s.req('seleccion','PUT',{actorIds,confirmadoPor});
 assert.equal((await s.req('seleccion')).data,null);
 for(const seleccion of [ids.slice(0,11),['a1','a1'],['ajeno'],null])assert.equal((await put(seleccion)).status,400);
 for(const nombre of ['', ' ', 'a'.repeat(81),null,42])assert.equal((await put([],nombre)).status,400);
 const orden=ids.slice(0,10).reverse(),r=await put(orden,'A'.repeat(80));
 assert.equal(r.status,200);assert.deepEqual(r.data.actorIds,orden);assert.equal(r.data.sorteoId,'actual');assert.equal(r.data.confirmadoPor.length,80);assert(Number.isFinite(Date.parse(r.data.confirmadoEn)));
 assert.deepEqual((await s.req('seleccion')).data,r.data);
 assert.equal((await put(ids.slice(0,11))).status,400);assert.deepEqual((await s.req('seleccion')).data,r.data);
 s.nivel1('a1',2);assert.equal((await put(['a1'])).status,400);
 assert.equal((await put([])).status,200);assert.deepEqual((await s.req('seleccion')).data.actorIds,[]);
 for(const m of ['POST','PATCH'])assert.equal((await s.req('seleccion',m,{})).status,405);
 assert.equal((await s.req('seleccion','DELETE')).status,200);assert.equal((await s.req('seleccion')).data,null);
});
function vista(s,rol='administrador'){
 const $=dom(s.context),timers=[];s.context.window.Identidad={nombre:'Ana',rol};
 s.context.setInterval=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
 vm.runInContext(html.split('// ACTIVIDAD 4: INICIO JS')[1].split('// ACTIVIDAD 4: FIN JS')[0],s.context);
 const cargar=async()=>{$('view-priorizacion').handlers['vista:activar']();await tick();};
 const editar=async(accion,id,contenedor='p4CorteFilas')=>{$(contenedor).onclick({target:{closest:q=>q==='[data-corte]'?{dataset:{corte:accion,id}}:null}});await tick();};
 return {$,timers,cargar,editar};
}
test('Vista: sin universo oculta formulario; grupos, ficha, participantes y sondeo de 10 s',async()=>{
 const s=entorno(),v=vista(s,'participante'),{$}=v;
 await v.cargar();assert.match($('p4Actores').innerHTML,/Todavía no hay actores en el Nivel 1 de la Actividad 3\./);assert.equal($('p4Editor').hidden,true);
 s.actor('a');s.nivel1('a');s.bucket('parejas').get('vigente').grupos.push({id:'g2'});s.bucket('tierlist').set('g2',{actorId:'a',sorteoId:'actual',grupoId:'g2',nivel:1});
 await v.cargar();assert.match($('p4Actores').innerHTML,/Elegido por 2 grupos/);assert.equal($('p4Editor').hidden,false);assert.match($('p4CorteFilas').innerHTML,/Sin calificar/);
 assert.equal($('p4CorteAdmin').hidden,true);assert(!$('p4CorteFilas').innerHTML.includes('>Agregar<'));
 $('p4Proponer').onclick();$('p4Confirmar').onclick();await tick();assert.equal(s.bucket('seleccion').size,0);
 let ficha;s.context.window.abrirFichaActor=id=>ficha=id;
 $('p4CorteFilas').onclick({target:{closest:q=>q==='[data-ficha]'?{dataset:{ficha:'a'}}:null}});assert.equal(ficha,'a');
 const timer=v.timers.find(t=>t.ms===10000);assert(timer);
 s.nivel1('a',2);s.bucket('tierlist').delete('g2');await timer.fn();await tick();assert.equal($('p4Editor').hidden,true);
 const calls=s.calls.length;$('view-priorizacion').classList.contains=()=>false;await timer.fn();assert.equal(s.calls.length,calls);
});
test('Vista administrador: propuesta, límite, edición, confirmaciones internas, errores y CSV',async()=>{
 const s=universo(12);for(const id of s.bucket('actors').keys())await s.req('priorizacion-votos','PUT',calificacion(id));
 const v=vista(s),{$}=v;await v.cargar();
 const tabla=$('p4CorteFilas').innerHTML;assert(tabla.indexOf('Corte: máximo 10')>tabla.indexOf('Actor 10'));assert(tabla.indexOf('Corte: máximo 10')<tabla.indexOf('Actor 11'));
 $('p4Proponer').onclick();assert.equal(($('p4Borrador').innerHTML.match(/<li>/g)||[]).length,10);assert.match($('p4CorteFilas').innerHTML,/disabled title="La lista admite máximo 10 actores"/);
 await v.editar('Agregar','a11');assert.equal(($('p4Borrador').innerHTML.match(/<li>/g)||[]).length,10);
 await v.editar('Subir','a2','p4Borrador');await v.editar('Bajar','a2','p4Borrador');await v.editar('Quitar','a1','p4Borrador');await v.editar('Agregar','a11');
 $('p4Confirmar').onclick();await tick();const primera=(await s.req('seleccion')).data;
 assert.deepEqual(primera.actorIds,['a2','a3','a4','a5','a6','a7','a8','a9','a10','a11']);assert.match($('p4Confirmada').innerHTML,/Lista confirmada para la Actividad 5/);assert.match($('p4Confirmada').innerHTML,/Ana/);
 let blob;const FakeURL=class extends URL{};FakeURL.createObjectURL=b=>{blob=b;return 'blob:local';};FakeURL.revokeObjectURL=()=>{};s.context.URL=FakeURL;s.context.Blob=Blob;s.context.document.body={appendChild(){}};$('new').click=()=>{};$('new').remove=()=>{};
 $('p4CorteCSV').onclick();assert.match(await blob.text(),/En la lista confirmada/);assert.match(await blob.text(),/"Actor 02";.*;"Sí"/);
 $('p4Proponer').onclick();$('p4Confirmar').onclick();assert.equal($('p4Confirmacion').hidden,false);assert.deepEqual((await s.req('seleccion')).data,primera);
 $('p4Cancelar').onclick();assert.equal($('p4Confirmacion').hidden,true);
 $('p4Confirmar').onclick();$('p4Aceptar').onclick();await tick();assert.equal((await s.req('seleccion')).data.actorIds[0],'a1');
 s.nivel1('a1',2);await v.cargar();assert.equal($('p4Confirmar').disabled,true);assert.match($('p4Validacion').textContent,/Nivel 1/);
 $('p4QuitarConfirmacion').onclick();assert.equal($('p4Confirmacion').hidden,false);assert((await s.req('seleccion')).data);
 const fetch=s.context.fetch;s.context.fetch=async()=>Response.json({error:'fallo al borrar'},{status:500});$('p4Aceptar').onclick();await tick();assert.match($('p4CorteEstado').textContent,/fallo al borrar/);assert((await s.req('seleccion')).data);s.context.fetch=fetch;
 $('p4Aceptar').onclick();await tick();assert.equal((await s.req('seleccion')).data,null);
});
test('Alcance: bloques protegidos intactos, módulo cargado, estilos adaptables y sin diálogos nativos',()=>{
 const base=execFileSync('git',['show','HEAD:public/index.html'],{encoding:'utf8'});
 for(const actividad of ['1','2','3 TIERLIST','5'])for(const tipo of ['JS','CSS','HTML']){
  const inicio='ACTIVIDAD '+actividad+': INICIO '+tipo,fin='ACTIVIDAD '+actividad+': FIN '+tipo;
  if(base.includes(inicio))assert.equal(html.split(inicio)[1].split(fin)[0],base.split(inicio)[1].split(fin)[0]);
 }
 assert.match(html,/<script src="corte.js"><\/script>/);
 const js=html.split('// ACTIVIDAD 4: INICIO JS')[1].split('// ACTIVIDAD 4: FIN JS')[0];assert(!/\b(?:confirm|alert)\(/.test(js));
 const css=html.split('/* ACTIVIDAD 4: INICIO CSS */')[1].split('/* ACTIVIDAD 4: FIN CSS */')[0];assert.match(css,/overflow-x:auto/);assert.match(css,/border-top:4px solid var\(--accent\)/);assert.match(css,/max-width:100%/);
});

test("Criterios originales: todas las claves conservan sus valores",()=>{
 const anterior={
  "provisional": false,
  "nota": "Pendiente de validación con German (reunión 25 sep 2026)",
  "umbral": 3.0,
  "impacto": [
    {
      "id": "I1",
      "nombre": "Contribución al crecimiento y posicionamiento",
      "pregunta": "¿Cuánto aporta este actor al crecimiento y posicionamiento de Olivia en Colombia?",
      "peso": 25
    },
    {
      "id": "I2",
      "nombre": "Alineación estratégica",
      "pregunta": "¿Qué tanto conecta con la propuesta de transformación organizacional de Olivia?",
      "peso": 20
    },
    {
      "id": "I3",
      "nombre": "Potencial de articulación y acceso",
      "pregunta": "¿Cuánto facilita conexiones, capacidades o proyectos con otros actores?",
      "peso": 20
    },
    {
      "id": "I4",
      "nombre": "Conocimiento y capacidades",
      "pregunta": "¿Cuánto aporta al aprendizaje, la innovación o la comprensión del mercado?",
      "peso": 15
    },
    {
      "id": "I5",
      "nombre": "Resultados verificables",
      "pregunta": "¿Qué potencial tiene para generar resultados medibles para Olivia y sus clientes?",
      "peso": 20
    }
  ],
  "esfuerzo": [
    {
      "id": "E1",
      "nombre": "Recursos económicos",
      "pregunta": "¿Cuánto dinero requiere activar y sostener la relación o el seguimiento de este actor?",
      "peso": 25
    },
    {
      "id": "E2",
      "nombre": "Dedicación del equipo",
      "pregunta": "¿Cuánto tiempo del equipo requiere gestionar y acompañar este actor?",
      "peso": 25
    },
    {
      "id": "E3",
      "nombre": "Complejidad administrativa y jurídica",
      "pregunta": "¿Qué tan exigentes son los acuerdos, trámites y requisitos para trabajar con este actor?",
      "peso": 20
    },
    {
      "id": "E4",
      "nombre": "Complejidad de coordinación y ejecución",
      "pregunta": "¿Cuánto esfuerzo exige coordinar interlocutores, alinear expectativas y resolver dependencias?",
      "peso": 15
    },
    {
      "id": "E5",
      "nombre": "Costo de oportunidad relacional",
      "pregunta": "¿Cuánta capacidad de relacionamiento consume que podría dedicarse a otros actores?",
      "peso": 15
    }
  ],
  "escala": {
    "impacto": {
      "1": "Marginal: sin efecto apreciable para Olivia.",
      "2": "Bajo: aporte puntual o limitado.",
      "3": "Medio: contribución clara a una prioridad estratégica.",
      "4": "Alto: contribución relevante a varias prioridades.",
      "5": "Transformador: habilita crecimiento o capacidades decisivas."
    },
    "esfuerzo": {
      "1": "Mínimo: sin desembolso relevante y dedicación puntual.",
      "2": "Bajo: recursos acotados y gestión ligera.",
      "3": "Medio: dedicación regular o acuerdos simples.",
      "4": "Alto: recursos importantes o alta dedicación y coordinación.",
      "5": "Muy alto: compromisos prolongados y gestión compleja; más esfuerzo."
    }
  },
  "cuadrantes": [
    {
      "id": "apuestas-estrategicas",
      "nombre": "Apuestas estratégicas",
      "impacto": "alto",
      "esfuerzo": "alto",
      "regla": "Sostener y gestionar activamente."
    },
    {
      "id": "victorias-tempranas",
      "nombre": "Victorias tempranas",
      "impacto": "alto",
      "esfuerzo": "bajo",
      "regla": "Escalar con prioridad."
    },
    {
      "id": "mantenimiento-selectivo",
      "nombre": "Mantenimiento selectivo",
      "impacto": "bajo",
      "esfuerzo": "bajo",
      "regla": "Mantener con gestión ligera."
    },
    {
      "id": "racionalizacion",
      "nombre": "Racionalización",
      "impacto": "bajo",
      "esfuerzo": "alto",
      "regla": "Renegociar, transformar o cerrar."
    }
  ],
  "metodologia": {
    "fuente": "Metodología y herramienta de priorización de alianzas Esenttia, tablas 0–3; Excel Parámetros y Ficha de alianzas.",
    "adaptacion": "Se conservan todos los pesos. I1 e I5 se orientan al negocio de Olivia; E4 mide coordinación y ejecución, no riesgo ESG. Relación incluye seguimiento competitivo y regulatorio, no presupone una alianza comercial.",
    "noAplica": "El Excel remite a una redistribución de pesos ausente del documento. No se implementa: se exigen diez enteros de 1 a 5; si falta información, puede dejarse el actor sin calificar.",
    "calculo": "Promedio de los índices ponderados individuales. Clasificación antes del redondeo, alto si índice >= umbral. Se redondean únicamente los índices publicados a dos decimales."
  }
};
 const {corte,...actual}=criterios;assert.deepEqual(actual,anterior);assert.equal(corte.maximo,10);
});
