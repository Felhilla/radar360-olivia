// Todo fetch se resuelve en memoria. Una URL inesperada hace fallar la prueba.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import Embudo from '../public/embudo.js';
import Ideas from '../public/ideas.js';
export {Embudo};
export const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
export const html=read('../public/index.html');
export const criterios=JSON.parse(read('../public/priorizacion-criterios.json'));
export const config=JSON.parse(read('../public/embudo-config.json'));
export const canvasConfig=JSON.parse(read('../public/canvas-config.json'));
export const gremios=JSON.parse(html.match(/const GREMIOS_32 = (\[[\s\S]*?\n\s*\]);/)[1]);
export const eje=(k,n)=>Object.fromEntries(criterios[k].map(c=>[c.id,n]));
export const calificacion=(actorId,i=4,e=2)=>({actorId,votante:'Ana',impacto:eje('impacto',i),esfuerzo:eje('esfuerzo',e)});
export function entorno(seed=[]){
 const db=new Map(),calls=[];
 const bucket=c=>{if(!db.has(c))db.set(c,new Map());return db.get(c);};
 seed.forEach(r=>bucket(r.coleccion).set(r.id,structuredClone(r.data)));
 const context=vm.createContext({Ideas,Embudo,Response,URL,URLSearchParams,console,location:{href:'https://local.invalid/'},window:{RADAR_CONFIG:{supabaseUrl:'https://supabase.invalid',supabaseAnonKey:'mock-only'},fetch:async(url,init={})=>{
  calls.push([url,init]);
  if(url==='canvas-config.json')return Response.json(canvasConfig);
  if(url==='embudo-config.json')return Response.json(config);
  if(url==='priorizacion-criterios.json')return Response.json(criterios);
  const u=new URL(url);assert.equal(u.origin,'https://supabase.invalid');assert.equal(u.pathname,'/rest/v1/registros');
  if(init.method==='POST'){const r=JSON.parse(init.body);bucket(r.coleccion).set(r.id,r.data);return new Response(null,{status:201});}
  const col=u.searchParams.get('coleccion').slice(3),id=u.searchParams.get('id')?.slice(3);
  if(init.method==='DELETE'){bucket(col).delete(id);return new Response(null,{status:204});}
  let rows=[...bucket(col)].filter(([k])=>id===undefined||id===k).map(([id,data])=>({id,data}));
  const count=rows.length,range=init.headers.Range;if(range){const [a,b]=range.split('-').map(Number);rows=rows.slice(a,b+1);}
  return Response.json(rows,{headers:{'content-range':'0-0/'+count}});
 }}});
 vm.runInContext(read('../public/api-supabase.js'),context);
 async function req(route,method='GET',body){
  const r=await context.window.fetch('/api/'+route,{method,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json()};
 }
 const actor=(id,categoria='mercados',extra={})=>{const a={id,nombre:id,categoria,estado:'verificado',...extra};bucket('actors').set(id,a);return a;};
 const activar=(id,valor=2,votante='Ana')=>req('activacion-votos','PUT',{actorId:id,grupo:Embudo.grupo(bucket('actors').get(id)),votante,valor});
 return {bucket,calls,req,context,actor,activar};
}
export function dom(context){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,dataset:{},handlers:{},addEventListener(t,fn){this.handlers[t]=fn;},classList:{contains:()=>true},contains:()=>false,focus(){},querySelector:()=>element(id+'-child'),querySelectorAll:()=>[],appendChild(){},reset(){}});return elements.get(id);};
 context.document={getElementById:element,querySelector:()=>element('nav'),createElement:()=>element('new'),activeElement:null};
 context.fetch=context.window.fetch;context.localStorage={getItem(){throw Error('Bloqueado');},setItem(){throw Error('Bloqueado');}};
 context.setInterval=()=>0;context.setTimeout=fn=>fn();context.GREMIOS_32=gremios;context.POLL_MS=6000;
 context.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 context.getLogo=()=>'';context.sortedSectorKeys=(c,k)=>k.slice().sort();context.openActorDialog=()=>{};context.showToast=()=>{};
 return element;
}
