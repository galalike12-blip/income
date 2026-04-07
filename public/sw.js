self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const file = formData.get('receipt');

        // Redirect back to the app
        const response = Response.redirect('/', 303);

        // Wait for the client to be ready and send the file
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        
        // We'll use a small delay or wait for the client to signal it's ready
        // But for now, let's try to send it to all matching clients
        for (const client of clients) {
          client.postMessage({
            type: 'SHARE_TARGET_FILE',
            file: file,
          });
        }

        return response;
      })()
    );
  }
});
