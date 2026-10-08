# Entrega al cliente: roles, acceso y control de cambios

Cambios locales del 8 de octubre de 2026. No se ejecutó SQL, no se escribió en Supabase y no se publicó el sitio.

## Roles

- Diseñadores: Germán Hillón, Felipe Hillón y Julio Ochoa. Observan todas las actividades y todos los grupos; tienen PDF y control de cambios. El adaptador rechaza sus escrituras con 403, incluidos los ejemplos.
- Administradores: Luis Felipe Barrientos y Hernan Tello. Editan A1–A5, sortean/inician A3 y editan cualquier tablero, incluso antes del inicio. Los guardados van a la base.
- Participantes: las otras diez personas. Editan A1/A2 y su grupo iniciado de A3. A4/A5 permanecen visibles y se actualizan por sondeo, sin permitirles editar.

Los ejemplos históricos `ejemploCompartido:true` siguen en `/api/ejemplos`, separados de los resultados. Se retiró el almacén de escritura `ruta-ejemplos-facilitador`; no se migraron ejemplos locales a la base.

## Acceso

`acceso.js` verifica SHA-256 de `salt + ':' + contraseña`. Consulta primero `/api/credenciales?id=<slug>`; solo cuando no existe registro usa `hashInicial` del config. Un error de conexión no habilita ese fallback.

La contraseña inicial obliga a escribir una nueva dos veces, con ocho caracteres como mínimo y distinta de la inicial. El salt nuevo usa 16 bytes aleatorios de Web Crypto. La colección guarda `{salt, hash, cambiadaEn}`. Nunca se conserva la contraseña en texto. La sesión de conveniencia guarda únicamente el nombre en `ruta-sesion-administrador`; `ruta-identidad` sigue identificando a la persona. «Cambiar de persona» borra ambas. Si localStorage está bloqueado se puede entrar, pero hay que autenticarse otra vez al recargar.

Esto es **control de pantalla, no seguridad real**, según el riesgo aceptado por el cliente. Las rutas y las sesiones son del navegador y pueden eludirse; no se añadieron Supabase Auth ni políticas de servidor.

## Actividades y catálogo

`TierList.catalogoVigente` combina la caracterización estática con los actores vigentes de mercados/aliados del Radar. Los actores adicionales se clasifican por sector normalizado; aliados y sectores desconocidos van a `gremios_publico`. La ruta `/api/catalogo-actores` se vuelve a leer en cada carga de A3/A4/A5 y en las fichas. El catálogo prevalece para la industria de un id ya existente. Los nuevos, incluido Colsubsidio, no requieren recargar la página.

A5 ofrece participantes como Responsable y participantes más administradores como Apoyo. «Otra persona» se conserva para Responsable. Apoyo es opcional, máximo 120 caracteres, distinto del responsable incluso con diferencias de mayúsculas/tildes y sin diseñadores. Cambiar Responsable limpia un Apoyo coincidente. Aparece en tarjeta, ficha, hoja y CSV.

## Historial

Cada guardado de las colecciones indicadas agrega un registro con autor capturado al solicitar la escritura, rol, actividad, acción, fecha y estados anterior/posterior. Una contraseña solo registra «Contraseña cambiada», sin salt ni hash. Actores se registra como Radar y contactos como A2.

Excepción solicitada a la regla de agregar registros: A3 acumula movimientos por grupo y ventana fija de diez minutos (`Math.floor(Date.now()/600000)`), conservando el tablero anterior al primer cambio, el último tablero y el contador. Registra también los autores de la ventana. No hay API pública de edición/borrado del historial ni botón de restaurar.

Las escrituras de una pestaña se serializan. La base existente usa peticiones REST separadas para dato e historial: **no es una transacción entre ambos, ni existe bloqueo entre navegadores**. Dos navegadores que actualicen simultáneamente la misma ventana de A3 pueden competir al acumular el registro. Una garantía transaccional requeriría una función de base de datos. Si el dato se guardó y el historial falla, el adaptador responde con un error explícito indicando que el dato sí quedó guardado; no se revierte ni se reintenta silenciosamente.

La vista Control de cambios se actualiza cada diez segundos mientras está abierta. Incluye filtros de actividad/texto, resumen, detalle antes/después y escape de HTML.

## Habilitación pendiente fuera de esta tarea

La restricción documentada de `public.registros.coleccion` no incluye `credenciales` e `historial`. Se preparó `supabase/agregar_acceso_historial.sql`, **sin ejecutarlo**. Antes de publicar este código hay que habilitar esas colecciones. La migración conserva las colecciones existentes y no cambia RLS. Sin esa habilitación fallarán el cambio inicial de contraseña y las auditorías.

`public/informe.js` no fue modificado por esta tarea. El botón admite los dos roles privilegiados y entrega las dependencias del informe actual. La prueba transversal del PDF se adaptó al contrato nuevo del trabajo concurrente (tier list y rutas).

## Verificación

Las pruebas usan Supabase simulado y no llaman a la base real:

```sh
NODE_OPTIONS=--experimental-vm-modules node --test tests/*.test.mjs
```

Se añadieron pruebas de acceso completo, persistencia/cierre de sesión, almacenamiento bloqueado, permisos, escrituras reales simuladas, apoyo, mapeos, Colsubsidio, sondeo de A4/A5, ventanas y errores de historial, filtros y detalle de la vista. Se actualizaron las expectativas antiguas de facilitadores y ejemplos locales.

Resultado final: **149 pruebas, 149 aprobadas, 0 fallidas, 0 omitidas**. `git diff --check` también pasó.
