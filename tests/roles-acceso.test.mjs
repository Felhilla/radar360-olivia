// Permisos y acceso de la entrega. Todas las escrituras ocurren en la base simulada.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {entorno,read,calificacion,dom,html} from './embudo-support.mjs';
import TierList from '../public/tierlist.js';
import Rutas from '../public/rutas.js';
const cfg=JSON.parse(read('../public/asistentes-config.json'));
const admin={nombre:'Luis Felipe Barrientos',rol:'administrador'};
const disenador={nombre:'Felipe Hillón',rol:'disenador'};
const participante={nombre:'Diego Espejo',rol:'participante'};
const como=(s,p)=>s.context.window.Identidad=p;
const ruta=(actorId,extra={})=>({actorId,etiqueta:'venta_inmediata',responsable:participante.nombre,...extra});
function acceso(s){
 const memoria=new Map();Object.assign(s.context,{TextEncoder});
 Object.assign(s.context.window,{crypto:webcrypto,localStorage:{getItem:k=>memoria.get(k),setItem:(k,v)=>memoria.set(k,v),removeItem:k=>memoria.delete(k)}});
 vm.runInContext(read('../public/acceso.js'),s.context);
 return {api:s.context.window.Acceso,memoria};
}

test('Contraseña inicial exige cambio, confirmación, mínimo y contraseña distinta; sesión y cierre',async()=>{
 const s=entorno();como(s,null);const {api,memoria}=acceso(s);
 const config=structuredClone(cfg),inicial='Inicial-de-prueba';
 config.credenciales[admin.nombre].hashInicial=await api.hash(config.credenciales[admin.nombre].salt,inicial);
 await assert.rejects(api.verificar(admin,'incorrecta',config),/incorrecta/);
 assert.equal(api.sesion(admin.nombre),false);
 assert.equal((await api.verificar(admin,inicial,config)).cambioObligatorio,true);
 assert.equal(api.sesion(admin.nombre),false);assert.equal(s.bucket('credenciales').size,0);
 await assert.rejects(api.cambiar('corta','corta',config),/8 caracteres/);
 await assert.rejects(api.cambiar('Nueva-segura','otra',config),/no coinciden/);
 await assert.rejects(api.cambiar(inicial,inicial,config),/distinta/);
 await api.cambiar('Nueva-segura','Nueva-segura',config);
 const cred=s.bucket('credenciales').get('luis-felipe-barrientos');
 assert.match(cred.salt,/^[a-f0-9]{32}$/);assert.equal(cred.hash,await api.hash(cred.salt,'Nueva-segura'));assert(cred.cambiadaEn);
 assert.equal(api.sesion(admin.nombre),true);
 vm.runInContext(read('../public/acceso.js'),s.context);
 assert.equal(s.context.window.Acceso.sesion(admin.nombre),true,'sobrevive una recarga del módulo');
 assert(![...memoria.values()].join('').includes('Nueva-segura'));
 api.cerrar();assert.equal(api.sesion(admin.nombre),false);
 await assert.rejects(api.verificar(admin,inicial,config),/incorrecta/);
 assert.equal((await api.verificar(admin,'Nueva-segura',config)).cambioObligatorio,false);
 const h=[...s.bucket('historial').values()];assert.equal(h.length,1);assert.equal(h[0].actividad,'Acceso');assert.equal(h[0].quien,admin.nombre);
 assert.equal(h[0].despues,'Contraseña cambiada');assert(!JSON.stringify(h).includes(cred.hash));assert(!JSON.stringify(h).includes(cred.salt));
});

test('Acceso: almacenamiento bloqueado no rompe el acceso; un error de base no habilita la contraseña inicial',async()=>{
 const s=entorno(),{api}=acceso(s);
 s.context.window.localStorage={getItem(){throw Error('bloqueado');},setItem(){throw Error('bloqueado');},removeItem(){throw Error('bloqueado');}};
 assert.equal(api.sesion(admin.nombre),false);api.cerrar();
 s.context.window.fetch=async()=>Response.json({error:'Sin conexión'},{status:500});
 await assert.rejects(api.verificar(admin,'cualquiera',cfg),/Sin conexión/);assert.equal(api.pendiente,null);
});

for(const rol of ['disenador','participante'])test(rol+': permisos del adaptador en todos los métodos de escritura',async()=>{
 const s=entorno();como(s,rol==='disenador'?disenador:participante);
 const rutas=rol==='disenador'?['ideas','actors','contactos','tierlist','parejas','priorizacion-votos','seleccion','rutas','credenciales']:['priorizacion-votos','seleccion','rutas','parejas'];
 for(const r of rutas)for(const m of ['POST','PUT','PATCH','DELETE']){
  const respuesta=await s.req(r,m,{});assert.equal(respuesta.status,403,r+' '+m);
  if(rol==='disenador')assert.equal(respuesta.data.error,'Los diseñadores observan el instrumento; no lo editan.');
 }
 assert.equal(s.calls.filter(([,i])=>['POST','DELETE'].includes(i.method)).length,0);
});

test('Administrador escribe ideas, contactos y actores en base y audita crear, editar y borrar',async()=>{
 const s=entorno();
 const idea=await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto:'Respuesta real'});
 assert.equal(idea.status,201);assert.equal(s.bucket('ideas').size,1);assert.equal(idea.data.sticker.facilitador,undefined);
 const a=await s.req('actors','POST',{nombre:'Actor nuevo',categoria:'mercados',sector:'Salud'});
 assert.equal(a.status,201);
 await s.req('actors','PATCH',{id:a.data.id,patch:{nombre:'Actor actualizado'}});
 const c=await s.req('contactos','POST',{actorId:a.data.id,registradoPor:admin.nombre,nombre:'Ana Pérez',cargo:'Directora'});
 assert.equal(c.status,200);assert.equal(s.bucket('contactos').size,1);
 await s.req('contactos?id='+encodeURIComponent(c.data.id),'DELETE');
 await s.req('ideas','DELETE',{id:idea.data.sticker.id});
 const h=[...s.bucket('historial').values()];assert.equal(h.length,6);
 assert(h.every(r=>r.quien===admin.nombre&&r.rol==='administrador'));
 const editar=h.find(r=>r.accion==='editar');assert.equal(editar.antes.nombre,'Actor nuevo');assert.equal(editar.despues.nombre,'Actor actualizado');
 assert(h.some(r=>r.accion==='borrar'&&r.despues===null));
 const n=h.length;await s.req('ideas','POST',{texto:''});assert.equal(s.bucket('historial').size,n,'un rechazo no crea historial');
});

test('Apoyo: opcional, texto corto, distinto incluso con tildes; diseñadores excluidos y CSV',()=>{
 const opciones={disenadores:cfg.disenadores},id='a';
 for(const apoyo of [undefined,'',admin.nombre,'Angela Urbano'])assert.equal(Rutas.validar(ruta(id,{apoyo}),[id],opciones).ok,true);
 for(const apoyo of [7,'x'.repeat(121),' DIEGO ESPEJO ','Felipe Hillon','J. Ochoa'])assert.equal(Rutas.validar(ruta(id,{apoyo}),[id],opciones).ok,false,String(apoyo));
 for(const n of cfg.disenadores)assert.equal(Rutas.validar(ruta(id,{responsable:n}),[id],opciones).ok,false);
 assert.deepEqual(Rutas.opcionesApoyo([...cfg.participantes,...cfg.administradores],participante.nombre),[...cfg.participantes,...cfg.administradores].filter(n=>n!==participante.nombre));
 assert.equal(Rutas.limpiarApoyo('Ángela Urbano','Angela Urbano'),'');assert.equal(Rutas.limpiarApoyo(admin.nombre,participante.nombre),admin.nombre);
 const filas=Rutas.filasHoja([id],[ruta(id,{apoyo:admin.nombre})],{a:'Actor'});assert.equal(filas[1][filas[0].indexOf('apoyo')],admin.nombre);
});

test('Catálogo: mapeos sin tildes/mayúsculas, exclusiones y sin duplicar catálogo',()=>{
 const sectores={'FINANCIERO':['financiero'],ENERGÍA:['energia','energia'],'SERVICIOS PÚBLICOS':['energia','servicios_publicos'],Minero:['energia','recursos_naturales'],Retail:['retail'],Consumo:['retail'],'Retail/Consumo':['retail'],Industrial:['industrial'],Telecomunicaciones:['telecom'],Salud:['salud'],'salud y gestión de riesgos laborales':['salud'],Otro:['gremios_publico']};
 for(const [sector,[industria,subindustria]] of Object.entries(sectores)){
  const [a]=TierList.catalogoVigente([],[{id:'a',nombre:'A',categoria:'mercados',sector}]);assert.equal(a.industria,industria);assert.equal(a.subindustria,subindustria);
 }
 const c=TierList.catalogoVigente([{id:'fijo',nombre:'Fijo',tipo:'empresa',industria:'salud'}],[{id:'fijo',nombre:'Fijo Radar',categoria:'mercados',sector:'Energía'},{id:'aliado',nombre:'Aliado',categoria:'aliados',sector:'Salud'},{id:'fuera',nombre:'Fuera',categoria:'competidores'},{id:'descartado',nombre:'Descartado',categoria:'mercados',estado:'descartado'}]);
 assert.equal(c.length,2);assert.equal(c[0].industria,'salud');assert.equal(c[1].industria,'gremios_publico');
});

test('Colsubsidio entra en salud sin recargar; A3 agrupa el antes inicial y último después; A4/A5 auditan cada guardado',async()=>{
 const s=entorno(),id='mercados-colsubsidio-muyo9fv2-z6o7';
 assert(!(await s.req('catalogo-actores')).data.some(a=>a.id===id));
 s.actor(id,'mercados',{nombre:'Colsubsidio',sector:'salud y gestión de riesgos laborales'});
 const catalogo=(await s.req('catalogo-actores')).data;assert.equal(catalogo.find(a=>a.id===id).industria,'salud');
 const sorteo=TierList.sortear(cfg.participantes,catalogo,()=>0.4);await s.req('parejas','PUT',sorteo);
 const grupo=sorteo.grupos.find(g=>g.industrias.includes('salud'));
 assert(TierList.actoresDelGrupo(grupo,catalogo).some(a=>a.id===id));
 const body={sorteoId:sorteo.id,grupoId:grupo.id,actorId:id,nivel:1,editadoPor:admin.nombre};
 for(const nivel of [2,3,null,1])assert.equal((await s.req('tierlist','PUT',{...body,nivel})).status,200);
 const h3=[...s.bucket('historial').values()].filter(r=>r.actividad==='A3'&&r.coleccion==='tierlist');
 assert.equal(h3.length,1);assert.match(h3[0].id,new RegExp('^tierlist:'+grupo.id+':'));assert.equal(h3[0].movimientos,4);assert.deepEqual(h3[0].antes,[]);assert.equal(h3[0].despues[0].nivel,1);
 for(const i of [4,5])assert.equal((await s.req('priorizacion-votos','PUT',calificacion(id,i))).status,200);
 assert.equal((await s.req('priorizacion-votos?resumen=1')).data[0].nombre,'Colsubsidio');
 for(const aporte of ['Primero','Segundo'])assert.equal((await s.req('rutas','PUT',ruta(id,{aporte,apoyo:admin.nombre}))).status,200);
 const h=[...s.bucket('historial').values()];assert.equal(h.filter(r=>r.coleccion==='priorizacion-votos').length,2);assert.equal(h.filter(r=>r.coleccion==='rutas').length,2);
 const ult=h.find(r=>r.coleccion==='rutas'&&r.accion==='editar');assert.equal(ult.antes.aporte,'Primero');assert.equal(ult.despues.aporte,'Segundo');
 assert.equal((await s.req('rutas','PUT',ruta(id,{apoyo:participante.nombre}))).status,400);
 como(s,participante);assert.equal((await s.req('historial')).status,403);assert.equal((await s.req('rutas')).data[0].aporte,'Segundo');
 como(s,disenador);assert.equal((await s.req('historial')).status,200);
 como(s,admin);assert.equal((await s.req('historial','DELETE',{})).status,405);
});

test('Participante edita A1/A2 y su grupo iniciado; no puede editar grupos ajenos',async()=>{
 const s=entorno(),cat=(await s.req('catalogo-actores')).data,sorteo=TierList.sortear(cfg.participantes,cat,()=>0.5);await s.req('parejas','PUT',sorteo);
 const grupo=sorteo.grupos[0],otro=sorteo.grupos[1],id=TierList.actoresDelGrupo(grupo,cat)[0].id;
 como(s,{nombre:grupo.integrantes[0],rol:'participante'});
 const body={sorteoId:sorteo.id,grupoId:grupo.id,actorId:id,nivel:2,editadoPor:grupo.integrantes[0]};
 assert.equal((await s.req('tierlist','PUT',body)).status,403);
 s.bucket('parejas').get('vigente').iniciado=true;
 assert.equal((await s.req('tierlist','PUT',body)).status,200);
 assert.equal((await s.req('tierlist','PUT',{...body,grupoId:otro.id,actorId:TierList.actoresDelGrupo(otro,cat)[0].id})).status,403);
 assert.equal((await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto:'Participación'})).status,201);
 assert.equal((await s.req('actors','POST',{nombre:'Actor participante',categoria:'aliados'})).status,201);
});

test('A4: observadores ven mensaje y resultados, sin formulario de calificación',async()=>{
 for(const persona of [participante,disenador]){
  const s=entorno(),$=dom(s.context);como(s,persona);s.actor('a');s.nivel1('a');
  vm.runInContext(html.split('// ACTIVIDAD 4: INICIO JS')[1].split('// ACTIVIDAD 4: FIN JS')[0],s.context);
  await $('view-priorizacion').handlers['vista:activar']();await new Promise(r=>setImmediate(r));
  assert.match($('p4Editor').innerHTML,/Solo los administradores califican en esta actividad/);assert.doesNotMatch($('p4Editor').innerHTML,/<form/);
 }
});

test('Entrada completa: solicita contraseña, bloquea hasta cambiarla, restaura sesión y Cambiar de persona la cierra',async()=>{
 const s=entorno();como(s,null);const $=dom(s.context),{api,memoria}=acceso(s);
 const config=structuredClone(cfg);config.credenciales[admin.nombre].hashInicial=await api.hash(config.credenciales[admin.nombre].salt,'Inicial-prueba');
 s.context.localStorage=s.context.window.localStorage;
 s.context.Asistentes=(await import('../public/asistentes.js')).default;
 s.context.CustomEvent=class{constructor(type,opts){this.type=type;this.detail=opts.detail;}};
 s.context.document.body={classList:{toggle(){}},dataset:{}};s.context.document.querySelectorAll=()=>[];s.context.document.dispatchEvent=()=>{};
 const fetch=s.context.fetch;s.context.fetch=(url,init)=>url==='asistentes-config.json'?Promise.resolve(Response.json(config)):fetch(url,init);
 const bloque=html.split('// ENTRADA: INICIO JS')[1].split('// ENTRADA: FIN JS')[0].split('\n').slice(1).join('\n');
 vm.runInContext(bloque,s.context);await new Promise(r=>setImmediate(r));
 $('entradaNombre').value=admin.nombre;
 await $('entradaForm').handlers.submit({preventDefault(){}});assert.match($('entradaMsg').textContent,/contraseña de administrador/);assert.equal(s.context.window.Identidad,null);
 $('entradaClave').value='Inicial-prueba';await $('entradaForm').handlers.submit({preventDefault(){}});
 assert.equal($('entradaNuevaCampos').hidden,false);assert.equal(s.context.window.Identidad,null);
 $('entradaNueva').value='Nueva-contraseña';$('entradaConfirmacion').value='Nueva-contraseña';
 await $('entradaForm').handlers.submit({preventDefault(){}});
 assert.equal(s.context.window.Identidad.rol,'administrador');assert.equal($('identidadFacilitador').textContent,'Administrador');assert.equal($('descargarInforme').hidden,false);assert.equal($('verHistorial').hidden,false);
 assert(memoria.has('ruta-identidad'));
 como(s,null);vm.runInContext(bloque,s.context);await new Promise(r=>setImmediate(r));assert.equal(s.context.window.Identidad.nombre,admin.nombre);
 $('cambiarPersona').handlers.click();assert.equal(api.sesion(admin.nombre),false);assert.equal(s.context.window.Identidad,null);assert(!memoria.has('ruta-identidad'));
 for(const persona of [disenador,participante]){
  $('entradaNombre').value=persona.nombre;await $('entradaForm').handlers.submit({preventDefault(){}});
  assert.equal(s.context.window.Identidad.rol,persona.rol);assert.equal($('descargarInforme').hidden,persona.rol==='participante');assert.equal($('verHistorial').hidden,persona.rol==='participante');
  $('cambiarPersona').handlers.click();
 }
});

test('A5: administrador ve responsable y apoyo; observadores ven rutas en vivo con campos deshabilitados',async()=>{
 for(const persona of [admin,participante,disenador]){
  const s=entorno(),$=dom(s.context);como(s,persona);
  s.actor('nuevo','mercados',{nombre:'Nuevo actor',sector:'Salud'});s.nivel1('nuevo');s.bucket('seleccion').set('vigente',{actorIds:['nuevo']});s.bucket('rutas').set('nuevo',ruta('nuevo',{apoyo:admin.nombre,aporte:'Inicial'}));
  let sondeo;s.context.setInterval=fn=>{sondeo=fn;return 1;};
  vm.runInContext(html.split('// ACTIVIDAD 5: INICIO JS')[1].split('// ACTIVIDAD 5: FIN JS')[0],s.context);
  $('view-canvas').handlers['vista:activar']();await new Promise(r=>setImmediate(r));
  const editor=$('p5Editor').innerHTML;assert.match(editor,/Nuevo actor/);assert.match(editor,/id="p5Apoyo"/);assert.match($('p5Hoja').innerHTML,/Apoyo:<\/strong> Luis Felipe Barrientos/);
  const responsable=editor.match(/id="p5Responsable"[^>]*>(.*?)<\/select>/)[1],apoyo=editor.match(/id="p5Apoyo"[^>]*>(.*?)<\/select>/)[1];
  for(const n of cfg.administradores)assert(!responsable.includes(n));for(const n of cfg.disenadores)assert(!responsable.includes(n)&&!apoyo.includes(n));assert(!apoyo.includes(participante.nombre));assert(apoyo.includes(admin.nombre));
  if(persona.rol==='administrador'){assert.doesNotMatch(editor,/ disabled/);assert.doesNotMatch(editor,/es-ejemplo/);}
  else{assert.match(editor,/Solo los administradores editan/);assert.match(editor,/id="p5Responsable" disabled/);assert.match(editor,/type="submit" class="btn" disabled/);}
  s.bucket('rutas').get('nuevo').aporte='Actualizado en vivo';await sondeo();assert.match($('p5Editor').innerHTML,/Actualizado en vivo/);assert.match($('p5Hoja').innerHTML,/Actualizado en vivo/);
 }
});

test('Historial: ventanas de diez minutos y guardados simultáneos conservan el estado completo',async()=>{
 const s=entorno(),cat=(await s.req('catalogo-actores')).data,sorteo=TierList.sortear(cfg.participantes,cat,()=>0.3);await s.req('parejas','PUT',sorteo);
 let ahora=Date.parse('2026-10-08T12:01:00Z');s.context.Date=class extends Date{constructor(...args){super(...(args.length?args:[ahora]));}static now(){return ahora;}};
 const grupo=sorteo.grupos[0],actores=TierList.actoresDelGrupo(grupo,cat).slice(0,2);
 const body=a=>({sorteoId:sorteo.id,grupoId:grupo.id,actorId:a.id,nivel:2,editadoPor:admin.nombre});
 const respuestas=await Promise.all(actores.map(a=>s.req('tierlist','PUT',body(a))));assert(respuestas.every(r=>r.status===200));
 let h=[...s.bucket('historial').values()].filter(r=>r.coleccion==='tierlist');assert.equal(h.length,1);assert.equal(h[0].movimientos,2);assert.equal(h[0].despues.length,2);
 ahora+=600000;await s.req('tierlist','PUT',{...body(actores[0]),nivel:null});
 h=[...s.bucket('historial').values()].filter(r=>r.coleccion==='tierlist');assert.equal(h.length,2);assert.equal(h[1].antes.length,2);assert.equal(h[1].despues.length,1);assert.equal(h[0].despues.length,2);
});

test('Historial: falla de datos no audita; falla de auditoría explica que el dato sí se guardó',async()=>{
 const s=entorno(),ideas=s.bucket('ideas');ideas.set=()=>{throw Error('Base no disponible');};
 assert.equal((await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto:'Intento'})).status,500);assert.equal(s.bucket('historial').size,0);
 delete ideas.set;s.bucket('historial').set=()=>{throw Error('Historial no disponible');};
 const r=await s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto:'Guardado'});assert.equal(r.status,500);assert.match(r.data.error,/El dato se guardó/);assert.equal(ideas.size,1);
});

test('Control de cambios: lista, filtros, detalle escapado, sondeo y cierre al cambiar de persona',async()=>{
 const s=entorno(),$=dom(s.context);let cambio,sondeo;
 s.context.document.addEventListener=(tipo,fn)=>{if(tipo==='identidad:cambio')cambio=fn;};
 s.context.setInterval=fn=>{sondeo=fn;return 1;};
 const dlg=$('historialDialog');dlg.open=false;dlg.showModal=()=>dlg.open=true;dlg.close=()=>dlg.open=false;
 s.bucket('historial').set('1',{id:'1',coleccion:'rutas',docId:'a',actividad:'A5',accion:'crear',quien:admin.nombre,rol:'administrador',fecha:'2026-10-08T12:00:00Z',antes:null,despues:{actorId:'a',aporte:'<img src=x onerror=alert(1)>'}});
 s.bucket('historial').set('2',{id:'2',coleccion:'ideas',docId:'i',actividad:'A1',accion:'crear',quien:participante.nombre,rol:'participante',fecha:'2026-10-08T12:01:00Z',antes:null,despues:{texto:'Idea'}});
 vm.runInContext(read('../public/historial.js'),s.context);
 $('verHistorial').handlers.click();await new Promise(r=>setImmediate(r));
 const lista=$('historialLista').innerHTML;assert(lista.indexOf(participante.nombre)<lista.indexOf(admin.nombre));assert.match(lista,/&lt;img/);assert.doesNotMatch(lista,/<img/);assert.match(lista,/Ver antes y después/);
 $('historialActividad').value='A5';$('historialActividad').handlers.input();assert.doesNotMatch($('historialLista').innerHTML,/Idea/);
 $('historialBuscar').value='barrientos';$('historialBuscar').handlers.input();assert.match($('historialLista').innerHTML,/Creó ruta/);
 $('historialBuscar').value='ausente';$('historialBuscar').handlers.input();assert.match($('historialLista').innerHTML,/No hay cambios/);
 $('historialBuscar').value='';await sondeo();assert.match($('historialLista').innerHTML,/Creó ruta/);
 como(s,participante);cambio();assert.equal(dlg.open,false);assert.equal($('historialLista').innerHTML,'');$('verHistorial').handlers.click();assert.equal(dlg.open,false);
});

test('Historial conserva al autor de la solicitud aunque cambie la identidad durante el guardado',async()=>{
 const s=entorno();const pendiente=s.req('ideas','POST',{horizonte:'corto',preguntaId:'corto-1',texto:'En curso'});
 como(s,participante);assert.equal((await pendiente).status,201);
 assert.equal([...s.bucket('historial').values()][0].quien,admin.nombre);
});

test('Participante: todo DELETE y descarte equivalente devuelve 403 sin escribir',async()=>{
 const s=entorno();s.actor('a');como(s,participante);
 for(const route of ['ideas','actors','contactos?id=c','priorizacion-votos','rutas','tierlist','parejas','canvas','matriz','gremios-votos','gremios-taller','activacion-votos','seleccion','credenciales','historial']){
  assert.equal((await s.req(route,'DELETE',{id:'a',actorId:'a',votante:participante.nombre})).status,403,route);
 }
 for(const [m,b] of [['POST',{nombre:'Descartado',categoria:'mercados',estado:'descartado'}],['PATCH',{id:'a',patch:{estado:'descartado'}}]])assert.equal((await s.req('actors',m,b)).status,403);
 assert.equal(s.bucket('actors').get('a').estado,'verificado');assert.equal(s.bucket('historial').size,0);
 assert(!s.calls.some(([,o])=>['POST','DELETE'].includes(o.method)));
 como(s,admin);assert.equal((await s.req('actors','PATCH',{id:'a',patch:{estado:'descartado'}})).status,200);
 assert.equal(s.bucket('actors').get('a').estado,'descartado');
});

for(const categoria of ['mercados','aliados'])test('Actor nuevo A2 '+categoria+': participante y administrador ubican en todos los niveles y A4 lo califica',async()=>{
 const s=entorno();como(s,participante);
 const alta=await s.req('actors','POST',{nombre:'Actor nuevo '+categoria,categoria,sector:'Salud'});assert.equal(alta.status,201);
 const id=alta.data.id;
 como(s,admin);const catalogo=(await s.req('catalogo-actores')).data,sorteo=TierList.sortear([participante.nombre,'Compañero'],catalogo,()=>0.5);
 assert.equal((await s.req('parejas','PUT',sorteo)).status,200);assert.equal((await s.req('parejas','PATCH',{iniciado:true})).status,200);
 const body={sorteoId:sorteo.id,grupoId:sorteo.grupos[0].id,actorId:id};
 for(const persona of [participante,admin]){
  como(s,persona);
  for(const nivel of [1,2,3,4,null,1])assert.equal((await s.req('tierlist','PUT',{...body,nivel,editadoPor:persona.nombre})).status,200);
 }
 assert.equal((await s.req('priorizacion-votos','PUT',calificacion(id))).status,200);
 assert.equal((await s.req('priorizacion-votos?resumen=1')).data[0].mejorNivel,1);
 assert.deepEqual((await s.req('lista-rutas')).data.actorIds,[id]);
});
