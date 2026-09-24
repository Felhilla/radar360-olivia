import { getStore } from "@netlify/blobs";

// Gremios agregados en vivo durante el taller (los 19 del informe §3.2 viven fijos en index.html).
// Un blob por gremio; al eliminar uno se borran también sus votos del store "gremios-votos".
const LIMITE = 100;
const PREFIJO = "gremio-taller-";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
function slug(s) {
  return String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "gremio";
}
function texto(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
async function listar(store) {
  const { blobs } = await store.list();
  const gremios = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return gremios.filter(Boolean);
}

export default async (req) => {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return json({ error: "Método no permitido." }, 405);
  try {
    const store = getStore({ name: "gremios-taller", consistency: "strong" });
    if (req.method === "GET") return json(await listar(store));

    let body;
    try { body = await req.json(); } catch { return json({ error: "El cuerpo debe ser JSON válido." }, 400); }

    if (req.method === "DELETE") {
      if (typeof body.id !== "string" || !body.id.startsWith(PREFIJO)) return json({ error: "Gremio no válido." }, 400);
      await store.delete(body.id);
      const votos = getStore({ name: "gremios-votos", consistency: "strong" });
      const { blobs } = await votos.list({ prefix: body.id + "--" });
      await Promise.all(blobs.map((b) => votos.delete(b.key)));
      return json({ ok: true, votosEliminados: blobs.length });
    }

    const nombre = texto(body.nombre, 80);
    if (!nombre) return json({ error: "Escribe el nombre del gremio." }, 400);
    const existentes = await listar(store);
    if (existentes.length >= LIMITE) return json({ error: "Se alcanzó el límite de 100 gremios agregados." }, 429);
    if (existentes.some((g) => slug(g.nombre) === slug(nombre))) return json({ error: "Ese gremio ya fue agregado." }, 409);
    const gremio = {
      id: PREFIJO + slug(nombre) + "-" + Math.random().toString(36).slice(2, 6),
      nombre,
      contacto: texto(body.contacto, 600),
      cuentas: texto(body.cuentas, 600),
      oferta: texto(body.oferta, 600),
      autor: texto(body.autor, 60),
      origenTaller: true,
      createdAt: new Date().toISOString()
    };
    await store.setJSON(gremio.id, gremio);
    return json(gremio, 201);
  } catch (error) {
    return json({ error: "No se pudo acceder a los gremios agregados. Inténtalo de nuevo." }, 500);
  }
};
