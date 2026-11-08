const CLAVE = "comidas-tema";

export function leerTema() {
  try {
    return localStorage.getItem(CLAVE) || "lomada";
  } catch {
    return "lomada";
  }
}

export function aplicarTema(tema) {
  if (tema === "auto") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  // La barra del celular toma el color de fondo del tema elegido.
  const fondo = getComputedStyle(document.documentElement).getPropertyValue("--fondo").trim();
  if (fondo) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", fondo));
}

export function guardarTema(tema) {
  aplicarTema(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin almacenamiento el tema dura lo que dure la sesión.
  }
}
