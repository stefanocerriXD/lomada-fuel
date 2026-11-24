// El modo fiesta al lado del nombre: 🍸 mientras sale (hasta el mediodía siguiente), y el día después,
// de 12 a 20, 🥴 (resaca) con 👑⚽ si hubo gol. A las 20 del día siguiente se va todo.
import { fechaLocal, haceDias } from "./fechas.js";

export const EVENTO_FESTEJO = "lomada:festejo";
// Con menos de 3 vasos no hay resaca (si hubo gol, al otro día se ve igual la corona).
export const VASOS_RESACA = 3;

// La noche sigue siendo la misma hasta el mediodía (igual que al cargar los vasos, en noche.js).
const FIN_NOCHE = 12;
// El día después, la marca de resaca o de gol se ve hasta las 20.
export const FIN_RESACA = 20;
const nocheDe = (ahora) => (ahora.getHours() < FIN_NOCHE ? haceDias(1, ahora) : fechaLocal(ahora));

export function estadoDeFiesta(usuarioId, comidas, ahora = new Date()) {
  const noche = nocheDe(ahora);
  const anterior = haceDias(1, new Date(`${noche}T12:00:00`));
  const vasos = (c) => (Array.isArray(c.alimentos) ? c.alimentos.length : 0);
  const suyas = comidas.filter((c) => c.usuario_id === usuarioId && c.tipo === "fiesta" && vasos(c) > 0);
  const hoy = suyas.find((c) => c.fecha === noche);
  if (hoy) return { modo: "fiesta", gol: hoy.gol === true, vasos: vasos(hoy), comidaId: hoy.id };
  // Antes del mediodía la noche de ayer sigue siendo "esta noche" (arriba); después de las 20, ya no hay nada.
  const hora = ahora.getHours();
  if (hora < FIN_NOCHE || hora >= FIN_RESACA) return null;
  const ayer = suyas.find((c) => c.fecha === anterior);
  if (!ayer) return null;
  const resaca = vasos(ayer) >= VASOS_RESACA;
  const gol = ayer.gol === true;
  // modo "resaca" es el día después: la marca de resaca solo va si tomó 3 o más.
  if (!resaca && !gol) return null;
  return { modo: "resaca", resaca, gol, vasos: vasos(ayer), comidaId: ayer.id };
}

// Tocar la marca abre el cartel con lo que pasó (y para felicitar al que hizo gol).
export function abrirFestejo(perfilId) {
  window.dispatchEvent(new CustomEvent(EVENTO_FESTEJO, { detail: { perfilId } }));
}
