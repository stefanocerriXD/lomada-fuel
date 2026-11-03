// Función serverless de Vercel: estima los macros de una comida a partir de la foto.
// La clave de Anthropic vive solo en las variables de entorno de Vercel, nunca en el front.

// Haiku por defecto: es el más barato. Para más precisión, definir MODELO_IA=claude-sonnet-5 en Vercel.
const MODELO = process.env.MODELO_IA || "claude-haiku-4-5-20251001";

const INSTRUCCIONES = `Sos un asistente de nutrición. Mirá la foto de una comida y estimá los macros del plato completo que se ve.
Respondé SOLO con un objeto JSON, sin texto extra, con esta forma:
{"descripcion": "texto corto de lo que ves", "calorias": número, "proteinas": número, "carbohidratos": número, "grasas": número, "confianza": "alta" | "media" | "baja"}
Calorías en kcal; proteínas, carbohidratos y grasas en gramos. Si no se ve comida, devolvé todos los números en 0 y confianza "baja".`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Falta iniciar sesión" });
  }

  // Verificar que el token corresponde a un usuario logueado de Supabase.
  const userResp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY },
  });
  if (!userResp.ok) {
    return res.status(401).json({ error: "Sesión no válida" });
  }

  const { imagen, tipoImagen } = req.body || {};
  if (!imagen || !tipoImagen) {
    return res.status(400).json({ error: "Falta la imagen" });
  }

  const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 400,
      system: INSTRUCCIONES,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: tipoImagen, data: imagen } },
            { type: "text", text: "Estimá los macros de esta comida." },
          ],
        },
      ],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    return res.status(502).json({ error: "La IA no respondió", detalle });
  }

  const datos = await respuesta.json();
  const texto = (datos.content || []).map((b) => b.text || "").join("").trim();

  try {
    const estimacion = JSON.parse(texto);
    return res.status(200).json(estimacion);
  } catch {
    return res.status(502).json({ error: "Respuesta de la IA no válida", texto });
  }
}
