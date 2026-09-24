// Ejecutar: node --experimental-vm-modules --test tests/priorizacion-votos.test.mjs
// Sin red: módulos y almacenamiento inyectados en un contexto aislado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../netlify/functions/priorizacion-votos.js', import.meta.url), 'utf8');
const config = JSON.parse(readFileSync(new URL('../netlify/functions/priorizacion-criterios.json', import.meta.url), 'utf8'));
async function entorno() {
  const stores = new Map(), calls=[];
  function store(name) {
    if(!stores.has(name)) {
      const data = new Map();
      stores.set(name, { data, extra:0, pages:0,
        async get(key){return data.get(key)||null;},
        async setJSON(key,value){data.set(key,structuredClone(value));},
        async delete(key){data.delete(key);},
        async *list(options){assert.equal(options.paginate,true);const keys=[...data.keys(),...Array.from({length:this.extra},(_,i)=>'extra-'+i)];for(let i=0;i<keys.length;i+=37){this.pages++;yield {blobs:keys.slice(i,i+37).map(key=>({key}))};}}
      });
    }
    return stores.get(name);
  }
  const context = vm.createContext({Response,URL,Date,console});
  const blobs = new vm.SyntheticModule(['getStore'],function(){this.setExport('getStore',opts=>{calls.push(opts);assert.equal(opts.consistency,'strong');return store(opts.name);});},{context});
  const module = new vm.SyntheticModule(['default'],function(){this.setExport('default',config);},{context});
  const fn = new vm.SourceTextModule(source,{context,initializeImportMeta(meta){meta.url='file:///mock/priorizacion-votos.js';}});
  await fn.link(spec=>spec==='@netlify/blobs'?blobs:module);await fn.evaluate();
  const actors=store('radar360'), votes=store('priorizacion-votos');
  for(const id of ['a','b','c','d']) actors.data.set(id,{id,nombre:'Actor '+id,categoria:'mercados',sector:'Servicios',estado:'verificado'});
  actors.data.set('descartado',{id:'descartado',estado:'descartado'});
  async function req(method='GET',body,query=''){
    const r=await fn.namespace.default(new Request('http://local/api/priorizacion-votos'+query,{method,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body),headers:{'content-type':'application/json'}})}));
    return {status:r.status,data:await r.json()};
  }
  return {req,actors,votes,fn:fn.namespace,calls};
}
const eje=(name,n)=>Object.fromEntries(config[name].map(c=>[c.id,n]));
const voto=(actorId='a',votante='Ana',i=3,e=3)=>({actorId,votante,impacto:eje('impacto',i),esfuerzo:eje('esfuerzo',e)});
test('Fuente única: diez criterios, pesos, escala y provisional',async()=>{
 const {req,calls}=await entorno();const r=await req('GET',undefined,'?criterios=1');assert.deepEqual(r.data,config);assert.equal(calls.length,0);
 for(const axis of ['impacto','esfuerzo']){assert.equal(config[axis].length,5);assert.equal(config[axis].reduce((s,c)=>s+c.peso,0),100);assert.equal(Object.keys(config.escala[axis]).length,5);}
 assert.equal(config.provisional,true);assert.equal(config.umbral,3);assert.equal(config.cuadrantes.length,4);
});
test('GET/PUT/upsert por slug/DELETE; actor descartado y votos inválidos',async()=>{
 const {req,votes}=await entorno();assert.deepEqual((await req()).data,[]);
 assert.equal((await req('PUT',voto('a','  ÁNA  '))).status,200);
 assert.equal((await req('PUT',voto('a','ana',4,2))).status,200);assert.equal(votes.data.size,1);assert.ok(votes.data.has('a--ana'));
 assert.equal((await req()).data[0].impacto.I1,4);
 for(const b of [null,{},voto('inexistente'),voto('descartado'),voto('a',' '),voto('a','a'.repeat(61)),{...voto(),impacto:{I1:3}},{...voto(),impacto:{...eje('impacto',3),I1:2.5}},{...voto(),esfuerzo:eje('esfuerzo',6)},{...voto(),esfuerzo:eje('esfuerzo','3')},{...voto(),borrador:true}])assert.equal((await req('PUT',b)).status,400);
 assert.equal((await req('PUT','{')).status,400);assert.equal((await req('POST',voto())).status,405);
 assert.equal((await req('DELETE',{actorId:'a',votante:'Ána'})).status,200);assert.equal(votes.data.size,0);
});
test('Ejemplo Excel: impacto 4,00 y esfuerzo 1,80; los cuatro cuadrantes y frontera 3,0',async()=>{
 const {req,fn}=await entorno();
 const sample={...voto(),impacto:{I1:4,I2:5,I3:4,I4:4,I5:3},esfuerzo:{E1:1,E2:3,E3:1,E4:2,E5:2}};
 assert.equal(fn.indice(sample.impacto,'impacto'),4);assert.equal(fn.indice(sample.esfuerzo,'esfuerzo'),1.8);
 for(const [i,e,q] of [[3,3,'apuestas-estrategicas'],[3,2.99,'victorias-tempranas'],[2.99,3,'racionalizacion'],[2.99,2.99,'mantenimiento-selectivo'],[5,5,'apuestas-estrategicas'],[1,1,'mantenimiento-selectivo']]) assert.equal(fn.cuadrante(i,e).id,q);
 for(const [id,i,e] of [['a',3,3],['b',3,2],['c',2,3],['d',2,2]])await req('PUT',voto(id,'Ana',i,e));
 const rows=(await req('GET',undefined,'?resumen=1')).data;
 assert.deepEqual(rows.map(r=>r.cuadrante.id),['apuestas-estrategicas','victorias-tempranas','racionalizacion','mantenimiento-selectivo']);
 assert.deepEqual(Object.keys(rows[0]),['actorId','nombre','categoria','sector','indiceImpacto','indiceEsfuerzo','cuadrante','votos']);
});
test('Promedio por participante, redondeo final y exclusión de actores descartados/eliminados',async()=>{
 const {req,actors,votes}=await entorno();
 await req('PUT',voto('a','Ana',2,4));await req('PUT',voto('a','Luis',4,2));
 let r=(await req('GET',undefined,'?resumen=1')).data[0];assert.equal(r.indiceImpacto,3);assert.equal(r.indiceEsfuerzo,3);assert.equal(r.votos,2);assert.equal(r.cuadrante.id,'apuestas-estrategicas');
 await req('PUT',{...voto('a','Tercero'),impacto:{I1:3,I2:3,I3:3,I4:4,I5:3}});
 r=(await req('GET',undefined,'?resumen=1')).data[0];assert.equal(r.indiceImpacto,3.05);
 actors.data.get('a').mostrarEnRadar=false;assert.equal((await req('GET',undefined,'?resumen=1')).data.length,1);
 actors.data.get('a').estado='descartado';assert.deepEqual((await req('GET',undefined,'?resumen=1')).data,[]);
 assert.equal((await req('DELETE',{actorId:'a',votante:'Ana'})).status,200);
 actors.data.delete('a');assert.deepEqual((await req('GET',undefined,'?resumen=1')).data,[]);
 votes.data.set('partial',{actorId:'b',impacto:{},esfuerzo:{}});assert.deepEqual((await req('GET',undefined,'?resumen=1')).data,[]);
});
test('Paginación, límite de 20000 y actualización permitida al alcanzar el límite',async()=>{
 const {req,votes}=await entorno();
 for(let i=0;i<105;i++)votes.data.set('a--v'+i,voto('a','v'+i));
 assert.equal((await req()).data.length,105);assert.ok(votes.pages>=3);
 votes.extra=20000-votes.data.size;
 assert.equal((await req('PUT',voto('b'))).status,429);
 assert.equal((await req('PUT',voto('a','v0',5,1))).status,200);
 votes.extra++;assert.equal((await req()).status,429);
});
test('Clasificar antes de redondear: 2,996 se publica 3 pero sigue bajo',async()=>{
 const {req,votes}=await entorno();
 for(let i=0;i<50;i++){const v=voto('a','v'+i);if(i===0)v.impacto.I2=2;votes.data.set('a--v'+i,v);}
 const r=(await req('GET',undefined,'?resumen=1')).data[0];assert.equal(r.indiceImpacto,3);assert.equal(r.cuadrante.id,'racionalizacion');
});
