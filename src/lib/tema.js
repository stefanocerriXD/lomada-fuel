const CLAVE = "comidas-tema";

export function leerTema() {
  try {
    return localStorage.getItem(CLAVE) || "auto";
  } catch {
    return "auto";
  }
}

export function aplicarTema(tema) {
  if (tema === "auto") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
}

export function guardarTema(tema) {
  aplicarTema(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin almacenamiento el tema dura lo que dure la sesión.
  }
}
