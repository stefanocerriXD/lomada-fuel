// Entiende resúmenes de otras apps: texto copiado, CSV o lo que se lee de una captura.
import { buscarTipicos } from "../data/alimentos-ar.js";

const ETIQUETAS = {
  kcal: /calor[ií]as?|calories?|energ[ií]a|energy|kcal|\bcal\b|ingeridas|consumidas|consumed/i,
  p: /prote[ií]nas?|proteins?|\bprot\b/i,
  c: /carbohidratos?|hidratos?|carbohydrates?|carbs?|carbos?/i,
  g: /grasas?|l[ií]pidos|\bfats?\b/i,
};

// El reconocimiento de capturas suele pegar los valores: "P20C50F15".
const LETRAS = { p: /(?:^|[^\p{L}])P\s*[:=]?\s*(\d+(?:[.,]\d+)?)/u, c: /(?:^|[^\p{L}])C\s*[:=]?\s*(\d+(?:[.,]\d+)?)/u, g: /(?:^|[^\p{L}])[GF]\s*[:=]?\s*(\d+(?:[.,]\d+)?)/u };

const COMIDAS = [
  ["desayuno", /^\W*(desayuno|breakfast)\b/i],
  ["almuerzo", /^\W*(almuerzo|comida|lunch)\b/i],
  ["merienda", /^\W*(merienda)\b/i],
  ["cena", /^\W*(cena|dinner)\b/i],
  ["colacion", /^\W*(colaci[oó]n(es)?|snacks?|tentempi[eé]s?)\b/i],
];

// Líneas que hablan de metas o de lo que queda, no de lo comido.
const IGNORAR = /restantes?|remaining|left\b|faltan?|objetivo|\bmeta\b|\bgoal\b|quemad|burned|exercise|ejercicio/i;

const NUMERO = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;

export function leerNumero(texto) {
  const limpio = String(texto).trim();
  if (/^\d{1,3}([.,]\d{3})+$/.test(limpio)) return Number(limpio.replace(/[.,]/g, ""));
  return Number(limpio.replace(",", "."));
}

function numerosDe(linea) {
  return [...linea.matchAll(NUMERO)].map((m) => ({ valor: leerNumero(m[0]), posicion: m.index }));
}

function valorDeEtiqueta(lineas, clave) {
  const etiqueta = ETIQUETAS[clave];
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    const hallada = linea.match(etiqueta);
    if (!hallada || IGNORAR.test(linea)) continue;

    const numeros = numerosDe(linea);
    // "Proteínas 120 g" es lo más común, pero también aparece "120 g Proteínas".
    // Con "420 kcal P 20", el 20 ya es de otra etiqueta: hay letras en el medio.
    const finEtiqueta = hallada.index + hallada[0].length;
    const despues = numeros.find((n) => n.posicion >= finEtiqueta);
    const antes = numeros.filter((n) => n.posicion < hallada.index).pop();
    const seguido = despues && !/\p{L}/u.test(linea.slice(finEtiqueta, despues.posicion));
    let valor = seguido ? despues.valor : (antes?.valor ?? despues?.valor);

    // En las capturas la etiqueta suele ir arriba del número.
    if (valor === undefined && lineas[i + 1] && !IGNORAR.test(lineas[i + 1])) {
      const siguiente = numerosDe(lineas[i + 1]);
      if (siguiente.length && !Object.values(ETIQUETAS).some((e) => e.test(lineas[i + 1]))) valor = siguiente[0].valor;
    }
    if (valor !== undefined) return valor;
  }
  return null;
}

function valorDeLetra(lineas, clave) {
  for (const linea of lineas) {
    if (IGNORAR.test(linea)) continue;
    const m = linea.match(LETRAS[clave]);
    if (m) return leerNumero(m[1]);
  }
  return null;
}

function leerMacros(lineas) {
  const v = {};
  for (const k of ["kcal", "p", "c", "g"]) v[k] = valorDeEtiqueta(lineas, k) ?? (k === "kcal" ? null : valorDeLetra(lineas, k));
  return v;
}

function completar(v) {
  const p = v.p ?? 0;
  const c = v.c ?? 0;
  const g = v.g ?? 0;
  const estimadas = p * 4 + c * 4 + g * 9;
  const kcal = v.kcal && v.kcal >= 20 ? v.kcal : estimadas;
  return { kcal: Math.round(kcal), p: Math.round(p * 10) / 10, c: Math.round(c * 10) / 10, g: Math.round(g * 10) / 10 };
}

const tieneDatos = (v) => Boolean((v.kcal && v.kcal >= 20) || v.p || v.c || v.g);

function dividirCSV(linea) {
  const celdas = [];
  let actual = "";
  let comillas = false;
  for (const ch of linea) {
    if (ch === '"') comillas = !comillas;
    else if ((ch === "," || ch === ";" || ch === "\t") && !comillas) {
      celdas.push(actual.trim());
      actual = "";
    } else actual += ch;
  }
  celdas.push(actual.trim());
  return celdas;
}

function leerCSV(lineas) {
  const titulos = dividirCSV(lineas[0]).map((t) => t.toLowerCase());
  const indice = (re) => titulos.findIndex((t) => re.test(t));
  const col = { kcal: indice(/energy|kcal|calor/), p: indice(/protein/), c: indice(/^carbs|carbohydrate|hidratos/), g: indice(/^fat|grasa|lipid/), grupo: indice(/group|grupo|meal|comida/), dia: indice(/^day$|^date$|fecha|^dia$/), nombre: indice(/food name|alimento|^food$|^nombre$/), cantidad: indice(/amount|cantidad/) };
  if (col.kcal < 0 || titulos.length < 3) return null;

  const filas = lineas.slice(1).map(dividirCSV).filter((f) => f.length >= titulos.length - 1);
  if (!filas.length) return null;
  const ultimoDia = col.dia >= 0 ? filas.map((f) => f[col.dia]).filter(Boolean).sort().pop() : null;
  const delDia = ultimoDia ? filas.filter((f) => f[col.dia] === ultimoDia) : filas;

  const grupos = new Map();
  for (const f of delDia) {
    const nombre = col.grupo >= 0 ? f[col.grupo] : "";
    const tipo = COMIDAS.find(([, re]) => re.test(nombre))?.[0] || "resumen";
    const t = grupos.get(tipo) || { kcal: 0, p: 0, c: 0, g: 0, alimentos: [] };
    const fila = { kcal: 0, p: 0, c: 0, g: 0 };
    for (const k of ["kcal", "p", "c", "g"]) if (col[k] >= 0) fila[k] = Number(String(f[col[k]]).replace(",", ".")) || 0;
    for (const k of ["kcal", "p", "c", "g"]) t[k] += fila[k];
    if (col.nombre >= 0 && f[col.nombre]) {
      const medida = col.cantidad >= 0 ? datosDeLinea(f[col.cantidad]) : {};
      t.alimentos.push({ nombre: f[col.nombre], ...(medida.medida ? { medida: medida.medida } : {}), ...(medida.gramos ? { gramos: medida.gramos } : {}), ...fila, kcal: Math.round(fila.kcal) });
    }
    grupos.set(tipo, t);
  }
  return [...grupos].map(([tipo, { alimentos, ...v }]) => ({ tipo, ...completar(v), ...(alimentos.length ? { alimentos } : {}) }));
}

// En las capturas la "g" de gramos a veces se lee como "9": "Grasas 629" era "62 g".
export function corregirCaptura(texto) {
  if (!/\d\s*g\b/i.test(texto)) return texto;
  const macros = new RegExp(`${ETIQUETAS.p.source}|${ETIQUETAS.c.source}|${ETIQUETAS.g.source}`, "i");
  return texto
    .split("\n")
    .map((linea) => (macros.test(linea) && !/\dg\b|\d\s+g\b/i.test(linea) ? linea.replace(/(\d{2,3})9\s*$/, "$1 g") : linea))
    .join("\n");
}

// ---------- Alimentos uno por uno ----------
const UNIDADES = "gramos?|grs?|g|ml|mi|oz|tazas?|cups?|unidad(?:es)?|units?|cucharadas?|cucharaditas?|tbsp|tsp|rebanadas?|slices?|fetas?|porci[oó]n(?:es)?|servings?|vasos?|potes?|scoops?|medidas?";
const MEDIDA = new RegExp(`(\\d+(?:[.,]\\d+)?|\\d+/\\d+)\\s*(${UNIDADES})(?![\\p{L}])`, "iu");
const KCAL = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*k?cal(?:or[ií]as?)?(?![\p{L}])/iu;
const NUMERO_SUELTO = /\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?(?!\s*%)/g;

// Lo que aparece en cualquier pantalla y no es un alimento.
const NO_ES_ALIMENTO = /^\W*(total(es)?|resumen|summary|daily|hoy|today|ayer|yesterday|ma[nñ]ana|agregar|a[nñ]adir|add|buscar|search|diario|diary|fecha|date|consumidas|ingeridas|consumed|eaten|comidas|meals|nutrici[oó]n|nutrition|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i;
const ES_DATO = /^\W*(calor|prote|prot\b|carbo|carbs|hidrat|grasa|l[ií]pido|\bfat|kcal|cal\b|energ|fibra|fiber|sodio|sodium|az[uú]car|sugar|colesterol)/i;

const UNA_DE = (texto, re) => {
  const m = texto.match(re);
  return m ? { valor: leerNumero(m[1]), resto: texto.replace(m[0], " ") } : null;
};

function datosDeLinea(linea) {
  const d = {};
  let resto = ` ${linea} `;
  const kcal = UNA_DE(resto, KCAL);
  if (kcal) {
    d.kcal = kcal.valor;
    resto = kcal.resto;
  }
  for (const k of ["p", "c", "g"]) {
    const conNombre = new RegExp(`(?:${ETIQUETAS[k].source})\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*g?(?![\\p{L}])`, "iu");
    const conNombreAtras = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*g?\\s*(?:de\\s+)?(?:${ETIQUETAS[k].source})`, "iu");
    const hallado = UNA_DE(resto, conNombre) || UNA_DE(resto, conNombreAtras) || UNA_DE(resto, LETRAS[k]);
    if (hallado) {
      d[k] = hallado.valor;
      resto = hallado.resto;
    }
  }
  const medida = resto.match(MEDIDA);
  if (medida) {
    d.medida = `${medida[1]} ${medida[2].toLowerCase().replace(/^mi$/, "ml")}`;
    const cantidad = medida[1].includes("/") ? Number(medida[1].split("/")[0]) / Number(medida[1].split("/")[1]) : leerNumero(medida[1]);
    const unidad = medida[2].toLowerCase();
    if (/^(g|gr|grs|gramos?|ml|mi)$/.test(unidad)) d.gramos = cantidad;
    else if (unidad === "oz") d.gramos = Math.round(cantidad * 28.35);
    else d.cantidad = cantidad;
    resto = resto.replace(medida[0], " ");
  }

  // Las tablas traen los números sin unidad: "Avena 40 g 150 5 27 3".
  const sueltos = [...resto.matchAll(NUMERO_SUELTO)].map((m) => leerNumero(m[0]));
  const sinNumeros = resto.replace(NUMERO_SUELTO, (n, i, t) => (t.slice(i + n.length).trimStart().startsWith("%") ? n : " "));
  d.nombre = sinNumeros.replace(/[·•|;:()[\]_=]+/g, " ").replace(/\s+/g, " ").replace(/^[\s,.\-–—/]+|[\s,.\-–—/]+$/g, "").trim();
  if (d.kcal === undefined && sueltos.length) {
    if (sueltos.length >= 4) Object.assign(d, ordenarColumnas(sueltos.slice(-4)));
    else if (sueltos[sueltos.length - 1] >= 10 && sueltos[sueltos.length - 1] <= 4000) d.kcal = sueltos[sueltos.length - 1];
  }
  return d;
}

// Cada app ordena las columnas distinto. Se elige el orden que cierra con las calorías.
function ordenarColumnas([kcal, a, b, c]) {
  const opciones = [{ p: a, c: b, g: c }, { c: a, g: b, p: c }, { c: a, p: b, g: c }];
  const error = (o) => Math.abs(o.p * 4 + o.c * 4 + o.g * 9 - kcal);
  return { kcal, ...opciones.reduce((mejor, o) => (error(o) < error(mejor) ? o : mejor)) };
}

const esNombre = (linea, nombre) =>
  /^\W{0,3}\p{L}/u.test(linea) && nombre.replace(/[^\p{L}]/gu, "").length >= 3 && !NO_ES_ALIMENTO.test(linea) && !ES_DATO.test(linea) && !IGNORAR.test(linea);

const conDatos = (a) => a.kcal !== undefined || a.p !== undefined || a.c !== undefined || a.g !== undefined || a.gramos !== undefined || a.cantidad !== undefined;

// Varias apps muestran los alimentos en inglés y la lista propia está en español.
const EN_INGLES = [
  [/\boats?\b|oatmeal/i, "avena"], [/\beggs?\b/i, "huevo"], [/chicken/i, "pollo"], [/\brice\b/i, "arroz"], [/\bmilk\b/i, "leche"],
  [/\bbread\b|toast/i, "pan"], [/\bbeef\b|steak/i, "bife"], [/\bapple/i, "manzana"], [/\byogh?urt/i, "yogur"], [/cheese/i, "queso"],
  [/\btuna\b/i, "atun"], [/potato/i, "papa"], [/\bpasta\b|noodles|spaghetti/i, "fideos"], [/\bsalmon\b/i, "salmon"], [/\bbutter\b/i, "manteca"],
  [/\bavocado/i, "palta"], [/\bbanana/i, "banana"], [/\bcoffee\b/i, "cafe"], [/peanut/i, "mani"],
];

function enLaLista(nombre) {
  const directo = buscarTipicos(nombre)[0] || buscarTipicos(nombre.split(/[\s,]+/)[0])[0];
  if (directo) return directo;
  const traducido = EN_INGLES.find(([re]) => re.test(nombre))?.[1];
  return traducido ? buscarTipicos(traducido)[0] : undefined;
}

// Si la otra app no muestra los macros de un alimento, se estiman con la lista propia.
function completarAlimento(a) {
  const tieneMacros = a.p !== undefined || a.c !== undefined || a.g !== undefined;
  const base = tieneMacros ? null : enLaLista(a.nombre);
  const gramos = a.gramos ?? (base?.porcion && a.cantidad ? a.cantidad * Number(base.porcion.g) : undefined);
  let factor = 0;
  if (base) factor = a.kcal ? a.kcal / base.por100.kcal : (gramos || 0) / 100;
  const macro = (k) => Math.round((a[k] ?? (base ? base.por100[k] * factor : 0)) * 10) / 10;
  const p = macro("p");
  const c = macro("c");
  const g = macro("g");
  const kcal = Math.round(a.kcal ?? (base && factor ? base.por100.kcal * factor : p * 4 + c * 4 + g * 9));
  return {
    nombre: a.marca ? `${a.nombre} (${a.marca})` : a.nombre,
    ...(a.medida ? { medida: a.medida } : {}),
    ...(gramos ? { gramos: Math.round(gramos * 10) / 10 } : {}),
    kcal, p, c, g,
    ...(base && factor ? { estimado: true } : {}),
  };
}

export function leerAlimentos(lineas) {
  const hallados = [];
  let actual = null;
  let agregadas = 0;
  for (const linea of lineas) {
    if (COMIDAS.some(([, re]) => re.test(linea)) || NO_ES_ALIMENTO.test(linea) || IGNORAR.test(linea)) {
      actual = null;
      continue;
    }
    const d = datosDeLinea(linea);
    // MyFitnessPal pone debajo del alimento la marca y la porción: "Festa, 1 porción". Es el mismo alimento.
    const marca = actual && actual.medida === undefined && actual.gramos === undefined && actual.cantidad === undefined
      && linea.match(/^\W{0,3}(\p{L}[\p{L}\d .&'’-]{1,38}),\s*\d/u);
    if (marca) {
      actual.marca = marca[1].trim();
      for (const k of ["kcal", "p", "c", "g", "medida", "gramos", "cantidad"]) if (actual[k] === undefined && d[k] !== undefined) actual[k] = d[k];
      agregadas += 1;
      continue;
    }
    if (esNombre(linea, d.nombre)) {
      actual = { ...d };
      hallados.push(actual);
      agregadas = 0;
    } else if (actual && agregadas < 4 && conDatos(d)) {
      // "Avena" arriba y "40 g · 150 kcal" abajo: la línea de datos completa lo que falta.
      for (const k of ["kcal", "p", "c", "g", "medida", "gramos", "cantidad"]) if (actual[k] === undefined && d[k] !== undefined) actual[k] = d[k];
      agregadas += 1;
    } else {
      actual = null;
    }
  }
  // Algunas capturas muestran cada alimento dos veces (en la lista y en el detalle): se deja uno.
  // Si un alimento trae sus números en la captura, se descarta la copia que la app tuvo que estimar.
  const nombreDe = (a) => a.nombre.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\d]+/gu, " ").trim();
  const completos = hallados
    .filter(conDatos)
    .map((a) => ({ alimento: completarAlimento(a), propias: a.kcal !== undefined }))
    .filter(({ alimento }) => alimento.kcal > 0);
  const conCaloriasPropias = new Set(completos.filter((x) => x.propias).map((x) => nombreDe(x.alimento)));
  const vistos = new Set();
  return completos
    .filter(({ alimento, propias }) => {
      const nombre = nombreDe(alimento);
      if (!propias && conCaloriasPropias.has(nombre)) return false;
      const firma = `${nombre}|${alimento.kcal}`;
      if (vistos.has(firma)) return false;
      vistos.add(firma);
      return true;
    })
    .map(({ alimento }) => alimento);
}

function sumarAlimentos(alimentos) {
  const total = alimentos.reduce((t, a) => ({ kcal: t.kcal + a.kcal, p: t.p + a.p, c: t.c + a.c, g: t.g + a.g }), { kcal: 0, p: 0, c: 0, g: 0 });
  return { ...completar(total), alimentos };
}

// Con el peso se puede seguir ajustando la cantidad después de importar.
export function itemImportado(a) {
  const base = { nombre: a.nombre, fuente: "importado", kcal: a.kcal, p: a.p, c: a.c, g: a.g, ...(a.medida ? { medida: a.medida } : {}), ...(a.estimado ? { estimado: true } : {}) };
  if (!(a.gramos > 0)) return base;
  const por100 = Object.fromEntries(["kcal", "p", "c", "g"].map((k) => [k, (a[k] / a.gramos) * 100]));
  return { ...base, gramos: a.gramos, por100 };
}

// Lo importado desde una comida: la que corresponde, o lo único que se haya leído.
export function filaDeComida(filas, tipo) {
  const propia = filas.find((f) => f.tipo === tipo);
  if (propia) return propia;
  return filas.length === 1 ? { ...filas[0], tipo } : null;
}

// Las comidas del día que todavía no tienen foto, más las que faltan si solo se importó el total.
export function ranurasDeFotos(guardadas, propias, tipos) {
  const sinFoto = (c) => c.tipo !== "resumen" && !c.foto_path;
  const previas = propias.filter((c) => !guardadas.some((g) => g.id === c.id));
  const hechas = [...guardadas, ...previas].filter(sinFoto).map((c) => ({ clave: c.id, id: c.id, tipo: c.tipo, privada: Boolean(c.privada) }));
  const ocupados = new Set([...guardadas, ...previas].map((c) => c.tipo));
  const faltantes = guardadas.some((g) => g.tipo === "resumen")
    // Las colaciones son opcionales: solo se pide su foto si se importó alguna.
    ? tipos.filter((t) => t !== "colacion" && !ocupados.has(t)).map((t) => ({ clave: t, id: null, tipo: t, privada: false }))
    : [];
  return [...hechas, ...faltantes].sort((a, b) => tipos.indexOf(a.tipo) - tipos.indexOf(b.tipo));
}

export function leerResumen(texto) {
  const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return [];

  if (/[,;\t]/.test(lineas[0]) && /energy|kcal|calor/i.test(lineas[0]) && lineas.length > 1) {
    const csv = leerCSV(lineas);
    if (csv?.length) return csv;
  }

  // Separa el texto por comidas cuando aparecen como títulos.
  const secciones = [];
  let actual = { tipo: null, lineas: [] };
  for (const linea of lineas) {
    const comida = COMIDAS.find(([, re]) => re.test(linea));
    if (comida) {
      secciones.push(actual);
      actual = { tipo: comida[0], lineas: [linea] };
    } else {
      if (actual.tipo && /^\W*(total|resumen|summary|daily)/i.test(linea)) {
        secciones.push(actual);
        actual = { tipo: null, lineas: [] };
      }
      actual.lineas.push(linea);
    }
  }
  secciones.push(actual);

  const porComida = new Map();
  for (const s of secciones.filter((x) => x.tipo)) {
    const v = leerMacros(s.lineas);
    // "Almuerzo 640" sin etiqueta: el número del título son las calorías.
    if (!v.kcal) {
      const delTitulo = numerosDe(s.lineas[0])[0]?.valor;
      if (delTitulo >= 20) v.kcal = delTitulo;
    }
    const alimentos = leerAlimentos(s.lineas.slice(1));
    if (porComida.has(s.tipo)) continue;
    if (alimentos.length) porComida.set(s.tipo, sumarAlimentos(alimentos));
    else if (tieneDatos(v)) porComida.set(s.tipo, completar(v));
  }

  const sueltas = secciones.filter((x) => !x.tipo).flatMap((x) => x.lineas);
  const general = leerMacros(sueltas);
  const alimentosSueltos = porComida.size ? [] : leerAlimentos(sueltas);
  if (alimentosSueltos.length) return [{ tipo: "resumen", ...sumarAlimentos(alimentosSueltos) }];
  const comidasConMacros = [...porComida.values()].some((v) => v.p || v.c || v.g);
  const generalConMacros = general.p || general.c || general.g;

  // Si las comidas solo traen calorías y el total trae macros, conviene el total.
  if (porComida.size && (comidasConMacros || !generalConMacros)) {
    return [...porComida].map(([tipo, v]) => ({ tipo, ...v }));
  }
  return tieneDatos(general) ? [{ tipo: "resumen", ...completar(general) }] : [];
}
