// Actualizaciones: solo los cambios importantes (funciones nuevas o cambios grandes).
// Los arreglos chicos y las correcciones no van acá. Lo más nuevo, arriba.
// Antes de sumar una, se le consulta al dueño de la app: solo cosas funcionales o copadas.
export const ACTUALIZACIONES = [
  { id: "notificaciones-a-medida", fecha: "2026-11-17", emoji: "🔔", titulo: "Notificaciones a medida", texto: "En Ajustes › Notificaciones elegís qué avisos te llegan: chat, reacciones, recordatorios, informe y más." },
  { id: "grupos-propios", fecha: "2026-11-16", emoji: "👥", titulo: "Creá tu propio grupo", texto: "Cualquiera puede armar su grupo y administrarlo: compartís el código y aceptás a cada uno que pide entrar. Los grupos nuevos traen la maldición de la caca 💩." },
  { id: "sonidos", fecha: "2026-11-16", emoji: "🔊", titulo: "La app tiene sonidos", texto: "Suena al publicar, al ganar un logro, al sumar agua o un vaso, al tildar la creatina y más. Se apagan en Ajustes › Apariencia y sonidos." },
  { id: "escaner-foto", fecha: "2026-11-16", emoji: "📷", titulo: "Escáner con foto", texto: "Si la cámara en vivo no anda, sacale una foto al código de barras y lo lee igual." },
  { id: "deslizar-actualizar", fecha: "2026-11-16", emoji: "🔄", titulo: "Deslizá para actualizar", texto: "Desde arriba de todo, tirá hacia abajo: el plato gira y se trae lo nuevo del grupo." },
  { id: "logros-gym", fecha: "2026-11-16", emoji: "🏋️", titulo: "Logros de Gym y Creatina", texto: "8 niveles cada uno: de Flaco hasta RONNIE COLEMAN." },
  { id: "registros-diarios", fecha: "2026-11-16", emoji: "✅", titulo: "Creatina, gym y magnesio", texto: "Tildalos cada día en el Resumen, con racha de días seguidos y un aviso a las 20 si te olvidaste." },
  { id: "instagram", fecha: "2026-11-16", emoji: "📸", titulo: "Compartí tu comida en Instagram", texto: "En tus comidas hay un botón que arma una imagen con la foto, las calorías y los macros, para historia o publicación." },
  { id: "zoom-fotos", fecha: "2026-11-16", emoji: "🔍", titulo: "Zoom en las fotos", texto: "Pellizcá con dos dedos o tocá dos veces para acercar cualquier foto." },
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
