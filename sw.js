var APP_PREFIX = 'gst_beast_pro_';
var VERSION = 'v8.0';
var CACHE_NAME = APP_PREFIX + VERSION;

var CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './Logo.png',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// 1. INSTALL: Pre-cache core app shell, Logo.png, PDF.js, and SheetJS (XLSX)
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return Promise.all(
                CORE_ASSETS.map(function(url) {
                    return cache.add(url).catch(function(err) {
                        console.warn('Skipped pre-caching asset:', url, err);
                    });
                })
            );
        })
    );
});

// 2. ACTIVATE: Clean up older cache versions (v1.0 - v5.0)
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

// 3. FETCH: Smart routing for App Shell, PDF.js, SheetJS, QR Codes, and Google Drive API
self.addEventListener('fetch', function(event) {
    var req = event.request;
    var url = new URL(req.url);

    // Always bypass non-GET requests (Google Drive PATCH/POST uploads)
    if (req.method !== 'GET') {
        return;
    }

    // Never intercept Google Drive REST API or Google OAuth endpoints
    if (url.hostname.indexOf('googleapis.com') !== -1 ||
        url.hostname.indexOf('accounts.google.com') !== -1 ||
        url.hostname.indexOf('gstatic.com') !== -1) {
        return;
    }

    // Cache-First with Network Fallback for CDN libraries (PDF.js, SheetJS) and UPI QR Codes
    if (url.hostname.indexOf('cdnjs.cloudflare.com') !== -1 ||
        url.hostname.indexOf('api.qrserver.com') !== -1) {
        event.respondWith(
            caches.match(req).then(function(cachedRes) {
                if (cachedRes) return cachedRes;
                return fetch(req).then(function(netRes) {
                    if (netRes && netRes.status === 200) {
                        var clone = netRes.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(req, clone);
                        });
                    }
                    return netRes;
                });
            })
        );
        return;
    }

    // Network-First with Offline Cache Fallback for App Shell (index.html, manifest.json, Logo.png)
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
            return caches.match(req, { ignoreSearch: true }).then(function(cachedResponse) {
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