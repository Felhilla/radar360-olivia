import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import FichaActor from '../public/ficha-actor.js';
import {entorno,dom,html} from './embudo-support.mjs';
const contacto={nombre:' Ana Pérez ',cargo:' Directora ',telefono:'+57 (123) 456-789',correo:'ana@empresa.co'};
const registro={...contacto,actorId:'mercados-a',registradoPor:'Felipe'};

test('Contacto: valida, recorta y acepta medios opcionales',()=>{
 const v=FichaActor.validarContacto(contacto);assert.equal(v.ok,true);assert.equal(v.valor.nombre,'Ana Pérez');
 assert.equal(FichaActor.validarContacto({nombre:'Ana',cargo:'Directora'}).ok,true);
 for(const [campo,valor] of [['correo','ana@'],['telefono','123abc789'],['nombre',' '],['cargo','x'],['correo','a'.repeat(161)+'@e.co'],['telefono','1'.repeat(21)],['nombre','x'.repeat(121)]]) assert.ok(FichaActor.validarContacto({...contacto,[campo]:valor}).errores[campo]);
 assert.deepEqual(Object.keys(FichaActor.validarContacto({}).errores),['nombre','cargo']);
});
test('Confianza: las cuatro etiquetas',()=>{
 assert.deepEqual(['alta','media','baja','por identificar'].map(FichaActor.etiquetaConfianza),['Confianza alta','Confianza media','Confianza baja · por verificar','Contacto por identificar']);
});
test('Ficha: informe, necesidad E/A, contacto por identificar y formulario opcional',()=>{
 for(const [tipo,texto] of [['E','necesidad explícita del gremio'],['A','necesidad de sus afiliadas']]){
  const h=FichaActor.htmlFicha({tipo:'gremio',por_que:'Motivo',dolor:'Dolor',necesidad_tipo:tipo},{contactoInforme:{nombre:'Por identificar',cargo:'Gerente',confianza:'baja'},puedeAgregar:true});
  for(const t of ['Motivo','Dolor',texto,'Nombre por identificar','Gerente','Confianza baja · por verificar','Registra solo datos de contacto corporativo. La información se entregará al equipo comercial de Olivia y se borrará de esta plataforma después del taller.']) assert.ok(h.includes(t));
  assert.match(h,/type="tel"/);assert.match(h,/type="email"/);assert.match(h,/aria-live="polite"/);
 }
 const h=FichaActor.htmlFicha({por_que:'No explícito en el informe'},{puedeAgregar:false});
 assert.doesNotMatch(h,/Agregar contacto/);assert.match(h,/ad-just ad-empty/);assert.match(h,/El informe no sugiere contacto para este actor/);assert.match(h,/Aún no hay contactos registrados/);
});
test('Ficha: todos los textos y atributos de datos escapan HTML',()=>{
 const x='<script>"&\'</script>',c=Object.fromEntries(['id','nombre','cargo','telefono','correo','registradoPor','createdAt','confianza'].map(k=>[k,x]));
 const h=FichaActor.htmlFicha({por_que:x,dolor:x},{contactoInforme:c,contactos:[c],puedeQuitar:true,aviso:x});
 assert.doesNotMatch(h,/<script>/);assert.ok(h.split('&lt;script&gt;').length>=10);assert.match(h,/&quot;/);assert.match(h,/&#39;/);
 assert.doesNotMatch(FichaActor.htmlFicha({},{contactos:[c]}),/>Quitar</);
});
test('Contactos: POST, GET filtrado y DELETE con validador compartido y fallback',async()=>{
 for(const compartido of [false,true]){
  const s=entorno();if(compartido)s.context.window.FichaActor=FichaActor;
  const r=await s.req('contactos','POST',registro);assert.equal(r.status,200);assert.match(r.data.id,/^mercados-a:/);assert.equal(r.data.nombre,'Ana Pérez');assert.ok(r.data.createdAt);
  assert.equal((await s.req('contactos?actorId=mercados-a')).data.length,1);
  assert.equal((await s.req('contactos?actorId=otro')).data.length,0);
  for(const datos of [{...registro,correo:'no'},{...registro,registradoPor:''},{...registro,actorId:''},{...registro,telefono:'letras'}]) assert.equal((await s.req('contactos','POST',datos)).status,400);
  assert.equal((await s.req('contactos?id='+encodeURIComponent(r.data.id),'DELETE')).status,200);
  assert.equal((await s.req('contactos')).data.length,0);
  assert.equal((await s.req('contactos','PUT',registro)).status,405);
 }
});
test('Contactos: límites de tamaño y cantidad',async()=>{
 const s=entorno();assert.equal((await s.req('contactos','POST',{...registro,extra:'á'.repeat(11000)})).status,400);
 for(let i=0;i<2000;i++)s.bucket('contactos').set(String(i),{id:String(i)});
 assert.equal((await s.req('contactos','POST',registro)).status,429);
});
test('Contactos del informe: solo lectura',async()=>{
 const s=entorno([{coleccion:'contactos-informe',id:'mercados-a',data:{actor_id:'mercados-a',nombre:'Ana',cargo:'Gerente',confianza:'alta'}}]);
 assert.equal((await s.req('contactos-informe')).data[0].nombre,'Ana');
 for(const m of ['POST','PUT','DELETE']) assert.equal((await s.req('contactos-informe',m,{})).status,405);
});
function fichaEntorno(){
 const s=entorno(),$=dom(s.context),dlg=$('actorDialog');dlg.showModal=()=>{dlg.open=true;};
 Object.assign(s.context,{FichaActor,currentActors:()=>({a:{id:'a',nombre:'Actor',categoria:'mercados'}}),CATS:{mercados:{label:'Mercados'}},GENERIC_LOGO_BY_CAT:{}});
 vm.runInContext(html.slice(html.indexOf('  // ACTIVIDAD 2 FICHA:'),html.indexOf('  function renderCompetidores()')),s.context);
 return {s,$,dlg};
}
test('La ficha abre sin identidad ni contactos y conserva los bloques actuales',async()=>{
 const {s,dlg}=fichaEntorno();const calls=[];
 s.context.fetch=async(url,init)=>{calls.push([url,init]);return Response.json(url==='data/actores.json'?[{id:'a',por_que:'Informe',dolor:'Dolor'}]:[]);};
 s.context.openActorDialog('a');assert.equal(dlg.open,true);assert.match(dlg.innerHTML,/Qué hace/);
 await new Promise(r=>setImmediate(r));
 assert.equal(s.context.window.Identidad,undefined);
 const host={innerHTML:'',querySelector:()=>null};
 // Sin formulario, el montaje solo necesita lista y aviso.
 host.querySelector=q=>q==='[data-contactos-lista]'?{addEventListener(){}}:q==='[data-contactos-aviso]'?{}:null;
 await s.context.montarFichaActor({id:'a'},host);assert.doesNotMatch(host.innerHTML,/Agregar contacto/);assert.match(host.innerHTML,/Aún no hay contactos registrados/);
 assert.equal(calls.filter(([u])=>u==='data/actores.json').length,1);assert.ok(calls.every(([,i])=>i.cache==='no-store'));
});
test('Un fallo de lectura conserva los textos del informe y muestra aviso',async()=>{
 const {s}=fichaEntorno();s.context.fetch=async url=>{if(url==='data/actores.json')return Response.json([{id:'a',por_que:'Informe disponible',dolor:'Dolor'}]);throw Error('sin red');};
 const host={innerHTML:'',querySelector:q=>q==='[data-contactos-lista]'?{addEventListener(){}}:q==='[data-contactos-aviso]'?{}:null};
 await s.context.montarFichaActor({id:'a'},host);assert.match(host.innerHTML,/Informe disponible/);assert.match(host.innerHTML,/No se pudieron cargar todos los contactos/);
});
function formularioHost(){
 const el=()=>({textContent:'',disabled:false,handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},setAttribute(){},focus(){}});
 const lista=el(),aviso=el(),abrir=el(),cancelar=el(),guardar=el(),error=el();
 const errores=['nombre','cargo','telefono','correo'].map(k=>({...el(),dataset:{error:k}}));
 const form={...el(),hidden:true,elements:Object.fromEntries(['nombre','cargo','telefono','correo'].map(k=>[k,{...el(),value:contacto[k]}])),reset(){Object.values(this.elements).forEach(e=>e.value='');},querySelector:q=>({'[data-cancelar-contacto]':cancelar,'[type="submit"]':guardar,'[data-contacto-error]':error}[q]),querySelectorAll:q=>q.includes('data-contacto-error')?[...errores,error]:errores};
 const host={innerHTML:'',querySelector:q=>({'[data-contactos-lista]':lista,'[data-contactos-aviso]':aviso,'form':form,'[data-agregar-contacto]':abrir}[q])};
 return {host,form,abrir,cancelar,guardar,error,lista};
}
test('Formulario: conserva lo escrito ante rechazo y limpia, pliega y refresca al guardar',async()=>{
 const {s}=fichaEntorno(),ui=formularioHost();let falla=true,lecturas=0,toasts=0;
 s.context.window.Identidad={nombre:'Felipe',rol:'participante'};s.context.showToast=()=>toasts++;
 s.context.fetch=async(url,init={})=>{
  if(url==='data/actores.json')return Response.json([{id:'a',por_que:'Informe'}]);
  if(init.method==='POST')return Response.json({}, {status:falla?500:200});
  if(url.includes('contactos?'))lecturas++;
  return Response.json([]);
 };
 await s.context.montarFichaActor({id:'a'},ui.host);ui.abrir.handlers.click();assert.equal(ui.form.hidden,false);
 await ui.form.handlers.submit({preventDefault(){}});
 assert.equal(ui.error.textContent,'No se pudo guardar el contacto. Intenta de nuevo.');assert.equal(ui.form.elements.nombre.value,contacto.nombre);assert.equal(ui.form.hidden,false);assert.equal(ui.guardar.disabled,false);
 falla=false;await ui.form.handlers.submit({preventDefault(){}});
 assert.equal(ui.form.hidden,true);assert.equal(ui.form.elements.nombre.value,'');assert.equal(toasts,1);assert.equal(lecturas,2);
 ui.abrir.handlers.click();ui.cancelar.handlers.click();assert.equal(ui.form.hidden,true);
});
