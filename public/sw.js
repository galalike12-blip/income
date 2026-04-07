self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    console.log('Share target request received');
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('receipt');
          console.log('File received from share target:', file);

          // Redirect back to the app
          const response = Response.redirect('/', 303);

          // Wait for the client to be ready and send the file
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          
          console.log('Found clients:', clients.length);
          for (const client of clients) {
            client.postMessage({
              type: 'SHARE_TARGET_FILE',
              file: file,
            });
          }

          return response;
        } catch (err) {
          console.error('Error handling share target:', err);
          return Response.redirect('/', 303);
        }
      })()
    );
  }
});
