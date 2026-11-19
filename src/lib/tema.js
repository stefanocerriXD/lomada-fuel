const CLAVE = "comidas-tema";
// Quedan tres: Lomada, Full black y Full white. Quien tenía otro (Automático, Claro u Oscuro) vuelve a Lomada.
// Si cambia esta lista, actualizar también el script del principio de index.html.
export const TEMAS_VALIDOS = ["lomada", "negro", "blanco"];

export function leerTema() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return TEMAS_VALIDOS.includes(guardado) ? guardado : "lomada";
  } catch {
    return "lomada";
  }
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  // La barra del celular y el fondo de atrás de todo toman el color del tema elegido.
  const fondo = getComputedStyle(document.documentElement).getPropertyValue("--fondo").trim();
  if (fondo) {
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", fondo));
    document.documentElement.style.background = fondo;
  }
}

export function guardarTema(tema) {
  aplicarTema(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin almacenamiento el tema dura lo que dure la sesión.
  }
}
