#!/usr/bin/env node
// Simulación sin red por defecto. --aplicar es la única habilitación de escritura.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

export function hash(value) {
  const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
export function validar(patches, base) {
  if (!Array.isArray(patches) || patches.length !== 55) throw new Error('Se requieren exactamente 55 upserts.');
  const ids = new Set();
  const prohibidos = /días|Tello|Barrientos|por identificar|confianza|Vía |interlocutor|contacto/i;
  const sectores = new Set(['Financiero','Energía','Servicios públicos','Minero','Retail','Consumo','Industrial','Telecomunicaciones','Salud']);
  for (const r of patches) {
    const a=r?.data;
    if(r.coleccion !== 'actors' || !a || r.id !== a.id || !/^mercados-[a-z0-9-]+$/.test(r.id) || ids.has(r.id)) throw new Error('Registro inválido o duplicado.');
    ids.add(r.id);
    if(a.categoria !== 'mercados' || !sectores.has(a.sector) || typeof a.articulacion !== 'string' || !a.articulacion.trim() || prohibidos.test(a.articulacion)) throw new Error('Articulación o sector inválido: '+r.id);
    if(base[r.id]) {
      const {sector, articulacion, ...preservado}=a;
      if(hash(preservado)!==base[r.id].preservado) throw new Error('Se modificaron campos protegidos: '+r.id);
      if(a.sector!==base[r.id].sectorResultante) throw new Error('Reclasificación no prevista: '+r.id);
    } else {
      if(a.sector!=='Minero' || a.estado!=='por_validar' || !a.queHace || !a.relevancia || !a.justificacion || !Array.isArray(a.fuentes)) throw new Error('Minero incompleto: '+r.id);
      for(const key of ['nombre','queHace','relevancia','articulacion','justificacion','notaVerificacion']) if(prohibidos.test(a[key]||'')) throw new Error('Texto nuevo no permitido: '+r.id);
    }
  }
  if(Object.keys(base).length!==48 || !Object.keys(base).every(id=>ids.has(id))) throw new Error('Faltan mercados vigentes del volcado.');
  return patches;
}
export async function ejecutar({patches,base,config,aplicar=false,fetchImpl=globalThis.fetch,log=console.log}) {
  validar(patches,base);
  if(!config?.supabaseUrl || !config?.supabaseAnonKey) throw new Error('Configuración Supabase incompleta.');
  const endpoint = new URL('/rest/v1/registros',config.supabaseUrl);
  if(endpoint.protocol!=='https:') throw new Error('La URL debe usar HTTPS.');
  log(aplicar?'APLICACIÓN solicitada; comprobando registros actuales.':'SIMULACIÓN — sin solicitudes de red ni escrituras.');
  for(const r of patches) log(`UPSERT actors/${r.id} | ${r.data.nombre} | ${base[r.id]?.sectorOriginal || '(nuevo)'} → ${r.data.sector} | registro completo + articulacion`);
  log(`Total: ${patches.length} upserts (48 existentes + 7 nuevos).`);
  if(!aplicar) return;
  const headers={apikey:config.supabaseAnonKey,Authorization:'Bearer '+config.supabaseAnonKey,'Content-Type':'application/json'};
  // Comprobar todo antes del único POST: impedir sobrescribir cambios posteriores al volcado.
  const query=new URL(endpoint); query.searchParams.set('coleccion','eq.actors');query.searchParams.set('id','in.('+patches.map(r=>r.id).join(',')+')');query.searchParams.set('select','id,data');
  const actual=await fetchImpl(query,{headers});
  if(!actual.ok) throw new Error('No se pudo verificar la base: HTTP '+actual.status);
  const registros=await actual.json();
  if(!Array.isArray(registros)) throw new Error('Respuesta de prevalidación inválida.');
  const actuales=new Map(registros.map(r=>[r.id,r.data]));
  const pendientes=[];
  for(const r of patches) {
    const vigente=actuales.get(r.id);
    if(vigente && hash(vigente)===hash(r.data)) continue; // Reejecución idempotente.
    if(base[r.id] ? !vigente || hash(vigente)!==base[r.id].original : vigente) throw new Error('Conflicto con cambios posteriores al volcado: '+r.id+'. No se escribió ningún registro.');
    pendientes.push(r);
  }
  if(!pendientes.length){log('Los 55 registros ya coinciden. Sin escrituras.');return;}
  const destino=new URL(endpoint);destino.searchParams.set('on_conflict','coleccion,id');
  const response=await fetchImpl(destino,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(pendientes)});
  if(!response.ok) throw new Error('Upsert rechazado: HTTP '+response.status);
  log('Aplicados: '+pendientes.length+' registros.');
}
async function main(){
  const args=process.argv.slice(2);
  let archivo=new URL('./patches_radar09_20260925.json',import.meta.url);
  let aplicar=false;
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--aplicar') aplicar=true;
    else if(args[i]==='--archivo' && args[i+1]) archivo=resolve(args[++i]);
    else throw new Error('Uso: node supabase/aplicar_radar09.mjs [--archivo ruta.json] [--aplicar]');
  }
  const patches=JSON.parse(await readFile(archivo,'utf8'));
  const base=JSON.parse(await readFile(new URL('./radar09-base.json',import.meta.url),'utf8'));
  const scope={window:{}};
  vm.runInNewContext(await readFile(new URL('../public/config.js',import.meta.url),'utf8'),scope,{timeout:1000});
  console.log('JSON: '+(typeof archivo==='string'?archivo:fileURLToPath(archivo)));
  await ejecutar({patches,base,config:scope.window.RADAR_CONFIG,aplicar});
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1;});
