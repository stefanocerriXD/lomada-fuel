import { calcularRacha, sumarComidas } from "./macros.js";

const generico = (a) => a.fuente === "foto" || /^importado$|\simportado$/i.test(a.nombre || "");

// Un día por entrada, del más nuevo al más viejo.
export function porDia(comidas) {
  const dias = new Map();
  for (const c of comidas) {
    if (!dias.has(c.fecha)) dias.set(c.fecha, []);
    dias.get(c.fecha).push(c);
  }
  return [...dias]
    .map(([fecha, lista]) => ({ fecha, lista, total: sumarComidas(lista) }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export function estadisticas(comidas) {
  const dias = porDia(comidas);
  const conCalorias = dias.filter((d) => d.total.kcal > 0);
  const promedio = (k) => (conCalorias.length ? Math.round(conCalorias.reduce((t, d) => t + d.total[k], 0) / conCalorias.length) : 0);
  return {
    dias: dias.length,
    racha: calcularRacha(comidas.map((c) => c.fecha)),
    fotos: comidas.filter((c) => c.foto_path).length,
    kcal: promedio("kcal"),
    proteinas: promedio("p"),
  };
}

function nombresDe(comida) {
  const alimentos = (comida.alimentos || []).filter((a) => a.nombre && !generico(a));
  if (alimentos.length) return alimentos.map((a) => a.nombre);
  const importada = (comida.alimentos || []).some(generico);
  return !importada && comida.tipo !== "resumen" && comida.descripcion ? [comida.descripcion] : [];
}

// Lo que más se repite, contando una vez por comida.
export function comidasFavoritas(comidas, tope = 5) {
  const conteo = new Map();
  for (const c of comidas) {
    for (const nombre of new Set(nombresDe(c).map((n) => n.trim()))) {
      const clave = nombre.toLowerCase();
      const actual = conteo.get(clave) || { nombre, veces: 0 };
      actual.veces += 1;
      conteo.set(clave, actual);
    }
  }
  return [...conteo.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre)).slice(0, tope);
}
