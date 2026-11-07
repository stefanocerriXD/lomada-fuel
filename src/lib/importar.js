// Entiende resúmenes de otras apps: texto copiado, CSV o lo que se lee de una captura.
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
  ["merienda", /^\W*(merienda|colaci[oó]n|snacks?|tentempi[eé])\b/i],
  ["cena", /^\W*(cena|dinner)\b/i],
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
  const col = { kcal: indice(/energy|kcal|calor/), p: indice(/protein/), c: indice(/^carbs|carbohydrate|hidratos/), g: indice(/^fat|grasa|lipid/), grupo: indice(/group|grupo|meal|comida/), dia: indice(/^day$|^date$|fecha|^dia$/) };
  if (col.kcal < 0 || titulos.length < 3) return null;

  const filas = lineas.slice(1).map(dividirCSV).filter((f) => f.length >= titulos.length - 1);
  if (!filas.length) return null;
  const ultimoDia = col.dia >= 0 ? filas.map((f) => f[col.dia]).filter(Boolean).sort().pop() : null;
  const delDia = ultimoDia ? filas.filter((f) => f[col.dia] === ultimoDia) : filas;

  const grupos = new Map();
  for (const f of delDia) {
    const nombre = col.grupo >= 0 ? f[col.grupo] : "";
    const tipo = COMIDAS.find(([, re]) => re.test(nombre))?.[0] || "resumen";
    const t = grupos.get(tipo) || { kcal: 0, p: 0, c: 0, g: 0 };
    for (const k of ["kcal", "p", "c", "g"]) if (col[k] >= 0) t[k] += Number(String(f[col[k]]).replace(",", ".")) || 0;
    grupos.set(tipo, t);
  }
  return [...grupos].map(([tipo, v]) => ({ tipo, ...completar(v) }));
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
    ? tipos.filter((t) => !ocupados.has(t)).map((t) => ({ clave: t, id: null, tipo: t, privada: false }))
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
    if (tieneDatos(v) && !porComida.has(s.tipo)) porComida.set(s.tipo, completar(v));
  }

  const general = leerMacros(secciones.filter((x) => !x.tipo).flatMap((x) => x.lineas));
  const comidasConMacros = [...porComida.values()].some((v) => v.p || v.c || v.g);
  const generalConMacros = general.p || general.c || general.g;

  // Si las comidas solo traen calorías y el total trae macros, conviene el total.
  if (porComida.size && (comidasConMacros || !generalConMacros)) {
    return [...porComida].map(([tipo, v]) => ({ tipo, ...v }));
  }
  return tieneDatos(general) ? [{ tipo: "resumen", ...completar(general) }] : [];
}
