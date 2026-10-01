import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {existsSync} from 'node:fs';
import {Embudo,config,canvasConfig,criterios,gremios,entorno,calificacion,read,html,dom} from './embudo-support.mjs';
test('Voto Sí/No: reemplazo por slug, cambio, retiro y métodos inválidos',async()=>{
 const s=entorno();s.actor('e');
 assert.equal((await s.activar('e',2,' Ána ')).status,200);
 assert.equal((await s.activar('e',1,'ana')).status,200);
 assert.equal(s.bucket('activacion-votos').size,1);assert.equal(s.bucket('activacion-votos').get('e--ana').valor,1);
 assert.equal((await s.activar('e',3)).status,400);
 for(const b of [null,{}, {actorId:'e',grupo:'aliados',votante:'Ana',valor:2},{actorId:'e',grupo:'empresas',votante:' ',valor:2},{actorId:'e',grupo:'empresas',votante:'a'.repeat(61),valor:2}])assert.equal((await s.req('activacion-votos','PUT',b)).status,400);
 assert.equal((await s.req('activacion-votos','POST',{})).status,405);
 assert.equal((await s.req('activacion-votos','PUT','{')).status,400);
 s.bucket('actors').get('e').estado='descartado';assert.equal((await s.activar('e')).status,400);
 assert.equal((await s.req('activacion-votos','DELETE',{actorId:'e',votante:'Ana'})).status,200);
 assert.equal(s.bucket('activacion-votos').size,0);
});
test('Promedio exacto 1,5 inclusivo, estricto configurable y sin votos',()=>{
 const as=[{id:'e',categoria:'mercados'},{id:'g',categoria:'aliados'},{id:'x',categoria:'competidores'},{id:'r',categoria:'autoridades'},{id:'d',categoria:'mercados',estado:'descartado'}];
 const vs=[{actorId:'e',grupo:'empresas',votante:'A',valor:2},{actorId:'e',grupo:'empresas',votante:'B',valor:1}];
 assert.equal(Embudo.resumen(as,vs,config)[0].promedio,1.5);
 assert.deepEqual(Embudo.activados(as,vs,config).map(a=>a.id),['e']);
 assert.equal(Embudo.activados(as,vs,{...config,inclusivo:false}).length,0);
 assert.equal(Embudo.activados(as,[],config).length,0);
 assert.equal(Embudo.activados(as,vs,{...config,umbral:2}).length,0);
 assert.equal(Embudo.activados(as,[...vs,{...vs[0],valor:1}],config).length,0);
 assert.throws(()=>Embudo.resumen(as,vs,{umbral:3,inclusivo:true}));
});
test('Actividad 4: solo Nivel 1, incluye ocultos y conserva contrato',async()=>{
 const s=entorno();s.actor('e','mercados',{mostrarEnRadar:false});s.actor('g','aliados');s.actor('c','competidores');s.actor('r','autoridades');s.actor('d','aliados',{estado:'descartado'});
 for(const id of ['e','g','c','r','d'])assert.equal((await s.req('priorizacion-votos','PUT',calificacion(id))).status,400);
 s.nivel1('e');s.nivel1('g');
 for(const id of ['e','g'])assert.equal((await s.req('priorizacion-votos','PUT',calificacion(id))).status,200);
 for(const id of ['c','r','d'])assert.equal((await s.activar(id)).status,400);
 let rs=(await s.req('priorizacion-votos?resumen=1')).data;
 assert.equal(rs.length,2);assert.deepEqual(Object.keys(rs[0]),['actorId','nombre','categoria','sector','indiceImpacto','indiceEsfuerzo','cuadrante','votos']);
 s.nivel1('e',2);rs=(await s.req('priorizacion-votos?resumen=1')).data;assert.deepEqual(rs.map(r=>r.actorId),['g']);
 assert.equal((await s.req('priorizacion-votos')).data.length,2,'se conservan calificaciones históricas');
 assert.equal(criterios.provisional,false);
 const prev=JSON.parse(read('../netlify/functions/priorizacion-criterios.json'));
 const {corte,...sinCorte}=criterios;assert.deepEqual({...sinCorte,provisional:true},prev);
});
test('Actividad 5: ambos cuadrantes altos y grupos; nunca un actor desactivado',async()=>{
 const s=entorno();
 for(const [id,cat,i,e] of [['e','mercados',3,2],['g','aliados',3,4],['b','mercados',2,2],['c','aliados',2,4]]){
  s.actor(id,cat);await s.activar(id);s.nivel1(id);await s.req('priorizacion-votos','PUT',calificacion(id,i,e));
 }
 const entradas=()=>Embudo.elegibles([...s.bucket('actors').values()],[...s.bucket('activacion-votos').values()],config,[...resumen],canvasConfig);
 const resumen=(await s.req('priorizacion-votos?resumen=1')).data;
 assert.deepEqual(entradas().map(a=>a.id),['e','g']);
 await s.activar('g',1);assert.deepEqual(entradas().map(a=>a.id),['e']);
});
test('Alta de gremio-aliado crea actor único con contexto y se puede activar/calificar',async()=>{
 const s=entorno();const r=await s.req('actors','POST',{nombre:'Nuevo gremio',categoria:'aliados',contacto:'Contacto',cuentas:'Empresa',oferta:'Taller'});
 assert.equal(r.status,201);assert.equal(r.data.contacto,'Contacto');assert.equal(r.data.cuentas,'Empresa');assert.equal(r.data.oferta,'Taller');
 assert.equal((await s.activar(r.data.id)).status,200);s.nivel1(r.data.id);assert.equal((await s.req('priorizacion-votos','PUT',calificacion(r.data.id))).status,200);
 assert.equal(s.bucket('gremios-taller').size,0);
 assert.equal(Embudo.contexto(r.data,[],gremios).oferta,'Taller');
});
const backup=new URL('../../Radar360-web-backups/supabase_20260925_pre-embudo.json',import.meta.url);
test('Volcado real: 48 empresas con contexto y recorrido 3 → 4 → 5 sin producción',{skip:!existsSync(backup)},async()=>{
 const datos=JSON.parse(read('../../Radar360-web-backups/supabase_20260925_pre-embudo.json')),s=entorno(datos);
 const as=[...s.bucket('actors').values()],ms=[...s.bucket('matriz').values()],empresas=as.filter(a=>Embudo.grupo(a)==='empresas');
 assert.equal(empresas.length,48);
 assert.deepEqual(empresas.filter(a=>!Embudo.contexto(a,ms,gremios)).map(a=>a.nombre),[]);
 assert.equal(new Set(empresas.map(a=>Embudo.contexto(a,ms,gremios).id)).size,44);
 for(const g of gremios)assert.equal(Embudo.grupo(as.find(a=>a.id===g.id)),'aliados');
 const ids=[empresas[0].id,'aliados-andesco'];
 for(const id of ids){await s.activar(id);s.nivel1(id);await s.req('priorizacion-votos','PUT',calificacion(id));const ficha=Embudo.ficha(as.find(a=>a.id===id),ms,gremios);const r=await s.req('canvas','PUT',{...ficha,acciones30:'Reunión',acciones60:'Piloto',acciones90:'Evaluar'});assert.equal(r.status,200);}
 assert.equal(s.bucket('canvas').size,2);
});
test('Embudo histórico: CSV de activados sigue disponible para consumidores existentes',()=>{
 const actores=[{id:'e',nombre:'Empresa',categoria:'mercados'}];
 const activados=Embudo.activados(actores,[{actorId:'e',grupo:'empresas',votante:'Ana',valor:2}],config);
 assert.equal(activados.length,1);
 assert.match(Embudo.csv(activados.map(a=>[a.nombre])),/Empresa/);
});
test('Vista Actividad 4: carga viva, filtros de grupo y salida del Nivel 1',async()=>{
 const s=entorno();s.actor('e','mercados',{nombre:'Empresa visible'});s.actor('g','aliados',{nombre:'Aliado visible'});s.actor('x','competidores');
 const $=dom(s.context);vm.runInContext(html.split('// ACTIVIDAD 4: INICIO JS')[1].split('// ACTIVIDAD 4: FIN JS')[0],s.context);
 const cargar=async()=>{await $('view-priorizacion').handlers['vista:activar']();await new Promise(r=>setImmediate(r));};
 await cargar();assert.match($('p4Actores').innerHTML,/Todavía no hay actores en el Nivel 1/);assert.equal($('p4Provisional').hidden,true);
 s.nivel1('e');s.nivel1('g');await cargar();
 assert.match($('p4Actores').innerHTML,/Empresa visible/);assert.match($('p4Actores').innerHTML,/Aliado visible/);assert(!$('p4Actores').innerHTML.includes('data-actor="x"'));
 $('p4Categoria').value='aliados';$('p4Categoria').handlers.input();assert(!$('p4Actores').innerHTML.includes('Empresa visible'));assert.match($('p4Actores').innerHTML,/Aliado visible/);
 s.nivel1('g',2);await cargar();assert(!$('p4Actores').innerHTML.includes('Aliado visible'));
});
