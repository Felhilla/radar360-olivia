/* Acceso de conveniencia del cliente. No sustituye autenticación ni permisos del servidor. */
(function(root){
  'use strict';
  const CLAVE='ruta-sesion-administrador';
  const slug=n=>n.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  async function hash(salt,clave){
    const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+clave));
    return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function solicitar(url,opciones){
    const r=await root.fetch(url,{cache:'no-store',...opciones}),d=await r.json();
    if(!r.ok)throw Error(d.error||'No se pudo verificar el acceso.');
    return d;
  }
  function recordar(nombre){try{root.localStorage.setItem(CLAVE,JSON.stringify({nombre}));}catch(e){}}
  function sesion(nombre){try{return JSON.parse(root.localStorage.getItem(CLAVE)||'null')?.nombre===nombre;}catch(e){return false;}}
  function cerrar(){api.pendiente=null;try{root.localStorage.removeItem(CLAVE);}catch(e){}}
  async function verificar(persona,clave,config){
    api.pendiente=null;
    const inicial=config.credenciales?.[persona.nombre];
    if(persona.rol!=='administrador'||!inicial)throw Error('Administrador no válido.');
    const vigente=await solicitar('/api/credenciales?id='+encodeURIComponent(slug(persona.nombre)));
    const credencial=vigente||{salt:inicial.salt,hash:inicial.hashInicial};
    if(await hash(credencial.salt,clave)!==credencial.hash)throw Error('Contraseña incorrecta. Intenta de nuevo.');
    if(!vigente){api.pendiente={...persona};return {cambioObligatorio:true};}
    recordar(persona.nombre);return {cambioObligatorio:false};
  }
  async function cambiar(clave,confirmacion,config){
    const persona=api.pendiente;
    if(!persona)throw Error('Verifica primero tu contraseña inicial.');
    if(typeof clave!=='string'||clave.length<8)throw Error('La nueva contraseña debe tener al menos 8 caracteres.');
    if(clave!==confirmacion)throw Error('Las contraseñas no coinciden. Escríbela dos veces.');
    const inicial=config.credenciales[persona.nombre];
    if(await hash(inicial.salt,clave)===inicial.hashInicial)throw Error('Elige una contraseña distinta de la inicial.');
    const salt=Array.from(root.crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
    await solicitar('/api/credenciales',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id:slug(persona.nombre),salt,hash:await hash(salt,clave)})});
    recordar(persona.nombre);api.pendiente=null;return persona;
  }
  const api={slug,hash,sesion,cerrar,verificar,cambiar,pendiente:null};
  root.Acceso=api;
})(typeof window==='object'?window:globalThis);
