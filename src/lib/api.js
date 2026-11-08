import { supabase } from "./supabase.js";

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

export const URL_SALUD = `${window.location.origin}/api/salud`;

// Enlace de iCloud del Atajo compartido, sin ninguna llave adentro.
export const ATAJO_SALUD = "";

// El Atajo se tiene que llamar así para que el botón lo encuentre.
export const NOMBRE_ATAJO = "Lomada Fuel";
export const CORRER_ATAJO = `shortcuts://run-shortcut?name=${encodeURIComponent(NOMBRE_ATAJO)}`;

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
