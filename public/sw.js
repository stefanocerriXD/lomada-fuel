// Solo recibe notificaciones. No guarda páginas en caché, así la app siempre abre actualizada.
self.addEventListener("push", (evento) => {
  const datos = evento.data ? evento.data.json() : {};
  evento.waitUntil(
    self.registration.showNotification(datos.titulo || "Lomada Fuel", {
      body: datos.cuerpo || "",
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      data: { vista: datos.vista || "resumen" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = `/?vista=${encodeURIComponent(evento.notification.data?.vista || "resumen")}`;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => "focus" in v);
      if (!abierta) return self.clients.openWindow(url);
      abierta.navigate?.(url);
      return abierta.focus();
    }),
  );
});
