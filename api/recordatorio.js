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
    // La caca (aviso de las 22 y anuncio), el viaje y el informe del domingo tienen su propia función; el resto, la de siempre.
    const funcion = ["caca", "anuncio_caca"].includes(tipo) ? "destinos_caca" : tipo === "viaje" ? "destinos_viaje" : tipo === "informe" ? "destinos_informe" : "destinos_programados";
    const resp = await rpc(funcion, { p_clave: clave, p_tipo: tipo });
    if (!resp.ok) return res.status(401).json({ error: "No autorizado" });
    const aviso = await resp.json();
    if (!aviso?.destinos?.length) return res.status(200).json({ enviadas: 0 });
    // El viaje y el Match Day son del grupo con Bocha; nadie sin grupo recibe nada.
    const filtro = await rpc("filtrar_destinos", { p_clave: clave, p_tipo: tipo, p_endpoints: aviso.destinos.map((d) => d.endpoint) });
    if (filtro.ok) {
      const permitidos = new Set(await filtro.json());
      aviso.destinos = aviso.destinos.filter((d) => permitidos.has(d.endpoint));
      if (!aviso.destinos.length) return res.status(200).json({ enviadas: 0 });
    }

    const { enviadas, vencidas } = await enviarAvisos(aviso, process.env.APP_URL || `https://${req.headers.host}`);
    if (vencidas.length) await rpc("limpiar_suscripciones", { p_clave: clave, p_endpoints: vencidas });
    return res.status(200).json({ enviadas });
  } catch (err) {
    console.error("No se pudo mandar el recordatorio:", err.message);
    return res.status(502).json({ error: "No se pudo notificar" });
  }
}
