// Multas: menos de 2 fotos de comidas en el día suma una multa. Un comodín por semana (de lunes a domingo).
import { aFecha, fechaLocal, haceDias } from "./fechas.js";

export const FOTOS_POR_DIA = 2;

// El lunes de la semana de esa fecha.
export function inicioSemana(fecha = fechaLocal()) {
  const d = aFecha(fecha);
  const desdeLunes = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desdeLunes);
  return fechaLocal(d);
}

export const fotosDelDia = (comidas, usuarioId, fecha) =>
  comidas.filter((c) => c.usuario_id === usuarioId && c.fecha === fecha && c.tipo !== "resumen" && c.foto_path).length;

export function multasDeLaSemana(multas, perfiles, fecha = fechaLocal()) {
  const lunes = inicioSemana(fecha);
  return Object.values(perfiles)
    .map((perfil) => ({ perfil, multas: multas.filter((m) => m.usuario_id === perfil.id && m.fecha >= lunes && m.fecha <= fecha).length }))
    .sort((a, b) => b.multas - a.multas || a.perfil.nombre.localeCompare(b.perfil.nombre));
}

// Para qué día se puede usar el comodín ahora: ayer si te multaron, si no hoy si te faltan fotos. Uno por semana.
export function usoDeComodin({ comodines, multas, comidas, usuarioId, hoy = fechaLocal() }) {
  const ayer = haceDias(1, aFecha(hoy));
  const usadoEn = (fecha) => comodines.some((c) => c.usuario_id === usuarioId && inicioSemana(c.fecha) === inicioSemana(fecha));
  if (multas.some((m) => m.usuario_id === usuarioId && m.fecha === ayer) && !usadoEn(ayer)) return { fecha: ayer, texto: "Usar comodín para ayer" };
  if (comodines.some((c) => c.usuario_id === usuarioId && c.fecha === hoy)) return null;
  if (fotosDelDia(comidas, usuarioId, hoy) < FOTOS_POR_DIA && !usadoEn(hoy)) return { fecha: hoy, texto: "Usar comodín hoy" };
  return null;
}
