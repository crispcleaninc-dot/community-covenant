/* Community Covenant service worker: works offline + phone notifications.
 * v5 (2026-11-06): offline-first.
 *  - App screens and scripts: fresh copy when online (so updates show right away), saved copy when offline.
 *  - Skit and Wisdom Reels recordings: saved on the device in the background, then played from the device
 *    (with seeking support), so read-aloud works with no internet.
 *  - Fonts, photos and thumbnails: kept after the first time they are seen.
 *  - Calls to the Apps Script server are never cached here (app/bridge.js handles offline data). */
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (e) {}
var CACHE = 'cc-shell-v6';
var MEDIA = 'cc-media-v1';
var RUNTIME = 'cc-runtime-v1';
var SHELL = ['./', 'index.html', 'app/', 'app/index.html', 'app/bridge.js', 'app/connect.js', 'config.js', 'chat.html', 'manifest.webmanifest',
  'icons/icon-32.png', 'icons/icon-96.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'assets/faith-findings-logo.jpg', 'assets/how-it-works-poster.jpg', 'assets/offline-files.json'];
var RUNTIME_HOSTS = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|images\.unsplash\.com|i\.ytimg\.com)$/;
var RUNTIME_MAX = 400;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  var keep = [CACHE, MEDIA, RUNTIME];
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (n) { return keep.indexOf(n) < 0; }).map(function (n) { return caches.delete(n); })); }).then(function () { return self.clients.claim(); }));
});

/* Background download of every recording listed in assets/offline-files.json (asked for by the page). */
var preparing = false;
function prepareMedia(port) {
  if (preparing) return; preparing = true;
  fetch('assets/offline-files.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (list) {
    return caches.open(MEDIA).then(function (c) {
      return c.keys().then(function (have) {
        var got = {}; have.forEach(function (q) { got[new URL(q.url).pathname] = 1; });
        var base = self.registration.scope, todo = list.filter(function (p) { return !got[new URL(p, base).pathname]; }), done = list.length - todo.length;
        function tell() { try { self.clients.matchAll().then(function (cs) { cs.forEach(function (cl) { cl.postMessage({ type: 'cc-media', done: done, total: list.length }); }); }); } catch (e) {} }
        tell();
        var i = 0;
        function worker() {
          if (i >= todo.length) return Promise.resolve();
          var u = new URL(todo[i++], base).href;
          return fetch(u).then(function (res) { if (res.ok) return c.put(u, res); }).catch(function () {}).then(function () { done++; if (done % 10 === 0 || done === list.length) tell(); return worker(); });
        }
        return Promise.all([worker(), worker(), worker()]);
      });
    });
  }).catch(function () {}).then(function () { preparing = false; });
}
self.addEventListener('message', function (e) { if (e.data && e.data.type === 'cc-prepare-offline') prepareMedia(); });

function timeout(p, ms) { return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error('timeout')); }, ms); p.then(function (v) { clearTimeout(t); res(v); }, function (er) { clearTimeout(t); rej(er); }); }); }

/* Serve a recording from the device, honouring Range requests (phones ask for audio in pieces). */
function fromMedia(req) {
  var url = req.url.split('#')[0];
  return caches.open(MEDIA).then(function (c) {
    return c.match(url).then(function (hit) {
      var get = hit ? Promise.resolve(hit) : fetch(url).then(function (res) { if (res.ok) c.put(url, res.clone()); return res; });
      return get.then(function (res) {
        var range = req.headers.get('range');
        if (!range || !res.ok) return res;
        return res.clone().arrayBuffer().then(function (buf) {
          var m = /bytes=(\d*)-(\d*)/.exec(range) || [], size = buf.byteLength;
          var start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
          if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
          return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
        });
      });
    });
  });
}

function trimRuntime() {
  caches.open(RUNTIME).then(function (c) { c.keys().then(function (k) { if (k.length > RUNTIME_MAX) for (var i = 0; i < k.length - RUNTIME_MAX; i++) c.delete(k[i]); }); });
}

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return; // server calls (POST) are handled by app/bridge.js
  var u = new URL(r.url);
  if (u.origin === location.origin) {
    if (/\/assets\/(skits|reels|reels-woman|reels-elder|reels-fiery|reels-oldschool|reels-seasoned)\/.+\.mp3$/.test(u.pathname)) { e.respondWith(fromMedia(r)); return; }
    if (/\.mp4$/.test(u.pathname)) return; // let the browser stream the video (online only)
    // Fresh copy first (so updates show right away), saved copy if offline or very slow.
    e.respondWith(timeout(fetch(r), 7000).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(r, { ignoreSearch: true }).then(function (m) {
        if (m) return m;
        if (r.mode === 'navigate') return caches.match(/\/app\//.test(u.pathname) ? 'app/' : './', { ignoreSearch: true }).then(function (x) { return x || caches.match('app/index.html'); });
        return new Response('', { status: 504 });
      });
    }));
    return;
  }
  if (RUNTIME_HOSTS.test(u.hostname)) {
    // Kept on the device after the first time: show the saved copy instantly, refresh it quietly when online.
    e.respondWith(caches.open(RUNTIME).then(function (c) {
      return c.match(r.url).then(function (hit) {
        var net = fetch(new Request(r.url, { mode: 'cors', credentials: 'omit' })).then(function (res) {
          if (res && res.ok) { c.put(r.url, res.clone()); trimRuntime(); }
          return res;
        }).catch(function () { return hit || fetch(r).catch(function () { return new Response('', { status: 504 }); }); });
        return hit || net;
      });
    }));
  }
});
