// Foto de perfil: se encuadra en la app (mover y acercar), se guarda cuadrada y chica, y va a la carpeta propia.
import { supabase } from "./supabase.js";

export const LADO_FOTO = 720; // Alcanza para verla en grande y pesa poco (~100 KB).
export { encuadre, ZOOM_MAXIMO } from "./encuadre.js";

export function leerImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => resolver({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No se pudo leer la foto. Probá con otra."));
    };
    img.src = url;
  });
}

// Dibuja el encuadre elegido en un cuadrado de LADO_FOTO y lo pasa a JPG.
export function recortar(img, cuadro, lado = LADO_FOTO, calidad = 0.86) {
  const { origen } = cuadro;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, origen.x, origen.y, origen.lado, origen.lado, 0, 0, lado, lado);
  return new Promise((resolver, rechazar) => {
    canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo preparar la foto"))), "image/jpeg", calidad);
  });
}

const sinColumna = (error) => /foto_path|PGRST204|42703/.test(`${error?.code || ""} ${error?.message || ""}`);

// Sube la nueva, la pone en el perfil y borra la anterior. Siempre un archivo nuevo: así no queda la vieja en caché.
export async function guardarFotoPerfil({ usuarioId, blob, anterior }) {
  const ruta = `${usuarioId}/perfil/${Date.now()}.jpg`;
  const subida = await supabase.storage.from("fotos").upload(ruta, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (subida.error) throw new Error("No se pudo subir la foto. Probá de nuevo.");
  const { error } = await supabase.from("perfiles").update({ foto_path: ruta }).eq("id", usuarioId);
  if (error) {
    await supabase.storage.from("fotos").remove([ruta]);
    throw new Error(sinColumna(error) ? "La foto de perfil todavía no está activada (falta el SQL 066)." : "No se pudo guardar la foto. Probá de nuevo.");
  }
  if (anterior && anterior !== ruta) await supabase.storage.from("fotos").remove([anterior]);
  return ruta;
}

export async function quitarFotoPerfil({ usuarioId, anterior }) {
  const { error } = await supabase.from("perfiles").update({ foto_path: null }).eq("id", usuarioId);
  if (error) throw new Error("No se pudo sacar la foto. Probá de nuevo.");
  if (anterior) await supabase.storage.from("fotos").remove([anterior]);
}
