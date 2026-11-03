// Reduce la foto en el navegador antes de subirla: menos peso para Supabase y para la IA.
export function comprimirImagen(archivo, maxLado = 1280, calidad = 0.82) {
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
        "image/jpeg",
        calidad,
      );
    };
    img.onerror = () => rechazar(new Error("No se pudo leer la foto"));
    img.src = url;
  });
}

export function blobABase64(blob) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result.split(",")[1]);
    lector.onerror = () => rechazar(new Error("No se pudo leer la foto"));
    lector.readAsDataURL(blob);
  });
}
