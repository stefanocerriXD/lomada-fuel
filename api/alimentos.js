// Buscador de alimentos. Une dos bases abiertas:
// - Open Food Facts: productos envasados de Argentina y del mundo, y lectura por código de barras.
// - USDA FoodData Central: alimentos genéricos. Solo está en inglés, por eso se traducen los términos.
import { usuarioLogueado } from "./_auth.js";

const AGENTE = "LomadaFuel/1.0 (app personal entre amigos)";
const CAMPOS = "code,product_name,brands,nutriments,countries_tags,serving_quantity";
const TIEMPO_MAXIMO = 7000;

const ES_EN = {
  pollo: "chicken", pechuga: "chicken breast", carne: "beef", vaca: "beef", cerdo: "pork", pavo: "turkey", cordero: "lamb",
  pescado: "fish", salmon: "salmon", atun: "tuna", merluza: "hake", camaron: "shrimp", langostino: "shrimp",
  huevo: "egg", clara: "egg white", leche: "milk", queso: "cheese", yogur: "yogurt", manteca: "butter", crema: "cream",
  arroz: "rice", fideos: "pasta", pasta: "pasta", pan: "bread", avena: "oats", harina: "flour", maiz: "corn", quinoa: "quinoa",
  papa: "potato", batata: "sweet potato", zanahoria: "carrot", tomate: "tomato", lechuga: "lettuce", cebolla: "onion",
  zapallo: "squash", zapallito: "zucchini", berenjena: "eggplant", brocoli: "broccoli", espinaca: "spinach", acelga: "chard",
  morron: "bell pepper", pepino: "cucumber", remolacha: "beet", repollo: "cabbage", coliflor: "cauliflower", ajo: "garlic",
  lenteja: "lentils", garbanzo: "chickpeas", poroto: "beans", soja: "soybeans", tofu: "tofu",
  manzana: "apple", banana: "banana", naranja: "orange", mandarina: "tangerine", pera: "pear", durazno: "peach", uva: "grapes",
  frutilla: "strawberry", arandano: "blueberry", kiwi: "kiwi", anana: "pineapple", sandia: "watermelon", melon: "melon",
  limon: "lemon", palta: "avocado", mango: "mango", ciruela: "plum", cereza: "cherry",
  mani: "peanuts", almendra: "almonds", nuez: "walnuts", nueces: "walnuts", castana: "cashew",
  aceite: "oil", oliva: "olive oil", azucar: "sugar", miel: "honey", chocolate: "chocolate", cacao: "cocoa",
  jamon: "ham", salchicha: "sausage", panceta: "bacon", cerveza: "beer", vino: "wine", cafe: "coffee", te: "tea",
};

const RELLENO = new Set(["de", "del", "con", "sin", "al", "a", "la", "el", "y", "en"]);

const sinAcentos = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function numero(v) {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
}

// Devuelve null si faltan datos o son imposibles: la base es colaborativa y a veces trae errores de carga.
function validar(kcal, p, c, g) {
  if (kcal == null || kcal < 0 || kcal > 950) return null;
  if (p == null && c == null && g == null && kcal > 0) return null;
  const macros = [p ?? 0, c ?? 0, g ?? 0];
  if (macros.some((m) => m < 0 || m > 100) || macros.reduce((a, b) => a + b, 0) > 105) return null;
  return { kcal: Math.round(kcal), p: macros[0], c: macros[1], g: macros[2] };
}

function desdeOFF(prod) {
  const n = prod.nutriments || {};
  const kj = numero(n.energy_100g);
  const kcal = numero(n["energy-kcal_100g"]) ?? (kj != null ? kj / 4.184 : null);
  const por100 = validar(kcal, numero(n.proteins_100g), numero(n.carbohydrates_100g), numero(n.fat_100g));
  const marca = [].concat(prod.brands || []).join(",").split(",")[0].trim();
  // Algunos productos están cargados sin nombre pero con marca y valores completos.
  const nombre = (typeof prod.product_name === "string" && prod.product_name.trim()) || marca;
  if (!por100 || !nombre) return null;
  const paises = [].concat(prod.countries_tags || []).join(" ");
  const argentino = paises.includes("argentina") || String(prod.code || "").startsWith("779");
  const porcion = numero(prod.serving_quantity);
  return {
    id: `off-${prod.code}`,
    nombre,
    marca,
    fuente: argentino ? "argentina" : "mundo",
    por100,
    porcion: porcion && porcion > 0 && porcion < 2000 ? { nombre: "1 porción", g: porcion } : null,
  };
}

async function pedirJSON(url) {
  const resp = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(TIEMPO_MAXIMO) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function buscarOFF(q, filtro) {
  const consulta = filtro ? `${q} AND ${filtro}` : q;
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(consulta)}&page_size=40&langs=es,en&fields=${CAMPOS}`;
  const datos = await pedirJSON(url);
  return (datos.hits || []).map(desdeOFF).filter(Boolean);
}

async function buscarUSDA(q) {
  const palabras = sinAcentos(q).split(/\s+/).filter((p) => !RELLENO.has(p));
  const traducidas = palabras.map((p) => ES_EN[p] || ES_EN[p.replace(/e?s$/, "")]);
  // Con una traducción parcial USDA devuelve cualquier cosa: "dulce de leche" traía galletitas.
  if (!traducidas.length || !traducidas.every(Boolean)) return [];
  const clave = process.env.USDA_API_KEY || "DEMO_KEY";
  const consulta = encodeURIComponent([...new Set(traducidas)].join(" "));
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${clave}&query=${consulta}&pageSize=8&dataType=Foundation,SR%20Legacy`;
  const datos = await pedirJSON(url);
  return (datos.foods || [])
    .map((f) => {
      const valor = (nombre, unidad) =>
        (f.foodNutrients || []).find((x) => x.nutrientName?.startsWith(nombre) && (!unidad || x.unitName === unidad))?.value ?? null;
      const por100 = validar(valor("Energy", "KCAL"), valor("Protein"), valor("Carbohydrate"), valor("Total lipid"));
      return por100 ? { id: `usda-${f.fdcId}`, nombre: f.description, marca: "", fuente: "usda", por100, porcion: null } : null;
    })
    .filter(Boolean);
}

// Los productos con todo en cero suelen ser cargas incompletas: se muestran al final de su grupo.
const primeroConDatos = (lista) => [...lista].sort((a, b) => Number(b.por100.kcal > 0) - Number(a.por100.kcal > 0));

function sinRepetidos(listas) {
  const vistos = new Set();
  return listas.flat().filter((a) => {
    const clave = sinAcentos(`${a.nombre}|${a.marca}`);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

export default async function handler(req, res) {
  if (!(await usuarioLogueado(req))) return res.status(401).json({ error: "Falta iniciar sesión" });

  const { q, codigo } = req.query;

  if (codigo) {
    if (!/^\d{6,14}$/.test(codigo)) return res.status(400).json({ error: "Código no válido" });
    try {
      const datos = await pedirJSON(`https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=${CAMPOS}`);
      const alimento = datos.product ? desdeOFF({ ...datos.product, code: codigo }) : null;
      return res.status(200).json({ alimento });
    } catch (err) {
      // Open Food Facts responde 404 cuando el producto no está cargado.
      if (String(err.message).includes("404")) return res.status(200).json({ alimento: null });
      return res.status(502).json({ error: "La base de productos no respondió" });
    }
  }

  const termino = String(q || "").trim().slice(0, 80);
  if (termino.length < 2) return res.status(400).json({ error: "Escribí al menos 2 letras" });

  // Se limpian los operadores de búsqueda para que el texto del usuario no altere la consulta.
  const limpio = termino.replace(/[^\p{L}\p{N}\s&'-]/gu, " ");
  const [ar, mundo, usda] = await Promise.allSettled([
    buscarOFF(limpio, 'countries_tags:"en:argentina"'),
    buscarOFF(limpio),
    buscarUSDA(limpio),
  ]);
  const ok = (r) => (r.status === "fulfilled" ? r.value : []);
  const resultados = sinRepetidos([primeroConDatos(ok(ar)).slice(0, 18), ok(usda).slice(0, 6), primeroConDatos(ok(mundo)).slice(0, 8)]);
  return res.status(200).json({
    resultados,
    parcial: [ar, mundo, usda].some((r) => r.status === "rejected"),
  });
}
