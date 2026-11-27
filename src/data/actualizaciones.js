// Actualizaciones: solo los cambios importantes (funciones nuevas o cambios grandes).
// Los arreglos chicos y las correcciones no van acá. Lo más nuevo, arriba.
// Antes de sumar una, se le consulta al dueño de la app: solo cosas funcionales o copadas.
export const ACTUALIZACIONES = [
  { id: "historias-del-dia", fecha: "2026-11-27", emoji: "📸", titulo: "Historias del día", texto: "En el Resumen, abajo del calendario, hay un círculo por comida: desayuno, almuerzo, merienda, cena y colación. Tocalo y ves lo que comió cada uno, una foto atrás de otra, como en Instagram. Con aro azul y verde hay algo que no viste; en gris, ya lo viste. Tocá a la derecha para avanzar y a la izquierda para volver, mantené apretado para pausar, deslizá de costado para ir a otra comida y hacia abajo para cerrar. Tocando las calorías ves el desglose del plato, y podés responderle en el chat." },
  { id: "estrellas-a-los-platos", fecha: "2026-11-27", emoji: "⭐", titulo: "Estrellas a los platos", texto: "En cada historia le ponés de 1 a 5 estrellas al plato de los demás (el tuyo no). Si tocás otra vez la misma estrella, la sacás. En tus platos ves el promedio y quién te puntuó. Si estás castigado por la cacona, primero subí tu foto del día." },
  { id: "chef-de-la-semana", fecha: "2026-11-27", emoji: "👨‍🍳", titulo: "Chef y plato de la semana", texto: "En Resumen › Semana está la tabla de estrellas. Chef de la semana: el mejor promedio con al menos 2 platos puntuados. Plato de la semana: el mejor puntuado con al menos 2 votos. La semana va de lunes a domingo y podés mirar también la pasada." },
  { id: "logros-de-estrellas", fecha: "2026-11-27", emoji: "🏆", titulo: "Logros de estrellas", texto: "En Logros hay un grupo nuevo, Estrellas: estrellas recibidas, platos perfectos (4,5 o más con al menos 2 votos), semanas como chef, platos puntuados (el primero sale con tu primer voto) y días puntuando." },
  { id: "pedidos-en-el-chat", fecha: "2026-11-27", emoji: "🙋", titulo: "Pedidos para entrar, en el chat", texto: "Cuando alguien pide entrar a tu grupo, el bot lo avisa en el chat. Quien administra el grupo lo acepta o lo rechaza ahí mismo, y al aceptarlo aparece que se unió." },
  { id: "planear-comidas", fecha: "2026-11-21", emoji: "🗓️", titulo: "Planeá tus comidas", texto: "Cargá una comida antes de comerla: de mañana, o de hoy con «Todavía no la comí» en Más opciones. Queda sin foto y sin aviso; cuando la comés, tocás «Ya la comí», le sumás la foto y ahí le llega al grupo. Las editás o borrás desde el Resumen." },
  { id: "copiar-comidas", fecha: "2026-11-21", emoji: "📋", titulo: "Copiá y pegá comidas", texto: "En el Resumen, abrí tu día en «El día de cada uno» y copiá cualquier comida. Andá a otro día y tocá «Pegar»: se abre con los mismos alimentos y cantidades. Y en el buscador, al escribir, aparecen tus comidas anteriores." },
  { id: "actividades-y-recordatorios", fecha: "2026-11-18", emoji: "⏰", titulo: "Tus actividades y recordatorios", texto: "En Ajustes › Registros diarios sumás fútbol, running, pádel o la actividad que escribas, y armás hasta 10 recordatorios a la hora que quieras, con sus días y su mensaje." },
  { id: "viaje-y-matchday", fecha: "2026-11-18", emoji: "✈️", titulo: "Tu viaje y tu Match Day", texto: "Cada uno arma su cuenta regresiva a su viaje y su día de partido en Ajustes › Viaje y Match Day. Los avisos llegan según lo tuyo." },
  { id: "compartir-dia", fecha: "2026-11-17", emoji: "🗓️", titulo: "Compartí tu día entero", texto: "En el Resumen, «Compartir mi día» arma una historia o publicación con todas las fotos del día, el total y los macros. Elegís entre tres plantillas: grilla, collage o ticket." },
  { id: "notificaciones-a-medida", fecha: "2026-11-17", emoji: "🔔", titulo: "Notificaciones a medida", texto: "En Ajustes › Notificaciones elegís qué avisos te llegan: chat, reacciones, recordatorios, informe y más." },
  { id: "grupos-propios", fecha: "2026-11-16", emoji: "👥", titulo: "Creá tu propio grupo", texto: "Cualquiera puede armar su grupo y administrarlo: compartís el código y aceptás a cada uno que pide entrar. Los grupos nuevos traen la maldición de la cacona 💩." },
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

// "Nuevo" dura 3 días desde la fecha de la novedad.
export const DIAS_NUEVO = 3;
export const esReciente = (a, ahora = Date.now()) => ahora - new Date(`${a.fecha}T00:00:00-03:00`).getTime() < DIAS_NUEVO * 86400000;

// La última que viste: lo que está arriba de esa es nuevo (si es de los últimos 3 días).
export function nuevasDesde(ahora = Date.now()) {
  const ultima = vistas();
  const i = ACTUALIZACIONES.findIndex((a) => a.id === ultima);
  return new Set((i < 0 ? ACTUALIZACIONES : ACTUALIZACIONES.slice(0, i)).filter((a) => esReciente(a, ahora)).map((a) => a.id));
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
