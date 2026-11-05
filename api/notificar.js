// Envía notificaciones al celular. El texto se arma acá, a partir de lo guardado en la base,
// para que nadie pueda mandar notificaciones falsas al grupo.
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { usuarioActual } from "./_auth.js";

const MAXIMA_ANTIGUEDAD_MS = 2 * 60 * 1000;
const TABLAS = { mensaje: "mensajes", comida: "comidas", comentario: "comentarios" };

const configurado = () =>
  ["VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "SUPABASE_SECRET_KEY", "APP_URL"].every((v) => process.env[v]);

function base() {
  return createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function armarAviso(db, tipo, fila, nombre, autorId) {
  if (tipo === "mensaje") {
    return { titulo: nombre, cuerpo: fila.texto.slice(0, 120), vista: "chat" };
  }
  if (tipo === "comida") {
    if (fila.privada) return null;
    return { titulo: `${nombre} subió una comida`, cuerpo: (fila.descripcion || "Mirá qué comió").slice(0, 120), vista: "muro" };
  }
  const { data: comida } = await db.from("comidas").select("usuario_id, privada").eq("id", fila.comida_id).maybeSingle();
  if (!comida || comida.privada || comida.usuario_id === autorId) return null;
  return { titulo: `${nombre} comentó tu comida`, cuerpo: fila.texto.slice(0, 120), vista: "muro", solo: comida.usuario_id };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const usuario = await usuarioActual(req);
  if (!usuario) return res.status(401).json({ error: "Falta iniciar sesión" });
  if (!configurado()) return res.status(200).json({ enviadas: 0 });

  const { tipo, id } = req.body || {};
  const tabla = TABLAS[tipo];
  if (!tabla || !id) return res.status(400).json({ error: "Pedido no válido" });

  try {
    const db = base();
    const { data: fila } = await db.from(tabla).select("*").eq("id", id).maybeSingle();
    // Solo se avisa algo recién creado por quien hace el pedido.
    if (!fila || fila.usuario_id !== usuario.id) return res.status(403).json({ error: "No autorizado" });
    if (Date.now() - new Date(fila.creado_en).getTime() > MAXIMA_ANTIGUEDAD_MS) return res.status(200).json({ enviadas: 0 });

    const { data: perfil } = await db.from("perfiles").select("nombre").eq("id", usuario.id).maybeSingle();
    const aviso = await armarAviso(db, tipo, fila, perfil?.nombre || "Alguien", usuario.id);
    if (!aviso) return res.status(200).json({ enviadas: 0 });

    const { solo, ...contenido } = aviso;
    const consulta = db.from("suscripciones_push").select("*");
    const { data: suscripciones } = await (solo ? consulta.eq("usuario_id", solo) : consulta.neq("usuario_id", usuario.id));

    webpush.setVapidDetails(process.env.APP_URL, process.env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const resultados = await Promise.allSettled(
      (suscripciones || []).map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(contenido), { TTL: 3600 }),
      ),
    );

    // El navegador informa con 404 o 410 que esa suscripción ya no existe.
    const vencidas = (suscripciones || []).filter((_, i) => [404, 410].includes(resultados[i].reason?.statusCode)).map((s) => s.endpoint);
    if (vencidas.length) await db.from("suscripciones_push").delete().in("endpoint", vencidas);

    return res.status(200).json({ enviadas: resultados.filter((r) => r.status === "fulfilled").length });
  } catch (err) {
    console.error("No se pudo notificar:", err.message);
    return res.status(502).json({ error: "No se pudo notificar" });
  }
}
