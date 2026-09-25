# Entrega — Actividad 1: Alinear el juego

Fecha: 25 de septiembre de 2026. Plan leído completo: Handshakes/08_Actividad1_Ajustes_plan.md. Se aplica la decisión posterior del usuario de usar una nube propia en JS vanilla.

## Archivos

Modificados: public/index.html, public/api-supabase.js, netlify/functions/ideas.js, netlify/functions/ideas-sintesis.js y tests/embudo-support.mjs (solo inyecta Ideas en el entorno simulado).
Creados: public/ideas.js, tests/actividad1.test.mjs, tests/actividad1.browser.mjs y docs/actividad1-entrega.md.
No se modificaron las Actividades 2–5, la landing ni los SQL. El texto actual de la landing no menciona Conclusiones.

## Registro y compatibilidad

POST /api/ideas recibe:

```json
{"horizonte":"corto","preguntaId":"corto-1","texto":"Acceso a mercados"}
```

Devuelve HTTP 201 con {sticker: registro}. La forma exacta del registro nuevo en data es:

```json
{"id":"idea-<fecha-base36>-<azar>","horizonte":"corto","preguntaId":"corto-1","texto":"Acceso a mercados","createdAt":"2026-09-25T12:00:00.000Z"}
```

Se almacena en public.registros con coleccion="ideas", id=registro.id, data=registro; el adaptador mantiene updated_at. Se conservan el máximo de 200 caracteres por respuesta y 200 respuestas por horizonte. La vista anterior no tenía nombre ni autor: no se introducen esos campos.

El adaptador Supabase y la función alternativa de Netlify validan preguntaId contra public/ideas.js, incluyendo su correspondencia con horizonte. Falta, tipo incorrecto, identificador desconocido o pregunta de otro horizonte: HTTP 400, invalid_preguntaId, antes de acceder al almacén.

Los registros antiguos sin preguntaId no se modifican: aparecen en «Respuestas sin pregunta asignada», permiten borrado y cuentan en la nube del horizonte. También se muestran allí identificadores desconocidos que ya existan. No se necesita migración.

## Preguntas e identificadores estables

No renumerar al reorganizar visualmente. Las 15 redacciones se compararon con el archivo original y se conservaron intactas:

- corto-1: ¿Qué espera Olivia para finales de 2026?
- corto-2: ¿Olivia ha identificado algún mercado para este horizonte?
- corto-3: ¿Existe un problema/necesidad claro que Olivia resuelve en ese mercado?
- corto-4: ¿Qué aliados tiene actualmente?
- medio-1: ¿Qué espera Olivia para 2028?
- medio-2: ¿Considera que habrá mercado suficiente en este horizonte?
- medio-3: ¿Qué problema/necesidad espera estar su oferta de servicios resolviendo en ese momento?
- medio-4: ¿A qué mercados/clientes esperaría poder acceder?
- medio-5: ¿Qué red de aliados le gustaría tener?
- medio-6: ¿Cuál es el posicionamiento de marca que espera alcanzar Olivia?
- largo-1: ¿Cómo espera Olivia consolidar su estrategia para 2030?
- largo-2: ¿Qué nivel de mercado espera haber capturado o consolidado?
- largo-3: ¿A qué mercados/clientes esperaría poder acceder?
- largo-4: ¿Qué red de aliados le gustaría tener?
- largo-5: ¿Cuál es el posicionamiento de marca que espera alcanzar Olivia?

## Interfaz y actualización

Cada pregunta tiene una etiqueta asociada al campo, botón Agregar, envío con Enter y lista Respuestas obtenidas. Se conservan borrado, límite de texto, mensajes de error y borradores al fallar el guardado. El polling existente actualiza las listas y nubes sin reconstruir los campos de entrada. La vista escucha vista:activar. Resultados es la última subpestaña de nav.subviews, con data-subview="ideas-resultados" y .subview; recalcula y consulta al activarla. No cambia la navegación central ni las rutas #actividad-1…5.

Se retiran por completo los textareas, botones, estado, funciones y solicitudes de síntesis manual de index.html.

## Nubes

Implementación propia local, sin CDN, librerías nuevas, canvas ni servicios. Agrupa todas las respuestas por horizonte, incluidos registros antiguos. Convierte a minúsculas, normaliza Unicode, separa por puntuación y descarta números y tokens de una letra. Cuenta las variantes sin marcas diacríticas bajo una misma clave y muestra la forma escrita más frecuente; los empates se resuelven alfabéticamente en español. No aplica raíces ni fusiona singular y plural.

Ordena por frecuencia descendente, desempata alfabéticamente y limita a 40 palabras. Ideas.contar(respuestas, {maxPalabras:40, excluirOlivia:true}) permite cambiar el límite y la exclusión de Olivia. Tamaño: 1 + 2 × frecuencia / frecuenciaMáxima rem. Filas flexibles centradas con separación y salto automático evitan superposiciones; palabras largas se parten para caber. Usa los tokens existentes de texto, panel y horizonte para ambos temas. Cada nube tiene una lista accesible desplegable con palabras y frecuencias; la representación visual duplicada queda aria-hidden. Distingue horizonte sin respuestas de respuestas sin palabras significativas.

Lista completa de palabras vacías (se compara sin tildes):

a, al, algo, algun, alguna, algunas, alguno, algunos, ante, antes, bajo, cada, como, con, contra, cual, cuales, cuando, de, del, desde, donde, durante, e, el, ella, ellas, ello, ellos, en, entre, era, eramos, eran, eras, eres, es, esa, esas, ese, eso, esos, esta, estaba, estaban, estado, estamos, estan, estar, estas, este, esto, estos, estoy, fue, fueron, ha, haber, habia, habian, han, hasta, hay, he, hemos, la, las, le, les, lo, los, mas, me, mi, mis, mismo, mucha, muchas, mucho, muchos, muy, nada, ni, no, nos, nosotros, nuestra, nuestras, nuestro, nuestros, o, os, otra, otras, otro, otros, para, pero, poco, por, porque, que, quien, quienes, se, sea, sean, ser, si, sido, siendo, sin, sobre, sois, solo, somos, son, soy, su, sus, te, tiene, tienen, todo, toda, todas, todos, tras, tu, tus, un, una, unas, uno, unos, usted, ustedes, va, vamos, van, y, ya, yo.

Además se excluye «olivia» por defecto, configurable como se indica arriba.

## Auditoría de ideas-sintesis

Búsqueda local en todo el repositorio con rg, incluidos archivos ocultos y excluyendo .git y node_modules. Fuera de la vista de Actividad 1 aparecen:

- public/api-supabase.js: ruta conservada, marcada OBSOLETO.
- netlify/functions/ideas-sintesis.js: función conservada, marcada OBSOLETO.
- netlify.toml: redirección a esa función; conservada.
- supabase/migrar_desde_netlify.py: importación histórica que todavía lee y puede copiar la colección; no se ejecutó ni modificó.
- supabase/schema.sql, supabase/agregar_canvas.sql y supabase/agregar_activacion_votos.sql: CHECK de colecciones permitidas; conservados.
- docs/embudo-entrega.md: ejemplo documental del CHECK; conservado.

No se encontró otra vista consumidora. Esta entrega y sus pruebas mencionan la colección para documentar y verificar el retiro. No se borra la colección ni se deshabilita su ruta histórica.

## Validación y límites

- node --test tests/actividad1.test.mjs tests/embudo.test.mjs: 14 pruebas aprobadas, 0 fallidas, 0 omitidas. Supabase simulado en memoria, sin solicitudes externas.
- Cobertura nueva: 15 guardados por pregunta, validación sin escrituras en errores, lectura/borrado, normalización y vacías, límite, Olivia configurable, Unicode, legado, distribución por pregunta, actualización de listas/nubes, conservación del borrador y recuperación tras error.
- Todos los scripts incrustados en index.html compilados con vm.Script; node --check de ideas.js, api-supabase.js y netlify/functions/ideas.js aprobado. git diff --check sin errores.
- tests/actividad1.browser.mjs implementa flujo con Enter, aislamiento, borrado, actualización por polling, legado, borrador durante polling, vacíos, ancho real de 390 px en iframe, temas claro/oscuro, desbordamiento y colisiones entre palabras. Intercepta todas las solicitudes y aborta destinos externos. Se intentó ejecutar con Puppeteer local, pero Chrome no pudo iniciarse en este entorno (Failed to launch the browser process). La revisión visual real está PENDIENTE; no se afirma como aprobada.
- Para ejecutar la comprobación visual en un entorno con Chrome disponible: PUPPETEER_MODULE=/ruta/a/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js node tests/actividad1.browser.mjs. CHROME_PATH es opcional. No instala dependencias ni requiere servidor.

No se hicieron commits, push, despliegues, llamadas a APIs externas ni escrituras en producción. No se ejecutaron limpieza de datos ni acciones del taller del 6 de octubre.

## Ajuste posterior (25 sep)

A pedido de Felipe, la lista de palabras vacías incluye todas las preposiciones del español: a, ante, bajo, cabe, con, contra, de, desde, durante, en, entre, hacia, hasta, mediante, para, por, según, sin, so, sobre, tras, versus y vía (se agregaron cabe, hacia, mediante, según, so, versus y vía). El tamaño de las palabras en la nube ahora se escala entre la frecuencia mínima y la máxima (1 a 3 rem); si todas empatan, quedan en 1,5 rem.
