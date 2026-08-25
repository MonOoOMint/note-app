/// <reference lib="webworker" />
export {};

const serviceWorker = globalThis as unknown as ServiceWorkerGlobalScope;

serviceWorker.addEventListener("install", (event) => {
  event.waitUntil(serviceWorker.skipWaiting());
});

serviceWorker.addEventListener("activate", (event) => {
  event.waitUntil(serviceWorker.clients.claim());
});

serviceWorker.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "Nhắc nhở công việc!", body: "Bạn có công việc cần hoàn thành." };
  
  event.waitUntil(
    serviceWorker.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icon.svg",
      badge: "/icon.svg",
      vibrate: [200, 100, 200],
    } as NotificationOptions)
  );
});

serviceWorker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    serviceWorker.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (serviceWorker.clients.openWindow) {
        return serviceWorker.clients.openWindow("/todos");
      }
    })
  );
});
