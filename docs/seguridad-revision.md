# Revisión de seguridad · Ruta Colombia - Olivia · 25 de septiembre de 2026

La hizo Claude porque Codex no estaba disponible: su cuenta devolvía un error 401. No es una segunda opinión independiente. Cuando Codex vuelva a funcionar, conviene pedirle una revisión propia de este documento.

**Alcance:**
- `public/index.html`, `api-supabase.js`, `embudo.js`, `ideas.js`, `asistentes.js`, `informe.js` y `config.js`;
- `supabase/*.sql`;
- `.github/workflows/pages.yml`.

## Cómo está armado (contexto)

- El sitio es estático, en GitHub Pages, con el repositorio público.
- Los datos están en una sola tabla de Supabase, `registros`, con RLS pública para el rol `anon`: cualquiera puede leer, crear, editar y borrar. La clave publishable está en `config.js`, y eso es lo esperado en Supabase.
- Todas las validaciones (`api-supabase.js`) se hacen **en el navegador**. Quien llame directamente a la API REST de Supabase con esa clave se las salta.

## Hallazgos

| # | Nivel | Hallazgo | Evidencia | Impacto | Estado |
|---|---|---|---|---|---|
| 1 | **Crítico** | Escritura y borrado públicos sin autenticación ni validación del lado del servidor | `supabase/schema.sql` (políticas `with check (true)` / `using (true)`); `public/config.js` | Con la clave publicada, cualquiera puede borrar o alterar todas las colecciones: actores, votos, canvas e ideas. Por ejemplo, vaciar el Radar en plena sesión. | **Mitigado en parte:** respaldos JSON antes de cada cambio. Hay una propuesta en `supabase/propuesta_seguridad.sql`: no borrar actores, tope de tamaño y coherencia del id. **No se ejecutó.** La solución de fondo es posterior al taller: autenticación y escrituras vía funciones del servidor. |
| 2 | **Alto** | Datos sensibles visibles para cualquiera con el enlace | Colección `matriz` (punto de contacto, niveles de confianza, «rango degradado», rutas de entrada «vía Tello / Barrientos») y `justificacion` de mercados; se leen por REST y en la Matriz de la Actividad 3 | Los participantes del taller, entre ellos Hernán Tello y Luis Felipe Barrientos, pueden leer valoraciones internas sobre contactos y sobre ellos mismos. Riesgo reputacional. | **Pendiente de decisión de Felipe:** mover esos campos fuera de la base pública o resumirlos antes del 6 de octubre. Las fichas de calificación ya no los muestran, pero el editor de la Matriz y la API sí. |
| 3 | **Alto** | `PATCH /api/actors` aceptaba cualquier campo y valor | `public/api-supabase.js`, ruta `actors`, antes `Object.assign({}, body.patch)` | Un valor inválido en `categoria`, `confianza` o `estado` rompía el Radar y la Gestión (`CATS[x].label` indefinido). Además, esos valores se insertan en clases CSS sin escapar (`'cat-'+a.categoria`), lo que permitía romper el atributo e inyectar HTML. | **Corregido:** lista blanca de campos editables, validación de valores y longitudes (`limpiarParcheActor`), y validación de `confianza` y `estado` en el POST. |
| 4 | **Alto** | Registros escritos directo en la base podían inyectar HTML o romper la página | `public/index.html`, `fetchActors` | Igual que el #3, pero saltándose el adaptador. | **Corregido:** al leer actores se descartan los registros sin `id`, sin `nombre` o con una categoría desconocida, y `confianza` y `estado` se normalizan a valores conocidos. El resto del texto ya se escapa con `esc()`. |
| 5 | **Medio** | Filtro de entrada y rol de administrador solo del lado del cliente | `public/asistentes.js`, `public/asistentes-config.json`, bloque `ENTRADA` en `index.html` | Alguien técnico puede saltarse la pantalla de entrada: basta editar `localStorage` o llamar a la API directamente. La lista de asistentes es visible en el código publicado. El botón del PDF solo se oculta; los datos que usa son públicos. | **Aceptado para el taller:** sirve para ordenar la sesión e identificar a quien vota, no como protección. Blindarlo requiere Supabase Auth y RLS por rol, después del taller. |
| 6 | **Medio** | `PATCH /api/matriz` acepta cualquier campo | `public/api-supabase.js`, ruta `matriz` | Se pueden guardar campos arbitrarios. Al mostrarse, todo pasa por `esc()`, así que no hay inyección, pero sí datos basura. | Pendiente: lista blanca como en actores, de bajo riesgo. |
| 7 | **Medio** | Sin límite de tamaño por registro en la base | `supabase/schema.sql` | Se pueden cargar registros enormes que vuelven lenta la página para todos. | Propuesto en `propuesta_seguridad.sql` (tope de 20 KB). No ejecutado. |
| 8 | **Bajo** | Sin política de seguridad de contenido (CSP) | `public/index.html` | Reduciría el daño de una inyección futura. GitHub Pages no permite cabeceras; se podría poner una etiqueta `<meta http-equiv="Content-Security-Policy">`. | Pendiente: requiere probar que no bloquee las fuentes de Google ni Supabase. |
| 9 | **Bajo** | Nombres de votantes visibles en las descargas CSV | Actividades 3 y 4 | Es parte del diseño: los votos no son anónimos. | Aceptado. Se informa en el sitio. |
| 10 | **Bajo** | Flujo de publicación | `.github/workflows/pages.yml` | Permisos mínimos (`contents: read`, `pages: write`) y acciones oficiales fijadas a versión mayor. | Sin cambios. |

**Revisado sin hallazgos:**
- escapado de texto de usuarios en las vistas de Actividades 1 a 5, en las fichas del Radar y en el PDF (el PDF dibuja texto, no HTML);
- ids con caracteres de control o barras, rechazados en `activacion-votos` y `canvas`;
- borrado por prefijo, que escapa `%` y `_`.

## Recomendación antes del 6 de octubre

1. **Decidir el hallazgo #2** (datos sensibles de la Matriz). Es lo único que expone información a los propios asistentes.
2. **Hacer un respaldo** de toda la base justo antes de empezar el taller y otro al terminar (el patrón ya se usó: `Radar360-web-backups/supabase_*.json`).
3. **Opcional:** ejecutar `supabase/propuesta_seguridad.sql`, que no afecta el uso normal del sitio.

## Actualización del reenfoque · 1 de octubre de 2026

### Qué cambió

- **Hallazgo #2 (Matriz):** el editor de la Matriz salió de la interfaz con el ajuste B. Los datos siguen en Supabase y se pueden leer por REST con la clave pública, pero ya no aparecen en pantalla.
- **Colecciones nuevas** (habilitadas con `supabase/agregar_reenfoque.sql`): `contactos-informe`, `contactos`, `parejas`, `tierlist`, `seleccion` y `rutas`. Tienen las mismas políticas públicas que el resto de la tabla, así que el hallazgo #1 también las cubre.
- **Datos personales nuevos:**
  - `contactos-informe`: 60 contactos sugeridos por el informe v1.2 (nombre, cargo y confianza). Se cargan con `supabase/sembrar-contactos-informe.mjs` desde `privado/contactos-informe.json`, que no está en el repositorio.
  - `contactos`: contactos corporativos que registran los participantes en la ficha del actor (nombre, cargo, teléfono y correo). El formulario muestra el aviso de uso y borrado.
  - Las dos colecciones son legibles con el enlace del sitio. Por eso se borran después del taller.
- **`public/data/actores.json` no tiene contactos.** Una prueba (`tests/contenido.test.mjs`) lo verifica.

### Procedimiento después del taller (6 de octubre)

Se ejecuta desde la carpeta `Radar360-web/` con conexión a internet.

1. **Respaldo completo de la base**, como en los respaldos anteriores (`Radar360-web-backups/supabase_*.json`).
2. **Exportar y borrar los contactos del taller:**
   ```
   node scripts/exportar-contactos.mjs --borrar
   ```
   - Deja el CSV en `privado/exportaciones/contactos-taller-AAAAMMDD-HHMMSS.csv`, una carpeta que Git ignora.
   - Solo borra si el CSV tiene el mismo número de filas que la colección y nadie agregó contactos mientras tanto.
   - Al terminar confirma que la colección «contactos» quedó vacía.
   - Para exportar sin borrar (por ejemplo, para revisar antes), se omite `--borrar`.
3. **Entregar el CSV a Diego Espejo por un canal privado:** correo directo o carpeta compartida solo con él. No por chats de grupo ni enlaces públicos.
4. **Borrar los contactos sugeridos por el informe:**
   ```
   node supabase/sembrar-contactos-informe.mjs --borrar
   ```
   Al terminar confirma que `contactos-informe` quedó vacía.
5. **Verificar** en el editor SQL de Supabase:
   ```sql
   select coleccion, count(*) from public.registros
   where coleccion in ('contactos', 'contactos-informe')
   group by coleccion;
   ```
   No debe devolver filas.
6. **Cuando Diego confirme que recibió el CSV,** borrar la copia local de `privado/exportaciones/`.

### Pendiente

- **`supabase/propuesta_seguridad.sql` sigue sin ejecutarse.** Es compatible con el reenfoque: solo impide borrar actores desde la web y limita cada registro a 20 KB. Todas las colecciones nuevas validan ese tope.
- **Solución de fondo (después del taller):** Supabase Auth con roles, escrituras mediante funciones del servidor y repositorio privado.
