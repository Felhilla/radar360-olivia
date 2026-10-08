/* Informe PDF de resultados (diseñadores y administradores). Datos en vivo al pulsar el botón; PDF generado en el cliente con jsPDF (public/vendor).
   Sigue el embudo actual: A1 nubes · A2 Radar · A3 actores ubicados · A4 matriz y orden sugerido · A5 rutas de acción.
   recopilar() reúne y calcula los datos; generar() solo dibuja. Los ejemplos (facilitador / ejemplo compartido) nunca entran. */
(function(root){
  'use strict';
  const HORIZONTES = [['corto','Q4-2026'],['medio','Q1-2027'],['largo','Año 2027']];
  const CATEGORIAS = [['competidores','Competidores'],['mercados','Mercados'],['aliados','Aliados estratégicos'],['autoridades','Autoridades']];
  const MERCADOS_PRIORIZADOS = ['Energía','Servicios públicos','Minero','Salud y Gestión de riesgos laborales'];
  const DISCLAIMER = '© La información contenida en Ruta Colombia - Olivia es propiedad intelectual de GH Estudio y ha sido entregada para su estudio y evaluación. Las ideas, metodología y gráficos aquí contenidos no podrán ser empleados parcial o totalmente sin autorización expresa de GH Estudio. Cualquier utilización no autorizada del documento o del contenido del mismo, dará lugar a acciones legales en contra de quienes lo utilicen de manera indebida.';
  const esEjemplo = r => !!(r && (r.facilitador || r.ejemploCompartido));
  const comparar = (a,b) => String(a).localeCompare(String(b),'es');

  // Mercado legible de un actor: el sector del Radar para mercados; la categoría para el resto.
  function mercadoDe(a){
    if(!a) return 'Sin mercado';
    if(a.categoria === 'mercados'){
      const s = String(a.sector || '').trim();
      const igual = MERCADOS_PRIORIZADOS.find(m => m.toLocaleLowerCase('es') === s.toLocaleLowerCase('es'));
      return igual || s || 'Otros mercados';
    }
    return (CATEGORIAS.find(c => c[0] === a.categoria) || [null, a.categoria || 'Sin mercado'])[1];
  }
  const rangoMercado = m => { const i = MERCADOS_PRIORIZADOS.indexOf(m); return i < 0 ? MERCADOS_PRIORIZADOS.length : i; };
  function agruparPorMercado(lista){
    const grupos = [];
    lista.slice().sort((a,b) => rangoMercado(a.mercado) - rangoMercado(b.mercado) || comparar(a.mercado, b.mercado) || comparar(a.nombre, b.nombre))
      .forEach(x => { let g = grupos.find(y => y.mercado === x.mercado); if(!g){ g = {mercado:x.mercado, priorizado:MERCADOS_PRIORIZADOS.includes(x.mercado), items:[]}; grupos.push(g); } g.items.push(x); });
    return grupos;
  }

  // leer(url) devuelve el JSON de cada ruta; deps trae Ideas, TierList y Rutas (o se toman del navegador).
  async function recopilar(leer, deps, ordenarSectores){
    deps = deps || {};
    const Ideas = deps.Ideas || root.Ideas, TierList = deps.TierList || root.TierList, Rutas = deps.Rutas || root.Rutas, Corte = deps.Corte || root.Corte || (typeof require==='function'?require('./corte.js'):null);
    const opcional = p => p.catch(() => null);
    const [actores, ideas, catalogo, sorteo, resumenA4, criterios, rutas] = await Promise.all([
      leer('/api/actors'), leer('/api/ideas'), opcional(leer('data/actores.json')), opcional(leer('/api/parejas')),
      leer('/api/priorizacion-votos?resumen=1'), leer('priorizacion-criterios.json'), opcional(leer('/api/rutas'))
    ]);
    const tier = sorteo && sorteo.id ? (await opcional(leer('/api/tierlist?sorteo=' + encodeURIComponent(sorteo.id)))) || [] : [];
    const orden = ordenarSectores || ((c, s) => s.slice().sort(comparar));
    const vigentes = (actores || []).filter(a => a.estado !== 'descartado');
    const porId = new Map((catalogo || []).map(a => [a.id, a]));
    vigentes.forEach(a => porId.set(a.id, Object.assign({}, porId.get(a.id) || {}, a)));
    const ficha = id => porId.get(id) || {id, nombre:id};

    // A1 · Nubes por horizonte
    const respuestas = ((ideas && ideas.stickers) || []).filter(r => !esEjemplo(r));
    const a1 = HORIZONTES.map(([id, titulo]) => ({id, titulo, respuestas:respuestas.filter(r => r.horizonte === id).length,
      palabras:Ideas.contar(respuestas.filter(r => r.horizonte === id), {maxPalabras:25})}));

    // A2 · Radar
    const a2 = CATEGORIAS.map(([id, titulo]) => {
      const l = vigentes.filter(a => a.categoria === id);
      const sectores = orden(id, Array.from(new Set(l.map(a => a.sector || 'Sin sector'))));
      return {id, titulo, total:l.length, sectores:sectores.map(s => ({sector:s, actores:l.filter(a => (a.sector || 'Sin sector') === s).map(a => a.nombre).sort(comparar)}))};
    });

    // A3 · Todos los ubicados del sorteo vigente; cada actor figura en su mejor nivel.
    const colocaciones = (tier || []).filter(f => !esEjemplo(f));
    const ubicados = sorteo && TierList ? TierList.ubicados(sorteo, colocaciones) : [];
    const porUbicacion = new Map(ubicados.map(n => [n.actorId,n]));
    const actoresUbicados = ubicados.map(n => { const a = ficha(n.actorId); return {...n,id:n.actorId,nombre:a.nombre || n.actorId,mercado:mercadoDe(a),grupos:n.grupos.length}; });
    const a3 = {grupos:(sorteo && sorteo.grupos || []).length, colocaciones:ubicados.reduce((s,n)=>s+n.grupos.length,0),
      mercados:agruparPorMercado(actoresUbicados),
      niveles:[1,2,3,4].map(nivel=>({nivel,mercados:agruparPorMercado(actoresUbicados.filter(a=>a.mejorNivel===nivel))}))};

    // A4 · Calificados en cualquier nivel; el interés futuro corresponde solo a Tier 1–2.
    const calificados = (resumenA4 || []).filter(r => r.votos > 0 && !esEjemplo(r) && porUbicacion.has(r.actorId))
      .map(r=>({...r,mejorNivel:porUbicacion.get(r.actorId).mejorNivel}));
    const grupos = Object.fromEntries(ubicados.map(n=>[n.actorId,n.grupos]));
    const ordenados = Corte.ordenar(actoresUbicados.map(a=>({...a,votos:0,...calificados.find(r=>r.actorId===a.actorId)})),criterios.corte,grupos);
    const priorizados = ordenados.filter(r=>!r.sinCalificar);
    const interesFuturo = ordenados.filter(r=>r.sinCalificar&&r.mejorNivel<=2).map(r=>r.nombre);
    const a4 = {umbral:criterios.umbral, cuadrantes:criterios.cuadrantes, priorizados, interesFuturo};

    // A5 · Todos los Tier 1–2, incluso si todavía no tienen calificación ni ruta.
    const elegibles = ordenados.filter(r=>r.mejorNivel<=2);
    const rutasValidas = (rutas || []).filter(r => !esEjemplo(r));
    const a5 = {origen:'automatica', rutas:elegibles.map((a,i)=>({
      actorId:a.actorId,posicion:i+1,nombre:a.nombre,mercado:a.mercado,mejorNivel:a.mejorNivel,
      cuadrante:a.sinCalificar?'Interés futuro':a.cuadrante.nombre,
      ruta:rutasValidas.find(r=>r.actorId===a.actorId)||null
    }))};
    const campos = Rutas ? Rutas.CAMPOS : [['aporte','¿Qué aporta Olivia?'],['accionesQ4','Acciones Q4-2026'],['accionesQ1','Acciones Q1-2027'],['acciones2027','Acciones año 2027 y resultado esperado a diciembre de 2027'],['indicador','Indicador de seguimiento']];
    const etiqueta = id => Rutas ? Rutas.etiquetaNombre(id) : id;
    const arista = id => Rutas ? Rutas.aristaNombre(id) : id;

    const resumen = {respuestas:respuestas.length, actores:vigentes.length, ubicados:ubicados.length, calificados:calificados.length, rutas:a5.rutas.filter(r => r.ruta).length, enLista:elegibles.length};
    return {generado:new Date(), resumen, a1, a2, a3, a4, a5, campos, etiqueta, arista};
  }

  // Helvetica de jsPDF usa WinAnsi: se reemplazan los caracteres que no puede dibujar.
  const limpiar = s => String(s == null ? '' : s).replace(/[≥]/g,'>=').replace(/[≤]/g,'<=').replace(/[→]/g,'->').replace(/[‑‒]/g,'-').replace(/[^\x00-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g,'');
  const numero = n => n == null ? '—' : Number(n).toLocaleString('es-CO', {maximumFractionDigits:2});

  function generar(d, jsPDF){
    const doc = new jsPDF({unit:'pt', format:'a4'});
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, ancho = W - 2*M;
    const TINTA = [28,26,21], SUAVE = [91,88,78], ACENTO = [14,124,116], FONDO = [234,244,242];
    let y = M;
    const fecha = d.generado.toLocaleString('es-CO', {dateStyle:'long', timeStyle:'short'});
    function pie(){
      const n = doc.internal.getNumberOfPages();
      for(let i = 1; i <= n; i++){ doc.setPage(i); doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...SUAVE);
        doc.text(limpiar('Ruta Colombia - Olivia · Informe de resultados · '+fecha+' · Página '+i+' de '+n), W/2, H-24, {align:'center'}); }
    }
    function espacio(h){ if(y + h > H - 56){ doc.addPage(); y = M; } }
    function texto(t, o){
      o = o || {}; doc.setFont('helvetica', o.negrita ? 'bold' : 'normal'); doc.setFontSize(o.tam || 10); doc.setTextColor(...(o.color || TINTA));
      const lineas = doc.splitTextToSize(limpiar(t), o.ancho || ancho - (o.sangria || 0)), alto = (o.tam || 10) * 1.35;
      lineas.forEach(l => { espacio(alto); doc.text(l, M + (o.sangria || 0), y + (o.tam || 10)); y += alto; });
      y += o.despues == null ? 4 : o.despues;
    }
    function seccion(t, bajada){ doc.addPage(); y = M; texto(t, {tam:17, negrita:true, color:ACENTO, despues:2}); doc.setDrawColor(...ACENTO); doc.setLineWidth(1.2); doc.line(M, y, W-M, y); y += 12; if(bajada) texto(bajada, {color:SUAVE, despues:8}); }
    function sub(t){ espacio(40); y += 6; texto(t, {tam:12.5, negrita:true, despues:4}); }
    function cifra(x, valor, rotulo){
      doc.setFillColor(...FONDO); doc.roundedRect(x, y, (ancho - 30)/4, 64, 6, 6, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(...ACENTO); doc.text(String(valor), x + 12, y + 30);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...SUAVE); doc.text(doc.splitTextToSize(limpiar(rotulo), (ancho - 30)/4 - 20), x + 12, y + 46);
    }

    // Portada
    y = 190; texto('Ruta Colombia - Olivia', {tam:30, negrita:true, color:ACENTO, despues:6});
    texto('Informe de avance estratégico', {tam:15, despues:4});
    texto('Generado el '+fecha, {tam:10.5, color:SUAVE, despues:24});
    texto('Las actividades 1 a 3 recogen información (ideas, mapa de actores y tier list). Las actividades 4 y 5 la focalizan: priorizan actores y definen rutas de acción con responsables. Datos en vivo al momento de generar el informe. El trabajo continúa entre sesiones; calificaciones y rutas pueden estar pendientes.', {tam:10.5, despues:0});
    y = H - 170; texto(DISCLAIMER, {tam:8.5, color:SUAVE});

    // Resumen ejecutivo
    seccion('Resumen', 'Lo esencial en una página: cuántos datos hay y qué cuentas tienen ruta de acción.');
    const r = d.resumen, paso = (ancho - 30)/4 + 10;
    cifra(M, r.respuestas, 'respuestas en Alinear el juego'); cifra(M + paso, r.actores, 'actores en el Radar 360°');
    cifra(M + 2*paso, r.ubicados, 'actores ubicados en Tier 1–4'); cifra(M + 3*paso, r.calificados, 'actores calificados en la Actividad 4');
    y += 84;
    sub('Con ruta: '+r.rutas+' de '+r.enLista+' actores de Tier 1–2');
    if(!d.a5.rutas.length) texto('Todavía no hay cuentas en la Actividad 5.', {color:SUAVE});
    d.a5.rutas.forEach(x => {
      const ru = x.ruta;
      texto(x.posicion + '. ' + x.nombre + ' — ' + x.mercado + (ru ? ' · ' + d.etiqueta(ru.etiqueta) : ''), {tam:10, negrita:true, despues:1});
      texto(ru ? 'Responsable: ' + (ru.responsable || 'Pendiente') + (ru.apoyo ? ' · Apoyo: ' + ru.apoyo : '') : 'Ruta por construir.', {tam:9.5, color:SUAVE, sangria:14, despues:4});
    });
    if(d.a4.interesFuturo.length){ sub('Interés futuro (' + d.a4.interesFuturo.length + ')'); texto('Actores de Tier 1–2 aún sin calificar: ' + d.a4.interesFuturo.join(', ') + '.', {tam:9.5}); }

    // Actividad 1
    seccion('1. Alinear el juego · Nubes de palabras', 'Palabras más frecuentes en las respuestas de cada horizonte (sin artículos, preposiciones ni conectores). El tamaño indica cuántas veces aparece.');
    d.a1.forEach(h => {
      sub(h.titulo + ' · ' + h.respuestas + ' respuesta(s)');
      if(!h.palabras.length){ texto('Sin respuestas registradas.', {color:SUAVE}); return; }
      const fMax = h.palabras[0].frecuencia, fMin = h.palabras[h.palabras.length-1].frecuencia;
      let x = M; espacio(40); let fila = y;
      h.palabras.forEach(p => {
        const tam = fMax === fMin ? 13 : 9 + 13 * (p.frecuencia - fMin) / (fMax - fMin), palabra = limpiar(p.palabra);
        doc.setFont('helvetica','bold'); doc.setFontSize(tam); const w = doc.getTextWidth(palabra);
        if(x + w > W - M){ x = M; fila += 26; if(fila > H - 80){ doc.addPage(); fila = M; } }
        doc.setTextColor(...(p.frecuencia === fMax ? ACENTO : TINTA)); doc.text(palabra, x, fila + 18); x += w + 10;
      });
      y = fila + 32;
      texto(h.palabras.map(p => p.palabra + ' (' + p.frecuencia + ')').join(' · '), {tam:8.5, color:SUAVE});
    });

    // Actividad 2
    seccion('2. Radar 360° · Actores vigentes', 'Total: ' + d.a2.reduce((s,c) => s + c.total, 0) + ' actores vigentes (sin descartados).');
    d.a2.forEach(c => {
      sub(c.titulo + ' (' + c.total + ')');
      c.sectores.forEach(s => texto(s.sector + ': ' + s.actores.join(', ') + '.', {tam:9.5, despues:3}));
    });

    // Actividad 3
    seccion('3. Tier list · Actores ubicados por nivel y mercado', d.a3.grupos + ' grupo(s) · ' + d.a3.colocaciones + ' ubicaciones. Sin límite por nivel. Se muestra el mejor nivel alcanzado entre los grupos.');
    d.a3.niveles.forEach(n=>{
      sub('Tier '+n.nivel);
      if(!n.mercados.length)texto('Sin actores ubicados.',{color:SUAVE});
      n.mercados.forEach(g=>{
        sub(g.mercado+' · '+g.items.length+(g.priorizado?' · mercado priorizado':''));
        g.items.forEach(x=>texto('• '+x.nombre+' — ubicado por '+x.grupos+(x.grupos===1?' grupo':' grupos'),{tam:9.5,sangria:6,despues:2}));
      });
    });

    // Actividad 4
    seccion('4. Priorizar actores y mercados · Matriz Impacto–Esfuerzo', 'Cada punto es un actor calificado (escala 1 a 5). El número remite a la lista bajo el gráfico.');
    const lado = Math.min(ancho, 360), gx = M + (ancho - lado)/2 + 16, gy = y + 8, px = n => gx + (n-1) * lado/4, py = n => gy + lado - (n-1) * lado/4, t = d.a4.umbral;
    d.a4.cuadrantes.forEach(q => {
      const izq = q.esfuerzo === 'bajo', arriba = q.impacto === 'alto', x0 = izq ? px(1) : px(t), x1 = izq ? px(t) : px(5), y0 = arriba ? py(5) : py(t), y1 = arriba ? py(t) : py(1);
      doc.setFillColor(...(arriba ? [220,238,235] : [239,234,224])); doc.rect(x0, y0, x1-x0, y1-y0, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...SUAVE); doc.text(limpiar(q.nombre), x0 + 5, arriba ? y0 + 11 : y1 - 5);
    });
    doc.setDrawColor(...TINTA); doc.setLineWidth(.8); doc.line(px(1), py(5), px(1), py(1)); doc.line(px(1), py(1), px(5), py(1));
    doc.setLineDashPattern([3,3], 0); doc.setDrawColor(...SUAVE); doc.line(px(t), py(5), px(t), py(1)); doc.line(px(1), py(t), px(5), py(t)); doc.setLineDashPattern([], 0);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...TINTA);
    for(let n = 1; n <= 5; n++){ doc.text(String(n), px(n), py(1) + 12, {align:'center'}); doc.text(String(n), px(1) - 8, py(n) + 3, {align:'right'}); }
    doc.text('Esfuerzo -> (5 = más esfuerzo)', gx + lado/2, py(1) + 26, {align:'center'});
    doc.text('Impacto', px(1) - 26, gy - 6);
    // Puntos con posición ligeramente desplazada si coinciden, para que se lean todos los números.
    const vistos = {};
    d.a4.priorizados.forEach((p, i) => {
      const k = p.indiceEsfuerzo + '|' + p.indiceImpacto, n = vistos[k] = (vistos[k] || 0) + 1, dx = (n - 1) % 4 * 13, dy = Math.floor((n - 1) / 4) * 13;
      const cx = px(p.indiceEsfuerzo) + dx, cy = py(p.indiceImpacto) - dy;
      doc.setFillColor(...ACENTO); doc.circle(cx, cy, 6, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(255,255,255); doc.text(String(i+1), cx, cy + 2.3, {align:'center'});
    });
    y = gy + lado + 40;
    sub('Actores calificados (' + d.a4.priorizados.length + '), por cuadrante');
    if(!d.a4.priorizados.length) texto('Sin calificaciones registradas.', {color:SUAVE});
    d.a4.priorizados.forEach((p, i) => texto((i+1) + '. ' + p.nombre + ' — Tier '+p.mejorNivel+' · ' + p.cuadrante.nombre + ' · Impacto ' + numero(p.indiceImpacto) + ' · Esfuerzo ' + numero(p.indiceEsfuerzo) + ' · ' + p.votos + ' calificación(es)', {tam:9.5, despues:2}));
    if(d.a4.interesFuturo.length){ sub('Interés futuro (' + d.a4.interesFuturo.length + ')'); texto('Tier 1–2 sin calificación, disponibles para construir ruta en la Actividad 5: ' + d.a4.interesFuturo.join(', ') + '.', {tam:9.5}); }

    // Actividad 5
    seccion('5. Rutas de acción', 'Todos los actores de Tier 1–2, con o sin calificación. Las rutas se construyen y actualizan en distintas sesiones: responsable, apoyo y acciones por horizonte.');
    if(!d.a5.rutas.length) texto('Todavía no hay cuentas en la Actividad 5.', {color:SUAVE});
    d.a5.rutas.forEach(x => {
      espacio(80); texto(x.posicion + '. ' + x.nombre, {tam:12, negrita:true, color:ACENTO, despues:1});
      texto('Tier '+x.mejorNivel+' · '+x.mercado + (x.cuadrante ? ' · ' + x.cuadrante : ''), {tam:9, color:SUAVE, despues:3});
      const ru = x.ruta;
      if(!ru){ texto('Ruta por construir.', {tam:9.5, color:SUAVE, despues:8}); return; }
      texto('Responsable: ' + (ru.responsable || 'Pendiente') + '   ·   Apoyo: ' + (ru.apoyo || 'Sin asignar') + '   ·   ' + (d.etiqueta(ru.etiqueta) || 'Sin etiqueta'), {tam:9.5, negrita:true, despues:3});
      if(Array.isArray(ru.aristas) ? ru.aristas.length : ru.aristas && Object.keys(ru.aristas).length){
        const aristas = Array.isArray(ru.aristas) ? ru.aristas : Object.keys(ru.aristas).filter(k => ru.aristas[k]);
        texto('Aristas: ' + aristas.map(d.arista).join(', '), {tam:9.5, sangria:10, despues:2});
      }
      const lleno = k => ru[k] && String(ru[k]).trim();
      d.campos.filter(([k]) => lleno(k)).forEach(([k, t]) => texto(t + ': ' + ru[k], {tam:9.5, sangria:10, despues:2}));
      const pendientes = d.campos.filter(([k]) => !lleno(k)).map(([, t]) => t.replace(/ y resultado esperado.*$/, ''));
      if(pendientes.length) texto('Por completar: ' + pendientes.join(' · '), {tam:9, color:SUAVE, sangria:10, despues:2});
      y += 8;
    });
    pie();
    return doc;
  }

  const nombreArchivo = fecha => 'Ruta-Colombia-Olivia_informe_' + fecha.toISOString().slice(0,10) + '.pdf';
  const api = {recopilar, generar, nombreArchivo, limpiar, mercadoDe, agruparPorMercado, DISCLAIMER, MERCADOS_PRIORIZADOS};
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.Informe = api;
})(typeof globalThis === 'object' ? globalThis : this);
