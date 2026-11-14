// Lee la lista de ingredientes de una receta ("250 g de harina", "3 huevos", "2 tazas de avena")
// y busca cada uno en la lista de alimentos para tener sus calorías y sus medidas.
import { buscarTipicos } from "../data/alimentos-ar.js";
import { prepararItem, unidadesDe } from "./unidades.js";
import { itemImportado, leerAlimentos } from "./importar.js";

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

// Captura de una receta de MyFitnessPal: cada ingrediente en tres renglones.
//   Queso Cottage (Festa) >
//   100 g            (el OCR a veces lee la "g" como "9")
//   60 calorías
// Las calorías de la captura mandan: si el alimento está en la lista se ajusta a ellas; si no, se usa tal cual.
const CANTIDAD_MFP = /^(\d+(?:[.,]\d+)?)\s*(9|g|gr|grs|gramos?|ml|mililitros?|kg|l|litros?|piezas?|unidad(?:es)?|u|cucharaditas?|cucharadas?|tazas?|gotas?|rebanadas?|fetas?|porci[oó]n(?:es)?|raci[oó]n(?:es)?|vasos?|latas?)?\.?$/i;
const CALORIAS_MFP = /^([\dOo]+(?:[.,]\d+)?)\s*(?:calor[ií]as?|kcal|cal)\.?$/i;
// A veces el OCR junta la cantidad y las calorías en el mismo renglón: "100 g · 60 calorías".
const CANTIDAD_Y_CALORIAS = /^(\d+(?:[.,]\d+)?)\s*(9|g|gr|grs|gramos?|ml|mililitros?|kg|l|litros?|piezas?|unidad(?:es)?|u|cucharaditas?|cucharadas?|tazas?|gotas?|rebanadas?|fetas?|porci[oó]n(?:es)?|raci[oó]n(?:es)?|vasos?|latas?)?\.?(?:\s*[,·•|\-–]\s*|\s+)([\dOo]+(?:[.,]\d+)?)\s*(?:calor[ií]as?|kcal|cal)\.?$/i;
// La flechita del final ("Queso Cottage (Festa) >") el OCR la lee como >, ›, » o la pierde.
const FLECHA = /\s*[>›»]+\s*$/;
const esNombreMFP = (l) => /\p{L}{2}/u.test(l) && !CANTIDAD_MFP.test(l) && !CALORIAS_MFP.test(l) && !CANTIDAD_Y_CALORIAS.test(l) && !/calor[ií]as?\s+por|raci[oó]n/i.test(l);
const RACIONES_MFP = /(\d{1,3})\s*raci[oó]n(?:es)?/i;

function itemDeMFP(nombreTexto, cantidad, unidadTexto, kcal) {
  // "Queso Cottage (Festa)": lo de los paréntesis es la marca, salvo que repita el nombre ("claras (claras)").
  const completo = nombreTexto.replace(FLECHA, "").trim();
  const partes = completo.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
  const base = partes ? partes[1].trim() : completo;
  const nombre = base.charAt(0).toUpperCase() + base.slice(1);
  const marca = partes && !normal(partes[1]).includes(normal(partes[2])) ? partes[2].trim() : undefined;
  const unidad = normal(unidadTexto || "");
  const enGramos = unidad === "9" || /^(g|gr|grs|gramos?|ml|mililitros?)$/.test(unidad);
  const gramos = enGramos ? cantidad : /^(kg|l|litros?)$/.test(unidad) ? cantidad * 1000 : null;
  const medida = gramos ? `${cantidad} ${unidad === "9" ? "g" : unidadTexto}` : `${String(cantidad).replace(".", ",")} ${unidadTexto || "unidad"}`;
  const alimento = buscar(nombre);
  if (alimento) {
    const unidadReceta = /^(piezas?|unidad(es)?|u)$/.test(unidad) ? "unidad" : gramos ? "g" : unidadTexto;
    const item = gramos ? aItem(alimento, gramos, "g") : aItem(alimento, cantidad, unidadReceta);
    const calculadas = item.por100 ? (item.por100.kcal * item.gramos) / 100 : 0;
    // Si la de la lista no coincide (otra marca, versión light), se escala para que den las calorías de la captura.
    if (kcal !== null && calculadas > 0) {
      const f = kcal / calculadas;
      if (Math.abs(f - 1) > 0.05) {
        const p = item.por100;
        return { ...item, nombre, marca, por100: { ...p, kcal: p.kcal * f, p: p.p * f, c: p.c * f, g: p.g * f } };
      }
    }
    return { ...item, nombre, marca };
  }
  if (kcal === null) return null;
  // No está en la lista: queda con las calorías de la captura.
  if (gramos) return prepararItem({ nombre, marca, fuente: "importado", gramos, por100: { kcal: (kcal / gramos) * 100, p: 0, c: 0, g: 0 }, estimado: true });
  return { nombre, marca, fuente: "importado", medida, kcal, p: 0, c: 0, g: 0, estimado: true };
}

function leerRecetaMFP(lineas) {
  const items = [];
  const sinReconocer = [];
  let encontrados = 0;
  for (let i = 0; i < lineas.length - 1; i++) {
    if (!esNombreMFP(lineas[i])) continue;
    // Nombre, cantidad y calorías en tres renglones; o cantidad y calorías juntas en uno.
    const junta = lineas[i + 1].match(CANTIDAD_Y_CALORIAS);
    const cantidad = junta || lineas[i + 1].match(CANTIDAD_MFP);
    const calorias = junta ? [null, junta[3]] : lineas[i + 2]?.match(CALORIAS_MFP);
    // Sin la flechita, solo vale si abajo vienen la cantidad y las calorías.
    if (!cantidad || (!calorias && !FLECHA.test(lineas[i]))) continue;
    encontrados++;
    const numero = leerNumero(cantidad[1]);
    const kcal = calorias ? Number(String(calorias[1]).replace(/[Oo]/g, "0").replace(",", ".")) : null;
    const item = numero > 0 ? itemDeMFP(lineas[i], numero, cantidad[2] || "", kcal) : null;
    if (item) items.push(item);
    else sinReconocer.push(lineas[i].replace(FLECHA, ""));
    i += junta || !calorias ? 1 : 2;
  }
  if (!encontrados) return null;
  const raciones = lineas.map((l) => l.match(RACIONES_MFP)).find(Boolean);
  return { titulo: "", porciones: raciones ? Number(raciones[1]) : null, items, sinReconocer };
}

export function leerIngredientes(texto) {
  // "100 9" era "100 g": el OCR lee la g como 9 cuando queda sola al final.
  // La flechita de cada fila queda pegada a cualquier renglón ("100 g >") y a veces se lee como ")" o "|".
  const crudas = String(texto || "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\s+[>›»)\]|]+$/, "").replace(/^(\d+(?:[.,]\d+)?)\s+9$/, "$1 g"))
    .filter(Boolean);
  const deMFP = leerRecetaMFP(crudas);
  if (deMFP?.items.length) return deMFP;
  const comun = leerLista(crudas);
  if (!crudas.length || (comun.items.length && !comun.sinReconocer.length)) return comun;
  const comoComida = leerAlimentos(crudas).map((a) => {
    const item = itemImportado(a);
    return item.por100 ? prepararItem(item) : item;
  });
  if (comoComida.length > comun.items.length) {
    const raciones = crudas.map((l) => l.match(RACIONES_MFP)).find(Boolean);
    return { titulo: comun.titulo, porciones: comun.porciones || (raciones ? Number(raciones[1]) : null), items: comoComida, sinReconocer: [] };
  }
  return comun.items.length || !deMFP ? comun : deMFP;
}

function leerLista(crudas) {
  const lineas = crudas.map((l) => l.replace(/^[\s\-–•*·◦▪✓✔>]+|^\d+[.)]\s+/u, "").trim()).filter(Boolean);
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
