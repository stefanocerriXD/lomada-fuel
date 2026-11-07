// La llama el reloj de Supabase. La base controla la clave y decide a quién avisarle.
import { avisosConfigurados, enviarAvisos } from "./_avisos.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const clave = req.headers["x-clave"];
  const tipo = req.body?.tipo;
  if (!clave || !tipo) return res.status(400).json({ error: "Pedido no válido" });
  if (!avisosConfigurados()) return res.status(200).json({ enviadas: 0 });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publica = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const rpc = (funcion, cuerpo) =>
    fetch(`${url}/rest/v1/rpc/${funcion}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: publica, Authorization: `Bearer ${publica}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    });

  try {
    const resp = await rpc("destinos_programados", { p_clave: clave, p_tipo: tipo });
    if (!resp.ok) return res.status(401).json({ error: "No autorizado" });
    const aviso = await resp.json();
    if (!aviso?.destinos?.length) return res.status(200).json({ enviadas: 0 });

    const { enviadas, vencidas } = await enviarAvisos(aviso, process.env.APP_URL || `https://${req.headers.host}`);
    if (vencidas.length) await rpc("limpiar_suscripciones", { p_clave: clave, p_endpoints: vencidas });
    return res.status(200).json({ enviadas });
  } catch (err) {
    console.error("No se pudo mandar el recordatorio:", err.message);
    return res.status(502).json({ error: "No se pudo notificar" });
  }
}
