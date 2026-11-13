// Ir a otra parte de la app desde cualquier pantalla (por ejemplo, de una comida a la receta que usó).
export const EVENTO_IR = "lomada:ir";
export function irARecetas(recetaId) {
  window.dispatchEvent(new CustomEvent(EVENTO_IR, { detail: { vista: "ajustes", seccion: "recetas", receta: recetaId } }));
}
