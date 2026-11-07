// Envía notificaciones al celular. La base decide qué decir y a quién, según lo que está guardado.
import { avisosConfigurados, enviarAvisos } from "./_avisos.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Falta iniciar sesión" });
  if (!avisosConfigurados()) return res.status(200).json({ enviadas: 0 });

  const { tipo, id, nombre } = req.body || {};
  if (!tipo || !id) return res.status(400).json({ error: "Pedido no válido" });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const rpc = (funcion, cuerpo) =>
    fetch(`${url}/rest/v1/rpc/${funcion}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: clave, Authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    });

  try {
    const pedido = {
      medalla: () => rpc("aviso_medalla", { p_codigo: id, p_nombre: nombre || null }),
      mejora: () => rpc("aviso_mejora", { p_id: id }),
    }[tipo];
    const resp = await (pedido ? pedido() : rpc("destinos_aviso", { p_tipo: tipo, p_id: id }));
    if (!resp.ok) return res.status(resp.status === 401 ? 401 : 400).json({ error: "No autorizado" });
    const aviso = await resp.json();
    if (!aviso?.destinos?.length) return res.status(200).json({ enviadas: 0 });

    const { enviadas, vencidas } = await enviarAvisos(aviso, process.env.APP_URL || `https://${req.headers.host}`);
    // El navegador informa con 404 o 410 que ese dispositivo ya no recibe avisos.
    if (vencidas.length) await rpc("borrar_suscripciones", { p_endpoints: vencidas });

    return res.status(200).json({ enviadas });
  } catch (err) {
    console.error("No se pudo notificar:", err.message);
    return res.status(502).json({ error: "No se pudo notificar" });
  }
}
