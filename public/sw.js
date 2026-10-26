/* Nagrek service worker — install shell only. Push disabled until GATE-G7. */
const CACHE = 'nagrek-shell-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() =>
      self.clients.claim(),
    ),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  event.respondWith(
    caches.match(request).then((cached) => {
      const networked = fetch(request)
        .then((response) => {
          const copy = response.clone()
          if (response.ok && request.url.startsWith(self.location.origin)) {
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || networked
    }),
  )
})

// Web push intentionally no-op until owner approves GATE-G7
self.addEventListener('push', () => {})
