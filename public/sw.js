// Solo recibe notificaciones. No guarda páginas en caché, así la app siempre abre actualizada.
// Lo que va al chat suma uno al número del ícono; al abrir la app se pone el número exacto.
async function sumarInsignia() {
  try {
    const cache = await caches.open("lomada-insignia");
    const guardado = await cache.match("/insignia");
    const n = (Number(guardado ? await guardado.text() : 0) || 0) + 1;
    await cache.put("/insignia", new Response(String(n)));
    await self.navigator.setAppBadge?.(n);
  } catch {
    // Sin soporte de número en el ícono.
  }
}

self.addEventListener("push", (evento) => {
  const datos = evento.data ? evento.data.json() : {};
  evento.waitUntil(
    Promise.all([
      self.registration.showNotification(datos.titulo || "Lomada Fuel", {
        body: datos.cuerpo || "",
        icon: "/icono-192.png",
        badge: "/icono-192.png",
        data: { vista: datos.vista || "chat" },
      }),
      (datos.vista || "chat") === "chat" ? sumarInsignia() : null,
    ]),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = `/?vista=${encodeURIComponent(evento.notification.data?.vista || "chat")}`;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => "focus" in v);
      if (!abierta) return self.clients.openWindow(url);
      abierta.navigate?.(url);
      return abierta.focus();
    }),
  );
});
