# Plan 10: ajustes transversales · entrega del 25 de septiembre de 2026

Implementó Claude, porque Codex no estaba disponible: su cuenta devolvía un error 401 incluso después de volver a iniciar sesión. Plan: `Handshakes/10_AjustesTransversales_plan.md`.

## Qué cambió

1. **Aviso legal:** el `footer.credit` tiene el texto definitivo de propiedad intelectual de GH Estudio. Es un solo elemento fuera de las vistas, así que aparece en todas las pestañas. Se revisó en escritorio y a 390 px.
2. **Revisión de seguridad:** está en `docs/seguridad-revision.md`. Se corrigieron dos hallazgos altos:
   - el PATCH y el POST de actores ahora solo aceptan una lista blanca de campos y valores (`limpiarParcheActor`);
   - al cargar, los actores se depuran: `fetchActors` descarta categorías inválidas y normaliza `confianza` y `estado`.

   Queda una propuesta de SQL sin ejecutar en `supabase/propuesta_seguridad.sql`.
3. **Botones Editar / Eliminar:** la causa era `.row-actions{display:flex}` aplicado a un `<td>`. La celda dejaba de ser celda de tabla: se salía de la fila, los bordes se cortaban y los botones quedaban desplazados. Ahora el `td` sigue siendo celda de tabla y los botones se apilan dentro. Afecta la Gestión del Radar y la tabla de la Matriz.
4. **Filtro de entrada:**
   - la lista está en `public/asistentes-config.json` (7 participantes y 3 administradores) y la lógica en `public/asistentes.js`;
   - se entra si coinciden al menos 2 palabras de más de 2 letras con **una sola** persona, sin importar tildes ni mayúsculas;
   - si hay una sola palabra, varias coincidencias o ninguna, no deja entrar y muestra el motivo;
   - la identidad se guarda en `localStorage` (`ruta-identidad`), se vuelve a validar al abrir el sitio y se cambia con «Cambiar de persona»;
   - hasta validar, `body.sin-acceso` oculta todo el sitio;
   - la lista actual no tiene ambigüedades (`Asistentes.ambiguedades`).
5. **Nombre en las Actividades 3 y 4:** `a3Nombre` y `p4Nombre` toman el nombre de la lista y son de solo lectura; se actualizan con el evento `identidad:cambio`. La clave del voto sigue siendo el slug del votante. La Actividad 5 no cambia.
6. **Informe PDF:**
   - el botón «Descargar informe (PDF)» aparece en el encabezado solo para Germán Hillón, Felipe Hillón y Julio Ochoa;
   - `public/informe.js` reúne los datos en vivo (con `Embudo` e `Ideas`) y dibuja con jsPDF 2.5.2, copiada en `public/vendor/` con su licencia; se carga solo al pulsar el botón;
   - el archivo se llama `Ruta-Colombia-Olivia_informe_AAAA-MM-DD.pdf`.

   Contenido del PDF:

   | Sección | Qué incluye |
   |---|---|
   | Portada | Fecha y hora de generación, y el aviso legal |
   | Actividad 1 | Nube de palabras y frecuencias de cada horizonte |
   | Actividad 2 | Actores vigentes por categoría y sector |
   | Actividad 3 | Actores activados, con promedio y votos |
   | Actividad 4 | Gráfico de cuadrantes numerado y lista ordenada (primero Victorias tempranas) |
   | Actividad 5 | Fichas de aliados y canvas de empresas, con acciones a 30, 60 y 90 días |

## Pruebas

`tests/transversales.test.mjs` tiene 7 casos:
- coincidencias de nombres;
- aviso legal y CSS de la celda de acciones;
- nombre bloqueado en las Actividades 3 y 4;
- validación del PATCH;
- depuración de actores al cargar;
- contenido del PDF.

Total con las suites anteriores: **39 de 39**. `tests/embudo-support.mjs` ahora simula `document.addEventListener`.

**En el navegador**, con el sitio local y los datos reales solo de lectura:
- la pantalla de entrada funciona en escritorio y a 390 px, sin desborde;
- «Felipe» solo se rechaza;
- «felipe hillon» entra como administrador;
- Diana Ramos entra como participante y no ve el botón del PDF;
- el PDF se genera en el navegador con los datos reales: 6 páginas.

## Límites

El filtro y el rol de administrador funcionan solo en el navegador (ver el hallazgo 5 de la revisión de seguridad). La lista de asistentes queda en el código publicado. Si la lista cambia, se edita `asistentes-config.json`.
