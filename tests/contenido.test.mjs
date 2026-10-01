import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {validar, validarRegistro, ejecutar, opciones} from '../supabase/sembrar-contactos-informe.mjs';

const read = ruta => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const actores = read('../public/data/actores.json');
const radarPath = new URL('../privado/actores-radar.json', import.meta.url);
const industrias = ['financiero', 'energia', 'retail', 'industrial', 'telecom', 'salud', 'gremios_publico'];
const subindustrias = ['energia', 'servicios_publicos', 'recursos_naturales'];
const corte = '2026-10-06';
const falta = 'No explícito en el informe';
const porId = new Map(actores.map(actor => [actor.id, actor]));

function textos(valor) {
  if (typeof valor === 'string') return [valor];
  if (!valor || typeof valor !== 'object') return [];
  return Object.values(valor).flatMap(textos);
}

// Fin del periodo: un mes/trimestre que contiene el corte todavía es admisible.
function finPeriodo(fecha) {
  const match = /^(\d{4})-(?:(\d{2})(?:-(\d{2}))?|T([1-4]))$/u.exec(fecha);
  assert(match, 'Formato de fecha inválido: ' + fecha);
  const [, year, month, day, quarter] = match;
  if (quarter) return new Date(Date.UTC(+year, +quarter * 3, 0)).toISOString().slice(0, 10);
  assert(+month >= 1 && +month <= 12, fecha);
  if (!day) return new Date(Date.UTC(+year, +month, 0)).toISOString().slice(0, 10);
  assert(+day >= 1 && +day <= new Date(Date.UTC(+year, +month, 0)).getUTCDate(), fecha);
  return fecha;
}

function fechasExplicitas(texto) {
  const fechas = [...texto.matchAll(/\b\d{4}-(?:\d{2}(?:-\d{2})?|T[1-4])\b/gu)].map(m => m[0]);
  for (const m of texto.matchAll(/\b([1-4])T\s+(\d{4})\b/gu)) fechas.push(`${m[2]}-T${m[1]}`);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const patron = /\b(?:(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s*(?:de\s+)?)?(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|sep|octubre|oct|noviembre|nov|diciembre|dic)\b(?:\s*(?:de\s+|del\s+|-)?(\d{4}))?/giu;
  for (const m of texto.matchAll(patron)) {
    const mes = meses.indexOf(m[3].toLowerCase().slice(0, 3)) + 1;
    // Calendario de la sección 3.3: octubre 2026 a agosto 2027.
    const year = m[4] || (mes >= 10 ? '2026' : '2027');
    const base = `${year}-${String(mes).padStart(2, '0')}`;
    const dia = m[2] || m[1];
    fechas.push(dia ? `${base}-${dia.padStart(2, '0')}` : base);
  }
  return fechas;
}

test('Contenido: exactamente 75 actores con ids únicos y campos obligatorios', () => {
  assert.equal(actores.length, 75);
  assert.equal(porId.size, 75);
  for (const a of actores) {
    assert(['empresa', 'gremio'].includes(a.tipo), a.id);
    for (const key of ['id', 'nombre', 'sector_radar', 'por_que', 'dolor', 'ruta_sugerida']) {
      assert.equal(typeof a[key], 'string', a.id + '.' + key);
      assert(a[key].trim(), a.id + '.' + key);
    }
    assert.equal(a.id.startsWith(a.tipo === 'empresa' ? 'mercados-' : 'aliados-'), true);
    if (a.tipo === 'empresa') {
      assert.equal(a.necesidad_tipo, null);
      assert.equal(a.tema_charla, null);
      assert(Array.isArray(a.gremios_asociados));
    } else {
      assert(['E', 'A'].includes(a.necesidad_tipo), a.id);
      assert.equal(typeof a.tema_charla, 'string');
      assert(a.tema_charla.trim());
    }
    if (a.propuesta_gh) assert(a.tipo === 'gremio' && a.tema_charla !== falta);
  }
  assert.equal(actores.filter(a => a.tipo === 'empresa').length, 55);
  assert.equal(actores.filter(a => a.tipo === 'gremio').length, 20);
});

test('Contenido: mismos ids, nombres y sectores del volcado privado', {
  skip: !existsSync(radarPath) && 'Volcado privado no disponible en esta máquina'
}, () => {
  const radar = JSON.parse(readFileSync(radarPath, 'utf8'));
  assert.deepEqual(actores.map(a => a.id).sort(), radar.map(a => a.id).sort());
  for (const a of radar) {
    assert.equal(porId.get(a.id).nombre, a.nombre);
    assert.equal(porId.get(a.id).sector_radar, a.sector);
    assert.equal(porId.get(a.id).tipo, a.categoria === 'mercados' ? 'empresa' : 'gremio');
  }
});

test('Contenido: siete industrias representadas y subindustria exclusiva de energía', () => {
  assert.deepEqual([...new Set(actores.map(a => a.industria))].sort(), [...industrias].sort());
  for (const a of actores) {
    assert(industrias.includes(a.industria), a.id);
    if (a.industria === 'energia') assert(subindustrias.includes(a.subindustria), a.id);
    else assert.equal(a.subindustria, null, a.id);
  }
  const fijos = {acrip: 'gremios_publico', acopi: 'gremios_publico', cecodes: 'gremios_publico',
    anda: 'retail', asofondos: 'financiero', cci: 'industrial'};
  for (const [id, industria] of Object.entries(fijos)) assert.equal(porId.get('aliados-' + id).industria, industria);
});

test('Contenido: sin nombres excluidos ni claves de contacto, incluso anidadas', () => {
  assert(!/Tello|Barrientos/iu.test(JSON.stringify(actores)));
  function revisar(valor) {
    if (!valor || typeof valor !== 'object') return;
    for (const [key, child] of Object.entries(valor)) {
      assert(!/^(contacto|cargo|telefono|correo)$/iu.test(key), key);
      revisar(child);
    }
  }
  revisar(actores);
});

test('Contenido: eventos con precisión válida, fecha_texto y sin fechas pasadas', () => {
  for (const a of actores) {
    assert(Array.isArray(a.eventos), a.id);
    for (const evento of a.eventos) {
      assert.equal(typeof evento.nombre, 'string');
      assert(evento.nombre.trim());
      assert.equal(typeof evento.fecha_texto, 'string');
      assert(evento.fecha_texto.trim());
      if (evento.fecha !== null) {
        assert.equal(typeof evento.fecha, 'string');
        assert(finPeriodo(evento.fecha) >= corte, a.id + ': ' + evento.fecha);
      }
    }
    for (const texto of textos(a)) {
      for (const fecha of fechasExplicitas(texto)) assert(finPeriodo(fecha) >= corte, a.id + ': ' + texto);
    }
  }
});

test('Contenido: comparación de fechas respeta meses, trimestres e intervalos', () => {
  assert(finPeriodo('2026-09') < corte);
  assert(finPeriodo('2026-10') >= corte);
  assert(finPeriodo('2026-T3') < corte);
  assert(finPeriodo('2026-T4') >= corte);
  for (const texto of ['2026-10-05', '23–25 sep 2026', '2 de octubre de 2026', '3T 2026']) {
    assert(fechasExplicitas(texto).some(fecha => finPeriodo(fecha) < corte), texto);
  }
  assert.throws(() => finPeriodo('2026-02-30'));
  assert.throws(() => finPeriodo('2026-13'));
});

test('Contenido: horizontes, asociaciones y rutas de doble plazo', () => {
  for (const a of actores) {
    assert([null, '30-60', '120', '>180'].includes(a.horizonte_informe), a.id);
    for (const id of a.gremios_asociados || []) assert.equal(porId.get(id)?.tipo, 'gremio', a.id + ': ' + id);
  }
  for (const prefix of ['mercados-davivienda-', 'mercados-constructora-bolivar-']) {
    const a = actores.find(actor => actor.id.startsWith(prefix));
    assert.equal(a.horizonte_informe, '30-60');
    assert.match(a.ruta_sugerida, /30–60 días/);
    assert.match(a.ruta_sugerida, /120 días/);
  }
});

test('Contenido: cuatro textos de contexto en los cinco actores indicados y solo ellos', () => {
  const notas = {
    'mercados-ecopetrol-nacion-88-5': 'Olivia tiene contratos marco activos; validar horizonte',
    'mercados-isa-nacion': 'Olivia tiene contratos marco activos; validar horizonte',
    'mercados-davivienda-group-banco-davivienda-grupo-bolivar': 'Diego indica que la integración se maneja internamente',
    'mercados-banco-popular-grupo-aval': 'Diego lo señala como oportunidad de venta inmediata',
    'aliados-andi': 'Olivia ya es afiliada'
  };
  for (const a of actores) {
    if (notas[a.id]) assert.equal(a.nota_contexto, notas[a.id]);
    else assert(!Object.hasOwn(a, 'nota_contexto'), a.id);
  }
});

const fila = {actor_id: actores[0].id, nombre: 'Persona de prueba', cargo: 'Cargo de prueba', confianza: 'media'};
const config = {supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'clave-de-prueba'};
const log = () => {};

test('Siembra: rechaza actor inexistente, confianza inválida y nombres excluidos', () => {
  assert.equal(validarRegistro(fila, actores), fila);
  assert.throws(() => validar([{...fila, actor_id: 'inexistente'}], actores), /actor_id inexistente/);
  assert.throws(() => validar([{...fila, confianza: 'confirmada'}], actores), /Confianza inválida/);
  for (const nombre of ['Tello', 'BARRIENTOS']) {
    for (const campo of ['nombre', 'cargo']) {
      assert.throws(() => validar([{...fila, [campo]: nombre}], actores), /Nombre excluido/);
    }
  }
});

test('Siembra: rechaza campos vacíos, duplicados, datos extras y registros de 20 KB', () => {
  for (const campo of Object.keys(fila)) {
    const incompleta = {...fila}; delete incompleta[campo];
    assert.throws(() => validar([incompleta], actores), /Campo obligatorio/);
    assert.throws(() => validar([{...fila, [campo]: ' '}], actores), /Campo obligatorio/);
  }
  assert.throws(() => validar([fila, fila], actores), /duplicado/);
  assert.throws(() => validar([{...fila, telefono: '123'}], actores), /no permitido/);
  assert.throws(() => validar([{...fila, nombre: 'á'.repeat(10240)}], actores), /20 KB/);
  assert.throws(() => validar({}, actores), /arreglo/);
  assert.throws(() => validar([null], actores), /inválido/);
});

test('Siembra: simulación por defecto sin configuración ni red', async () => {
  const resultado = await ejecutar({filas: [fila], actores, log,
    fetchImpl: () => {throw new Error('La simulación no puede usar la red');}});
  assert.deepEqual(resultado, {simulacion: true, registros: 1});
  assert.deepEqual(opciones([]), {aplicar: false, borrar: false});
  assert.deepEqual(opciones(['--borrar']), {aplicar: false, borrar: true});
  for (const args of [['--otro'], ['--aplicar', '--borrar'], ['--aplicar', '--aplicar']]) {
    assert.throws(() => opciones(args), /Uso:/);
  }
});

test('Siembra: upsert con clave compuesta y fila completa; validación previa', async () => {
  let llamadas = 0;
  const fetchImpl = async (url, init) => {
    llamadas++;
    assert.equal(url.searchParams.get('on_conflict'), 'coleccion,id');
    assert.equal(init.method, 'POST');
    assert.match(init.headers.Prefer, /resolution=merge-duplicates/);
    assert.deepEqual(JSON.parse(init.body), [{coleccion: 'contactos-informe', id: fila.actor_id, data: fila}]);
    return {ok: true};
  };
  await ejecutar({filas: [fila], actores, config, aplicar: true, log, fetchImpl});
  assert.equal(llamadas, 1);
  await assert.rejects(ejecutar({filas: [{...fila, actor_id: 'no-existe'}], actores,
    config, aplicar: true, log, fetchImpl}), /inexistente/);
  assert.equal(llamadas, 1);
});

test('Siembra: borrado limitado a contactos-informe y verificación de colección vacía', async () => {
  const llamadas = [];
  await ejecutar({borrar: true, config, log, fetchImpl: async (url, init) => {
    llamadas.push(init.method || 'GET');
    assert.equal(url.searchParams.get('coleccion'), 'eq.contactos-informe');
    if (!init.method) assert.equal(url.searchParams.get('limit'), '1');
    return {ok: true, json: async () => []};
  }});
  assert.deepEqual(llamadas, ['DELETE', 'GET']);
  for (const restantes of [[{id: 'restante'}], {}]) {
    await assert.rejects(ejecutar({borrar: true, config, log,
      fetchImpl: async () => ({ok: true, json: async () => restantes})}), /quedara vacía/);
  }
});

test('Siembra: errores HTTP y modos incompatibles se propagan', async () => {
  const errorHTTP = async () => ({ok: false, status: 403});
  await assert.rejects(ejecutar({filas: [fila], actores, config, aplicar: true, log,
    fetchImpl: errorHTTP}), /Upsert rechazado: HTTP 403/);
  await assert.rejects(ejecutar({borrar: true, config, log, fetchImpl: errorHTTP}), /Borrado rechazado/);
  await assert.rejects(ejecutar({borrar: true, config, log,
    fetchImpl: async (_, init) => init.method === 'DELETE' ? {ok: true} : {ok: false, status: 503}}), /verificar el borrado/);
  await assert.rejects(ejecutar({aplicar: true, borrar: true}), /Elige/);
});

const contactosPath = new URL('../privado/contactos-informe.json', import.meta.url);
test('Siembra: archivo privado válido cuando está disponible', {
  skip: !existsSync(contactosPath) && 'Contactos privados no disponibles'
}, () => validar(JSON.parse(readFileSync(contactosPath, 'utf8')), actores));
