self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { return; }

  // ONE ACTION, AND IT OPENS THE APP.
  //
  // Lead notifications used to carry a second button that downloaded the
  // contact card straight from the notification. It was removed
  // 2026-09-11 on the owner's reasoning, which is right: a notification saying
  // someone shared their details is the highest-intent moment SwiftCard ever
  // gets, and finishing the job on the lock screen spends it. The person never
  // sees who it was, what they wrote, or anything else waiting for them — and
  // the product loses the one visit it had earned. Saving is a thing you decide
  // after looking, inside the app.
  const actions = [{ action: "view", title: "Open SwiftCard" }];

  // A SILENT update (the running view count — see lib/push-policy.ts) replaces
  // the notification already on screen without alerting again: same tag, no
  // sound or vibration, and renotify OFF, which is the flag that decides
  // whether replacing a tagged notification re-alerts the person. The web half
  // of what interruption-level "passive" does on iOS.
  const silent = data.silent === true;

  event.waitUntil(
    self.registration.showNotification(data.title ?? "SwiftCard", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag ?? "swiftcard",
      renotify: !silent,
      silent,
      data: { url: data.url ?? "/dashboard" },
      actions,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notifData = event.notification.data ?? {};

  // Every tap, on every action, lands in the app on the screen the notification
  // is about. There is deliberately no path out of here that completes a task
  // without opening SwiftCard — see the note on `actions` above.
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
