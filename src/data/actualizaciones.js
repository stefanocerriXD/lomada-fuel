// Actualizaciones: solo los cambios importantes (funciones nuevas o cambios grandes).
// Los arreglos chicos y las correcciones no van acá. Lo más nuevo, arriba.
export const ACTUALIZACIONES = [
  {
    id: "2026-11-16-mejoras",
    fecha: "2026-11-16",
    emoji: "✅",
    titulo: "Te avisamos cuando tu mejora está lista",
    texto: "Cuando una mejora que pediste se marca como hecha, te llega una notificación. Y acá, en Actualizaciones, vas a ver los cambios importantes de la app.",
  },
  {
    id: "2026-11-16-registros",
    fecha: "2026-11-16",
    emoji: "💊",
    titulo: "Registros diarios: creatina, gym y magnesio",
    texto: "Elegí cuáles usás y tildalos cada día en el Resumen, abajo del agua. Ves la racha de días seguidos y, si querés, a las 20 te avisa si te falta alguno. Es solo tuyo.",
  },
  {
    id: "2026-11-16-zoom",
    fecha: "2026-11-16",
    emoji: "🔍",
    titulo: "Zoom en las fotos",
    texto: "En la foto ampliada, en el chat y en las recetas: pellizcá con dos dedos o tocá dos veces para agrandar, y mové la foto con un dedo.",
  },
  {
    id: "2026-11-16-instagram",
    fecha: "2026-11-16",
    emoji: "📸",
    titulo: "Compartí tu comida en Instagram",
    texto: "En tus comidas, el botón Instagram arma una imagen con la foto, el título, las calorías y los macros. Elegís historia o publicación y la compartís.",
  },
  {
    id: "2026-11-14-logros-fiesta",
    fecha: "2026-11-14",
    emoji: "🍸",
    titulo: "Logros de Fiesta",
    texto: "Dos logros nuevos en Logros: uno por los vasos del modo fiesta y otro por las noches que salís. La resaca aparece al otro día solo si tomaste 3 vasos o más.",
  },
  {
    id: "2026-11-14-salud",
    fecha: "2026-11-14",
    emoji: "❤️",
    titulo: "Lo de MyFitnessPal llega solo",
    texto: "Con el Atajo de Apple Salud, tus comidas de MyFitnessPal aparecen al tocar +. Con Ver los alimentos, una captura de MyFitnessPal te las separa en alimentos.",
  },
  {
    id: "2026-11-14-fiesta",
    fecha: "2026-11-14",
    emoji: "🪩",
    titulo: "Modo fiesta completo",
    texto: "Los vasos se guardan durante toda la noche, aunque no tengas señal. Podés marcar si hubo gol, subir fotos de la noche y sumar a los que salieron con vos. Al lado del nombre aparecen la copa, la corona y la resaca.",
  },
  {
    id: "2026-11-14-recetas",
    fecha: "2026-11-14",
    emoji: "👨‍🍳",
    titulo: "Recetas con fotos",
    texto: "Podés editar tus recetas, sumarles fotos o elegir la foto de una comida que ya subiste, e importarlas desde una captura de MyFitnessPal.",
  },
  {
    id: "2026-11-14-postre",
    fecha: "2026-11-14",
    emoji: "🍮",
    titulo: "Postre con nombre y foto",
    texto: "Sumale el postre a una comida con su nombre y su foto. Al grupo le llega el aviso y en Imágenes se ve marcado.",
  },
  {
    id: "2026-11-14-reacciones",
    fecha: "2026-11-14",
    emoji: "🔔",
    titulo: "Avisos de reacciones",
    texto: "Te llega una notificación cuando alguien reacciona a tu foto o a tu mensaje. Los logros ya no se notifican: solo cuando alguien sube de categoría.",
  },
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
