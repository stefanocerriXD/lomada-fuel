// Gasto y objetivo calórico estimados. Son una guía: el metabolismo real varía de persona a persona.
import { aFecha, haceDias } from "./fechas.js";

const KCAL_POR_KILO = 7700;
const MINIMO_KCAL = 1200;
const RECORTE_MAXIMO = 0.25; // Hasta 25% del gasto diario.
const MARGEN_OBJETIVO_KG = 0.5;

export const NIVELES_ACTIVIDAD = [
  { hasta: 0, factor: 1.2, texto: "Sedentario" },
  { hasta: 2, factor: 1.375, texto: "Actividad liviana" },
  { hasta: 4, factor: 1.55, texto: "Actividad moderada" },
  { hasta: 6, factor: 1.725, texto: "Muy activo" },
  { hasta: 7, factor: 1.9, texto: "Extremadamente activo" },
];

export const RITMOS = [
  { valor: 0.25, texto: "Suave" },
  { valor: 0.5, texto: "Normal" },
  { valor: 0.75, texto: "Rápido" },
];

export const nivelActividad = (dias) => NIVELES_ACTIVIDAD.find((n) => dias <= n.hasta);

// Mifflin-St Jeor
export function metabolismoBasal({ sexo, anio_nacimiento, altura_cm, peso_kg }) {
  const edad = new Date().getFullYear() - Number(anio_nacimiento);
  return 10 * Number(peso_kg) + 6.25 * Number(altura_cm) - 5 * edad + (sexo === "masculino" ? 5 : -161);
}

export function calcularPlan(datos) {
  const basal = metabolismoBasal(datos);
  const gasto = basal * nivelActividad(Number(datos.dias_actividad)).factor;
  const diferencia = Number(datos.peso_objetivo) - Number(datos.peso_kg);
  const ritmo = Number(datos.ritmo);

  let objetivo = "mantener";
  let calorias = gasto;
  if (diferencia <= -MARGEN_OBJETIVO_KG) {
    objetivo = "bajar";
    const recorte = Math.min((ritmo * KCAL_POR_KILO) / 7, gasto * RECORTE_MAXIMO);
    calorias = Math.max(gasto - recorte, basal, MINIMO_KCAL);
  } else if (diferencia >= MARGEN_OBJETIVO_KG) {
    objetivo = "subir";
    calorias = gasto + (Math.min(ritmo, 0.5) * KCAL_POR_KILO) / 7;
  }

  const redondear = (n) => Math.round(n / 10) * 10;
  const proteinas = Math.round(1.8 * Number(datos.peso_kg));
  const grasas = Math.round(0.8 * Number(datos.peso_kg));
  const carbohidratos = Math.max(0, Math.round((calorias - proteinas * 4 - grasas * 9) / 4));
  const ritmoReal = (Math.abs(gasto - calorias) * 7) / KCAL_POR_KILO;
  const semanas = objetivo !== "mantener" && ritmoReal > 0 ? Math.ceil(Math.abs(diferencia) / ritmoReal) : 0;
  const llegada = new Date();
  llegada.setDate(llegada.getDate() + semanas * 7);

  return {
    objetivo,
    basal: redondear(basal),
    gasto: redondear(gasto),
    calorias: redondear(calorias),
    proteinas,
    grasas,
    carbohidratos,
    ritmoReal: Math.round(ritmoReal * 100) / 100,
    semanas,
    llegada: semanas ? llegada.toLocaleDateString("es-AR", { month: "long", year: "numeric" }) : "",
  };
}

const DIAS_ANALIZADOS = 28;
const DIAS_MINIMOS = 14;
const PESAJES_MINIMOS = 4;
const DIAS_CARGADOS_MINIMOS = 10;
const LIMITE_AJUSTE = 0.2; // El gasto observado no se aleja más de 20% de la fórmula.

// Compara lo que comiste con cómo cambió tu peso para estimar tu gasto real.
export function analizarGastoReal(pesos, comidas, plan) {
  const desde = haceDias(DIAS_ANALIZADOS);
  const registros = pesos.filter((p) => p.fecha >= desde);
  const porDia = {};
  for (const c of comidas) {
    if (c.fecha < desde) continue;
    const dia = (porDia[c.fecha] ??= { kcal: 0, comidas: 0 });
    dia.kcal += Number(c.calorias) || 0;
    dia.comidas += 1;
  }
  // Un día con una sola comida cargada casi siempre está incompleto.
  const completos = Object.values(porDia).filter((d) => d.comidas >= 2);

  const dias = (p) => (aFecha(p.fecha) - aFecha(registros[0].fecha)) / 86400000;
  const tramo = registros.length ? dias(registros[registros.length - 1]) : 0;
  const faltan = {
    pesajes: Math.max(0, PESAJES_MINIMOS - registros.length),
    dias: Math.max(0, DIAS_CARGADOS_MINIMOS - completos.length),
    tramo: Math.max(0, DIAS_MINIMOS - tramo),
  };
  if (faltan.pesajes || faltan.dias || faltan.tramo) return { listo: false, faltan };

  // Recta de tendencia: un pesaje aislado no define el cambio de peso.
  const xs = registros.map(dias);
  const ys = registros.map((p) => Number(p.peso_kg));
  const mediaX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const mediaY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const numerador = xs.reduce((t, x, i) => t + (x - mediaX) * (ys[i] - mediaY), 0);
  const denominador = xs.reduce((t, x) => t + (x - mediaX) ** 2, 0);
  const kgPorDia = denominador ? numerador / denominador : 0;

  const consumo = completos.reduce((t, d) => t + d.kcal, 0) / completos.length;
  const observado = consumo - kgPorDia * KCAL_POR_KILO;
  const gasto = Math.min(Math.max(observado, plan.gasto * (1 - LIMITE_AJUSTE)), plan.gasto * (1 + LIMITE_AJUSTE));
  const ajuste = plan.calorias - plan.gasto;
  const redondear = (n) => Math.round(n / 10) * 10;

  return {
    listo: true,
    gasto: redondear(gasto),
    consumo: redondear(consumo),
    kgPorSemana: Math.round(kgPorDia * 7 * 100) / 100,
    calorias: redondear(Math.max(gasto + ajuste, plan.basal, MINIMO_KCAL)),
  };
}
