// Ajuste S: exportación a CSV y borrado de los contactos registrados en el taller.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {ejecutar, contarRegistros, filasCsv, opciones} from '../scripts/exportar-contactos.mjs';

const config = {supabaseUrl: 'https://supabase.invalid', supabaseAnonKey: 'mock'};
const actores = [{id: 'a1', nombre: 'Bancolombia'}, {id: 'a2', nombre: 'ANDI'}];
function base(datos) {
  const db = new Map(datos.map(d => [d.id, d])), llamadas = [];
  const fetchImpl = async (url, init = {}) => {
    llamadas.push([String(url), init.method || 'GET']);
    assert.equal(url.searchParams.get('coleccion'), 'eq.contactos');
    if (init.method === 'DELETE') { db.clear(); return new Response(null, {status: 204}); }
    const [a, b] = init.headers.Range.split('-').map(Number);
    return Response.json([...db.values()].slice(a, b + 1).map(data => ({id: data.id, data})));
  };
  return {db, llamadas, fetchImpl};
}
const contacto = (id, actorId, extra = {}) => ({id, actorId, nombre: 'Ana ' + id, cargo: 'VP', telefono: '', correo: 'a@x.co', registradoPor: 'Diego Espejo', createdAt: '2026-10-06T10:00:00Z', ...extra});

test('Exporta sin borrar: CSV con cabecera, nombre del actor, fórmulas protegidas y saltos de línea', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contactos-'));
  try {
    const s = base([contacto('1', 'a2'), contacto('2', 'a1', {nombre: '=HYPERLINK("x")', cargo: 'Línea 1\r\nLínea 2'})]);
    const r = await ejecutar({config, actores, dir, fetchImpl: s.fetchImpl, log: () => {}, ahora: new Date('2026-10-06T22:30:00Z')});
    assert.equal(r.filas, 2); assert.equal(r.borrado, false); assert.equal(s.db.size, 2);
    assert.match(r.archivo, /contactos-taller-20261006-223000\.csv$/);
    const csv = await readFile(r.archivo, 'utf8');
    assert.equal(contarRegistros(csv), 3);
    assert.match(csv, /^﻿"actor";"nombre";"cargo"/);
    assert.match(csv, /"ANDI";"Ana 1"/); assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
    assert(csv.indexOf('Bancolombia') > csv.indexOf('ANDI'));
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('Con --borrar: exporta, verifica el número de filas, borra y comprueba que la colección quedó vacía', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contactos-'));
  try {
    const s = base([contacto('1', 'a1'), contacto('2', 'a2')]);
    const r = await ejecutar({config, actores, dir, borrar: true, fetchImpl: s.fetchImpl, log: () => {}});
    assert.equal(r.borrado, true); assert.equal(s.db.size, 0);
    assert.equal(s.llamadas.filter(([, m]) => m === 'DELETE').length, 1);
    assert.equal(contarRegistros(await readFile(r.archivo, 'utf8')), 3);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('No borra si la colección cambia entre exportar y borrar, ni si el borrado no deja la colección vacía', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contactos-'));
  try {
    const s = base([contacto('1', 'a1')]);
    let lecturas = 0;
    const cambia = async (url, init = {}) => { if ((init.method || 'GET') === 'GET' && ++lecturas === 2) s.db.set('2', contacto('2', 'a2')); return s.fetchImpl(url, init); };
    await assert.rejects(ejecutar({config, actores, dir, borrar: true, fetchImpl: cambia, log: () => {}}), /cambió/);
    assert.equal(s.db.size, 2);
    const terco = base([contacto('1', 'a1')]);
    const noBorra = async (url, init = {}) => init.method === 'DELETE' ? new Response(null, {status: 204}) : terco.fetchImpl(url, init);
    await assert.rejects(ejecutar({config, actores, dir, borrar: true, fetchImpl: noBorra, log: () => {}}), /vacía/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test('Pagina más de 1000 contactos, colección vacía y opciones', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contactos-'));
  try {
    const muchos = Array.from({length: 1203}, (_, i) => contacto(String(i).padStart(4, '0'), 'a1'));
    assert.equal((await ejecutar({config, actores, dir, fetchImpl: base(muchos).fetchImpl, log: () => {}})).filas, 1203);
    assert.equal((await ejecutar({config, actores, dir, fetchImpl: base([]).fetchImpl, log: () => {}, ahora: new Date(0)})).filas, 0);
  } finally { await rm(dir, {recursive: true, force: true}); }
  assert.deepEqual(opciones([]), {borrar: false}); assert.deepEqual(opciones(['--borrar']), {borrar: true});
  assert.throws(() => opciones(['--aplicar'])); assert.throws(() => opciones(['--borrar', '--borrar']));
  await assert.rejects(ejecutar({config: {}, actores, dir: 'x', log: () => {}}), /incompleta/);
  assert.deepEqual(filasCsv([], actores), [['actor', 'nombre', 'cargo', 'telefono', 'correo', 'registrado_por', 'fecha']]);
});

test('La carpeta de exportaciones no se sube al repositorio', () => {
  const r = execFileSync('git', ['check-ignore', 'privado/exportaciones/contactos-taller-x.csv'], {encoding: 'utf8', cwd: new URL('..', import.meta.url)});
  assert.match(r, /privado\/exportaciones/);
});
