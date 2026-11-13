/* Cyars Notify v1.0 — service-worker side. Loaded from each app's sw.js with importScripts('notify-sw.js').
 *  - Shows alerts pushed from the Cyars Notify Hub (Firebase) when the app is closed.
 *  - Opens the right app page when an alert is tapped.
 *  - Where the device allows background checks (installed app on Android/Chrome), fires
 *    saved reminders on its own.
 *  Only handles its own alerts; anything else (e.g., OneSignal) is left alone.
 */
(function () {
  'use strict';

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('cyars-notify', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function hm(s) { var p = String(s || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function inQuiet(prefs, d) {
    var q1 = hm(prefs.quietStart), q2 = hm(prefs.quietEnd);
    if (q1 === q2) return false;
    var m = d.getHours() * 60 + d.getMinutes();
    return q1 < q2 ? (m >= q1 && m < q2) : (m >= q1 || m < q2);
  }
  var LABEL = { appointment: 'Appointments', deadline: 'Deadlines', unfinished: 'Unfinished items', todo: 'Things to do' };

  /* push from the hub (Firebase Cloud Messaging, data message) */
  self.addEventListener('push', function (e) {
    var d = {};
    try { d = e.data ? e.data.json() : {}; } catch (x) { return; }
    if (d && d.custom && d.custom.i) return;            // OneSignal message — not ours
    var p = d.data || d;
    if (!p || String(p.cyars) !== '1') return;         // only Cyars Notify messages
    var opts = {
      body: p.body || '',
      tag: p.tag || undefined,
      icon: p.icon || undefined,
      badge: p.icon || undefined,
      data: { cyars: 1, url: p.url || self.registration.scope }
    };
    e.waitUntil(self.registration.showNotification(p.title || 'Reminder', opts));
  });

  /* tap on an alert → open or focus the app */
  self.addEventListener('notificationclick', function (e) {
    var n = e.notification;
    if (!n.data || n.data.cyars !== 1) return;
    n.close();
    var url = n.data.url || self.registration.scope;
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) {
          try { list[i].navigate(url); } catch (x) {}
          return list[i].focus();
        }
      }
      return self.clients.openWindow(url);
    }));
  });

  /* background check (Android/desktop Chrome, installed app) */
  function fireDue() {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var store = db.transaction('kv', 'readonly').objectStore('kv');
        var req = store.getAll ? store.getAll() : null;
        var keysReq = store.getAllKeys ? store.getAllKeys() : null;
        if (!req || !keysReq) return res();
        var vals, keys;
        req.onsuccess = function () { vals = req.result; if (keys) go(); };
        keysReq.onsuccess = function () { keys = keysReq.result; if (vals) go(); };
        function go() {
          var now = Date.now(), jobs = [];
          var tx = db.transaction('kv', 'readwrite'), out = tx.objectStore('kv');
          vals.forEach(function (rec, i) {
            if (!rec || !rec.prefs || !rec.prefs.on || !rec.items) return;
            if (inQuiet(rec.prefs, new Date())) return;
            var changed = false;
            rec.items.forEach(function (it) {
              if (it.done || !it.at || it.at > now) return;
              if (it.lastSent && it.lastSent >= it.at) return;
              if (rec.prefs.types && rec.prefs.types[it.type] === false) return;
              jobs.push(self.registration.showNotification(it.title || 'Reminder', {
                body: (LABEL[it.type] ? LABEL[it.type] + ' · ' : '') + (it.body || ''),
                tag: 'cyars-' + keys[i] + '-' + it.id,
                data: { cyars: 1, url: it.url || rec.url || self.registration.scope }
              }));
              it.lastSent = now; changed = true;
              var step = it.repeat === 'daily' ? 864e5 : it.repeat === 'weekly' ? 6048e5 : 0;
              if (step) { while (it.at <= now) it.at += step; }
            });
            if (changed) out.put(rec, keys[i]);
          });
          Promise.all(jobs).then(res, res);
        }
      });
    }).catch(function () {});
  }
  self.addEventListener('periodicsync', function (e) {
    if (e.tag === 'cyars-notify') e.waitUntil(fireDue());
  });
})();
