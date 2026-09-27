const CACHE_NAME = 'income-tracker-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/icon.svg',
        '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== 'shared-files-cache') {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

let sharedFile = null;

self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'GET_SHARED_FILE') {
    // 1. Check in-memory copy
    if (sharedFile) {
      event.source.postMessage({
        type: 'SHARE_TARGET_FILE',
        file: sharedFile
      });
      sharedFile = null;
      return;
    }

    // 2. Check CacheStorage
    try {
      const cache = await caches.open('shared-files-cache');
      const response = await cache.match('/shared-file');
      if (response) {
        const blob = await response.blob();
        const fileName = decodeURIComponent(response.headers.get('X-File-Name') || 'slip.jpg');
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
        await cache.delete('/shared-file');
        event.source.postMessage({
          type: 'SHARE_TARGET_FILE',
          file: file
        });
      }
    } catch (e) {
      console.error('Error reading shared file from cache in sw:', e);
    }
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        let file = formData.get('receipt');
        
        // Robust fallback: if 'receipt' field is missing or empty, find the first File/Blob field
        if (!file || (typeof file === 'object' && !file.name)) {
          for (const [key, value] of formData.entries()) {
            if (value && typeof value === 'object' && (value.name || value.size)) {
              file = value;
              break;
            }
          }
        }
        
        if (file) {
          // Persist to CacheStorage so it survives the 303 redirect across all browsers/platforms
          const cache = await caches.open('shared-files-cache');
          const fileResponse = new Response(file, {
            headers: {
              'Content-Type': file.type || 'image/jpeg',
              'X-File-Name': encodeURIComponent(file.name || 'slip.jpg'),
              'X-File-Time': Date.now().toString()
            }
          });
          await cache.put('/shared-file', fileResponse);
          
          sharedFile = file; // Secondary in-memory backup
          
          const clients = await self.clients.matchAll({ type: 'window' });
          if (clients && clients.length > 0) {
            clients.forEach(client => {
              client.postMessage({
                type: 'SHARE_TARGET_FILE',
                file: file
              });
            });
          }
        }
      } catch (err) {
        console.error('Error handling share target POST', err);
      }
      
      // Safari iOS & Android: redirect to root with query flag
      return Response.redirect(url.origin + '/?shared=1&t=' + Date.now(), 303);
    })());
    return;
  }

  // Direct to network, fallback to cache for offline support
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
