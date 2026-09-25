import { getStore } from "@netlify/blobs";

import Ideas from "../../public/ideas.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const HORIZONS = ["corto", "medio", "largo"];
const MAX_PER_HORIZON = 200;
const MAX_LEN = 200;

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: JSON_HEADERS });
}

async function loadStickers(store) {
  const { blobs } = await store.list();
  const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return rows.filter(Boolean);
}

export default async (req) => {
  const store = getStore({ name: "ideas", consistency: "strong" });

  if (req.method === "GET") {
    const stickers = await loadStickers(store);
    return json({ stickers });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json" }, 400);
    }
    const horizonte = body.horizonte;
    const texto = typeof body.texto === "string" ? body.texto.trim() : "";
    if (!HORIZONS.includes(horizonte)) return json({ error: "invalid_horizonte" }, 400);
    if (!Ideas.preguntaValida(horizonte, body.preguntaId)) return json({ error: "invalid_preguntaId" }, 400);
    if (!texto) return json({ error: "missing_field", field: "texto" }, 400);
    if (texto.length > MAX_LEN) return json({ error: "texto_too_long" }, 400);

    const existing = await loadStickers(store);
    if (existing.filter((s) => s.horizonte === horizonte).length >= MAX_PER_HORIZON) {
      return json({ error: "too_many_rows" }, 429);
    }

    const now = new Date().toISOString();
    const sticker = {
      id: "idea-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      horizonte: horizonte,
      preguntaId: body.preguntaId,
      texto: texto,
      createdAt: now,
    };
    // each sticker is its own blob key, so concurrent adds from different
    // participants never collide on a shared read-modify-write cycle
    await store.setJSON(sticker.id, sticker);
    return json({ sticker: sticker }, 201);
  }

  if (req.method === "DELETE") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json" }, 400);
    }
    if (!body.id || typeof body.id !== "string") return json({ error: "missing_id" }, 400);
    const existing = await store.get(body.id, { type: "json" });
    if (!existing) return json({ error: "not_found" }, 404);
    await store.delete(body.id);
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};
