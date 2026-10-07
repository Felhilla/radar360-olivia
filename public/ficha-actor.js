/* Ficha reutilizable: las funciones puras no acceden al DOM ni a la red. */
(function(root){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validarContacto(datos){
    const d=datos || {}, valor={}, errores={};
    ['nombre','cargo','telefono','correo'].forEach(k=>{valor[k]=typeof d[k]==='string'?d[k].trim():'';});
    ['nombre','cargo'].forEach(k=>{if(valor[k].length<2 || valor[k].length>120) errores[k]='Escribe entre 2 y 120 caracteres.';});
    if((d.telefono!=null && typeof d.telefono!=='string') || (valor.telefono && !/^[\d +()\-]{7,20}$/.test(valor.telefono))) errores.telefono='Escribe un teléfono de 7 a 20 caracteres, sin letras.';
    if((d.correo!=null && typeof d.correo!=='string') || (valor.correo && (valor.correo.length>160 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(valor.correo)))) errores.correo='Escribe un correo válido de máximo 160 caracteres.';
    return Object.keys(errores).length?{ok:false,errores}:{ok:true,valor};
  }
  function etiquetaConfianza(c){return {alta:'Confianza alta',media:'Confianza media',baja:'Confianza baja · por verificar'}[c] || 'Contacto por identificar';}
  // Ejemplo de un facilitador: solo existe en su navegador y no entra a la exportación de contactos.
  const AD_FACILITADOR='<span class="ad-facilitador">Ad. Facilitador</span>';
  function htmlContactos(contactos,puedeQuitar){
    if(!contactos.length) return '<p class="ad-empty">Aún no hay contactos registrados</p>';
    return '<ul class="ad-contactos">'+contactos.map(c=>{
      const fecha=new Date(c.createdAt), fechaTexto=Number.isNaN(fecha.getTime())?'':fecha.toLocaleDateString();
      return '<li'+(c.facilitador?' class="es-ejemplo"':'')+'><strong>'+esc(c.nombre)+'</strong>'+(c.facilitador?AD_FACILITADOR:'')+'<div>'+esc(c.cargo)+'</div>'+['telefono','correo'].filter(k=>c[k]).map(k=>'<div>'+esc(c[k])+'</div>').join('')+'<small>registrado por '+esc(c.registradoPor)+(fechaTexto?' · '+esc(fechaTexto):'')+'</small>'+(puedeQuitar?'<button type="button" class="btn ghost" data-quitar-contacto="'+esc(c.id)+'">Quitar</button>':'')+'</li>';
    }).join('')+'</ul>';
  }
  function htmlFicha(actor,opciones){
    const o=opciones || {}, c=o.contactoInforme;
    const bloque=(titulo,valor)=>'<div class="ad-label">'+esc(titulo)+'</div><div class="ad-just'+(String(valor).includes('No explícito en el informe')?' ad-empty':'')+'">'+esc(valor)+'</div>';
    const necesidad=actor.tipo==='gremio' || actor.categoria==='aliados'?({E:' (necesidad explícita del gremio)',A:' (necesidad de sus afiliadas)'}[actor.necesidad_tipo] || ''):'';
    const titulo=actor.categoria==='autoridades'?'Funciones':(actor.tipo==='gremio' || actor.categoria==='aliados'?'Qué es':'Qué hace');
    const descripcion=actor.categoria==='autoridades'?actor.funciones:(actor.queHace || actor.que_hace || actor.descripcion);
    let h=(!o.omitirDescripcion && descripcion?bloque(titulo,descripcion):'')+bloque('Por qué está en el radar',actor.por_que)+bloque('Necesidad o dolor',String(actor.necesidad || actor.dolor || '')+necesidad);
    h+='<div class="ad-label">Contacto sugerido por el informe</div>';
    // Un actor puede tener más de un contacto sugerido (p. ej. ACM): se aceptan uno o varios.
    const sugeridos=(Array.isArray(c)?c:(c?[c]:[]));
    h+=sugeridos.length?sugeridos.map(c=>'<div class="ad-just">'+esc(c.nombre==='Por identificar'?'Nombre por identificar':c.nombre)+'<div>'+esc(c.cargo)+'</div><span class="ad-confianza ad-confianza-'+(['alta','media','baja'].includes(c.confianza)?c.confianza:'pendiente')+'">'+esc(etiquetaConfianza(c.confianza))+'</span></div>').join(''):'<p class="ad-empty">El informe no sugiere contacto para este actor</p>';
    h+='<div class="ad-label">Contactos registrados en el taller</div><div data-contactos-lista>'+htmlContactos(o.contactos || [],o.puedeQuitar)+'</div><p class="ad-empty" data-contactos-aviso aria-live="polite">'+esc(o.aviso || '')+'</p>';
    if(o.puedeAgregar){
      h+='<button type="button" class="btn ghost" data-agregar-contacto aria-expanded="false" aria-controls="adContactoForm">Agregar contacto (opcional)</button><form id="adContactoForm" class="ad-contacto-form" hidden novalidate autocomplete="off"><p>Registra solo datos de contacto corporativo. La información se entregará al equipo comercial de Olivia y se borrará de esta plataforma después del taller.</p>';
      [['nombre','Nombre','text',120],['cargo','Cargo dentro de la organización','text',120],['telefono','Teléfono','tel',20],['correo','Correo','email',160]].forEach(([k,label,type,max])=>{
        h+='<label for="adContacto-'+k+'">'+label+'</label><input id="adContacto-'+k+'" name="'+k+'" type="'+type+'" maxlength="'+max+'" autocomplete="off" aria-describedby="adError-'+k+'"'+(['nombre','cargo'].includes(k)?' required':'')+'><div id="adError-'+k+'" data-error="'+k+'" aria-live="polite"></div>';
      });
      h+='<p data-contacto-error aria-live="polite"></p><div class="ad-contacto-actions"><button class="btn" type="submit">Guardar contacto</button><button class="btn ghost" type="button" data-cancelar-contacto>Cancelar</button></div></form>';
    }
    return h;
  }
  const api={validarContacto,etiquetaConfianza,htmlFicha,htmlContactos};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.FichaActor=api;
})(typeof window!=='undefined'?window:globalThis);
