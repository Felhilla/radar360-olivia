/* Consulta de cambios: solo lectura, sin restauración de registros. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),dlg=$('historialDialog');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const permitido=()=>['administrador','disenador'].includes(window.Identidad?.rol);
  let filas=[],nombres={},cargando=false,version=0;
  const normalizar=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function resumen(r){
    if(r.coleccion==='credenciales')return 'Contraseña cambiada';
    if(r.coleccion==='tierlist')return (r.movimientos||1)+' movimientos del grupo '+r.docId;
    const dato=r.despues||r.antes||{},nombre=dato.nombre||nombres[dato.actorId]||dato.texto||r.docId;
    return ({crear:'Creó',editar:'Editó',borrar:'Borró'}[r.accion]||'Cambió')+' '+({ideas:'respuesta',actors:'actor',contactos:'contacto',parejas:'sorteo','priorizacion-votos':'calificación',seleccion:'corte',rutas:'ruta'}[r.coleccion]||r.coleccion)+' · '+nombre;
  }
  function detalle(valor){
    if(valor==null)return '<p>Sin registro.</p>';
    if(typeof valor==='string')return '<p>'+esc(valor)+'</p>';
    if(Array.isArray(valor)&&valor.every(v=>v.actorId&&v.nivel))return '<ul>'+valor.map(v=>'<li>'+esc(nombres[v.actorId]||v.actorId)+' · Nivel '+esc(v.nivel)+'</li>').join('')+'</ul>';
    // Para estructuras heterogéneas se conserva el detalle completo y legible.
    return '<pre>'+esc(JSON.stringify(valor,null,2))+'</pre>';
  }
  function render(){
    if(!permitido())return;
    const texto=normalizar($('historialBuscar').value),actividad=$('historialActividad').value;
    $('historialLista').innerHTML=filas.filter(r=>(!actividad||r.actividad===actividad)&&normalizar(JSON.stringify(r)+' '+resumen(r)).includes(texto)).map(r=>'<article><p><strong>'+esc(r.autores?.join(', ')||r.quien)+'</strong> · '+esc(new Date(r.fecha).toLocaleString('es-CO'))+' · '+esc(r.actividad)+' · '+esc(resumen(r))+'</p><details><summary>Ver antes y después</summary><h4>Antes</h4>'+detalle(r.antes)+'<h4>Después</h4>'+detalle(r.despues)+'</details></article>').join('')||'<p>No hay cambios para este filtro.</p>';
  }
  async function cargar(){
    if(cargando||!dlg.open||!permitido())return;
    cargando=true;const actual=version;
    try{
      const leer=async url=>{const r=await fetch(url,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);return d;};
      const [registros,actores]=await Promise.all([leer('/api/historial'),leer('/api/catalogo-actores')]);
      if(actual!==version||!permitido())return;
      filas=registros;nombres=Object.fromEntries(actores.map(a=>[a.id,a.nombre]));render();$('historialEstado').textContent='Actualizado '+new Date().toLocaleTimeString('es-CO');
    }catch(e){$('historialEstado').textContent='No se pudo actualizar: '+e.message;}
    finally{cargando=false;}
  }
  $('verHistorial').addEventListener('click',()=>{if(permitido()){dlg.showModal();cargar();}});
  $('historialCerrar').addEventListener('click',()=>dlg.close());
  ['historialBuscar','historialActividad'].forEach(id=>$(id).addEventListener('input',render));
  document.addEventListener('identidad:cambio',()=>{version++;filas=[];$('historialLista').innerHTML='';if(dlg.open)dlg.close();});
  setInterval(cargar,10000);
})();
