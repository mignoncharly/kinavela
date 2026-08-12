const CACHE_NAME = "kinavela-shell-v2";
const SHELL = ["/offline", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline")),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy));
            return response;
          }),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    message = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof message.title === "string" ? message.title : "Kinavela";
  const options = {
    body:
      typeof message.body === "string"
        ? message.body
        : "You have a new family update.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: typeof message.tag === "string" ? message.tag : undefined,
    data: {
      ...(message.data && typeof message.data === "object" ? message.data : {}),
      ...(typeof message.url === "string" ? { url: message.url } : {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data && event.notification.data.url;
  let targetUrl = self.location.origin + "/";
  if (typeof requestedUrl === "string") {
    try {
      const parsed = new URL(requestedUrl, self.location.origin);
      if (parsed.origin === self.location.origin) targetUrl = parsed.href;
    } catch {
      // Keep the safe same-origin fallback.
    }
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) {
          existing.navigate(targetUrl);
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

function updateStoredSubscription(action, subscription) {
  const json = subscription.toJSON();
  if (!json.endpoint) return Promise.resolve();
  const payload =
    action === "register"
      ? {
          action,
          endpoint: json.endpoint,
          p256dh: json.keys && json.keys.p256dh,
          auth: json.keys && json.keys.auth,
        }
      : { action, endpoint: json.endpoint };

  return fetch("/api/notifications/push", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      if (event.newSubscription) {
        await updateStoredSubscription("register", event.newSubscription);
      }
      if (
        event.oldSubscription &&
        (!event.newSubscription ||
          event.oldSubscription.endpoint !== event.newSubscription.endpoint)
      ) {
        await updateStoredSubscription("revoke", event.oldSubscription);
      }
    })(),
  );
});
