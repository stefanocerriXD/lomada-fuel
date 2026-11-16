// Recibe la captura de MyFitnessPal que saca el Atajo (toque atrás del iPhone).
// La IA copia el texto; se guarda solo el texto (la foto no) y la app lo une con la comida de Apple Salud al tocar +.
// Responde texto simple: el Atajo lo muestra tal cual en una notificación.
import { hayGemini, preguntarGemini } from "./_gemini.js";
import { leerResumen } from "../src/lib/importar.js";

const MAXIMO_BASE64 = 4_200_000; // Vercel acepta hasta 4,5 MB por pedido.

const PEDIDO = `Es una captura de pantalla del diario de MyFitnessPal (u otra app de calorías), en español o inglés.
Copiá TODO el texto que se ve, renglón por renglón y en el mismo orden de arriba hacia abajo:
- Los nombres de las comidas (Desayuno, Almuerzo, Cena, Aperitivos/Snacks…) con sus calorías si aparecen.
- Cada alimento en su renglón y, en el renglón siguiente, lo que tenga debajo (marca, porción, gramos) y sus calorías.
- Los números tal cual, con sus unidades (g, ml, kcal, cal). No calcules, no resumas, no traduzcas, no agregues nada.
- Si la captura no es de un diario de comidas, es_diario=false y texto vacío.`;

const ESQUEMA = {
  type: "OBJECT",
  properties: { es_diario: { type: "BOOLEAN" }, texto: { type: "STRING" } },
  required: ["es_diario", "texto"],
};

const TIPOS = { desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena", colacion: "Colación", resumen: "Comida" };

function tipoDeImagen(base64) {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/heic";
}

function responder(res, estado, texto) {
  res.setHeader("content-type", "text/plain; charset=utf-8");
  return res.status(estado).send(texto);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, "Método no permitido");
  const datos = typeof req.body === "object" && req.body ? req.body : {};
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const rpc = (funcion, cuerpo) => fetch(`${url}/rest/v1/rpc/${funcion}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: clave },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  });

  const token = String(datos.token || "");
  // El Atajo puede mandar la imagen con saltos de línea o como "data:image/png;base64,…".
  const imagen = String(datos.imagen || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!token) return responder(res, 400, "Falta la llave de Lomada Fuel en el Atajo.");
  if (!imagen) return responder(res, 400, "No llegó la captura. Revisá que el Atajo mande la imagen en Base64.");
  if (imagen.length > MAXIMO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(imagen)) return responder(res, 400, "La captura es muy pesada. Sumá Convertir imagen a JPEG en el Atajo.");
  if (!hayGemini()) return responder(res, 503, "La lectura con IA no está activada.");

  const valida = await rpc("llave_salud_valida", { p_token: token }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (valida === null) return responder(res, 502, "No pudimos conectar con Lomada Fuel. Probá de nuevo.");
  if (!valida) return responder(res, 401, "La llave del Atajo no es válida. Copiala de nuevo desde Lomada Fuel (Ajustes > Apple Salud).");

  const r = await preguntarGemini({ partes: [{ inline_data: { mime_type: tipoDeImagen(imagen), data: imagen } }, { text: PEDIDO }], esquema: ESQUEMA, temperatura: 0 });
  if (r.error) return responder(res, r.estado || 502, r.error);
  const texto = String(r.respuesta?.texto || "").slice(0, 12000).trim();
  if (!r.respuesta?.es_diario || !texto) return responder(res, 200, "No vimos un diario de comidas en la pantalla. Abrí la comida en MyFitnessPal y probá de nuevo.");

  const filas = leerResumen(texto).filter((f) => f.alimentos?.length);
  if (!filas.length) return responder(res, 200, "No pudimos leer alimentos en esa pantalla. Probá con la comida abierta en el diario de MyFitnessPal.");

  const guardado = await rpc("guardar_captura_salud", { p_token: token, p_texto: texto }).catch(() => null);
  if (!guardado?.ok) {
    console.error("Captura de MyFitnessPal:", guardado && (await guardado.text().catch(() => guardado.status)));
    return responder(res, 502, "Leímos la captura pero no se pudo guardar. Probá de nuevo.");
  }

  const resumen = filas
    .slice(0, 3)
    .map((f) => `${TIPOS[f.tipo] || "Comida"}: ${f.alimentos.length} ${f.alimentos.length === 1 ? "alimento" : "alimentos"} (${f.alimentos.slice(0, 3).map((a) => a.nombre).join(", ")}${f.alimentos.length > 3 ? "…" : ""})`)
    .join("\n");
  return responder(res, 200, `✅ Listo para Lomada Fuel\n${resumen}`);
}
