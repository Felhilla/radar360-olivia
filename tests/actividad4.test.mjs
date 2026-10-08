import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
test('Ubicados: mejor nivel, conteos por grupo, vigencia, duplicados y ejemplos',async()=>{
 const s=entorno();for(const id of ['a','b','c','ejemplo'])s.actor(id);
 const sorteo={id:'actual',grupos:[{id:'g1'},{id:'g2'},{id:'g3'}]};
 const filas=[{actorId:'a',grupoId:'g1',sorteoId:'actual',nivel:3},{actorId:'a',grupoId:'g2',sorteoId:'actual',nivel:1},{actorId:'a',grupoId:'g3',sorteoId:'actual',nivel:3},{actorId:'b',grupoId:'g1',sorteoId:'actual',nivel:4},{actorId:'c',grupoId:'g1',sorteoId:'viejo',nivel:1},{actorId:'ejemplo',grupoId:'g1',sorteoId:'actual',nivel:1,ejemploCompartido:true}];
 filas.push({...filas[0]}, {...filas[0],grupoId:'ajeno',nivel:1}, {...filas[0],actorId:'nulo',nivel:null});
 filas.forEach((f,i)=>s.bucket('tierlist').set('f'+i,f));
 assert.deepEqual(TierList.ubicados(null,filas),[]);
 assert.equal((await s.req('priorizacion-votos','PUT',calificacion('a'))).status,400);
 s.bucket('parejas').set('vigente',sorteo);
 assert.deepEqual(TierList.ubicados(sorteo,filas),[{actorId:'a',mejorNivel:1,niveles:{1:1,2:0,3:2,4:0},grupos:['g1','g2','g3']},{actorId:'b',mejorNivel:4,niveles:{1:0,2:0,3:0,4:1},grupos:['g1']}]);
 for(const id of ['a','b'])assert.equal((await s.req('priorizacion-votos','PUT',calificacion(id))).status,200);
 for(const id of ['c','ejemplo'])assert.equal((await s.req('priorizacion-votos','PUT',calificacion(id))).status,400);
 const resumen=(await s.req('priorizacion-votos?resumen=1')).data;
 assert.deepEqual(resumen.map(r=>[r.actorId,r.mejorNivel]),[['a',1],['b',4]]);
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
test('Selección histórica: solo lectura, sin alterar la base ni restringir A5',async()=>{
 const s=universo(),anterior={actorIds:['ajeno'],confirmadoPor:'Ana'};s.bucket('seleccion').set('vigente',anterior);
 for(const m of ['PUT','POST','PATCH','DELETE'])assert.equal((await s.req('seleccion',m,{actorIds:['a1']})).status,405);
 assert.deepEqual((await s.req('seleccion')).data,anterior);
 assert.equal((await s.req('lista-rutas')).data.actorIds.length,15);
 assert(!s.calls.some(([,o])=>o.method==='DELETE'||o.method==='POST'));
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
 await v.cargar();assert.match($('p4Actores').innerHTML,/Todavía no hay actores ubicados en la Actividad 3\./);assert.equal($('p4Editor').hidden,true);
 s.actor('a');s.nivel1('a');s.bucket('parejas').get('vigente').grupos.push({id:'g2'});s.bucket('tierlist').set('g2',{actorId:'a',sorteoId:'actual',grupoId:'g2',nivel:1});
 await v.cargar();assert.match($('p4Actores').innerHTML,/Elegido por 2 grupos/);assert.equal($('p4Editor').hidden,false);assert.match($('p4CorteFilas').innerHTML,/Interés futuro/);
 assert(!$('p4CorteFilas').innerHTML.includes('>Agregar<'));assert.equal(s.bucket('seleccion').size,0);
 let ficha;s.context.window.abrirFichaActor=id=>ficha=id;
 $('p4CorteFilas').onclick({target:{closest:q=>q==='[data-ficha]'?{dataset:{ficha:'a'}}:null}});assert.equal(ficha,'a');
 const timer=v.timers.find(t=>t.ms===10000);assert(timer);
 s.nivel1('a',2);s.bucket('tierlist').delete('g2');await timer.fn();await tick();assert.equal($('p4Editor').hidden,false);assert.match($('p4Actores').innerHTML,/Tier 2/);
 s.nivel1('a',null);await timer.fn();assert.equal($('p4Editor').hidden,true);
 const calls=s.calls.length;$('view-priorizacion').classList.contains=()=>false;await timer.fn();assert.equal(s.calls.length,calls);
});
test('Orden sugerido: todos los ubicados, solo lectura, fichas y CSV sin confirmación',async()=>{
 const s=universo(40);for(let i=1;i<=4;i++){s.nivel1('a'+i,i);await s.req('priorizacion-votos','PUT',calificacion('a'+i));}
 const v=vista(s),{$}=v;await v.cargar();
 const tabla=$('p4CorteFilas').innerHTML;
 assert.equal((tabla.match(/<tr>/g)||[]).length,40);assert.match(tabla,/Tier 4/);assert.match(tabla,/Interés futuro/);
 assert.doesNotMatch(html,/id="p4(?:Proponer|Confirmar|QuitarConfirmacion|Borrador)"/);
 assert.doesNotMatch(tabla,/Agregar|Confirmar|máximo/);
 let blob;const FakeURL=class extends URL{};FakeURL.createObjectURL=b=>{blob=b;return 'blob:local';};FakeURL.revokeObjectURL=()=>{};s.context.URL=FakeURL;s.context.Blob=Blob;s.context.document.body={appendChild(){}};$('new').click=()=>{};$('new').remove=()=>{};
 $('p4CorteCSV').onclick();const csv=await blob.text();assert.match(csv,/Tier/);assert.match(csv,/Actor 40/);assert.doesNotMatch(csv,/confirmada/);
 assert(!s.calls.some(([u])=>u.includes('coleccion=eq.seleccion')));
});
// La comparación de los demás bloques contra HEAD servía solo mientras se desarrollaba el ajuste C; se retiró
// en el ajuste D, que reescribe la Actividad 5 a propósito.
test('Alcance: módulo cargado, estilos adaptables y sin diálogos nativos',()=>{
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
 const {corte,...actual}=criterios;assert.deepEqual(actual,anterior);assert.equal(corte.maximo,undefined);
});

test('Estados: Interés futuro solo Tier 1–2 sin calificación',()=>{
 for(const mejorNivel of [1,2,3,4]){
  assert.equal(Corte.estado({mejorNivel,votos:0}),mejorNivel<=2?'Interés futuro':'Sin calificar');
  assert.equal(Corte.estado({mejorNivel,votos:1}),'Calificados');
 }
});
test('Interés futuro: tarjetas, fichas, filtros y CSV de matriz y corte',async()=>{
 const s=universo(2);s.actor('g','aliados',{nombre:'Gremio futuro'});s.nivel1('g');
 await s.req('priorizacion-votos','PUT',calificacion('a1'));
 const v=vista(s),{$}=v;await v.cargar();
 for(const id of ['p4Cuadrantes','p4FuturoCorte']){
  assert.match($(id).innerHTML,/<h4>Interés futuro<\/h4>/);assert.match($(id).innerHTML,/data-ficha="a2"/);assert.match($(id).innerHTML,/data-ficha="g"/);assert.doesNotMatch($(id).innerHTML,/data-ficha="a1"/);
  let ficha;s.context.window.abrirFichaActor=id=>ficha=id;
  $(id).onclick({target:{closest:()=>({dataset:{ficha:'a2'}})}});assert.equal(ficha,'a2');
 }
 assert.match($('p4CorteNota').textContent,/Todos los Tier 1 y 2/);
 let blob;const FakeURL=class extends URL{};FakeURL.createObjectURL=b=>{blob=b;return 'blob:local';};FakeURL.revokeObjectURL=()=>{};s.context.URL=FakeURL;s.context.Blob=Blob;s.context.document.body={appendChild(){}};$('new').click=()=>{};$('new').remove=()=>{};
 $('p4CSV').onclick();let csv=await blob.text();assert.match(csv,/"a2";"Actor 02";.*"Interés futuro";"0"/);assert.match(csv,/Gremio futuro/);
 $('p4CorteCSV').onclick();assert.match(await blob.text(),/"Actor 02";"1";"Otros mercados";"Interés futuro"/);
 $('p4MercadoMatriz').value='Otros mercados';$('p4MercadoMatriz').onchange();
 assert.doesNotMatch($('p4Cuadrantes').innerHTML,/Gremio futuro/);assert.match($('p4FuturoCorte').innerHTML,/Gremio futuro/);
 $('p4CSV').onclick();assert.doesNotMatch(await blob.text(),/Gremio futuro/);
 // Sin calificados todavía se puede exportar, y el sondeo actualiza nuevos actores futuros.
 s.bucket('priorizacion-votos').clear();await v.cargar();
 assert.equal($('p4CSV').disabled,false);assert.match($('p4Cuadrantes').innerHTML,/data-ficha="a1"/);
 s.actor('nuevo','mercados',{nombre:'Nuevo futuro'});s.nivel1('nuevo');await v.cargar();assert.match($('p4Cuadrantes').innerHTML,/Nuevo futuro/);
 $('p4CSV').onclick();assert.match(await blob.text(),/Nuevo futuro/);
});

test('Filtros combinados de Calificar: Tier, mercado, estado propio, contador y navegación',async()=>{
 const s=universo(6);
 for(let i=1;i<=6;i++){s.bucket('actors').get('a'+i).sector=i===5?'Retail':'Energía';s.nivel1('a'+i,i===6?3:2);}
 await s.req('priorizacion-votos','PUT',calificacion('a2'));
 await s.req('priorizacion-votos','PUT',{...calificacion('a3'),votante:'Otra persona'});
 const v=vista(s),{$}=v;await v.cargar();
 assert($('p4Mercado').innerHTML.indexOf('Energía')<$('p4Mercado').innerHTML.indexOf('Retail'));
 $('p4Tier').value='2';$('p4Mercado').value='Energía';$('p4FiltroEstado').value='sin';$('p4Tier').handlers.input();
 const lista=$('p4Actores').innerHTML;
 for(const i of [1,3,4])assert.match(lista,new RegExp('data-actor="a'+i+'"'));
 for(const i of [2,5,6])assert.doesNotMatch(lista,new RegExp('data-actor="a'+i+'"'));
 assert.equal($('p4Avance').textContent,'Has calificado 0 de 3 · 3 en este filtro.');
 $('p4Actores').onclick({target:{closest:()=>({dataset:{actor:'a1'}})}});
 assert.equal($('p4Anterior').disabled,true);assert.equal($('p4Siguiente').disabled,false);
 $('p4Siguiente').onclick();assert.match($('p4Editor').innerHTML,/Actor 03/);
 $('p4Siguiente').onclick();assert.match($('p4Editor').innerHTML,/Actor 04/);assert.equal($('p4Siguiente').disabled,true);
 $('p4Anterior').onclick();assert.match($('p4Editor').innerHTML,/Actor 03/);
 $('p4FiltroEstado').value='calificados';$('p4FiltroEstado').handlers.input();
 assert.match($('p4Actores').innerHTML,/Actor 02/);assert.doesNotMatch($('p4Actores').innerHTML,/Actor 03/);
 assert.equal($('p4Avance').textContent,'Has calificado 1 de 1 · 1 en este filtro.');
});

test('Filtros combinados de Matriz: sin calificar Tier 3–4, mercado, resultados y CSV',async()=>{
 const s=universo(5);
 for(let i=1;i<=5;i++){s.bucket('actors').get('a'+i).sector=i===5?'Retail':'Energía';s.nivel1('a'+i,i===1?2:3);}
 await s.req('priorizacion-votos','PUT',calificacion('a2'));
 const v=vista(s),{$}=v;await v.cargar();
 $('p4TierMatriz').value='3';$('p4MercadoMatriz').value='Energía';$('p4FiltroEstadoMatriz').value='sin';$('p4TierMatriz').onchange();
 for(const id of ['p4PorMercado','p4Resultados']){
  assert.match($(id).innerHTML,/Actor 03/);assert.match($(id).innerHTML,/Actor 04/);assert.match($(id).innerHTML,/Sin calificar/);assert.match($(id).innerHTML,/Tier 3/);
  for(const n of ['01','02','05'])assert.doesNotMatch($(id).innerHTML,new RegExp('Actor '+n));
 }
 assert.equal($('p4CSV').disabled,false);
 let blob;const FakeURL=class extends URL{};FakeURL.createObjectURL=b=>{blob=b;return 'blob:local';};FakeURL.revokeObjectURL=()=>{};s.context.URL=FakeURL;s.context.Blob=Blob;s.context.document.body={appendChild(){}};$('new').click=()=>{};$('new').remove=()=>{};
 $('p4CSV').onclick();const csv=await blob.text();assert.match(csv,/Actor 03/);assert.match(csv,/Sin calificar/);assert.match(csv,/"tier";"mercado"/);assert.doesNotMatch(csv,/Actor 02|Interés futuro/);
 $('p4FiltroEstadoMatriz').value='calificados';$('p4FiltroEstadoMatriz').onchange();assert.match($('p4Resultados').innerHTML,/Actor 02/);assert.doesNotMatch($('p4Resultados').innerHTML,/Actor 03/);
});

test('Guardar y siguiente conserva el orden cuando el actor sale del filtro Sin calificar',async()=>{
 const s=universo(4),v=vista(s),{$}=v;await v.cargar();
 $('p4FiltroEstado').value='sin';$('p4FiltroEstado').handlers.input();
 $('p4Actores').onclick({target:{closest:()=>({dataset:{actor:'a2'}})}});
 const voto=calificacion('a2');
 $('p4Editor').querySelectorAll=q=>q.includes(':checked')?['impacto','esfuerzo'].flatMap(eje=>Object.entries(voto[eje]).map(([name,value])=>({name,value,dataset:{eje}}))):[];
 $('p4Formulario').handlers.submit({preventDefault(){},submitter:{value:'siguiente'}});await tick();await tick();
 assert.match($('p4Editor').innerHTML,/Actor 03/);
 assert.doesNotMatch($('p4Actores').innerHTML,/data-actor="a2"/);
});

test('Colores de Tier legibles e iguales a A3',()=>{
 assert.deepEqual(TierList.COLORES,{1:'#E51900',2:'#FF971C',3:'#EDD300',4:'#00B2B9'});
 for(const n of [2,3])assert.match(TierList.chip(n),/color:#1C1A15/);
 assert.match(TierList.chip(1),/color:#fff/);assert.equal(TierList.chip('<script>'),'');
});
