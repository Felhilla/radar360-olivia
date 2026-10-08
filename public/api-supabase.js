// Capa de datos del sitio del taller sobre Supabase (reemplaza las funciones de Netlify).
// Intercepta las llamadas fetch('/api/...') que ya hace index.html y las resuelve contra la tabla
// public.registros (coleccion, id, data jsonb), con las mismas reglas y respuestas que tenían
// netlify/functions/*.js. Así el resto de la página no cambia.
(function(){
  var CFG = window.RADAR_CONFIG || {};
  var URL_BASE = (CFG.supabaseUrl || '').replace(/\/$/, '');
  var KEY = CFG.supabaseAnonKey || '';
  var REST = URL_BASE + '/rest/v1/registros';
  var nativeFetch = window.fetch.bind(window);

  function headers(extra){
    var h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
    for(var k in (extra || {})) h[k] = extra[k];
    return h;
  }
  function responder(data, status){
    return new Response(JSON.stringify(data), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  async function revisar(res){
    if(!res.ok){ var t = await res.text().catch(function(){ return ''; }); throw new Error('supabase ' + res.status + ' ' + t); }
    return res;
  }
  var enc = encodeURIComponent;

  // ---------- almacén genérico (equivalente a getStore) ----------
  var store = {
    list: async function(col){
      var out = [], desde = 0, paso = 1000;
      while(true){
        var res = await revisar(await nativeFetch(REST + '?select=id,data&coleccion=eq.' + enc(col) + '&order=id', {
          headers: headers({ Range: desde + '-' + (desde + paso - 1) }), cache: 'no-store' }));
        var filas = await res.json();
        out = out.concat(filas);
        if(filas.length < paso) break;
        desde += paso;
      }
      return out.map(function(f){ return f.data; });
    },
    count: async function(col){
      var res = await revisar(await nativeFetch(REST + '?select=id&coleccion=eq.' + enc(col), {
        headers: headers({ Prefer: 'count=exact', Range: '0-0' }), cache: 'no-store' }));
      var rango = res.headers.get('content-range') || '*/0';
      return Number(rango.split('/')[1]) || 0;
    },
    get: async function(col, id){
      var res = await revisar(await nativeFetch(REST + '?select=data&coleccion=eq.' + enc(col) + '&id=eq.' + enc(id), { headers: headers(), cache: 'no-store' }));
      var filas = await res.json();
      return filas.length ? filas[0].data : null;
    },
    set: async function(col, id, data){
      await revisar(await nativeFetch(REST + '?on_conflict=coleccion,id', {
        method: 'POST', headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ coleccion: col, id: id, data: data, updated_at: new Date().toISOString() }) }));
      return data;
    },
    del: async function(col, id){
      await revisar(await nativeFetch(REST + '?coleccion=eq.' + enc(col) + '&id=eq.' + enc(id), { method: 'DELETE', headers: headers() }));
    },
    delPrefijo: async function(col, prefijo){
      var res = await revisar(await nativeFetch(REST + '?coleccion=eq.' + enc(col) + '&id=like.' + enc(prefijo.replace(/[%_]/g, '\\$&') + '*'), {
        method: 'DELETE', headers: headers({ Prefer: 'return=representation' }) }));
      return (await res.json()).length;
    }
  };

  // Los ejemplos compartidos históricos siguen siendo de solo lectura.
  // Ejemplos compartidos: registros de la base que un diseñador dejó como ejemplo ilustrativo (ejemploCompartido:true).
  // Todos los ven en una tarjeta «Diseñador» (ruta /api/ejemplos), pero quedan fuera de las listas del taller,
  // del Nivel 1, del corte, de la Actividad 5, de los CSV y del informe.
  var EJEMPLO_SORTEO = 'ejemplo-facilitador';
  async function delTaller(col){ return (await store.list(col)).filter(function(f){ return !(f && f.ejemploCompartido); }); }
  async function ejemplosCompartidos(col){ return (await store.list(col)).filter(function(f){ return f && f.ejemploCompartido; }); }

  // ---------- validación de actores (seguridad: solo campos editables y valores permitidos) ----------
  var CONFIANZAS = ['alta', 'media', 'baja', 'por_identificar'];
  var ESTADOS = ['verificado', 'por_validar', 'agregado_taller', 'descartado'];
  var LIMITES_PARCHE = { nombre: 160, sector: 120, justificacion: 4000 };
  function limpiarParcheActor(p){
    if(!p || typeof p !== 'object' || Array.isArray(p)) return { error: 'invalid_patch' };
    var out = {};
    for(var k in p){
      var v = p[k];
      if(k === 'mostrarEnRadar'){ if(typeof v !== 'boolean') return { error: 'invalid_mostrarEnRadar' }; out[k] = v; }
      else if(k === 'categoria'){ if(CATEGORIAS.indexOf(v) < 0) return { error: 'invalid_categoria' }; out[k] = v; }
      else if(k === 'confianza'){ if(CONFIANZAS.indexOf(v) < 0) return { error: 'invalid_confianza' }; out[k] = v; }
      else if(k === 'estado'){ if(ESTADOS.indexOf(v) < 0) return { error: 'invalid_estado' }; out[k] = v; }
      else if(LIMITES_PARCHE[k]){ if(typeof v !== 'string' || v.length > LIMITES_PARCHE[k] || (k === 'nombre' && !v.trim())) return { error: 'invalid_' + k }; out[k] = v; }
      else return { error: 'campo_no_editable', field: k };
    }
    return out;
  }

  // ---------- utilidades compartidas con las funciones originales ----------
  function idCorto(prefijo){ return prefijo + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }
  function slugActor(s){ return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80); }
  function slugVotante(nombre){
    return nombre.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
      'u-' + Array.from(nombre.trim().toLowerCase()).map(function(c){ return c.codePointAt(0).toString(16); }).join('-');
  }
  function slugGremio(s){ return String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'gremio'; }
  function texto(v, max){ return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

  var GREMIOS_IDS = ['aliados-andesco','aliados-asobancaria','aliados-fenalco','aliados-camacol','aliados-colombia-fintech','aliados-acodres',
    'aliados-andi','aliados-acrip','aliados-acp','aliados-cci','aliados-naturgas','aliados-acolgen','aliados-andeg','aliados-ser-colombia',
    'aliados-acoplasticos','aliados-ccce-camara-colombiana-de-comercio-electronico','aliados-cecodes','aliados-asofondos','aliados-anda'];
  var HORIZONTES = ['corto', 'medio', 'largo'];
  var CATEGORIAS = ['competidores', 'mercados', 'aliados', 'autoridades'];

  var asistentesPromesa = null;
  function asistentes(){
    if(!asistentesPromesa) asistentesPromesa = nativeFetch('asistentes-config.json', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ asistentesPromesa = null; return {}; });
    return asistentesPromesa;
  }
  var criteriosPromesa = null;
  function criterios(){
    if(!criteriosPromesa) criteriosPromesa = nativeFetch('priorizacion-criterios.json', { cache: 'no-store' }).then(function(r){ return r.json(); });
    return criteriosPromesa;
  }

  async function ubicadosVigentes(){
    const sorteo=await store.get('parejas','vigente');
    const actores=TierList.ubicados(sorteo,await delTaller('tierlist'));
    return {sorteoId:sorteo?.id||null,actores};
  }
  // La selección histórica se conserva, pero no determina el universo de rutas.
  async function listaActividad5(){
    const nivel=await ubicadosVigentes();
    const elegibles=nivel.actores.filter(a=>a.mejorNivel<=2);
    if(!elegibles.length)return {actorIds:[],origen:'vacia',detalles:{}};
    const cr=await criterios();
    const resumen=await (await rutas['priorizacion-votos']('GET',null,new URLSearchParams('resumen=1'))).json();
    const catalogo=await actoresTier(), porId=new Map(catalogo.map(a=>[a.id,a]));
    const grupos=Object.fromEntries(elegibles.map(a=>[a.actorId,a.grupos]));
    const ordenados=Corte.ordenar(elegibles.map(a=>({...a,nombre:porId.get(a.actorId)?.nombre||a.actorId,votos:0,...resumen.find(r=>r.actorId===a.actorId)})),cr.corte,grupos);
    const detalles=Object.fromEntries(ordenados.map((r,i)=>[r.actorId,{posicion:i+1,mejorNivel:r.mejorNivel,grupos:r.grupos,cuadrante:r.sinCalificar?'Interés futuro':r.cuadrante.nombre,calificaciones:r.votos||0}]));
    return {actorIds:ordenados.map(r=>r.actorId),origen:'automatica',detalles};
  }
  async function activosEmbudo(){
    var r=await nativeFetch('embudo-config.json',{cache:'no-store'});
    if(!r.ok) throw Error('No se pudo cargar embudo-config.json');
    return Embudo.activados(await store.list('actors'),await store.list('activacion-votos'),await r.json());
  }
  async function elegiblesCanvas(){
    var cfg=await nativeFetch('canvas-config.json',{cache:'no-store'});
    if(!cfg.ok) throw Error('No se pudo cargar canvas-config.json');
    var c=await cfg.json(), activos=await activosEmbudo();
    var r=await rutas['priorizacion-votos']('GET',null,new URLSearchParams('resumen=1'));
    var resumen=await r.json();
    return activos.filter(a=>resumen.some(r=>r.actorId===a.id && c.cuadrantesElegibles.includes(r.cuadrante.id)));
  }

  // ---------- manejadores por ruta (mismo contrato que netlify/functions) ----------
  function validarContacto(datos){
    const d=datos || {}, valor={}, errores={};
    ['nombre','cargo','telefono','correo'].forEach(k=>{valor[k]=typeof d[k]==='string'?d[k].trim():'';});
    ['nombre','cargo'].forEach(k=>{if(valor[k].length<2 || valor[k].length>120) errores[k]='Escribe entre 2 y 120 caracteres.';});
    if((d.telefono!=null && typeof d.telefono!=='string') || (valor.telefono && !/^[\d +()\-]{7,20}$/.test(valor.telefono))) errores.telefono='Escribe un teléfono de 7 a 20 caracteres, sin letras.';
    if((d.correo!=null && typeof d.correo!=='string') || (valor.correo && (valor.correo.length>160 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(valor.correo)))) errores.correo='Escribe un correo válido de máximo 160 caracteres.';
    return Object.keys(errores).length?{ok:false,errores}:{ok:true,valor};
  }
  // Cada carga consulta el Radar: no queda una promesa con actores obsoletos.
  async function actoresTier(){
    const res=await nativeFetch('data/actores.json',{cache:'no-store'});
    if(!res.ok)throw Error('No se pudo cargar el catálogo.');
    return TierList.catalogoVigente(await res.json(),await store.list('actors'));
  }
  function sorteoValido(s){
    const ids=window.TierList.INDUSTRIAS.map(i=>i.id), nombres=new Set(), grupos=new Set(), cubiertas=new Set();
    if(!s||typeof s.id!=='string'||!s.id.trim()||typeof s.createdAt!=='string'||!Number.isFinite(Date.parse(s.createdAt))||!Array.isArray(s.grupos)||!s.grupos.length) return false;
    if(s.iniciado!==undefined&&typeof s.iniciado!=='boolean') return false;
    for(const g of s.grupos){
      if(!g||typeof g.id!=='string'||!g.id.startsWith(s.id+'-g')||grupos.has(g.id)||!Array.isArray(g.integrantes)||!g.integrantes.length||g.integrantes.length>3||!Array.isArray(g.industrias)||!g.industrias.length||new Set(g.industrias).size!==g.industrias.length) return false;
      grupos.add(g.id);
      for(const n of g.integrantes){if(typeof n!=='string'||!n.trim())return false;const key=n.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(nombres.has(key))return false;nombres.add(key);}
      for(const i of g.industrias){if(!ids.includes(i))return false;cubiertas.add(i);}
    }
    return cubiertas.size===ids.length;
  }
  // Historial de escrituras confirmadas. Se serializan los guardados de esta pestaña para
  // conservar el primer estado y contar los movimientos de A3 en cada ventana.
  const actividades={ideas:'A1',actors:'Radar',contactos:'A2',tierlist:'A3',parejas:'A3','priorizacion-votos':'A4',seleccion:'A4',rutas:'A5',credenciales:'Acceso'};
  const guardarBase=store.set.bind(store), borrarBase=store.del.bind(store);
  let autorEscritura=null;
  async function registrar(col,id,antes,despues,persona,tableroAntes){
    const fecha=new Date().toISOString(), grupo=(despues||antes||{}).grupoId;
    const agrupado=col==='tierlist'&&grupo;
    const historialId=agrupado?'tierlist:'+grupo+':'+Math.floor(Date.now()/600000):fecha+'-'+Math.random().toString(36).slice(2);
    const anterior=agrupado?await store.get('historial',historialId):null;
    let rec={id:historialId,coleccion:col,docId:agrupado?grupo:id,actividad:actividades[col],accion:despues===null?'borrar':antes?'editar':'crear',quien:persona?.nombre||'Sin identificar',rol:persona?.rol||'participante',fecha,antes,despues};
    if(col==='credenciales'){rec.antes=null;rec.despues='Contraseña cambiada';}
    if(agrupado){
      rec={...rec,accion:'editar',antes:anterior?anterior.antes:tableroAntes,despues:(await store.list('tierlist')).filter(f=>f.grupoId===grupo),movimientos:(anterior?.movimientos||0)+1};
      rec.autores=[...new Set([...(anterior?.autores||[]),rec.quien])];
    }
    await guardarBase('historial',historialId,rec);
  }
  async function escribir(col,id,data,borrar){
    if(!actividades[col])return borrar?borrarBase(col,id):guardarBase(col,id,data);
    const persona=autorEscritura;
    const antes=await store.get(col,id);
    const grupo=(data||antes||{}).grupoId;
    const tableroAntes=col==='tierlist'?(await store.list(col)).filter(f=>f.grupoId===grupo):null;
    const resultado=await (borrar?borrarBase(col,id):guardarBase(col,id,data));
    try{await registrar(col,id,antes,borrar?null:data,persona,tableroAntes);}
    catch(e){throw Error('El dato se guardó, pero no se pudo registrar el control de cambios. Revisa la conexión y la colección historial.');}
    return resultado;
  }
  store.set=(col,id,data)=>escribir(col,id,data,false);
  store.del=(col,id)=>escribir(col,id,null,true);
  var rutas = {
    'catalogo-actores': async function(m){return m==='GET'?responder(await actoresTier()):responder({error:'Método no permitido.'},405);},
    'historial': async function(m){
      if(!['administrador','disenador'].includes(window.Identidad?.rol))return responder({error:'Solo administradores y diseñadores pueden consultar el control de cambios.'},403);
      return m==='GET'?responder((await store.list('historial')).sort((a,b)=>b.fecha.localeCompare(a.fecha))):responder({error:'El historial solo admite registros generados por los guardados.'},405);
    },
    // Control de pantalla, no seguridad real: la API pública puede eludirlo. Riesgo aceptado por el cliente.
    'credenciales': async function(m,body,qs){
      const cfg=await asistentes(),id=m==='GET'?qs.get('id'):body?.id;
      const nombre=(cfg.administradores||[]).find(n=>slugVotante(n)===id);
      if(!nombre)return responder({error:'Administrador no válido.'},400);
      if(m==='GET')return responder(await store.get('credenciales',id));
      if(m!=='PUT')return responder({error:'Método no permitido.'},405);
      const persona=autorEscritura;
      if(persona?.rol!=='administrador'||persona.nombre!==nombre)return responder({error:'Verifica primero tu contraseña.'},403);
      if(!/^[a-f0-9]{32}$/.test(body.salt)||!/^[a-f0-9]{64}$/.test(body.hash))return responder({error:'Credencial no válida.'},400);
      return responder(await store.set('credenciales',id,{salt:body.salt,hash:body.hash,cambiadaEn:new Date().toISOString()}));
    },
    'parejas': async function(m,body){
      if(!['GET','PUT','PATCH'].includes(m))return responder({error:'method_not_allowed'},405);
      const vigente=await store.get('parejas','vigente');
      if(m==='GET')return responder(vigente);
      if(m==='PATCH'){
        if(!vigente||!body||body.iniciado!==true)return responder({error:'Sorteo no válido.'},400);
        return responder(await store.set('parejas','vigente',Object.assign({},vigente,{iniciado:true})));
      }
      if(!sorteoValido(body))return responder({error:'Sorteo no válido.'},400);
      if(vigente?.iniciado&&body.forzar!==true)return responder({error:'La actividad ya empezó'},409);
      const rec={id:body.id,grupos:body.grupos,createdAt:body.createdAt,iniciado:body.iniciado===true};
      return responder(await store.set('parejas','vigente',rec));
    },
    'tierlist': async function(m,body,qs){
      if(m==='GET'){const filas=await delTaller('tierlist'),id=qs.get('sorteo');return responder(id===null?filas:filas.filter(f=>f.sorteoId===id));}
      if(m!=='PUT')return responder({error:'method_not_allowed'},405);
      if(!body||!['sorteoId','grupoId','actorId','editadoPor'].every(k=>typeof body[k]==='string'&&body[k].trim()&&body[k].length<=300)||![null,1,2,3,4].includes(body.nivel))return responder({error:'Colocación no válida.'},400);
      const vigente=await store.get('parejas','vigente'),grupo=vigente?.grupos.find(g=>g.id===body.grupoId);
      if(!grupo||body.sorteoId!==vigente.id)return responder({error:'El grupo no pertenece al sorteo vigente.'},400);
      if(autorEscritura?.rol!=='administrador' && (!vigente.iniciado || !grupo.integrantes?.includes(autorEscritura?.nombre))) return responder({error:'Solo puedes editar tu grupo cuando la actividad haya iniciado.'},403);
      const actores=await actoresTier();
      if(actores&&!window.TierList.actoresDelGrupo(grupo,actores).some(a=>a.id===body.actorId))return responder({error:'El actor no pertenece a este grupo.'},400);
      const id=body.grupoId+':'+body.actorId;
      if(body.nivel===null){await store.del('tierlist',id);return responder({ok:true});}
      const filas=(await delTaller('tierlist')).filter(f=>f.sorteoId===body.sorteoId&&f.grupoId===body.grupoId);
      const regla=window.TierList.puedeMover(filas,body.actorId,body.nivel,actores);
      if(!regla.ok)return responder({error:regla.motivo},409);
      const rec={id,sorteoId:body.sorteoId,grupoId:body.grupoId,actorId:body.actorId,nivel:body.nivel,editadoPor:body.editadoPor.trim(),updatedAt:new Date().toISOString()};
      return responder(await store.set('tierlist',id,rec));
    },
    'contactos-informe': async function(m){
      if(m !== 'GET') return responder({error:'method_not_allowed'},405);
      return responder(await store.list('contactos-informe'));
    },
    'contactos': async function(m,body,qs){
      if(m === 'GET'){
        var lista=await store.list('contactos'), actorId=qs.get('actorId');
        return responder(actorId===null?lista:lista.filter(c=>c.actorId===actorId));
      }
      if(m === 'DELETE'){
        var id=qs.get('id');
        if(!id) return responder({error:'Falta el contacto.'},400);
        await store.del('contactos',id); return responder({ok:true});
      }
      if(m !== 'POST') return responder({error:'method_not_allowed'},405);
      if(!body || typeof body.actorId!=='string' || !body.actorId.trim() || body.actorId.trim().length>200 || typeof body.registradoPor!=='string' || !body.registradoPor.trim() || body.registradoPor.trim().length>80) return responder({error:'Actor y participante son obligatorios.'},400);
      if(unescape(encodeURIComponent(JSON.stringify(body))).length>20*1024) return responder({error:'Registro demasiado grande.'},400);
      var validacion=(window.FichaActor?window.FichaActor.validarContacto:validarContacto)(body);
      if(!validacion.ok) return responder(validacion,400);
      var rec=Object.assign({id:idCorto(texto(body.actorId,200)+':'),actorId:texto(body.actorId,200)},validacion.valor,{registradoPor:texto(body.registradoPor,80),createdAt:new Date().toISOString()});
      if(unescape(encodeURIComponent(JSON.stringify(rec))).length>20*1024) return responder({error:'Registro demasiado grande.'},400);
      if(await store.count('contactos')>=2000) return responder({error:'Límite de contactos alcanzado.'},429);
      await store.set('contactos',rec.id,rec);return responder(rec);
    },
    'activacion-votos': async function(m, body){
      if(m === 'GET') return responder(await store.list('activacion-votos'));
      if(!['PUT','DELETE'].includes(m)) return responder({error:'method_not_allowed'},405);
      if(!body || typeof body.actorId !== 'string' || !body.actorId.trim() || body.actorId.length > 300 || /[\x00-\x1f/\\]/.test(body.actorId)) return responder({error:'Actor no válido.'},400);
      if(typeof body.votante !== 'string' || !body.votante.trim() || body.votante.length > 60) return responder({error:'Escribe un nombre de máximo 60 caracteres.'},400);
      var key=body.actorId+'--'+slugVotante(body.votante);
      if(m === 'DELETE'){await store.del('activacion-votos',key);return responder({ok:true});}
      var actor=await store.get('actors',body.actorId), grupo=Embudo.grupo(actor);
      if(!grupo || grupo !== body.grupo) return responder({error:'Solo se activan empresas y gremios-aliados vigentes.'},400);
      if(![1,2].includes(body.valor)) return responder({error:'El voto debe ser Sí (2) o No (1).'},400);
      var voto={actorId:actor.id,grupo:grupo,votante:body.votante.trim(),valor:body.valor,updatedAt:new Date().toISOString()};
      await store.set('activacion-votos',key,voto);return responder(voto);
    },
    'canvas': async function(m, body){
      if(m === 'GET') return responder(await store.list('canvas'));
      if(m !== 'PUT' && m !== 'DELETE') return responder({ error: 'method_not_allowed' }, 405);
      function valido(v,max){return typeof v === 'string' && v.length<=max;}
      if(!body || !valido(body.id,400) || !body.id || /[\x00-\x1f/\\]/.test(body.id)) return responder({error:'Ficha no válida.'},400);
      if(m === 'DELETE'){await store.del('canvas',body.id);return responder({ok:true});}
      if(!valido(body.actorId,300) || !body.actorId) return responder({error:'Actor no válido.'},400);
      var actor=await store.get('actors',body.actorId);
      if(!actor) return responder({error:'El actor ya no existe.'},404);
      var grupo=Embudo.grupo(actor);
      if(!grupo || body.grupo!==grupo || body.id!==(grupo==='aliados'?'aliado:':'empresa:')+actor.id) return responder({error:'El actor está descartado o la ficha no corresponde a su grupo.'},400);
      var limites={oferta:4000,queOfrece:4000,aporteOlivia:4000,acciones30:4000,acciones60:4000,acciones90:4000,buyer:300,sponsor:300,cta:1000,editadoPor:60};
      var rec=Embudo.ficha(actor,await store.list('matriz'),[]);
      for(var campo in limites){
        var valor=body[campo]===undefined?'':body[campo];
        if(!valido(valor,limites[campo])) return responder({error:'Revisa el campo '+campo+' (máximo '+limites[campo]+' caracteres).'},400);
        rec[campo]=valor.trim();
      }
      rec.aliado=null;
      if(body.aliado!=null){
        if(grupo!=='empresas' || !valido(body.aliado.id,300)) return responder({error:'Aliado no válido.'},400);
        var candidatos=await elegiblesCanvas();
        var aliado=candidatos.find(a=>a.id===body.aliado.id && a.grupo==='aliados');
        if(!aliado) return responder({error:'El aliado ya no es elegible en la Actividad 4. Elige otro o deja el campo pendiente.'},400);
        rec.aliado={id:aliado.id,nombre:aliado.nombre};
      }
      rec.updatedAt=new Date().toISOString();
      await store.set('canvas',rec.id,rec);return responder(rec);
    },
    'actors': async function(m, body){
      if(m === 'GET') return responder(await store.list('actors'));
      if(m === 'POST'){
        if(!body) return responder({ error: 'invalid_json' }, 400);
        var faltan = ['nombre', 'categoria'].find(function(f){ return !body[f] || typeof body[f] !== 'string' || !body[f].trim(); });
        if(faltan) return responder({ error: 'missing_field', field: faltan }, 400);
        if(CATEGORIAS.indexOf(body.categoria) < 0) return responder({ error: 'invalid_categoria' }, 400);
        if(body.confianza != null && CONFIANZAS.indexOf(body.confianza) < 0) return responder({ error: 'invalid_confianza' }, 400);
        if(body.estado != null && ESTADOS.indexOf(body.estado) < 0) return responder({ error: 'invalid_estado' }, 400);
        if(body.nombre.trim().length > 160 || texto(body.sector, 999).length > 120 || texto(body.justificacion, 9999).length > 4000) return responder({ error: 'too_long' }, 400);
        if(await store.count('actors') >= 2000) return responder({ error: 'too_many_actors' }, 429);
        var now = new Date().toISOString();
        var a = { id: body.categoria + '-' + slugActor(body.nombre) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
          nombre: body.nombre.trim(), categoria: body.categoria, sector: (body.sector || '').trim(), confianza: body.confianza || 'por_identificar',
          justificacion: (body.justificacion || '').trim(), estado: body.estado || 'por_validar', mostrarEnRadar: body.mostrarEnRadar !== false,
          origenTaller: true, createdAt: now, updatedAt: now };
        if(a.categoria === 'aliados'){a.contacto=texto(body.contacto,600);a.cuentas=texto(body.cuentas,600);a.oferta=texto(body.oferta,600);}
        await store.set('actors', a.id, a);
        return responder(a, 201);
      }
      if(m === 'PATCH'){
        if(!body || typeof body.id !== 'string') return responder({ error: 'missing_id' }, 400);
        var ex = await store.get('actors', body.id);
        if(!ex) return responder({ error: 'not_found' }, 404);
        var patch = limpiarParcheActor(body.patch);
        if(patch.error) return responder({ error: patch.error, field: patch.field }, 400);
        var upd = Object.assign({}, ex, patch, { updatedAt: new Date().toISOString() });
        await store.set('actors', body.id, upd);
        return responder(upd);
      }
    },
    'matriz': async function(m, body){
      if(m === 'GET') return responder(await store.list('matriz'));
      if(m === 'POST'){
        if(!body) return responder({ error: 'invalid_json' }, 400);
        var f = ['cliente', 'necesidadCritica'].find(function(k){ return !body[k] || typeof body[k] !== 'string' || !body[k].trim(); });
        if(f) return responder({ error: 'missing_field', field: f }, 400);
        if(await store.count('matriz') >= 500) return responder({ error: 'too_many_rows' }, 429);
        var now = new Date().toISOString();
        var fila = { id: idCorto('fila-'), cliente: body.cliente.trim(), necesidadCritica: body.necesidadCritica.trim(),
          respuestaOlivia: (body.respuestaOlivia || '').trim(), trigger: body.trigger === true,
          puntoContacto: texto(body.puntoContacto, 1000), rutaEntrada: texto(body.rutaEntrada, 1000), sector: texto(body.sector, 80),
          createdAt: now, updatedAt: now };
        await store.set('matriz', fila.id, fila);
        return responder(fila, 201);
      }
      if(m === 'PATCH'){
        if(!body || typeof body.id !== 'string') return responder({ error: 'missing_id' }, 400);
        var ex = await store.get('matriz', body.id);
        if(!ex) return responder({ error: 'not_found' }, 404);
        var patch = Object.assign({}, body.patch || {}); delete patch.id; delete patch.createdAt;
        var upd = Object.assign({}, ex, patch, { updatedAt: new Date().toISOString() });
        await store.set('matriz', body.id, upd);
        return responder(upd);
      }
      if(m === 'DELETE'){
        if(!body || typeof body.id !== 'string') return responder({ error: 'missing_id' }, 400);
        if(!(await store.get('matriz', body.id))) return responder({ error: 'not_found' }, 404);
        await store.del('matriz', body.id);
        return responder({ ok: true });
      }
    },
    'ideas': async function(m, body){
      if(m === 'GET') return responder({ stickers: await store.list('ideas') });
      if(m === 'POST'){
        if(!body) return responder({ error: 'invalid_json' }, 400);
        var t = typeof body.texto === 'string' ? body.texto.trim() : '';
        if(HORIZONTES.indexOf(body.horizonte) < 0) return responder({ error: 'invalid_horizonte' }, 400);
        if(!Ideas.preguntaValida(body.horizonte, body.preguntaId)) return responder({ error: 'invalid_preguntaId' }, 400);
        if(!t) return responder({ error: 'missing_field', field: 'texto' }, 400);
        if(t.length > 200) return responder({ error: 'texto_too_long' }, 400);
        var todas = await store.list('ideas');
        if(todas.filter(function(s){ return s.horizonte === body.horizonte; }).length >= 200) return responder({ error: 'too_many_rows' }, 429);
        var s = { id: idCorto('idea-'), horizonte: body.horizonte, preguntaId: body.preguntaId, texto: t, createdAt: new Date().toISOString() };
        await store.set('ideas', s.id, s);
        return responder({ sticker: s }, 201);
      }
      if(m === 'DELETE'){
        if(!body || typeof body.id !== 'string') return responder({ error: 'missing_id' }, 400);
        if(!(await store.get('ideas', body.id))) return responder({ error: 'not_found' }, 404);
        await store.del('ideas', body.id);
        return responder({ ok: true });
      }
    },
    // OBSOLETO: síntesis manual de Actividad 1; se conserva la ruta y la colección histórica.
    'ideas-sintesis': async function(m, body){
      if(m === 'GET'){
        var out = {};
        for(var i = 0; i < HORIZONTES.length; i++) out[HORIZONTES[i]] = (await store.get('ideas-sintesis', HORIZONTES[i])) || { texto: '', updatedAt: null };
        return responder(out);
      }
      if(m === 'PUT' || m === 'POST'){
        if(!body) return responder({ error: 'invalid_json' }, 400);
        if(HORIZONTES.indexOf(body.horizonte) < 0) return responder({ error: 'invalid_horizonte' }, 400);
        var t = typeof body.texto === 'string' ? body.texto.trim() : '';
        if(t.length > 2000) return responder({ error: 'texto_too_long' }, 400);
        var rec = { texto: t, updatedAt: new Date().toISOString() };
        await store.set('ideas-sintesis', body.horizonte, rec);
        return responder(rec);
      }
    },
    // OBSOLETO: voto 3/2/1 por horizonte. Conservado para revisión histórica.
    'gremios-votos': async function(m, body){
      if(m === 'GET') return responder(await store.list('gremios-votos'));
      if(!body || typeof body.gremioId !== 'string') return responder({ error: 'Gremio no válido.' }, 400);
      if(GREMIOS_IDS.indexOf(body.gremioId) < 0){
        var agregado = body.gremioId.indexOf('gremio-taller-') === 0 ? await store.get('gremios-taller', body.gremioId) : null;
        if(!agregado) return responder({ error: 'Gremio no válido.' }, 400);
      }
      if(typeof body.votante !== 'string' || !body.votante.trim() || body.votante.length > 60) return responder({ error: 'Escribe un nombre de máximo 60 caracteres.' }, 400);
      var votante = body.votante.trim(), key = body.gremioId + '--' + slugVotante(votante);
      if(m === 'DELETE'){ await store.del('gremios-votos', key); return responder({ ok: true }); }
      if([1, 2, 3].indexOf(body.valor) < 0) return responder({ error: 'El valor debe ser 1, 2 o 3.' }, 400);
      var voto = { gremioId: body.gremioId, votante: votante, valor: body.valor, updatedAt: new Date().toISOString() };
      await store.set('gremios-votos', key, voto);
      return responder(voto);
    },
    // OBSOLETO: los nuevos gremios-aliados se crean en actors.
    'gremios-taller': async function(m, body){
      if(m === 'GET') return responder(await store.list('gremios-taller'));
      if(!body) return responder({ error: 'El cuerpo debe ser JSON válido.' }, 400);
      if(m === 'DELETE'){
        if(typeof body.id !== 'string' || body.id.indexOf('gremio-taller-') !== 0) return responder({ error: 'Gremio no válido.' }, 400);
        await store.del('gremios-taller', body.id);
        var n = await store.delPrefijo('gremios-votos', body.id + '--');
        return responder({ ok: true, votosEliminados: n });
      }
      var nombre = texto(body.nombre, 80);
      if(!nombre) return responder({ error: 'Escribe el nombre del gremio.' }, 400);
      var existentes = await store.list('gremios-taller');
      if(existentes.length >= 100) return responder({ error: 'Se alcanzó el límite de 100 gremios agregados.' }, 429);
      if(existentes.some(function(g){ return slugGremio(g.nombre) === slugGremio(nombre); })) return responder({ error: 'Ese gremio ya fue agregado.' }, 409);
      var g = { id: 'gremio-taller-' + slugGremio(nombre) + '-' + Math.random().toString(36).slice(2, 6), nombre: nombre,
        contacto: texto(body.contacto, 600), cuentas: texto(body.cuentas, 600), oferta: texto(body.oferta, 600), autor: texto(body.autor, 60),
        origenTaller: true, createdAt: new Date().toISOString() };
      await store.set('gremios-taller', g.id, g);
      return responder(g, 201);
    },
    // Actividad 5: una ruta de acción por actor de Tier 1 o 2. Prevalece el último guardado.
    'ejemplos': async function(m){
      if(m!=='GET') return responder({error:'Método no permitido.'},405);
      return responder({sorteo:await store.get('parejas',EJEMPLO_SORTEO),tierlist:await ejemplosCompartidos('tierlist'),
        votos:await ejemplosCompartidos('priorizacion-votos'),rutas:await ejemplosCompartidos('rutas')});
    },
    'lista-rutas': async function(m){
      if(m!=='GET') return responder({error:'Método no permitido.'},405);
      return responder(await listaActividad5());
    },
    'rutas': async function(m,body){
      if(m==='GET') return responder(await delTaller('rutas'));
      if(m!=='PUT') return responder({error:'Método no permitido.'},405);
      var lista=await listaActividad5();
      if(!lista.actorIds.length) return responder({error:'Todavía no hay actores en Tier 1 o 2 de la Actividad 3.'},409);
      var v=window.Rutas.validar(body,lista.actorIds,{disenadores:(await asistentes()).disenadores||[]});
      if(!v.ok) return responder({error:Object.values(v.errores)[0],errores:v.errores},400);
      if(body.editadoPor!=null&&(typeof body.editadoPor!=='string'||body.editadoPor.length>80)) return responder({error:'Nombre de quien registra no válido.'},400);
      var rec=Object.assign({id:v.valor.actorId},v.valor,{editadoPor:texto(body.editadoPor,80),updatedAt:new Date().toISOString()});
      if(unescape(encodeURIComponent(JSON.stringify(rec))).length>20*1024) return responder({error:'Registro demasiado grande.'},400);
      return responder(await store.set('rutas',rec.id,rec));
    },
    // Solo lectura histórica: el orden sugerido no se confirma ni se guarda.
    'seleccion': async function(m){
      if(m==='GET')return responder(await store.get('seleccion','vigente'));
      return responder({error:'El orden sugerido es de solo lectura.'},405);
    },
    'priorizacion-votos': async function(m, body, params){
      var cr = await criterios();
      if(m === 'GET' && params.get('criterios') === '1') return responder(cr);
      function ejeValido(v, eje){
        return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === cr[eje].length &&
          cr[eje].every(function(c){ return Number.isInteger(v[c.id]) && v[c.id] >= 1 && v[c.id] <= 5; });
      }
      if(m === 'GET'){
        var votos = await delTaller('priorizacion-votos');
        if(params.get('resumen') !== '1') return responder(votos);
        var ubicaciones = (await ubicadosVigentes()).actores;
        var nivel = new Set(ubicaciones.map(a=>a.actorId));
        var actores = {}; (await actoresTier()).filter(a=>nivel.has(a.id)).forEach(function(a){ actores[a.id] = a; });
        var grupos = {};
        votos.forEach(function(v){
          if(v.borrador || !ejeValido(v.impacto, 'impacto') || !ejeValido(v.esfuerzo, 'esfuerzo')) return;
          (grupos[v.actorId] = grupos[v.actorId] || []).push(v);
        });
        var res = [];
        Object.keys(grupos).forEach(function(id){
          var a = actores[id]; if(!a) return;
          var vs = grupos[id];
          // suma en centésimas enteras, igual que la función original, para no perder el 3,0 exacto por coma flotante
          var prom = function(eje){ return vs.reduce(function(s, v){ return s + cr[eje].reduce(function(n, c){ return n + v[eje][c.id] * c.peso; }, 0); }, 0) / (100 * vs.length); };
          var imp = prom('impacto'), esf = prom('esfuerzo');
          var q = cr.cuadrantes.find(function(c){ return c.impacto === (imp >= cr.umbral ? 'alto' : 'bajo') && c.esfuerzo === (esf >= cr.umbral ? 'alto' : 'bajo'); });
          res.push({ ...ubicaciones.find(a=>a.actorId===id), actorId: id, nombre: a.nombre, categoria: a.categoria, sector: a.sector || '', indiceImpacto: Number(imp.toFixed(2)),
            indiceEsfuerzo: Number(esf.toFixed(2)), cuadrante: { id: q.id, nombre: q.nombre }, votos: vs.length });
        });
        return responder(res.sort(function(a, b){ return a.nombre.localeCompare(b.nombre, 'es'); }));
      }
      if(!body || typeof body.actorId !== 'string' || !body.actorId.trim() || body.actorId.length > 300 || /[\x00-\x1f/\\]/.test(body.actorId)) return responder({ error: 'Actor no válido.' }, 400);
      if(typeof body.votante !== 'string' || !body.votante.trim() || body.votante.length > 60) return responder({ error: 'Escribe un nombre de máximo 60 caracteres.' }, 400);
      var votante = body.votante.trim(), key = body.actorId + '--' + slugVotante(votante);
      if(m === 'DELETE'){ await store.del('priorizacion-votos', key); return responder({ ok: true }); }
      var actor = (await actoresTier()).find(a=>a.id===body.actorId);
      if(!actor || !(await ubicadosVigentes()).actores.some(a=>a.actorId===actor.id)) return responder({ error: 'El actor no está ubicado en la Actividad 3.' }, 400);
      if(body.borrador || !ejeValido(body.impacto, 'impacto') || !ejeValido(body.esfuerzo, 'esfuerzo')) return responder({ error: 'Completa los diez criterios con enteros de 1 a 5. No se guardan borradores.' }, 400);
      var voto = { actorId: body.actorId, votante: votante, impacto: body.impacto, esfuerzo: body.esfuerzo, updatedAt: new Date().toISOString() };
      await store.set('priorizacion-votos', key, voto);
      return responder(voto);
    }
  };

  let colaEscrituras=Promise.resolve();
  window.fetch = async function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var u; try { u = new URL(url, location.href); } catch(e){ return nativeFetch(input, init); }
    var m = /\/api\/([a-z-]+)$/.exec(u.pathname);
    if(!m || !rutas[m[1]]) return nativeFetch(input, init);
    if(!URL_BASE || !KEY) return responder({ error: 'Falta configurar Supabase en config.js.' }, 503);
    var metodo = ((init && init.method) || 'GET').toUpperCase(), body = null;
    if(init && init.body){ try { body = JSON.parse(init.body); } catch(e){ return responder({ error: 'invalid_json' }, 400); } }
    const persona=window.Identidad||window.Acceso?.pendiente;
    const autor=persona?{nombre:persona.nombre,rol:persona.rol}:null;
    if(metodo!=='GET'){
      const rol=window.Identidad?.rol;
      if(rol==='disenador')return responder({error:'Los diseñadores observan el instrumento; no lo editan.'},403);
      if(rol!=='administrador'&&(metodo==='DELETE'||(m[1]==='actors'&&(body?.estado==='descartado'||body?.patch?.estado==='descartado'))))return responder({error:'Solo los administradores pueden borrar o descartar.'},403);
      if(['priorizacion-votos','seleccion','rutas','parejas'].includes(m[1])&&rol!=='administrador')return responder({error:'Solo los administradores editan esta actividad.'},403);
      if(m[1]!=='credenciales'&&!['administrador','participante'].includes(rol))return responder({error:'Identifícate antes de editar.'},403);
    }
    const ejecutar=async()=>{
      if(metodo!=='GET')autorEscritura=autor;
      try {
        var r = await rutas[m[1]](metodo, body, u.searchParams);
        return r || responder({ error: 'method_not_allowed' }, 405);
      } catch(e){
        console.error('[api-supabase]', e);
        return responder({ error: e.message.startsWith('El dato se guardó')?e.message:'No se pudo conectar con la base de datos. Inténtalo de nuevo.' }, 500);
      } finally {
        if(metodo!=='GET')autorEscritura=null;
      }
    };
    if(metodo==='GET')return ejecutar();
    const pendiente=colaEscrituras.then(ejecutar);
    colaEscrituras=pendiente.catch(()=>{});
    return pendiente;
  };
})();
