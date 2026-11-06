// Medidas caseras. Los pesos son aproximados y cubren lo más común en una cocina argentina.
const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const GRAMOS = { nombre: "g", g: 1 };
const CUCHARADA = { nombre: "cucharada", g: 15 };
const CUCHARADITA = { nombre: "cucharadita", g: 5 };

// Cada regla agrega las medidas que tienen sentido para ese alimento.
const REGLAS = [
  [/kiwi/, [["unidad", 75]]],
  [/banana|platano/, [["unidad", 120]]],
  [/manzana|apple/, [["unidad", 160]]],
  [/naranja|orange/, [["unidad", 170]]],
  [/mandarina|tangerine/, [["unidad", 90]]],
  [/\bpera\b|\bpear/, [["unidad", 170]]],
  [/durazno|peach/, [["unidad", 130]]],
  [/ciruela|plum/, [["unidad", 70]]],
  [/limon|lemon/, [["unidad", 60]]],
  [/frutilla|strawberr/, [["unidad", 12], ["taza", 150]]],
  [/arandano|blueberr/, [["puñado", 40], ["taza", 150]]],
  [/\buvas?\b|grape/, [["racimo chico", 100], ["unidad", 6]]],
  [/palta|avocado/, [["unidad", 150], ["media", 75], ["cucharada", 15]]],
  [/tomate|tomato/, [["unidad", 120]]],
  [/cebolla|onion/, [["unidad", 110]]],
  [/zanahoria|carrot/, [["unidad", 80]]],
  [/\bpapas?\b|potato|batata/, [["unidad", 170]]],
  [/morron|pepper/, [["unidad", 150]]],
  [/huevo|\begg/, [["unidad", 50]]],
  [/clara/, [["unidad", 33]]],
  [/pan lactal|pan de molde|rebanada/, [["rebanada", 25]]],
  [/tostada/, [["unidad", 20]]],
  [/\bpan\b|mignon|bread/, [["mignon", 50], ["rebanada", 30]]],
  [/galletita|galleta|cracker|cookie|oreo/, [["unidad", 11]]],
  [/alfajor/, [["unidad", 55]]],
  [/feta|jamon|\bham\b|pavita/, [["feta", 20]]],
  [/queso rallado/, [["cucharada", 8]]],
  [/queso untable|queso crema/, [["cucharada", 20]]],
  [/queso/, [["feta", 25], ["porción", 40]]],
  [/\baceite\b|\boil\b/, [["cucharada", 14], ["cucharadita", 5]]],
  [/manteca|butter/, [["cucharadita", 7], ["cucharada", 14]]],
  [/dulce de leche|mermelada|\bmiel\b|honey|pasta de mani/, [["cucharada", 20], ["cucharadita", 7]]],
  [/azucar|sugar|cacao/, [["cucharadita", 5], ["cucharada", 12]]],
  [/mayonesa|ketchup|mostaza/, [["cucharada", 15]]],
  [/avena|\boat/, [["cucharada", 10], ["taza", 80]]],
  [/granola|cereal/, [["taza", 45], ["cucharada", 10]]],
  [/proteina en polvo|whey/, [["medida", 30]]],
  [/\barroz|\brice|fideos|pasta|lentejas|garbanzos/, [["taza", 180], ["cucharada", 20]]],
  [/leche|\bmilk|jugo|gaseosa|\bagua\b|cafe|\bte\b/, [["vaso", 200], ["taza", 240]]],
  [/yogur/, [["pote", 190], ["cucharada", 15]]],
  [/cerveza|\bbeer/, [["lata", 473], ["vaso", 300]]],
  [/\bvino\b|\bwine/, [["copa", 150]]],
  [/\bmani\b|nueces|almendra|castana/, [["puñado", 30]]],
];

const sinCantidad = (texto) => texto.replace(/^1\s+/, "");

export function unidadesDe(alimento) {
  const nombre = normalizar(alimento.nombre);
  const lista = [];
  const sumar = (u) => {
    if (u.g > 0 && !lista.some((x) => x.nombre === u.nombre)) lista.push(u);
  };

  if (alimento.unidad) sumar(alimento.unidad);
  const regla = REGLAS.find(([re]) => re.test(nombre));
  // La porción propia va primero: "1 milanesa" o "1 bocha" es la medida natural de ese alimento.
  if (alimento.porcion) sumar({ nombre: sinCantidad(alimento.porcion.nombre), g: Number(alimento.porcion.g) });
  regla?.[1].forEach(([n, g]) => sumar({ nombre: n, g }));
  if (!regla) sumar({ nombre: "porción", g: 100 });
  sumar(CUCHARADA);
  sumar(CUCHARADITA);
  sumar(GRAMOS);
  return lista;
}

export function prepararItem(alimento) {
  const unidades = unidadesDe(alimento);
  // Lo que ya viene con gramos, como una receta ajustada, conserva su cantidad exacta.
  const conGramos = alimento.gramos && !alimento.unidad;
  const unidad = alimento.unidad || (conGramos ? GRAMOS : unidades[0]);
  const cantidad = alimento.cantidad ?? (conGramos ? alimento.gramos : 1);
  return { ...alimento, unidad, cantidad, gramos: Math.round(cantidad * unidad.g * 10) / 10 };
}

export function conCantidad(item, cantidad) {
  const valor = Math.max(0, cantidad);
  return { ...item, cantidad: valor, gramos: Math.round(valor * item.unidad.g * 10) / 10 };
}

// Al cambiar de medida se mantiene el número de unidades más cómodo: 1 de la nueva medida.
export function conUnidad(item, unidad) {
  return conCantidad({ ...item, unidad }, unidad.g === 1 ? Math.round(item.gramos) || 100 : 1);
}

export function restar(item) {
  if (item.unidad.g === 1) return Math.max(0, item.cantidad - 10);
  return item.cantidad <= 1 ? 0.5 : item.cantidad - 1;
}

export function sumar(item) {
  if (item.unidad.g === 1) return item.cantidad + 10;
  return item.cantidad < 1 ? 1 : item.cantidad + 1;
}

export function textoMedida(unidad) {
  return unidad.g === 1 ? "gramos" : `${unidad.nombre} (${unidad.g} g)`;
}
