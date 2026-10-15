var APP_PREFIX = 'gst_beast_pro_';
var VERSION = 'v3.1';
var CACHE_NAME = APP_PREFIX + VERSION;

var CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './Logo.png'
];

// 1. INSTALL: Pre-cache the core PWA shell and Logo.png
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// 2. ACTIVATE: Clean up old caches belonging only to GST Beast Pro
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(
                keyList.map(function(key) {
                    if (key.indexOf(APP_PREFIX) === 0 && key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// 3. FETCH: Smart routing for App Shell, Logo, QR Codes, and Google Drive API
self.addEventListener('fetch', function(event) {
    var req = event.request;
    var url = new URL(req.url);

    // Always bypass non-GET requests (e.g. Google Drive PATCH/POST uploads)
    if (req.method !== 'GET') {
        return;
    }

    // Never cache Google Drive REST API or Google Identity OAuth endpoints
    if (url.hostname.indexOf('googleapis.com') !== -1 ||
        url.hostname.indexOf('accounts.google.com') !== -1 ||
        url.hostname.indexOf('gstatic.com') !== -1) {
        return;
    }

    // Cache-First with Network Fallback for UPI QR Code images
    if (url.hostname.indexOf('api.qrserver.com') !== -1) {
        event.respondWith(
            caches.match(req).then(function(cachedQr) {
                if (cachedQr) return cachedQr;
                return fetch(req).then(function(netRes) {
                    return caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(req, netRes.clone());
                        return netRes;
                    });
                });
            })
        );
        return;
    }

    // Network-First with Offline Cache Fallback for App Shell & Logo.png
    event.respondWith(
        fetch(req).then(function(networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
                var responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(req, responseClone);
                });
            }
            return networkResponse;
        }).catch(function() {
            return caches.match(req).then(function(cachedResponse) {
                if (cachedResponse) {
                    return cachedResponse;
                }
                if (req.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
