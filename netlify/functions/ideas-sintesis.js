// OBSOLETO: síntesis manual de Actividad 1, reemplazada por nubes locales. Se conserva el almacén histórico.
import { getStore } from "@netlify/blobs";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const HORIZONS = ["corto", "medio", "largo"];
const MAX_LEN = 2000;

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: JSON_HEADERS });
}

export default async (req) => {
  const store = getStore({ name: "ideas-sintesis", consistency: "strong" });

  if (req.method === "GET") {
    const out = {};
    for (const h of HORIZONS) {
      out[h] = (await store.get(h, { type: "json" })) || { texto: "", updatedAt: null };
    }
    return json(out);
  }

  if (req.method === "PUT" || req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json" }, 400);
    }
    if (!HORIZONS.includes(body.horizonte)) return json({ error: "invalid_horizonte" }, 400);
    const texto = typeof body.texto === "string" ? body.texto.trim() : "";
    if (texto.length > MAX_LEN) return json({ error: "texto_too_long" }, 400);
    const record = { texto: texto, updatedAt: new Date().toISOString() };
    await store.setJSON(body.horizonte, record);
    return json(record);
  }

  return json({ error: "method_not_allowed" }, 405);
};
