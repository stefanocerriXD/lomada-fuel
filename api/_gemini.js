// Conexión con Gemini (plan gratuito de Google, sin tarjeta: nunca cobra). No se publica como endpoint (guion bajo).
// La clave vive solo acá (GEMINI_API_KEY en Vercel): nunca llega al teléfono.
const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Google da de baja modelos: si uno no está, se prueba el siguiente. Cada modelo tiene su propio cupo diario.
// Al final va Gemma (también gratis, con mucho más cupo por día; no tiene modo JSON, así que se le pide en el texto).
const MODELOS = [process.env.GEMINI_MODELO, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest", "gemma-3-27b-it", "gemma-3-12b-it"].filter(Boolean);
// Cuánto se espera en total (la función de Vercel tiene 60 s) y como mucho por modelo.
const TIEMPO_TOTAL = 50000;
const TIEMPO_MODELO = 20000;

export const hayGemini = () => Boolean(process.env.GEMINI_API_KEY);

// Google contesta 429 tanto si se pasó el límite por minuto (se libera solo en segundos) como el del día.
// Se lee el detalle para saber cuál fue y no avisar "se terminó el cupo" por un pico de pedidos.
async function tipoDeLimite(resp) {
  try {
    const datos = await resp.json();
    const ids = (datos?.error?.details || []).flatMap((d) => (d.violations || []).map((v) => String(v.quotaId || "")));
    if (ids.some((id) => /PerDay/i.test(id))) return "dia";
    if (ids.some((id) => /PerMinute/i.test(id))) return "minuto";
  } catch {
    // Sin detalle: se toma como del día, para no perder el aviso.
  }
  return "dia";
}

// Saca el JSON de una respuesta en texto (Gemma a veces lo envuelve en ```json).
function leerJson(texto) {
  const limpio = texto.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const i = limpio.indexOf("{");
    const f = limpio.lastIndexOf("}");
    if (i >= 0 && f > i) return JSON.parse(limpio.slice(i, f + 1));
    throw new Error("sin_json");
  }
}

async function una(modelo, partes, esquema, temperatura, espera = TIEMPO_MODELO) {
  const gemma = modelo.startsWith("gemma");
  // El razonamiento de los modelos nuevos gasta de este mismo tope: con 4096 la respuesta a veces salía cortada.
  const config = { temperature: temperatura, maxOutputTokens: 8192 };
  if (gemma) {
    partes = [...partes, { text: `Respondé SOLO con un objeto JSON válido, sin texto antes ni después, que siga este esquema: ${JSON.stringify(esquema)}` }];
  } else {
    config.responseMimeType = "application/json";
    config.responseSchema = esquema;
  }
  // En los 2.5 se apaga el razonamiento: responde más rápido y alcanza para esto.
  if (modelo.includes("2.5")) config.thinkingConfig = { thinkingBudget: 0 };
  // En los Gemini 3, lo mínimo de razonamiento (no se puede apagar del todo).
  else if (modelo.startsWith("gemini-3")) config.thinkingConfig = { thinkingLevel: "low" };
  const resp = await fetch(`${API}/${modelo}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: partes }], generationConfig: config }),
    signal: AbortSignal.timeout(espera),
  });
  if (resp.status === 429) return { estado: 429, limite: await tipoDeLimite(resp) };
  if (!resp.ok) return { estado: resp.status };
  const datos = await resp.json();
  const candidato = datos.candidates?.[0];
  // Partes "thought" son el razonamiento: no van en la respuesta.
  const texto = (candidato?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  try {
    return { estado: 200, respuesta: leerJson(texto) };
  } catch {
    return { estado: 502, motivo: candidato?.finishReason || "sin_json" };
  }
}

// Tope de IA por persona (SQL 050): se mira antes de preguntar y se suma solo si la IA respondió.
// Con la sesión de la persona (token) o con la llave del Atajo (llave). Si la base no responde, no se frena a nadie.
export function cupoPersona({ token, llave }) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const llamar = async (sumar) => {
    if (!url || !clave) return null;
    try {
      const r = await fetch(`${url}/rest/v1/rpc/${llave ? "usar_ia_con_llave" : "usar_ia"}`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: clave, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(llave ? { p_token: llave, p_sumar: sumar } : { p_sumar: sumar }),
        signal: AbortSignal.timeout(5000),
      });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  return { mirar: () => llamar(false), sumar: () => llamar(true) };
}

export const textoTope = (tope) => `Llegaste a los ${tope || 25} usos de IA de hoy. Mañana se renuevan; mientras, cargalo a mano.`;

// Sin cupo en todos los modelos: la base anota el día y le avisa al admin (una vez por día).
async function avisarSinCupo() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !clave) return;
  try {
    await fetch(`${url}/rest/v1/rpc/anotar_ia_sin_cupo`, { method: "POST", headers: { "content-type": "application/json", apikey: clave }, body: "{}", signal: AbortSignal.timeout(4000) });
  } catch {
    // Sin aviso no pasa nada.
  }
}

// Devuelve { respuesta } o { error, estado } listo para mandar al teléfono.
export async function preguntarGemini({ partes, esquema, temperatura = 0.2, modelos = MODELOS, total = TIEMPO_TOTAL, pausa = 3000 }) {
  const inicio = Date.now();
  const quedan = () => total - (Date.now() - inicio);
  // Qué le pasó a cada modelo: queda en los registros de Vercel para ver por qué falló.
  const motivos = [];
  const porMinuto = [];
  const probar = async (modelo) => {
    if (quedan() < 5000) return null;
    try {
      const r = await una(modelo, partes, esquema, temperatura, Math.min(TIEMPO_MODELO, quedan() - 1000));
      if (r.estado === 429 && r.limite === "minuto") porMinuto.push(modelo);
      motivos.push(`${modelo}:${r.estado}${r.limite ? `-${r.limite}` : ""}${r.motivo ? `-${r.motivo}` : ""}`);
      return r;
    } catch {
      motivos.push(`${modelo}:demora`);
      return null; // Tardó demasiado: se prueba con otro.
    }
  };
  for (const modelo of modelos) {
    const r = await probar(modelo);
    if (r?.estado === 200) return { respuesta: r.respuesta || {} };
    // Sin cupo, dado de baja o respuesta rota: el siguiente.
  }
  // Los que estaban saturados por el minuto se liberan en segundos: una vuelta más, si hay tiempo.
  if (porMinuto.length && quedan() > pausa + 5000) {
    await new Promise((listo) => setTimeout(listo, pausa));
    for (const modelo of porMinuto.splice(0)) {
      const r = await probar(modelo);
      if (r?.estado === 200) return { respuesta: r.respuesta || {} };
    }
  }
  console.warn("IA sin respuesta:", motivos.join(" "));
  const sinCupoDelDia = (m) => m.endsWith(":429-dia");
  // Si algún modelo solo estaba saturado por el minuto, todavía queda cupo: no se avisa.
  if (motivos.some((m) => m.endsWith(":429-minuto"))) return { estado: 429, error: "La IA está con muchos pedidos juntos. Probá de nuevo en un minuto." };
  // El aviso de "se terminó el cupo" solo si TODOS los modelos lo dijeron (antes bastaba con uno y otro que fallara por otra cosa).
  if (motivos.length && motivos.every(sinCupoDelDia)) {
    await avisarSinCupo();
    return { estado: 429, error: "Se terminó el cupo gratis de hoy de la IA. Cargalo a mano o probá mañana." };
  }
  return { estado: 502, error: "La IA no respondió. Probá de nuevo en un rato." };
}

// Gemma (sin modo JSON) a veces manda los números como texto: "150 g", "12,5".
export const aNumero = (v) => (typeof v === "string" ? Number.parseFloat(v.replace(",", ".")) : Number(v));
const num = (v, max) => {
  const n = aNumero(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const redondeo = (n) => Math.round(n * 10) / 10;

// Un alimento con gramos y valores cada 100 g. Lo imposible se descarta.
export function limpiarAlimento(a) {
  const nombre = String(a?.nombre || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const gramos = num(a?.gramos, 2000);
  const p = num(a?.proteinas_100g, 100) ?? 0;
  const c = num(a?.carbohidratos_100g, 100) ?? 0;
  const g = num(a?.grasas_100g, 100) ?? 0;
  const kcal = num(a?.kcal_100g, 950) ?? (p + c + g > 0 ? p * 4 + c * 4 + g * 9 : null);
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
