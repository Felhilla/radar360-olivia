// Los ejemplos compartidos históricos permanecen visibles y fuera de los resultados.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entorno,read,calificacion} from './embudo-support.mjs';
const actores=JSON.parse(read('../public/data/actores.json'));
const empresa=actores.find(a=>a.id==='mercados-ecopetrol-nacion-88-5');
const ruta=()=>({actorId:empresa.id,etiqueta:'venta_inmediata',responsable:'Diego Espejo'});
const como=(s,rol)=>{s.context.window.Identidad={nombre:'Diego Espejo',rol};};

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
