import { getStore } from "@netlify/blobs";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: JSON_HEADERS });
}

async function loadRows(store) {
  const { blobs } = await store.list();
  const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return rows.filter(Boolean);
}

const REQUIRED_FIELDS = ["cliente", "necesidadCritica"];

export default async (req) => {
  const store = getStore({ name: "matriz", consistency: "strong" });

  if (req.method === "GET") {
    const rows = await loadRows(store);
    return json(rows);
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json" }, 400);
    }
    for (const f of REQUIRED_FIELDS) {
      if (!body[f] || typeof body[f] !== "string" || !body[f].trim()) {
        return json({ error: "missing_field", field: f }, 400);
      }
    }
    const { blobs } = await store.list();
    if (blobs.length >= 500) {
      return json({ error: "too_many_rows" }, 429);
    }
    const now = new Date().toISOString();
    const newRow = {
      id: "fila-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      cliente: body.cliente.trim(),
      necesidadCritica: body.necesidadCritica.trim(),
      respuestaOlivia: (body.respuestaOlivia || "").trim(),
      trigger: body.trigger === true,
      createdAt: now,
      updatedAt: now,
    };
    // each row is its own blob key, so concurrent adds from different
    // participants never collide on a shared read-modify-write cycle
    await store.setJSON(newRow.id, newRow);
    return json(newRow, 201);
  }

  if (req.method === "PATCH") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json" }, 400);
    }
    if (!body.id || typeof body.id !== "string") {
      return json({ error: "missing_id" }, 400);
    }
    const existing = await store.get(body.id, { type: "json" });
    if (!existing) {
      return json({ error: "not_found" }, 404);
    }
    const patch = Object.assign({}, body.patch || {});
    delete patch.id;
    delete patch.createdAt;
    const updated = Object.assign({}, existing, patch, { updatedAt: new Date().toISOString() });
    await store.setJSON(body.id, updated);
    return json(updated);
  }

  if (req.method === "DELETE") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ error: "invalid_json" }, 400);
    }
    if (!body.id || typeof body.id !== "string") {
      return json({ error: "missing_id" }, 400);
    }
    const existing = await store.get(body.id, { type: "json" });
    if (!existing) {
      return json({ error: "not_found" }, 404);
    }
    await store.delete(body.id);
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};
