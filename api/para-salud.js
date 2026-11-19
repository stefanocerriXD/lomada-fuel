// Lomada -> Apple Salud (así las toma WHOOP). Lo llama el Atajo "Lomada a Salud" con la llave de Apple Salud.
// Devuelve las comidas nuevas (cada una una sola vez) para que el Atajo las registre en Salud con su hora.
// Con "probar": true muestra lo que mandaría sin marcarlo como mandado.
const ERRORES = { token_invalido: 401 };

const miles = (n) => Math.round(n).toLocaleString("es-AR");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const datos = typeof req.body === "object" && req.body ? req.body : {};
  const token = String(datos.token || "").trim();
  if (!token) return res.status(400).json({ error: "Falta la llave de Apple Salud", texto: "Falta la llave en el Atajo." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const probar = datos.probar === true || datos.probar === "true" || datos.probar === "si";
  const r = await fetch(`${url}/rest/v1/rpc/comidas_para_salud`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: clave },
    body: JSON.stringify({ p_token: token, p_marcar: !probar }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  if (!r?.ok) {
    const cuerpo = r ? await r.json().catch(() => ({})) : {};
    const codigo = Object.keys(ERRORES).find((c) => cuerpo.message?.includes(c));
    if (codigo) return res.status(ERRORES[codigo]).json({ error: codigo, texto: "La llave del Atajo no es válida. Copiala de nuevo desde el Atajo de Apple Salud." });
    console.error("Comidas para Salud:", cuerpo);
    return res.status(502).json({ error: "No se pudo", texto: "No pudimos traer tus comidas. Probá de nuevo." });
  }

  const comidas = (await r.json().catch(() => [])) || [];
  const kcal = comidas.reduce((t, c) => t + (Number(c.kcal) || 0), 0);
  const texto = comidas.length
    ? `${probar ? "Se mandarían" : "A Apple Salud"}: ${comidas.length} ${comidas.length === 1 ? "comida" : "comidas"}, ${miles(kcal)} kcal.`
    : "No hay comidas nuevas para mandar a Apple Salud.";
  return res.status(200).json({ comidas, cantidad: comidas.length, kcal, texto, probar });
}
