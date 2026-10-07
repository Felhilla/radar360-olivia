#!/usr/bin/env node
// Sin red por defecto. --aplicar siembra; --borrar elimina solo esta colección.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const COLECCION = 'contactos-informe';
const CAMPOS = ['actor_id', 'nombre', 'cargo', 'confianza'];
const CONFIANZAS = new Set(['alta', 'media', 'baja', 'por identificar']);

export function validarRegistro(fila, actores) {
  if (!Array.isArray(actores)) throw new Error('Actores debe ser un arreglo.');
  if (!fila || typeof fila !== 'object' || Array.isArray(fila)) {
    throw new Error('Contacto inválido.');
  }
  for (const campo of CAMPOS) {
    if (typeof fila[campo] !== 'string' || !fila[campo].trim()) {
      throw new Error('Campo obligatorio: ' + campo);
    }
  }
  if (Object.keys(fila).some(campo => !CAMPOS.includes(campo))) {
    throw new Error('Campo de contacto no permitido.');
  }
  if (!actores.some(actor => actor.id === fila.actor_id)) {
    throw new Error('actor_id inexistente: ' + fila.actor_id);
  }
  if (!CONFIANZAS.has(fila.confianza)) throw new Error('Confianza inválida.');
  if (/Tello|Barrientos/iu.test(JSON.stringify(fila))) {
    throw new Error('Nombre excluido de los contactos de entrada.');
  }
  const registro = {coleccion: COLECCION, id: fila.actor_id, data: fila};
  if (Buffer.byteLength(JSON.stringify(registro), 'utf8') >= 20 * 1024) {
    throw new Error('Cada registro debe ocupar menos de 20 KB.');
  }
  return fila;
}

export function validar(filas, actores) {
  if (!Array.isArray(filas)) throw new Error('Contactos debe ser un arreglo.');
  if (!Array.isArray(actores)) throw new Error('Actores debe ser un arreglo.');
  const vistos = new Set();
  for (const fila of filas) {
    validarRegistro(fila, actores);
    const clave = fila.actor_id + '|' + fila.nombre;
    if (vistos.has(clave)) throw new Error('Contacto duplicado.');
    vistos.add(clave);
  }
  return filas;
}

// Un actor puede tener varios contactos (p. ej. ACM): el primero conserva el id del actor
// y los siguientes llevan sufijo --2, --3…
export function idsRegistros(filas) {
  const cuenta = new Map();
  return filas.map(fila => {
    const n = (cuenta.get(fila.actor_id) || 0) + 1;
    cuenta.set(fila.actor_id, n);
    return n === 1 ? fila.actor_id : fila.actor_id + '--' + n;
  });
}

export function opciones(args) {
  if (!Array.isArray(args) || args.length > 1 ||
      args.some(arg => !['--aplicar', '--borrar'].includes(arg))) {
    throw new Error(
      'Uso: node supabase/sembrar-contactos-informe.mjs [--aplicar | --borrar]'
    );
  }
  return {aplicar: args.includes('--aplicar'), borrar: args.includes('--borrar')};
}

export async function ejecutar({
  filas, actores, config, aplicar = false, borrar = false,
  fetchImpl = globalThis.fetch, log = console.log
}) {
  if (aplicar && borrar) throw new Error('Elige --aplicar o --borrar.');
  if (!borrar) validar(filas, actores);
  if (!aplicar && !borrar) {
    log(`SIMULACIÓN — escribiría ${filas.length} registros en ${COLECCION}.`);
    log('Sin solicitudes de red ni escrituras.');
    return {simulacion: true, registros: filas.length};
  }
  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    throw new Error('Configuración Supabase incompleta.');
  }
  const endpoint = new URL('/rest/v1/registros', config.supabaseUrl);
  if (endpoint.protocol !== 'https:') throw new Error('La URL debe usar HTTPS.');
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: 'Bearer ' + config.supabaseAnonKey,
    'Content-Type': 'application/json'
  };
  if (borrar) {
    endpoint.searchParams.set('coleccion', 'eq.' + COLECCION);
    const response = await fetchImpl(endpoint, {method: 'DELETE', headers});
    if (!response.ok) throw new Error('Borrado rechazado: HTTP ' + response.status);
    const consulta = new URL(endpoint);
    consulta.searchParams.set('select', 'id');
    consulta.searchParams.set('limit', '1');
    const comprobacion = await fetchImpl(consulta, {headers, cache: 'no-store'});
    if (!comprobacion.ok) {
      throw new Error('No se pudo verificar el borrado: HTTP ' + comprobacion.status);
    }
    const restantes = await comprobacion.json();
    if (!Array.isArray(restantes) || restantes.length) {
      throw new Error('No se confirmó que contactos-informe quedara vacía.');
    }
    log('Borrado verificado: contactos-informe está vacía.');
    return {borrado: true};
  }
  if (filas.length) {
    endpoint.searchParams.set('on_conflict', 'coleccion,id');
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {...headers, Prefer: 'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify((ids => filas.map((fila, i) => ({
        coleccion: COLECCION, id: ids[i], data: fila
      })))(idsRegistros(filas)))
    });
    if (!response.ok) throw new Error('Upsert rechazado: HTTP ' + response.status);
  }
  log(`Aplicados: ${filas.length} registros en ${COLECCION}.`);
  return {aplicados: filas.length};
}

async function main() {
  const flags = opciones(process.argv.slice(2));
  let filas, actores, config;
  // El borrado funciona también si el archivo privado ya no está disponible.
  if (!flags.borrar) {
    [filas, actores] = await Promise.all([
      '../privado/contactos-informe.json', '../public/data/actores.json'
    ].map(async ruta => JSON.parse(await readFile(new URL(ruta, import.meta.url), 'utf8'))));
    validar(filas, actores);
  }
  if (flags.aplicar || flags.borrar) {
    const scope = {window: {}};
    vm.runInNewContext(
      await readFile(new URL('../public/config.js', import.meta.url), 'utf8'),
      scope, {timeout: 1000}
    );
    config = scope.window.RADAR_CONFIG;
  }
  await ejecutar({filas, actores, config, ...flags});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
