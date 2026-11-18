// Reduce la foto en el navegador antes de subirla: menos peso para Supabase.
// Con formato "image/webp" se mantiene la transparencia (Safari, que no sabe hacer WebP, la devuelve en PNG).
export function comprimirImagen(archivo, maxLado = 1280, calidad = 0.82, formato = "image/jpeg") {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo comprimir la foto"))),
        formato,
        calidad,
      );
    };
    img.onerror = () => rechazar(new Error("No se pudo leer la foto"));
    img.src = url;
  });
}
