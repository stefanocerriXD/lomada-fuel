// "Descargar mis datos": todo lo de la persona en un archivo (lo pide la Ley 25.326, igual que borrar la cuenta).
// Cada tabla se lee con la sesión de la persona: el permiso de la base ya limita a lo suyo.
import { supabase } from "./supabase.js";

const POR_PAGINA = 1000;

// [tabla, columna con la persona]. Las que no existan todavía (SQL sin correr) se saltean.
export const TABLAS_PROPIAS = [
  ["perfiles", "id"],
  ["perfiles_salud", "usuario_id"],
  ["comidas", "usuario_id"],
  ["pesos", "usuario_id"],
  ["agua", "usuario_id"],
  ["ayunos", "usuario_id"],
  ["registros_config", "usuario_id"],
  ["registros_diarios", "usuario_id"],
  ["recordatorios", "usuario_id"],
  ["motivacion", "usuario_id"],
  ["favoritas", "usuario_id"],
  ["recetas_propias", "usuario_id"],
  ["mensajes", "usuario_id"],
  ["comentarios", "usuario_id"],
  ["reacciones", "usuario_id"],
  ["reacciones_mensajes", "usuario_id"],
  ["medallas", "usuario_id"],
  ["multas", "usuario_id"],
  ["preferencias_avisos", "usuario_id"],
  ["salud_comidas", "usuario_id"],
  ["salud_capturas", "usuario_id"],
  ["whoop_dias", "usuario_id"],
  ["miembros_grupo", "usuario_id"],
];

async function todasLasFilas(tabla, columna, usuarioId) {
  const filas = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await supabase.from(tabla).select("*").eq(columna, usuarioId).range(desde, desde + POR_PAGINA - 1);
    if (error) return filas.length ? filas : null;
    filas.push(...(data || []));
    if (!data || data.length < POR_PAGINA) return filas;
  }
}

export async function juntarMisDatos(usuario) {
  const datos = { app: "Lomada Fuel", fecha: new Date().toISOString(), cuenta: { id: usuario.id, mail: usuario.email, creada: usuario.created_at || null }, tablas: {} };
  for (const [tabla, columna] of TABLAS_PROPIAS) {
    const filas = await todasLasFilas(tabla, columna, usuario.id);
    if (filas) datos.tablas[tabla] = filas;
  }
  return datos;
}

export async function descargarMisDatos(usuario) {
  const datos = await juntarMisDatos(usuario);
  const fecha = new Date().toLocaleDateString("en-CA");
  const archivo = new File([JSON.stringify(datos, null, 2)], `lomada-fuel-mis-datos-${fecha}.json`, { type: "application/json" });
  // En el celular se comparte (Guardar en Archivos); en la compu se descarga.
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: "Mis datos de Lomada Fuel" });
      return datos;
    } catch (e) {
      if (e?.name === "AbortError") return datos;
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return datos;
}
