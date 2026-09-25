# Radar 09: entrega de ajustes del Radar 360 · 25 de septiembre de 2026

Implementa `Handshakes/09_Radar360_Ajustes_plan.md`. Codex hizo el código y los datos. El reporte final no alcanzó a escribirse porque Codex llegó al límite de uso de su cuenta, así que esta nota la redactó Claude a partir de los archivos vigentes.

> Un primer hilo de Codex, que fue cancelado, dejó otra versión con «Aries Mining» y «Ferroesmeraldas». Esa versión está DESCARTADA: sus archivos se movieron a `Radar360-web-backups/DESCARTADO_*`. La versión vigente es la de este documento.

## Archivos

- **`public/index.html`**
  - (Retirado el 25 sep por decisión de Felipe: el panel «Contexto regional y sectorial» rompía la dinámica del taller. Su contenido queda como anexo del informe en `Investigación/Anexo_Contexto_Regional_Sectorial_Informe_v1.2.docx`.)
  - `SECTOR_FICHAS` actualizado al informe v1.2, con 9 sectores.
  - `SECTOR_ORDER.mercados` = Financiero, Energía, Servicios públicos, Minero, Retail, Consumo, Industrial, Telecomunicaciones, Salud.
  - Tercer bloque en `#actorDialog`, «Necesidad y posibilidad de articulación con Olivia», solo para mercados.
- **`supabase/patches_radar09_20260925.json`:** 55 registros completos para hacer upsert en `actors`: 48 mercados vigentes y 7 mineros nuevos.
- **`supabase/radar09-base.json`:** base de comparación. Antes de escribir, el script revisa que la producción no haya cambiado desde el volcado.
- **`supabase/aplicar_radar09.mjs`:** por defecto solo simula. Escribe únicamente si se ejecuta con `--aplicar`.
- **`docs/radar09-reclasificacion.json`**, **`docs/radar09-simulacion.txt`** y **`docs/radar09-pruebas.txt`.**
- **`tests/radar09.test.mjs`** (8 casos) y **`tests/radar09.browser.mjs`** (requiere Puppeteer; no se ha ejecutado).

Gestión y `api-supabase.js` aceptan el sector como texto libre, así que no necesitaron cambios.

## Datos

- **Campos que se conservan:** ids, nombres, `justificacion`, `queHace` y `relevancia`.
- **Campo nuevo:** `articulacion`, en los 48 mercados vigentes y en los 7 mineros.
- **Términos prohibidos:** ningún texto nuevo contiene «días», «Tello», «Barrientos», «por identificar», «confianza», «Vía », «interlocutor» ni «contacto».

**Reclasificación (9 actores):**

| Destino | Actores |
|---|---|
| Consumo | Alpina, Bavaria, Grupo Nutresa, Productos Ramo |
| Servicios públicos | Celsia, Enel Colombia, EPM, Promigas, Vatia |

Energía conserva Ecopetrol, Erco, GreenYellow, GEB e ISA. Retail conserva Éxito, D1, Frisby, Ara, MercadoLibre y Terpel.

**Resultado por sector:**

| Sector | Actores |
|---|---|
| Financiero | 10 |
| Energía | 5 |
| Servicios públicos | 5 |
| Minero | 7 |
| Retail | 6 |
| Consumo | 4 |
| Industrial | 10 |
| Telecomunicaciones | 3 |
| Salud | 5 |
| **Total** | **55** |

**Sector Minero:** todos con estado `por_validar`, confianza `media` y logo oficial.
- Cerrejón
- Drummond
- AngloGold Ashanti (Colombia)
- Mineros S.A.
- Aris Mining. En la lista del taller aparecía como «Aries Mining»; Felipe confirmó que es Aris.
- Fedeesmeraldas. Es la Federación Nacional de Esmeraldas, un gremio que entra como «gremio como cliente». Felipe lo identificó como lo que Germán llamó «Ferroesmeraldas». También podría ir como aliado.
- Grupo Coquecol, confirmada por Felipe como carbonera representativa. Alternativas que investigó el hilo descartado: Carbones Andinos (minas propias y coque; Boyacá, Cundinamarca y Atlántico) y C.I. Milpa (carbón metalúrgico y coque).

## Pendientes

- Carbonera confirmada (Coquecol). Logos oficiales de los 7 mineros agregados en public/logos/ y LOGO_MAP (el de Aris Mining es el SVG oficial del encabezado de aris-mining.com).

- Aplicar los datos: `node supabase/aplicar_radar09.mjs` para simular y `--aplicar` para escribir, solo con aprobación de Felipe.
- Pruebas: 32 de 32 (`radar09`, `actividad1`, `embudo`, `canvas`, `landing`).
