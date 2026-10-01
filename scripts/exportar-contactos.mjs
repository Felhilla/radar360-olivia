#!/usr/bin/env node
// Exporta a CSV los contactos registrados en el taller (colección «contactos») a privado/exportaciones/,
// carpeta que no se sube al repositorio. Con --borrar, después de exportar y verificar que el CSV tiene
// el mismo número de filas que la colección, borra la colección y comprueba que quedó vacía.
//   node scripts/exportar-contactos.mjs            → solo exporta
//   node scripts/exportar-contactos.mjs --borrar   → exporta, verifica y borra
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import Embudo from '../public/embudo.js';

const COLECCION = 'contactos';
const CABECERA = ['actor', 'nombre', 'cargo', 'telefono', 'correo', 'registrado_por', 'fecha'];

export function opciones(args) {
  if (!Array.isArray(args) || args.length > 1 || args.some(a => a !== '--borrar')) {
    throw new Error('Uso: node scripts/exportar-contactos.mjs [--borrar]');
  }
  return {borrar: args.includes('--borrar')};
}

// Cuenta registros de un CSV respetando comillas (un campo puede tener saltos de línea).
export function contarRegistros(csv) {
  const texto = csv.replace(/^﻿/, '');
  if (!texto.trim()) return 0;
  let registros = 1, comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') comillas = !comillas;
    else if (!comillas && c === '\r' && texto[i + 1] === '\n') { registros++; i++; }
  }
  return registros;
}

export function filasCsv(contactos, actores) {
  const nombres = new Map((actores || []).map(a => [a.id, a.nombre]));
  const orden = contactos.slice().sort((a, b) =>
    String(nombres.get(a.actorId) || a.actorId).localeCompare(String(nombres.get(b.actorId) || b.actorId), 'es') ||
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return [CABECERA, ...orden.map(c => [
    nombres.get(c.actorId) || c.actorId, c.nombre, c.cargo, c.telefono || '', c.correo || '', c.registradoPor || '', c.createdAt || ''
  ])];
}

function cliente(config, fetchImpl) {
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) throw new Error('Configuración Supabase incompleta.');
  const base = new URL('/rest/v1/registros', config.supabaseUrl);
  if (base.protocol !== 'https:') throw new Error('La URL debe usar HTTPS.');
  const headers = {apikey: config.supabaseAnonKey, Authorization: 'Bearer ' + config.supabaseAnonKey};
  const url = params => { const u = new URL(base); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u; };
  return {
    async listar() {
      const out = [];
      for (let desde = 0; ; desde += 1000) {
        const r = await fetchImpl(url({coleccion: 'eq.' + COLECCION, select: 'id,data', order: 'id'}), {headers: {...headers, Range: desde + '-' + (desde + 999)}, cache: 'no-store'});
        if (!r.ok) throw new Error('Lectura rechazada: HTTP ' + r.status);
        const filas = await r.json();
        out.push(...filas.map(f => f.data));
        if (filas.length < 1000) return out;
      }
    },
    async borrar() {
      const r = await fetchImpl(url({coleccion: 'eq.' + COLECCION}), {method: 'DELETE', headers});
      if (!r.ok) throw new Error('Borrado rechazado: HTTP ' + r.status);
    }
  };
}

export async function ejecutar({config, actores, borrar = false, dir, ahora = new Date(), fetchImpl = globalThis.fetch, log = console.log}) {
  const api = cliente(config, fetchImpl);
  const contactos = await api.listar();
  const csv = Embudo.csv(filasCsv(contactos, actores));
  await mkdir(dir, {recursive: true});
  const sello = ahora.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const archivo = join(dir, 'contactos-taller-' + sello + '.csv');
  await writeFile(archivo, csv, 'utf8');
  const enArchivo = contarRegistros(await readFile(archivo, 'utf8')) - 1;
  if (enArchivo !== contactos.length) throw new Error(`El CSV tiene ${enArchivo} filas y la colección ${contactos.length}. No se borra nada.`);
  log(`Exportados ${contactos.length} contactos a ${archivo}`);
  if (!borrar) return {archivo, filas: contactos.length, borrado: false};
  // Revisa que nadie haya agregado contactos entre la exportación y el borrado.
  const antes = await api.listar();
  if (antes.length !== contactos.length) throw new Error('La colección cambió durante la exportación. Vuelve a ejecutar el script.');
  await api.borrar();
  const restantes = await api.listar();
  if (restantes.length) throw new Error('No se confirmó que «contactos» quedara vacía.');
  log('Borrado verificado: la colección «contactos» está vacía.');
  return {archivo, filas: contactos.length, borrado: true};
}

async function main() {
  const flags = opciones(process.argv.slice(2));
  const scope = {window: {}};
  vm.runInNewContext(await readFile(new URL('../public/config.js', import.meta.url), 'utf8'), scope, {timeout: 1000});
  const actores = JSON.parse(await readFile(new URL('../public/data/actores.json', import.meta.url), 'utf8'));
  const dir = fileURLToPath(new URL('../privado/exportaciones/', import.meta.url));
  await ejecutar({config: scope.window.RADAR_CONFIG, actores, dir, ...flags});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
