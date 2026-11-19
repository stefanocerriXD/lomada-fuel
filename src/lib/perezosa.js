// Pantallas que se bajan recién al abrirlas (React.lazy) sin quedar en blanco.
// Si mientras la app estaba abierta se publicó una versión nueva, el archivo viejo ya no existe y la carga falla:
// se recarga la app UNA vez para traer la versión nueva. Si vuelve a fallar enseguida, sigue el error (lo muestra Recuperable).
import { lazy } from "react";

const CLAVE = "lomada-recarga-por-version";
const ESPERA_MS = 60000;

export function recargarUnaVez() {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE)) || 0;
    if (Date.now() - ultima < ESPERA_MS) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin almacenamiento no se puede saber si ya se recargó: mejor mostrar el error que recargar en bucle.
    return false;
  }
  window.location.reload();
  return true;
}

export function perezosa(cargar) {
  return lazy(() => cargar().catch((error) => {
    // Mientras recarga, se queda esperando (no hace falta mostrar el error).
    if (recargarUnaVez()) return new Promise(() => {});
    throw error;
  }));
}
