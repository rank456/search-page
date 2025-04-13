// 更新於 2025-04-13，觸發快取刷新
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('excel-search-cache').then(function(cache) {
      return cache.addAll([
        './',
        './index.html',
        './manifest.json'
      ]);
    })
  );
});
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
