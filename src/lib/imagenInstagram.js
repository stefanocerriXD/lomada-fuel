// La imagen para subir a Instagram: la foto de la comida, el título, las calorías, los macros y la marca de Lomada Fuel.
// Se dibuja en el celu (canvas), sin servicios de afuera.
import { tipoInfo } from "./macros.js";

export const FORMATOS = {
  historia: { ancho: 1080, alto: 1920, nombre: "Historia" },
  publicacion: { ancho: 1080, alto: 1350, nombre: "Publicación" },
};

const FONDO = "#140d08";
const ACENTO = "#e8582a";
const MACROS = [
  ["proteinas", "P", "Proteína", "#5b93ec"],
  ["carbohidratos", "C", "Carbos", "#e0a72a"],
  ["grasas", "G", "Grasas", "#dc6bb6"],
];

function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("imagen"));
    img.src = src;
  });
}

// La foto viene firmada desde otro dominio: se baja como blob para que el canvas se pueda exportar.
async function cargarFoto(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const local = URL.createObjectURL(await res.blob());
    try {
      return await cargarImagen(local);
    } finally {
      setTimeout(() => URL.revokeObjectURL(local), 0);
    }
  } catch {
    return null;
  }
}

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Corta el título en renglones; el último lleva "…" si no entra.
function renglones(ctx, texto, ancho, maximo) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length <= maximo) return lineas;
  const cortadas = lineas.slice(0, maximo);
  let ultima = cortadas[maximo - 1];
  while (ultima && ctx.measureText(`${ultima}…`).width > ancho) ultima = ultima.slice(0, -1);
  cortadas[maximo - 1] = `${ultima.trimEnd()}…`;
  return cortadas;
}

function dibujarCubriendo(ctx, img, x, y, w, h) {
  const escala = Math.max(w / img.width, h / img.height);
  const iw = img.width * escala;
  const ih = img.height * escala;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

const fechaLinda = (fecha) => {
  if (!fecha) return "";
  const d = new Date(`${fecha}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(/[.,]/g, "");
};

export async function armarImagenInstagram({ comida, foto, formato = "historia" }) {
  const { ancho: W, alto: H } = FORMATOS[formato];
  const k = formato === "historia" ? 1 : 0.84;
  const margen = 72;
  await Promise.all(["500", "600", "700", "800"].map((p) => document.fonts?.load?.(`${p} 40px Poppins`)).filter(Boolean)).catch(() => {});
  const [img, logo] = await Promise.all([cargarFoto(foto), cargarImagen("/icono-192.png").catch(() => null)]);

  const lienzo = document.createElement("canvas");
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext("2d");
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, W, H);

  // La foto ocupa la parte de arriba y se funde con el fondo.
  const altoFoto = Math.round(H * (formato === "historia" ? 0.66 : 0.64));
  if (img) {
    dibujarCubriendo(ctx, img, 0, 0, W, altoFoto);
  } else {
    const brillo = ctx.createRadialGradient(W * 0.7, altoFoto * 0.35, 40, W * 0.6, altoFoto * 0.4, W);
    brillo.addColorStop(0, "#c43d15");
    brillo.addColorStop(0.55, "#5a1d0b");
    brillo.addColorStop(1, FONDO);
    ctx.fillStyle = brillo;
    ctx.fillRect(0, 0, W, altoFoto);
    if (logo) {
      ctx.globalAlpha = 0.18;
      const t = 520 * k;
      ctx.drawImage(logo, (W - t) / 2, altoFoto * 0.42 - t / 2, t, t);
      ctx.globalAlpha = 1;
    }
  }
  const fundido = ctx.createLinearGradient(0, altoFoto * 0.5, 0, altoFoto + 2);
  fundido.addColorStop(0, "rgba(20,13,8,0)");
  fundido.addColorStop(0.7, "rgba(20,13,8,0.82)");
  fundido.addColorStop(1, FONDO);
  ctx.fillStyle = fundido;
  ctx.fillRect(0, altoFoto * 0.5, W, altoFoto * 0.5 + 2);
  const sombraArriba = ctx.createLinearGradient(0, 0, 0, 330 * k);
  sombraArriba.addColorStop(0, "rgba(0,0,0,0.55)");
  sombraArriba.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sombraArriba;
  ctx.fillRect(0, 0, W, 330 * k);

  // Arriba: el logo y el nombre de la app (debajo de la barra de Instagram).
  const arriba = formato === "historia" ? 150 : 64;
  const tamLogo = 88 * k;
  if (logo) {
    ctx.save();
    redondeado(ctx, margen, arriba, tamLogo, tamLogo, 22 * k);
    ctx.clip();
    ctx.drawImage(logo, margen, arriba, tamLogo, tamLogo);
    ctx.restore();
  }
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${50 * k}px Poppins, sans-serif`;
  ctx.fillText("Lomada Fuel", margen + tamLogo + 24, arriba + tamLogo / 2 + 2);

  // Abajo hacia arriba: pie, macros, calorías, título y la etiqueta de la comida.
  ctx.textBaseline = "alphabetic";
  let y = H - (formato === "historia" ? 220 : 76);
  ctx.font = `600 ${32 * k}px Poppins, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  const pie = "Registrado en la app Lomada Fuel";
  ctx.fillText(pie, margen, y);

  const kcal = Math.round(Number(comida.calorias) || 0);
  const hayMacros = MACROS.some(([c]) => Number(comida[c]) > 0);
  if (hayMacros) {
    const altoCaja = 176 * k;
    const sep = 22;
    const anchoCaja = (W - margen * 2 - sep * 2) / 3;
    y -= 64 * k + altoCaja;
    MACROS.forEach(([campo, letra, nombre, color], i) => {
      const x = margen + i * (anchoCaja + sep);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      redondeado(ctx, x, y, anchoCaja, altoCaja, 30 * k);
      ctx.fill();
      ctx.fillStyle = color;
      redondeado(ctx, x + 30 * k, y + 30 * k, 50 * k, 50 * k, 14 * k);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${30 * k}px Poppins, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(letra, x + 55 * k, y + 66 * k);
      ctx.textAlign = "left";
      ctx.font = `600 ${27 * k}px Poppins, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(nombre, x + 94 * k, y + 65 * k);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${62 * k}px Poppins, sans-serif`;
      const valor = String(Math.round(Number(comida[campo]) || 0));
      ctx.fillText(valor, x + 30 * k, y + 148 * k);
      const anchoValor = ctx.measureText(valor).width;
      ctx.font = `700 ${34 * k}px Poppins, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText("g", x + 30 * k + anchoValor + 8, y + 148 * k);
    });
  }

  if (kcal > 0) {
    y -= (hayMacros ? 48 : 64) * k;
    ctx.font = `800 ${170 * k}px Poppins, sans-serif`;
    ctx.fillStyle = "#fff";
    const numero = new Intl.NumberFormat("es-AR").format(kcal);
    ctx.fillText(numero, margen - 6, y);
    const anchoNumero = ctx.measureText(numero).width;
    ctx.font = `700 ${58 * k}px Poppins, sans-serif`;
    ctx.fillStyle = ACENTO;
    ctx.fillText("kcal", margen + anchoNumero + 14, y);
    y -= 170 * k * 0.78;
  }

  const tipo = tipoInfo(comida.tipo).texto;
  const titulo = (comida.descripcion || tipo).trim();
  ctx.font = `800 ${74 * k}px Poppins, sans-serif`;
  const lineas = renglones(ctx, titulo, W - margen * 2, formato === "historia" ? 3 : 2);
  const alto = 86 * k;
  y -= 52 * k;
  ctx.fillStyle = "#fff";
  lineas.slice().reverse().forEach((l, i) => ctx.fillText(l, margen, y - i * alto));
  y -= lineas.length * alto;

  // La etiqueta: "CENA · LUN 16 NOV".
  const etiqueta = [tipo, fechaLinda(comida.fecha)].filter(Boolean).join(" · ").toUpperCase();
  ctx.font = `700 ${30 * k}px Poppins, sans-serif`;
  const anchoEtiqueta = ctx.measureText(etiqueta).width + 52 * k;
  const altoEtiqueta = 60 * k;
  y -= altoEtiqueta - 4;
  ctx.fillStyle = ACENTO;
  redondeado(ctx, margen, y, anchoEtiqueta, altoEtiqueta, altoEtiqueta / 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(etiqueta, margen + 26 * k, y + altoEtiqueta / 2 + 2);

  const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) throw new Error("No se pudo armar la imagen");
  const nombre = `lomada-fuel-${comida.fecha || "comida"}-${formato}.jpg`;
  return new File([blob], nombre, { type: "image/jpeg" });
}
