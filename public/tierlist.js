/* Reglas de la Actividad 3, compartidas entre navegador y Node. */
(function(root){
  'use strict';
  const INDUSTRIAS = [
    ['financiero','Financiero y fintech'],['energia','Energía, servicios públicos y recursos naturales'],
    ['retail','Retail, consumo masivo y comercio'],['industrial','Industrial, manufactura y construcción'],
    ['telecom','Telecomunicaciones'],['salud','Salud privada'],['gremios_publico','Gremios y sector público']
  ].map(([id,nombre])=>Object.freeze({id,nombre}));
  const ids=INDUSTRIAS.map(i=>i.id), MAX_NIVEL_1=3;
  const normalizar=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function barajar(lista,rng){
    const out=lista.slice();
    for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
    return out;
  }
  function formarGrupos(presentes,rng=Math.random){
    if(!Array.isArray(presentes)||!presentes.length) throw Error('Debe haber al menos una persona');
    if(presentes.some(n=>typeof n!=='string'||!n.trim())||new Set(presentes.map(normalizar)).size!==presentes.length) throw Error('Los nombres deben ser válidos y únicos');
    const nombres=barajar(presentes,rng), grupos=[];
    while(nombres.length) grupos.push(nombres.splice(0,nombres.length===3?3:2));
    return grupos;
  }
  function repartirIndustrias(numGrupos,actores,rng=Math.random){
    if(!Number.isInteger(numGrupos)||numGrupos<1) throw Error('Número de grupos no válido');
    const peso=id=>actores.filter(a=>a.industria===id).length;
    const grandes=barajar(ids,rng).sort((a,b)=>peso(b)-peso(a)||(a==='energia'?-1:b==='energia'?1:0));
    // Completar el mínimo antes de repartir: así Energía repetida no cae
    // sobre un grupo que ya concentra la mayor carga.
    const pendientesIndustria=grandes.slice();
    for(let i=0;i<Math.max(0,2*numGrupos-ids.length);i++) pendientesIndustria.push(grandes[i%grandes.length]);
    pendientesIndustria.sort((a,b)=>peso(b)-peso(a));
    const grupos=Array.from({length:numGrupos},()=>[]), carga=grupos.map(()=>0);
    const orden=barajar(grupos.map((_,i)=>i),rng), max=Math.max(3,Math.ceil(7/numGrupos));
    pendientesIndustria.forEach((id,pos)=>{
      const faltan=grupos.reduce((s,g)=>s+Math.max(0,2-g.length),0);
      const pendientes=pendientesIndustria.length-pos;
      const candidatos=orden.filter(i=>!grupos[i].includes(id)&&grupos[i].length<max && (pendientes>faltan||grupos[i].length<2));
      candidatos.sort((a,b)=>carga[a]-carga[b]);
      const i=candidatos[0];grupos[i].push(id);carga[i]+=peso(id);
    });
    return grupos;
  }
  let secuencia=0;
  function sortear(presentes,actores,rng=Math.random){
    const integrantes=formarGrupos(presentes,rng), industrias=repartirIndustrias(integrantes.length,actores,rng);
    const createdAt=new Date().toISOString(),id='s-'+Date.now().toString(36)+'-'+(++secuencia).toString(36)+'-'+Math.floor(rng()*0x100000000).toString(36);
    return {id,grupos:integrantes.map((personas,i)=>({id:id+'-g'+(i+1),integrantes:personas,industrias:industrias[i]})),createdAt};
  }
  function actoresDelGrupo(grupo,actores){
    const incluidos=new Set(actores.filter(a=>grupo.industrias.includes(a.industria)).map(a=>a.id));
    actores.filter(a=>incluidos.has(a.id)&&a.tipo==='empresa').forEach(a=>(a.gremios_asociados||[]).forEach(id=>incluidos.add(id)));
    const sub=['energia','servicios_publicos','recursos_naturales'];
    return [...new Map(actores.filter(a=>incluidos.has(a.id)).map(a=>[a.id,a])).values()].sort((a,b)=>
      ids.indexOf(a.industria)-ids.indexOf(b.industria)||sub.indexOf(a.subindustria)-sub.indexOf(b.subindustria)||
      (a.tipo==='gremio')-(b.tipo==='gremio')||a.nombre.localeCompare(b.nombre,'es'));
  }
  function grupoDe(sorteo,nombre){return sorteo?.grupos.find(g=>g.integrantes.some(n=>normalizar(n)===normalizar(nombre)))||null;}
  // colocaciones es la lista de filas de UN grupo.
  function puedeMover(colocaciones,actorId,nivel){
    if(![null,1,2,3,4].includes(nivel)) return {ok:false,motivo:'Nivel no válido'};
    if(nivel===1&&new Set(colocaciones.filter(c=>c.nivel===1&&c.actorId!==actorId).map(c=>c.actorId)).size>=MAX_NIVEL_1)
      return {ok:false,motivo:'El Nivel 1 admite máximo 3 actores por grupo'};
    return {ok:true,motivo:''};
  }
  function nivel1(sorteo,colocaciones){
    const grupos=new Set((sorteo?.grupos||[]).map(g=>g.id)), out=new Map();
    colocaciones.filter(c=>c.sorteoId===sorteo?.id&&grupos.has(c.grupoId)&&c.nivel===1).forEach(c=>{
      if(!out.has(c.actorId))out.set(c.actorId,new Set());out.get(c.actorId).add(c.grupoId);
    });
    return [...out].map(([actorId,gs])=>({actorId,grupos:[...gs]}));
  }
  const api={INDUSTRIAS:Object.freeze(INDUSTRIAS),MAX_NIVEL_1,formarGrupos,repartirIndustrias,sortear,actoresDelGrupo,grupoDe,puedeMover,nivel1};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TierList=api;
})(typeof globalThis!=='undefined'?globalThis:this);
