// La caca: el que no sube ninguna foto de comida en el día amanece con la maldición del Bocha,
// y el que más cacas junta en la semana se come al Bocha Evo toda la semana siguiente.
import { aFecha, fechaLocal, haceDias } from "./fechas.js";

export const FOTOS_POR_DIA = 1;

// El lunes de la semana de esa fecha.
export function inicioSemana(fecha = fechaLocal()) {
  const d = aFecha(fecha);
  const desdeLunes = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desdeLunes);
  return fechaLocal(d);
}

export const fotosDelDia = (comidas, usuarioId, fecha) =>
  comidas.filter((c) => c.usuario_id === usuarioId && c.fecha === fecha && c.tipo !== "resumen" && c.foto_path).length;

// Cacas de la semana en curso, de más a menos.
export function cacasDeLaSemana(multas, perfiles, fecha = fechaLocal()) {
  const lunes = inicioSemana(fecha);
  return Object.values(perfiles)
    .map((perfil) => ({ perfil, cacas: multas.filter((m) => m.usuario_id === perfil.id && m.fecha >= lunes && m.fecha <= fecha).length }))
    .sort((a, b) => b.cacas - a.cacas || a.perfil.nombre.localeCompare(b.perfil.nombre));
}

// La marca de cada uno: "evo" toda la semana del castigo, "dia" el día después de no subir fotos.
export function marcaDeCaca({ usuarioId, multas, bochaEvo, hoy = fechaLocal() }) {
  if (bochaEvo.some((b) => b.usuario_id === usuarioId && b.semana === inicioSemana(hoy))) return "evo";
  if (multas.some((m) => m.usuario_id === usuarioId && m.fecha === haceDias(1, aFecha(hoy)))) return "dia";
  return null;
}

// El castigo propio. El del día se levanta subiendo la foto de hoy; el Bocha Evo dura toda la semana.
export function castigoDe({ usuarioId, multas, bochaEvo, comidas, hoy = fechaLocal() }) {
  const marca = marcaDeCaca({ usuarioId, multas, bochaEvo, hoy });
  const evo = marca === "evo";
  const ayer = multas.some((m) => m.usuario_id === usuarioId && m.fecha === haceDias(1, aFecha(hoy)));
  const subioHoy = fotosDelDia(comidas, usuarioId, hoy) >= FOTOS_POR_DIA;
  return { marca, evo, diario: ayer && !subioHoy, activo: evo || (ayer && !subioHoy) };
}
