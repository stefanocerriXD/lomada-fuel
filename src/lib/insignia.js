// El número de mensajes sin leer en el ícono de la app (iPhone con la app instalada, Android y compu).
// Se guarda también para el service worker: si llega un mensaje con la app cerrada, suma uno sobre este número.
const CACHE = "lomada-insignia";

export async function ponerInsignia(n) {
  try {
    if (n > 0) await navigator.setAppBadge?.(n);
    else await navigator.clearAppBadge?.();
  } catch {
    // Sin permiso de notificaciones el sistema no deja poner el número.
  }
  try {
    if ("caches" in window) await (await caches.open(CACHE)).put("/insignia", new Response(String(Math.max(0, n))));
  } catch {
    // Opcional.
  }
}
