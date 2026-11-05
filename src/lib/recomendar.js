import { INGREDIENTES, RECETAS } from "../data/recetas.js";
import { calcularPlan } from "./cuerpo.js";
import { tipoSegunHora } from "./fechas.js";
import { TIPOS } from "./macros.js";

const PESO_COMIDA = { desayuno: 0.25, almuerzo: 0.35, merienda: 0.15, cena: 0.25 };
const CALORIAS_MINIMAS = 150;
const REPETICIONES_AJUSTE = 3;

export function metasDelDia(yo, salud) {
  const kcal = yo.meta_calorias;
  if (!salud) return { kcal, p: (kcal * 0.25) / 4, c: (kcal * 0.45) / 4, g: (kcal * 0.3) / 9 };
  const plan = calcularPlan(salud);
  return { kcal, p: plan.proteinas, g: plan.grasas, c: Math.max(0, (kcal - plan.proteinas * 4 - plan.grasas * 9) / 4) };
}

export function macrosFaltantes(metas, total) {
  const resta = (k) => Math.max(0, metas[k] - total[k]);
  return { kcal: resta("kcal"), p: resta("p"), c: resta("c"), g: resta("g") };
}

// La próxima comida sin cargar, empezando por la que corresponde a esta hora.
export function comidaSugerida(cargadas) {
  const orden = TIPOS.map((t) => t.id);
  const desde = orden.indexOf(tipoSegunHora());
  return orden.slice(desde).find((t) => !cargadas.includes(t)) || orden[desde];
}

// Si todavía quedan comidas por delante, esta se lleva solo su parte de lo que falta.
export function parteDeLaComida(tipo, cargadas) {
  const orden = TIPOS.map((t) => t.id);
  const pendientes = orden.slice(orden.indexOf(tipo)).filter((t) => t === tipo || !cargadas.includes(t));
  return PESO_COMIDA[tipo] / pendientes.reduce((t, x) => t + PESO_COMIDA[x], 0);
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
function puntuar(m, o) {
  const relativo = (a, b, piso) => Math.abs(a - b) / Math.max(b, piso);
  const exceso = Math.max(0, m.kcal - o.kcal) / Math.max(o.kcal, 200);
  return (
    relativo(m.kcal, o.kcal, 200) * 2 +
    exceso * 2 +
    relativo(m.p, o.p, 15) * 1.5 +
    relativo(m.c, o.c, 20) +
    (Math.max(0, m.g - o.g) / Math.max(o.g, 8)) * 1.2 +
    (Math.max(0, o.g - m.g) / Math.max(o.g, 8)) * 0.3
  );
}

export function recomendar({ tipo, faltan, cargadas }) {
  const cerrado = faltan.kcal < CALORIAS_MINIMAS;
  const parte = cerrado ? 1 : parteDeLaComida(tipo, cargadas);
  const objetivo = cerrado
    ? { kcal: CALORIAS_MINIMAS, p: 15, c: 10, g: 3 }
    : { kcal: faltan.kcal * parte, p: faltan.p * parte, c: faltan.c * parte, g: faltan.g * parte };

  const opciones = RECETAS.filter((r) => r.tipos.includes(tipo) && (!cerrado || r.liviana))
    .map((receta) => {
      const ajustada = ajustarReceta(receta, objetivo);
      return { receta, ...ajustada, puntaje: puntuar(ajustada.macros, objetivo) };
    })
    .sort((a, b) => a.puntaje - b.puntaje);

  // Primero una opción por cada ingrediente principal, para que no sean tres versiones de lo mismo.
  // La variedad no justifica mostrar algo que no cubre lo que falta.
  const coherente = (o) => o.macros.p >= objetivo.p * 0.6 && o.macros.kcal <= objetivo.kcal * 1.35;
  const vistas = new Set();
  const variadas = opciones.filter((o) => coherente(o) && !vistas.has(o.receta.base) && vistas.add(o.receta.base));
  const resto = opciones.filter((o) => !variadas.includes(o));

  return { cerrado, parte, objetivo, opciones: [...variadas, ...resto] };
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
