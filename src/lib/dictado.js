// Comida dictada o escrita en una frase: "dos empanadas de carne, una ensalada y 200 g de pollo".
// Sin IA, se arma igual con la lista argentina y tus alimentos de siempre; lo que no encuentra queda para buscar a mano.
import { buscarTipicos } from "../data/alimentos-ar.js";
import { buscarEnHistorial } from "./historial.js";
import { prepararItem } from "./unidades.js";

const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const NUMEROS = { un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

// Separa la frase en alimentos.
export function partesDelDictado(texto) {
  return String(texto || "")
    .split(/,|;|\n|\+|\s+y\s+|\s+con\s+|\s+mas\s+|\s+más\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
}

export function leerParte(parte) {
  let resto = normal(parte).replace(/^(me comi|comi|tome|me tome|almorce|cene|desayune|merende)\s+/, "").trim();
  let cantidad = null;
  let gramos = null;
  const conGramos = resto.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos|ml|cc)\b\s*(de\s+)?/);
  if (conGramos) {
    gramos = Number(conGramos[1].replace(",", "."));
    resto = resto.slice(conGramos[0].length);
  } else {
    const numero = resto.match(/^(\d+(?:[.,]\d+)?|un|una|uno|medio|media|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+/);
    if (numero) {
      cantidad = NUMEROS[numero[1]] ?? Number(numero[1].replace(",", "."));
      resto = resto.slice(numero[0].length);
    }
  }
  resto = resto.replace(/^(de|del|la|el|los|las|unos|unas)\s+/, "").trim();
  return { nombre: resto, cantidad, gramos };
}

export function itemsDelDictado(texto, propios = []) {
  const items = [];
  const sinEncontrar = [];
  for (const parte of partesDelDictado(texto)) {
    const { nombre, cantidad, gramos } = leerParte(parte);
    if (!nombre) continue;
    // Plurales: "empanadas" encuentra "Empanada".
    const singular = nombre.split(" ").map((w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w)).join(" ");
    const base = buscarEnHistorial(propios, singular).map((h) => h.alimento).find((a) => a.por100) || buscarTipicos(singular)[0] || buscarTipicos(nombre)[0];
    if (!base) {
      sinEncontrar.push(parte.trim());
      continue;
    }
    const { cantidad: _c, unidad: _u, gramos: _g, id: _id, postre: _p, salud_id: _s, ...limpio } = base; // eslint-disable-line no-unused-vars
    const alimento = gramos ? { ...limpio, gramos } : cantidad ? { ...limpio, cantidad } : limpio;
    items.push({ ...prepararItem(alimento), id: crypto.randomUUID(), ia: "voz" });
  }
  return { items, sinEncontrar };
}
