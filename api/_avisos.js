import webpush from "web-push";

export const avisosConfigurados = () => Boolean(process.env.VITE_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Manda el aviso a cada celular y devuelve los que ya no reciben notificaciones.
export async function enviarAvisos(aviso, origen) {
  webpush.setVapidDetails(origen, process.env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const { destinos, ...contenido } = aviso;
  const resultados = await Promise.allSettled(
    destinos.map((d) =>
      webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(contenido), { TTL: 3600 }),
    ),
  );
  return {
    enviadas: resultados.filter((r) => r.status === "fulfilled").length,
    vencidas: destinos.filter((_, i) => [404, 410].includes(resultados[i].reason?.statusCode)).map((d) => d.endpoint),
  };
}
