# Entrega: Ruta Colombia - Olivia

Implementación local del plan 06. Sin commit, push, llamadas a Supabase ni APIs externas.

## Archivos

- Modificado `public/index.html`: nombre del sitio, landing inicial, render desde JSON, navegación compartida y CSS responsive con las variables existentes de ambos temas.
- Creado `public/landing-config.json`: cuatro bloques, objetivos y cinco actividades; `provisional: true` y aviso «Textos por confirmar con Felipe».
- Extraídas sin alterar de la presentación: `public/img/equipo/german-hillon.png` (slide 3, image5), `julio-raul-ochoa.png` (slide 4, image9), `felipe-hillon.png` (slide 5, image10).
- Modificado `tests/canvas.test.mjs`; creado `tests/landing.test.mjs`.
- Creado `tests/landing.browser.mjs`: recorrido opcional con Puppeteer y todas las solicitudes interceptadas. Requiere una instalación local de puppeteer-core mediante PUPPETEER_MODULE y Chrome. No se añadieron dependencias.

## Barra narrativa

Una sola barra sticky fuera de las vistas. En escritorio presenta Inicio y las cinco actividades numeradas con sus nombres, aria-current, estado y anterior/siguiente. Hasta 760 px muestra un selector nativo etiquetado, estado y botones separados en una fila. Tiene anchos flexibles, columnas minmax(0,1fr), ajuste de texto y controles de teclado nativos. El CSS se diseñó para 390 px; no se pudo medir el resultado en navegador en este entorno.

La función activarVista centraliza vista activa, selector, aria-current, límites, foco y URL. Utiliza #inicio y #actividad-1 a #actividad-5; hashchange y popstate permiten enlaces directos y atrás/adelante. Hash vacío o desconocido conduce a Inicio. Anterior queda deshabilitado en Inicio y Siguiente en la última actividad.

Se retiraron el manejador genérico de nav.views, los dos listeners de clic para las actividades 4 y 5 y todas las reglas CSS nav.views. Las actividades 4 y 5 escuchan vista:activar en sus propias secciones, después de hacerse visibles; mantienen su cargar(), guarda de inicio y sondeo. Las subpestañas no se modificaron.

## Validación

- JS inline extraído con Node y validado con node --check: aprobado.
- node --check public/api-supabase.js: aprobado; archivo sin modificar.
- node --test tests/canvas.test.mjs tests/landing.test.mjs: 11 aprobadas, ninguna omitida en este workspace.
- DOM simulado: Inicio, seis accesos, enlaces de landing, anterior/siguiente y límites, selector móvil, hash inicial y cambios, historial, hash desconocido, listeners reales de arranque 4/5, un solo intervalo por actividad, error y reintento del JSON.
- Canvas conserva su prueba con almacenamiento y fetch simulados.
- La prueba de igualdad anterior asumía la página completa previa a H5 y el menú nav.views. Se reemplazó por comparación de las cinco secciones y todo el JS anterior al wiring con el respaldo pre-landing, normalizando únicamente el estado inicial de Inicio y los dos listeners migrados. Esta comparación se omite si el respaldo externo no está disponible, como hacía la anterior.
- git diff --check: aprobado.
- Chrome no pudo iniciarse (Failed to launch the browser process). No se afirma validación visual ni ausencia de desborde medida a 390 px; queda el recorrido automatizado para un entorno con navegador operativo.

## Transcripción e interpretaciones

Las bios, áreas, trayectorias y contactos se extrajeron completos con zipfile/XML. Las tres imágenes se revisaron visualmente. Se conservaron los textos de las cinco prácticas y cinco de los seis lentes.

Correcciones: «EQUIPOFACILITADOR» → «Equipo facilitador»; «Felipe Hillon» → «Felipe Hillón», según el nombre indicado por Felipe; «A corto mediano y largo plazo» → «A corto, mediano y largo plazo»; «Definir para prioridad» del SmartArt → «Definir para cada prioridad».

Adaptaciones provisionales explícitas por terminología vigente:
- Objetivo 2: criterio antiguo de atractivo/acceso → impacto y esfuerzo de relacionamiento.
- Objetivo 4: lista antigua de estrategias → los cuatro cuadrantes actuales.
- Lente «Poder–Interés + Influencia –Acceso» → «Impacto–Esfuerzo» y descripción coherente; conserva la pregunta «¿Cuánto esfuerzo comercial dedicar?».
- Los propósitos de las cinco actividades son síntesis nuevas de las herramientas vigentes; el quinto usa aliado impulsor, buyer, sponsor, CTA y ruta a 90 días.

Se conserva «poder» como parte de la definición de Salience de la diapositiva 8; no se presenta como eje de priorización ni se importa la terminología de la diapositiva 19. Se excluyen la agenda de la diapositiva 9 y los cuadrantes antiguos. El contenido existente de las herramientas permanece intacto, incluidos los textos anteriores que ellas ya mostraban.

El plan pedía confirmar textos antes de codificar; la instrucción actual autoriza avanzar con textos provisionales y define el nombre, por lo que no se solicitó otra confirmación. No se generó un grafo del proyecto: no existía uno local y la revisión se hizo directamente sobre las dependencias identificadas.

## Contenido completo de landing-config.json

```json
{
  "nombre": "Ruta Colombia - Olivia",
  "provisional": true,
  "nota": "Textos por confirmar con Felipe",
  "portada": {
    "etiqueta": "TALLER ESTRATÉGICO",
    "titulo": "Priorizar mercado y activar estrategia comercial en Colombia",
    "lema": "Diseñar relaciones que abran mercado.",
    "sesion": "SESIÓN DE 4 HORAS",
    "descripcion": "Cocreación para convertir conocimiento distribuido en movimientos comerciales concretos.",
    "marco": [
      {
        "numero": "01",
        "nombre": "DECIDIR",
        "proposito": "Dónde jugar"
      },
      {
        "numero": "02",
        "nombre": "MAPEAR",
        "proposito": "Con quién entrar"
      },
      {
        "numero": "03",
        "nombre": "ACTIVAR",
        "proposito": "A corto, mediano y largo plazo"
      }
    ],
    "objetivos": [
      {
        "nombre": "Construir un universo común",
        "descripcion": "Competidores, aliados estratégicos, mercados potenciales e instituciones / autoridades."
      },
      {
        "nombre": "Priorizar mercados y cuentas",
        "descripcion": "En función del impacto y el esfuerzo de relacionamiento."
      },
      {
        "nombre": "Definir para cada prioridad",
        "descripcion": "Necesidades, compradores, aliados y ruta de entrada."
      },
      {
        "nombre": "Diseñar una estrategia de relacionamiento diferenciada",
        "descripcion": "Victorias tempranas / Apuestas estratégicas / Mantenimiento selectivo / Racionalización."
      },
      {
        "nombre": "Salir con un portafolio pequeño",
        "descripcion": "Movimientos comerciales y mercados para Olivia en el corto (2026), mediano (2028) y largo (2030) plazo."
      }
    ]
  },
  "equipo": {
    "titulo": "Equipo facilitador",
    "personas": [
      {
        "nombre": "Germán Hillón",
        "rol": "Experto en sostenibilidad y debida diligencia corporativa.",
        "bio": "16+ años liderando sostenibilidad, debida diligencia empresarial y gestión ESG en los sectores público y privado. Abogado con maestrías en Recursos Naturales y en Derechos Humanos (U. Externado · Carlos III, Madrid).",
        "areas": "Derechos humanos  ·  Sostenibilidad corporativa  ·  Gestión reputacional  ·  Ciudadanía empresarial  ·  Políticas públicas",
        "trayectoriaTitulo": "HA ACOMPAÑADO A + DE 300 EMPRESAS Y ORGANIZACIONES COMO:",
        "trayectoria": [
          "Ecopetrol",
          "BID",
          "PNUD",
          "USAID",
          "GIZ",
          "Argos",
          "Promigas",
          "Confecámaras",
          "Asocolflores",
          "Buencafé",
          "Agrovisión",
          "Min. Minas y Energía",
          "Fondo de Adaptación",
          "Cementos Pacasmayo",
          "Industrias Nettalco"
        ],
        "email": "ghillon@ghestudio.com",
        "telefono": "(+57) 315 2244583",
        "foto": "img/equipo/german-hillon.png"
      },
      {
        "nombre": "Julio Raúl Ochoa",
        "rol": "Coordinador de Proyectos de Sostenibilidad. Experto en gestión pública, alianzas y ESG",
        "bio": "15+ años articulando gestión pública, cooperación y sector privado. Ha estructurado proyectos de CTeI por más de $50.000 millones y gestionado alianzas con actores nacionales e internacionales.",
        "areas": "Sostenibilidad y ESG  •  Alianzas público-privadas  •  Cooperación internacional  •  Proyectos CTeI  •  Innovación pública  •  Propiedad intelectual",
        "trayectoriaTitulo": "ÁMBITOS DE IMPACTO",
        "trayectoria": [
          "Gobierno nacional",
          "Territorios",
          "Sector privado",
          "CTeI",
          "ESG"
        ],
        "email": "jochoar@ghestudio.com",
        "telefono": "(+57) 316 2224928",
        "foto": "img/equipo/julio-raul-ochoa.png"
      },
      {
        "nombre": "Felipe Hillón",
        "rol": "Profesional en sostenibilidad y comunicación.",
        "bio": "Comunicador Social – Periodista (U. Externado) con experiencia en sostenibilidad, debida diligencia empresarial y derechos humanos: relacionamiento comunitario, estándares internacionales y procesos ESG.",
        "areas": "Relacionamiento comunitario  ·  Estándares internacionales  ·  Procesos ESG  ·  Materialidad  ·  Informes de sostenibilidad",
        "trayectoriaTitulo": "HA ACOMPAÑADO A",
        "trayectoria": [
          "Nettalco",
          "Proeléctrica",
          "Sociedad Portuaria El Dique",
          "Pacasmayo",
          "Agrovisión",
          "Precisagro",
          "Solgas",
          "Universidad EAN"
        ],
        "email": "fhillon@ghestudio.com",
        "telefono": "(+57) 317 1874754",
        "foto": "img/equipo/felipe-hillon.png"
      }
    ]
  },
  "propuesta": {
    "titulo": "Propuesta de valor Olivia",
    "descripcion": "Olivia conecta cinco líneas para mover la transformación.",
    "detalle": "La oferta combina intervención organizacional, decisiones basadas en datos y desarrollo de capacidades.",
    "practicas": [
      {
        "nombre": "Innovación",
        "descripcion": "Instala capacidades para explorar, priorizar y ejecutar nuevas soluciones."
      },
      {
        "nombre": "Liderazgo",
        "descripcion": "Moviliza líderes capaces de sostener el cambio."
      },
      {
        "nombre": "People Analytics",
        "descripcion": "Convierte datos de personas en decisiones organizacionales."
      },
      {
        "nombre": "Gestión del cambio",
        "descripcion": "Acelera adopción y reduce fricciones en la transformación."
      },
      {
        "nombre": "Cultura",
        "descripcion": "Rediseña comportamientos, símbolos y formas de trabajar."
      }
    ]
  },
  "metodologia": {
    "titulo": "Metodología",
    "descripcion": "Seis lentes que integran engagement, priorización, acceso y conversión comercial.",
    "lentes": [
      {
        "nombre": "Metodología Salience",
        "descripcion": "Combina poder, legitimidad y urgencia.",
        "pregunta": "¿Quién puede acelerar, bloquear o legitimar?"
      },
      {
        "nombre": "AA1000SES",
        "descripcion": "Identifica y prioriza stakeholders; define propósito, método y respuesta.",
        "pregunta": "¿Quién merece engagement y con qué intensidad?"
      },
      {
        "nombre": "Opportunity Canvas",
        "descripcion": "Convierte una relación priorizada en una hipótesis de negocio.",
        "pregunta": "¿Qué necesidad, cliente y oferta existen?"
      },
      {
        "nombre": "Principios AA1000",
        "descripcion": "Inclusividad, materialidad, capacidad de respuesta e impacto.",
        "pregunta": "¿Por qué importa este actor y qué cambio buscamos?"
      },
      {
        "nombre": "Impacto–Esfuerzo",
        "descripcion": "Cruza el impacto y el esfuerzo de relacionamiento.",
        "pregunta": "¿Cuánto esfuerzo comercial dedicar?"
      },
      {
        "nombre": "Ruta de mercado",
        "descripcion": "Define cómo llegar a la cuenta desde Colombia.",
        "pregunta": "¿Quién abre la puerta y cuál es el siguiente paso?"
      }
    ]
  },
  "actividades": [
    {
      "numero": 1,
      "nombre": "Alinear el juego",
      "proposito": "Definir movimientos comerciales en el corto, mediano y largo plazo.",
      "vista": "ideas"
    },
    {
      "numero": 2,
      "nombre": "Radar 360°",
      "proposito": "Construir un universo común de competidores, mercados, aliados y autoridades.",
      "vista": "radar"
    },
    {
      "numero": 3,
      "nombre": "Identificación de oportunidades directas",
      "proposito": "Conectar cliente, necesidad y oferta de Olivia.",
      "vista": "matriz"
    },
    {
      "numero": 4,
      "nombre": "Priorizar actores y mercados",
      "proposito": "Valorar Impacto–Esfuerzo: Victorias tempranas, Apuestas estratégicas, Mantenimiento selectivo y Racionalización.",
      "vista": "priorizacion"
    },
    {
      "numero": 5,
      "nombre": "De cuenta priorizada a oportunidad comercial",
      "proposito": "Completar el Canvas con aliado impulsor, buyer, sponsor, CTA y ruta a 90 días.",
      "vista": "canvas"
    }
  ]
}
```
