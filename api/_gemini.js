// Conexión con Gemini (plan gratuito de Google, sin tarjeta: nunca cobra). No se publica como endpoint (guion bajo).
// La clave vive solo acá (GEMINI_API_KEY en Vercel): nunca llega al teléfono.
const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Google da de baja modelos: si uno no está, se prueba el siguiente. Cada modelo tiene su propio cupo diario.
const MODELOS = [process.env.GEMINI_MODELO, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"].filter(Boolean);

export const hayGemini = () => Boolean(process.env.GEMINI_API_KEY);

async function una(modelo, partes, esquema, temperatura) {
  const config = { responseMimeType: "application/json", responseSchema: esquema, temperature: temperatura, maxOutputTokens: 4096 };
  // En los 2.5 se apaga el razonamiento: responde más rápido y alcanza para esto.
  if (modelo.includes("2.5")) config.thinkingConfig = { thinkingBudget: 0 };
  const resp = await fetch(`${API}/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: partes }], generationConfig: config }),
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

// Devuelve { respuesta } o { error, estado } listo para mandar al teléfono.
export async function preguntarGemini({ partes, esquema, temperatura = 0.2 }) {
  let sinCupo = false;
  for (const modelo of MODELOS) {
    let r;
    try {
      r = await una(modelo, partes, esquema, temperatura);
    } catch {
      continue; // Tardó demasiado: se prueba con otro.
    }
    if (r.estado === 429) { sinCupo = true; continue; }
    if (r.estado === 200) return { respuesta: r.respuesta || {} };
    // Modelo dado de baja o respuesta rota: el siguiente.
  }
  if (sinCupo) return { estado: 429, error: "Se terminó el cupo gratis de hoy de la IA. Probá mañana." };
  return { estado: 502, error: "La IA no respondió. Probá de nuevo en un rato." };
}

const num = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const redondeo = (n) => Math.round(n * 10) / 10;

// Un alimento con gramos y valores cada 100 g. Lo imposible se descarta.
export function limpiarAlimento(a) {
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

export const ESQUEMA_ALIMENTO = {
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
};
