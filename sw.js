const CACHE_VERSION = 'bridge-tts-codex-v28';
const APP_SHELL = [
    './',
    './index.html',
    './howto.html',
    './style.css',
    './native-speech.js',
    './error-reporter.js',
    './pwa-support.js',
    './settings-storage.js',
    './prompt-service.js',
    './translator-service.js',
    './tts-service.js',
    './app.js',
    './manifest.json',
    './images/icons/icon-120x120.png',
    './images/icons/icon-152x152.png',
    './images/icons/icon-167x167.png',
    './images/icons/apple-touch-icon-180x180.png',
    './images/icons/icon-192x192.png',
    './images/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName !== CACHE_VERSION)
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    if (requestUrl.origin !== self.location.origin || event.request.method !== 'GET') {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', responseClone));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((response) => {
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        const responseClone = response.clone();
                        caches.open(CACHE_VERSION)
                            .then((cache) => cache.put(event.request, responseClone));
                        return response;
                    });
            })
    );
});
