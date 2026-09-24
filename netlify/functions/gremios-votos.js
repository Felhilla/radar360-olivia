import { getStore } from "@netlify/blobs";

const GREMIOS_IDS = new Set([
  "aliados-andesco",
  "aliados-asobancaria",
  "aliados-fenalco",
  "aliados-camacol",
  "aliados-colombia-fintech",
  "aliados-acodres",
  "aliados-andi",
  "aliados-acrip",
  "aliados-acp",
  "aliados-cci",
  "aliados-naturgas",
  "aliados-acolgen",
  "aliados-andeg",
  "aliados-ser-colombia",
  "aliados-acoplasticos",
  "aliados-ccce-camara-colombiana-de-comercio-electronico",
  "aliados-cecodes",
  "aliados-asofondos",
  "aliados-anda"
]);
const LIMITE = 5000;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
function slug(nombre) {
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
export default async (req) => {
  if (!['GET', 'PUT', 'POST', 'DELETE'].includes(req.method)) return json({ error: 'Método no permitido.' }, 405);
  try {
    const store = getStore({ name: 'gremios-votos', consistency: 'strong' });
    if (req.method === 'GET') {
      const blobs = await listar(store);
      const votos = [];
      // Lecturas por grupos para limitar la concurrencia.
      for (let i = 0; i < blobs.length; i += 100) {
        votos.push(...await Promise.all(blobs.slice(i, i + 100).map(b => store.get(b.key, { type: 'json' }))));
      }
      return json(votos.filter(Boolean));
    }
    let body;
    try { body = await req.json(); } catch { return json({ error: 'El cuerpo debe ser JSON válido.' }, 400); }
    if (!body || typeof body.gremioId !== 'string') return json({ error: 'Gremio no válido.' }, 400);
    if (!GREMIOS_IDS.has(body.gremioId)) {
      // Gremios agregados en vivo en el taller: deben existir en el store "gremios-taller".
      const agregado = body.gremioId.startsWith('gremio-taller-')
        ? await getStore({ name: 'gremios-taller', consistency: 'strong' }).get(body.gremioId, { type: 'json' })
        : null;
      if (!agregado) return json({ error: 'Gremio no válido.' }, 400);
    }
    if (typeof body.votante !== 'string' || !body.votante.trim() || body.votante.length > 60) return json({ error: 'Escribe un nombre de máximo 60 caracteres.' }, 400);
    const votante = body.votante.trim();
    const key = body.gremioId + '--' + slug(votante);
    if (req.method === 'DELETE') {
      await store.delete(key);
      return json({ ok: true });
    }
    if (![1, 2, 3].includes(body.valor)) return json({ error: 'El valor debe ser 1, 2 o 3.' }, 400);
    const existing = await store.get(key, { type: 'json' });
    if (!existing && (await listar(store)).length >= LIMITE) return json({ error: 'Se alcanzó el límite de 5000 votos.' }, 429);
    const voto = { gremioId: body.gremioId, votante, valor: body.valor, updatedAt: new Date().toISOString() };
    await store.setJSON(key, voto);
    return json(voto);
  } catch (error) {
    return error.message === 'limite' ? json({ error: 'Se superó el límite de 5000 votos.' }, 429) : json({ error: 'No se pudo acceder a los votos. Inténtalo de nuevo.' }, 500);
  }
};
