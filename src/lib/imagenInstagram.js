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
function logoApp(ctx, x, y, tam) {
  const lado = Math.ceil(tam);
  const lienzo = document.createElement("canvas");
  lienzo.width = lado;
  lienzo.height = lado;
  const c = lienzo.getContext("2d");
  const [cajaX, cajaY, cajaLado] = LOGO.caja.split(" ").map(Number);
  c.scale(lado / cajaLado, lado / cajaLado);
  c.translate(-cajaX, -cajaY);
  c.fillStyle = "#fff";
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

// ---------- El día entero: todas las fotos en grilla, con el total y los macros. ----------

// Cuántas fotos van por fila según cuántas hay (en la historia hay más alto para apilar).
const FILAS = {
  historia: { 1: [1], 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [2, 2, 2], 7: [2, 2, 3], 8: [2, 3, 3], 9: [3, 3, 3] },
  publicacion: { 1: [1], 2: [2], 3: [1, 2], 4: [2, 2], 5: [2, 3], 6: [3, 3] },
};
const ORDEN_DIA = ["desayuno", "almuerzo", "merienda", "cena", "colacion", "fiesta", "resumen"];
const numeroAr = (n) => new Intl.NumberFormat("es-AR").format(Math.round(n));

function chipsMacros(ctx, total, x, y) {
  const alto = 56;
  ctx.font = "700 26px Poppins, sans-serif";
  MACROS.forEach(([campo, letra, , color]) => {
    const texto = `${letra} ${Math.round(Number(total[campo]) || 0)} g`;
    const ancho = ctx.measureText(texto).width + 72;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
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

// Una foto de la grilla, con la comida y sus kcal abajo.
function mosaico(ctx, img, x, y, w, h, etiqueta, extra) {
  ctx.save();
  redondeado(ctx, x, y, w, h, 26);
  ctx.clip();
  dibujarCubriendo(ctx, img, x, y, w, h);
  const alto = Math.min(150, h * 0.5);
  const sombra = ctx.createLinearGradient(0, y + h - alto, 0, y + h);
  sombra.addColorStop(0, "rgba(12,8,5,0)");
  sombra.addColorStop(1, "rgba(12,8,5,0.78)");
  ctx.fillStyle = sombra;
  ctx.fillRect(x, y + h - alto, w, alto);
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

// Sin fotos: la lista de comidas del día en renglones.
function listaComidas(ctx, comidas, x, y, w, maxY) {
  ctx.textBaseline = "alphabetic";
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
    const anchoKcal = ctx.measureText(kcal).width;
    ctx.fillText(kcal, x + w - anchoKcal, y + 44);
    ctx.font = "600 30px Poppins, sans-serif";
    const [linea] = renglones(ctx, (c.descripcion || tipoInfo(c.tipo).texto).trim(), w, 1);
    ctx.fillText(linea, x, y + 86);
    y += 112;
  }
}

// comidas: las del día de la persona (sin el resumen de Apple Salud); total: sumarComidas de todo el día.
export async function armarImagenDia({ comidas, fotos, fecha, total, meta, formato = "historia" }) {
  const { ancho: W, alto: H } = FORMATOS[formato];
  const historia = formato === "historia";
  const margen = 64;
  await Promise.all(["600", "700", "800"].map((p) => document.fonts?.load?.(`${p} 40px Poppins`)).filter(Boolean)).catch(() => {});

  const ordenadas = [...comidas].sort((a, b) => ORDEN_DIA.indexOf(a.tipo) - ORDEN_DIA.indexOf(b.tipo) || String(a.creado_en || "").localeCompare(String(b.creado_en || "")));
  // Cada foto con su comida (las fotos extra de una comida también entran).
  const conFoto = ordenadas.flatMap((c) => [c.foto_path, ...(c.fotos_extra || [])].filter((r) => r && fotos[r]).map((r, n) => ({ comida: c, url: fotos[r], primera: n === 0 })));
  const maximo = historia ? 9 : 6;
  const elegidas = conFoto.slice(0, maximo);
  const sobran = conFoto.length - elegidas.length;
  const imagenes = (await Promise.all(elegidas.map(async (f) => ({ ...f, img: await cargarFoto(f.url) })))).filter((f) => f.img);

  const lienzo = document.createElement("canvas");
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext("2d");
  const fondo = ctx.createRadialGradient(W * 0.85, 0, 40, W * 0.6, H * 0.2, H * 0.9);
  fondo.addColorStop(0, "#6e2810");
  fondo.addColorStop(0.45, "#2a140a");
  fondo.addColorStop(1, FONDO);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);

  // Arriba: logo, nombre de la app y la fecha.
  const arriba = historia ? 160 : 56;
  const tamLogo = 72;
  logoApp(ctx, margen, arriba, tamLogo);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.font = "800 34px Poppins, sans-serif";
  ctx.fillText("LOMADA FUEL", margen + tamLogo + 18, arriba + tamLogo / 2 + 2);
  const etiqueta = `MI DÍA · ${fechaLinda(fecha).toUpperCase()}`;
  ctx.font = "700 22px Poppins, sans-serif";
  const anchoEtiqueta = ctx.measureText(etiqueta).width + 40;
  const altoEtiqueta = 44;
  const yEtiqueta = historia ? arriba + tamLogo + 40 : arriba + (tamLogo - altoEtiqueta) / 2;
  const xEtiqueta = historia ? margen : W - margen - anchoEtiqueta;
  ctx.fillStyle = ACENTO;
  redondeado(ctx, xEtiqueta, yEtiqueta, anchoEtiqueta, altoEtiqueta, altoEtiqueta / 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(etiqueta, xEtiqueta + 20, yEtiqueta + altoEtiqueta / 2 + 1);

  // El total del día y los macros.
  ctx.textBaseline = "alphabetic";
  let y = (historia ? yEtiqueta + altoEtiqueta : arriba + tamLogo) + (historia ? 130 : 110);
  ctx.font = `800 ${historia ? 112 : 92}px Poppins, sans-serif`;
  const numero = numeroAr(total.kcal || 0);
  ctx.fillText(numero, margen - 3, y);
  const anchoNumero = ctx.measureText(numero).width;
  ctx.font = "700 38px Poppins, sans-serif";
  ctx.fillStyle = "#ff8a5c";
  const unidad = meta ? `/ ${numeroAr(meta)} kcal` : "kcal";
  ctx.fillText(unidad, margen + anchoNumero + 16, y);
  y += 34;
  y += chipsMacros(ctx, { proteinas: total.p, carbohidratos: total.c, grasas: total.g }, margen, y);

  // La grilla de fotos.
  const pie = historia ? 230 : 60;
  const zona = { x: margen, y: y + (historia ? 44 : 32), w: W - margen * 2 };
  zona.h = H - pie - 70 - zona.y;
  if (imagenes.length) {
    const filas = FILAS[formato][imagenes.length];
    const hueco = 12;
    const altoFila = (zona.h - hueco * (filas.length - 1)) / filas.length;
    let i = 0;
    filas.forEach((enFila, f) => {
      const anchoFoto = (zona.w - hueco * (enFila - 1)) / enFila;
      for (let k = 0; k < enFila; k++, i++) {
        const foto = imagenes[i];
        const c = foto.comida;
        const kcal = Math.round(Number(c.calorias) || 0);
        const texto = foto.primera ? [tipoInfo(c.tipo).texto, kcal > 0 && `${numeroAr(kcal)} kcal`].filter(Boolean).join(" · ") : "";
        const ultima = i === imagenes.length - 1 && sobran > 0 ? sobran : 0;
        mosaico(ctx, foto.img, zona.x + k * (anchoFoto + hueco), zona.y + f * (altoFila + hueco), anchoFoto, altoFila, texto, ultima);
      }
    });
  } else {
    listaComidas(ctx, ordenadas, zona.x, zona.y, zona.w, zona.y + zona.h);
  }

  ctx.font = "600 24px Poppins, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  const cantidad = ordenadas.length;
  ctx.fillText(`${cantidad} ${cantidad === 1 ? "comida" : "comidas"} · Registrado en la app Lomada Fuel`, margen, H - pie);

  const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) throw new Error("No se pudo armar la imagen");
  return new File([blob], `lomada-fuel-${fecha}-dia-${formato}.jpg`, { type: "image/jpeg" });
}
