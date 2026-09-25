// Sustituye el contrato anterior por Matriz/trigger con el embudo por actor.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {existsSync} from 'node:fs';
import {Embudo,entorno,calificacion,gremios,html,read,dom} from './embudo-support.mjs';
function base(){
 const s=entorno();const a=s.actor('e','mercados',{nombre:'Empresa'}),g=s.actor('g','aliados',{relevancia:'Red de contactos'});
 s.bucket('matriz').set('m',{id:'m',cliente:'Empresa',necesidadCritica:'Necesidad',respuestaOlivia:'Oferta original',trigger:false});
 return {...s,a,g,body:()=>Embudo.ficha(a,[...s.bucket('matriz').values()],gremios)};
}
test('Canvas de empresa: oferta editable, acciones independientes, sin nombre ni trigger, copia de contexto',async()=>{
 const s=base();let r=await s.req('canvas','PUT',{...s.body(),oferta:'Oferta acordada',acciones30:'Reunión',acciones60:'Piloto',acciones90:'Contrato',problema:'Inventado',nombre:'Falso'});
 assert.equal(r.status,200);assert.equal(r.data.oferta,'Oferta acordada');assert.equal(r.data.problema,'Necesidad');assert.equal(r.data.nombre,'Empresa');assert.equal(r.data.editadoPor,'');
 assert.equal(r.data.acciones30,'Reunión');assert.equal(r.data.acciones60,'Piloto');assert.equal(r.data.acciones90,'Contrato');assert(!('ruta90' in r.data));assert(Number.isFinite(Date.parse(r.data.updatedAt)));
 r=await s.req('canvas','PUT',{...s.body(),acciones60:'Otro piloto',editadoPor:' Julio '});assert.equal(r.data.editadoPor,'Julio');assert.equal(s.bucket('canvas').size,1);
 assert.equal((await s.req('canvas','DELETE',{id:s.body().id})).status,200);assert.deepEqual((await s.req('canvas')).data,[]);
});
test('Ficha de aliados: qué ofrece precargado, aporte Olivia y acciones 30/60/90',async()=>{
 const s=base(),b=Embudo.ficha(s.g,[],gremios);assert.equal(b.queOfrece,'Red de contactos');
 let r=await s.req('canvas','PUT',{...b,aporteOlivia:'Facilitación',acciones30:'Conectar',acciones60:'Taller',acciones90:'Ampliar'});
 assert.equal(r.status,200);assert.equal(r.data.id,'aliado:g');assert.equal(r.data.queOfrece,'Red de contactos');assert.equal(r.data.aporteOlivia,'Facilitación');
 assert.equal(r.data.acciones30,'Conectar');assert.equal(r.data.acciones60,'Taller');assert.equal(r.data.acciones90,'Ampliar');
 assert.equal(Embudo.contexto({id:gremios[0].id,categoria:'aliados'},[],gremios).oferta,gremios[0].oferta);
});
test('Validación nueva: actor existente, grupo/prefijo correcto, no descartados, límites y tipos',async()=>{
 const s=base(),b=s.body();
 for(const body of [null,{}, {...b,id:'e'},{...b,id:'aliado:e'},{...b,grupo:'aliados'},{...b,buyer:'a'.repeat(301)},{...b,sponsor:7},{...b,oferta:'a'.repeat(4001)},{...b,acciones30:[]},{...b,acciones60:'a'.repeat(4001)},{...b,acciones90:null},{...b,editadoPor:'a'.repeat(61)},{...b,aliado:{id:'ausente'}}])assert.equal((await s.req('canvas','PUT',body)).status,400,JSON.stringify(body));
 assert.equal((await s.req('canvas','PUT',{...b,id:'empresa:ausente',actorId:'ausente'})).status,404);
 s.bucket('actors').get('e').estado='descartado';assert.equal((await s.req('canvas','PUT',b)).status,400);
 s.bucket('actors').get('e').estado='verificado';s.bucket('actors').get('e').categoria='competidores';assert.equal((await s.req('canvas','PUT',b)).status,400);
 assert.equal((await s.req('canvas','PUT','{')).status,400);assert.equal((await s.req('canvas','POST',b)).status,405);assert.equal(s.bucket('canvas').size,0);
});
test('Aliado impulsor: solo aliado activado en cuadrante alto, nombre desde actor',async()=>{
 const s=base(),b={...s.body(),aliado:{id:'g',nombre:'Falso'}};
 assert.equal((await s.req('canvas','PUT',b)).status,400);
 await s.activar('g');await s.req('priorizacion-votos','PUT',calificacion('g',4,4));
 let r=await s.req('canvas','PUT',b);assert.equal(r.status,200);assert.equal(r.data.aliado.nombre,'g');
 await s.req('priorizacion-votos','PUT',calificacion('g',2,2));assert.equal((await s.req('canvas','PUT',b)).status,400);
});
test('CSV con BOM, fórmulas protegidas, comillas y saltos; GET pagina más de 1000',async()=>{
 const csv=Embudo.csv([['=1+1',' +CMD','@SUM','-2','"texto"','Línea\n2',null]]);
 assert(csv.startsWith('\ufeff'));assert(csv.includes('"\'=1+1"'));assert(csv.includes('"\' +CMD"'));assert(csv.includes('"\'@SUM"'));assert(csv.includes('"\'-2"'));assert(csv.includes('"""texto"""'));assert(csv.includes('"Línea\n2"'));
 const s=base();for(let i=0;i<1002;i++)s.bucket('canvas').set(String(i),{id:String(i)});assert.equal((await s.req('canvas')).data.length,1002);
});
test('Vista 5: grupo, borrador durante sondeo, guardado sin nombre, hoja y salida del embudo',async()=>{
 const s=base(),$=dom(s.context);vm.runInContext(html.split('// ACTIVIDAD 5: INICIO JS')[1].split('// ACTIVIDAD 5: FIN JS')[0],s.context);
 await $('view-canvas').handlers['vista:activar']();await new Promise(r=>setImmediate(r));assert.match($('p5Tarjetas-empresas').innerHTML,/Aún no hay/);
 for(const id of ['e','g']){await s.activar(id);await s.req('priorizacion-votos','PUT',calificacion(id));}
 await $('p5Reintentar').onclick();assert.match($('p5Tarjetas-empresas').innerHTML,/Empresa/);assert.match($('p5Tarjetas-aliados').innerHTML,/Red de contactos/);
 const card={dataset:{id:'empresa:e'},querySelector:()=>$('sello')};
 for(const [field,value] of [['oferta','Oferta editada'],['acciones30','Reunión'],['acciones60','Piloto'],['acciones90','Evaluar']])$('p5Tarjetas-empresas').handlers.input({target:{dataset:{field},value,closest:()=>card}});
 await $('p5Reintentar').onclick();assert.match($('p5Tarjetas-empresas').innerHTML,/Oferta editada/);
 await $('p5Tarjetas-empresas').handlers.click({target:{closest:()=>({dataset:{guardar:'empresa:e'}})}});
 assert.equal(s.bucket('canvas').get('empresa:e').acciones60,'Piloto');assert.equal(s.bucket('canvas').get('empresa:e').editadoPor,'');assert.match($('p5Hoja-empresas').innerHTML,/Último guardado/);
 await s.activar('e',1);await $('p5Reintentar').onclick();assert.match($('p5Tarjetas-empresas').innerHTML,/Aún no hay/);assert.match($('p5Hoja-empresas').innerHTML,/Fuera del embudo/);
});
test('Regresión: Radar, portada y landing fuera de actividades se conservan (la Actividad 1 cambió por el plan 08)',{skip:!existsSync(new URL('../../Radar360-web-backups/index_20260925_pre-embudo.html',import.meta.url))},()=>{
 const prev=read('../../Radar360-web-backups/index_20260925_pre-embudo.html');
 for(const id of ['radar','inicio']){
  const section=s=>s.match(new RegExp('<section class="view(?: active)?" id="view-'+id+'"[^>]*>[\\s\\S]*?</section>'))[0];assert.equal(section(html),section(prev));
 }

});
