import { aFecha, fechaLocal, haceDias } from "./fechas.js";

export const TIPOS = [
  { id: "desayuno", texto: "Desayuno" },
  { id: "almuerzo", texto: "Almuerzo" },
  { id: "merienda", texto: "Merienda" },
  { id: "cena", texto: "Cena" },
];

export const TIPOS_TODOS = [{ id: "resumen", texto: "Todo el día" }, ...TIPOS];

export const tipoInfo = (id) => TIPOS_TODOS.find((t) => t.id === id) || TIPOS[0];

export const VACIO = { kcal: 0, p: 0, c: 0, g: 0 };

const macrosDe = (c) => ({ kcal: Number(c.calorias) || 0, p: Number(c.proteinas) || 0, c: Number(c.carbohidratos) || 0, g: Number(c.grasas) || 0 });
const CLAVES = ["kcal", "p", "c", "g"];
const sumar = (a, b) => Object.fromEntries(CLAVES.map((k) => [k, a[k] + b[k]]));

// Un total del día (Apple Salud o importado) y las comidas cargadas suelen ser lo mismo:
// se usa el mayor de cada dato en vez de sumarlos. Nada de lo guardado se modifica.
export function sumarComidas(lista) {
  const dias = new Map();
  for (const c of lista) {
    const clave = `${c.usuario_id}|${c.fecha}`;
    const dia = dias.get(clave) || { cargado: VACIO, total: VACIO };
    if (c.tipo === "resumen") dia.total = sumar(dia.total, macrosDe(c));
    else dia.cargado = sumar(dia.cargado, macrosDe(c));
    dias.set(clave, dia);
  }
  let total = VACIO;
  for (const { cargado, total: delDia } of dias.values()) {
    total = sumar(total, Object.fromEntries(CLAVES.map((k) => [k, Math.max(cargado[k], delDia[k])])));
  }
  return total;
}

export function macrosDeItem(item) {
  if (!item.por100) return { kcal: item.kcal || 0, p: item.p || 0, c: item.c || 0, g: item.g || 0 };
  const f = (Number(item.gramos) || 0) / 100;
  return { kcal: item.por100.kcal * f, p: item.por100.p * f, c: item.por100.c * f, g: item.por100.g * f };
}

export function sumarItems(items) {
  return items.map(macrosDeItem).reduce((t, m) => ({ kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, g: t.g + m.g }), VACIO);
}

// Días seguidos con al menos una comida, contando hasta hoy o ayer.
export function calcularRacha(fechas) {
  const dias = new Set(fechas);
  let dia = dias.has(fechaLocal()) ? fechaLocal() : haceDias(1);
  let racha = 0;
  while (dias.has(dia)) {
    racha += 1;
    dia = haceDias(1, aFecha(dia));
  }
  return racha;
}
