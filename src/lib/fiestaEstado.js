// El modo fiesta al lado del nombre: 🍸 mientras sale, y al otro día 🥴 (resaca), con 👑⚽ si hubo gol.
import { fechaLocal, haceDias } from "./fechas.js";

export const EVENTO_FESTEJO = "lomada:festejo";

// La noche sigue siendo la misma hasta las 6 de la mañana.
const nocheDe = (ahora) => (ahora.getHours() < 6 ? haceDias(1, ahora) : fechaLocal(ahora));

export function estadoDeFiesta(usuarioId, comidas, ahora = new Date()) {
  const noche = nocheDe(ahora);
  const anterior = haceDias(1, new Date(`${noche}T12:00:00`));
  const vasos = (c) => (Array.isArray(c.alimentos) ? c.alimentos.length : 0);
  const suyas = comidas.filter((c) => c.usuario_id === usuarioId && c.tipo === "fiesta" && vasos(c) > 0);
  const hoy = suyas.find((c) => c.fecha === noche);
  if (hoy) return { modo: "fiesta", gol: hoy.gol === true, vasos: vasos(hoy), comidaId: hoy.id };
  const ayer = suyas.find((c) => c.fecha === anterior);
  if (ayer) return { modo: "resaca", gol: ayer.gol === true, vasos: vasos(ayer), comidaId: ayer.id };
  return null;
}

// Tocar la marca abre el cartel con lo que pasó (y para felicitar al que hizo gol).
export function abrirFestejo(perfilId) {
  window.dispatchEvent(new CustomEvent(EVENTO_FESTEJO, { detail: { perfilId } }));
}
