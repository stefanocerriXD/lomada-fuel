// Informe semanal de cada uno: todo sale de lo cargado, con cuentas y reglas. No usa IA ni gasta nada.
import { sumarComidas } from "./macros.js";
import { fechaLocal } from "./fechas.js";
import { alimentosVisibles } from "../componentes/DetalleAlimentos.jsx";

const DIA_MS = 86400000;
const aFecha = (texto) => new Date(`${texto}T12:00:00`);
const mover = (texto, dias) => fechaLocal(new Date(aFecha(texto).getTime() + dias * DIA_MS));
const promedio = (lista) => (lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0);
const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// La semana del informe termina el último domingo (hoy, si es domingo).
export function semanaDelInforme(hoy = fechaLocal()) {
  const hasta = mover(hoy, -aFecha(hoy).getDay());
  return { desde: mover(hasta, -6), hasta };
}

function dias(desde) {
  return Array.from({ length: 7 }, (_, i) => mover(desde, i));
}

function totalesPorDia(comidas, fechas) {
  return fechas.map((fecha) => {
    const delDia = comidas.filter((c) => c.fecha === fecha);
    const t = sumarComidas(delDia);
    return { fecha, kcal: Math.round(t.kcal), p: t.p, c: t.c, g: t.g, comidas: delDia.filter((c) => c.tipo !== "resumen").length };
  });
}

function resumenDe(porDia) {
  const cargados = porDia.filter((d) => d.kcal > 0);
  const n = cargados.length || 1;
  const suma = (k) => cargados.reduce((t, d) => t + d[k], 0);
  return { dias: cargados.length, kcal: Math.round(suma("kcal") / n), p: Math.round(suma("p") / n), c: Math.round(suma("c") / n), g: Math.round(suma("g") / n) };
}

export function armarInforme({ comidas, usuarioId, meta, metaProteina, agua = [], perfiles = {}, hoy = fechaLocal() }) {
  const { desde, hasta } = semanaDelInforme(hoy);
  const fechas = dias(desde);
  const anteriores = dias(mover(desde, -7));
  const mias = comidas.filter((c) => c.usuario_id === usuarioId);
  const semana = mias.filter((c) => c.fecha >= desde && c.fecha <= hasta);
  const porDia = totalesPorDia(semana, fechas);
  const actual = resumenDe(porDia);
  const previo = resumenDe(totalesPorDia(mias.filter((c) => c.fecha >= anteriores[0] && c.fecha <= anteriores[6]), anteriores));
  const cargados = porDia.filter((d) => d.kcal > 0);
  const platos = semana.filter((c) => c.tipo !== "resumen" && c.tipo !== "fiesta");

  // Meta: dentro del 10% cuenta como cumplida.
  const enMeta = meta ? cargados.filter((d) => Math.abs(d.kcal - meta) <= meta * 0.1).length : 0;
  const pasados = meta ? cargados.filter((d) => d.kcal > meta * 1.1).length : 0;
  const mejorDia = meta && cargados.length ? cargados.reduce((m, d) => (Math.abs(d.kcal - meta) < Math.abs(m.kcal - meta) ? d : m)) : null;
  const diaPesado = cargados.length ? cargados.reduce((m, d) => (d.kcal > m.kcal ? d : m)) : null;
  const comidaTop = platos.reduce((m, c) => ((Number(c.calorias) || 0) > (Number(m?.calorias) || 0) ? c : m), null);

  // Lo que más se repitió en el plato.
  const veces = new Map();
  for (const c of platos) {
    const nombres = new Set(alimentosVisibles(c.alimentos || []).map((a) => a.nombre).filter(Boolean));
    for (const nombre of nombres) {
      const clave = normal(nombre);
      const previoAlimento = veces.get(clave);
      veces.set(clave, { nombre: previoAlimento?.nombre || nombre, veces: (previoAlimento?.veces || 0) + 1 });
    }
  }
  const favorito = [...veces.values()].sort((a, b) => b.veces - a.veces)[0];

  // Fin de semana contra días de semana (sábado y domingo son los dos últimos).
  const finde = promedio(porDia.slice(5).filter((d) => d.kcal > 0).map((d) => d.kcal));
  const habiles = promedio(porDia.slice(0, 5).filter((d) => d.kcal > 0).map((d) => d.kcal));

  const conDesayuno = new Set(platos.filter((c) => c.tipo === "desayuno").map((c) => c.fecha)).size;
  const horasCena = platos.filter((c) => c.tipo === "cena" && c.creado_en).map((c) => {
    const h = new Date(c.creado_en);
    const minutos = h.getHours() * 60 + h.getMinutes();
    return minutos < 360 ? minutos + 1440 : minutos; // Después de medianoche sigue siendo la cena de ese día.
  });
  const horaCena = horasCena.length ? Math.round(promedio(horasCena)) % 1440 : null;
  const litros = agua.filter((a) => a.usuario_id === usuarioId && a.fecha >= desde && a.fecha <= hasta && a.ml > 0);
  const aguaPromedio = litros.length ? Math.round(promedio(litros.map((a) => a.ml))) : 0;

  // Constancia contra el grupo: días con algo cargado.
  const constancia = Object.keys(perfiles)
    .map((id) => ({ id, dias: new Set(comidas.filter((c) => c.usuario_id === id && c.fecha >= desde && c.fecha <= hasta).map((c) => c.fecha)).size }))
    .sort((a, b) => b.dias - a.dias);
  const puesto = constancia.findIndex((x) => x.id === usuarioId) + 1;

  const kcalMacros = actual.p * 4 + actual.c * 4 + actual.g * 9 || 1;
  const reparto = { p: Math.round((actual.p * 4 * 100) / kcalMacros), c: Math.round((actual.c * 4 * 100) / kcalMacros), g: Math.round((actual.g * 9 * 100) / kcalMacros) };

  // Lo bueno y lo que se puede mejorar, con reglas simples.
  const bien = [];
  const mejorar = [];
  if (actual.dias === 7) bien.push("Cargaste los 7 días. Constancia perfecta.");
  else if (actual.dias >= 5) bien.push(`Cargaste ${actual.dias} de 7 días.`);
  else if (actual.dias > 0) mejorar.push(`Cargaste ${actual.dias} de 7 días: con más días el informe es más fiel.`);
  if (meta && actual.dias) {
    if (enMeta >= 4) bien.push(`${enMeta} ${enMeta === 1 ? "día" : "días"} dentro de tu meta (±10%).`);
    if (pasados >= 3) mejorar.push(`${pasados} días te pasaste más de un 10% de la meta.`);
    if (actual.kcal < meta * 0.8) mejorar.push(`Comiste en promedio ${Math.round(meta - actual.kcal).toLocaleString("es-AR")} kcal menos que tu meta.`);
  }
  if (metaProteina && actual.dias) {
    if (actual.p >= metaProteina * 0.95) bien.push(`Proteína al día: ${actual.p} g de ${metaProteina} g.`);
    else mejorar.push(`Te faltó proteína: ${actual.p} g por día contra ${metaProteina} g de meta.`);
  }
  if (finde && habiles && finde > habiles * 1.25) mejorar.push(`El finde comiste ${Math.round(finde - habiles).toLocaleString("es-AR")} kcal más por día que en la semana.`);
  if (actual.dias >= 4 && conDesayuno <= 2) mejorar.push(`Desayunaste solo ${conDesayuno} ${conDesayuno === 1 ? "día" : "días"}.`);
  if (aguaPromedio >= 2000) bien.push(`Buena hidratación: ${(aguaPromedio / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} L por día.`);
  if (previo.dias && actual.dias && actual.p > previo.p + 10) bien.push(`Subiste ${actual.p - previo.p} g de proteína por día contra la semana anterior.`);

  return {
    desde,
    hasta,
    porDia,
    actual,
    previo,
    meta,
    metaProteina,
    enMeta,
    pasados,
    mejorDia,
    diaPesado,
    comidaTop,
    favorito: favorito?.veces > 1 ? favorito : null,
    platos: platos.length,
    fotos: semana.filter((c) => c.foto_path).length,
    finde: Math.round(finde),
    habiles: Math.round(habiles),
    conDesayuno,
    horaCena,
    aguaPromedio,
    puesto,
    integrantes: constancia.length,
    reparto,
    bien,
    mejorar,
  };
}
