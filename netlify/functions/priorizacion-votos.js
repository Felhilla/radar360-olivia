import { getStore } from '@netlify/blobs';
import criterios from './priorizacion-criterios.json' with { type: 'json' };
const LIMITE = 20000;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
export function slug(nombre) {
  return nombre.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'u-' + Array.from(nombre.trim().toLowerCase()).map(c => c.codePointAt(0).toString(16)).join('-');
}
async function listar(store) {
  const blobs = [];
  for await (const pagina of store.list({ paginate: true })) {
    blobs.push(...pagina.blobs);
    if (blobs.length > LIMITE) throw new Error('limite');
  }
  return blobs;
}
async function leerVotos(store) {
  const blobs = await listar(store), votos = [];
  for (let i = 0; i < blobs.length; i += 100) {
    votos.push(...await Promise.all(blobs.slice(i, i + 100).map(b => store.get(b.key, { type: 'json' }))));
  }
  return votos.filter(Boolean);
}
function ejeValido(valores, eje) {
  return valores && typeof valores === 'object' && !Array.isArray(valores) &&
    Object.keys(valores).length === criterios[eje].length &&
    criterios[eje].every(c => Number.isInteger(valores[c.id]) && valores[c.id] >= 1 && valores[c.id] <= 5);
}
export function indice(valores, eje) {
  return criterios[eje].reduce((s, c) => s + valores[c.id] * c.peso, 0) / 100;
}
export function cuadrante(impacto, esfuerzo) {
  return criterios.cuadrantes.find(c => c.impacto === (impacto >= criterios.umbral ? 'alto' : 'bajo') && c.esfuerzo === (esfuerzo >= criterios.umbral ? 'alto' : 'bajo'));
}
export async function resumir(votos, actores) {
  const grupos = new Map();
  for (const v of votos) {
    if (v.borrador || !ejeValido(v.impacto, 'impacto') || !ejeValido(v.esfuerzo, 'esfuerzo')) continue;
    if (!grupos.has(v.actorId)) grupos.set(v.actorId, []);
    grupos.get(v.actorId).push(v);
  }
  const resultado = [], ids = [...grupos.keys()];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const lote = ids.slice(offset, offset + 100);
    const datos = await Promise.all(lote.map(id => actores.get(id, { type: 'json' })));
    datos.forEach((actor, i) => {
      if (!actor || actor.estado === 'descartado') return;
      const actorId = lote[i], votosActor = grupos.get(actorId);
      // Sumar centésimas enteras evita que un promedio exactamente 3 quede por debajo por coma flotante.
      const promedio = eje => votosActor.reduce((s, v) => s + criterios[eje].reduce((n, c) => n + v[eje][c.id] * c.peso, 0), 0) / (100 * votosActor.length);
      const impacto = promedio('impacto'), esfuerzo = promedio('esfuerzo'), q = cuadrante(impacto, esfuerzo);
      resultado.push({ actorId, nombre: actor.nombre, categoria: actor.categoria, sector: actor.sector || '',
        indiceImpacto: Number(impacto.toFixed(2)), indiceEsfuerzo: Number(esfuerzo.toFixed(2)),
        cuadrante: { id: q.id, nombre: q.nombre }, votos: votosActor.length });
    });
  }
  return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
export default async (req) => {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) return json({ error: 'Método no permitido.' }, 405);
  try {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('criterios') === '1') return json(criterios);
    const store = getStore({ name: 'priorizacion-votos', consistency: 'strong' });
    const actores = getStore({ name: 'radar360', consistency: 'strong' });
    if (req.method === 'GET') {
      const votos = await leerVotos(store);
      return json(url.searchParams.get('resumen') === '1' ? await resumir(votos, actores) : votos);
    }
    let body;
    try { body = await req.json(); } catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
    if (!body || typeof body.actorId !== 'string' || !body.actorId.trim() || body.actorId.length > 300 || /[\x00-\x1f/\\]/.test(body.actorId)) return json({ error: 'Actor no válido.' }, 400);
    if (typeof body.votante !== 'string' || !body.votante.trim() || body.votante.length > 60) return json({ error: 'Escribe un nombre de máximo 60 caracteres.' }, 400);
    const votante = body.votante.trim(), key = body.actorId + '--' + slug(votante);
    // Permitir retirar el voto incluso si el actor fue descartado o eliminado después.
    if (req.method === 'DELETE') { await store.delete(key); return json({ ok: true }); }
    const actor = await actores.get(body.actorId, { type: 'json' });
    if (!actor || actor.estado === 'descartado') return json({ error: 'El actor no existe o está descartado.' }, 400);
    if (body.borrador || !ejeValido(body.impacto, 'impacto') || !ejeValido(body.esfuerzo, 'esfuerzo')) return json({ error: 'Completa los diez criterios con enteros de 1 a 5. No se guardan borradores.' }, 400);
    const existing = await store.get(key, { type: 'json' });
    if (!existing && (await listar(store)).length >= LIMITE) return json({ error: 'Se alcanzó el límite de 20000 votos.' }, 429);
    const voto = { actorId: body.actorId, votante, impacto: body.impacto, esfuerzo: body.esfuerzo, updatedAt: new Date().toISOString() };
    await store.setJSON(key, voto);
    return json(voto);
  } catch (error) {
    return error.message === 'limite' ? json({ error: 'Se superó el límite de 20000 votos.' }, 429) : json({ error: 'No se pudo acceder a las calificaciones. Inténtalo de nuevo.' }, 500);
  }
};
