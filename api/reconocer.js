// Reconoce los alimentos de la foto de un plato con Gemini (plan gratuito de Google, sin tarjeta: nunca cobra).
// Devuelve cada alimento con sus gramos estimados y valores por 100 g; la app los cruza con su lista y la persona ajusta.
// La clave vive solo acá (GEMINI_API_KEY en Vercel): nunca llega al teléfono.
import { usuarioActual } from "./_auth.js";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Google da de baja modelos: si uno no está, se prueba el siguiente. Cada modelo tiene su propio cupo diario.
const MODELOS = [process.env.GEMINI_MODELO, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"].filter(Boolean);
const MAXIMO_BASE64 = 2_500_000;

const PEDIDO = `Sos nutricionista en Argentina. Mirá la foto y listá por separado cada alimento o bebida que se ve en el plato o la mesa (por ejemplo: milanesa de carne, puré de papa, ensalada de lechuga y tomate, pan francés).
- Nombres cortos en español rioplatense, como se buscan en una lista de alimentos: "Milanesa de carne frita", "Puré de papa", "Empanada de carne", "Arroz blanco".
- Si se repiten unidades iguales (3 empanadas, 2 huevos), un solo alimento con "unidades" y los gramos totales.
- "gramos": la porción que se ve, ya cocida, estimada por el tamaño del plato y los cubiertos. Bebidas en ml como gramos.
- Valores por 100 g típicos de la preparación argentina casera. Incluí el aceite o aderezo solo si se ve.
- Máximo 10 alimentos, del más importante al menos.
- "titulo": cómo llamaría la comida una persona ("Milanesa con puré").
- Si la foto no es de comida (una captura de pantalla, una persona, un paisaje), es_comida=false y la lista vacía.`;

const PEDIDO_ETIQUETA = `Es la foto de la tabla de información nutricional de un producto envasado (puede estar en español, inglés o portugués).
Copiá los números TAL CUAL están impresos, sin estimar:
- Si hay una columna "100 g" o "100 ml", usá esa y base="100g". Si solo está por porción, base="porcion".
- "porcion_g": los gramos o ml de una porción, si figura (si no, 0).
- kcal: el valor energético en kcal (si solo está en kJ, dividí por 4,184). Grasas = grasas totales. Carbohidratos = totales.
- "nombre" y "marca": solo si se leen en la foto; si no, vacío.
- Si la foto no muestra una tabla nutricional, es_etiqueta=false.`;

const ESQUEMA_ETIQUETA = {
  type: "OBJECT",
  properties: {
    es_etiqueta: { type: "BOOLEAN" },
    nombre: { type: "STRING" },
    marca: { type: "STRING" },
    base: { type: "STRING", enum: ["porcion", "100g"] },
    porcion_g: { type: "NUMBER" },
    kcal: { type: "NUMBER" },
    proteinas: { type: "NUMBER" },
    carbohidratos: { type: "NUMBER" },
    grasas: { type: "NUMBER" },
  },
  required: ["es_etiqueta", "base", "porcion_g", "kcal", "proteinas", "carbohidratos", "grasas"],
};

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    es_comida: { type: "BOOLEAN" },
    titulo: { type: "STRING" },
    alimentos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          unidades: { type: "NUMBER" },
          gramos: { type: "NUMBER" },
          kcal_100g: { type: "NUMBER" },
          proteinas_100g: { type: "NUMBER" },
          carbohidratos_100g: { type: "NUMBER" },
          grasas_100g: { type: "NUMBER" },
        },
        required: ["nombre", "gramos", "kcal_100g", "proteinas_100g", "carbohidratos_100g", "grasas_100g"],
      },
    },
  },
  required: ["es_comida", "titulo", "alimentos"],
};

const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const redondeo = (n) => Math.round(n * 10) / 10;

// Lo que la IA inventa fuera de lo posible se descarta.
function limpiar(a) {
  const nombre = String(a?.nombre || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const gramos = num(a?.gramos, 2000);
  const kcal = num(a?.kcal_100g, 950);
  const p = num(a?.proteinas_100g, 100) ?? 0;
  const c = num(a?.carbohidratos_100g, 100) ?? 0;
  const g = num(a?.grasas_100g, 100) ?? 0;
  if (!nombre || !gramos || kcal == null || p + c + g > 105) return null;
  const unidades = num(a?.unidades, 50);
  return { nombre, gramos: Math.round(gramos), unidades: unidades >= 1 ? Math.round(unidades) : null, por100: { kcal: Math.round(kcal), p: redondeo(p), c: redondeo(c), g: redondeo(g) } };
}

async function preguntar(modelo, imagen, clave, etiqueta = false) {
  const config = { responseMimeType: "application/json", responseSchema: etiqueta ? ESQUEMA_ETIQUETA : ESQUEMA, temperature: etiqueta ? 0 : 0.2, maxOutputTokens: 2048 };
  // En los 2.5 se apaga el razonamiento: responde más rápido y alcanza para esto.
  if (modelo.includes("2.5")) config.thinkingConfig = { thinkingBudget: 0 };
  const resp = await fetch(`${API}/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": clave },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: imagen } }, { text: etiqueta ? PEDIDO_ETIQUETA : PEDIDO }] }],
      generationConfig: config,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!resp.ok) return { estado: resp.status };
  const datos = await resp.json();
  const texto = (datos.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  try {
    return { estado: 200, respuesta: JSON.parse(texto) };
  } catch {
    return { estado: 502 };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!(await usuarioActual(req))) return res.status(401).json({ error: "Falta iniciar sesión" });
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) return res.status(503).json({ error: "El reconocimiento de fotos todavía no está activado" });

  const imagen = String(req.body?.imagen || "").replace(/^data:image\/\w+;base64,/, "");
  if (!imagen || imagen.length > MAXIMO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(imagen)) {
    return res.status(400).json({ error: "Foto no válida" });
  }

  const etiqueta = req.body?.modo === "etiqueta";
  let sinCupo = false;
  for (const modelo of MODELOS) {
    let r;
    try {
      r = await preguntar(modelo, imagen, clave, etiqueta);
    } catch {
      continue; // Tardó demasiado: se prueba con otro.
    }
    if (r.estado === 429) { sinCupo = true; continue; }
    if (r.estado !== 200) continue; // Modelo dado de baja o respuesta rota.
    if (etiqueta) {
      const e = r.respuesta || {};
      const n = (v, max) => num(v, max) ?? 0;
      const texto = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 60);
      return res.status(200).json({
        esEtiqueta: e.es_etiqueta !== false,
        nombre: texto(e.nombre),
        marca: texto(e.marca),
        base: e.base === "100g" ? "100g" : "porcion",
        porcionG: n(e.porcion_g, 2000) || null,
        valores: { kcal: n(e.kcal, 5000), p: n(e.proteinas, 500), c: n(e.carbohidratos, 500), g: n(e.grasas, 500) },
      });
    }
    const { es_comida: esComida, titulo, alimentos } = r.respuesta || {};
    const lista = (Array.isArray(alimentos) ? alimentos : []).map(limpiar).filter(Boolean).slice(0, 10);
    return res.status(200).json({
      esComida: esComida !== false && lista.length > 0,
      titulo: String(titulo || "").trim().slice(0, 80),
      alimentos: esComida === false ? [] : lista,
    });
  }
  if (sinCupo) return res.status(429).json({ error: "Se terminó el cupo gratis de hoy para reconocer fotos. Cargalo a mano o probá mañana." });
  return res.status(502).json({ error: "No pudimos reconocer la foto. Probá de nuevo o cargalo a mano." });
}
