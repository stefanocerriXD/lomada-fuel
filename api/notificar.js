// Envía notificaciones al celular. La base decide qué decir y a quién, según lo que está guardado.
import { avisosConfigurados, enviarAvisos } from "./_avisos.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Falta iniciar sesión" });
  if (!avisosConfigurados()) return res.status(200).json({ enviadas: 0 });

  const { tipo, id, nombre, titulo, cuerpo, vista } = req.body || {};
  if (!tipo || (!id && tipo !== "anuncio")) return res.status(400).json({ error: "Pedido no válido" });

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
      // Una denuncia nueva (SQL 070): le llega solo al dueño.
      denuncia: () => rpc("aviso_denuncia", { p_id: id }),
      // El dueño a todos (SQL 058): la base revisa que sea el dueño y el texto.
      anuncio: () => rpc("aviso_anuncio", { p_titulo: titulo, p_cuerpo: cuerpo, p_vista: vista || null }),
      mejora_hecha: () => rpc("aviso_mejora_hecha", { p_id: id }),
      // El dueño respondió un pedido (SQL 060): le llega solo a quien lo pidió.
      mejora_respuesta: () => rpc("aviso_respuesta_mejora", { p_id: id }),
      invitacion: () => rpc("aviso_invitacion", { p_id: id }),
      salida: () => rpc("aviso_salida", { p_id: id }),
      reaccion: () => rpc("aviso_reaccion", { p_tipo: "comida", p_id: id, p_emoji: String(nombre || "").slice(0, 16) }),
      reaccion_mensaje: () => rpc("aviso_reaccion", { p_tipo: "mensaje", p_id: id, p_emoji: String(nombre || "").slice(0, 16) }),
    }[tipo];
    const resp = await (pedido ? pedido() : rpc("destinos_aviso", { p_tipo: tipo, p_id: id }));
    if (!resp.ok) {
      const motivo = tipo === "anuncio" ? ((await resp.json().catch(() => ({}))).message || "") : "";
      const codigo = ["no_sos_dueno", "texto_invalido", "muy_seguido"].find((c) => motivo.includes(c)) || (/aviso_anuncio/.test(motivo) ? "falta_sql" : null);
      return res.status(resp.status === 401 ? 401 : 400).json({ error: codigo || "No autorizado" });
    }
    const aviso = await resp.json();
    if (!aviso?.destinos?.length) return res.status(200).json({ enviadas: 0 });
    // Cada grupo se entera solo de lo suyo. Las mejoras van a quien administra, sea del grupo que sea.
    if (!["mejora", "mejora_hecha", "mejora_respuesta", "anuncio", "denuncia"].includes(tipo)) {
      const filtro = await rpc("solo_mi_grupo", { p_endpoints: aviso.destinos.map((d) => d.endpoint) });
      if (filtro.ok) {
        const permitidos = new Set(await filtro.json());
        aviso.destinos = aviso.destinos.filter((d) => permitidos.has(d.endpoint));
        if (!aviso.destinos.length) return res.status(200).json({ enviadas: 0 });
      }
    }

    // Cada uno elige qué avisos recibe (Ajustes > Notificaciones). Sin el SQL 048, pasan todos.
    const elegidos = await rpc("filtrar_preferencias", { p_tipo: tipo, p_endpoints: aviso.destinos.map((d) => d.endpoint) });
    if (elegidos.ok) {
      const quieren = new Set(await elegidos.json());
      aviso.destinos = aviso.destinos.filter((d) => quieren.has(d.endpoint));
      if (!aviso.destinos.length) return res.status(200).json({ enviadas: 0 });
    }

    const { enviadas, vencidas } = await enviarAvisos(aviso, process.env.APP_URL || `https://${req.headers.host}`);
    // El navegador informa con 404 o 410 que ese dispositivo ya no recibe avisos.
    if (vencidas.length) await rpc("borrar_suscripciones", { p_endpoints: vencidas });

    return res.status(200).json({ enviadas });
  } catch (err) {
    console.error("No se pudo notificar:", err.message);
    return res.status(502).json({ error: "No se pudo notificar" });
  }
}
