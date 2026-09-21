const CACHE_NAME = 'mehrbod-cards-cache-v10.0';
const CDN_CACHE_NAME = 'mehrbod-cards-cdn-cache-v10.0';

// Core application assets to precache immediately on install
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'style.css',
  'style-juice.css',
  'js/bot.js',
  'js/cards.js',
  'js/firebase-matchmaking.js',
  'js/game.js',
  'js/juice.js',
  'js/main.js',
  'js/network.js',
  'js/rng.js',
  'js/sound.js',
  'js/ui.js',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
  'apple-touch-icon.png',
  'favicon.ico',
  'manifest.json'
];

// Helper to determine if a request is for an external asset that we want to cache-first
const isExternalAsset = (url) => {
  return url.hostname.includes('fonts.googleapis.com') ||
         url.hostname.includes('fonts.gstatic.com') ||
         url.hostname.includes('cdnjs.cloudflare.com') ||
         url.hostname.includes('unpkg.com') ||
         url.hostname.includes('cdn.jsdelivr.net') ||
         url.hostname.includes('www.gstatic.com'); // Firebase SDKs etc.
};

// Install handler: precache all core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching core assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate handler: clean up stale caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler: caching and fallback strategies
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Skip caching for non-GET requests, Firebase matchmaking connections, Firestore, or internal matchmaking APIs
  if (
    event.request.method !== 'GET' ||
    requestUrl.pathname.startsWith('/api/') ||
    requestUrl.hostname.includes('firestore.googleapis.com') ||
    requestUrl.hostname.includes('firebase') && !requestUrl.pathname.endsWith('.js') // Don't block firebase real-time endpoints
  ) {
    return;
  }

  // 2. Cache-First with Network-Fallback strategy for external resources (fonts, libraries, CDNs)
  // This is highly critical on school networks so that CDN assets are instantly available offline or if blocked
  if (isExternalAsset(requestUrl)) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Fetch newest version in background to keep CDN cache updated
            fetch(event.request).then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(event.request, networkResponse);
              }
            }).catch(() => {/* Ignore background fetch failures */});
            return cachedResponse;
          }

          // Fallback to network
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200 || networkResponse.status === 0) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            console.error('[Service Worker] CDN Fetch failed:', err);
            return new Response('Network error', { status: 480, statusText: 'CDN Network Offline' });
          });
        });
      })
    );
    return;
  }

  // 3. Network-First strategy for internal application assets (HTML, JS, CSS)
  // Ensures user always gets the latest updated codebase, falling back to cache only when offline
  if (
    event.request.mode === 'navigate' ||
    requestUrl.pathname.endsWith('.html') ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname.endsWith('.css') ||
    requestUrl.pathname === '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('index.html');
          });
        })
    );
    return;
  }

  // 4. Stale-While-Revalidate for images and media
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Silent catch - if offline, fallback to cache
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});
