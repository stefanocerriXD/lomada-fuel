import { useSyncExternalStore } from "react";

// Lo que cada uno está haciendo en el chat ahora (escribiendo, grabando un audio, mandando una foto).
// Vive fuera del contexto general: así un "está escribiendo" no redibuja toda la app.
const VENCE_MS = 6000;
let estado = {};
const oyentes = new Set();
const relojes = {};

function avisar() {
  oyentes.forEach((f) => f());
}

export function marcarActividad(usuarioId, que) {
  clearTimeout(relojes[usuarioId]);
  if (!que) {
    if (!estado[usuarioId]) return;
    const { [usuarioId]: _, ...resto } = estado;
    estado = resto;
  } else {
    // Si el otro cierra la app sin avisar, se borra solo.
    relojes[usuarioId] = setTimeout(() => marcarActividad(usuarioId, null), VENCE_MS);
    if (estado[usuarioId] === que) return;
    estado = { ...estado, [usuarioId]: que };
  }
  avisar();
}

const suscribir = (f) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

export const useActividad = () => useSyncExternalStore(suscribir, () => estado);
