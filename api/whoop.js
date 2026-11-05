// Conexión oficial con WHOOP: autorización OAuth y lectura de recuperación, sueño y esfuerzo.
// Los tokens viven en una tabla que solo este servidor puede leer.
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { usuarioActual } from "./_auth.js";

const API = "https://api.prod.whoop.com/developer";
const URL_AUTORIZAR = "https://api.prod.whoop.com/oauth/oauth2/auth";
const URL_TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token";
const PERMISOS = "offline read:recovery read:cycles read:sleep";
const DIAS_A_TRAER = 14;
const ESPERA_ENTRE_LECTURAS_MS = 15 * 60 * 1000;
const COOKIE = "whoop_estado";

const configurado = () =>
  ["WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET", "SUPABASE_SECRET_KEY", "APP_URL"].every((v) => process.env[v]);

function base() {
  return createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const direccionRetorno = () => `${process.env.APP_URL}/api/whoop`;
const firmar = (texto) => crypto.createHmac("sha256", process.env.WHOOP_CLIENT_SECRET).update(texto).digest("base64url");

function iguales(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function volver(res, resultado, cookie) {
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.statusCode = 302;
  res.setHeader("Location", `${process.env.APP_URL || ""}/?whoop=${resultado}`);
  res.end();
}

function opcionesCookie(edad) {
  const segura = process.env.APP_URL.startsWith("https://") ? "; Secure" : "";
  return `Path=/api/whoop; HttpOnly; SameSite=Lax; Max-Age=${edad}${segura}`;
}

async function pedirToken(campos) {
  const resp = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...campos,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Token rechazado: HTTP ${resp.status}`);
  return resp.json();
}

const filaToken = (t) => ({
  access_token: t.access_token,
  refresh_token: t.refresh_token,
  expira_en: new Date(Date.now() + t.expires_in * 1000).toISOString(),
});

async function tokenVigente(db, conexion) {
  if (new Date(conexion.expira_en).getTime() > Date.now() + 60000) return conexion.access_token;
  try {
    const nuevo = await pedirToken({ grant_type: "refresh_token", refresh_token: conexion.refresh_token, scope: "offline" });
    const { error } = await db.from("whoop_conexiones").update(filaToken(nuevo)).eq("usuario_id", conexion.usuario_id);
    if (error) throw error;
    return nuevo.access_token;
  } catch (err) {
    // WHOOP invalida el token al usarlo: si otro dispositivo lo renovó recién, el nuevo ya está guardado.
    const { data } = await db.from("whoop_conexiones").select("*").eq("usuario_id", conexion.usuario_id).maybeSingle();
    if (data && data.refresh_token !== conexion.refresh_token) return data.access_token;
    throw err;
  }
}

async function traer(ruta, token, desde) {
  const registros = [];
  let siguiente = null;
  for (let pagina = 0; pagina < 4; pagina += 1) {
    const params = new URLSearchParams({ limit: "25", start: desde });
    if (siguiente) params.set("nextToken", siguiente);
    const resp = await fetch(`${API}${ruta}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`WHOOP respondió HTTP ${resp.status}`);
    const datos = await resp.json();
    registros.push(...(datos.records || []));
    siguiente = datos.next_token;
    if (!siguiente) break;
  }
  return registros;
}

// Un ciclo arranca al dormirse, muchas veces el día anterior. Sumarle 12 horas lo ubica en el día que representa.
function diaDelCiclo(ciclo) {
  const [, signo, h, m] = String(ciclo.timezone_offset || "+00:00").match(/([+-])(\d{2}):(\d{2})/) || [null, "+", "00", "00"];
  const desfase = (signo === "-" ? -1 : 1) * (Number(h) * 60 + Number(m)) * 60000;
  return new Date(Date.parse(ciclo.start) + 12 * 3600000 + desfase).toISOString().slice(0, 10);
}

function horasDormidas(resumen) {
  if (!resumen) return null;
  const milis = resumen.total_in_bed_time_milli - resumen.total_awake_time_milli - (resumen.total_no_data_time_milli || 0);
  return Math.round((milis / 3600000) * 10) / 10;
}

export function armarDias(usuarioId, ciclos, recuperaciones, suenos) {
  const puntuado = (r) => r.score_state === "SCORED" && r.score;
  const dias = new Map();

  for (const ciclo of ciclos) {
    const recuperacion = recuperaciones.find((r) => r.cycle_id === ciclo.id && puntuado(r));
    const sueno = suenos.find((s) => puntuado(s) && (s.id === recuperacion?.sleep_id || (s.cycle_id === ciclo.id && !s.nap)));
    const esfuerzo = puntuado(ciclo) ? ciclo.score : null;
    if (!esfuerzo && !recuperacion && !sueno) continue;

    dias.set(diaDelCiclo(ciclo), {
      usuario_id: usuarioId,
      fecha: diaDelCiclo(ciclo),
      recuperacion: recuperacion ? Math.round(recuperacion.score.recovery_score) : null,
      hrv: recuperacion ? Math.round(recuperacion.score.hrv_rmssd_milli * 10) / 10 : null,
      fc_reposo: recuperacion ? Math.round(recuperacion.score.resting_heart_rate) : null,
      sueno_porcentaje: sueno ? Math.round(sueno.score.sleep_performance_percentage) : null,
      sueno_horas: sueno ? horasDormidas(sueno.score.stage_summary) : null,
      strain: esfuerzo ? Math.round(esfuerzo.strain * 10) / 10 : null,
      calorias_quemadas: esfuerzo ? Math.round(esfuerzo.kilojoule / 4.184) : null,
    });
  }
  return [...dias.values()];
}

async function sincronizar(db, usuarioId, forzar) {
  const { data: conexion, error } = await db.from("whoop_conexiones").select("*").eq("usuario_id", usuarioId).maybeSingle();
  if (error) throw error;
  if (!conexion) return { disponible: true, conectado: false };

  const ultima = conexion.sincronizado_en ? new Date(conexion.sincronizado_en).getTime() : 0;
  if (!forzar && Date.now() - ultima < ESPERA_ENTRE_LECTURAS_MS) return { disponible: true, conectado: true };

  try {
    const token = await tokenVigente(db, conexion);
    const desde = new Date(Date.now() - DIAS_A_TRAER * 86400000).toISOString();
    const [ciclos, recuperaciones, suenos] = await Promise.all([
      traer("/v2/cycle", token, desde),
      traer("/v2/recovery", token, desde),
      traer("/v2/activity/sleep", token, desde),
    ]);

    const dias = armarDias(usuarioId, ciclos, recuperaciones, suenos);
    if (dias.length) {
      const { error: errDias } = await db.from("whoop_dias").upsert(dias, { onConflict: "usuario_id,fecha" });
      if (errDias) throw errDias;
    }
    await db.from("whoop_conexiones").update({ sincronizado_en: new Date().toISOString() }).eq("usuario_id", usuarioId);
    return { disponible: true, conectado: true };
  } catch (err) {
    console.error("No se pudo actualizar WHOOP:", err.message);
    // Si WHOOP rechaza el permiso, hay que volver a conectar. Si está caído, se muestra lo último guardado.
    if (/^Token rechazado: HTTP 40[01]$/.test(err.message)) {
      await db.from("whoop_conexiones").delete().eq("usuario_id", usuarioId);
      return { disponible: true, conectado: false };
    }
    return { disponible: true, conectado: true, desactualizado: true };
  }
}

async function desconectar(db, usuarioId) {
  const { data: conexion } = await db.from("whoop_conexiones").select("*").eq("usuario_id", usuarioId).maybeSingle();
  if (conexion) {
    try {
      const token = await tokenVigente(db, conexion);
      await fetch(`${API}/v2/user/access`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    } catch (err) {
      // Los datos se borran igual; el permiso también se puede revocar desde la cuenta de WHOOP.
      console.error("No se pudo revocar el acceso a WHOOP:", err.message);
    }
  }
  await db.from("whoop_dias").delete().eq("usuario_id", usuarioId);
  await db.from("whoop_conexiones").delete().eq("usuario_id", usuarioId);
  return { disponible: true, conectado: false };
}

// WHOOP vuelve acá después de que la persona autoriza.
async function alVolverDeWhoop(req, res) {
  const borrar = `${COOKIE}=; ${opcionesCookie(0)}`;
  if (req.query.error) return volver(res, "cancelado", borrar);

  const cookie = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  const [estado, usuarioId, firma] = (cookie?.slice(COOKIE.length + 1) || "").split(".");
  const valido = estado && usuarioId && firma && req.query.code && iguales(estado, String(req.query.state || "")) && iguales(firma, firmar(`${estado}.${usuarioId}`));
  if (!valido) return volver(res, "error", borrar);

  try {
    const token = await pedirToken({ grant_type: "authorization_code", code: req.query.code, redirect_uri: direccionRetorno() });
    if (!token.refresh_token) throw new Error("WHOOP no entregó un token de renovación");
    const db = base();
    const { error } = await db.from("whoop_conexiones").upsert({ usuario_id: usuarioId, ...filaToken(token), sincronizado_en: null });
    if (error) throw error;
    await sincronizar(db, usuarioId, true);
    return volver(res, "conectado", borrar);
  } catch (err) {
    console.error("No se pudo conectar WHOOP:", err.message);
    return volver(res, "error", borrar);
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!configurado()) return volver(res, "error");
    return alVolverDeWhoop(req, res);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const usuario = await usuarioActual(req);
  if (!usuario) return res.status(401).json({ error: "Falta iniciar sesión" });
  if (!configurado()) return res.status(200).json({ disponible: false, conectado: false });

  const { accion } = req.query;
  try {
    if (accion === "conectar") {
      const estado = crypto.randomBytes(6).toString("base64url"); // WHOOP pide un state de 8 caracteres.
      const valor = `${estado}.${usuario.id}.${firmar(`${estado}.${usuario.id}`)}`;
      res.setHeader("Set-Cookie", `${COOKIE}=${valor}; ${opcionesCookie(600)}`);
      const params = new URLSearchParams({
        client_id: process.env.WHOOP_CLIENT_ID,
        redirect_uri: direccionRetorno(),
        response_type: "code",
        scope: PERMISOS,
        state: estado,
      });
      return res.status(200).json({ url: `${URL_AUTORIZAR}?${params}` });
    }
    if (accion === "sincronizar") return res.status(200).json(await sincronizar(base(), usuario.id, req.query.forzar === "1"));
    if (accion === "desconectar") return res.status(200).json(await desconectar(base(), usuario.id));
    return res.status(400).json({ error: "Acción no válida" });
  } catch (err) {
    console.error("Error con WHOOP:", err.message);
    return res.status(502).json({ error: "WHOOP no respondió" });
  }
}
