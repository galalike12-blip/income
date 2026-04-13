const CACHE_NAME = 'income-tracker-v' + Date.now();
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('income-tracker-v') && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

let sharedFile = null;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle Share Target
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          sharedFile = formData.get('receipt');
          return Response.redirect('/', 303);
        } catch (err) {
          return Response.redirect('/', 303);
        }
      })()
    );
    return;
  }

  // OTA Strategy: Network First for HTML, Stale-While-Revalidate for others
  if (event.request.mode === 'navigate' || (event.request.destination === 'document')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
      return response || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'GET_SHARED_FILE') {
    console.log('Client requested shared file, sending:', sharedFile);
    event.source.postMessage({
      type: 'SHARE_TARGET_FILE',
      file: sharedFile,
    });
    sharedFile = null; // Clear after sending
  }
});
