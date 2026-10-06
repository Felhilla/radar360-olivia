import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import TierList from '../public/tierlist.js';
import {entorno,dom,html,read} from './embudo-support.mjs';
const actores=JSON.parse(read('../public/data/actores.json'));
const rng=()=>.5;
const nombres=n=>Array.from({length:n},(_,i)=>'Persona '+(i+1));
const sortear=n=>TierList.sortear(nombres(n),actores,rng);
const code=html.split('// ACTIVIDAD 3 TIERLIST: INICIO JS')[1].split('// ACTIVIDAD 3 TIERLIST: FIN JS')[0];
const tick=()=>new Promise(r=>setImmediate(r));
for(const [n,tamanos] of [[7,[2,2,3]],[8,[2,2,2,2]],[9,[2,2,2,3]],[2,[2]],[3,[3]],[4,[2,2]],[5,[2,3]]]){
 test(`Sorteo de ${n}: personas, cobertura, tamaños y reparto`,()=>{
  assert.equal(actores.length,80);
  const s=sortear(n),gs=s.grupos;
  assert.deepEqual(gs.map(g=>g.integrantes.length),tamanos);
  assert.deepEqual(gs.flatMap(g=>g.integrantes).sort(),nombres(n).sort());
  assert.equal(new Set(gs.flatMap(g=>g.industrias)).size,7);
  for(const g of gs){assert.equal(new Set(g.industrias).size,g.industrias.length);assert(g.id.startsWith(s.id+'-g'));}
  if(gs.length>=3)assert(gs.every(g=>g.industrias.length>=2&&g.industrias.length<=3));
  else assert.deepEqual(gs.map(g=>g.industrias.length).sort(),gs.length===1?[7]:[3,4]);
  const cargas=gs.map(g=>TierList.actoresDelGrupo(g,actores).length);
  assert(Math.max(...cargas)-Math.min(...cargas)<=15,JSON.stringify(cargas));
  const industrias=gs.flatMap(g=>g.industrias);
  assert.equal(industrias.length,Math.max(7,gs.length*2));
  if(gs.length===4)assert.equal(industrias.filter(i=>i==='energia').length,2);
 });
}
test('Reglas: casos límite, ids únicos y normalización de integrantes',()=>{
 assert.throws(()=>TierList.formarGrupos([],rng));
 assert.deepEqual(TierList.formarGrupos(['Ana'],rng),[['Ana']]);
 assert.throws(()=>TierList.formarGrupos(['Ána','ana'],rng));
 assert.notEqual(sortear(8).id,sortear(8).id);
 const s=TierList.sortear(['Ángela','Luis'],actores,rng);
 assert.equal(TierList.grupoDe(s,' ANGELA ').id,s.grupos[0].id);
 assert.equal(TierList.grupoDe(s,'Nadie'),null);
});
test('Actores del grupo: gremios asociados sin duplicados y orden de industria/subindustria/tipo/nombre',()=>{
 const g={industrias:['energia','financiero']},lista=TierList.actoresDelGrupo(g,actores);
 const esperado=new Set(actores.filter(a=>g.industrias.includes(a.industria)).flatMap(a=>[a.id,...(a.tipo==='empresa'?a.gremios_asociados||[]:[])]));
 assert.deepEqual(new Set(lista.map(a=>a.id)),esperado);assert.equal(lista.length,esperado.size);
 const ids=TierList.INDUSTRIAS.map(i=>i.id),sub=['energia','servicios_publicos','recursos_naturales'];
 for(let i=1;i<lista.length;i++){
  const a=lista[i-1],b=lista[i];
  assert((ids.indexOf(a.industria)-ids.indexOf(b.industria)||sub.indexOf(a.subindustria)-sub.indexOf(b.subindustria)||(a.tipo==='gremio')-(b.tipo==='gremio')||a.nombre.localeCompare(b.nombre,'es'))<=0);
 }
});
test('Nivel 1: límite, permanencia, retiro y resumen por grupos sin duplicados',()=>{
 const s=sortear(8),g=s.grupos[0].id,h=s.grupos[1].id;
 const filas=['a','b','c'].map(actorId=>({sorteoId:s.id,grupoId:g,actorId,nivel:1}));
 assert.deepEqual(TierList.puedeMover(filas,'d',1),{ok:false,motivo:'El Nivel 1 admite máximo 3 actores por grupo'});
 for(const n of [null,2,3,4])assert(TierList.puedeMover(filas,'d',n).ok);
 assert(TierList.puedeMover(filas,'a',1).ok);assert(!TierList.puedeMover(filas,'a',5).ok);
 assert.deepEqual(TierList.nivel1(s,[...filas,filas[0],{...filas[0],grupoId:h},{...filas[0],grupoId:'otro',actorId:'x'},{...filas[0],sorteoId:'viejo',actorId:'y'}]),[{actorId:'a',grupos:[g,h]},{actorId:'b',grupos:[g]},{actorId:'c',grupos:[g]}]);
});
test('Ruta parejas: lectura, validación, inicio, reemplazo forzado y métodos',async()=>{
 const s=entorno(),sorteo=sortear(8);
 assert.equal((await s.req('parejas')).data,null);
 assert.equal((await s.req('parejas','PATCH',{iniciado:true})).status,400);
 for(const body of [null,{}, {...sorteo,grupos:[]},{...sorteo,grupos:[{...sorteo.grupos[0],industrias:['inventada']}]},{...sorteo,grupos:sorteo.grupos.map(g=>({...g,integrantes:['Ana']}))}])assert.equal((await s.req('parejas','PUT',body)).status,400);
 assert.equal((await s.req('parejas','PUT',sorteo)).status,200);
 assert.equal((await s.req('parejas')).data.id,sorteo.id);
 assert.equal((await s.req('parejas','PATCH',{iniciado:true})).data.iniciado,true);
 assert.equal((await s.req('parejas','PUT',sortear(8))).status,409);
 assert.equal((await s.req('parejas','PUT',{...sortear(8),forzar:true})).status,200);
 for(const method of ['POST','DELETE'])assert.equal((await s.req('parejas',method,{})).status,405);
});
test('Ruta tierlist: filas independientes, cuarto rechazado, retiro, pertenencia y filtro',async()=>{
 const s=entorno(),sorteo=sortear(8),g=sorteo.grupos[0];await s.req('parejas','PUT',sorteo);
 const lista=TierList.actoresDelGrupo(g,actores),body={sorteoId:sorteo.id,grupoId:g.id,editadoPor:'Ana',nivel:1};
 const mover=(actorId,nivel=1,extra={})=>s.req('tierlist','PUT',{...body,actorId,nivel,...extra});
 for(const a of lista.slice(0,3))assert.equal((await mover(a.id)).status,200);
 assert.equal((await mover(lista[3].id)).status,409);
 assert.equal((await mover(lista[0].id)).status,200);
 assert.equal((await mover(lista[0].id,null)).status,200);
 assert.equal(s.bucket('tierlist').has(g.id+':'+lista[0].id),false);
 assert.equal((await mover(lista[3].id)).status,200);
 const ajeno=actores.find(a=>!lista.some(b=>a.id===b.id));assert.equal((await mover(ajeno.id,2)).status,400);
 assert.equal((await mover(lista[0].id,2,{grupoId:'ajeno'})).status,400);
 assert.equal((await mover(lista[0].id,2,{sorteoId:'viejo'})).status,400);
 assert.equal((await mover(lista[0].id,5)).status,400);
 assert.equal((await s.req('tierlist','POST',body)).status,405);
 s.bucket('tierlist').set('viejo',{sorteoId:'viejo',grupoId:'viejo',actorId:'a',nivel:1});
 assert.equal((await s.req('tierlist')).data.length,4);
 assert.equal((await s.req('tierlist?sorteo='+sorteo.id)).data.length,3);
 assert.equal(s.calls.filter(([u])=>u==='data/actores.json').length,1);
});
function vista(s,identidad={nombre:'Persona 1',rol:'participante'}){
 const $=dom(s.context),intervalos=new Map();let observar,active=true;
 s.context.window.Identidad=identidad;
 s.context.MutationObserver=class{constructor(fn){observar=fn;}observe(){}};
 s.context.setInterval=(fn,ms)=>{assert.equal(ms,5000);intervalos.set(1,fn);return 1;};
 s.context.clearInterval=id=>intervalos.delete(id);
 $('view-matriz').classList.contains=()=>active;
 vm.runInContext(code,s.context);
 return {$,intervalos,async cargar(){ $('view-matriz').handlers['vista:activar']();await tick();},salir(){active=false;observar();},async mover(id,nivel){$('tlTablero').handlers.click({target:{closest:q=>q==='[data-tl-mover]'?{dataset:{tlMover:id,nivel:String(nivel)}}:null}});await tick();}};
}
test('Vista: espera, sin grupo, inicio, identidad fija, movimientos, reversión, ficha y sondeo',async()=>{
 const s=entorno(),v=vista(s),{$}=v;await v.cargar();
 assert.match($('tlMiGrupo').innerHTML,/Espera a que el facilitador/);assert.equal($('tlAdmin').hidden,true);
 const sorteo=sortear(8);await s.req('parejas','PUT',sorteo);await v.cargar();
 assert.match($('tlMiGrupo').innerHTML,/todavía no inicia/);assert.match($('tlTablero').innerHTML,/disabled/);
 const g=TierList.grupoDe(sorteo,'Persona 1'),lista=TierList.actoresDelGrupo(g,actores);
 await v.mover(lista[0].id,1);assert.equal(s.bucket('tierlist').size,0);
 await s.req('parejas','PATCH',{iniciado:true});await v.cargar();
 assert.deepEqual([...$('tlTablero').innerHTML.matchAll(/data-tl-nivel="(\d)"/g)].map(m=>Number(m[1])),[1,2,3,4,0]);
 for(const a of lista.slice(0,3))await v.mover(a.id,1);
 assert.equal([...s.bucket('tierlist').values()][0].editadoPor,'Persona 1');
 await v.mover(lista[3].id,1);assert.equal(s.bucket('tierlist').size,3);assert.match($('tlLimite').textContent,/máximo 3/);
 await v.mover(lista[0].id,0);assert.equal(s.bucket('tierlist').size,2);
 const before=$('tlTablero').innerHTML,fetch=s.context.fetch;
 s.context.fetch=async()=>Response.json({error:'fallo'},{status:500});await v.mover(lista[3].id,2);
 assert.equal($('tlTablero').innerHTML,before);assert.match($('tlEstado').textContent,/No se pudo guardar el cambio/);s.context.fetch=fetch;
 let ficha;s.context.window.abrirFichaActor=id=>{ficha=id;};
 $('tlTablero').handlers.click({target:{closest:()=>({dataset:{tlFicha:lista[0].id}})}});assert.equal(ficha,lista[0].id);
 s.context.window.Identidad.nombre='Fuera';await v.cargar();assert.match($('tlMiGrupo').innerHTML,/No estás en ningún grupo/);
 assert.equal(v.intervalos.size,1);v.salir();assert.equal(v.intervalos.size,0);
});
test('Vista: arrastrar a fila y bandeja y sondeo del compañero',async()=>{
 const s=entorno(),sorteo=sortear(8);sorteo.iniciado=true;await s.req('parejas','PUT',sorteo);
 const g=sorteo.grupos[0],a=TierList.actoresDelGrupo(g,actores)[0];
 const v=vista(s,{nombre:g.integrantes[0],rol:'participante'}),{$}=v;await v.cargar();let transferido;
 $('tlTablero').handlers.dragstart({target:{closest:()=>({dataset:{tlActor:a.id}})},dataTransfer:{setData:(tipo,id)=>{assert.equal(tipo,'text/plain');transferido=id;}}});
 assert.equal(transferido,a.id);
 for(const nivel of [2,0]){
  let prevenido=false;
  $('tlTablero').handlers.drop({target:{closest:()=>({dataset:{tlNivel:String(nivel)}})},preventDefault(){prevenido=true;},dataTransfer:{getData:()=>transferido}});await tick();
  assert(prevenido);assert.equal(s.bucket('tierlist').get(g.id+':'+a.id)?.nivel,nivel||undefined);
 }
 await s.req('tierlist','PUT',{sorteoId:sorteo.id,grupoId:g.id,actorId:a.id,nivel:1,editadoPor:g.integrantes[1]});
 await v.intervalos.get(1)();
 assert.match($('tlResumen').innerHTML,new RegExp(a.nombre.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.match($('tlTablero').innerHTML,/<small>1 de 3<\/small>/);
});
test('Facilitador: ve los grupos sin modificarlos y su tablero de ejemplo no llega a la base ni al Nivel 1',async()=>{
 const s=entorno(),sorteo=sortear(8);sorteo.iniciado=true;await s.req('parejas','PUT',sorteo);
 const v=vista(s,{nombre:'Felipe Hillón',rol:'administrador'}),{$}=v;await v.cargar();
 const g=sorteo.grupos[0],a=TierList.actoresDelGrupo(g,actores)[0];
 // Tablero de un grupo: solo lectura, y la ruta rechaza el cambio aunque llegue.
 assert.match($('tlTablero').innerHTML,/disabled/);assert.match($('tlMiGrupo').innerHTML,/solo lectura/);
 await v.mover(a.id,1);assert.equal(s.bucket('tierlist').size,0);
 assert.equal((await s.req('tierlist','PUT',{sorteoId:sorteo.id,grupoId:g.id,actorId:a.id,nivel:1,editadoPor:'Felipe Hillón'})).status,403);
 // Tablero de ejemplo: editable, etiquetado y fuera de la base.
 assert.match($('tlGrupo').innerHTML,/Ejemplo · Ad. Facilitador/);
 $('tlGrupo').handlers.change({target:{value:'ejemplo-facilitador'}});
 assert.match($('tlMiGrupo').innerHTML,/Ad\. Facilitador/);assert.doesNotMatch($('tlTablero').innerHTML,/disabled/);
 await v.mover(a.id,1);
 assert.equal(s.bucket('tierlist').size,0);
 const filas=(await s.req('tierlist?sorteo='+sorteo.id)).data;
 assert.equal(filas.length,1);assert.equal(filas[0].facilitador,true);assert.equal(filas[0].grupoId,'ejemplo-facilitador');
 assert.equal(TierList.nivel1(sorteo,filas).length,0);
 assert.match($('tlTablero').innerHTML,/<small>1 de 3<\/small>/);assert.match($('tlResumen').innerHTML,/Aún no hay actores en Nivel 1/);
});
test('Vista administrador: presentes desmarcados, confirmación interna, inicio y selección',async()=>{
 const s=entorno(),v=vista(s,{nombre:'Felipe Hillón',rol:'administrador'}),{$}=v;await v.cargar();
 assert.equal($('tlAdmin').hidden,false);assert.equal($('tlSortear').disabled,true);
 assert.equal(($('tlPresentes').innerHTML.match(/type="checkbox"/g)||[]).length,JSON.parse(readFileSync(new URL("../public/asistentes-config.json",import.meta.url),"utf8")).participantes.length);assert(!$('tlPresentes').innerHTML.includes('checked'));
 $('tlPresentes').querySelectorAll=()=>[{value:'Ana'},{value:'Luis'},{value:'Pedro'},{value:'Julia'}];
 $('tlPresentes').handlers.change();assert.equal($('tlSortear').disabled,false);
 $('tlSortear').handlers.click();await tick();const primero=(await s.req('parejas')).data;
 $('tlSortear').handlers.click();assert.equal($('tlConfirmacion').hidden,false);assert.equal((await s.req('parejas')).data.id,primero.id);
 $('tlCancelar').handlers.click();assert.equal($('tlConfirmacion').hidden,true);
 $('tlSortear').handlers.click();$('tlReemplazar').handlers.click();await tick();
 const segundo=(await s.req('parejas')).data;assert.notEqual(segundo.id,primero.id);
 $('tlGrupo').handlers.change({target:{value:segundo.grupos[1].id}});assert.match($('tlMiGrupo').innerHTML,new RegExp(segundo.grupos[1].integrantes[0]));
 $('tlIniciar').handlers.click();await tick();assert.equal((await s.req('parejas')).data.iniciado,true);assert.equal($('tlSortear').disabled,true);assert.equal($('tlSortear').textContent,'La actividad ya empezó');
});
test('HTML y Radar: ids retirados sin referencias ejecutables, template intacto y protecciones reales',()=>{
 const base=execFileSync('git',['show','HEAD:public/index.html'],{encoding:'utf8'});
 const template=s=>s.match(/<template id="gremios-obsoleto">[\s\S]*?<\/template>/)[0];assert.equal(template(html),template(base));
 const viejo=base.slice(base.indexOf('<section class="view" id="view-matriz">'),base.indexOf('<template id="gremios-obsoleto">'));
 const retirados=[...viejo.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).filter(id=>!html.includes('id="'+id+'"'));
 const js=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 for(const id of retirados)if(id!=='radarActorsList')assert(!new RegExp(`(?:getElementById|\\$|querySelector)\\(\\s*['"]#?${id}['"]`).test(js),id);
 for(const id of ['matrizTbody','a3Cards-empresas','a3Agregar'])assert(!html.includes('id="'+id+'"'));
 const sugerencias=html.slice(html.indexOf('  function renderActorSuggestions()'),html.indexOf('  function renderTable()'));
 vm.runInNewContext(sugerencias+'renderActorSuggestions();',{document:{getElementById:()=>null}});
 const poll=html.slice(html.indexOf('  function shouldRerenderOnPoll()'),html.indexOf('  function renderStatsOnly()'));
 assert.equal(vm.runInNewContext(poll+'shouldRerenderOnPoll();',{document:{activeElement:null,hidden:false},editingId:null}),true);
 assert.match(js,/function descargarEmbudo\(filas,archivo\)/);
 assert(!js.includes('fetchMatriz('));assert(!js.includes('renderMatrizTable('));
 assert.match(html,/window\.abrirFichaActor = openActorDialog/);
 const css=html.split('/* ACTIVIDAD 3 TIERLIST: INICIO CSS */')[1].split('/* ACTIVIDAD 3 TIERLIST: FIN CSS */')[0];
 for(const c of ['#E51900','#FF971C','#EDD300','#00B2B9','#1C1A15'])assert(css.includes(c));
 assert.match(css,/grid-template-columns:88px minmax\(0,1fr\)/);assert.match(css,/grid-template-columns:56px minmax\(0,1fr\)/);assert.match(css,/flex-wrap:wrap/);
});
