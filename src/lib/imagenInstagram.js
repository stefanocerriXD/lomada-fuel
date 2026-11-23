// La imagen para subir a Instagram: la foto de la comida, el título, las calorías, los macros y el logo de Lomada.
// Se dibuja en el celu (canvas), sin servicios de afuera.
import { LOGO } from "../componentes/Logo.jsx";
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

// El logo de la app ("Disco de lomada", mismas medidas que Logo.jsx), con los cubiertos blancos porque va sobre la foto.
// Se arma en un lienzo aparte: el aro que separa los cubiertos del disco se recorta sin tocar la foto.
function logoApp(ctx, x, y, tam, cubiertos = "#fff") {
  const lado = Math.ceil(tam);
  const lienzo = document.createElement("canvas");
  lienzo.width = lado;
  lienzo.height = lado;
  const c = lienzo.getContext("2d");
  const [cajaX, cajaY, cajaLado] = LOGO.caja.split(" ").map(Number);
  c.scale(lado / cajaLado, lado / cajaLado);
  c.translate(-cajaX, -cajaY);
  c.fillStyle = cubiertos;
  c.fill(new Path2D(LOGO.tenedorD));
  c.fill(new Path2D(LOGO.cuchilloD));
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.arc(LOGO.cx, LOGO.cy, LOGO.corte, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";
  c.beginPath();
  c.arc(LOGO.cx, LOGO.cy, LOGO.r, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = "#fff";
  c.fillRect(LOGO.cx - LOGO.r, LOGO.cy - LOGO.r, LOGO.r * 2, LOGO.r * 2);
  c.fillStyle = LOGO.azul;
  c.fill(new Path2D(LOGO.azulD));
  c.fillStyle = LOGO.verde;
  c.fill(new Path2D(LOGO.verdeD));
  ctx.drawImage(lienzo, x, y, tam, tam);
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

// ---------- El día entero: todas las fotos del día, con el total y los macros. Tres plantillas. ----------

export const PLANTILLAS_DIA = [
  ["grilla", "Grilla"],
  ["collage", "Collage"],
  ["ticket", "Ticket"],
];

// Cuántas fotos van por fila según cuántas hay (en la historia hay más alto para apilar).
const FILAS = {
  historia: { 1: [1], 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [2, 2, 2], 7: [2, 2, 3], 8: [2, 3, 3], 9: [3, 3, 3] },
  publicacion: { 1: [1], 2: [2], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3] },
};
const ORDEN_DIA = ["desayuno", "almuerzo", "merienda", "cena", "colacion", "fiesta", "resumen"];
const numeroAr = (n) => new Intl.NumberFormat("es-AR").format(Math.round(n));
const TINTA = "#2a2622";
const PAPEL = "#f7efe5";

function fondoOscuro(ctx, W, H) {
  const fondo = ctx.createRadialGradient(W * 0.85, 0, 40, W * 0.6, H * 0.2, H * 0.9);
  fondo.addColorStop(0, "#6e2810");
  fondo.addColorStop(0.45, "#2a140a");
  fondo.addColorStop(1, FONDO);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);
}

function chipsMacros(ctx, total, x, y) {
  const alto = 56;
  ctx.font = "700 26px Poppins, sans-serif";
  MACROS.forEach(([campo, letra, , color]) => {
    const texto = `${letra} ${Math.round(Number(total[campo]) || 0)} g`;
    const ancho = ctx.measureText(texto).width + 72;
    ctx.fillStyle = "rgba(255,255,255,0.14)";
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
  return alto;
}

// La etiqueta naranja "MI DÍA · MAR 17 NOV". Devuelve su ancho.
function pastilla(ctx, texto, x, y, derecha = false, color = ACENTO) {
  ctx.font = "700 22px Poppins, sans-serif";
  const ancho = ctx.measureText(texto).width + 40;
  const alto = 44;
  const x0 = derecha ? x - ancho : x;
  ctx.fillStyle = color;
  redondeado(ctx, x0, y, ancho, alto, alto / 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x0 + 20, y + alto / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return ancho;
}

// Logo + "LOMADA FUEL" en una fila.
function marca(ctx, x, y, color = "#fff", cubiertos = "#fff") {
  const tam = 72;
  logoApp(ctx, x, y, tam, cubiertos);
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.font = "800 34px Poppins, sans-serif";
  ctx.fillText("LOMADA FUEL", x + tam + 18, y + tam / 2 + 2);
  ctx.textBaseline = "alphabetic";
  return tam;
}

// El total grande con la meta al lado. y = renglón de base del número.
function totalGrande(ctx, total, meta, x, y, tam) {
  ctx.font = `800 ${tam}px Poppins, sans-serif`;
  ctx.fillStyle = "#fff";
  const numero = numeroAr(total.kcal || 0);
  ctx.fillText(numero, x - 3, y);
  const ancho = ctx.measureText(numero).width;
  ctx.font = "700 38px Poppins, sans-serif";
  ctx.fillStyle = "#ff8a5c";
  ctx.fillText(meta ? `/ ${numeroAr(meta)} kcal` : "kcal", x + ancho + 16, y);
}

const etiquetaFoto = (foto) => {
  if (!foto.primera) return "";
  const kcal = Math.round(Number(foto.comida.calorias) || 0);
  return [tipoInfo(foto.comida.tipo).texto, kcal > 0 && `${numeroAr(kcal)} kcal`].filter(Boolean).join(" · ");
};

// Una foto de la grilla, con la comida y sus kcal abajo (si lleva etiqueta).
function mosaico(ctx, img, x, y, w, h, { radio, etiqueta, extra }) {
  ctx.save();
  redondeado(ctx, x, y, w, h, radio);
  ctx.clip();
  dibujarCubriendo(ctx, img, x, y, w, h);
  if (etiqueta) {
    const alto = Math.min(150, h * 0.5);
    const sombra = ctx.createLinearGradient(0, y + h - alto, 0, y + h);
    sombra.addColorStop(0, "rgba(12,8,5,0)");
    sombra.addColorStop(1, "rgba(12,8,5,0.78)");
    ctx.fillStyle = sombra;
    ctx.fillRect(x, y + h - alto, w, alto);
  }
  if (extra) {
    ctx.fillStyle = "rgba(12,8,5,0.55)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "800 72px Poppins, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${extra}`, x + w / 2, y + h / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  if (!etiqueta || extra) return;
  const tam = w < 400 ? 24 : 28;
  ctx.font = `700 ${tam}px Poppins, sans-serif`;
  ctx.fillStyle = "#fff";
  let texto = etiqueta;
  while (texto.length > 3 && ctx.measureText(texto).width > w - 40) texto = `${texto.slice(0, -2).trimEnd()}…`;
  ctx.fillText(texto, x + 20, y + h - 22);
}

function grillaFotos(ctx, imagenes, sobran, formato, zona, opciones) {
  const filas = FILAS[formato][imagenes.length];
  const altoFila = (zona.h - opciones.hueco * (filas.length - 1)) / filas.length;
  let i = 0;
  filas.forEach((enFila, f) => {
    const anchoFoto = (zona.w - opciones.hueco * (enFila - 1)) / enFila;
    for (let k = 0; k < enFila; k++, i++) {
      const foto = imagenes[i];
      mosaico(ctx, foto.img, zona.x + k * (anchoFoto + opciones.hueco), zona.y + f * (altoFila + opciones.hueco), anchoFoto, altoFila, {
        radio: opciones.radio,
        etiqueta: opciones.etiquetas ? etiquetaFoto(foto) : "",
        extra: i === imagenes.length - 1 && sobran > 0 ? sobran : 0,
      });
    }
  });
}

// Sin fotos: la lista de comidas del día en renglones.
function listaComidas(ctx, comidas, x, y, w, maxY) {
  for (const c of comidas) {
    if (y + 90 > maxY) break;
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(x, y, w, 2);
    ctx.font = "700 24px Poppins, sans-serif";
    ctx.fillStyle = "#ff8a5c";
    ctx.fillText(tipoInfo(c.tipo).texto.toUpperCase(), x, y + 44);
    ctx.font = "700 32px Poppins, sans-serif";
    ctx.fillStyle = "#fff";
    const kcal = `${numeroAr(c.calorias || 0)} kcal`;
    ctx.fillText(kcal, x + w - ctx.measureText(kcal).width, y + 44);
    ctx.font = "600 30px Poppins, sans-serif";
    const [linea] = renglones(ctx, (c.descripcion || tipoInfo(c.tipo).texto).trim(), w, 1);
    ctx.fillText(linea, x, y + 86);
    y += 112;
  }
}

const pieTexto = (n) => `${n} ${n === 1 ? "comida" : "comidas"} · Registrado en la app Lomada Fuel`;

// Grilla: encabezado compacto y las fotos grandes con su comida.
function plantillaGrilla(ctx, d) {
  const { W, H, historia, formato, total, meta, ordenadas, imagenes, sobran } = d;
  const margen = 48;
  fondoOscuro(ctx, W, H);
  const arriba = historia ? 150 : 48;
  const tamLogo = marca(ctx, margen, arriba);
  pastilla(ctx, d.etiqueta, W - margen, arriba + (tamLogo - 44) / 2, true);
  let y = arriba + tamLogo + (historia ? 136 : 108);
  totalGrande(ctx, total, meta, margen, y, historia ? 112 : 92);
  y += 30;
  y += chipsMacros(ctx, { proteinas: total.p, carbohidratos: total.c, grasas: total.g }, margen, y);
  const pie = historia ? 200 : 52;
  const zona = { x: margen, y: y + 32, w: W - margen * 2 };
  zona.h = H - pie - 48 - zona.y;
  if (imagenes.length) grillaFotos(ctx, imagenes, sobran, formato, zona, { hueco: 10, radio: 26, etiquetas: true });
  else listaComidas(ctx, ordenadas, zona.x, zona.y, zona.w, zona.y + zona.h);
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText(pieTexto(ordenadas.length), margen, H - pie);
}

// Collage: las fotos ocupan toda la imagen y los números van encima, abajo.
function plantillaCollage(ctx, d) {
  const { W, H, historia, formato, total, meta, ordenadas, imagenes, sobran } = d;
  const margen = 64;
  fondoOscuro(ctx, W, H);
  if (imagenes.length) grillaFotos(ctx, imagenes, sobran, formato, { x: 0, y: 0, w: W, h: H }, { hueco: 8, radio: 0, etiquetas: false });
  const desde = H * (historia ? 0.5 : 0.4);
  const sombra = ctx.createLinearGradient(0, desde, 0, H);
  sombra.addColorStop(0, "rgba(12,8,5,0)");
  sombra.addColorStop(0.45, "rgba(12,8,5,0.6)");
  sombra.addColorStop(1, "rgba(12,8,5,0.92)");
  ctx.fillStyle = sombra;
  ctx.fillRect(0, desde, W, H - desde);
  const arribaAlto = historia ? 380 : 220;
  const sombraArriba = ctx.createLinearGradient(0, 0, 0, arribaAlto);
  sombraArriba.addColorStop(0, "rgba(0,0,0,0.5)");
  sombraArriba.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sombraArriba;
  ctx.fillRect(0, 0, W, arribaAlto);

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  marca(ctx, margen, historia ? 160 : 56);
  if (!imagenes.length) listaComidas(ctx, ordenadas, margen, historia ? 320 : 180, W - margen * 2, H * 0.55);

  // De abajo hacia arriba: pie, macros, total y la etiqueta.
  let y = H - (historia ? 230 : 60);
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(pieTexto(ordenadas.length), margen, y);
  ctx.shadowBlur = 0;
  y -= 36 + 56;
  chipsMacros(ctx, { proteinas: total.p, carbohidratos: total.c, grasas: total.g }, margen, y);
  ctx.shadowBlur = 12;
  y -= 30;
  totalGrande(ctx, total, meta, margen, y, 112);
  y -= 112 * 0.74 + 40 + 44;
  ctx.shadowBlur = 0;
  pastilla(ctx, d.etiqueta, margen, y);
}

// Papel con el borde de arriba y de abajo en zigzag, como un ticket.
function papelTicket(ctx, x, y, w, h) {
  const diente = 18;
  const n = Math.round(w / (diente * 2));
  const paso = w / n;
  ctx.beginPath();
  ctx.moveTo(x, y + diente);
  for (let i = 0; i < n; i++) {
    ctx.lineTo(x + i * paso + paso / 2, y);
    ctx.lineTo(x + (i + 1) * paso, y + diente);
  }
  ctx.lineTo(x + w, y + h - diente);
  for (let i = n; i > 0; i--) {
    ctx.lineTo(x + i * paso - paso / 2, y + h);
    ctx.lineTo(x + (i - 1) * paso, y + h - diente);
  }
  ctx.closePath();
}

function lineaPunteada(ctx, x, y, w) {
  ctx.save();
  ctx.strokeStyle = "rgba(42,38,34,0.45)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}

// Código de barras de adorno, siempre igual para la misma fecha.
function codigoDeBarras(ctx, x, y, w, h, semilla) {
  let n = [...semilla].reduce((t, c) => (t * 31 + c.charCodeAt(0)) >>> 0, 7);
  const azar = () => {
    n = (n * 1103515245 + 12345) >>> 0;
    return (n >>> 16) / 65536;
  };
  ctx.fillStyle = TINTA;
  let i = x;
  while (i < x + w) {
    const ancho = 2 + Math.floor(azar() * 5);
    if (i + ancho > x + w) break;
    ctx.fillRect(i, y, ancho, h);
    i += ancho + 2 + Math.floor(azar() * 5);
  }
}

function textoCortado(ctx, texto, ancho) {
  let t = texto;
  while (t.length > 3 && ctx.measureText(t).width > ancho) t = `${t.slice(0, -2).trimEnd()}…`;
  return t;
}

// Ticket: cada comida en un renglón con su foto chiquita, y el total abajo.
function plantillaTicket(ctx, d) {
  const { W, H, historia, total, meta, ordenadas, fotoDe, fecha } = d;
  fondoOscuro(ctx, W, H);
  const px = historia ? 64 : 110;
  const y0 = historia ? 140 : 40;
  const y1 = H - (historia ? 190 : 40);
  const w = W - px * 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = PAPEL;
  papelTicket(ctx, px, y0, w, y1 - y0);
  ctx.fill();
  ctx.restore();

  const x = px + 48;
  const ancho = w - 96;
  const centro = W / 2;
  let y = y0 + (historia ? 70 : 52);
  const tamLogo = historia ? 96 : 76;
  logoApp(ctx, centro - tamLogo / 2, y, tamLogo, TINTA);
  y += tamLogo + (historia ? 54 : 44);
  ctx.textAlign = "center";
  ctx.fillStyle = TINTA;
  ctx.font = `800 ${historia ? 40 : 34}px Poppins, sans-serif`;
  ctx.fillText("LOMADA FUEL", centro, y);
  y += historia ? 44 : 36;
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = "rgba(42,38,34,0.7)";
  ctx.fillText(`TICKET DEL DÍA · ${fechaLinda(fecha).toUpperCase()}`, centro, y);
  ctx.textAlign = "left";
  y += 34;
  lineaPunteada(ctx, x, y, ancho);
  y += 18;

  // Lo de abajo (macros, total, código) se reserva primero; las comidas usan lo que queda.
  const abajo = historia ? 400 : 330;
  const lugar = y1 - abajo - y;
  const minimo = historia ? 120 : 92;
  const entran = Math.max(1, Math.floor(lugar / minimo));
  const muestro = ordenadas.length > entran ? ordenadas.slice(0, entran - 1) : ordenadas;
  const resto = ordenadas.length - muestro.length;
  const alto = Math.min(historia ? 170 : 130, lugar / (muestro.length + (resto ? 1 : 0)));
  const lado = alto - 22;
  for (const c of muestro) {
    const img = fotoDe(c);
    const fy = y + (alto - lado) / 2;
    ctx.save();
    redondeado(ctx, x, fy, lado, lado, 16);
    ctx.clip();
    if (img) dibujarCubriendo(ctx, img, x, fy, lado, lado);
    else {
      ctx.fillStyle = "rgba(232,88,42,0.16)";
      ctx.fillRect(x, fy, lado, lado);
      ctx.fillStyle = ACENTO;
      ctx.font = `800 ${Math.round(lado * 0.42)}px Poppins, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tipoInfo(c.tipo).texto[0], x + lado / 2, fy + lado / 2 + 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    const tx = x + lado + 24;
    const kcal = `${numeroAr(c.calorias || 0)} kcal`;
    ctx.font = `700 ${historia ? 32 : 28}px Poppins, sans-serif`;
    const anchoKcal = ctx.measureText(kcal).width;
    ctx.fillStyle = TINTA;
    ctx.fillText(kcal, x + ancho - anchoKcal, y + alto / 2 + 11);
    const medio = y + alto / 2;
    ctx.font = "700 21px Poppins, sans-serif";
    ctx.fillStyle = "#b8461c";
    ctx.fillText(tipoInfo(c.tipo).texto.toUpperCase(), tx, medio - 8);
    ctx.font = `600 ${historia ? 28 : 25}px Poppins, sans-serif`;
    ctx.fillStyle = TINTA;
    ctx.fillText(textoCortado(ctx, (c.descripcion || tipoInfo(c.tipo).texto).trim(), ancho - lado - 24 - anchoKcal - 20), tx, medio + 28);
    y += alto;
  }
  if (resto) {
    ctx.font = "600 26px Poppins, sans-serif";
    ctx.fillStyle = "rgba(42,38,34,0.7)";
    ctx.fillText(`+ ${resto} ${resto === 1 ? "comida más" : "comidas más"}`, x, y + Math.min(alto, 60) / 2 + 10);
  }

  // Abajo, siempre en el mismo lugar.
  y = y1 - abajo + 10;
  lineaPunteada(ctx, x, y, ancho);
  y += 50;
  ctx.font = "600 26px Poppins, sans-serif";
  ctx.fillStyle = "rgba(42,38,34,0.75)";
  const macros = `P ${Math.round(total.p)} g   ·   C ${Math.round(total.c)} g   ·   G ${Math.round(total.g)} g`;
  ctx.textAlign = "center";
  ctx.fillText(macros, centro, y);
  ctx.textAlign = "left";
  y += historia ? 76 : 66;
  ctx.fillStyle = TINTA;
  ctx.font = `800 ${historia ? 44 : 38}px Poppins, sans-serif`;
  ctx.fillText("TOTAL", x, y);
  const numero = `${numeroAr(total.kcal || 0)} kcal`;
  ctx.font = `800 ${historia ? 56 : 46}px Poppins, sans-serif`;
  ctx.fillText(numero, x + ancho - ctx.measureText(numero).width, y);
  if (meta) {
    y += 40;
    ctx.font = "600 24px Poppins, sans-serif";
    ctx.fillStyle = "rgba(42,38,34,0.7)";
    const textoMeta = `Meta ${numeroAr(meta)} kcal`;
    ctx.fillText(textoMeta, x + ancho - ctx.measureText(textoMeta).width, y);
  }
  const alturaCodigo = historia ? 84 : 64;
  const yCodigo = y1 - alturaCodigo - (historia ? 90 : 70);
  codigoDeBarras(ctx, x + ancho * 0.15, yCodigo, ancho * 0.7, alturaCodigo, fecha || "lomada");
  ctx.textAlign = "center";
  ctx.font = "600 22px Poppins, sans-serif";
  ctx.fillStyle = "rgba(42,38,34,0.65)";
  ctx.fillText("¡Gracias por comer con Lomada Fuel!", centro, yCodigo + alturaCodigo + 40);
  ctx.textAlign = "left";
}

// comidas: las del día de la persona (sin el resumen de Apple Salud); total: sumarComidas de todo el día.
export async function armarImagenDia({ comidas, fotos, fecha, total, meta, formato = "historia", plantilla = "grilla" }) {
  const { ancho: W, alto: H } = FORMATOS[formato];
  const historia = formato === "historia";
  await Promise.all(["600", "700", "800"].map((p) => document.fonts?.load?.(`${p} 40px Poppins`)).filter(Boolean)).catch(() => {});

  const ordenadas = [...comidas].sort((a, b) => ORDEN_DIA.indexOf(a.tipo) - ORDEN_DIA.indexOf(b.tipo) || String(a.creado_en || "").localeCompare(String(b.creado_en || "")));
  // En el ticket va una foto por comida; en las otras, todas (las extra de una comida también entran).
  const ticket = plantilla === "ticket";
  const conFoto = ordenadas.flatMap((c) => [c.foto_path, ...(ticket ? [] : c.fotos_extra || [])].filter((r) => r && fotos[r]).map((r, n) => ({ comida: c, url: fotos[r], primera: n === 0 })));
  const elegidas = conFoto.slice(0, ticket ? 12 : historia ? 9 : 6);
  const sobran = conFoto.length - elegidas.length;
  const imagenes = (await Promise.all(elegidas.map(async (f) => ({ ...f, img: await cargarFoto(f.url) })))).filter((f) => f.img);

  const lienzo = document.createElement("canvas");
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext("2d");
  const datos = {
    W, H, historia, formato, fecha, total, meta, ordenadas, imagenes, sobran,
    etiqueta: `MI DÍA · ${fechaLinda(fecha).toUpperCase()}`,
    fotoDe: (c) => imagenes.find((f) => f.comida.id === c.id)?.img || null,
  };
  if (plantilla === "collage") plantillaCollage(ctx, datos);
  else if (ticket) plantillaTicket(ctx, datos);
  else plantillaGrilla(ctx, datos);

  const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) throw new Error("No se pudo armar la imagen");
  return new File([blob], `lomada-fuel-${fecha}-dia-${plantilla}-${formato}.jpg`, { type: "image/jpeg" });
}

// ---------- Modo fiesta: una foto de la noche o todas, con los vasos que tomaste (si querés). Nunca el gol. ----------

const FIESTA = "#b04cff";

function fondoFiesta(ctx, W, H) {
  const fondo = ctx.createRadialGradient(W * 0.8, H * 0.1, 40, W * 0.5, H * 0.4, H);
  fondo.addColorStop(0, "#ff3d9a");
  fondo.addColorStop(0.35, "#5b1f9e");
  fondo.addColorStop(1, "#0d0618");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);
}

// "3 × Fernet con coca": los tragos agrupados, del más tomado al menos.
export function tragosAgrupados(vasos) {
  const grupos = new Map();
  for (const v of vasos || []) {
    const nombre = String(v.nombre || "Trago").trim();
    grupos.set(nombre, (grupos.get(nombre) || 0) + 1);
  }
  return [...grupos.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, n]) => ({ nombre, n }));
}

// fotos: las URLs de las fotos de la noche. modo "una" (la de `indice`) o "todas" (collage).
export async function armarImagenFiesta({ fotos = [], vasos = [], kcal = 0, fecha, formato = "historia", modo = "una", indice = 0, conVasos = true }) {
  const { ancho: W, alto: H } = FORMATOS[formato];
  const historia = formato === "historia";
  const margen = 64;
  await Promise.all(["600", "700", "800"].map((p) => document.fonts?.load?.(`${p} 40px Poppins`)).filter(Boolean)).catch(() => {});
  const elegidas = modo === "todas" ? fotos.slice(0, historia ? 9 : 6) : fotos.slice(indice, indice + 1);
  const sobran = modo === "todas" ? Math.max(0, fotos.length - elegidas.length) : 0;
  const imagenes = (await Promise.all(elegidas.map(async (url) => ({ img: await cargarFoto(url) })))).filter((f) => f.img);

  const lienzo = document.createElement("canvas");
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext("2d");
  fondoFiesta(ctx, W, H);
  if (imagenes.length === 1) dibujarCubriendo(ctx, imagenes[0].img, 0, 0, W, H);
  else if (imagenes.length > 1) grillaFotos(ctx, imagenes, sobran, formato, { x: 0, y: 0, w: W, h: H }, { hueco: 8, radio: 0, etiquetas: false });

  // Sombras para que se lea arriba y abajo.
  const desde = H * (historia ? 0.5 : 0.4);
  const sombra = ctx.createLinearGradient(0, desde, 0, H);
  sombra.addColorStop(0, "rgba(13,6,24,0)");
  sombra.addColorStop(0.45, "rgba(13,6,24,0.55)");
  sombra.addColorStop(1, "rgba(13,6,24,0.92)");
  ctx.fillStyle = sombra;
  ctx.fillRect(0, desde, W, H - desde);
  const arribaAlto = historia ? 380 : 220;
  const sombraArriba = ctx.createLinearGradient(0, 0, 0, arribaAlto);
  sombraArriba.addColorStop(0, "rgba(0,0,0,0.45)");
  sombraArriba.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sombraArriba;
  ctx.fillRect(0, 0, W, arribaAlto);

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  marca(ctx, margen, historia ? 160 : 56);

  // De abajo hacia arriba: pie, los tragos, los vasos grandes y la etiqueta.
  ctx.textBaseline = "alphabetic";
  let y = H - (historia ? 230 : 60);
  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("Registrado en la app Lomada Fuel", margen, y);

  if (conVasos && vasos.length) {
    const lista = tragosAgrupados(vasos);
    const mostrar = lista.slice(0, 3);
    const resto = lista.length - mostrar.length;
    ctx.font = "700 34px Poppins, sans-serif";
    ctx.fillStyle = "#fff";
    y -= 30;
    const lineas = [...mostrar.map((t) => `${t.n} × ${t.nombre}`), ...(resto > 0 ? [`y ${resto} ${resto === 1 ? "trago más" : "tragos más"}`] : [])];
    lineas.reverse().forEach((l) => {
      y -= 50;
      let texto = l;
      while (texto.length > 4 && ctx.measureText(texto).width > W - margen * 2) texto = `${texto.slice(0, -2).trimEnd()}…`;
      ctx.fillText(texto, margen, y + 36);
    });
    y -= 34;
    ctx.font = "800 112px Poppins, sans-serif";
    ctx.fillStyle = "#fff";
    const numero = String(vasos.length);
    ctx.fillText(numero, margen - 3, y);
    const anchoNumero = ctx.measureText(numero).width;
    ctx.font = "700 40px Poppins, sans-serif";
    ctx.fillStyle = "#ff8ad8";
    ctx.fillText(`${vasos.length === 1 ? "vaso" : "vasos"}${kcal > 0 ? ` · ${numeroAr(kcal)} kcal` : ""}`, margen + anchoNumero + 16, y);
    y -= 112 * 0.74 + 40;
  } else {
    y -= 40;
    ctx.font = "800 84px Poppins, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("Noche de fiesta", margen - 3, y);
    y -= 84 * 0.74 + 40;
  }
  ctx.shadowBlur = 0;
  pastilla(ctx, `MODO FIESTA · ${fechaLinda(fecha).toUpperCase()}`, margen, y - 44, false, FIESTA);

  const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) throw new Error("No se pudo armar la imagen");
  return new File([blob], `lomada-fuel-${fecha || "noche"}-fiesta-${modo}-${formato}.jpg`, { type: "image/jpeg" });
}
