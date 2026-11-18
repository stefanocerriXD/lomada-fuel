// Borrar la cuenta: primero las fotos (cada uno puede borrar su carpeta), después todo lo demás en la base (SQL 055).
import { supabase } from "./supabase.js";

const LOTE = 100;

// Todos los archivos de la carpeta de la persona, con sus subcarpetas (chat, recetas, bocha...).
export async function archivosDe(carpeta, listar = (ruta, op) => supabase.storage.from("fotos").list(ruta, op)) {
  const archivos = [];
  const pendientes = [carpeta];
  while (pendientes.length) {
    const ruta = pendientes.shift();
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await listar(ruta, { limit: 1000, offset: desde });
      if (error) throw error;
      for (const x of data || []) {
        // Las carpetas vienen sin id.
        if (x.id) archivos.push(`${ruta}/${x.name}`);
        else pendientes.push(`${ruta}/${x.name}`);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return archivos;
}

const ERRORES = {
  es_dueno: "Sos el dueño de la app: tu cuenta no se puede borrar desde acá.",
  sin_sesion: "Se cerró tu sesión. Entrá de nuevo y probá otra vez.",
};

function mensajeDe(error) {
  const texto = `${error?.message || ""} ${error?.code || ""}`;
  if (/PGRST202|borrar_mi_cuenta/.test(texto) && !/falta_confirmar/.test(texto)) return "Todavía no se puede borrar la cuenta desde la app. Probá más tarde.";
  const clave = Object.keys(ERRORES).find((k) => texto.includes(k));
  return clave ? ERRORES[clave] : "No pudimos borrar la cuenta. Revisá tu conexión y probá de nuevo.";
}

export async function borrarMiCuenta(usuarioId) {
  // 1. ¿Está todo listo? (sin confirmar, la base solo revisa y responde falta_confirmar).
  const prueba = await supabase.rpc("borrar_mi_cuenta", { p_confirmacion: "" });
  if (!/falta_confirmar/.test(prueba.error?.message || "")) throw new Error(mensajeDe(prueba.error));

  // 2. Las fotos, audios y demás archivos.
  const archivos = await archivosDe(usuarioId);
  for (let i = 0; i < archivos.length; i += LOTE) {
    const { error } = await supabase.storage.from("fotos").remove(archivos.slice(i, i + LOTE));
    if (error) throw new Error("No pudimos borrar tus fotos. Revisá tu conexión y probá de nuevo.");
  }

  // 3. La cuenta y todo lo demás.
  const { error } = await supabase.rpc("borrar_mi_cuenta", { p_confirmacion: "BORRAR" });
  if (error) throw new Error(mensajeDe(error));

  // 4. Lo que quedó guardado en este celu.
  try {
    for (const clave of Object.keys(localStorage)) if (/^(lomada|comidas)-/.test(clave)) localStorage.removeItem(clave);
  } catch {
    // Sin acceso al almacenamiento del navegador: no importa.
  }
  await supabase.auth.signOut().catch(() => {});
}
