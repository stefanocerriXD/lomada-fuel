import { INGREDIENTES, RECETAS } from "../data/recetas.js";
import { calcularPlan, objetivoDe } from "./cuerpo.js";
import { tipoSegunHora } from "./fechas.js";
import { TIPOS_PRINCIPALES as TIPOS } from "./macros.js";

const PESO_COMIDA = { desayuno: 0.25, almuerzo: 0.35, merienda: 0.15, cena: 0.25 };
const PESO_COLACION = 0.12;
// Después de cenar (o muy tarde) no se sugiere otra cena: va una colación, como mucho esto.
const TECHO_NOCHE = 750;
const TECHO_COLACION_DIA = 350;
const CALORIAS_MINIMAS = 150;
const REPETICIONES_AJUSTE = 3;

export function metasDelDia(yo, salud) {
  const kcal = yo.meta_calorias;
  if (!salud) return { kcal, p: (kcal * 0.25) / 4, c: (kcal * 0.45) / 4, g: (kcal * 0.3) / 9 };
  const plan = calcularPlan(salud);
  return { kcal, p: plan.proteinas, g: plan.grasas, c: Math.max(0, (kcal - plan.proteinas * 4 - plan.grasas * 9) / 4) };
}

// definir, mantener o bulk. Sin plan cargado, mantener.
export function objetivoDePersona(salud) {
  return salud ? objetivoDe(salud) : "mantener";
}

export const TEXTO_OBJETIVO = {
  definir: "Estás definiendo: primero platos con mucho volumen y pocas calorías, que llenan.",
  bulk: "Estás en bulk: primero comidas ricas y con calorías, fáciles de comer en cantidad.",
  mantener: "",
};

// Calorías por gramo del plato: menos de 1,1 es mucho volumen; más de 1,8, denso en calorías.
export const densidadDe = (opcion) => opcion.macros.kcal / Math.max(1, opcion.partes.reduce((t, p) => t + p.gramos, 0));

export function macrosFaltantes(metas, total) {
  const resta = (k) => Math.max(0, metas[k] - total[k]);
  return { kcal: resta("kcal"), p: resta("p"), c: resta("c"), g: resta("g") };
}

const horaDe = (ahora) => ahora.getHours() + ahora.getMinutes() / 60;

// Las comidas principales que todavía tienen sentido a esta hora y no se cargaron.
function porDelante(cargadas, ahora) {
  const h = horaDe(ahora);
  if (h >= 23 || h < 5) return [];
  const orden = TIPOS.map((t) => t.id);
  return orden.slice(orden.indexOf(tipoSegunHora(ahora))).filter((t) => !cargadas.includes(t));
}

// La próxima comida sin cargar según la hora. Si ya cenaste o es muy tarde, una colación.
export function comidaSugerida(cargadas, ahora = new Date()) {
  return porDelante(cargadas, ahora)[0] || "colacion";
}

// Si todavía quedan comidas por delante, esta se lleva solo su parte de lo que falta.
export function parteDeLaComida(tipo, cargadas, ahora = new Date()) {
  const pendientes = porDelante(cargadas, ahora).filter((t) => t !== tipo);
  const peso = tipo === "colacion" ? PESO_COLACION : PESO_COMIDA[tipo];
  return peso / (peso + pendientes.reduce((t, x) => t + PESO_COMIDA[x], 0));
}

// En palabras, por qué se sugiere esto ahora.
export function contextoHora(tipo, cargadas, ahora = new Date()) {
  if (tipo !== "colacion") return null;
  const hora = ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!porDelante(cargadas, ahora).length) {
    return cargadas.includes("cena") ? `Son las ${hora} y ya cenaste: van colaciones, nada de otra cena.` : `Son las ${hora}: van cosas para picar, nada pesado.`;
  }
  return "Una colación para llegar a la próxima comida.";
}

// ---- Preferencias escritas: "algo dulce", "sin huevo", "rápido", "con atún", "vegetariano" ----
const normal = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const raiz = (w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w);
const VACIAS = new Set(
  "algo quiero quisiera tengo ganas de del un una unos unas que sea para y o comer comida la el las los con mucho muy me mi hoy tipo onda rico rica cosa porfa a al en por mas menos poco poca tiempo ahora noche tarde".split(" "),
);
const CLAVES = /^(dulce|dulces|salado|salada|rapido|rapida|facil|liviano|liviana|ligero|ligera|light|proteico|proteica|proteina|prote|vegetariano|vegetariana|veggie|vegano|vegana|sin|no|ni|nada|cocinar|toque)$/;
const CARNES = ["pollo", "carne", "cerdo", "bife", "hamburguesa", "milanesa", "jamon", "atun", "merluza", "salmon", "pescado"];

export function leerPreferencia(texto) {
  const t = normal(texto).replace(/[^a-zñ\s]/g, " ");
  const p = { dulce: null, rapido: false, liviano: false, proteico: false, vegetariano: false, sin: [], con: [], vacia: !t.trim() };
  if (p.vacia) return p;
  if (/\bdulce/.test(t)) p.dulce = true;
  if (/\bsalad/.test(t)) p.dulce = false;
  if (/rapid|facil|sin cocinar|al toque/.test(t)) p.rapido = true;
  if (/livian|liger|light/.test(t)) p.liviano = true;
  if (/proteic|proteina|\bprote\b/.test(t)) p.proteico = true;
  if (/vegetarian|veggie|vegan/.test(t)) p.vegetariano = true;
  const palabras = t.split(/\s+/).filter(Boolean);
  palabras.forEach((w, i) => {
    const previa = palabras[i - 1];
    if (CLAVES.test(w) || VACIAS.has(w) || w.length < 3) return;
    if (["sin", "no", "ni"].includes(previa) || (previa === "de" && palabras[i - 2] === "nada")) p.sin.push(raiz(w));
    else p.con.push(raiz(w));
  });
  return p;
}

const textoDe = (r) => normal([r.nombre, r.base, ...r.partes.map((x) => INGREDIENTES[x.ing].nombre)].join(" "));
const tiene = (r, w) => textoDe(r).includes(w);

function segunPreferencia(opciones, pref) {
  if (pref.vacia) return { opciones, nota: "" };
  let lista = opciones.filter(({ receta: r }) =>
    !pref.sin.some((w) => tiene(r, w)) &&
    !(pref.vegetariano && CARNES.some((w) => tiene(r, w))) &&
    (pref.dulce === null || Boolean(r.dulce) === pref.dulce) &&
    (!pref.rapido || r.minutos <= 10));
  const notas = [];
  if (pref.con.length) {
    const buscadas = pref.con.filter((w) => opciones.some((o) => tiene(o.receta, w)));
    pref.con.filter((w) => !buscadas.includes(w)).forEach((w) => notas.push(`No tenemos recetas con "${w}" para esta comida.`));
    if (buscadas.length) {
      const con = lista.filter((o) => buscadas.some((w) => tiene(o.receta, w)));
      lista = [...con, ...lista.filter((o) => !con.includes(o))];
    }
  }
  if (pref.proteico) lista = [...lista].sort((a, b) => a.puntaje - a.macros.p / 40 - (b.puntaje - b.macros.p / 40));
  if (!lista.length) return { opciones, nota: "Con esa preferencia no encontramos opciones para esta comida: van las de siempre." };
  return { opciones: lista, nota: notas.join(" ") };
}

const pasoDe = (parte, ing) => parte.paso || ing.unidad?.[1] || 10;

function aportes(ing, gramos) {
  const f = gramos / 100;
  return { kcal: ing.kcal * f, p: ing.p * f, c: ing.c * f, g: ing.g * f };
}

function sumar(lista) {
  return lista.reduce((t, a) => ({ kcal: t.kcal + a.kcal, p: t.p + a.p, c: t.c + a.c, g: t.g + a.g }), { kcal: 0, p: 0, c: 0, g: 0 });
}

const CLAVE_ROL = { proteina: "p", carbo: "c", grasa: "g" };

// Ajusta los gramos de cada parte a lo que falta, respetando porciones razonables.
export function ajustarReceta(receta, objetivo) {
  const partes = receta.partes.map((p) => ({ ...p, ingrediente: INGREDIENTES[p.ing], gramos: p.g ?? p.min }));

  for (let vuelta = 0; vuelta < REPETICIONES_AJUSTE; vuelta += 1) {
    for (const parte of partes.filter((p) => p.rol)) {
      const clave = CLAVE_ROL[parte.rol];
      const resto = sumar(partes.filter((p) => p !== parte).map((p) => aportes(p.ingrediente, p.gramos)));
      const densidad = parte.ingrediente[clave] / 100;
      const ideal = densidad > 0 ? (objetivo[clave] - resto[clave]) / densidad : parte.min;
      parte.gramos = Math.min(Math.max(ideal, parte.min), parte.max);
    }
  }

  const redondeadas = partes.map((p) => {
    const paso = pasoDe(p, p.ingrediente);
    return { ...p, gramos: Math.min(Math.max(Math.round(p.gramos / paso) * paso, p.min ?? p.g), p.max ?? p.g) };
  });
  return { partes: redondeadas, macros: sumar(redondeadas.map((p) => aportes(p.ingrediente, p.gramos))) };
}

// Pasarse de calorías o grasas pesa más que quedarse apenas corto.
// Definiendo, pasarse pesa todavía más; en bulk, lo que pesa es quedarse corto.
function puntuar(m, o, meta = "mantener") {
  const relativo = (a, b, piso) => Math.abs(a - b) / Math.max(b, piso);
  const exceso = Math.max(0, m.kcal - o.kcal) / Math.max(o.kcal, 200);
  const falta = Math.max(0, o.kcal - m.kcal) / Math.max(o.kcal, 200);
  const pesoExceso = { definir: 3, bulk: 0.6, mantener: 2 }[meta];
  return (
    relativo(m.kcal, o.kcal, 200) * 2 +
    exceso * pesoExceso +
    (meta === "bulk" ? falta * 1.5 : 0) +
    relativo(m.p, o.p, 15) * 1.5 +
    relativo(m.c, o.c, 20) +
    (Math.max(0, m.g - o.g) / Math.max(o.g, 8)) * 1.2 +
    (Math.max(0, o.g - m.g) / Math.max(o.g, 8)) * 0.3
  );
}

export function recomendar({ tipo, faltan, cargadas, ahora = new Date(), preferencia = "", meta = "mantener" }) {
  const pref = typeof preferencia === "string" ? leerPreferencia(preferencia) : preferencia;
  const cerrado = faltan.kcal < CALORIAS_MINIMAS;
  const parte = cerrado ? 1 : parteDeLaComida(tipo, cargadas, ahora);
  let objetivo = cerrado
    ? { kcal: CALORIAS_MINIMAS, p: 15, c: 10, g: 3 }
    : { kcal: faltan.kcal * parte, p: faltan.p * parte, c: faltan.c * parte, g: faltan.g * parte };
  // Una colación nunca es una cena: si falta mucho, se achica todo en la misma proporción.
  const techo = tipo === "colacion" ? (porDelante(cargadas, ahora).length ? TECHO_COLACION_DIA : TECHO_NOCHE) : Infinity;
  const factor = Math.min(1, techo / Math.max(objetivo.kcal, 1), pref.liviano ? 0.75 : 1);
  if (!cerrado && factor < 1) objetivo = { kcal: objetivo.kcal * factor, p: objetivo.p * factor, c: objetivo.c * factor, g: objetivo.g * factor };

  const opciones = RECETAS.filter((r) => r.tipos.includes(tipo) && (!cerrado || r.liviana))
    .map((receta) => {
      const ajustada = ajustarReceta(receta, objetivo);
      const densidad = densidadDe(ajustada);
      // Definiendo suben los platos que llenan con pocas calorías; en bulk, los densos y ricos.
      const porObjetivo = meta === "definir" ? Math.max(0, densidad - 1.1) * 1.5 : meta === "bulk" ? Math.max(0, 1.7 - densidad) * 1.2 : 0;
      return { receta, ...ajustada, densidad, puntaje: puntuar(ajustada.macros, objetivo, meta) + porObjetivo };
    })
    .sort((a, b) => a.puntaje - b.puntaje);

  // Primero una opción por cada ingrediente principal, para que no sean tres versiones de lo mismo.
  // La variedad no justifica mostrar algo que no cubre lo que falta.
  const coherente = (o) => o.macros.p >= objetivo.p * 0.6 && o.macros.kcal <= objetivo.kcal * 1.35;
  const vistas = new Set();
  const variadas = opciones.filter((o) => coherente(o) && !vistas.has(o.receta.base) && vistas.add(o.receta.base));
  const resto = opciones.filter((o) => !variadas.includes(o));

  const elegidas = segunPreferencia([...variadas, ...resto], pref);
  return { cerrado, parte, objetivo, opciones: elegidas.opciones, nota: elegidas.nota };
}

export function comoItems(opcion) {
  return opcion.partes.map((p) => ({
    nombre: p.ingrediente.nombre,
    marca: "",
    fuente: "receta",
    gramos: p.gramos,
    por100: { kcal: p.ingrediente.kcal, p: p.ingrediente.p, c: p.ingrediente.c, g: p.ingrediente.g },
  }));
}

export function textoCantidad(parte) {
  const unidad = parte.ingrediente.unidad;
  if (!unidad) return `${parte.gramos} g`;
  const cantidad = Math.round(parte.gramos / unidad[1]);
  return `${cantidad} ${unidad[0]}${cantidad === 1 ? "" : "s"}`;
}

// Explica en palabras qué prioriza la recomendación.
export function queFalta(faltan, metas) {
  const nombres = [["p", "proteína"], ["c", "carbos"], ["g", "grasas"]];
  const importantes = nombres
    .filter(([k]) => metas[k] > 0 && faltan[k] / metas[k] >= 0.2)
    .sort((a, b) => faltan[b[0]] / metas[b[0]] - faltan[a[0]] / metas[a[0]])
    .slice(0, 2)
    .map(([, n]) => n);
  return importantes.join(" y ");
}
