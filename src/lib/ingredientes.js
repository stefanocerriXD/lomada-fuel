// Lee la lista de ingredientes de una receta ("250 g de harina", "3 huevos", "2 tazas de avena")
// y busca cada uno en la lista de alimentos para tener sus calorías y sus medidas.
import { buscarTipicos } from "../data/alimentos-ar.js";
import { prepararItem, unidadesDe } from "./unidades.js";

const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

const PALABRAS = { un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12 };
const FRACCIONES = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

// Cada unidad de receta, con su nombre en las medidas de la lista y su peso si el alimento no la tiene.
const UNIDADES = [
  [/^(kg|kilos?|kilogramos?)$/, { gramos: 1000 }],
  [/^(g|gr|grs|gramos?)$/, { gramos: 1 }],
  [/^(l|lts?|litros?)$/, { gramos: 1000 }],
  [/^(ml|cc|mililitros?)$/, { gramos: 1 }],
  [/^(tazas?|tz)$/, { medida: "taza", g: 240 }],
  [/^(cucharaditas?|cditas?|cdtas?)$/, { medida: "cucharadita", g: 5 }],
  [/^(cucharadas?|cdas?)$/, { medida: "cucharada", g: 15 }],
  [/^(vasos?)$/, { medida: "vaso", g: 200 }],
  [/^(pizcas?)$/, { gramos: 1 }],
  [/^(punados?)$/, { medida: "puñado", g: 30 }],
  [/^(latas?)$/, { medida: "lata", g: 300 }],
  [/^(fetas?)$/, { medida: "feta", g: 20 }],
  [/^(rebanadas?)$/, { medida: "rebanada", g: 25 }],
  [/^(unidad(es)?|u)$/, { medida: "unidad", g: 0 }],
];

const NUMERO = String.raw`(\d+(?:[.,]\d+)?(?:\s+\d\/\d)?|\d+\/\d+|[½¼¾⅓⅔]|un|una|uno|medio|media|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)`;
const UNIDAD = String.raw`(kg|kilos?|kilogramos?|g|gr|grs|gramos?|l|lts?|litros?|ml|cc|mililitros?|tazas?|tz|cucharaditas?|cditas?|cdtas?|cucharadas?|cdas?|vasos?|pizcas?|punados?|latas?|fetas?|rebanadas?|unidad(?:es)?|u)\.?`;
const ANTES = new RegExp(String.raw`^${NUMERO}\s*(?:${UNIDAD}\s+)?(?:de\s+)?(.+)$`, "i");
const DESPUES = new RegExp(String.raw`^(.+?)[\s:,-]+${NUMERO}\s*(?:${UNIDAD})?$`, "i");
const CORTE = /^(preparaci[oó]n|procedimiento|pasos|instrucciones|modo de preparaci[oó]n|elaboraci[oó]n)\b/i;
const RINDE = /(?:rinde|para|porciones?:?)\s*(\d{1,3})\s*(?:porciones|personas|unidades|porci[oó]n)?/i;

function leerNumero(texto) {
  const t = normal(texto);
  if (t in PALABRAS) return PALABRAS[t];
  if (texto in FRACCIONES) return FRACCIONES[texto];
  const mixto = t.match(/^(\d+)\s+(\d)\/(\d)$/);
  if (mixto) return Number(mixto[1]) + Number(mixto[2]) / Number(mixto[3]);
  const fraccion = t.match(/^(\d+)\/(\d+)$/);
  if (fraccion) return Number(fraccion[1]) / Number(fraccion[2]);
  return Number(t.replace(",", "."));
}

// "huevos" encuentra "Huevo"; si no, prueba con la primera palabra ("harina 0000" → "harina").
function buscar(nombre) {
  const limpio = normal(nombre).replace(/\(.*?\)/g, " ").replace(/[^a-zñ\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  const directo = buscarTipicos(limpio)[0];
  if (directo) return directo;
  // Con menos palabras, solo si el alimento empieza así: "polvo de hornear" no es "jugo en polvo".
  for (const parte of [limpio.split(" ").slice(0, 2).join(" "), limpio.split(" ")[0]]) {
    const hallado = buscarTipicos(parte).find((a) => normal(a.nombre).startsWith(parte.replace(/e?s$/, "")));
    if (hallado) return hallado;
  }
  return null;
}

function aItem(alimento, cantidad, unidadTexto) {
  const unidades = unidadesDe(alimento);
  const regla = unidadTexto ? UNIDADES.find(([re]) => re.test(normal(unidadTexto).replace(/\.$/, "")))?.[1] : null;
  if (regla?.gramos) return prepararItem({ ...alimento, unidad: { nombre: "g", g: 1 }, cantidad: cantidad * regla.gramos });
  if (regla?.medida) {
    // La medida propia del alimento manda: una taza de harina no pesa lo mismo que una de leche.
    const propia = unidades.find((u) => normal(u.nombre) === regla.medida) || (regla.g ? { nombre: regla.medida, g: regla.g } : unidades[0]);
    return prepararItem({ ...alimento, unidad: propia, cantidad });
  }
  // Sin unidad ("3 huevos", "2 bananas"): la primera medida del alimento, que suele ser la unidad.
  return prepararItem({ ...alimento, unidad: unidades[0], cantidad });
}

export function leerIngredientes(texto) {
  const lineas = String(texto || "").split(/\r?\n/).map((l) => l.replace(/^[\s\-–•*·◦▪✓✔>]+|^\d+[.)]\s+/u, "").trim()).filter(Boolean);
  const items = [];
  const sinReconocer = [];
  let titulo = "";
  let porciones = null;

  for (const linea of lineas) {
    if (CORTE.test(linea)) break;
    const rinde = linea.match(RINDE);
    if (rinde && /rinde|porcion|persona/i.test(linea)) {
      porciones = Number(rinde[1]);
      continue;
    }
    if (/^ingredientes?:?$/i.test(linea)) continue;
    const antes = linea.match(ANTES);
    const despues = !antes && linea.match(DESPUES);
    const [cantidadTexto, unidadTexto, nombre] = antes ? [antes[1], antes[2], antes[3]] : despues ? [despues[2], despues[3], despues[1]] : [];
    if (!nombre) {
      // La primera línea sin cantidad suele ser el nombre de la receta.
      if (!titulo && !items.length && linea.length <= 60) titulo = linea;
      else if (linea.length <= 40 && !/al gusto|c\/n|cantidad necesaria/i.test(linea)) sinReconocer.push(linea);
      continue;
    }
    const cantidad = leerNumero(cantidadTexto);
    const alimento = buscar(nombre);
    if (!alimento || !(cantidad > 0)) {
      sinReconocer.push(linea);
      continue;
    }
    items.push(aItem(alimento, cantidad, unidadTexto));
  }
  return { titulo, porciones, items, sinReconocer };
}
