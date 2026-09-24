"""Carga en Supabase (tabla public.registros) los datos exportados de Netlify Blobs.

Uso:  python3 supabase/migrar_desde_netlify.py <carpeta_export> <SUPABASE_URL> <ANON_KEY>
La carpeta de exportación es la que contiene actors.json, ideas.json, etc. (GET de cada /api/*).
Es idempotente: vuelve a escribir los mismos ids (upsert).
"""
import json, re, sys, unicodedata, urllib.request
from pathlib import Path


def slug_votante(nombre):
    s = unicodedata.normalize("NFD", nombre.strip().lower())
    s = re.sub(r"[̀-ͯ]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "u-" + "-".join(format(ord(c), "x") for c in nombre.strip().lower())


def registros(carpeta):
    leer = lambda n: json.loads((carpeta / f"{n}.json").read_text())
    for a in leer("actors"):
        yield "actors", a["id"], a
    for f in leer("matriz"):
        yield "matriz", f["id"], f
    for s in leer("ideas").get("stickers", []):
        yield "ideas", s["id"], s
    for h, rec in leer("ideas-sintesis").items():
        if rec.get("updatedAt") or rec.get("texto"):
            yield "ideas-sintesis", h, rec
    for v in leer("gremios-votos"):
        yield "gremios-votos", v["gremioId"] + "--" + slug_votante(v["votante"]), v
    for g in leer("gremios-taller"):
        yield "gremios-taller", g["id"], g
    for v in leer("priorizacion-votos"):
        yield "priorizacion-votos", v["actorId"] + "--" + slug_votante(v["votante"]), v


def main():
    carpeta, url, key = Path(sys.argv[1]), sys.argv[2].rstrip("/"), sys.argv[3]
    filas = [{"coleccion": c, "id": i, "data": d} for c, i, d in registros(carpeta)]
    for k in range(0, len(filas), 200):
        req = urllib.request.Request(
            url + "/rest/v1/registros?on_conflict=coleccion,id",
            data=json.dumps(filas[k:k + 200]).encode(),
            method="POST",
            headers={"apikey": key, "Authorization": "Bearer " + key, "content-type": "application/json",
                     "Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        urllib.request.urlopen(req, timeout=60)
    conteo = {}
    for f in filas:
        conteo[f["coleccion"]] = conteo.get(f["coleccion"], 0) + 1
    print("migrados:", conteo)


if __name__ == "__main__":
    main()
