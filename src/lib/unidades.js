import { medidasDe } from "../data/alimentos-ar.js";

// Medidas caseras. Los pesos son aproximados y cubren lo más común en una cocina argentina.
const normalizar = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const GRAMOS = { nombre: "g", g: 1 };

// Medidas que tienen sentido según el tipo de alimento. Nada de "cucharada de cerdo":
// las cucharadas son solo para polvos, untables, salsas y aceites.
const REGLAS = [
  [/proteina en polvo|whey|creatina/, [["medida", 30]]],
  [/leche en polvo|cacao|cocoa|nesquik|chocolatada en polvo/, [["cucharada", 8], ["cucharadita", 3]]],
  [/azucar|sugar|edulcorante|stevia/, [["cucharadita", 5], ["sobrecito", 6]]],
  [/harina|maicena|almidon|pan rallado|rebozador/, [["cucharada", 10], ["taza", 125]]],
  [/\baceite\b|\boil\b/, [["cucharada", 14], ["cucharadita", 5]]],
  [/manteca|butter|margarina/, [["cucharadita", 7], ["cucharada", 14]]],
  [/dulce de leche|mermelada|\bmiel\b|honey|pasta de mani|peanut butter|nutella|avellana|queso untable|queso crema|finlandia/, [["cucharada", 20], ["cucharadita", 7]]],
  [/mayonesa|ketchup|mostaza|salsa|aderezo|chimichurri|pesto|vinagre|aceto/, [["cucharada", 15]]],
  [/queso rallado|parmesano rallado/, [["cucharada", 8]]],
  [/chia|semillas|lino|sesamo/, [["cucharada", 10]]],
  [/\bmate\b|yerba|\bcafe\b|coffee|\bte\b|\btea\b/, [["taza", 240]]],
  [/cerveza|\bbeer/, [["lata", 473], ["vaso", 300]]],
  [/\bvino\b|\bwine|espumante/, [["copa", 150]]],
  [/gaseosa|\bsoda\b|\bcola\b|energizante|isotonica/, [["vaso", 300], ["lata", 354]]],
  [/leche|\bmilk|jugo|juice|\bagua\b|bebida|licuado|batido|smoothie/, [["vaso", 200], ["taza", 240]]],
  [/yogh?ur/, [["pote", 190]]],
  [/kiwi/, [["unidad", 75]]],
  [/banana|platano/, [["unidad", 120]]],
  [/manzana|apple/, [["unidad", 160]]],
  [/naranja|orange/, [["unidad", 170]]],
  [/mandarina|tangerine/, [["unidad", 90]]],
  [/\bpera\b|\bpear/, [["unidad", 170]]],
  [/durazno|peach/, [["unidad", 130]]],
  [/ciruela|plum/, [["unidad", 70]]],
  [/limon|lemon/, [["unidad", 60]]],
  [/frutilla|strawberr/, [["taza", 150], ["unidad", 12]]],
  [/arandano|blueberr/, [["porción de 25 unidades", 35], ["taza", 150]]],
  [/\buvas?\b|grape/, [["racimo chico", 100]]],
  [/palta|avocado/, [["unidad", 150], ["media palta", 75]]],
  [/tomate|tomato/, [["unidad", 120]]],
  [/cebolla|onion/, [["unidad", 110]]],
  [/zanahoria|carrot/, [["unidad", 80]]],
  [/\bpapas?\b|potato|batata/, [["unidad", 170]]],
  [/morron|pepper/, [["unidad", 150]]],
  [/clara/, [["unidad", 33]]],
  [/huevo|\begg/, [["unidad", 50]]],
  [/pan lactal|pan de molde|rebanada/, [["rebanada", 25]]],
  [/tostada/, [["unidad", 10]]],
  [/\bpan\b|mignon|bread/, [["mignon", 50], ["rebanada", 30]]],
  [/galletita|galleta|cracker|cookie|oreo/, [["unidad", 10]]],
  [/alfajor/, [["unidad", 55]]],
  [/barrita|\bbarra\b|\bbar\b/, [["unidad", 30]]],
  [/chocolate/, [["cuadradito", 5], ["porción de 4 cuadraditos", 20]]],
  [/feta|jamon|\bham\b|pavita|salame|mortadela|fiambre/, [["feta", 20]]],
  [/queso/, [["porción", 30], ["feta", 20]]],
  [/avena|\boat/, [["porción", 40], ["cucharada", 10]]],
  [/granola|cereal|copos/, [["porción", 40], ["taza", 45]]],
  [/\bmani\b|nueces|almendra|castana|pistacho|frutos secos/, [["puñado", 30]]],
  [/milanesa/, [["milanesa", 150]]],
  [/empanada/, [["unidad", 90]]],
  [/pizza/, [["porción", 130]]],
  [/helado/, [["bocha", 80]]],
  [/carne|bife|lomo|vacio|asado|matambre|nalga|cuadril|peceto|pollo|pechuga|cerdo|bondiola|cordero|ternera|beef|chicken|pork|steak|pescado|merluza|salmon|atun|filet|fish|tuna|hamburguesa/, [["porción", 150], ["porción grande", 250]]],
  [/ensalada|lechuga|rucula|espinaca|acelga|verdura|brocoli|zapallo/, [["plato", 150]]],
  [/sopa|guiso|locro|puchero|estofado/, [["plato", 350]]],
];

// Pastas, arroz y legumbres: si el valor es del producto seco (más de 300 kcal cada 100 g), la porción es en crudo.
const SECOS = /\barroz|\brice|fideo|pasta|spaghetti|tallarin|lenteja|garbanzo|poroto|quinoa|polenta|cuscus/;

const sinCantidad = (texto) => texto.replace(/^1\s+/, "");

export function unidadesDe(alimento) {
  const nombre = normalizar(alimento.nombre);
  const lista = [];
  const sumar = (u) => {
    if (u && u.g > 0 && !lista.some((x) => x.nombre === u.nombre)) lista.push(u);
  };

  if (alimento.unidad) sumar(alimento.unidad);
  // La porción que declara el producto va primero: es la medida natural de ese envase.
  if (alimento.porcion) sumar({ nombre: sinCantidad(alimento.porcion.nombre), g: Number(alimento.porcion.g) });
  // Los alimentos de la lista propia traen sus medidas; lo guardado antes las recupera por el nombre.
  const propias = alimento.medidas || medidasDe(alimento.nombre);
  if (propias?.length) {
    propias.forEach(sumar);
    sumar(GRAMOS);
    return lista;
  }
  if (SECOS.test(nombre)) {
    const seco = Number(alimento.por100?.kcal) > 300;
    (seco ? [["porción en crudo", 80]] : [["plato", 200], ["taza", 160]]).forEach(([n, g]) => sumar({ nombre: n, g }));
  } else {
    const regla = REGLAS.find(([re]) => re.test(nombre));
    if (regla) regla[1].forEach(([n, g]) => sumar({ nombre: n, g }));
    else sumar({ nombre: "porción", g: 100 });
  }
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
