/* Informe PDF de resultados (solo administradores). Datos en vivo al pulsar el botón; PDF generado en el cliente con jsPDF (public/vendor).
   recopilar() reúne y calcula los datos reutilizando Embudo e Ideas; generar() solo dibuja. */
(function(root){
  'use strict';
  const HORIZONTES = [['corto','Corto plazo · 2026'],['medio','Mediano plazo · 2027–2028'],['largo','Largo plazo · 2030']];
  const CATEGORIAS = [['competidores','Competidores'],['mercados','Mercados'],['aliados','Aliados estratégicos'],['autoridades','Autoridades']];
  const DISCLAIMER = '© La información contenida en Ruta Colombia - Olivia es propiedad intelectual de GH Estudio y ha sido entregada para su estudio y evaluación. Las ideas, metodología y gráficos aquí contenidos no podrán ser empleados parcial o totalmente sin autorización expresa de GH Estudio. Cualquier utilización no autorizada del documento o del contenido del mismo, dará lugar a acciones legales en contra de quienes lo utilicen de manera indebida.';

  // leer(url) devuelve el JSON de cada ruta; ordenarSectores(categoria, sectores) es opcional.
  async function recopilar(leer, deps, ordenarSectores){
    const Embudo = deps.Embudo, Ideas = deps.Ideas;
    const [actores, ideas, votosA3, cfgA3, resumenA4, criterios, canvas, cfgA5] = await Promise.all([
      leer('/api/actors'), leer('/api/ideas'), leer('/api/activacion-votos'), leer('embudo-config.json'),
      leer('/api/priorizacion-votos?resumen=1'), leer('priorizacion-criterios.json'), leer('/api/canvas'), leer('canvas-config.json')
    ]);
    const orden = ordenarSectores || ((c, s) => s.slice().sort((a,b) => a.localeCompare(b,'es')));
    const vigentes = actores.filter(a => a.estado !== 'descartado');
    const respuestas = (ideas && ideas.stickers) || [];
    const a1 = HORIZONTES.map(([id, titulo]) => ({id, titulo, respuestas:respuestas.filter(r => r.horizonte === id).length, palabras:Ideas.contar(respuestas.filter(r => r.horizonte === id), {maxPalabras:25})}));
    const a2 = CATEGORIAS.map(([id, titulo]) => {
      const lista = vigentes.filter(a => a.categoria === id);
      const sectores = orden(id, Array.from(new Set(lista.map(a => a.sector || 'Sin sector'))));
      return {id, titulo, total:lista.length, sectores:sectores.map(s => ({sector:s, actores:lista.filter(a => (a.sector || 'Sin sector') === s).map(a => a.nombre).sort((x,y) => x.localeCompare(y,'es'))}))};
    });
    const activos = Embudo.resumen(actores, votosA3, cfgA3).filter(a => a.activo);
    const a3 = [['empresas','Empresas activadas'],['aliados','Gremios-aliados activados']].map(([g, titulo]) => ({grupo:g, titulo, actores:activos.filter(a => a.grupo === g).sort((x,y) => x.nombre.localeCompare(y.nombre,'es')).map(a => ({nombre:a.nombre, promedio:a.promedio, votos:a.votos}))}));
    const idsActivos = new Set(activos.map(a => a.id));
    // Orden de lectura: primero lo que pasa a la Actividad 5.
    const ordenQ = ['victorias-tempranas','apuestas-estrategicas','mantenimiento-selectivo','racionalizacion'].concat(criterios.cuadrantes.map(q => q.id));
    const a4 = {umbral:criterios.umbral, cuadrantes:criterios.cuadrantes, priorizados:resumenA4.filter(r => idsActivos.has(r.actorId))
      .sort((a,b) => ordenQ.indexOf(a.cuadrante.id) - ordenQ.indexOf(b.cuadrante.id) || b.indiceImpacto - a.indiceImpacto || a.indiceEsfuerzo - b.indiceEsfuerzo || a.nombre.localeCompare(b.nombre,'es'))};
    const elegibles = Embudo.elegibles(actores, votosA3, cfgA3, resumenA4, cfgA5);
    const guardado = a => canvas.find(c => c.id === (a.grupo === 'aliados' ? 'aliado:' : 'empresa:') + a.id);
    const a5 = [['aliados','Ruta de acción · Aliados'],['empresas','Ruta de acción · Empresas']].map(([g, titulo]) => ({grupo:g, titulo, fichas:elegibles.filter(a => a.grupo === g).sort((x,y) => x.nombre.localeCompare(y.nombre,'es')).map(a => ({nombre:a.nombre, ficha:guardado(a) || null}))}));
    return {generado:new Date(), a1, a2, a3, a4, a5};
  }

  // Helvetica de jsPDF usa WinAnsi: se reemplazan los caracteres que no puede dibujar.
  const limpiar = s => String(s == null ? '' : s).replace(/[≥]/g,'>=').replace(/[≤]/g,'<=').replace(/[→]/g,'->').replace(/[‑‒]/g,'-').replace(/[^\x00-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g,'');
  const numero = n => n == null ? '—' : Number(n).toLocaleString('es-CO', {maximumFractionDigits:2});

  function generar(d, jsPDF){
    const doc = new jsPDF({unit:'pt', format:'a4'});
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, ancho = W - 2*M;
    const TINTA = [28,26,21], SUAVE = [91,88,78], ACENTO = [14,124,116];
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
    function seccion(t){ doc.addPage(); y = M; texto(t, {tam:17, negrita:true, color:ACENTO, despues:2}); doc.setDrawColor(...ACENTO); doc.setLineWidth(1.2); doc.line(M, y, W-M, y); y += 14; }
    function sub(t){ espacio(40); y += 6; texto(t, {tam:12.5, negrita:true, despues:4}); }

    // Portada
    y = 190; texto('Ruta Colombia - Olivia', {tam:30, negrita:true, color:ACENTO, despues:6});
    texto('Informe de resultados del taller estratégico', {tam:15, despues:4});
    texto('Taller del 6 de octubre de 2026 · Generado el '+fecha, {tam:10.5, color:SUAVE, despues:24});
    texto('Contenido: 1. Alinear el juego · 2. Radar 360° · 3. Activar empresas y gremios-aliados · 4. Priorizar actores y mercados · 5. Construir rutas de acción. Datos en vivo al momento de generar el informe.', {tam:10.5, despues:0});
    y = H - 170; texto(DISCLAIMER, {tam:8.5, color:SUAVE});

    // Actividad 1
    seccion('1. Alinear el juego · Nubes de palabras');
    texto('Palabras más frecuentes en las respuestas de cada horizonte (sin artículos, preposiciones ni conectores).', {color:SUAVE});
    d.a1.forEach(h => {
      sub(h.titulo+' · '+h.respuestas+' respuesta(s)');
      if(!h.palabras.length){ texto('Sin respuestas registradas.', {color:SUAVE}); return; }
      // Nube simple: tamaño proporcional a la frecuencia, en filas.
      const fMax = h.palabras[0].frecuencia, fMin = h.palabras[h.palabras.length-1].frecuencia;
      let x = M; espacio(40); let fila = y;
      h.palabras.forEach(p => {
        const tam = fMax === fMin ? 13 : 9 + 13 * (p.frecuencia - fMin) / (fMax - fMin), palabra = limpiar(p.palabra);
        doc.setFont('helvetica','bold'); doc.setFontSize(tam); const w = doc.getTextWidth(palabra);
        if(x + w > W - M){ x = M; fila += 26; if(fila > H - 80){ doc.addPage(); fila = M; } }
        doc.setTextColor(...(p.frecuencia === fMax ? ACENTO : TINTA)); doc.text(palabra, x, fila + 18); x += w + 10;
      });
      y = fila + 32;
      texto(h.palabras.map(p => p.palabra+' ('+p.frecuencia+')').join(' · '), {tam:8.5, color:SUAVE});
    });

    // Actividad 2
    seccion('2. Radar 360° · Actores vigentes');
    texto('Total: '+d.a2.reduce((s,c) => s + c.total, 0)+' actores vigentes (sin descartados).', {color:SUAVE});
    d.a2.forEach(c => {
      sub(c.titulo+' ('+c.total+')');
      c.sectores.forEach(s => texto(s.sector+': '+s.actores.join(', ')+'.', {tam:9.5, despues:3}));
    });

    // Actividad 3
    seccion('3. Activar empresas y gremios-aliados');
    texto('Se activa con promedio mayor o igual al umbral configurado (Sí = 2, No = 1).', {color:SUAVE});
    d.a3.forEach(g => {
      sub(g.titulo+' ('+g.actores.length+')');
      if(!g.actores.length){ texto('Ninguno activado.', {color:SUAVE}); return; }
      g.actores.forEach(a => texto('• '+a.nombre+' — promedio '+numero(a.promedio)+' · '+a.votos+' voto(s)', {tam:9.5, despues:2}));
    });

    // Actividad 4
    seccion('4. Priorizar actores y mercados · Matriz Impacto–Esfuerzo');
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
    d.a4.priorizados.forEach((r, i) => {
      doc.setFillColor(...ACENTO); doc.circle(px(r.indiceEsfuerzo), py(r.indiceImpacto), 6, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(255,255,255); doc.text(String(i+1), px(r.indiceEsfuerzo), py(r.indiceImpacto) + 2.3, {align:'center'});
    });
    y = gy + lado + 40;
    sub('Actores priorizados ('+d.a4.priorizados.length+'), por cuadrante');
    if(!d.a4.priorizados.length) texto('Sin calificaciones registradas.', {color:SUAVE});
    d.a4.priorizados.forEach((r, i) => texto((i+1)+'. '+r.nombre+' — '+r.cuadrante.nombre+' · Impacto '+numero(r.indiceImpacto)+' · Esfuerzo '+numero(r.indiceEsfuerzo)+' · '+r.votos+' voto(s)', {tam:9.5, despues:2}));

    // Actividad 5
    seccion('5. Construir rutas de acción');
    texto('Actores activados que quedaron en Victorias tempranas o Apuestas estratégicas, con la ficha guardada por el grupo.', {color:SUAVE});
    d.a5.forEach(g => {
      sub(g.titulo+' ('+g.fichas.length+')');
      if(!g.fichas.length){ texto('Ningún actor llegó a esta etapa.', {color:SUAVE}); return; }
      g.fichas.forEach(f => {
        espacio(60); texto(f.nombre, {tam:11, negrita:true, color:ACENTO, despues:2});
        if(!f.ficha){ texto('Sin ficha guardada.', {tam:9.5, color:SUAVE}); return; }
        const c = f.ficha, campos = g.grupo === 'aliados'
          ? [['Qué ofrece', c.queOfrece], ['Qué aporta Olivia', c.aporteOlivia]]
          : [['Problema / contexto', c.problema], ['Oferta de Olivia', c.oferta], ['Aliado impulsor', c.aliado && c.aliado.nombre], ['Buyer', c.buyer], ['Sponsor', c.sponsor], ['CTA', c.cta]];
        campos.concat([['Acciones a 30 días', c.acciones30], ['Acciones a 60 días', c.acciones60], ['Acciones a 90 días', c.acciones90]])
          .forEach(([k, v]) => texto(k+': '+(v && String(v).trim() ? v : 'Pendiente'), {tam:9.5, sangria:10, despues:1}));
        y += 6;
      });
    });
    pie();
    return doc;
  }

  const nombreArchivo = fecha => 'Ruta-Colombia-Olivia_informe_' + fecha.toISOString().slice(0,10) + '.pdf';
  const api = {recopilar, generar, nombreArchivo, limpiar, DISCLAIMER};
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.Informe = api;
})(typeof globalThis === 'object' ? globalThis : this);
