# Actividad 5 — De cuenta priorizada a oportunidad comercial

Implementada como una nueva vista del archivo único `public/index.html`, con Canvas por oportunidad y Hoja de ruta a 90 días. No se ejecutó SQL, no se llamó a producción ni a APIs externas y no se hizo commit ni push.

## Archivos

Modificados:
- `public/index.html`: navegación, estilos aislados, dos subpestañas, nombre local, tarjetas, aliado, guardado explícito, sondeo y CSV.
- `public/api-supabase.js`: ruta canvas GET/PUT/DELETE; las otras rutas quedan iguales.
- `supabase/schema.sql`: agrega canvas al CHECK para instalaciones nuevas.

Creados:
- `public/canvas-config.json`: fuente única de elegibilidad y rutas provisionales.
- `supabase/agregar_canvas.sql`: migración manual para la tabla existente.
- `tests/canvas.test.mjs`: pruebas locales con fetch simulado y DOM mínimo.
- `docs/actividad5.md`: esta entrega, con SQL y configuración completos.

`supabase/migrar_desde_netlify.py` no cambia: canvas nace en Supabase; no hay una colección histórica de Netlify que importar. No se tocaron las funciones históricas.

## SQL exacto para ejecutar manualmente

La migración encuentra el CHECK que afecta exclusivamente a coleccion. Si no existe uno solo, aborta sin retirar restricciones. La transacción conserva las siete colecciones anteriores y valida los registros existentes. Es repetible. Actualizar schema.sql por sí solo no modifica una tabla existente.

```sql
-- Ejecutar manualmente en el SQL Editor de Supabase. Transacción atómica y repetible.
BEGIN;
DO $$
DECLARE checks text[];
BEGIN
  SELECT array_agg(c.conname) INTO checks
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'coleccion'
  WHERE c.conrelid = 'public.registros'::regclass
    AND c.contype = 'c' AND c.conkey = ARRAY[a.attnum]::smallint[];
  IF coalesce(array_length(checks, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Se esperaba un único CHECK exclusivo de coleccion; revisar el esquema antes de migrar';
  END IF;
  EXECUTE format('ALTER TABLE public.registros DROP CONSTRAINT %I', checks[1]);
END $$;
ALTER TABLE public.registros ADD CONSTRAINT registros_coleccion_check
  CHECK (coleccion IN ('actors', 'matriz', 'ideas', 'ideas-sintesis',
    'gremios-votos', 'gremios-taller', 'priorizacion-votos', 'canvas'));
COMMIT;
```

## Contenido de canvas-config.json

```json
{
  "provisional": true,
  "nota": "Pendiente de validación con German (reunión 25 sep 2026)",
  "gremios": {
    "umbral": 2.5,
    "estricto": true
  },
  "cuadrantesElegibles": [
    "victorias-tempranas",
    "apuestas-estrategicas"
  ],
  "rutas": {
    "victorias-tempranas": {
      "horizonte": "30",
      "texto": "30 días: reunir al buyer y al sponsor con el aliado y presentar una propuesta de piloto con alcance, precio y responsable. 60 días: ejecutar el piloto y medir resultados acordados. 90 días: negociar la ampliación y cerrar el siguiente contrato."
    },
    "apuestas-estrategicas": {
      "horizonte": "60–90",
      "texto": "30 días: validar con el aliado el problema, el buyer, el sponsor y el proceso de compra. 60 días: acordar presupuesto, alcance y responsables de un piloto. 90 días: presentar la propuesta final y obtener una decisión de contratación."
    },
    "gremio": {
      "horizonte": "30",
      "texto": "30 días: acordar con el gremio una presentación a las cuentas objetivo y realizar una reunión con buyer y sponsor. 60 días: presentar una propuesta de piloto a las cuentas interesadas. 90 días: cerrar el primer piloto y acordar con el gremio cómo extenderlo a sus afiliados."
    }
  }
}
```

## Esquema de la colección canvas

Clave de public.registros: `(coleccion = 'canvas', id = matrizId)`.

```ts
{
  id: string;                 // id de la fila de Matriz, máximo 400
  matrizId: string;           // igual a id
  cliente: string;            // copia al guardar, tomada de Matriz
  sector: string;
  problema: string;           // necesidadCritica
  oferta: string;             // respuestaOlivia
  aliado: null | {
    tipo: 'actor' | 'gremio';
    id: string;              // máximo 400
    nombre: string;          // máximo 300
    cuadrante?: { id: string; nombre: string }; // actor, límites 80/100
    promedio?: number;       // gremio, entre 1 y 3
  };
  buyer: string;             // máximo 300
  sponsor: string;           // máximo 300
  ruta90: string;            // máximo 4000
  rutaAuto: boolean;
  cta: string;               // máximo 1000
  horizonte: '30' | '60–90' | null; // regla del config al guardar
  editadoPor: string;        // obligatorio, máximo 60
  updatedAt: string;         // ISO 8601, generado por el adaptador
}
```

GET /api/canvas devuelve un arreglo. PUT recibe id, matrizId, aliado, buyer, sponsor, ruta90, rutaAuto, cta y editadoPor; copia los datos de la Matriz y calcula horizonte. Rechaza filas inexistentes (404), sin trigger:true (400), nombres vacíos y campos fuera de los límites (400). DELETE recibe {id}; es idempotente. Un PUT reemplaza el canvas de esa oportunidad; el último guardado prevalece. Se documenta también dentro de details.tech en la interfaz.

## Decisiones y ambigüedades resueltas

- El plan del 24 de septiembre y la solicitud vigente resuelven los bloqueos del handoff del 15 de septiembre: los insumos ya tienen contrato y se hace un canvas por oportunidad.
- Un promedio exactamente igual a 2,5 NO habilita el gremio; `estricto:false` permite incluirlo. Se compara el promedio sin redondear. Se incluyen gremios fijos y agregados en vivo.
- Se usan los cuadrantes publicados por H4, sin recalcular ni duplicar sus pesos o umbral. Actor y Gremio mantienen identidades separadas incluso si comparten id.
- Se permiten guardados parciales sin aliado, buyer, sponsor u oferta. Así se conserva el trabajo del taller. Sin aliado, la hoja incluye el canvas en «Sin horizonte».
- La oferta se lee siempre de H3. La hoja usa datos vigentes de la Matriz; conserva una copia del último guardado como respaldo si se elimina la fila.
- Desmarcar o eliminar una oportunidad no borra su canvas: se conserva en la hoja, con aviso y columna «Trigger vigente» en CSV. No puede volver a guardarse hasta reactivar el trigger.
- Un aliado que deja de ser elegible se muestra como tal en el canvas; se exige elegir otro o dejarlo sin aliado antes de guardar desde la vista.
- La ruta manual no cambia al elegir otro aliado ni durante el sondeo. «Restablecer ruta automática» permite volver a aplicar la regla.
- horizonte se calcula desde el config al guardar y se conserva para agrupar la hoja, incluso si la ruta se ajustó manualmente. Cambiar la configuración no reclasifica retrospectivamente los canvas guardados; se aplica al siguiente guardado.
- Los borradores se conservan en memoria durante el sondeo (no sobreviven a una recarga). El nombre usa localStorage con try/catch y clave propia canvas-participante. Las respuestas de sondeo anteriores a un guardado se descartan para evitar que oculten su resultado.

## Validación

Desde Radar360-web:

```sh
node --test tests/canvas.test.mjs
node --check public/api-supabase.js
node -e 'const fs=require("fs");fs.writeFileSync("/tmp/olivia-main.js",fs.readFileSync("public/index.html","utf8").match(/<script>([\s\S]*?)<\/script>/)[1]);'
node --check /tmp/olivia-main.js
```

Resultado: 8 pruebas aprobadas. Incluyen CRUD, validaciones, copia desde H3, último guardado, paginación, sin triggers, sin aliados, 2,5 estricto/inclusivo, cuadrantes y rutas obtenidos mediante el fetch simulado de Supabase, edición manual, CSV con BOM y protección de fórmulas, y ejecución de la vista en un DOM mínimo (incluido localStorage bloqueado y borrador durante sondeo).

La prueba de regresión elimina únicamente los bloques nuevos H5 y su botón de navegación; el resultado es idéntico byte por byte al respaldo `Radar360-web-backups/index_20260924_pre-actividad5.html`. En un clon sin ese respaldo solo esa prueba se omite. Las Actividades 1–4 y Radar no se reescribieron.

La revisión estática confirma estilos con variables de tema, campos con ancho limitado, rejilla de una columna a menos de 600 px y navegación flexible. Se intentó una prueba visual a 390 px con Chrome y solicitudes interceptadas, pero el navegador no pudo arrancar en este entorno. Queda pendiente comprobar visualmente claro/oscuro y celular en navegador real; no se afirma haber validado el renderizado. El SQL se entrega para ejecución manual y no fue aplicado.
