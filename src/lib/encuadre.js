// La cuenta del encuadre de la foto de perfil (sin nada del navegador: se prueba sola).
export const ZOOM_MAXIMO = 4;

// El encuadre: la foto siempre tapa todo el cuadrado (nunca quedan bordes vacíos).
// w y h: tamaño real de la foto. lado: el cuadrado en pantalla. dx y dy: cuánto se movió el centro (en pantalla).
// Devuelve el movimiento corregido y el pedazo de la foto original que entra en el cuadrado.
export function encuadre({ w, h, lado, zoom = 1, dx = 0, dy = 0 }) {
  const z = Math.min(ZOOM_MAXIMO, Math.max(1, zoom));
  const escala = (lado / Math.min(w, h)) * z;
  const ancho = w * escala;
  const alto = h * escala;
  const maxX = (ancho - lado) / 2;
  const maxY = (alto - lado) / 2;
  const x = Math.min(maxX, Math.max(-maxX, dx));
  const y = Math.min(maxY, Math.max(-maxY, dy));
  const recorte = lado / escala;
  return {
    zoom: z,
    dx: x,
    dy: y,
    ancho,
    alto,
    origen: { x: w / 2 - x / escala - recorte / 2, y: h / 2 - y / escala - recorte / 2, lado: recorte },
  };
}
