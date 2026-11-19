// La pantalla de carga con el logo (está en index.html, así aparece antes que todo y sin destello blanco).
// Se va con un fundido cuando la app ya tiene algo para mostrar.
export function quitarSplash() {
  const splash = document.getElementById("splash");
  if (!splash || splash.dataset.saliendo) return;
  splash.dataset.saliendo = "si";
  splash.classList.add("fuera");
  setTimeout(() => splash.remove(), 450);
}
