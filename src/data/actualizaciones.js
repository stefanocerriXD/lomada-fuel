// Actualizaciones: solo los cambios importantes (funciones nuevas o cambios grandes).
// Los arreglos chicos y las correcciones no van acá. Lo más nuevo, arriba.
// Antes de sumar una, se le consulta al dueño de la app: solo cosas funcionales o copadas.
export const ACTUALIZACIONES = [];

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
