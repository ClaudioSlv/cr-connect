/* Dedicated scope /bolao: does not replace the application's service worker. */
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* safe campaign fallback */ }
  if (!data || typeof data !== "object") data = {};
  event.waitUntil(self.registration.showNotification(
    typeof data.title === "string" ? data.title : "🍀 Mega da Virada 2026",
    {
      body: typeof data.body === "string" ? data.body : "Acompanhe a abertura dos pagamentos do bolão.",
      icon: "/mega-virada-2026/arte-bolao-mega-virada-2026.jpg",
      tag: typeof data.tag === "string" ? data.tag : "mega-virada-2026",
      renotify: false,
      data: { url: "/bolao" },
      vibrate: [200, 100, 200],
    },
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL("/bolao", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin && url.pathname === "/bolao") {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
