// Lee la pantalla de objetivos de MyFitnessPal (u otra app): calorías y el % o los gramos de cada macro.
import { leerNumero } from "./importar.js";

const KCAL_POR_GRAMO = { p: 4, c: 4, g: 9 };
const ETIQUETAS = {
  kcal: /calor[ií]as?|calories|energ[ií]a|energy|kcal/i,
  c: /carbohidratos?|hidratos?|carbohydrates?|carbs?|carbos?/i,
  p: /prote[ií]nas?|proteins?/i,
  g: /grasas?|l[ií]pidos|\bfats?\b/i,
};
const PORCENTAJE = /(\d{1,3}(?:[.,]\d+)?)\s*%/;
const GRAMOS = /(\d{1,4}(?:[.,]\d+)?)\s*(?:g|gr|gramos)\b/i;
const NUMERO = /\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?/g;
// Lo que se comió o lo que queda no es el objetivo.
const IGNORAR = /restantes?|remaining|consumid|ingerid|comid[oa]s?\b|food\b|ejercicio|exercise|net[ao]s?\b/i;

function valorDe(lineas, i, re) {
  const m = lineas[i].match(re);
  if (m) return leerNumero(m[1]);
  // En las capturas, a veces el número queda en la línea de abajo.
  const abajo = lineas[i + 1];
  if (abajo && !Object.values(ETIQUETAS).some((e) => e.test(abajo))) {
    const m2 = abajo.match(re);
    if (m2) return leerNumero(m2[1]);
  }
  return null;
}

export function leerObjetivos(texto) {
  const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hallado = { kcal: null, pct: {}, gramos: {} };

  lineas.forEach((linea, i) => {
    if (IGNORAR.test(linea)) return;
    for (const k of ["c", "p", "g"]) {
      if (!ETIQUETAS[k].test(linea) || hallado.pct[k] != null) continue;
      hallado.pct[k] = valorDe(lineas, i, PORCENTAJE);
      hallado.gramos[k] = valorDe(lineas, i, GRAMOS);
      return;
    }
    if (hallado.kcal == null && ETIQUETAS.kcal.test(linea)) {
      const numeros = [linea, lineas[i + 1] || ""].flatMap((l) => (l === linea || !Object.values(ETIQUETAS).some((e) => e.test(l)) ? [...l.matchAll(NUMERO)].map((m) => leerNumero(m[0])) : []));
      const kcal = numeros.find((n) => n >= 800 && n <= 6000);
      if (kcal) hallado.kcal = kcal;
    }
  });

  const claves = ["p", "c", "g"];
  const conPct = claves.every((k) => hallado.pct[k] != null);
  const conGramos = claves.every((k) => hallado.gramos[k] != null);
  let gramos = null;
  if (conPct && hallado.kcal) {
    gramos = Object.fromEntries(claves.map((k) => [k, Math.round((hallado.kcal * hallado.pct[k]) / 100 / KCAL_POR_GRAMO[k])]));
  } else if (conGramos) {
    gramos = Object.fromEntries(claves.map((k) => [k, Math.round(hallado.gramos[k])]));
  }
  if (!gramos) return { error: conPct ? "Falta el objetivo de calorías." : "No encontramos los objetivos de los tres macros." };

  const kcal = Math.round(hallado.kcal || claves.reduce((t, k) => t + gramos[k] * KCAL_POR_GRAMO[k], 0));
  const pct = conPct
    ? Object.fromEntries(claves.map((k) => [k, Math.round(hallado.pct[k])]))
    : Object.fromEntries(claves.map((k) => [k, Math.round((gramos[k] * KCAL_POR_GRAMO[k] * 100) / kcal)]));
  const suma = pct.p + pct.c + pct.g;
  if (conPct && (suma < 95 || suma > 105)) return { error: `Los porcentajes suman ${suma}%: revisá la captura.` };
  if (kcal < 800 || kcal > 6000) return { error: "El objetivo de calorías no parece correcto." };
  return { kcal, gramos, pct };
}
