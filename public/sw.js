self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { return; }

  // "Save to Contacts" only applies to lead notifications (they carry a vCard);
  // milestones and other alerts get a single "Open" action.
  const actions = data.vcardUrl
    ? [
        { action: "save", title: "💾 Save to Contacts" },
        { action: "view", title: "View in SwiftCard" },
      ]
    : [{ action: "view", title: "Open SwiftCard" }];

  event.waitUntil(
    self.registration.showNotification(data.title ?? "SwiftCard", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag ?? "swiftcard",
      renotify: true,
      data: { url: data.url ?? "/dashboard", vcardUrl: data.vcardUrl ?? null },
      actions,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notifData = event.notification.data ?? {};

  // "Save to Contacts" always opens the vCard URL directly (new tab) so the
  // browser triggers the file download even when a SwiftCard tab is already open.
  if (event.action === "save" && notifData.vcardUrl) {
    event.waitUntil(clients.openWindow(notifData.vcardUrl));
    return;
  }

  const url = notifData.url ?? "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a SwiftCard tab is already open, navigate it to the target URL and focus
      for (const client of windowClients) {
        if ("navigate" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
