/* Reglas de la Actividad 5 (ruta de acción por actor), compartidas entre navegador y Node. Sin red ni DOM. */
(function(root){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ETIQUETAS = [['venta_inmediata','Venta inmediata'],['posicionamiento','Posicionamiento']];
  const ARISTAS = [
    ['sector_publico','Investigación del sector público'],
    ['marca','Posicionamiento de marca (de redes a eventos)'],
    ['leads','Captura de leads'],
    ['alianzas','Alianzas'],
    ['eventos','Eventos']
  ];
  // [clave, rótulo, máximo de caracteres]
  const CAMPOS = [
    ['aporte','¿Qué aporta Olivia?',2000],
    ['accionesQ4','Acciones Q4-2026',2000],
    ['accionesQ1','Acciones Q1-2027',2000],
    ['acciones2027','Acciones año 2027 y resultado esperado a diciembre de 2027',2000],
    ['indicador','Indicador de seguimiento',600]
  ];
  const PLACEHOLDER_INDICADOR = {
    '':'Elige primero la etiqueta',
    venta_inmediata:'Ej.: propuestas enviadas y cierres',
    posicionamiento:'Ej.: accesos, reuniones o alianzas logradas'
  };
  const etiquetaNombre = id => (ETIQUETAS.find(e=>e[0]===id)||[])[1] || '';
  const aristaNombre = id => (ARISTAS.find(a=>a[0]===id)||[])[1] || id;
  const texto = (v,max) => typeof v==='string' ? v.trim().slice(0,max) : '';

  // Devuelve {ok, valor, errores}. valor queda normalizado: sin aristas si la etiqueta es venta inmediata.
  // Un nombre es de un facilitador si contiene su apellido (última palabra de su nombre): «Ochoa», «Hillón».
  const normalizarNombre = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ\s]/g,' ').split(/\s+/).filter(Boolean);
  const esFacilitador = (nombre, facilitadores) => {
    const palabras = new Set(normalizarNombre(nombre));
    return (facilitadores||[]).some(f => { const p = normalizarNombre(f); const apellido = p[p.length-1]; return apellido && apellido.length>2 && palabras.has(apellido); });
  };
  function validar(datos, actorIds, opciones){
    const d = datos || {}, errores = {}, facilitadores = (opciones && opciones.facilitadores) || [];
    if(typeof d.actorId!=='string' || !d.actorId.trim()) errores.actorId = 'Falta el actor.';
    else if(Array.isArray(actorIds) && !actorIds.includes(d.actorId)) errores.actorId = 'El actor no está en la lista confirmada de la Actividad 4.';
    if(!ETIQUETAS.some(e=>e[0]===d.etiqueta)) errores.etiqueta = 'Elige «Venta inmediata» o «Posicionamiento».';
    if(typeof d.responsable!=='string' || !d.responsable.trim()) errores.responsable = 'Indica quién es el responsable.';
    else if(d.responsable.trim().length>120) errores.responsable = 'Máximo 120 caracteres.';
    else if(esFacilitador(d.responsable, facilitadores)) errores.responsable = 'Los facilitadores no pueden ser responsables. Elige a un participante.';
    for(const [k,,max] of CAMPOS){
      if(d[k]!=null && typeof d[k]!=='string') errores[k] = 'Texto no válido.';
      else if(typeof d[k]==='string' && d[k].trim().length>max) errores[k] = 'Máximo '+max+' caracteres.';
    }
    const aristas = {};
    if(d.etiqueta==='posicionamiento' && d.aristas && typeof d.aristas==='object' && !Array.isArray(d.aristas)){
      for(const [id] of ARISTAS){
        const a = d.aristas[id];
        if(a && a.activa===true){
          if(a.accion!=null && typeof a.accion!=='string') errores['arista-'+id] = 'Texto no válido.';
          else if(typeof a.accion==='string' && a.accion.trim().length>1000) errores['arista-'+id] = 'Máximo 1000 caracteres.';
          aristas[id] = {activa:true, accion:texto(a.accion,1000)};
        }
      }
    }
    if(Object.keys(errores).length) return {ok:false, errores};
    const valor = {actorId:d.actorId.trim(), etiqueta:d.etiqueta, responsable:texto(d.responsable,120), aristas};
    for(const [k,,max] of CAMPOS) valor[k] = texto(d[k],max);
    return {ok:true, valor};
  }

  // Tarjeta de contexto (solo lectura). actor viene de data/actores.json.
  function htmlContexto(actor, opciones){
    const o = opciones || {}, c = o.contactoInforme, contactos = o.contactos || [];
    const vacio = v => !v || String(v).includes('No explícito en el informe');
    const bloque = (titulo, valor, extra) => '<div class="p5-ctx-bloque"><h4>'+esc(titulo)+'</h4><p class="'+(vacio(valor)?'p5-ctx-vacio':'')+'">'+esc(valor || 'No explícito en el informe')+(extra?' <span class="p5-ctx-nota">'+esc(extra)+'</span>':'')+'</p></div>';
    const necesidad = actor.tipo==='gremio' ? ({E:'(necesidad explícita del gremio)',A:'(necesidad de sus afiliadas)'}[actor.necesidad_tipo] || '') : '';
    const t = o.taller || {};
    const enTaller = [t.grupos ? 'Elegido en el Nivel 1 por '+t.grupos+(t.grupos===1?' grupo':' grupos') : '', t.cuadrante ? 'cuadrante «'+t.cuadrante+'» en la Actividad 4' : (t.grupos ? 'Interés futuro en la Actividad 4' : ''), t.posicion ? 'puesto '+t.posicion+' del corte' : ''].filter(Boolean).join(' · ');
    let h = bloque('Qué hace', actor.que_hace) +
      '<div class="p5-ctx-bloque"><h4>Por qué se priorizó</h4><p class="'+(vacio(actor.por_que)?'p5-ctx-vacio':'')+'">'+esc(actor.por_que || 'No explícito en el informe')+'</p>'+(enTaller?'<p class="p5-ctx-nota">En el taller: '+esc(enTaller)+'.</p>':'')+'</div>' +
      bloque('Necesidad o dolor', actor.necesidad || actor.dolor, necesidad) + bloque('Ruta sugerida', actor.ruta_sugerida);
    if(actor.tipo==='gremio') h += bloque('Tema de charla o taller', actor.tema_charla, actor.propuesta_gh ? 'Propuesta GH · por validar' : '');
    if(actor.nota_contexto) h += '<div class="p5-ctx-bloque p5-ctx-alerta"><h4>Nota de contexto</h4><p>'+esc(actor.nota_contexto)+'</p></div>';
    h += '<div class="p5-ctx-bloque"><h4>Contacto de entrada</h4>';
    if(c){
      const nombre = c.nombre==='Por identificar' ? 'Nombre por identificar' : c.nombre;
      const conf = {alta:'Confianza alta',media:'Confianza media',baja:'Confianza baja · por verificar'}[c.confianza] || 'Contacto por identificar';
      h += '<p class="p5-ctx-contacto"><strong>'+esc(nombre)+'</strong><br>'+esc(c.cargo)+'</p><p class="p5-ctx-confianza">'+esc(conf)+'</p>';
    } else h += '<p class="p5-ctx-vacio">El informe no sugiere contacto para este actor.</p>';
    h += '</div><div class="p5-ctx-bloque"><h4>Contactos registrados en el taller</h4>';
    h += contactos.length ? '<ul>'+contactos.map(x=>'<li'+(x.facilitador?' class="es-ejemplo"':'')+'><strong>'+esc(x.nombre)+'</strong>'+(x.facilitador?'<span class="ad-facilitador">Ad. Facilitador</span>':'')+' · '+esc(x.cargo)+['telefono','correo'].filter(k=>x[k]).map(k=>'<br>'+esc(x[k])).join('')+'</li>').join('')+'</ul>' : '<p class="p5-ctx-vacio">Aún no hay contactos registrados.</p>';
    return h + '</div>';
  }

  // Filas para la hoja consolidada / CSV, en el orden de la lista confirmada.
  function filasHoja(actorIds, rutas, nombres){
    const cab = ['posicion','actor','etiqueta','responsable',...CAMPOS.map(c=>c[1]),'aristas','registradoPor','ultimoGuardado'];
    const filas = actorIds.map((id,i)=>{
      const r = rutas.find(x=>x.actorId===id && !x.facilitador) || {}; // los ejemplos del facilitador no van a la hoja
      const aristas = Object.entries(r.aristas||{}).filter(([,a])=>a&&a.activa).map(([k,a])=>aristaNombre(k)+(a.accion?': '+a.accion:'')).join(' | ');
      return [i+1, nombres[id]||id, etiquetaNombre(r.etiqueta), r.responsable||'', ...CAMPOS.map(([k])=>r[k]||''), aristas, r.editadoPor||'', r.updatedAt||''];
    });
    return [cab, ...filas];
  }

  const api = {ETIQUETAS, ARISTAS, CAMPOS, PLACEHOLDER_INDICADOR, etiquetaNombre, aristaNombre, esFacilitador, validar, htmlContexto, filasHoja};
  if(typeof module==='object' && module.exports) module.exports = api;
  else root.Rutas = api;
})(typeof globalThis==='object'?globalThis:this);
