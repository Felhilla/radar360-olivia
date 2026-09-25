/* Filtro de entrada por lista de asistentes; sin acceso a red ni al DOM.
   Es un filtro de conveniencia del lado del cliente, no un control de seguridad: ver docs/seguridad-revision.md. */
(function(root){
  'use strict';
  const normalizar = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ\s]/g,' ').replace(/\s+/g,' ').trim();
  // Palabras de 1–2 letras («de», «la») no cuentan para la coincidencia.
  const palabras = s => normalizar(s).split(' ').filter(p => p.length > 2);
  function personas(config){
    const lista = [];
    (config && config.participantes || []).forEach(nombre => lista.push({nombre, rol:'participante'}));
    (config && config.administradores || []).forEach(nombre => lista.push({nombre, rol:'administrador'}));
    return lista;
  }
  // Devuelve {ok:true, persona} si el nombre coincide en al menos `minimoPalabras` palabras con una sola persona.
  function identificar(nombre, config){
    const minimo = config && Number.isInteger(config.minimoPalabras) ? config.minimoPalabras : 2;
    const escritas = new Set(palabras(nombre));
    if(escritas.size < minimo) return {ok:false, motivo:'corto'};
    const coincidencias = personas(config).map(p => ({persona:p, n:palabras(p.nombre).filter(w => escritas.has(w)).length})).filter(c => c.n >= minimo);
    if(!coincidencias.length) return {ok:false, motivo:'ninguna'};
    const mejor = Math.max.apply(null, coincidencias.map(c => c.n)), empatadas = coincidencias.filter(c => c.n === mejor);
    if(empatadas.length > 1) return {ok:false, motivo:'ambigua'};
    return {ok:true, persona:empatadas[0].persona};
  }
  // Pares de personas de la lista que comparten `minimoPalabras` o más palabras (deberían ser cero).
  function ambiguedades(config){
    const minimo = config && Number.isInteger(config.minimoPalabras) ? config.minimoPalabras : 2, lista = personas(config), pares = [];
    for(let i = 0; i < lista.length; i++) for(let j = i + 1; j < lista.length; j++){
      const a = new Set(palabras(lista[i].nombre)), comunes = palabras(lista[j].nombre).filter(w => a.has(w));
      if(comunes.length >= minimo) pares.push([lista[i].nombre, lista[j].nombre]);
    }
    return pares;
  }
  const api = {normalizar, palabras, personas, identificar, ambiguedades};
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.Asistentes = api;
})(typeof globalThis === 'object' ? globalThis : this);
