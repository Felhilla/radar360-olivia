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

  var criteriosPromesa = null;
  function criterios(){
    if(!criteriosPromesa) criteriosPromesa = nativeFetch('priorizacion-criterios.json', { cache: 'no-store' }).then(function(r){ return r.json(); });
    return criteriosPromesa;
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
  var rutas = {
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
        var patch = Object.assign({}, body.patch || {}); delete patch.id; delete patch.createdAt;
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
    'priorizacion-votos': async function(m, body, params){
      var cr = await criterios();
      if(m === 'GET' && params.get('criterios') === '1') return responder(cr);
      function ejeValido(v, eje){
        return v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === cr[eje].length &&
          cr[eje].every(function(c){ return Number.isInteger(v[c.id]) && v[c.id] >= 1 && v[c.id] <= 5; });
      }
      if(m === 'GET'){
        var votos = await store.list('priorizacion-votos');
        if(params.get('resumen') !== '1') return responder(votos);
        var actores = {}; (await activosEmbudo()).forEach(function(a){ actores[a.id] = a; });
        var grupos = {};
        votos.forEach(function(v){
          if(v.borrador || !ejeValido(v.impacto, 'impacto') || !ejeValido(v.esfuerzo, 'esfuerzo')) return;
          (grupos[v.actorId] = grupos[v.actorId] || []).push(v);
        });
        var res = [];
        Object.keys(grupos).forEach(function(id){
          var a = actores[id]; if(!a || a.estado === 'descartado') return;
          var vs = grupos[id];
          // suma en centésimas enteras, igual que la función original, para no perder el 3,0 exacto por coma flotante
          var prom = function(eje){ return vs.reduce(function(s, v){ return s + cr[eje].reduce(function(n, c){ return n + v[eje][c.id] * c.peso; }, 0); }, 0) / (100 * vs.length); };
          var imp = prom('impacto'), esf = prom('esfuerzo');
          var q = cr.cuadrantes.find(function(c){ return c.impacto === (imp >= cr.umbral ? 'alto' : 'bajo') && c.esfuerzo === (esf >= cr.umbral ? 'alto' : 'bajo'); });
          res.push({ actorId: id, nombre: a.nombre, categoria: a.categoria, sector: a.sector || '', indiceImpacto: Number(imp.toFixed(2)),
            indiceEsfuerzo: Number(esf.toFixed(2)), cuadrante: { id: q.id, nombre: q.nombre }, votos: vs.length });
        });
        return responder(res.sort(function(a, b){ return a.nombre.localeCompare(b.nombre, 'es'); }));
      }
      if(!body || typeof body.actorId !== 'string' || !body.actorId.trim() || body.actorId.length > 300 || /[\x00-\x1f/\\]/.test(body.actorId)) return responder({ error: 'Actor no válido.' }, 400);
      if(typeof body.votante !== 'string' || !body.votante.trim() || body.votante.length > 60) return responder({ error: 'Escribe un nombre de máximo 60 caracteres.' }, 400);
      var votante = body.votante.trim(), key = body.actorId + '--' + slugVotante(votante);
      if(m === 'DELETE'){ await store.del('priorizacion-votos', key); return responder({ ok: true }); }
      var actor = await store.get('actors', body.actorId);
      if(!actor || !(await activosEmbudo()).some(a=>a.id===actor.id)) return responder({ error: 'El actor no está activado en la Actividad 3.' }, 400);
      if(body.borrador || !ejeValido(body.impacto, 'impacto') || !ejeValido(body.esfuerzo, 'esfuerzo')) return responder({ error: 'Completa los diez criterios con enteros de 1 a 5. No se guardan borradores.' }, 400);
      var voto = { actorId: body.actorId, votante: votante, impacto: body.impacto, esfuerzo: body.esfuerzo, updatedAt: new Date().toISOString() };
      await store.set('priorizacion-votos', key, voto);
      return responder(voto);
    }
  };

  window.fetch = async function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var u; try { u = new URL(url, location.href); } catch(e){ return nativeFetch(input, init); }
    var m = /\/api\/([a-z-]+)$/.exec(u.pathname);
    if(!m || !rutas[m[1]]) return nativeFetch(input, init);
    if(!URL_BASE || !KEY) return responder({ error: 'Falta configurar Supabase en config.js.' }, 503);
    var metodo = ((init && init.method) || 'GET').toUpperCase(), body = null;
    if(init && init.body){ try { body = JSON.parse(init.body); } catch(e){ return responder({ error: 'invalid_json' }, 400); } }
    try {
      var r = await rutas[m[1]](metodo, body, u.searchParams);
      return r || responder({ error: 'method_not_allowed' }, 405);
    } catch(e){
      console.error('[api-supabase]', e);
      return responder({ error: 'No se pudo conectar con la base de datos. Inténtalo de nuevo.' }, 500);
    }
  };
})();
