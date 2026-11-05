import { supabase } from "./supabase.js";

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function estadoAvisos() {
  if (!CLAVE_PUBLICA) return "sin_configurar";
  const instalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (/iPhone|iPad/.test(navigator.userAgent) && !instalada) return "instalar";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "no_compatible";
  if (Notification.permission === "denied") return "bloqueadas";
  return "disponible";
}

function aBytes(base64) {
  const limpio = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(limpio), (c) => c.charCodeAt(0));
}

export async function avisosActivos() {
  if (estadoAvisos() !== "disponible") return false;
  const registro = await navigator.serviceWorker.getRegistration();
  return Boolean(await registro?.pushManager.getSubscription());
}

export async function activarAvisos(usuarioId) {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") throw new Error("Sin permiso para notificaciones");
  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const suscripcion = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) });
  const { endpoint, keys } = suscripcion.toJSON();
  const { error } = await supabase
    .from("suscripciones_push")
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, usuario_id: usuarioId }, { onConflict: "endpoint" });
  if (error) {
    await suscripcion.unsubscribe();
    throw error;
  }
}

export async function desactivarAvisos() {
  const registro = await navigator.serviceWorker.getRegistration();
  const suscripcion = await registro?.pushManager.getSubscription();
  if (!suscripcion) return;
  await supabase.from("suscripciones_push").delete().eq("endpoint", suscripcion.endpoint);
  await suscripcion.unsubscribe();
}
