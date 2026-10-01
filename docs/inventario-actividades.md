# Inventario de actividades · Fase 0 del reenfoque

**Fecha:** 1 de octubre de 2026 · **Rama:** `reenfoque-diego` (sale de `main` en `873f011`)
**Fuente:** código de `public/` y datos leídos de Supabase (solo lectura) el 1 de octubre.

## Línea base de pruebas

- `node --test tests/actividad1.test.mjs tests/canvas.test.mjs tests/embudo.test.mjs tests/landing.test.mjs tests/radar09.test.mjs tests/transversales.test.mjs` → **39 de 39 pasan**.
- `tests/priorizacion-votos.test.mjs` → 6 fallan (función vieja de Netlify, `vm.SyntheticModule`). No afecta al sitio.
- No hay script `npm test`; `package.json` solo declara `@netlify/blobs`.
- Los `tests/*.browser.mjs` son recorridos de navegador, no pruebas de `node --test`.

## Mapa por actividad

Nombres según Felipe (1 de octubre). Las vistas y la navegación salen de `public/landing-config.json` (`actividades[].vista`).

| Actividad | Vista (`id`) | HTML | JS | Rutas `/api` → colección | Config | Pruebas |
|---|---|---|---|---|---|---|
| 1 · Alinear el juego | `view-ideas` | `index.html` 1148–1230 | `index.html` ~2836–2966 (`fetchIdeas`, `addIdea`, `renderIdeas`, `renderResultadosIdeas`); `public/ideas.js` (nube) | `ideas` | preguntas en `index.html` | `actividad1.test.mjs` |
| 2 · Radar 360 | `view-radar` (subvistas Mapa, Competidores, Gestión) | `index.html` 919–1014 | `index.html` ~1300–2330 (`fetchActors`, `renderRadar`, `openActorDialog` 2095, `openSectorDialog` 2074); contenido `RADAR09` 1969–2072 | `actors` | `SECTOR_ORDER`, `SECTOR_FICHAS`, `LOGO_MAP` en `index.html` | `radar09.test.mjs` |
| 3 · Tier List, votar actores | `view-matriz` (subvistas a3-empresas, a3-empresas-activadas, a3-aliados, a3-aliados-activados) | `index.html` 1015–1147 | `index.html` 2968–3057 (`ACTIVIDAD 3 EMBUDO`); reglas en `public/embudo.js` | `activacion-votos`, `actors`, `matriz` | `embudo-config.json` (umbral 1,5) | `embudo.test.mjs` |
| 4 · Priorización e impacto/esfuerzo | `view-priorizacion` (subvistas Calificar, Matriz Impacto–Esfuerzo) | `index.html` 825, 855–917 | `index.html` 3059–3244 | `priorizacion-votos` (+ `?resumen=1`) | `priorizacion-criterios.json` (10 criterios, umbral 3,0, cuadrantes) | `embudo.test.mjs`; `priorizacion-votos.test.mjs` (roto) |
| 5 · Ruta de acción | `view-canvas` (subvistas p5-aliados, p5-empresas) | `index.html` 826–854 | `index.html` 3246–3337 | `canvas` (ids `aliado:<id>`, `empresa:<id>`) | `canvas-config.json` (cuadrantes elegibles) | `canvas.test.mjs`, `embudo.test.mjs` |

### Transversal

| Pieza | Dónde | Notas |
|---|---|---|
| Entrada por nombre y roles | `index.html` 768–780 (HTML), 1245–1296 (JS); `public/asistentes.js`; `public/asistentes-config.json` | `cargarLista()` = recarga automática (`873f011`). Prueba: `transversales.test.mjs` (línea 15 = número de participantes). |
| Landing y navegación | `index.html` 800–820 y 3340–3444; `public/landing-config.json` | `landing.test.mjs` |
| Informe PDF (administradores) | `public/informe.js` (`recopilar()` + `generar()` con jsPDF en `public/vendor`) | Usa `actors`, `ideas`, `activacion-votos`, `priorizacion-votos`, `canvas` y los tres JSON de config. Horizontes viejos cableados en `HORIZONTES`. Sin prueba propia. |
| Matriz cliente-necesidad-respuesta | ruta `matriz`; tabla editable en `index.html` 2646–2830 | Fuente del contexto de empresas en Ac3–Ac5 vía `Embudo.contexto()`. Tiene `puntoContacto` y `rutaEntrada` (datos sensibles). |
| Código histórico | `gremios-votos`, `gremios-taller` (`index.html` 2457–2640), `ideas-sintesis` | OBSOLETO según handoff del 25-sep. |
| Capa de datos | `public/api-supabase.js` | Intercepta `fetch('/api/<ruta>')`; tabla `registros (coleccion, id, data)`. Una colección nueva = una entrada nueva en `rutas`. |

## Cadena del embudo actual

`actors` (mercados → empresas; aliados → gremios-aliados) → Ac3 voto Sí/No, activa con promedio ≥ 1,5 (`Embudo.activados`) → Ac4 califica solo activados y los ubica en cuadrantes → Ac5 recibe activados en `victorias-tempranas` o `apuestas-estrategicas` (`Embudo.elegibles`). El PDF reproduce esta misma cadena.

## Datos en Supabase (1 de octubre)

- `actors`: 102 registros.
  - Mercados vigentes: 55 en 9 sectores (Financiero 10, Energía 5, Servicios públicos 5, Minero 7, Retail 6, Consumo 4, Industrial 10, Telecomunicaciones 3, Salud 5).
  - Aliados vigentes: 20. Su campo `sector` guarda la prioridad del informe («Prioridad alta», etc.), no la industria. Dos nombres parecen de prueba: «Verificación final» y «tita media».
  - Campos: `id`, `nombre`, `categoria`, `sector`, `estado`, `queHace`, `relevancia`, `articulacion`, `justificacion`, `descripcion`, `cargo`, `titular`, `confianza`, `empresas`, `fuentes`…
- `matriz`: 48 filas con `cliente`, `sector`, `necesidadCritica`, `respuestaOlivia`, `puntoContacto`, `rutaEntrada`, `trigger`.

## Choques entre el plan y el código

1. **Ids de actores.** El plan crea `public/data/actores.json` desde cero, pero el Radar, el embudo, `canvas` y `priorizacion-votos` ya usan los ids de `actors` (`mercados-…`, `aliados-…`). `actores.json` debe reutilizar esos ids.
2. **Sectores frente a industrias.** El Radar tiene 9 sectores; el plan pide 7 industrias. Correspondencia propuesta: Energía + Servicios públicos + Minero → Energía, servicios públicos y recursos naturales; Retail + Consumo → Retail, consumo masivo y comercio; los demás quedan 1 a 1; los aliados se reparten según la regla del plan.
3. **Contactos en un archivo público.** `actores.json` llevaría nombre, cargo y confianza del contacto. Quedaría en el repositorio público y en GitHub Pages, más expuesto que hoy (Supabase con clave anónima).
4. **Actividad 3.** Hoy es un voto Sí/No con umbral, no una tier list. El ajuste B la reemplaza; Ac4, Ac5 y el PDF dependen de `Embudo.activados`, así que C y D también cambian esa cadena.
5. **Actividad 5.** Hoy tiene dos formularios distintos (aliado y empresa) con acciones a 30/60/90 días y campos buyer/sponsor/CTA/aliado impulsor. El plan pide un solo formulario por actor; falta decidir qué pasa con esos campos.
6. **Horizontes de la Actividad 1.** Hoy: corto (2026), mediano (2027–2028), largo (2030), con ids de pregunta `corto-*`, `medio-*`, `largo-*` que no se deben renumerar. HZ cambia rótulos; también toca `informe.js`.
