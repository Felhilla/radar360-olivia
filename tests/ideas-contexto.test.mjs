import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import Ideas from '../public/ideas.js';
const respuesta=(texto,preguntaId='corto-1',extra={})=>({texto,preguntaId,horizonte:'corto',...extra});

test('Contexto: apariciones y respuestas distintas con tildes, mayúsculas y tokens completos',()=>{
 const rs=[respuesta('INNOVACIÓN, innovacion e innovacio\u0301n'),respuesta('Innovación; innovación-extra'),respuesta('innovaciones')];
 const m=Ideas.resultados(rs,'corto','INNOVACION');
 assert.equal(m.detalle.frecuencia,5);
 assert.equal(m.detalle.total,2);
 assert.equal(m.detalle.frecuencia,Ideas.contar(rs).find(p=>Ideas.clavePalabra(p.palabra)==='innovacion').frecuencia);
 assert.equal((Ideas.resaltar(rs[0].texto,'innovacion').match(/<mark>/g)||[]).length,3);
 assert.equal(Ideas.resaltar('innovaciones','innovación'),'innovaciones');
});
test('Contexto: resumen y detalle agrupados por pregunta, incluido legado y horizontes aislados',()=>{
 const rs=[respuesta('Mercado'),respuesta('Mercado nuevo','corto-2'),respuesta('Aliados','corto-2'),respuesta('Mercado',null),respuesta('Mercado','medio-1',{horizonte:'medio'})];
 const m=Ideas.resultados(rs,'corto','mercado');
 assert.equal(m.total,4);
 assert.deepEqual(m.grupos.map(g=>g.respuestas.length),[1,2,0,0,1]);
 assert.deepEqual(m.detalle.grupos.map(g=>g.id),['corto-1','corto-2','sin-pregunta']);
 assert.equal(m.detalle.grupos[1].texto,Ideas.preguntas.corto[1].texto);
 assert.equal(m.detalle.total,3);
});
test('Contexto: ambos tipos de ejemplo se excluyen de resumen, nube y detalle',()=>{
 const m=Ideas.resultados([respuesta('Mercado'),respuesta('Mercado secreto',undefined,{facilitador:true}),respuesta('Mercado secreto',undefined,{ejemploCompartido:true})],'corto','mercado');
 assert.equal(m.total,1);
 assert.deepEqual(m.palabras,[{palabra:'mercado',frecuencia:1}]);
 assert.equal(m.detalle.total,1);
 assert.equal(m.grupos[0].respuestas.length,1);
});
test('Contexto: escapa todo el HTML y resalta manteniendo la escritura original',()=>{
 const texto='<img src="x" onerror=\'alert(1)\'> & INNOVACIÓN innovacio\u0301n';
 const salida=Ideas.resaltar(texto,'innovacion');
 assert.equal(salida,'&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; <mark>INNOVACIÓN</mark> <mark>innovacio\u0301n</mark>');
 assert.doesNotMatch(salida,/<img/);
});
test('Contexto: panel persiste actualizado tras render, cambia de palabra y cierra al desaparecer',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const source=html.slice(html.indexOf('  var ideasPalabrasActivas = {}'),html.indexOf('  function renderIdeas(){'));
 const hosts=new Map(['corto','medio','largo'].map(hz=>['ideasNube-'+hz,{innerHTML:'',contains:()=>true}]));
 const context=vm.createContext({Ideas,HORIZON_ORDER:['corto','medio','largo'],ideasState:{stickers:[respuesta('Innovación mercado')]},document:{getElementById:id=>hosts.get(id)}});
 vm.runInContext(source,context);
 context.renderResultadosIdeas();
 const host=hosts.get('ideasNube-corto');
 const click=palabra=>host.onclick({target:{closest:()=>({dataset:{palabra},hasAttribute:a=>a===(palabra?'data-palabra':'data-cerrar-detalle')})}});
 click('innovacion');
 assert.match(host.innerHTML,/aria-pressed="true"/);
 assert.match(host.innerHTML,/aparece 1 veces en 1 respuestas/);
 context.ideasState.stickers.push(respuesta('INNOVACION INNOVACIÓN','corto-2'));
 context.renderResultadosIdeas();
 assert.match(host.innerHTML,/aparece 3 veces en 2 respuestas/);
 assert.match(host.innerHTML,/<mark>INNOVACIÓN<\/mark>/);
 assert.match(host.innerHTML,/¿Olivia ha identificado algún mercado/);
 click('mercado');
 assert.match(host.innerHTML,/«mercado» aparece 1/);
 click(null);
 assert.doesNotMatch(host.innerHTML,/class="ideas-detalle"/);
 click('innovacion');
 context.ideasState.stickers=[respuesta('Mercado')];
 context.renderResultadosIdeas();
 assert.equal(context.ideasPalabrasActivas.corto,null);
 assert.doesNotMatch(host.innerHTML,/class="ideas-detalle"/);
 context.ideasState.stickers=[];
 context.renderResultadosIdeas();
 assert.match(host.innerHTML,/0 respuestas/);
});
