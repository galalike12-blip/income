const CACHE_NAME = 'income-tracker-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
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
    console.log('Share target request received');
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          sharedFile = formData.get('receipt');
          console.log('File received and stored in SW:', sharedFile);

          // Redirect back to the app
          return Response.redirect('/', 303);
        } catch (err) {
          console.error('Error handling share target:', err);
          return Response.redirect('/', 303);
        }
      })()
    );
    return;
  }

  // Default fetch handler
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
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
