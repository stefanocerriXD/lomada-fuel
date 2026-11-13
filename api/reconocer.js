// Reconoce los alimentos de la foto de un plato, o los números de una tabla nutricional, con Gemini.
// Devuelve cada alimento con sus gramos estimados y valores por 100 g; la app los cruza con su lista y la persona ajusta.
import { usuarioActual } from "./_auth.js";
import { ESQUEMA_ALIMENTO, hayGemini, limpiarAlimento, preguntarGemini } from "./_gemini.js";

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
    alimentos: { type: "ARRAY", items: ESQUEMA_ALIMENTO },
  },
  required: ["es_comida", "titulo", "alimentos"],
};

const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : 0;
};
const texto = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 60);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!(await usuarioActual(req))) return res.status(401).json({ error: "Falta iniciar sesión" });
  if (!hayGemini()) return res.status(503).json({ error: "El reconocimiento de fotos todavía no está activado" });

  const imagen = String(req.body?.imagen || "").replace(/^data:image\/\w+;base64,/, "");
  if (!imagen || imagen.length > MAXIMO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(imagen)) {
    return res.status(400).json({ error: "Foto no válida" });
  }

  const etiqueta = req.body?.modo === "etiqueta";
  const r = await preguntarGemini({
    partes: [{ inline_data: { mime_type: "image/jpeg", data: imagen } }, { text: etiqueta ? PEDIDO_ETIQUETA : PEDIDO }],
    esquema: etiqueta ? ESQUEMA_ETIQUETA : ESQUEMA,
    temperatura: etiqueta ? 0 : 0.2,
  });
  if (r.error) {
    const error = r.estado === 429 ? "Se terminó el cupo gratis de hoy para reconocer fotos. Cargalo a mano o probá mañana." : "No pudimos reconocer la foto. Probá de nuevo o cargalo a mano.";
    return res.status(r.estado).json({ error });
  }

  if (etiqueta) {
    const e = r.respuesta;
    return res.status(200).json({
      esEtiqueta: e.es_etiqueta !== false,
      nombre: texto(e.nombre),
      marca: texto(e.marca),
      base: e.base === "100g" ? "100g" : "porcion",
      porcionG: num(e.porcion_g, 2000) || null,
      valores: { kcal: num(e.kcal, 5000), p: num(e.proteinas, 500), c: num(e.carbohidratos, 500), g: num(e.grasas, 500) },
    });
  }
  const { es_comida: esComida, titulo, alimentos } = r.respuesta;
  const lista = (Array.isArray(alimentos) ? alimentos : []).map(limpiarAlimento).filter(Boolean).slice(0, 10);
  return res.status(200).json({
    esComida: esComida !== false && lista.length > 0,
    titulo: String(titulo || "").trim().slice(0, 80),
    alimentos: esComida === false ? [] : lista,
  });
}
