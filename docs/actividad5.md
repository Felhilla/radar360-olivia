# Actividad 5 — Rutas de acción de aliados y empresas

El contrato vigente desde el 25 de septiembre de 2026 está documentado en [embudo-entrega.md](embudo-entrega.md): archivos, SQL de activación, configuración, emparejamientos, datos, pruebas y pendientes.

La entrada es el resultado vigente del embudo Actividad 3 → Actividad 4 en Victorias tempranas o Apuestas estratégicas. Hay dos pestañas de trabajo grupal guiado por German y Julio; «Registrado por» es opcional.

- **Aliados:** nombre y qué ofrece precargados, aporte de Olivia y acciones a 30/60/90 días.
- **Empresas:** contexto de Matriz, oferta editable, aliado impulsor entre los aliados elegibles, buyer, sponsor, CTA y acciones a 30/60/90 días.
- **Consolidado:** hoja y CSV por pestaña, con el sello del último guardado y aviso para fichas que salgan del embudo.

Se reutiliza `/api/canvas` y la colección `canvas`, con ids `aliado:<actorId>` y `empresa:<actorId>`. PUT valida actor vigente y grupo, no `matrizId` ni `trigger:true`. Las fichas guardadas sobreviven a una desactivación. Se retiran del modelo vigente `ruta90`, `rutaAuto` y la ruta automática. Los datos históricos no se borran ni migran automáticamente.

La guía anterior de canvas por fila de Matriz y umbral de gremios 2,5 queda superada. La migración histórica `agregar_canvas.sql` no es la migración nueva: para el embudo se entrega `supabase/agregar_activacion_votos.sql`, con líneas cortas y sin DO.
