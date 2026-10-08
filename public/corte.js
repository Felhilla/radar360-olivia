/* Reglas puras del corte de la Actividad 4. */
(function(root){
  'use strict';
  // resumen incluye una fila por actor ubicado, incluso sin votos.
  function ordenar(resumen,corte,gruposPorActor={}){
    const grupos=id=>Array.isArray(gruposPorActor[id])?new Set(gruposPorActor[id]).size:Number(gruposPorActor[id]||0);
    const rango=r=>{const i=corte.ordenCuadrantes.indexOf(r.cuadrante?.id);return i<0?Infinity:i;};
    return resumen.map(r=>({...r,grupos:grupos(r.actorId),sinCalificar:!(r.votos>0)})).sort((a,b)=>
      Number(a.sinCalificar)-Number(b.sinCalificar)||
      (!a.sinCalificar&&(rango(a)-rango(b)||b.indiceImpacto-a.indiceImpacto||a.indiceEsfuerzo-b.indiceEsfuerzo||b.grupos-a.grupos))||
      a.nombre.localeCompare(b.nombre,'es'));
  }
  function estado(r){return r.votos>0?'Calificados':r.mejorNivel<=2?'Interés futuro':'Sin calificar';}
  // Calificar usa el voto propio; Matriz usa cualquier calificación válida del actor.
  function filtrar(lista,filtros,mercadoDe,calificado){
    const texto=String(filtros.texto||'').trim().toLocaleLowerCase('es');
    return lista.filter(a=>(!filtros.tier||a.mejorNivel===Number(filtros.tier))&&
      (!filtros.mercado||mercadoDe(a)===filtros.mercado)&&
      (!filtros.estado||(filtros.estado==='calificados'?calificado(a):!calificado(a)))&&
      (a.nombre+' '+(a.sector||'')).toLocaleLowerCase('es').includes(texto));
  }
  const api={ordenar,estado,filtrar};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.Corte=api;
})(typeof globalThis==='object'?globalThis:this);
