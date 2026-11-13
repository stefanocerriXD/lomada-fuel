import { supabase } from "./supabase.js";
import { comprimirImagen } from "./imagen.js";

async function encabezados() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token}` };
}

async function leer(resp) {
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || "No se pudo completar la consulta");
  return json;
}

export async function accionWhoop(accion, forzar = false) {
  const params = new URLSearchParams({ accion, ...(forzar ? { forzar: "1" } : {}) });
  const resp = await fetch(`/api/whoop?${params}`, { method: "POST", headers: await encabezados() });
  return leer(resp);
}

// Una notificación que no sale no debe frenar lo que hizo la persona.
export async function avisarGrupo(tipo, id, nombre) {
  try {
    await fetch("/api/notificar", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await encabezados()) },
      body: JSON.stringify({ tipo, id, nombre }),
    });
  } catch {
    // Sin conexión no hay aviso.
  }
}

// Lo que dictaste ("dos empanadas y una coca"): Gemini lo pasa a alimentos con cantidades.
export async function reconocerTexto(texto) {
  const resp = await fetch("/api/reconocer", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await encabezados()) },
    body: JSON.stringify({ modo: "texto", texto }),
  });
  if (resp.status === 503) {
    ia.apagada = true;
    const error = new Error("La IA todavía no está activada");
    error.apagado = true;
    throw error;
  }
  return leer(resp);
}

// "¿Qué puedo comer?" con lo que escribiste: Gemini arma 3 opciones para lo que te falta del día.
export async function sugerirConIA(datos) {
  const resp = await fetch("/api/sugerir", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await encabezados()) },
    body: JSON.stringify(datos),
  });
  if (resp.status === 503) {
    ia.apagada = true;
    const error = new Error("La IA todavía no está activada");
    error.apagado = true;
    throw error;
  }
  return leer(resp);
}

export const URL_SALUD = `${window.location.origin}/api/salud`;

// Enlace de iCloud del Atajo compartido, sin ninguna llave adentro.
export const ATAJO_SALUD = "https://www.icloud.com/shortcuts/cb157d1bd83242408043eb22360f3d7c";

// Nombre con el que se instala el Atajo compartido.
export const NOMBRE_ATAJO = "Lomada fuel";

const memoria = new Map();

export async function buscarAlimentos(texto, signal) {
  const clave = texto.trim().toLowerCase();
  if (memoria.has(clave)) return memoria.get(clave);
  const resp = await fetch(`/api/alimentos?q=${encodeURIComponent(clave)}`, { headers: await encabezados(), signal });
  const json = await leer(resp);
  if (!json.parcial) memoria.set(clave, json);
  return json;
}

export async function buscarCodigo(codigo) {
  const resp = await fetch(`/api/alimentos?codigo=${encodeURIComponent(codigo)}`, { headers: await encabezados() });
  return (await leer(resp)).alimento;
}

// Si en Vercel todavía no está la clave de Gemini, no se vuelve a intentar en esta sesión.
export const ia = { apagada: false };

// La foto viaja chica (alcanza para reconocer el plato) y la analiza Gemini desde /api/reconocer.
// Para una etiqueta va más grande: los números son chicos.
export async function reconocerFoto(blob, modo = "plato") {
  const chica = await comprimirImagen(blob, modo === "etiqueta" ? 1600 : 1024, modo === "etiqueta" ? 0.85 : 0.75);
  const imagen = await new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).split(",")[1]);
    lector.onerror = () => rechazar(new Error("No se pudo leer la foto"));
    lector.readAsDataURL(chica);
  });
  const resp = await fetch("/api/reconocer", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await encabezados()) },
    body: JSON.stringify({ imagen, modo }),
  });
  if (resp.status === 503) {
    ia.apagada = true;
    const error = new Error("El reconocimiento de fotos todavía no está activado");
    error.apagado = true;
    throw error;
  }
  return leer(resp);
}
