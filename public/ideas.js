/* Actividad 1: preguntas estables y conteo local, sin red ni dependencias. */
(function(root){
  'use strict';
  // No renumerar estos identificadores si cambia el orden de presentación.
  var preguntas = {
  "corto": [
    {
      "id": "corto-1",
      "texto": "¿Qué espera Olivia para finales de 2026?"
    },
    {
      "id": "corto-2",
      "texto": "¿Olivia ha identificado algún mercado para este horizonte?"
    },
    {
      "id": "corto-3",
      "texto": "¿Existe un problema/necesidad claro que Olivia resuelve en ese mercado?"
    },
    {
      "id": "corto-4",
      "texto": "¿Qué aliados tiene actualmente?"
    }
  ],
  "medio": [
    {
      "id": "medio-1",
      "texto": "¿Qué espera Olivia para 2028?"
    },
    {
      "id": "medio-2",
      "texto": "¿Considera que habrá mercado suficiente en este horizonte?"
    },
    {
      "id": "medio-3",
      "texto": "¿Qué problema/necesidad espera estar su oferta de servicios resolviendo en ese momento?"
    },
    {
      "id": "medio-4",
      "texto": "¿A qué mercados/clientes esperaría poder acceder?"
    },
    {
      "id": "medio-5",
      "texto": "¿Qué red de aliados le gustaría tener?"
    },
    {
      "id": "medio-6",
      "texto": "¿Cuál es el posicionamiento de marca que espera alcanzar Olivia?"
    }
  ],
  "largo": [
    {
      "id": "largo-1",
      "texto": "¿Cómo espera Olivia consolidar su estrategia para 2030?"
    },
    {
      "id": "largo-2",
      "texto": "¿Qué nivel de mercado espera haber capturado o consolidado?"
    },
    {
      "id": "largo-3",
      "texto": "¿A qué mercados/clientes esperaría poder acceder?"
    },
    {
      "id": "largo-4",
      "texto": "¿Qué red de aliados le gustaría tener?"
    },
    {
      "id": "largo-5",
      "texto": "¿Cuál es el posicionamiento de marca que espera alcanzar Olivia?"
    }
  ]
};
  var palabrasVacias = 'a al algo algun alguna algunas alguno algunos ante antes bajo cabe cada como con contra cual cuales cuando de del desde donde durante e el ella ellas ello ellos en entre era eramos eran eras eres es esa esas ese eso esos esta estaba estaban estado estamos estan estar estas este esto estos estoy fue fueron ha haber habia habian hacia han hasta hay he hemos la las le les lo los mas me mediante mi mis mismo mucha muchas mucho muchos muy nada ni no nos nosotros nuestra nuestras nuestro nuestros o os otra otras otro otros para pero poco por porque que quien quienes se sea sean segun ser si sido siendo sin so sobre sois solo somos son soy su sus te tiene tienen toda todas todo todos tras tu tus un una unas uno unos usted ustedes va vamos van versus via y ya yo'.split(' ');
  function normalizar(texto){ return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function preguntaValida(hz, id){ return Object.prototype.hasOwnProperty.call(preguntas, hz) && preguntas[hz].some(function(p){ return p.id === id; }); }
  function contar(respuestas, opciones){
    opciones = opciones || {};
    var vacias = new Set(palabrasVacias.concat(opciones.excluirOlivia === false ? [] : ['olivia']));
    var conteos = new Map();
    respuestas.forEach(function(r){
      var tokens = String(r.texto || '').toLowerCase().normalize('NFC').match(/[\p{L}\p{M}]+/gu) || [];
      tokens.forEach(function(forma){
        var clave = normalizar(forma);
        if(clave.length < 2 || vacias.has(clave)) return;
        if(!conteos.has(clave)) conteos.set(clave, {frecuencia:0, formas:new Map()});
        var c = conteos.get(clave); c.frecuencia++;
        c.formas.set(forma, (c.formas.get(forma) || 0) + 1);
      });
    });
    return Array.from(conteos.values()).map(function(c){
      var formas = Array.from(c.formas).sort(function(a,b){ return b[1]-a[1] || a[0].localeCompare(b[0], 'es'); });
      return {palabra:formas[0][0], frecuencia:c.frecuencia};
    }).sort(function(a,b){ return b.frecuencia-a.frecuencia || a.palabra.localeCompare(b.palabra, 'es'); }).slice(0, opciones.maxPalabras === undefined ? 40 : opciones.maxPalabras);
  }
  var api = {preguntas:preguntas, preguntaValida:preguntaValida, contar:contar, palabrasVacias:palabrasVacias};
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.Ideas = api;
})(typeof globalThis === 'object' ? globalThis : this);
