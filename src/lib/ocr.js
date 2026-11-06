// Lee el texto de una captura dentro del celular: la imagen no se sube a ningún lado.
import { corregirCaptura } from "./importar.js";

const LADO_MAXIMO = 2000;
const TIEMPO_MAXIMO_MS = 90000; // La primera vez descarga el lector: con mala señal podría no terminar.

function cargar(archivo) {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolver(img);
    };
    img.onerror = () => rechazar(new Error("No se pudo abrir la imagen"));
    img.src = url;
  });
}

// El reconocimiento funciona mejor con letras oscuras sobre fondo claro: las capturas oscuras se invierten.
async function prepararImagen(archivo) {
  const img = await cargar(archivo);
  const escala = Math.min(LADO_MAXIMO / Math.max(img.width, img.height), 2);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

  const imagen = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  const d = imagen.data;
  let suma = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gris = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = gris;
    suma += gris;
  }
  if (suma / (d.length / 4) < 110) {
    for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
  }
  ctx.putImageData(imagen, 0, 0);
  return lienzo;
}

function conLimite(promesa) {
  let reloj;
  const limite = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error("La lectura tardó demasiado")), TIEMPO_MAXIMO_MS);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}

export function leerImagen(archivo, alProgreso) {
  return conLimite(leer(archivo, alProgreso));
}

async function leer(archivo, alProgreso) {
  const lienzo = await prepararImagen(archivo);
  const { createWorker } = await import("tesseract.js");
  const lector = await createWorker(["spa", "eng"], 1, {
    logger: (m) => m.status === "recognizing text" && alProgreso?.(m.progress),
  });
  try {
    const { data } = await lector.recognize(lienzo);
    return corregirCaptura(data.text);
  } finally {
    await lector.terminate();
  }
}
