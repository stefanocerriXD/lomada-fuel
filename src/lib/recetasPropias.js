// Recetas propias: un budín, una tarta o un guiso que cada uno arma una vez con sus ingredientes
// y después carga por porción. La receta se convierte en un alimento más de la búsqueda.
import { macrosDeItem } from "./macros.js";

const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function totalesDeReceta(ingredientes = []) {
  return ingredientes.reduce(
    (t, i) => {
      const m = macrosDeItem(i);
      return { kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, g: t.g + m.g, gramos: t.gramos + (Number(i.gramos) || 0) };
    },
    { kcal: 0, p: 0, c: 0, g: 0, gramos: 0 },
  );
}

// El peso de la receta terminada manda (el budín pierde agua en el horno); si no está, la suma de los ingredientes.
export function pesoDeReceta(receta) {
  const porciones = Math.max(1, Number(receta.porciones) || 1);
  return Number(receta.peso_final) || totalesDeReceta(receta.ingredientes).gramos || porciones * 100;
}

export function recetaComoAlimento(receta) {
  const total = totalesDeReceta(receta.ingredientes);
  const porciones = Math.max(1, Number(receta.porciones) || 1);
  const peso = pesoDeReceta(receta);
  const por100 = Object.fromEntries(["kcal", "p", "c", "g"].map((k) => [k, Math.round((total[k] / peso) * 1000) / 10]));
  const porcion = Math.round((peso / porciones) * 10) / 10;
  return {
    id: `receta-${receta.id}`,
    receta_id: receta.id,
    nombre: receta.nombre,
    marca: "Tu receta",
    fuente: "receta",
    por100,
    medidas: porciones > 1 ? [{ nombre: `porción (1/${porciones})`, g: porcion }, { nombre: "receta entera", g: peso }] : [{ nombre: "receta entera", g: peso }],
  };
}

export function buscarRecetas(recetas, texto) {
  const partes = normal(texto).split(/\s+/).filter((p) => p.length > 1);
  if (!partes.length) return [];
  return recetas.filter((r) => {
    const palabras = normal(r.nombre).split(/[\s,]+/);
    return partes.every((p) => palabras.some((w) => w.startsWith(p)));
  });
}
