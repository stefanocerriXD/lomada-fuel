// La imagen para subir a Instagram: la foto de la comida, el título, las calorías, los macros y el logo de Lomada.
// Se dibuja en el celu (canvas), sin servicios de afuera.
import { TENEDOR, CUCHILLO } from "../componentes/Logo.jsx";
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

// El círculo de Lomada (azul, blanco y verde), dibujado a mano para que salga igual en todos los celus.
function circuloLomada(ctx, x, y, tam) {
  const r = tam / 2;
  const u = tam / 100;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#0165a0";
  ctx.fillRect(x, y, tam, tam);
  const loma = (alto, color) => {
    ctx.beginPath();
    ctx.moveTo(x, y + alto[0] * u);
    ctx.bezierCurveTo(x + 25 * u, y + alto[1] * u, x + 60 * u, y + alto[2] * u, x + 100 * u, y + alto[3] * u);
    ctx.lineTo(x + tam, y + tam);
    ctx.lineTo(x, y + tam);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  loma([63, 52, 47, 49], "#fff");
  loma([69, 58, 54, 56], "#046a43");
  ctx.restore();
}

// El logo de la app sin fondo: el plato con Lomada adentro y los cubiertos blancos al costado.
// Mismas medidas que Logo.jsx (caja de 52 empezando en 4.75, 6.5).
function logoApp(ctx, x, y, tam) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tam / 52, tam / 52);
  ctx.translate(-4.75, -6.5);
  const circulo = (cy, r, color) => { ctx.beginPath(); ctx.arc(32, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
  circulo(33, 15.5, "#fff");
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.arc(32, 33, 12.4, 0, Math.PI * 2);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = "#dcd6cf";
  ctx.stroke();
  circuloLomada(ctx, 32 - 11.4, 33 - 11.4, 22.8);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 6;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(TENEDOR));
  ctx.stroke(new Path2D(CUCHILLO));
  ctx.restore();
}

export async function armarImagenInstagram({ comida, foto, formato = "historia" }) {
  const { ancho: W, alto: H } = FORMATOS[formato];
  const historia = formato === "historia";
  const margen = 64;
  await Promise.all(["600", "700", "800"].map((p) => document.fonts?.load?.(`${p} 40px Poppins`)).filter(Boolean)).catch(() => {});
  const img = await cargarFoto(foto);

  const lienzo = document.createElement("canvas");
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext("2d");

  // La foto ocupa toda la imagen; abajo se oscurece de a poco para que se lea el texto.
  if (img) {
    dibujarCubriendo(ctx, img, 0, 0, W, H);
  } else {
    const brillo = ctx.createRadialGradient(W * 0.7, H * 0.3, 40, W * 0.6, H * 0.35, H);
    brillo.addColorStop(0, "#c43d15");
    brillo.addColorStop(0.5, "#5a1d0b");
    brillo.addColorStop(1, FONDO);
    ctx.fillStyle = brillo;
    ctx.fillRect(0, 0, W, H);
  }
  const desde = H * (historia ? 0.52 : 0.42);
  const sombra = ctx.createLinearGradient(0, desde, 0, H);
  sombra.addColorStop(0, "rgba(12,8,5,0)");
  sombra.addColorStop(0.45, "rgba(12,8,5,0.5)");
  sombra.addColorStop(1, "rgba(12,8,5,0.86)");
  ctx.fillStyle = sombra;
  ctx.fillRect(0, desde, W, H - desde);
  const arribaAlto = historia ? 380 : 220;
  const sombraArriba = ctx.createLinearGradient(0, 0, 0, arribaAlto);
  sombraArriba.addColorStop(0, "rgba(0,0,0,0.42)");
  sombraArriba.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sombraArriba;
  ctx.fillRect(0, 0, W, arribaAlto);

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;

  // Arriba: el logo de la app (debajo de la barra de Instagram en las historias).
  const arriba = historia ? 160 : 56;
  const tamLogo = 72;
  logoApp(ctx, margen, arriba, tamLogo);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.font = "800 34px Poppins, sans-serif";
  ctx.fillText("LOMADA FUEL", margen + tamLogo + 18, arriba + tamLogo / 2 + 2);

  // Abajo hacia arriba: pie, macros, calorías, título y la etiqueta de la comida.
  ctx.textBaseline = "alphabetic";
  let y = H - (historia ? 230 : 60);
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText("Registrado en la app Lomada Fuel", margen, y);

  const hayMacros = MACROS.some(([c]) => Number(comida[c]) > 0);
  if (hayMacros) {
    const alto = 56;
    y -= 36 + alto;
    let x = margen;
    ctx.font = "700 26px Poppins, sans-serif";
    MACROS.forEach(([campo, letra, , color]) => {
      const texto = `${letra} ${Math.round(Number(comida[campo]) || 0)} g`;
      const ancho = ctx.measureText(texto).width + 72;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      redondeado(ctx, x, y, ancho, alto, alto / 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 30, y + alto / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(texto, x + 50, y + alto / 2 + 2);
      ctx.textBaseline = "alphabetic";
      x += ancho + 12;
    });
    ctx.shadowBlur = 12;
  }

  const kcal = Math.round(Number(comida.calorias) || 0);
  if (kcal > 0) {
    y -= 26;
    ctx.font = "800 96px Poppins, sans-serif";
    ctx.fillStyle = "#fff";
    const numero = new Intl.NumberFormat("es-AR").format(kcal);
    ctx.fillText(numero, margen - 3, y);
    const anchoNumero = ctx.measureText(numero).width;
    ctx.font = "700 38px Poppins, sans-serif";
    ctx.fillStyle = "#ff8a5c";
    ctx.fillText("kcal", margen + anchoNumero + 12, y);
    y -= 96 * 0.74;
  }

  const tipo = tipoInfo(comida.tipo).texto;
  const titulo = (comida.descripcion || tipo).trim();
  ctx.font = "800 50px Poppins, sans-serif";
  const lineas = renglones(ctx, titulo, W - margen * 2, 2);
  const altoLinea = 60;
  y -= 42;
  ctx.fillStyle = "#fff";
  lineas.slice().reverse().forEach((l, i) => ctx.fillText(l, margen, y - i * altoLinea));
  y -= (lineas.length - 1) * altoLinea + 50;

  // La etiqueta: "CENA · LUN 16 NOV".
  const etiqueta = [tipo, fechaLinda(comida.fecha)].filter(Boolean).join(" · ").toUpperCase();
  ctx.shadowBlur = 0;
  ctx.font = "700 22px Poppins, sans-serif";
  const anchoEtiqueta = ctx.measureText(etiqueta).width + 40;
  const altoEtiqueta = 44;
  y -= altoEtiqueta + 14;
  ctx.fillStyle = ACENTO;
  redondeado(ctx, margen, y, anchoEtiqueta, altoEtiqueta, altoEtiqueta / 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(etiqueta, margen + 20, y + altoEtiqueta / 2 + 1);

  const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) throw new Error("No se pudo armar la imagen");
  const nombre = `lomada-fuel-${comida.fecha || "comida"}-${formato}.jpg`;
  return new File([blob], nombre, { type: "image/jpeg" });
}
