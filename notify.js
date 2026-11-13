/* Cyars Notify v1.0 — opt-in phone/computer notifications, shared by all of Ciarne's installable apps.
 *
 * What it does
 *  - Adds a small bell button. Nothing is sent until the person taps it and turns notifications ON.
 *  - The person picks which kinds they want: Appointments, Deadlines, Unfinished items, Things to do,
 *    plus quiet hours (no alerts overnight).
 *  - Reminders can be added by hand from the bell panel, or by the app itself through
 *    CyarsNotify.schedule({...}).
 *  - Alerts show in the phone's top bar / the computer's notification area.
 *      * While the app is open (or recently used), alerts fire from the device itself.
 *      * When the app is closed, alerts come from the Cyars Notify Hub (Apps Script + Firebase),
 *        once config.json has the Firebase keys and hub link filled in.
 *
 * App API (all optional):
 *   CyarsNotify.schedule({ id, type, title, body, at, url, repeat })   // type: appointment|deadline|unfinished|todo
 *   CyarsNotify.cancel(id)        CyarsNotify.done(id)        CyarsNotify.list()
 *   CyarsNotify.open()            CyarsNotify.isOn()
 *
 * Include with:  a script tag for notify.js with data-app="App Name" and defer
 * The app's sw.js must load notify-sw.js (importScripts) so alerts can show and be tapped.
 */
(function () {
  'use strict';
  if (window.CyarsNotify) return;

  var VERSION = '1.0';
  var CONFIG_URL = 'https://crispcleaninc-dot.github.io/family-hub/notify/config.json';
  var me = document.currentScript;
  var APP = (me && me.getAttribute('data-app')) || document.title || 'App';
  var SCOPE_KEY = location.pathname.replace(/[^a-z0-9]/gi, '_');
  var KEY = 'cyarsNotify:' + SCOPE_KEY;
  var TYPES = [
    ['appointment', 'Appointments'],
    ['deadline', 'Deadlines'],
    ['unfinished', 'Unfinished items'],
    ['todo', 'Things to do']
  ];
  var TYPE_LABEL = {}; TYPES.forEach(function (t) { TYPE_LABEL[t[0]] = t[1]; });

  /* ---------- saved state (this device, this app) ---------- */
  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  var S = read();
  S.prefs = S.prefs || { on: false, types: { appointment: true, deadline: true, unfinished: true, todo: true }, quietStart: '21:30', quietEnd: '07:00' };
  S.items = S.items || [];
  S.device = S.device || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    mirrorForWorker();
    queueSync();
    renderBadge();
  }

  /* ---------- IndexedDB mirror so the service worker can fire alerts in the background ---------- */
  function idb() {
    return new Promise(function (res, rej) {
      if (!('indexedDB' in window)) return rej('no idb');
      var r = indexedDB.open('cyars-notify', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function mirrorForWorker() {
    idb().then(function (db) {
      var tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ app: APP, prefs: S.prefs, items: S.items, url: location.href }, SCOPE_KEY);
    }).catch(function () {});
  }
  // the worker may have marked items as sent while the app was closed — pull that back in
  function pullFromWorker() {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var g = db.transaction('kv', 'readonly').objectStore('kv').get(SCOPE_KEY);
        g.onsuccess = function () {
          var w = g.result;
          if (w && w.items) {
            var sent = {};
            w.items.forEach(function (it) { if (it.lastSent) sent[it.id] = it; });
            S.items.forEach(function (it) {
              var x = sent[it.id];
              if (x && (!it.lastSent || x.lastSent > it.lastSent)) { it.lastSent = x.lastSent; it.at = x.at; }
            });
          }
          res();
        };
        g.onerror = function () { res(); };
      });
    }).catch(function () {});
  }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toMs(at) { if (typeof at === 'number') return at; var t = Date.parse(at); return isNaN(t) ? 0 : t; }
  function hm(s) { var p = String(s || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function inQuiet(d) {
    var q1 = hm(S.prefs.quietStart), q2 = hm(S.prefs.quietEnd);
    if (q1 === q2) return false;
    var m = d.getHours() * 60 + d.getMinutes();
    return q1 < q2 ? (m >= q1 && m < q2) : (m >= q1 || m < q2);
  }
  function nextRepeat(at, rep) {
    var step = rep === 'daily' ? 864e5 : rep === 'weekly' ? 6048e5 : 0;
    if (!step) return 0;
    var n = at; while (n <= Date.now()) n += step; return n;
  }
  function fmt(ms) {
    try { return new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return new Date(ms).toString(); }
  }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function supported() { return 'Notification' in window && 'serviceWorker' in navigator; }

  /* ---------- showing an alert ---------- */
  function show(it) {
    var title = it.title || 'Reminder';
    var body = (TYPE_LABEL[it.type] ? TYPE_LABEL[it.type] + ' · ' : '') + (it.body || fmt(toMs(it.at)));
    var opts = { body: body, tag: 'cyars-' + SCOPE_KEY + '-' + it.id, icon: iconUrl(), badge: iconUrl(), data: { cyars: 1, url: it.url || location.href } };
    if (!('serviceWorker' in navigator)) { try { new Notification(title, opts); } catch (e) {} return Promise.resolve(); }
    return navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification(title, opts); })
      .catch(function () { try { new Notification(title, opts); } catch (e) {} });
  }
  function iconUrl() {
    var l = document.querySelector('link[rel="apple-touch-icon"]') || document.querySelector('link[rel~="icon"]');
    return l ? l.href : '';
  }

  /* ---------- device-side check (app open or recently used) ---------- */
  function checkDue() {
    if (!S.prefs.on || Notification.permission !== 'granted') return;
    var now = Date.now(), changed = false;
    if (inQuiet(new Date())) return;
    S.items.forEach(function (it) {
      if (it.done) return;
      var at = toMs(it.at);
      if (!at || at > now) return;
      if (it.lastSent && it.lastSent >= at) return;
      if (S.prefs.types[it.type] === false) return;
      show(it);
      it.lastSent = now; changed = true;
      var n = nextRepeat(at, it.repeat); if (n) it.at = n;
    });
    if (changed) write();
  }

  /* ---------- closed-app alerts: Firebase + hub ---------- */
  var cfgPromise = null;
  function getConfig() {
    if (!cfgPromise) {
      cfgPromise = fetch(CONFIG_URL, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (c) { try { localStorage.setItem('cyarsNotify:config', JSON.stringify(c)); } catch (e) {} return c; })
        .catch(function () { try { return JSON.parse(localStorage.getItem('cyarsNotify:config')) || {}; } catch (e) { return {}; } });
    }
    return cfgPromise;
  }
  function pushReady(c) { return !!(c && c.hubUrl && c.vapidKey && c.firebase && c.firebase.apiKey && c.firebase.messagingSenderId); }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function enablePush() {
    return getConfig().then(function (c) {
      if (!pushReady(c)) return null;
      var v = c.firebaseVersion || '10.12.2';
      return loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-app-compat.js')
        .then(function () { return loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-messaging-compat.js'); })
        .then(function () { return navigator.serviceWorker.ready; })
        .then(function (reg) {
          var fb = window.firebase;
          if (!fb.apps.length) fb.initializeApp(c.firebase);
          return fb.messaging().getToken({ vapidKey: c.vapidKey, serviceWorkerRegistration: reg });
        })
        .then(function (tok) { if (tok) { S.token = tok; write(); } return tok; });
    }).catch(function (e) { S.pushError = String(e && e.message || e); write(); return null; });
  }
  var syncTimer = null;
  function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncHub, 1500); }
  function syncHub() {
    if (!S.token) return Promise.resolve();
    return getConfig().then(function (c) {
      if (!c.hubUrl) return;
      var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      var payload = {
        action: S.prefs.on ? 'sync' : 'off', token: S.token, device: S.device, app: APP, scope: SCOPE_KEY, icon: iconUrl(), appUrl: location.origin + location.pathname,
        tz: tz, prefs: S.prefs,
        items: S.items.filter(function (it) { return !it.done; }).map(function (it) {
          return { id: String(it.id), type: it.type, title: it.title, body: it.body || '', at: toMs(it.at), repeat: it.repeat || '', url: it.url || '', lastSent: it.lastSent || 0 };
        })
      };
      return fetch(c.hubUrl, { method: 'POST', body: JSON.stringify(payload) }).then(function () { S.lastSync = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} });
    }).catch(function () {});
  }
  function hubTest() {
    return getConfig().then(function (c) {
      if (!c.hubUrl || !S.token) return false;
      return fetch(c.hubUrl, { method: 'POST', body: JSON.stringify({ action: 'test', token: S.token, app: APP, appUrl: location.href }) }).then(function () { return true; });
    }).catch(function () { return false; });
  }
  function tryPeriodicSync() {
    navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.periodicSync) return;
      return navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (p) {
        if (p.state === 'granted') return reg.periodicSync.register('cyars-notify', { minInterval: 15 * 60 * 1000 });
      });
    }).catch(function () {});
  }

  /* ---------- public API ---------- */
  function schedule(it) {
    if (!it || !it.title) return null;
    var id = String(it.id || ('r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));
    var rec = { id: id, type: TYPE_LABEL[it.type] ? it.type : 'todo', title: String(it.title), body: it.body ? String(it.body) : '', at: toMs(it.at) || Date.now(), url: it.url || '', repeat: it.repeat || '', source: it.source || 'app' };
    var i = S.items.findIndex ? S.items.findIndex(function (x) { return x.id === id; }) : -1;
    if (i >= 0) { if (S.items[i].at !== rec.at) rec.lastSent = 0; else rec.lastSent = S.items[i].lastSent; S.items[i] = rec; }
    else S.items.push(rec);
    write(); if (panel) renderList();
    return id;
  }
  function cancel(id) { S.items = S.items.filter(function (x) { return x.id !== String(id); }); write(); if (panel) renderList(); }
  function done(id) { S.items.forEach(function (x) { if (x.id === String(id)) x.done = true; }); write(); if (panel) renderList(); }

  function turnOn() {
    if (!supported()) { setStatus('This browser cannot show notifications.'); return; }
    if (isIOS() && !isStandalone()) { setStatus('On iPhone/iPad: tap Share, then "Add to Home Screen", open the app from the Home Screen, and turn this on there.'); return; }
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { S.prefs.on = false; write(); renderPanel(); setStatus('Notifications are blocked. Allow them in this device\'s settings for this app, then try again.'); return; }
      S.prefs.on = true; write(); renderPanel();
      tryPeriodicSync();
      setStatus('On. Checking closed-app alerts…');
      enablePush().then(function (tok) { syncHub(); renderPanel(); setStatus(tok ? 'On — alerts will reach this device even when the app is closed.' : 'On — alerts show while the app is open or recently used.'); });
    });
  }
  function turnOff() { S.prefs.on = false; write(); syncHub(); renderPanel(); setStatus('Notifications are off for this app on this device.'); }

  /* ---------- UI: bell + panel ---------- */
  var bell, panel;
  var CSS = '' +
    '.cyn-bell{position:fixed;left:10px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:2147483000;width:42px;height:42px;border-radius:50%;border:1px solid rgba(201,169,97,.7);background:#1B2951;color:#C9A961;box-shadow:0 6px 18px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:.9;padding:0}' +
    '.cyn-bell:hover{opacity:1}.cyn-bell svg{width:22px;height:22px}' +
    '.cyn-dot{position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;border-radius:9px;background:#b45309;color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center;padding:0 4px}' +
    '.cyn-back{position:fixed;inset:0;z-index:2147483001;background:rgba(10,14,30,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '.cyn-panel{background:#FAF7F0;color:#1c1917;width:100%;max-width:520px;max-height:88vh;overflow:auto;border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 -10px 30px rgba(0,0,0,.25)}' +
    '@media(min-width:700px){.cyn-back{align-items:center}.cyn-panel{border-radius:20px}}' +
    '.cyn-panel h2{margin:0 0 2px;font-size:19px;color:#1B2951}.cyn-sub{color:#6b6459;font-size:13px;margin:0 0 12px}' +
    '.cyn-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #e9e1cf}' +
    '.cyn-sec{margin:14px 0 6px;font-weight:700;color:#1B2951;font-size:13px;letter-spacing:.06em;text-transform:uppercase}' +
    '.cyn-btn{border:0;border-radius:12px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer;background:#1B2951;color:#fff}' +
    '.cyn-btn.alt{background:#efe2bf;color:#1B2951}.cyn-btn.small{padding:6px 10px;font-size:13px}' +
    '.cyn-panel input,.cyn-panel select{font:inherit;padding:8px 10px;border:1px solid #d9cfb8;border-radius:10px;background:#fff;color:#1c1917;width:100%;box-sizing:border-box}' +
    '.cyn-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cyn-grid .full{grid-column:1/-1}' +
    '.cyn-item{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e9e1cf}' +
    '.cyn-item small{color:#6b6459}.cyn-status{margin-top:10px;padding:10px;border-radius:12px;background:#efe2bf;color:#1B2951;font-size:13px}' +
    '.cyn-chk{display:flex;gap:8px;align-items:center}.cyn-chk input{width:auto}' +
    '@media(prefers-color-scheme:dark){.cyn-panel{background:#18203a;color:#f4efe4}.cyn-panel h2,.cyn-sec{color:#efe2bf}.cyn-row,.cyn-item{border-color:#2b3558}.cyn-panel input,.cyn-panel select{background:#0f1424;color:#f4efe4;border-color:#2b3558}.cyn-sub,.cyn-item small{color:#b9b1a2}}';
  var BELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';

  function mountBell() {
    if (bell || !document.body) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    bell = document.createElement('button');
    bell.type = 'button'; bell.className = 'cyn-bell'; bell.setAttribute('aria-label', 'Notifications and reminders');
    bell.title = 'Notifications and reminders';
    bell.innerHTML = BELL_SVG;
    bell.addEventListener('click', open);
    document.body.appendChild(bell);
    renderBadge();
  }
  function renderBadge() {
    if (!bell) return;
    var end = new Date(); end.setHours(23, 59, 59, 999);
    var n = S.items.filter(function (it) { return !it.done && toMs(it.at) <= end.getTime(); }).length;
    var d = bell.querySelector('.cyn-dot');
    if (n) { if (!d) { d = document.createElement('span'); d.className = 'cyn-dot'; bell.appendChild(d); } d.textContent = n > 9 ? '9+' : n; }
    else if (d) d.remove();
  }
  function open() {
    if (panel) return;
    panel = document.createElement('div'); panel.className = 'cyn-back';
    panel.addEventListener('click', function (e) { if (e.target === panel) close(); });
    document.body.appendChild(panel);
    pullFromWorker().then(renderPanel);
    renderPanel();
  }
  function close() { if (panel) { panel.remove(); panel = null; } }
  var statusMsg = '';
  function setStatus(m) { statusMsg = m; var s = panel && panel.querySelector('.cyn-status'); if (s) s.textContent = m; }

  function renderPanel() {
    if (!panel) return;
    var on = S.prefs.on && supported() && Notification.permission === 'granted';
    var pushTxt = S.token ? 'Closed-app alerts: connected on this device.' : 'Closed-app alerts: not connected yet — alerts show while the app is open or recently used.';
    var iosTip = (isIOS() && !isStandalone()) ? '<div class="cyn-status">On iPhone/iPad, notifications only work after you add this app to your Home Screen (Share → Add to Home Screen) and open it from there.</div>' : '';
    var h = '<div class="cyn-panel" role="dialog" aria-label="Notifications">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><h2>Notifications</h2><p class="cyn-sub">' + esc(APP) + ' · this device</p></div>' +
      '<button class="cyn-btn alt small" data-a="close">Close</button></div>' + iosTip +
      '<div class="cyn-row"><div><b>' + (on ? 'Notifications are ON' : 'Notifications are OFF') + '</b><br><small style="color:#6b6459">' + (on ? esc(pushTxt) : 'You choose — nothing is sent unless you turn it on.') + '</small></div>' +
      (on ? '<button class="cyn-btn alt" data-a="off">Turn off</button>' : '<button class="cyn-btn" data-a="on">Turn on</button>') + '</div>' +
      '<div class="cyn-sec">Send me alerts for</div>' +
      TYPES.map(function (t) { return '<label class="cyn-row cyn-chk"><span>' + t[1] + '</span><input type="checkbox" data-type="' + t[0] + '"' + (S.prefs.types[t[0]] !== false ? ' checked' : '') + '></label>'; }).join('') +
      '<div class="cyn-sec">Quiet hours (no alerts)</div>' +
      '<div class="cyn-grid"><label>From<input type="time" data-q="quietStart" value="' + esc(S.prefs.quietStart) + '"></label><label>Until<input type="time" data-q="quietEnd" value="' + esc(S.prefs.quietEnd) + '"></label></div>' +
      '<div class="cyn-sec">Add a reminder</div>' +
      '<div class="cyn-grid"><input class="full" data-f="title" placeholder="What is it? (e.g., Dentist, File report)">' +
      '<select data-f="type">' + TYPES.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select>' +
      '<select data-f="repeat"><option value="">One time</option><option value="daily">Every day</option><option value="weekly">Every week</option></select>' +
      '<input class="full" type="datetime-local" data-f="at">' +
      '<input class="full" data-f="body" placeholder="Note (optional)">' +
      '<button class="cyn-btn full" data-a="add">Save reminder</button></div>' +
      '<div class="cyn-sec">Coming up</div><div class="cyn-list"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="cyn-btn alt small" data-a="test">Send me a test</button></div>' +
      '<div class="cyn-status"' + (statusMsg ? '' : ' style="display:none"') + '>' + esc(statusMsg) + '</div>' +
      '<p class="cyn-sub" style="margin-top:10px">Cyars Notify ' + VERSION + '. Reminders are kept on this device' + (S.token ? ' and with your notification hub so they can reach you when the app is closed' : '') + '.</p>' +
      '</div>';
    panel.innerHTML = h;
    var at = panel.querySelector('[data-f="at"]');
    var d = new Date(Date.now() + 36e5); d.setMinutes(0, 0, 0);
    at.value = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    renderList();
    panel.querySelector('.cyn-panel').addEventListener('click', onClick);
    panel.querySelectorAll('[data-type]').forEach(function (c) { c.addEventListener('change', function () { S.prefs.types[c.getAttribute('data-type')] = c.checked; write(); }); });
    panel.querySelectorAll('[data-q]').forEach(function (c) { c.addEventListener('change', function () { S.prefs[c.getAttribute('data-q')] = c.value; write(); }); });
  }
  function renderList() {
    var box = panel && panel.querySelector('.cyn-list'); if (!box) return;
    var list = S.items.filter(function (x) { return !x.done; }).sort(function (a, b) { return toMs(a.at) - toMs(b.at); });
    if (!list.length) { box.innerHTML = '<p class="cyn-sub">No reminders yet.</p>'; return; }
    box.innerHTML = list.map(function (it) {
      var late = toMs(it.at) < Date.now();
      return '<div class="cyn-item"><div><b>' + esc(it.title) + '</b><br><small>' + esc(TYPE_LABEL[it.type] || '') + ' · ' + esc(fmt(toMs(it.at))) + (it.repeat ? ' · ' + (it.repeat === 'daily' ? 'every day' : 'every week') : '') + (late ? ' · past due' : '') + '</small>' + (it.body ? '<br><small>' + esc(it.body) + '</small>' : '') + '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0"><button class="cyn-btn alt small" data-done="' + esc(it.id) + '">Done</button><button class="cyn-btn alt small" data-del="' + esc(it.id) + '" aria-label="Delete">✕</button></div></div>';
    }).join('');
  }
  function onClick(e) {
    var t = e.target.closest('button'); if (!t) return;
    var a = t.getAttribute('data-a');
    if (t.hasAttribute('data-done')) return done(t.getAttribute('data-done'));
    if (t.hasAttribute('data-del')) return cancel(t.getAttribute('data-del'));
    if (a === 'close') return close();
    if (a === 'on') return turnOn();
    if (a === 'off') return turnOff();
    if (a === 'add') {
      var g = function (f) { return panel.querySelector('[data-f="' + f + '"]').value; };
      if (!g('title').trim()) { setStatus('Type what the reminder is for.'); return; }
      var ms = Date.parse(g('at')); if (isNaN(ms)) { setStatus('Pick a date and time.'); return; }
      schedule({ title: g('title').trim(), type: g('type'), repeat: g('repeat'), at: ms, body: g('body').trim(), source: 'manual' });
      panel.querySelector('[data-f="title"]').value = ''; panel.querySelector('[data-f="body"]').value = '';
      setStatus('Saved. ' + (S.prefs.on ? 'You\'ll get an alert at ' + fmt(ms) + '.' : 'Turn notifications on to get an alert.'));
      return;
    }
    if (a === 'test') {
      if (!S.prefs.on || Notification.permission !== 'granted') { setStatus('Turn notifications on first.'); return; }
      show({ id: 'test', type: '', title: APP + ' — test alert', body: 'Notifications are working on this device.' });
      if (S.token) hubTest().then(function (ok) { setStatus(ok ? 'Test sent. A second test is coming from the hub to prove closed-app alerts work.' : 'Test shown from this device.'); });
      else setStatus('Test shown from this device.');
    }
  }

  /* ---------- start ---------- */
  window.CyarsNotify = { version: VERSION, schedule: schedule, cancel: cancel, done: done, list: function () { return S.items.slice(); }, open: open, isOn: function () { return !!S.prefs.on; } };
  function start() {
    mountBell();
    mirrorForWorker();
    pullFromWorker().then(function () { checkDue(); renderBadge(); });
    setInterval(checkDue, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { checkDue(); if (S.prefs.on && S.token) queueSync(); } });
    if (S.prefs.on && supported() && Notification.permission === 'granted') {
      tryPeriodicSync();
      // refresh the push token quietly (tokens can rotate)
      setTimeout(function () { enablePush().then(function () { syncHub(); }); }, 4000);
    }
    if (/[?&]notify=1\b/.test(location.search)) open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
