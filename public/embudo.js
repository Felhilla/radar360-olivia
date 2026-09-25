/* Reglas compartidas del embudo 3 → 4 → 5; sin acceso a red ni al DOM. */
(function(root){
  'use strict';
  const normalizar = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+%/g,'%');
  const slug = s => normalizar(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'u-' + Array.from(String(s).trim().toLowerCase()).map(c=>c.codePointAt(0).toString(16)).join('-');
  const grupo = a => a && a.estado !== 'descartado' ? ({mercados:'empresas',aliados:'aliados'}[a.categoria] || null) : null;
  // Los demás cruces usan nombre normalizado, incluidos Ecopetrol, Enel y Tuya.
  const emparejamientos = {
    'mercados-promigas':'fila-cap2-14',
    'mercados-tigo-millicom-integracion-de-movistar':'fila-cap2-41',
    'mercados-keralty-colsanitas':'fila-cap2-44',
    'mercados-sura':'fila-cap2-44',
    'mercados-compensar':'fila-cap2-44',
    'mercados-fundacion-santa-fe':'fila-cap2-44',
    'mercados-fundacion-valle-del-lili':'fila-cap2-44'
  };
  function contexto(a, matriz, gremios){
    if(grupo(a)==='empresas') return matriz.find(f=>normalizar(f.cliente)===normalizar(a.nombre)) || matriz.find(f=>f.id===emparejamientos[a.id]) || null;
    const g=gremios.find(g=>g.id===a.id);
    return {contacto:g?.contacto || a.contacto || '', cuentas:g?.cuentas || a.cuentas || (a.empresas || []).join(', '), oferta:g?.oferta || a.oferta || a.relevancia || a.descripcion || a.justificacion || '', descripcion:a.descripcion || a.justificacion || ''};
  }
  function resumen(actores,votos,config){
    if(!config || !Number.isFinite(config.umbral) || config.umbral<1 || config.umbral>2 || typeof config.inclusivo!=='boolean') throw Error('Configuración de activación no válida.');
    return actores.filter(grupo).map(a=>{
      const unicos=new Map();
      votos.filter(v=>v.actorId===a.id && v.grupo===grupo(a) && [1,2].includes(v.valor) && typeof v.votante==='string' && v.votante.trim()).forEach(v=>unicos.set(slug(v.votante),v));
      const vs=[...unicos.values()], promedio=vs.length ? vs.reduce((s,v)=>s+v.valor,0)/vs.length : null;
      return {...a,grupo:grupo(a),promedio,votos:vs.length,activo:vs.length>0 && (config.inclusivo?promedio>=config.umbral:promedio>config.umbral)};
    });
  }
  const activados = (actores,votos,config) => resumen(actores,votos,config).filter(a=>a.activo);
  function elegibles(actores,votos,config,resultados,canvasConfig){
    const activos=new Map(activados(actores,votos,config).map(a=>[a.id,a]));
    return resultados.filter(r=>activos.has(r.actorId) && canvasConfig.cuadrantesElegibles.includes(r.cuadrante?.id)).map(r=>({...activos.get(r.actorId),cuadrante:r.cuadrante}));
  }
  function ficha(a,matriz,gremios){
    const c=contexto(a,matriz,gremios)||{}, g=grupo(a);
    return {id:(g==='aliados'?'aliado:':'empresa:')+a.id,actorId:a.id,grupo:g,nombre:a.nombre,sector:c.sector||a.sector||'',problema:c.necesidadCritica||'',oferta:g==='empresas'?(c.respuestaOlivia||''):'',queOfrece:g==='aliados'?(c.oferta||''):'',aporteOlivia:'',acciones30:'',acciones60:'',acciones90:'',aliado:null,buyer:'',sponsor:'',cta:'',editadoPor:''};
  }
  function csv(filas){
    return '\ufeff'+filas.map(f=>f.map(v=>{let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');
  }
  const api={normalizar,slug,grupo,emparejamientos,contexto,resumen,activados,elegibles,ficha,csv};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.Embudo=api;
})(typeof globalThis==='object'?globalThis:this);
