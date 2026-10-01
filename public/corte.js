/* Reglas puras del corte de la Actividad 4. */
(function(root){
  'use strict';
  // resumen incluye una fila por actor del Nivel 1, incluso sin votos.
  function ordenar(resumen,corte,gruposPorActor={}){
    const grupos=id=>Array.isArray(gruposPorActor[id])?new Set(gruposPorActor[id]).size:Number(gruposPorActor[id]||0);
    const rango=r=>{const i=corte.ordenCuadrantes.indexOf(r.cuadrante?.id);return i<0?Infinity:i;};
    return resumen.map(r=>({...r,grupos:grupos(r.actorId),sinCalificar:!(r.votos>0)})).sort((a,b)=>
      Number(a.sinCalificar)-Number(b.sinCalificar)||
      (!a.sinCalificar&&(rango(a)-rango(b)||b.indiceImpacto-a.indiceImpacto||a.indiceEsfuerzo-b.indiceEsfuerzo||b.grupos-a.grupos))||
      a.nombre.localeCompare(b.nombre,'es'));
  }
  function propuesta(ordenados,corte){return ordenados.filter(r=>!r.sinCalificar&&r.votos>0).slice(0,corte.maximo);}
  // Paso automático a la Actividad 5 cuando no hay lista confirmada: los primeros del orden, incluidos los
  // aún sin calificar (van al final), hasta el máximo.
  function automatica(ordenados,corte){return ordenados.slice(0,corte.maximo);}
  function validarSeleccion(actorIds,universo,corte){
    if(!Array.isArray(actorIds))return {ok:false,motivo:'La selección debe ser una lista de actores.'};
    if(actorIds.length>corte.maximo)return {ok:false,motivo:'La lista admite máximo '+corte.maximo+' actores'};
    if(new Set(actorIds).size!==actorIds.length)return {ok:false,motivo:'La lista contiene actores duplicados.'};
    const ids=new Set(universo.map(a=>typeof a==='string'?a:a.actorId||a.id));
    if(actorIds.some(id=>typeof id!=='string'||!ids.has(id)))return {ok:false,motivo:'El actor no está en el Nivel 1 de la Actividad 3.'};
    return {ok:true,motivo:''};
  }
  const api={ordenar,propuesta,automatica,validarSeleccion};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.Corte=api;
})(typeof globalThis==='object'?globalThis:this);
