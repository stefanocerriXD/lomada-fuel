// Estrellas a los platos (SQL 068): cada uno puntúa de 1 a 5 las comidas de los demás desde las historias.
// De acá salen el chef y el plato de la semana, las estadísticas y los logros de estrellas.
import { aFecha, fechaLocal } from "./fechas.js";
import { inicioSemana } from "./multas.js";

// Plato de la semana: al menos 2 votos (que no lo decida uno solo). Chef: al menos 2 platos puntuados.
export const MIN_VOTOS_PLATO = 2;
export const MIN_PLATOS_CHEF = 2;
// Un plato "de 5 estrellas" para el logro: promedio de 4,5 o más con al menos 2 votos.
const PLATO_PERFECTO = 4.5;
// Prefijo de las medallas que guardan cada semana ganada como chef ("chef_semana:2026-11-23").
export const PREFIJO_CHEF = "chef_semana:";

// Las comidas que se pueden puntuar: con dueño, no el resumen del día ni la fiesta, ni las planeadas.
export const puntuable = (c) => c && !["resumen", "fiesta"].includes(c.tipo) && !c.planeada && !c.privada;

// Por comida: votos, promedio y lo que puse yo.
export function puntajesPorComida(puntajes, yoId) {
  const porComida = new Map();
  for (const p of puntajes) {
    const d = porComida.get(p.comida_id) || { votos: 0, suma: 0, promedio: 0, mio: 0, quienes: [] };
    d.votos += 1;
    d.suma += p.estrellas;
    d.promedio = d.suma / d.votos;
    d.quienes.push({ usuarioId: p.usuario_id, estrellas: p.estrellas });
    if (p.usuario_id === yoId) d.mio = p.estrellas;
    porComida.set(p.comida_id, d);
  }
  return porComida;
}

export const promedioTexto = (n) => (Math.round(n * 10) / 10).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// El lunes y el domingo de la semana de una fecha.
export function semanaDe(fecha = fechaLocal()) {
  const lunes = inicioSemana(fecha);
  const d = aFecha(lunes);
  d.setDate(d.getDate() + 6);
  return { lunes, domingo: fechaLocal(d) };
}

// La tabla de la semana: por persona, platos puntuados, promedio (de todas las estrellas recibidas) y platos de 5.
export function rankingSemana({ comidas, puntajes, perfiles, fecha = fechaLocal() }) {
  const { lunes, domingo } = semanaDe(fecha);
  const porComida = puntajesPorComida(puntajes);
  const deLaSemana = comidas.filter((c) => puntuable(c) && c.fecha >= lunes && c.fecha <= domingo && porComida.has(c.id));
  const personas = Object.values(perfiles).map((perfil) => {
    const suyas = deLaSemana.filter((c) => c.usuario_id === perfil.id).map((c) => ({ comida: c, ...porComida.get(c.id) }));
    const votos = suyas.reduce((t, s) => t + s.votos, 0);
    const suma = suyas.reduce((t, s) => t + s.suma, 0);
    const mejor = [...suyas].sort((a, b) => b.promedio - a.promedio || b.votos - a.votos)[0] || null;
    return {
      perfil,
      platos: suyas.length,
      votos,
      estrellas: suma,
      promedio: votos ? suma / votos : 0,
      cincos: suyas.filter((s) => s.votos >= MIN_VOTOS_PLATO && s.promedio >= PLATO_PERFECTO).length,
      mejor,
    };
  });
  const conPlatos = personas.filter((p) => p.platos > 0).sort((a, b) => b.promedio - a.promedio || b.votos - a.votos || b.platos - a.platos);
  const candidatos = conPlatos.filter((p) => p.platos >= MIN_PLATOS_CHEF);
  // Empate exacto (mismo promedio y mismos votos): ganan los dos.
  const chefs = candidatos.length ? candidatos.filter((p) => p.promedio === candidatos[0].promedio && p.votos === candidatos[0].votos) : [];
  const platos = deLaSemana
    .map((c) => ({ comida: c, ...porComida.get(c.id) }))
    .filter((p) => p.votos >= MIN_VOTOS_PLATO)
    .sort((a, b) => b.promedio - a.promedio || b.votos - a.votos || (a.comida.creado_en < b.comida.creado_en ? -1 : 1));
  return { lunes, domingo, personas: conPlatos, chefs, plato: platos[0] || null, platos: platos.slice(0, 3), votosTotales: deLaSemana.reduce((t, c) => t + porComida.get(c.id).votos, 0) };
}

// Las semanas ya terminadas (dentro de lo cargado) que ganó esta persona como chef: las guarda como medallas.
export function semanasChefNuevas({ usuarioId, comidas, puntajes, perfiles, yaGanadas, hoy = fechaLocal() }) {
  const lunesActual = inicioSemana(hoy);
  const lunes = [...new Set(comidas.filter(puntuable).map((c) => inicioSemana(c.fecha)))].filter((l) => l < lunesActual);
  return lunes
    .filter((l) => !yaGanadas.includes(`${PREFIJO_CHEF}${l}`))
    .filter((l) => rankingSemana({ comidas, puntajes, perfiles, fecha: l }).chefs.some((c) => c.perfil.id === usuarioId))
    .map((l) => `${PREFIJO_CHEF}${l}`);
}

// Para los logros: estrellas recibidas, platos de 5, semanas de chef, platos que puntuaste y en cuántos días distintos.
export function cantidadesEstrellas({ usuarioId, comidas, puntajes, semanasChef = 0 }) {
  const mias = new Set(comidas.filter((c) => c.usuario_id === usuarioId && puntuable(c)).map((c) => c.id));
  const recibidos = puntajes.filter((p) => mias.has(p.comida_id));
  const porComida = puntajesPorComida(recibidos);
  return {
    estrellas: recibidos.reduce((t, p) => t + p.estrellas, 0),
    cinco: [...porComida.values()].filter((d) => d.votos >= MIN_VOTOS_PLATO && d.promedio >= PLATO_PERFECTO).length,
    chef: semanasChef,
    jurado: puntajes.filter((p) => p.usuario_id === usuarioId).length,
    jurado_dias: new Set(puntajes.filter((p) => p.usuario_id === usuarioId && p.creado_en).map((p) => fechaLocal(new Date(p.creado_en)))).size,
  };
}
