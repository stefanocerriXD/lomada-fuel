// Lo que la IA vio en la foto se convierte en alimentos de la app.
// Si el alimento está en tus comidas de siempre o en la lista argentina, se usan esos valores y sus medidas;
// si no, quedan los valores que estimó la IA. Las cantidades siempre se pueden corregir.
import { buscarTipicos } from "../data/alimentos-ar.js";
import { buscarEnHistorial } from "./historial.js";
import { prepararItem, unidadesDe } from "./unidades.js";

// Solo se toma un parecido si las calorías no son de otro planeta: "pollo" no puede terminar en "pollo frito con papas".
const parecido = (base, ia) => {
  const a = Number(base?.por100?.kcal);
  const b = Number(ia.por100.kcal);
  if (!Number.isFinite(a) || !base.por100) return false;
  if (b < 40 || a < 40) return Math.abs(a - b) <= 40;
  return a / b >= 0.65 && a / b <= 1.5;
};

function buscarBase(ia, propios) {
  const nombre = ia.nombre;
  const tuyo = buscarEnHistorial(propios, nombre).map((h) => h.alimento).find((a) => a.por100 && parecido(a, ia));
  if (tuyo) return tuyo;
  return buscarTipicos(nombre).find((a) => parecido(a, ia)) || null;
}

// Si los gramos caen cerca de una medida casera (2 empanadas, 1 milanesa), se usa esa medida.
function conMedida(alimento, gramos, unidades) {
  const medida = unidadesDe(alimento).find((u) => u.g > 1);
  if (medida) {
    const cantidad = unidades || Math.round((gramos / medida.g) * 2) / 2;
    if (cantidad >= 0.5 && cantidad <= 12 && Math.abs(cantidad * medida.g - gramos) <= gramos * (unidades ? 0.35 : 0.2)) {
      return prepararItem({ ...alimento, unidad: medida, cantidad });
    }
  }
  return prepararItem({ ...alimento, unidad: undefined, gramos });
}

export function itemsDeFoto(alimentos, propios = []) {
  return alimentos.map((ia) => {
    const base = buscarBase(ia, propios);
    const alimento = base
      ? { ...base, id: undefined, ia: true }
      : { nombre: ia.nombre, marca: "", fuente: "ia", por100: ia.por100, ia: true };
    // Lo de la lista o el historial viene con su cantidad: se reemplaza por lo que se ve en la foto.
    const { cantidad, unidad, gramos, postre, salud_id, estimado, ...limpio } = alimento; // eslint-disable-line no-unused-vars
    return { ...conMedida(limpio, ia.gramos, ia.unidades), id: crypto.randomUUID() };
  });
}
