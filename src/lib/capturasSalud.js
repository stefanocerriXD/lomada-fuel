// Las capturas de MyFitnessPal que manda el Atajo (toque atrás): el texto ya leído por la IA.
// Cada comida de Apple Salud se une con la comida de la captura que suma las mismas calorías.
import { leerResumen } from "./importar.js";

export function filaParaSalud(capturas, entrada) {
  const objetivo = Number(entrada?.kcal) || 0;
  if (!(objetivo > 0)) return null;
  const tolerancia = Math.max(20, objetivo * 0.05);
  // La más nueva primero: si sacaste dos capturas de la misma comida, vale la última.
  for (const captura of capturas) {
    const filas = leerResumen(captura.texto || "").filter((f) => f.alimentos?.length);
    const fila = filas
      .filter((f) => Math.abs((Number(f.kcal) || 0) - objetivo) <= tolerancia)
      .sort((a, b) => Math.abs(a.kcal - objetivo) - Math.abs(b.kcal - objetivo))[0];
    if (fila) return { fila, capturaId: captura.id };
  }
  return null;
}
