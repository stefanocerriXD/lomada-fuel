import { calcularPlan } from "./cuerpo.js";
import { desafioTerminado, puntajes } from "./desafios.js";
import { calcularRacha } from "./macros.js";

export const MEDALLAS = [
  { codigo: "primera_comida", emoji: "🍽️", nombre: "Primer plato", detalle: "Subiste tu primera comida" },
  { codigo: "racha_7", emoji: "🔥", nombre: "Semana completa", detalle: "7 días seguidos cargando" },
  { codigo: "racha_30", emoji: "🌋", nombre: "Mes imparable", detalle: "30 días seguidos cargando" },
  { codigo: "comidas_30", emoji: "📚", nombre: "Bien documentado", detalle: "30 comidas en un mes" },
  { codigo: "proteina_7", emoji: "💪", nombre: "Modo proteína", detalle: "7 días llegando a tu proteína" },
  { codigo: "agua_7", emoji: "💧", nombre: "Bien hidratado", detalle: "7 días con 2 litros de agua" },
  { codigo: "gano_desafio", emoji: "🏆", nombre: "Campeón", detalle: "Ganaste un desafío" },
  { codigo: "objetivo", emoji: "🎯", nombre: "Objetivo cumplido", detalle: "Llegaste a tu peso objetivo" },
  { codigo: "fotogenico", emoji: "🤩", nombre: "Fotogénico", detalle: "Una comida con 5 reacciones" },
];

export const medalla = (codigo) => MEDALLAS.find((m) => m.codigo === codigo);

// Devuelve los códigos que la persona acaba de ganar.
export function medallasGanadas({ usuarioId, comidas, agua, reacciones, desafios, perfiles, salud, pesos, yaGanadas }) {
  const propias = comidas.filter((c) => c.usuario_id === usuarioId);
  const racha = calcularRacha(propias.map((c) => c.fecha));
  const ganadas = [];
  const sumar = (codigo, condicion) => condicion && ganadas.push(codigo);

  sumar("primera_comida", propias.length >= 1);
  sumar("racha_7", racha >= 7);
  sumar("racha_30", racha >= 30);
  sumar("comidas_30", propias.length >= 30);
  sumar("agua_7", agua.filter((a) => a.usuario_id === usuarioId && a.ml >= 2000).length >= 7);

  if (salud) {
    const plan = calcularPlan(salud);
    const porDia = {};
    propias.forEach((c) => (porDia[c.fecha] = (porDia[c.fecha] || 0) + Number(c.proteinas || 0)));
    sumar("proteina_7", Object.values(porDia).filter((g) => g >= plan.proteinas).length >= 7);
    const inicial = Number(pesos[0]?.peso_kg ?? salud.peso_kg);
    const objetivo = Number(salud.peso_objetivo);
    const actual = Number(salud.peso_kg);
    sumar("objetivo", pesos.length >= 2 && Math.abs(inicial - objetivo) >= 0.5 && (inicial > objetivo ? actual <= objetivo : actual >= objetivo));
  }

  const conteo = {};
  reacciones.forEach((r) => (conteo[r.comida_id] = (conteo[r.comida_id] || 0) + 1));
  sumar("fotogenico", propias.some((c) => (conteo[c.id] || 0) >= 5));

  sumar("gano_desafio", desafios.some((d) => {
    if (!desafioTerminado(d)) return false;
    const [primero] = puntajes(d, perfiles, comidas, agua);
    return primero?.perfil.id === usuarioId && primero.puntos > 0;
  }));

  return ganadas.filter((c) => !yaGanadas.includes(c));
}
