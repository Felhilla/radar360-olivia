# Guía replicable: herramientas de taller en vivo (caso Ruta Colombia – Olivia)

2 de octubre de 2026 · GH Estudios

> Copia en el repositorio de la guía publicada como documento: https://claude.ai/code/artifact/f516be77-82f8-4237-a9c9-d8afb57d1827 . Si las dos versiones difieren, vale la del documento.

## Para qué sirve esta guía

Esta guía permite construir en dos o tres semanas una plataforma web para un taller en vivo, con varias actividades conectadas, sin repetir los errores del caso Olivia. Sirve para cualquier proyecto en el que un grupo de personas deba pasar de un diagnóstico amplio a decisiones concretas: priorizar clientes, aliados, mercados, riesgos o iniciativas.

Cómo usarla en un proyecto nuevo:

1. Lee el panorama y el proceso general para entender la arquitectura y el ciclo de trabajo.
2. Elige de las fichas por herramienta las que necesita tu taller. Cada ficha dice qué información pedir antes de empezar, cómo construirla paso a paso y qué lecciones aplicar.
3. Revisa las lecciones transversales y los mecanismos de ahorro de tokens antes de redactar el primer encargo.
4. Usa la lista de verificación del final como punto de arranque.

Fuentes: los 18 handoffs, el mapa de dependencias y los 13 handshakes del proyecto Olivia (15 de septiembre al 1 de octubre de 2026), el repositorio `Felhilla/radar360-olivia` y el plan de reenfoque.

## Panorama del caso Olivia

En 17 días (15 de septiembre al 1 de octubre de 2026) se construyó «Ruta Colombia – Olivia»: un sitio web con una portada y cinco actividades encadenadas para el taller comercial del 6 de octubre. El taller lleva a unas 8 a 12 personas de un universo de 102 actores del mercado colombiano a un máximo de 10 actores priorizados, cada uno con su ruta de acción por trimestre.

**El embudo final (versión del 1 de octubre):**

1. **Alinear el juego:** cada participante responde preguntas guía por horizonte (Q4-2026, Q1-2027, año 2027) y el sitio muestra nubes de palabras.
2. **Radar 360:** mapa de 102 actores en 4 categorías (competidores, mercados, aliados, autoridades), con ficha por actor y registro de contactos.
3. **Tier list en parejas:** parejas sorteadas ubican los actores de sus industrias en 4 niveles; máximo 3 en el Nivel 1 por pareja.
4. **Priorización:** los actores del Nivel 1 se califican con 5 criterios de impacto y 5 de esfuerzo; un corte automático deja máximo 10.
5. **Ruta de acción:** por cada actor, responsable, etiqueta (venta inmediata o posicionamiento) y acciones por trimestre.

**Arquitectura técnica:** página estática en GitHub Pages; datos compartidos en Supabase, en una sola tabla `registros (coleccion, id, data)`; un adaptador en el navegador (`api-supabase.js`) traduce las llamadas `/api/<ruta>` y aplica las validaciones. Las reglas de cada actividad viven en módulos puros (`tierlist.js`, `corte.js`, `rutas.js`) y en archivos de configuración JSON, cubiertos por 109 pruebas automáticas.

```text
1 Alinear      2 Radar 360     3 Tier list     4 Priorizar            5 Ruta
ideas      ->  actors      ->  parejas     ->  priorizacion-votos ->  lista-rutas
               contactos       tierlist        seleccion              rutas
   \______________|_______________|_______________|____________________/
                                  |
   GitHub Pages  ------->  api-supabase.js  ------->  Supabase
   index.html, módulos     traduce /api/ruta          tabla registros
   y JSON de reglas        y valida en el navegador   (coleccion, id, data)
```

Cada actividad escribe su propia colección y lee la de la anterior; ninguna habla directo con la base, todo pasa por el adaptador.

**Cómo evolucionó la plataforma:**

| Fecha | Hito |
| --- | --- |
| 1 oct | Reenfoque: tier list, corte en 10, ruta por trimestre, textos en lenguaje claro |
| 25–27 sep | Embudo Sí/No, nubes de palabras, sector Minero, entrada por lista de asistentes, PDF |
| 24 sep | Actividad 4, Canvas, portada; migración de Netlify a GitHub Pages + Supabase |
| 23–24 sep | Ajustes al Radar, competidores, gremios con voto 3/2/1 |
| 17 sep | Lluvia de ideas y Matriz cliente–necesidad–respuesta en un sitio unificado |
| 16 sep | Radar 360 publicado en Netlify, tras descartar Claude Artifacts |
| 15 sep | Fichas (handoffs) de las 5 herramientas y mapa de dependencias |

De las herramientas construidas, tres salieron del entregable final: la Matriz cliente–necesidad–respuesta, el voto de gremios 3/2/1 y el embudo de activación Sí/No con Canvas a 30/60/90 días. Aparte, en la misma carpeta, se construyó «Empresa Foco», un panel de inteligencia de mercado para Julio.

## Proceso general de construcción

Cada herramienta pasó por el mismo ciclo de seis pasos, y los reprocesos aparecieron casi siempre cuando se saltó uno. El ciclo empieza con una ficha y termina con un handoff que permite retomar sin releer la conversación.

1. **Ficha de la herramienta (handoff inicial).** Objetivo, rol en la agenda del taller, insumos, salida, datos que pasa a la siguiente herramienta y decisiones pendientes. En Olivia se hicieron las 5 fichas el mismo día con un mapa de dependencias entre ellas.
2. **Handshake (plan cerrado con la persona responsable).** Plan con objetivo, criterios de éxito, alcance (incluye y no incluye), fases, restricciones, riesgos y supuestos. Se cierra en conversación, sección por sección, antes de escribir código.
3. **Inventario y encargo.** Antes de desarrollar, se mapea qué parte del código toca cada cambio y se redacta un encargo autocontenido: contexto, archivos permitidos, reglas, pruebas exigidas e informe final.
4. **Desarrollo.** Codex o Claude Code implementan un ajuste a la vez sobre el archivo principal, en una rama aparte.
5. **Revisión y prueba.** Claude Code revisa el diff, corre todas las pruebas y hace un recorrido en navegador contra la base real, en computador y en celular a 390 px; luego borra los datos de prueba.
6. **Aprobación, publicación y handoff.** La persona responsable aprueba; se publica; se verifica en una pestaña nueva; se escribe el handoff con objetivo, estado, archivos, intentos fallidos y próximos pasos.

**Roles:**

| Rol | Quién en Olivia | Qué hace |
| --- | --- | --- |
| Decide | Cliente (Diego Espejo) | Aprueba el alcance; si hay desacuerdo, decide |
| Responsable | Felipe | Cierra handshakes, aprueba cada ajuste, publica, ejecuta pasos manuales (SQL, permisos) |
| Contenido y metodología | German y Julio | Criterios, informe de mercado, validación de actividades |
| Coordina y revisa | Claude Code | Inventario, encargos, revisión, pruebas, recorrido en navegador, handoffs; desarrolla si Codex no está disponible |
| Desarrolla | Codex | Implementa encargos con pruebas; no hace pruebas visuales |

Regla de oro del ciclo: nada se publica si falla una prueba, y nada se borra de la base sin respaldo previo.

## Fichas por herramienta

Son 13 fichas: 9 herramientas vigentes, 3 retiradas del entregable y una aplicación aparte. Cada ficha tiene el mismo orden: para qué sirve, qué información pedir antes de empezar, paso a paso y lecciones aprendidas.

### 1. Base de contenido de actores (vigente)

**Para qué:** un solo archivo con todos los actores del taller y sus textos, del que leen todas las actividades.

**Información necesaria:**

- Informe de mercado definitivo (en Olivia, el informe v1.2 en .docx).
- Lista de actores con un id estable y una categoría; las industrias o sectores con que se agruparán.
- Contactos sugeridos con su nivel de confianza (van aparte, nunca en el repositorio).
- Fecha de corte del taller, para descartar eventos pasados.

**Paso a paso:**

1. Extraer el texto del informe a Markdown en una carpeta privada (`privado/`, en `.gitignore`).
2. Volcar los actores vigentes de la base a un JSON privado, con sus ids reales.
3. Construir `public/data/actores.json`: industria, subindustria, por qué, necesidad, ruta sugerida, eventos con fecha parcial, horizonte, gremios asociados.
4. Reescribir por qué, necesidad y qué hace en lenguaje claro (2 o 3 frases, siglas explicadas), conservando la frase original en otro campo.
5. Cargar los contactos en una colección propia de la base con un script que por defecto solo simula.
6. Pruebas: ids únicos, industrias válidas, sin nombres excluidos, sin fechas pasadas, sin claves de contacto.

**Lecciones:**

- Reutilizar los ids que ya usa la base; crear ids nuevos rompe votos, fichas y rutas.
- Definir de entrada cómo tratar fechas sin día («abril», «1T 2027») y actores con dos horizontes; Codex se detuvo por ambas.
- Los textos técnicos del informe no sirven a los participantes; desde el inicio, pedir una versión en lenguaje claro.
- No poner calificativos que la fuente no respalda («uno de los más grandes»).
- Revisar los textos importados del Radar: traían congresos ya pasados.

### 2. Portada y barra narrativa (vigente)

**Para qué:** reemplazar la presentación de apertura y dar una navegación «Actividad X de 5» entre las herramientas.

**Información necesaria:** la presentación del taller (objetivos, propuesta de valor, metodología, equipo), logos, imágenes y el orden y nombre de cada actividad.

**Paso a paso:**

1. Pasar el contenido de la presentación a `landing-config.json` (nada escrito a mano en el HTML).
2. Construir la portada y la barra con anterior/siguiente, selector en celular y rutas por hash (`#actividad-3`).
3. Exportar las diapositivas a imagen para reproducir su línea gráfica.
4. Probar navegación, atrás/adelante y arranque directo en cualquier actividad.

**Lecciones:**

- Las pestañas llevan el nombre y el orden de la actividad del taller, no el nombre de la herramienta.
- Leer la configuración con `cache:'no-store'`; si no, el navegador muestra nombres viejos.
- Para exportar diapositivas en Mac funcionó: PowerPoint por AppleScript a PDF dentro de su contenedor y luego `pdftoppm`; Keynote y la exportación directa a PNG fallaron.
- `python-pptx` puede no estar instalado: el .pptx se lee como zip + XML.

### 3. Entrada por lista de asistentes, roles e informe PDF (vigente)

**Para qué:** que solo entren los asistentes, identificar a cada uno sin pedir contraseña y dar al administrador un informe PDF.

**Información necesaria:** lista de participantes y de administradores con nombre y apellido; aviso legal; qué secciones debe tener el informe.

**Paso a paso:**

1. `asistentes-config.json` con participantes y administradores.
2. Entrada por nombre: coincidencia de 2 palabras, sin tildes ni mayúsculas; comprobar que ningún nombre sea ambiguo.
3. Si el nombre no aparece, volver a leer la lista una vez antes de rechazarlo.
4. Botón del PDF solo para administradores, generado en el navegador (jsPDF local, sin servicios).

**Lecciones:**

- El filtro y el rol solo ordenan el taller; no protegen datos. Decirlo por escrito.
- Después de agregar a alguien, probar en una pestaña nueva: la abierta tenía la lista vieja.
- Si la lista cambia, actualizar también el número de participantes en las pruebas.
- El PDF depende del embudo: cada vez que cambia una actividad, revisar `informe.js`.

### 4. Actividad 1 · Alinear el juego (vigente)

**Para qué:** recoger en 15 minutos la visión de los participantes por horizonte de tiempo.

**Información necesaria:** la pregunta guía, las preguntas por horizonte y la definición exacta de cada horizonte (en Olivia cambió de 2026/2028/2030 a Q4-2026, Q1-2027 y año 2027).

**Paso a paso:**

1. Una ficha por horizonte, mostrada de a una; un campo y una lista de respuestas por pregunta, con ids estables (`corto-1`…).
2. Guardar cada respuesta con horizonte y pregunta; validar que la pregunta corresponda al horizonte.
3. Pestaña de resultados con una nube de palabras por horizonte, calculada en el navegador.
4. Excluir palabras vacías (artículos, conectores, todas las preposiciones) y el nombre del cliente.

**Lecciones:**

- El agrupamiento semántico con la API de Claude se construyó y se borró: no había clave. Confirmar claves y servicios antes de construir, y eliminar la función si falta.
- La primera versión (tres columnas a la vez) se cambió por fichas secuenciales tras un boceto a mano: pedir el boceto antes.
- Escalar el tamaño de la nube entre la frecuencia mínima y la máxima; con la fórmula simple, si todas empatan, todas salen enormes.
- Ante «Failed to fetch», confirmar primero si la persona está en local o en producción.
- Si los horizontes cambian, no renumerar los ids de las preguntas.

### 5. Actividad 2 · Radar 360 (vigente)

**Para qué:** mostrar el universo de actores en 4 categorías y dejar que cualquier participante agregue actores en vivo, sin cuenta.

**Información necesaria:**

- Lista semilla de actores por categoría, con estado (verificado o por validar) y fuente.
- Logos oficiales de cada actor.
- Ficha por sector y, para competidores, sus productos y servicios con fuentes oficiales.
- Agrupación de sectores acordada con el equipo (en Olivia cambió dos veces).

**Paso a paso:**

1. Cargar los actores en la base, un registro por actor (clave = id).
2. Vista de mapa por categoría y sector, vista de gestión (tabla editable) y vista de competidores.
3. Ficha del actor al hacer clic: qué hace, relevancia, articulación y, desde el reenfoque, por qué, necesidad, contacto sugerido con confianza y contactos registrados.
4. Botón «+ Agregar contacto» visible en cada tarjeta, con aviso de uso y borrado posterior.
5. Nota «universo por completar» calculada en vivo.

**Lecciones:**

- Claude Artifacts no sirve para edición pública: `db` y `assets` son internos de la organización y el menú de compartir no tiene «cualquiera puede editar». Se perdió un día en dos intentos.
- Un registro por actor, nunca un arreglo único: con el arreglo, 1 de 5 altas simultáneas se perdió.
- Netlify Blobs necesitaba `consistency: "strong"`; un cambio se veía revertido en la lectura siguiente.
- El bloque de contexto regional se construyó y se retiró porque rompía la dinámica: validar con el facilitador si un contenido ayuda o distrae.
- No mostrar en pantalla contactos, niveles de confianza ni vías de entrada por personas de la red de los socios.
- Muchos sitios oficiales bloquean la descarga automática (403/404); usar búsqueda de prensa y declararlo.

### 6. Matriz cliente–necesidad–respuesta (retirada el 1 de octubre)

**Para qué era:** una tabla editable con cliente, necesidad crítica, respuesta de Olivia, punto de contacto y ruta de entrada; un campo «trigger» marcaba qué pasaba al Canvas.

**Información necesaria:** las tablas de cuentas del informe (en Olivia, 48 cuentas del capítulo 2), sin el horizonte, que se produce en el taller.

**Paso a paso (como se hizo):** precargar las 48 filas; tabla con edición en línea y respaldo JSON; sugerir actores del Radar con un `datalist`, sin crear filas automáticamente.

**Por qué se retiró:** exponía contactos, niveles de confianza y vías de entrada por personas de la red de los socios, a la vista de asistentes que eran esas mismas personas. Sus datos siguen alimentando el contexto de otras actividades.

**Lecciones:**

- Separar desde el diseño los datos de trabajo interno (contactos, confianza, vías) de lo que ven los participantes.
- Un campo «trigger» manual entre herramientas se vuelve frágil; es mejor un paso automático con reglas.
- Para el SQL que pega una persona en el editor de Supabase: líneas cortas y sin bloques largos; el editor cortó líneas y falló.

### 7. Voto de gremios por plazo 3/2/1 (retirada el 25 de septiembre)

**Para qué era:** cada participante votaba el horizonte de activación de cada gremio (3 corto, 2 mediano, 1 largo) y un gráfico mostraba el promedio.

**Paso a paso (como se hizo):** colecciones `gremios-votos` (un registro por voto: gremio + votante) y `gremios-taller` (gremios agregados en vivo); tarjetas de votación y gráfico de resultados.

**Por qué se retiró:** el equipo pidió un solo embudo para empresas y gremios; el voto por plazo dejaba a los gremios en un camino aparte.

**Lecciones:**

- Validar con el facilitador cómo encaja cada actividad en el embudo antes de construir un mecanismo propio.
- El patrón «un registro por voto, clave = actor + votante» funcionó y se reutilizó en la Actividad 4.
- Al retirar una función, dejar sus colecciones como histórico y su HTML inerte en una plantilla, para no romper otras partes.

### 8. Activación Sí/No (retirada el 1 de octubre)

**Para qué era:** primer filtro del embudo; cada participante votaba Sí (2) o No (1) por empresa y gremio, y se activaban los de promedio 1,5 o más.

**Paso a paso (como se hizo):** colección `activacion-votos`, umbral en `embudo-config.json`, reglas puras en `embudo.js`, listas de activados con CSV.

**Por qué se retiró:** el cliente pidió foco (máximo 10 actores) y trabajo en parejas; votar los 75 actores uno por uno no reducía lo suficiente.

**Lecciones:**

- Poner umbrales y reglas en archivos de configuración permitió ajustarlos sin tocar código.
- Antes de diseñar un filtro, preguntar cuántos actores deben salir al final; en Olivia la respuesta (10) llegó tarde.

### 9. Actividad 3 · Tier list en parejas (vigente)

**Para qué:** que parejas sorteadas ordenen los actores de sus industrias en 4 niveles y elijan máximo 3 para el Nivel 1.

**Información necesaria:** lista de participantes que entran al sorteo (los administradores facilitan); industrias y qué actores pertenecen a cada una; máximo por nivel superior; colores de cada nivel (en Olivia, de la paleta del cliente).

**Paso a paso:**

1. Módulo puro `tierlist.js`: formar parejas (trío si es impar), repartir 2 o 3 industrias por grupo cubriendo todas, actores por grupo (incluye gremios asociados), límite del Nivel 1.
2. Colecciones `parejas` (sorteo vigente) y `tierlist` (una fila por actor y grupo, para que dos personas no se pisen).
3. Panel del administrador: marcar presentes, «Sortear parejas», «Iniciar actividad»; el sorteo no se repite después de iniciar.
4. Tier list vertical: una fila por nivel con etiqueta de color a la izquierda y bandeja «Sin clasificar» debajo; arrastrar con el mouse y botones 1–4 y «×» en todos los dispositivos.
5. Refresco cada 5 segundos y resumen «Nivel 1 de todos los grupos».

**Lecciones:**

- Pedir el diseño con una imagen de referencia: el tier list se pidió horizontal en el plan y se cambió a vertical después.
- Con menos de 3 grupos no alcanzan 3 industrias por grupo: definir la regla para grupos pequeños.
- Tarjetas compactas desde el inicio; en celular, con 29 actores, la bandeja se volvía eterna.
- Al retirar HTML de la versión anterior, proteger las funciones que buscaban esos elementos; Codex se detuvo por eso.
- Un aviso que se borra con el refresco automático no se ve: guardarlo en el estado unos segundos.

### 10. Actividad 4 · Priorización impacto–esfuerzo y corte en 10 (vigente)

**Para qué:** calificar los actores del Nivel 1, ubicarlos en 4 cuadrantes y dejar pasar máximo 10.

**Información necesaria:**

- Criterios de impacto y de esfuerzo con sus pesos (en Olivia, 5 + 5 de la metodología Esenttia, adaptados por German), escala y umbral.
- Nombre y regla de cada cuadrante.
- Regla de orden para el corte y máximo de actores.

**Paso a paso:**

1. `priorizacion-criterios.json` con criterios, pesos, escala, umbral, cuadrantes y corte.
2. Formulario de calificación por actor; un registro por actor y votante.
3. Índices ponderados y cuadrante calculados en la capa de datos; gráfico de cuadrantes con clic que abre la ficha.
4. Módulo `corte.js`: orden por cuadrante, mayor impacto, menor esfuerzo y grupos que lo eligieron; línea de corte; validación de máximo 10.
5. Subpestaña «Corte final»; confirmar la lista es opcional: si nadie confirma, pasan los 10 primeros solos.

**Lecciones:**

- Los criterios fueron el bloqueante real: pedirlos por escrito antes de construir.
- Calificar ~95 actores con 10 criterios no cabe en 45 minutos; filtrar antes (lo resolvió el tier list).
- El plan decía «ordenar por puntaje» pero no había un puntaje único: definir la regla de orden y dejarla en configuración.
- El paso a la Actividad 5 se diseñó manual y el cliente lo pidió automático; por defecto, que pase solo.
- Los rótulos de los cuadrantes inferiores quedaban tapados por los puntos: ubicarlos al fondo del cuadrante.

### 11. Canvas de modelo de negocio y ruta a 30/60/90 días (retirada el 1 de octubre)

**Para qué era:** un canvas por oportunidad con oferta, aliado impulsor, comprador, patrocinador, llamado a la acción y acciones a 30, 60 y 90 días, con hoja consolidada y CSV.

**Paso a paso (como se hizo):** colección `canvas` con ids `aliado:<id>` y `empresa:<id>`; ficha de aliado y canvas de empresa; solo entraban los activados que quedaban en los dos cuadrantes altos.

**Por qué se retiró:** el cliente pidió horizontes por trimestre (Q4-2026, Q1-2027, 2027), responsable por actor y la distinción venta inmediata / posicionamiento; buyer, sponsor y CTA no aportaban en vivo.

**Lecciones:**

- Confirmar con quien decide (el cliente) los horizontes y campos antes de construir; el equipo interno no siempre los conoce.
- Una ruta automática a 90 días se construyó y se eliminó: no generar contenido que el grupo debe decidir.

### 12. Actividad 5 · Ruta de acción por actor (vigente)

**Para qué:** que el grupo defina, para cada actor priorizado, qué aporta Olivia, responsable, etiqueta y acciones por trimestre.

**Información necesaria:** horizontes, campos obligatorios, opciones de etiqueta, aristas de posicionamiento y lista de posibles responsables.

**Paso a paso:**

1. Módulo `rutas.js`: validación (etiqueta y responsable obligatorios, aristas solo con «Posicionamiento»), tarjeta de contexto y hoja consolidada.
2. Ruta `lista-rutas`: lista confirmada o, si no hay, la automática del corte, con el resultado del taller por actor.
3. Formulario a la izquierda y tarjeta de contexto a la derecha (arriba y plegable en celular): qué hace, por qué se priorizó, necesidad, ruta sugerida, contacto de entrada en rojo con confianza, contactos registrados.
4. Colección `rutas`, un registro por actor; hoja consolidada con CSV.

**Lecciones:**

- Los nombres de ruta del adaptador solo aceptan letras y guiones: `lista-actividad5` no funcionó.
- Los borradores se guardan al escribir; recolectarlos otra vez al cambiar de actor marcaba como «sin guardar» lo ya guardado.
- Los participantes necesitan contexto en lenguaje claro para decidir; la frase del informe no basta.

### 13. Empresa Foco (aplicación aparte)

**Para qué:** panel de inteligencia de mercado sobre la red de una empresa (accionistas, directivos, proveedores, conexiones y puentes regionales) para su entrada a un país.

**Información necesaria:** especificación de funciones, fuentes públicas permitidas, periodicidad de actualización y reglas de validación humana.

**Paso a paso (como se hizo):** reencuadre del spec de «cumplimiento» a «inteligencia de mercado»; protocolo para levantar información OSINT; código de referencia; app publicada como Artifact con persistencia; carga de fichas desde PDF.

**Lecciones:**

- Un guardado fallido nunca debe simular éxito local: generó fichas fantasma imposibles de borrar.
- No usar `confirm()` ni `alert()` del navegador: dentro de un Artifact no se muestran.
- Validar con un archivo real cualquier librería cargada desde un CDN que no se pudo verificar.

## Lecciones transversales

La mayoría de los reprocesos no vinieron del código sino de decisiones que llegaron tarde: plataforma, criterios, número final de actores y horizontes. Estas lecciones aplican a cualquier herramienta.

| Tema | Qué pasó en Olivia | Qué hacer |
| --- | --- | --- |
| Decisiones del cliente | El foco en 10 actores y los horizontes trimestrales llegaron el 30 de septiembre y obligaron a rehacer 3 actividades | Reunión con quien decide antes del primer handshake: cuántos actores al final, horizontes, campos de salida |
| Plataforma | Se perdió un día con Claude Artifacts y luego Netlify bloqueó los despliegues por créditos | Arrancar con GitHub Pages + Supabase (gratis, sin créditos por despliegue, edición pública) |
| Concurrencia | Con un arreglo único se perdieron altas simultáneas | Un registro por elemento y por votante; nunca leer-modificar-escribir una lista completa |
| Datos sensibles | Contactos y vías de entrada quedaron visibles con el enlace | Contactos fuera del repositorio, en colecciones propias que se exportan y borran después del taller |
| Seguridad | La base es de escritura pública; el filtro de entrada solo ordena | Declararlo por escrito; respaldo antes de cada sesión; autenticación real si los datos lo exigen |
| Cambios en cadena | Cada cambio de embudo afectó la actividad siguiente y el PDF | Inventario de qué lee cada actividad; módulos puros con pruebas; un ajuste a la vez sobre el archivo principal |
| Pruebas visuales | Codex no pudo abrir Chrome en 6 sesiones; Chrome headless no baja de 500 px | Las pruebas visuales las hace Claude con el navegador real; el celular se mide con un iframe de 390 px |
| Caché | Pruebas fallidas por versiones viejas (GitHub Pages guarda 10 minutos) | Probar en pestaña nueva; repetir la consulta 1 o 2 minutos; leer configuración con `no-store` |
| Borrados | Un borrado con comodín se llevó datos previos sin respaldo | Respaldo antes de borrar; borrar por id exacto o por colección completa |
| Permisos | El clasificador bloqueó commits y `git push` | Pedir permisos al inicio; la persona responsable publica con `!` |
| Codex | Se detuvo por ambigüedades, retomó el hilo equivocado con `--resume` y agotó su cuota | Encargos autocontenidos con reglas para casos borde; relanzar con `--fresh`; plan B: desarrolla Claude Code |
| Funciones sin servicio | Se construyó un agrupamiento con API sin clave disponible | Confirmar claves y costos antes; si falta, no construir la función |
| Contenido | Textos técnicos, fechas pasadas y calificativos sin fuente | Lenguaje claro desde el inicio; prueba automática de fechas y nombres excluidos |

El patrón que más ahorró retrabajo fue separar las reglas (módulos puros y JSON de configuración) de la interfaz: así cambiar un umbral, un orden o un horizonte no exigió tocar código de pantalla.

## Mecanismos para ahorrar tokens

El mayor ahorro está en no rehacer: cada reproceso de Olivia costó más tokens que cualquier optimización de lectura. Por eso los primeros mecanismos son de planificación y los siguientes de ejecución.

**Antes de desarrollar**

1. **Cerrar las decisiones del cliente primero.** Una pregunta a tiempo («¿cuántos actores deben salir?») evita reconstruir actividades enteras.
2. **Handshake y handoff en cada bloque.** La sesión siguiente arranca leyendo un handoff de 7 a 15 KB, no la conversación completa.
3. **Memoria del proyecto.** Guardar dónde vive el dato, qué se decidió y qué falló; evita redescubrir cada sesión.
4. **Inventario del código una vez.** Un archivo (`docs/inventario-actividades.md`) con qué bloque implementa cada actividad evita releer un `index.html` de 3.500 líneas.

**Al leer**

5. **Extraer, no leer completo.** Convertir el informe .docx a Markdown una vez y consultarlo por secciones; leer solo «Objetivo» e «Intentos fallidos» de los handoffs con `awk`; buscar con `grep` en vez de abrir archivos grandes.
6. **Volcados filtrados.** Al consultar la base, pedir solo las columnas necesarias y resumir con un script (conteos, campos), no imprimir los 230 registros.
7. **No releer lo que se acaba de editar.** Las herramientas de edición fallan si el cambio no se aplica.

**Al delegar y desarrollar**

8. **Encargos autocontenidos a Codex.** Codex gasta su cuota, no la de Claude; un encargo con contexto, archivos permitidos, reglas de casos borde y pruebas exigidas evita idas y vueltas.
9. **Lanzar en segundo plano y esperar la notificación.** No consultar el estado repetidamente.
10. **Cambios con scripts de reemplazo verificados.** Un script de Python con aserciones que cambia varios puntos en una sola llamada, en vez de muchas ediciones pequeñas.
11. **Reglas en módulos y JSON.** Ajustar un umbral o un orden es editar una línea de configuración, no regenerar código.
12. **Un comando de pruebas filtrado.** Mostrar solo el resumen (pasan / fallan) y, si falla, solo el error.

**Al probar en navegador**

13. **Leer con JavaScript antes que con capturas.** Un `innerText` o un conteo cuesta mucho menos que una imagen; capturar solo lo que la persona debe ver, a media escala cuando basta.
14. **Datos de prueba por API.** Sembrar sorteos y calificaciones con `fetch` desde la página, no con clics uno por uno.
15. **Llamadas cortas.** Esperas largas en una sola llamada agotan el tiempo y obligan a repetir.

**Lo que no conviene recortar:** el recorrido en navegador antes de publicar, la revisión del diff y las pruebas automáticas. En Olivia detectaron fallos que habrían llegado a la reunión con el cliente.

## Arranque de un proyecto nuevo

Con esta lista, un proyecto nuevo puede tener la base técnica lista el primer día y dedicar el resto al contenido y a las actividades.

**Decisiones con el cliente (día 0)**

- [ ] Quién decide si el equipo no coincide
- [ ] Cuántos elementos deben salir al final del embudo
- [ ] Horizontes de tiempo y campos de la salida final
- [ ] Qué datos son sensibles y quién puede verlos
- [ ] Lista de asistentes, administradores y facilitadores
- [ ] Fuente de contenido definitiva (informe, base de actores, criterios de calificación)
- [ ] Paleta y línea gráfica del cliente

**Base técnica (día 1)**

- [ ] Repositorio en GitHub con publicación automática de `public/` en GitHub Pages
- [ ] Proyecto en Supabase con la tabla `registros (coleccion, id, data)` y la lista de colecciones permitidas
- [ ] Adaptador `api-supabase.js` y archivo de configuración con la clave pública
- [ ] Carpeta `privado/` en `.gitignore` para informe, contactos y encargos
- [ ] Permisos de Claude Code para git y gh; acordar quién publica
- [ ] Comprobar que Codex responde (`codex exec "Responde solo: ok"`) y su cuota

**Por cada herramienta**

- [ ] Ficha con insumos, salida y qué lee de la herramienta anterior
- [ ] Handshake cerrado, con boceto o imagen de referencia del diseño
- [ ] Encargo autocontenido con reglas de casos borde y pruebas exigidas
- [ ] Revisión del diff, pruebas en verde y recorrido en computador y celular
- [ ] Respaldo de la base antes de borrar datos de prueba
- [ ] Publicación, verificación en pestaña nueva y handoff

**Antes del taller**

- [ ] Borrar datos de prueba y revisar que Supabase no esté pausado
- [ ] Respaldo completo antes y después del taller
- [ ] Recorrido en computador, celular y proyector; probar la conexión del lugar
- [ ] Procedimiento para exportar y borrar contactos después del taller

**Plantilla de encargo para Codex** (secciones mínimas, en este orden):

```markdown
# Encargo X · <nombre del ajuste>
Rama, archivos permitidos, qué no tocar, sin red, sin commit.
## Contexto: qué leer primero (inventario, módulos, datos)
## Lo que hay que construir: módulo puro, rutas de datos, interfaz, estilos
## Reglas y casos borde: fechas, vacíos, límites, permisos
## Pruebas exigidas
## Comprobación antes de terminar: comando de pruebas
## Informe final: archivos, decisiones propias, pruebas cambiadas y por qué
```

**Comandos de uso frecuente**

| Para qué | Comando |
| --- | --- |
| Lanzar Codex | `node <plugin>/codex-companion.mjs task --write --fresh --prompt-file privado/encargo-X.md` |
| Correr pruebas | `node --test tests/*.test.mjs` (excluir pruebas históricas rotas) |
| Servir en local | `python3 -m http.server 8765` dentro de `public/` |
| Publicar | `git switch main && git merge --ff-only <rama> && git push origin main` |
| Ver el despliegue | `gh run list --limit 1` y `curl` al archivo con `?v=$RANDOM` |
