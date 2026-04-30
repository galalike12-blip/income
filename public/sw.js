self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

let sharedFile = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_SHARED_FILE') {
    if (sharedFile) {
      event.source.postMessage({
        type: 'SHARE_TARGET_FILE',
        file: sharedFile
      });
      sharedFile = null; // Clear it after sending
    }
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('receipt');
        
        if (file) {
          sharedFile = file; // Store temporarily
          
          const clients = await self.clients.matchAll({ type: 'window' });
          if (clients && clients.length > 0) {
            clients.forEach(client => {
              client.postMessage({
                type: 'SHARE_TARGET_FILE',
                file: file
              });
            });
            sharedFile = null; // Sent successfully
          }
        }
      } catch (err) {
        console.error('Error handling share target POST', err);
      }
      
      return Response.redirect('/', 303);
    })());
    return;
  }

  // Direct to network, no caching
  event.respondWith(fetch(event.request));
});
