// Recibe la captura de MyFitnessPal que saca el Atajo (toque atrás del iPhone).
// La IA copia el texto; se guarda solo el texto (la foto no) y la app lo une con la comida de Apple Salud al tocar +.
// Responde texto simple: el Atajo lo muestra tal cual en una notificación.
import { cupoPersona, hayGemini, preguntarGemini, textoTope } from "./_gemini.js";
import { leerResumen } from "../src/lib/importar.js";

const MAXIMO_BASE64 = 4_200_000; // Vercel acepta hasta 4,5 MB por pedido.

// La IA devuelve cada alimento por separado (nombre, marca, porción, gramos, calorías):
// así el peso nunca se confunde con las calorías y un nombre largo partido en dos renglones queda en uno solo.
const PEDIDO = `Es una captura de pantalla del diario de MyFitnessPal (u otra app de calorías), en español o inglés.
Devolvé las comidas que se ven y, de cada una, sus alimentos en el mismo orden de arriba hacia abajo:
- comida: Desayuno, Almuerzo, Merienda, Cena o Colación (Aperitivos, Snacks y Tentempiés son Colación). Si no se ve el título, "Sin título".
- kcal de la comida: el número que acompaña al título, si se ve.
- De cada alimento: nombre completo (si ocupa dos renglones, unilos en uno; si está cortado con "…", copialo así), marca (lo que va antes de la coma en el renglón de abajo, ej. "Genérico"), porción tal cual (ej. "1 porción (150 g)"), gramos (solo el número que va junto a g o ml; si no hay, null) y kcal (el número de calorías del alimento, el que suele ir a la derecha).
- Cada alimento UNA sola vez. No calcules, no inventes, no traduzcas.
- Si la captura no es de un diario de comidas, es_diario=false y comidas vacía.`;

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    es_diario: { type: "BOOLEAN" },
    comidas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          comida: { type: "STRING", enum: ["Desayuno", "Almuerzo", "Merienda", "Cena", "Colación", "Sin título"] },
          kcal: { type: "NUMBER", nullable: true },
          alimentos: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                nombre: { type: "STRING" },
                marca: { type: "STRING", nullable: true },
                porcion: { type: "STRING", nullable: true },
                gramos: { type: "NUMBER", nullable: true },
                kcal: { type: "NUMBER" },
              },
              required: ["nombre", "kcal"],
            },
          },
        },
        required: ["comida", "alimentos"],
      },
    },
  },
  required: ["es_diario", "comidas"],
};

// Se guarda como texto (lo que la app ya sabe leer): título, nombre y abajo "Marca, porción, kcal".
const limpio = (t) => String(t ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const numero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 10) / 10 : null);
const MARCA_SEGURA = /^\p{L}[\p{L}\d.&'’]*(?:\s[\p{L}\d.&'’]+){0,4}$/u;
export function textoDeCaptura(comidas) {
  const lineas = [];
  for (const comida of comidas || []) {
    const alimentos = (comida.alimentos || []).filter((a) => limpio(a.nombre) && numero(a.kcal));
    if (!alimentos.length) continue;
    if (comida.comida && comida.comida !== "Sin título") lineas.push(numero(comida.kcal) ? `${comida.comida} ${Math.round(comida.kcal)} kcal` : comida.comida);
    for (const a of alimentos) {
      const nombre = limpio(a.nombre).replace(/[()[\]]/g, " ").replace(/\s+/g, " ");
      const gramos = numero(a.gramos);
      let porcion = limpio(a.porcion);
      if (gramos && !/\d\s*(g|gr|gramos?|ml)\b/i.test(porcion)) porcion = porcion ? `${porcion} (${gramos} g)` : `${gramos} g`;
      const marca = limpio(a.marca).replace(/[-–—,()·•+/]+/g, " ").replace(/\s+/g, " ").trim();
      const datos = [porcion, `${Math.round(a.kcal)} kcal`].filter(Boolean).join(", ");
      if (marca && !/^gen[eé]rico$/i.test(marca) && MARCA_SEGURA.test(marca)) {
        lineas.push(nombre, `${marca}, ${datos}`);
      } else {
        lineas.push(nombre, datos);
      }
    }
  }
  return lineas.join("\n");
}

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

  // Tope por persona: 25 usos de IA por día (cuenta igual que una foto reconocida).
  const cupo = cupoPersona({ llave: token });
  const antes = await cupo.mirar();
  if (antes && !antes.permitido) return responder(res, 429, textoTope(antes.tope));

  const r = await preguntarGemini({ partes: [{ inline_data: { mime_type: tipoDeImagen(imagen), data: imagen } }, { text: PEDIDO }], esquema: ESQUEMA, temperatura: 0 });
  if (r.error) return responder(res, r.estado || 502, r.error);
  await cupo.sumar();
  const texto = textoDeCaptura(r.respuesta?.comidas).slice(0, 12000).trim();
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
