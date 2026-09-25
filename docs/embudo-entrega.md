# Embudo de activación y rutas de acción · 25 de septiembre de 2026

Implementación local del plan `Handshakes/07_EmbudoPriorizacion_Ajustes_plan.md`, leído completo, con las ocho decisiones posteriores de Felipe. Sin commit, push, SQL ejecutado, escrituras a producción ni llamadas a APIs externas. El volcado previo se leyó sin modificarlo; los cambios de prueba se hicieron en memoria.

## Resultado

- Actividad 3: exactamente cuatro subpestañas: **Calificación de empresas**, **Empresas activadas**, **Calificación de gremios-aliados**, **Gremios-aliados activados**. Contexto de Matriz o §3.2/Radar, voto Sí/No, cambio y retiro, actualización cada intervalo del sitio, listas activadas con promedio, votos y estado; CSV por grupo.
- Actividad 4: solo actores activados y no descartados. Incluye actores ocultos del dibujo del Radar, porque ocultar no equivale a descartar. Filtros Empresas / Gremios-aliados. Estado vacío explicativo. `provisional:false`, sin cambiar criterios, pesos, umbral ni cuadrantes.
- Actividad 5: **Ruta de acción · Aliados** y **Ruta de acción · Empresas**. Modalidad grupal con German/Julio, nombre opcional, sello del último guardado. Entrada por los dos cuadrantes altos y activación vigente. Ficha de aliados con qué ofrece, aporte Olivia y acciones; canvas de empresas con contexto, oferta editable, aliado impulsor elegible, buyer, sponsor, CTA y acciones. Hoja consolidada y CSV independientes en cada pestaña.
- Landing: solo se actualizó el bloque `actividades`, entradas 3–5. Se conservaron los otros bloques y las actividades 1–2.

## Archivos creados

- `public/embudo.js`: funciones puras compartidas por vistas, adaptador y pruebas; grupo, cruce de contexto, promedio, activados, elegibilidad, ficha y CSV.
- `public/embudo-config.json`: umbral y comparación de activación.
- `supabase/agregar_activacion_votos.sql`: migración manual con líneas cortas.
- `tests/embudo-support.mjs`: Supabase en memoria y DOM mínimo; no permite URLs de producción.
- `tests/embudo.test.mjs`: activación, filtros, vistas y recorrido con volcado real.
- `tests/embudo.browser.mjs`: recorrido y comprobación de temas/ancho de 390 px en iframe con todas las solicitudes interceptadas.
- `docs/embudo-entrega.md`: esta entrega.

## Archivos modificados

- `public/index.html`: Actividades 3–5, conserva navegación central `vista:activar` y hashes; inicia el embudo perezosamente. El código histórico de gremios sigue presente e inerte.
- `public/api-supabase.js`: activación, validación de calificaciones activadas, nuevo canvas y campos de contexto del POST de actor aliado. Las demás rutas siguen con su comportamiento anterior.
- `public/priorizacion-criterios.json`: únicamente `provisional:false`.
- `public/canvas-config.json`: conserva los dos cuadrantes elegibles; retira reglas automáticas de ruta, umbral histórico de gremios y exclusiones superadas.
- `public/landing-config.json`: bloque actividades 3–5.
- `supabase/schema.sql`: incorpora la colección para instalaciones nuevas.
- `netlify/functions/gremios-votos.js` y `gremios-taller.js`: solo comentarios OBSOLETO, sin borrar la implementación histórica.
- `tests/canvas.test.mjs`: reemplaza el contrato anterior por la validación por actor y acciones independientes.
- `docs/actividad5.md`: referencia vigente al nuevo contrato.

## SQL exacto · ejecutar manualmente antes de usar los nuevos votos

No se ha aplicado. Está también en `supabase/agregar_activacion_votos.sql`. No contiene bloques DO. Se conserva el CHECK de las ocho colecciones existentes y se agrega la novena, en una transacción.

```sql
begin;
alter table public.registros
drop constraint if exists registros_coleccion_check;
alter table public.registros
add constraint registros_coleccion_check
check (coleccion in (
  'actors',
  'matriz',
  'ideas',
  'ideas-sintesis',
  'gremios-votos',
  'gremios-taller',
  'priorizacion-votos',
  'canvas',
  'activacion-votos'
));
commit;
```

El nombre del CHECK corresponde al esquema suministrado. Actualizar `schema.sql` no migra una tabla existente.

## Contenido completo de embudo-config.json

```json
{
  "umbral": 1.5,
  "inclusivo": true,
  "nota": "Umbral configurable. Sí = 2 y No = 1. Con promedio mayor o igual a 1,5 se activa: al menos la mitad de los votos son Sí. Sin votos no se activa."
}
```

`inclusivo:true` usa ≥; `false` usa >. Se compara sin redondear. El promedio mostrado puede redondearse a tres decimales; los CSV conservan el valor calculado. El umbral debe estar entre 1 y 2. Sin votos siempre queda inactivo. Configuración y votos se consultan durante las actualizaciones, sin recompilar el sitio.

## Emparejamiento Matriz ↔ empresas

Universo: actores `categoria:'mercados'`, `estado !== 'descartado'`. El respaldo contiene **48 empresas vigentes**, todas con contexto, correspondientes a **44 filas** de la Matriz. La fila restante del Radar en mercados (DS Consulting) está descartada y no entra.

Primero se compara nombre en minúsculas, sin tildes, con extremos recortados y sin espacios antes de `%`. Esto resuelve también:

| Radar | Matriz |
|---|---|
| Ecopetrol (Nación 88,5%) | Ecopetrol (Nación 88,5 %) |
| Enel Colombia (Enel Américas 57,3% · GEB 42,5%) | Enel Colombia (Enel Américas 57,3 % · GEB 42,5 %) |
| Tuya (Cibest · 50% Bancolombia) | Tuya (Cibest · 50 % Bancolombia) |

Si no hay coincidencia por nombre, `Embudo.emparejamientos` usa esta tabla explícita, por ids estables:

| Actor del Radar | Fila Matriz | Nombre del contexto |
|---|---|---|
| `mercados-promigas` | `fila-cap2-14` | Promigas (grupos privados colombianos) |
| `mercados-tigo-millicom-integracion-de-movistar` | `fila-cap2-41` | Tigo (Millicom) – integración de Movistar Colombia |
| `mercados-keralty-colsanitas` | `fila-cap2-44` | Redes hospitalarias y aseguradores privados… |
| `mercados-sura` | `fila-cap2-44` | Redes hospitalarias y aseguradores privados… |
| `mercados-compensar` | `fila-cap2-44` | Redes hospitalarias y aseguradores privados… |
| `mercados-fundacion-santa-fe` | `fila-cap2-44` | Redes hospitalarias y aseguradores privados… |
| `mercados-fundacion-valle-del-lili` | `fila-cap2-44` | Redes hospitalarias y aseguradores privados… |

Nombre completo de la fila común: «Redes hospitalarias y aseguradores privados (Keralty–Colsanitas, Sura, Compensar, Fundación Santa Fe, Fundación Valle del Lili) — candidatos a explorar».

No se fabrican empresas a partir de filas de Matriz: ACOPI, Acodres, CCCE y Entidades territoriales quedan fuera de este grupo. Si se crea un mercado nuevo sin fila coincidente, la tarjeta advierte que falta contexto; no inventa un emparejamiento.

## Contratos

**Activación:** GET `/api/activacion-votos` lista; PUT reemplaza; DELETE retira el voto incluso si luego se descarta el actor. Registro por clave `<actorId>--<slug del votante>`, con `{actorId, grupo:'empresas'|'aliados', votante, valor:1|2, updatedAt}`. Se valida actor/grupo y nombre (máximo 60). Se normalizan tildes y mayúsculas para cambiar el voto de la misma persona. Identidad local en `activacion-votante`, con lectura inicial de `gremios-votante` si existe. El almacenamiento local bloqueado no impide votar.

**Calificación:** GET `/api/priorizacion-votos?resumen=1` conserva las mismas claves y tipos: `actorId, nombre, categoria, sector, indiceImpacto, indiceEsfuerzo, cuadrante:{id,nombre}, votos`. Ahora excluye actores fuera de la activación vigente. Los votos históricos se conservan en la colección y vuelven a participar si se reactiva al actor. PUT comprueba activación; DELETE permite retirar la calificación histórica. Se mantiene la clasificación antes del redondeo.

**Canvas:** se reutiliza la colección existente. Id `aliado:<actorId>` o `empresa:<actorId>`; campos `actorId, grupo, nombre, sector, problema, oferta, queOfrece, aporteOlivia, acciones30, acciones60, acciones90, aliado:{id,nombre}|null, buyer, sponsor, cta, editadoPor, updatedAt`.

El adaptador valida que el actor exista, no esté descartado, pertenezca a mercados/aliados y coincidan grupo/prefijo. No depende de Matriz.trigger. Nombre, sector y problema se obtienen del actor/contexto, y la oferta se guarda como edición grupal. Los campos narrativos y acciones aceptan hasta 4000 caracteres; buyer/sponsor 300; CTA 1000; registrado por 60, opcional. El aliado impulsor se comprueba contra los aliados activados de los cuadrantes altos.

La interfaz filtra y revalida la elegibilidad de la ficha inmediatamente antes del PUT. La validación básica de PUT para la ficha es actor vigente, según la decisión 7; la entrada al ejercicio la gobierna la interfaz. No es un sistema de permisos o autenticación.

## Interpretaciones y elementos obsoletos

- Se conserva un desplegable **Consultar o editar el contexto de empresas · Matriz** dentro de Calificación de empresas. Conserva las ediciones y respaldo JSON. Las cinco fichas de Salud comparten contexto. El trigger histórico se rotula «Marca histórica (sin efecto)»; no activa ni habilita canvas.
- El voto 3/2/1 y `gremios-taller` están marcados **OBSOLETO** en JS/adaptador/funciones históricas. No se inicializa su sondeo ni se muestran sus pestañas. Su HTML permanece en un `template` inerte. No se borran sus datos ni código.
- Los 19 registros `GREMIOS_32` siguen como contexto, enlazados por actorId. Los aliados que no estén en esa lista usan descripción/relevancia del Radar; los nuevos usan contacto/cuentas/oferta del POST de actor.
- «Qué ofrece» conserva el contenido de «qué ofrecer» de §3.2, según la decisión suministrada; no se inventaron capacidades diferentes del aliado. Se rotula con contexto de la alianza para evitar cambiar el sentido del texto fuente.
- `ruta90`, `rutaAuto`, horizonte automático y umbral 2,5 de gremios se retiran del modelo vigente. No se reparte automáticamente un texto antiguo en tres acciones: los facilitadores acuerdan 30/60/90. El respaldo tiene cero canvas. Si aparecieran registros antiguos, se conservan y la vista avisa de su existencia; no se migran sin correspondencia fiable.
- Una ficha que salga del embudo sigue en la hoja y en el CSV con estado «Fuera del embudo». No se puede seguir editando desde la vista hasta que vuelva a ser elegible. Los borradores se conservan en memoria durante el sondeo, no después de recargar la página. El último guardado explícito prevalece.
- La hoja consolidada usa las instantáneas guardadas. Las tarjetas muestran contexto vigente y conservan oferta/acciones editadas. Esto evita alterar silenciosamente una hoja ya acordada.
- No había grafo graphify en el proyecto; se revisaron directamente fuentes, contratos y referencias locales. No se construyó un grafo adicional ni se usaron servicios externos.

## Validación efectuada

```sh
node --test tests/embudo.test.mjs tests/canvas.test.mjs tests/landing.test.mjs
node --experimental-vm-modules --test tests/*.test.mjs
node --check public/api-supabase.js
node --check public/embudo.js
node --check tests/embudo.browser.mjs
```

**24 pruebas aprobadas** en la suite completa, sin omisiones en este entorno. Las seis pruebas históricas de Netlify necesitan la bandera `--experimental-vm-modules`; las 18 actuales se ejecutan con `node --test` normal.

También se extrajo el script principal de `index.html` a `/tmp/olivia-main.js` y pasó `node --check`. `git diff --check` pasó. Se comparó el HTML de Actividad 1, Radar e Inicio con el respaldo previo y se verificó que la configuración de landing fuera del bloque actividades es idéntica a HEAD. Los criterios son idénticos al respaldo salvo `provisional`.

Pruebas cubiertas: voto único/cambio/retiro, valor inválido, igualdad exacta 1,5 y comparación estricta, sin votos, categorías excluidas, universo vigente H4 y sus filtros, contrato del resumen, cuatro cuadrantes y entrada alta H5, nuevos actores aliados, contexto de las 48 empresas reales, recorrido 3→4→5, ficha de aliados y canvas empresarial, nombre opcional, acciones independientes, límites/tipos, aliado no elegible, CSV protegido, paginación y borradores durante sondeo.

## Pendientes externos y fases futuras del plan

1. **Aplicar el SQL y publicar:** no se ejecutaron por instrucción expresa. No hay commit ni push.
2. **Medición visual:** Chrome y Brave terminan con código 134; Puppeteer también falla al lanzar Chrome. No se afirma una validación visual ni ausencia medida de desborde. Los estilos usan variables de tema y anchos limitados. `tests/embudo.browser.mjs` queda preparado para recorrido con datos del respaldo, claro/oscuro y un iframe real de 390 px; intercepta todas las solicitudes y no accede a producción. Requiere Puppeteer ya instalado y un navegador que pueda iniciar; no se instalaron servicios ni dependencias nuevas.
3. **Limpieza antes del 6 de octubre:** las pruebas locales no dejaron datos persistentes. No se borró la idea/calificación de prueba preexistente en producción porque se prohibieron escrituras.
4. **Fase 7 — taller del 6 de octubre:** la facilitación con German/Julio y la comprobación en el lugar son actividades futuras; el código no sustituye esa ejecución humana.
