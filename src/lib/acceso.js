const CLAVE_RECUERDO = "lomada-usa-contrasena";
const CLAVE_OMITIDA = "lomada-contrasena-omitida";

function leer(clave) {
  try {
    return localStorage.getItem(clave) === "si";
  } catch {
    return false;
  }
}

function guardar(clave) {
  try {
    localStorage.setItem(clave, "si");
  } catch {
    // Sin almacenamiento, el login arranca en su opción por defecto.
  }
}

export const usaContrasena = () => leer(CLAVE_RECUERDO);
export const recordarContrasena = () => guardar(CLAVE_RECUERDO);
export const contrasenaOmitida = () => leer(CLAVE_OMITIDA);
export const omitirContrasena = () => guardar(CLAVE_OMITIDA);
