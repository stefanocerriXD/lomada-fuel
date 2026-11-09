// Gasto y objetivo calórico estimados. Son una guía: el metabolismo real varía de persona a persona.
import { aFecha, haceDias } from "./fechas.js";
import { sumarComidas } from "./macros.js";

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

export const OBJETIVOS = [
  { id: "definir", texto: "Definir", detalle: "Bajar grasa cuidando el músculo" },
  { id: "mantener", texto: "Mantener", detalle: "Sostener tu peso" },
  { id: "bulk", texto: "Bulkear", detalle: "Ganar masa muscular" },
];

export const PRIORIDADES = [
  { id: "equilibrado", texto: "Equilibrado" },
  { id: "proteina", texto: "Más proteína" },
  { id: "carbos", texto: "Más carbos" },
];

// Gramos por kilo de peso según el objetivo: al definir y al bulkear sube la proteína.
const GRAMOS_POR_KILO = { definir: { p: 2.2, g: 0.8 }, mantener: { p: 1.8, g: 0.9 }, bulk: { p: 2.2, g: 1 } };
// Priorizar mueve calorías entre proteína y carbos; las grasas casi no cambian.
const AJUSTE_PRIORIDAD = { equilibrado: { p: 0, g: 0 }, proteina: { p: 0.4, g: 0 }, carbos: { p: -0.4, g: -0.1 } };
const MINIMOS_POR_KILO = { p: 1.6, g: 0.6 };
export const CAMPOS_A_MEDIDA = [
  { campo: "proteinas_propias", texto: "Proteínas", kcal: 4, min: 20, max: 500 },
  { campo: "carbos_propios", texto: "Carbos", kcal: 4, min: 0, max: 1000 },
  { campo: "grasas_propias", texto: "Grasas", kcal: 9, min: 10, max: 400 },
];

const definido = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
export const tieneMacrosAMedida = (d) => CAMPOS_A_MEDIDA.every(({ campo }) => definido(d[campo]));
export const macrosAMedidaValidos = (d) => CAMPOS_A_MEDIDA.every(({ campo, min, max }) => definido(d[campo]) && Number(d[campo]) >= min && Number(d[campo]) <= max);

// El objetivo elegido; los planes viejos lo deducen del peso objetivo.
export function objetivoDe(datos) {
  if (OBJETIVOS.some((o) => o.id === datos.objetivo)) return datos.objetivo;
  const diferencia = Number(datos.peso_objetivo) - Number(datos.peso_kg);
  if (diferencia <= -MARGEN_OBJETIVO_KG) return "definir";
  if (diferencia >= MARGEN_OBJETIVO_KG) return "bulk";
  return "mantener";
}

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

  const objetivo = objetivoDe(datos);
  const prioridad = AJUSTE_PRIORIDAD[datos.prioridad] ? datos.prioridad : "equilibrado";
  const redondear = (n) => Math.round(n / 10) * 10;

  let calorias = gasto;
  if (objetivo === "definir") {
    const recorte = Math.min((ritmo * KCAL_POR_KILO) / 7, gasto * RECORTE_MAXIMO);
    calorias = Math.max(gasto - recorte, basal, MINIMO_KCAL);
  } else if (objetivo === "bulk") {
    calorias = gasto + (Math.min(ritmo, 0.5) * KCAL_POR_KILO) / 7;
  }
  calorias = redondear(calorias);

  const peso = Number(datos.peso_kg);
  const base = GRAMOS_POR_KILO[objetivo];
  const extra = AJUSTE_PRIORIDAD[prioridad];
  let proteinas = Math.round(Math.max(MINIMOS_POR_KILO.p, base.p + extra.p) * peso);
  let grasas = Math.round(Math.max(MINIMOS_POR_KILO.g, base.g + extra.g) * peso);
  let carbohidratos = Math.max(0, Math.round((calorias - proteinas * 4 - grasas * 9) / 4));

  // A medida: los gramos que puso cada uno mandan y la meta sale de ellos.
  const aMedida = tieneMacrosAMedida(datos);
  if (aMedida) {
    proteinas = Math.round(Number(datos.proteinas_propias));
    carbohidratos = Math.round(Number(datos.carbos_propios));
    grasas = Math.round(Number(datos.grasas_propias));
    calorias = proteinas * 4 + carbohidratos * 4 + grasas * 9;
  }

  const ritmoReal = (Math.abs(gasto - calorias) * 7) / KCAL_POR_KILO;
  const vaHaciaElPeso = (diferencia < 0 && calorias < gasto) || (diferencia > 0 && calorias > gasto);
  const semanas = objetivo !== "mantener" && vaHaciaElPeso && Math.abs(diferencia) >= MARGEN_OBJETIVO_KG && ritmoReal > 0 ? Math.ceil(Math.abs(diferencia) / ritmoReal) : 0;
  const llegada = new Date();
  llegada.setDate(llegada.getDate() + semanas * 7);

  return {
    objetivo,
    prioridad,
    aMedida,
    basal: redondear(basal),
    gasto: redondear(gasto),
    calorias,
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
    const dia = (porDia[c.fecha] ??= { lista: [], comidas: 0 });
    dia.lista.push(c);
    // Un resumen trae el día entero, aunque sea un solo registro.
    dia.comidas += c.tipo === "resumen" ? 2 : 1;
  }
  for (const dia of Object.values(porDia)) dia.kcal = sumarComidas(dia.lista).kcal;
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
