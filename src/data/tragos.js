// Bebidas y tragos para el modo fiesta. Valores aproximados cada 100 ml.
// El alcohol va aparte: tiene calorías (7 por gramo) pero no es proteína, carbo ni grasa.
const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// [nombre, kcal, carbos, alcohol en gramos, otros términos]
const BEBIDAS = [
  ["Fernet", 236, 5, 30.8, "branca"],
  ["Gin", 221, 0, 31.6, "ginebra"],
  ["Vodka", 221, 0, 31.6, "smirnoff absolut"],
  ["Ron", 221, 0, 31.6, "bacardi havana"],
  ["Whisky", 221, 0, 31.6, "whiskey"],
  ["Tequila", 221, 0, 31.6, ""],
  ["Campari", 234, 24, 19.7, "bitter"],
  ["Aperol", 150, 24, 8.7, ""],
  ["Gancia", 148, 15, 12.6, "vermut americano"],
  ["Vermut", 150, 16, 12.6, "cinzano martini"],
  ["Licor", 300, 35, 15, "baileys licor de cafe"],
  ["Cerveza rubia", 43, 3.5, 3.9, "birra lager"],
  ["Cerveza negra", 55, 5, 4.3, "birra stout"],
  ["Cerveza sin alcohol", 25, 5.5, 0.3, "birra"],
  ["Vino tinto", 85, 2.6, 10.3, "malbec"],
  ["Vino blanco", 82, 2.6, 9.5, "torrontes"],
  ["Espumante", 80, 1.5, 9.5, "champagne champan prosecco"],
  ["Sidra", 50, 6, 3.9, ""],
  ["Coca común", 42, 10.6, 0, "gaseosa cola"],
  ["Coca zero", 0, 0, 0, "gaseosa cola light sin azucar"],
  ["Sprite", 40, 10, 0, "lima limon seven up 7up gaseosa"],
  ["Sprite zero", 0, 0, 0, "lima limon gaseosa sin azucar"],
  ["Gaseosa de pomelo", 38, 9.5, 0, "paso de los toros"],
  ["Pomelo light", 2, 0.4, 0, "paso de los toros sin azucar"],
  ["Tónica", 34, 8.8, 0, "agua tonica schweppes"],
  ["Tónica light", 2, 0.5, 0, "agua tonica sin azucar"],
  ["Speed", 45, 11, 0, "energizante red bull"],
  ["Speed sin azúcar", 2, 0.5, 0, "energizante red bull"],
  ["Jugo de naranja", 45, 10.4, 0, "exprimido"],
  ["Jugo de limón", 22, 7, 0, ""],
  ["Soda", 0, 0, 0, "agua con gas"],
  ["Agua", 0, 0, 0, ""],
];

// [nombre, mezcla: [bebida, parte], tamaño sugerido en ml, otros términos]
const TRAGOS = [
  ["Fernet con coca", [["Fernet", 0.3], ["Coca común", 0.7]], 300, "fernandito"],
  ["Fernet con coca zero", [["Fernet", 0.3], ["Coca zero", 0.7]], 300, "fernandito light"],
  ["Gin tonic", [["Gin", 0.25], ["Tónica", 0.75]], 300, ""],
  ["Gin tonic light", [["Gin", 0.25], ["Tónica light", 0.75]], 300, ""],
  ["Vodka con Sprite", [["Vodka", 0.25], ["Sprite", 0.75]], 300, ""],
  ["Vodka con Sprite zero", [["Vodka", 0.25], ["Sprite zero", 0.75]], 300, ""],
  ["Vodka con speed", [["Vodka", 0.25], ["Speed", 0.75]], 300, "red bull"],
  ["Destornillador", [["Vodka", 0.25], ["Jugo de naranja", 0.75]], 300, "vodka con jugo de naranja"],
  ["Cuba libre", [["Ron", 0.25], ["Coca común", 0.75]], 300, "ron con coca"],
  ["Campari con naranja", [["Campari", 0.3], ["Jugo de naranja", 0.7]], 300, ""],
  ["Aperol spritz", [["Aperol", 0.35], ["Espumante", 0.5], ["Soda", 0.15]], 250, ""],
  ["Gancia con Sprite", [["Gancia", 0.4], ["Sprite", 0.6]], 300, "gancia batido"],
  ["Whisky con hielo", [["Whisky", 1]], 60, "on the rocks"],
  ["Shot de tequila", [["Tequila", 1]], 40, "chupito"],
  ["Cerveza rubia", [["Cerveza rubia", 1]], 473, "birra"],
  ["Cerveza negra", [["Cerveza negra", 1]], 473, "birra"],
  ["Vino tinto", [["Vino tinto", 1]], 150, ""],
  ["Vino blanco", [["Vino blanco", 1]], 150, ""],
  ["Espumante", [["Espumante", 1]], 150, "champagne"],
  ["Agua", [["Agua", 1]], 300, ""],
];

export const BEBIDAS_BASE = BEBIDAS.map(([nombre, kcal, c, alcohol, otros]) => ({ nombre, kcal, c, alcohol, indice: normal(`${nombre} ${otros}`) }));
const PORNOMBRE = new Map(BEBIDAS_BASE.map((b) => [b.nombre, b]));

// Los valores cada 100 ml de una mezcla, según cuánto lleva de cada bebida.
export function valoresDeMezcla(mezcla) {
  const total = mezcla.reduce((t, [, parte]) => t + parte, 0) || 1;
  return mezcla.reduce(
    (t, [nombre, parte]) => {
      const b = PORNOMBRE.get(nombre);
      if (!b) return t;
      const f = parte / total;
      return { kcal: t.kcal + b.kcal * f, c: t.c + b.c * f, alcohol: t.alcohol + b.alcohol * f };
    },
    { kcal: 0, c: 0, alcohol: 0 },
  );
}

export const TRAGOS_BASE = TRAGOS.map(([nombre, mezcla, ml, otros]) => ({
  id: `trago-${normal(nombre).replace(/\W+/g, "-")}`,
  nombre,
  mezcla,
  ml,
  por100: valoresDeMezcla(mezcla),
  indice: normal(`${nombre} ${otros} ${mezcla.map(([b]) => b).join(" ")}`),
}));

// Bebidas sueltas también se toman solas: "Cerveza rubia", "Soda".
const SOLAS = BEBIDAS_BASE.filter((b) => !TRAGOS_BASE.some((t) => t.nombre === b.nombre)).map((b) => ({
  id: `bebida-${normal(b.nombre).replace(/\W+/g, "-")}`,
  nombre: b.nombre,
  mezcla: [[b.nombre, 1]],
  ml: b.alcohol > 20 ? 60 : 300,
  por100: { kcal: b.kcal, c: b.c, alcohol: b.alcohol },
  indice: b.indice,
}));

export function buscarTragos(texto) {
  const partes = normal(texto).split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  return [...TRAGOS_BASE, ...SOLAS]
    .filter((t) => partes.every((p) => t.indice.split(" ").some((w) => w.startsWith(p))))
    .slice(0, 8);
}

export const TAMANOS = [
  ["Vaso", 300],
  ["Lata", 473],
  ["Pinta", 500],
  ["Copa", 150],
  ["Shot", 40],
];

// Un vaso de algo: sus macros según los ml.
export function vasoDe(trago, ml) {
  const f = ml / 100;
  const r = (n) => Math.round(n * 10) / 10;
  return {
    nombre: trago.nombre,
    fuente: "trago",
    ml,
    medida: `${ml} ml`,
    mezcla: trago.mezcla || null,
    kcal: Math.round(trago.por100.kcal * f),
    p: r((trago.por100.p || 0) * f),
    c: r((trago.por100.c || 0) * f),
    g: r((trago.por100.g || 0) * f),
    alcohol: r((trago.por100.alcohol || 0) * f),
  };
}
