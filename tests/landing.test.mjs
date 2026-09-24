import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const config=JSON.parse(readFileSync(new URL('../public/landing-config.json',import.meta.url),'utf8'));
const code=html.split('// LANDING: INICIO JS')[1].split('// LANDING: FIN JS')[0];
class Node {
 constructor(id){this.id=id;this.handlers={};this.attrs={};this.dataset={};this.active=false;this.disabled=false;this.classList={toggle:(_,v)=>this.active=v};}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
 dispatchEvent(e){for(const f of this.handlers[e.type]||[])f(e);}
 setAttribute(k,v){this.attrs[k]=v;}
 removeAttribute(k){delete this.attrs[k];}
 focus(){}
 closest(){return this;}
 set innerHTML(v){this.html=v;this.links=[...v.matchAll(/<a href="([^"]*)" data-view="([^"]*)"/g)].map(m=>{const a=new Node();a.dataset.view=m[2];a.href=m[1];return a;});}
 get innerHTML(){return this.html;}
 querySelectorAll(){return this.links||[];}
 querySelector(){return new Node();}
}
async function setup(hash='',fail=false){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const views=['inicio',...config.actividades.map(x=>x.vista)].map(x=>get('view-'+x));
 const win=new Node(),location={hash},stack=[hash];let pos=0;
 const history={pushState(_,__,h){stack.splice(++pos);stack[pos]=h;location.hash=h;},replaceState(_,__,h){stack[pos]=h;location.hash=h;}};
 const counts={priorizacion:0,canvas:0},intervals={priorizacion:0,canvas:0};
 // Ejecuta los dos listeners reales, conservando sus cierres y la guarda de inicio.
 for(const id of ['priorizacion','canvas']){
  const listener=html.match(new RegExp("    \\$\\('view-"+id+"'\\)\\.addEventListener\\('vista:activar'[\\s\\S]*?(?=\\n  \\}\\)\\(\\);)"))[0];
  vm.runInNewContext('let iniciado=false;'+listener,{$:get,setTimeout:fn=>fn(),setInterval:()=>intervals[id]++,cargar:()=>counts[id]++,POLL_MS:6000});
 }
 let failed=fail;
 const ctx={document:{getElementById:get,querySelectorAll:()=>views},window:win,history,location,Event,esc:x=>String(x??''),fetch:async()=>({ok:!failed,status:503,json:async()=>config})};
 win.scrollTo=()=>{};
 vm.runInNewContext(code,ctx);await new Promise(r=>setImmediate(r));
 const click=(node)=>node.dispatchEvent({type:'click',target:node,preventDefault(){}});
 const link=id=>{const a=get('rutaEnlaces').links.find(a=>a.dataset.view===id);get('rutaEnlaces').dispatchEvent({type:'click',target:a,preventDefault(){}});};
 const check=id=>{
  assert.deepEqual(views.filter(v=>v.active).map(v=>v.id),['view-'+id]);
  assert.equal(get('rutaSelector').value,id);
  assert.equal(get('rutaEnlaces').links.find(a=>a.attrs['aria-current']==='page').dataset.view,id);
  assert.equal(location.hash,id==='inicio'?'#inicio':'#actividad-'+config.actividades.find(a=>a.vista===id).numero);
 };
 return {get,win,location,counts,intervals,click,link,check,retry:async()=>{failed=false;click(get('landingReintentar'));await new Promise(r=>setImmediate(r));},back:()=>{location.hash=stack[--pos];win.dispatchEvent({type:'popstate'});},forward:()=>{location.hash=stack[++pos];win.dispatchEvent({type:'popstate'});}};
}
test('Inicio, todos los accesos, anterior/siguiente, límites y arranques perezosos',async()=>{
 const s=await setup();s.check('inicio');assert.deepEqual(s.counts,{priorizacion:0,canvas:0});
 for(const a of config.actividades){s.link(a.vista);s.check(a.vista);}
 assert.deepEqual(s.counts,{priorizacion:1,canvas:1});
 s.link('inicio');s.check('inicio');assert(s.get('rutaAnterior').disabled);
 for(const a of config.actividades){s.click(s.get('rutaSiguiente'));s.check(a.vista);}
 assert(s.get('rutaSiguiente').disabled);
 for(const id of ['priorizacion','matriz','radar','ideas','inicio']){s.click(s.get('rutaAnterior'));s.check(id);}
 assert.deepEqual(s.intervals,{priorizacion:1,canvas:1});
});
test('Hash inicial, atrás/adelante, cambio de hash, selector móvil y enlace de landing',async()=>{
 const s=await setup('#actividad-4');s.check('priorizacion');assert.equal(s.counts.priorizacion,1);
 s.link('canvas');s.back();s.check('priorizacion');s.forward();s.check('canvas');
 s.location.hash='#actividad-2';s.win.dispatchEvent({type:'hashchange'});s.check('radar');
 s.get('rutaSelector').dispatchEvent({type:'change',target:{value:'ideas'}});s.check('ideas');
 s.get('landingContenido').dispatchEvent({type:'click',target:{dataset:{view:'matriz'},closest(){return this;}},preventDefault(){}});s.check('matriz');
 s.location.hash='#invalido';s.win.dispatchEvent({type:'hashchange'});s.check('inicio');
 const direct=await setup('#actividad-5');direct.check('canvas');assert.equal(direct.counts.canvas,1);
});
test('Contenido completo, aviso provisional y recuperación de error de configuración',async()=>{
 const s=await setup();assert.equal(s.get('landingNota').hidden,false);assert.equal(s.get('landingNota').textContent,config.nota);
 for(const p of config.equipo.personas)assert(s.get('landingContenido').innerHTML.includes(p.bio));
 assert.equal(config.metodologia.lentes.length,6);assert.equal(config.propuesta.practicas.length,5);
 const f=await setup('',true);assert.equal(f.get('landingReintentar').hidden,false);await f.retry();f.check('inicio');
});
