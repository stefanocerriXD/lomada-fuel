// Actualizaciones: solo los cambios importantes (funciones nuevas o cambios grandes).
// Los arreglos chicos y las correcciones no van acá. Lo más nuevo, arriba.
// Antes de sumar una, se le consulta al dueño de la app: solo cosas funcionales o copadas.
export const ACTUALIZACIONES = [
  { id: "notificaciones-a-medida", fecha: "2026-11-17", emoji: "🔔", titulo: "Notificaciones a medida", texto: "En Ajustes › Notificaciones elegís qué avisos te llegan: chat, reacciones, recordatorios, informe y más." },
  { id: "grupos-propios", fecha: "2026-11-16", emoji: "👥", titulo: "Creá tu propio grupo", texto: "Cualquiera puede armar su grupo y administrarlo: compartís el código y aceptás a cada uno que pide entrar. Los grupos nuevos traen la maldición de la caca 💩." },
  { id: "registros-diarios", fecha: "2026-11-16", emoji: "✅", titulo: "Creatina, gym y magnesio", texto: "Tildalos cada día en el Resumen, con racha de días seguidos y un aviso a las 20 si te olvidaste." },
  { id: "instagram", fecha: "2026-11-16", emoji: "📸", titulo: "Compartí tu comida en Instagram", texto: "En tus comidas hay un botón que arma una imagen con la foto, las calorías y los macros, para historia o publicación." },
  { id: "modo-fiesta", fecha: "2026-11-14", emoji: "🍻", titulo: "Modo fiesta", texto: "Cargá los vasos de la noche con un toque, sumá a los que salieron con vos y marcá si hubo gol. Tiene sus propios logros." },
];

const CLAVE = "lomada-actualizaciones-vistas";
export const EVENTO_ACTUALIZACIONES = "lomada:actualizaciones";

function vistas() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return ACTUALIZACIONES[0]?.id;
  }
}

// La última que viste: lo que está arriba de esa es nuevo.
export function nuevasDesde() {
  const ultima = vistas();
  const i = ACTUALIZACIONES.findIndex((a) => a.id === ultima);
  return new Set((i < 0 ? ACTUALIZACIONES : ACTUALIZACIONES.slice(0, i)).map((a) => a.id));
}

export const hayNovedades = () => nuevasDesde().size > 0;

export function marcarVistas() {
  try {
    localStorage.setItem(CLAVE, ACTUALIZACIONES[0]?.id || "");
  } catch {
    // Sin almacenamiento: se vuelven a marcar como nuevas.
  }
  window.dispatchEvent(new Event(EVENTO_ACTUALIZACIONES));
}
