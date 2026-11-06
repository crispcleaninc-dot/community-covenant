/* Community Covenant — GitHub bridge.
 * The app was written for Google Apps Script, which provides google.script.run.
 * This file provides the same thing on GitHub: every call is sent to the
 * Apps Script server (doPost) and the answer comes back to the same
 * success / failure handlers. Nothing else in the app had to change.
 *
 * Offline-first (Nov 6 2026):
 *  - Every answer the app reads (profile, log, workbook, Seek First, Daily Altar, chat, music lists,
 *    sign-in) is kept on this device, so the app opens and works with no internet.
 *  - Every save made without internet (daily entry + photo, workbook, Seek First, Daily Altar, profile,
 *    fast type, help questions, chat messages, song feedback) waits on the device and is sent to the
 *    server, in order, as soon as the connection comes back. The screen updates right away as if saved.
 *  - Things that truly need the internet (creating an account, password reset, AI answers, YouTube)
 *    say so plainly when offline. */
(function () {
  var cfg = window.COVENANT_CONFIG || {};

  /* ---------------- what each server function is ---------------- */
  var READ = { getUserProfile: 1, getUserEntries: 1, getWorkbookProgress: 1, getMusicPlaylist: 1, getReelsMusic: 1,
    seekFirstGet: 1, altarGet: 1, chatGet: 1, connectInfo: 1, checkEmail: 1, getReelAudio: 1 };
  var WRITE = { saveEntry: 1, saveWorkbookProgress: 1, seekFirstSave: 1, altarSave: 1, updateUserProfile: 1, updateFastType: 1,
    logHelpQuestion: 1, logSongFeedback: 1, addUserSong: 1, chatSend: 1 };
  var AUTH = { loginUser: 1, resumeSession: 1 };
  // last-write-wins saves: only the newest waiting copy needs to be sent
  var COLLAPSE = { saveWorkbookProgress: function (a) { return a[1]; }, seekFirstSave: function (a) { return a[1] + '|' + a[2]; },
    altarSave: function (a) { return a[1] + '|' + a[2]; }, updateUserProfile: function (a) { return a[0]; }, updateFastType: function (a) { return a[0]; } };

  /* ---------------- device storage (IndexedDB, with localStorage fallback) ---------------- */
  var DBN = 'cc-offline', db = null, mem = { cache: {}, outbox: [] }, seq = Date.now();
  function idb() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = function () { var d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); };
        r.onsuccess = function () { db = r.result; res(); };
        r.onerror = r.onblocked = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function kvGet(k) {
    return new Promise(function (res) {
      if (!db) { try { res(JSON.parse(localStorage.getItem('ccoff:' + k) || 'null')); } catch (e) { res(null); } return; }
      try { var q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result === undefined ? null : q.result); }; q.onerror = function () { res(null); }; } catch (e) { res(null); }
    });
  }
  function kvPut(k, v) {
    if (!db) { try { localStorage.setItem('ccoff:' + k, JSON.stringify(v)); } catch (e) {} return; }
    try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) {}
  }
  function saveOutbox() { kvPut('outbox', mem.outbox); emit(); }
  var ready = idb().then(function () { return kvGet('outbox'); }).then(function (o) { mem.outbox = Array.isArray(o) ? o : []; emit(); });

  function isTok(v) { return /^cv_[a-f0-9]{32}$/.test(String(v || '')); }
  function keyOf(fn, args) { return 'r:' + fn + ':' + JSON.stringify(args.filter(function (a) { return !isTok(a); })); }
  function offlineErr(what) { return new Error(what || 'You are offline. This part needs the internet; everything else still works and your saves will upload when you are back online.'); }

  /* ---------------- talking to the server ---------------- */
  function post(fn, clean, ok, fail, netFail) {
    var tries = 0, renewed = false;
    function go() {
      tries++;
      fetch(cfg.API_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request: no CORS preflight
        body: JSON.stringify({ fn: fn, args: clean })
      }).then(function (r) {
        if (!r.ok) throw new Error('Server answered ' + r.status);
        return r.json();
      }).then(function (d) {
        if (d && d.ok) { ok(d.result); }
        else {
          var msg = (d && d.error) || 'Something went wrong';
          // Private session code timed out: quietly sign back in on this device and try once more.
          if (!renewed && /sign in again/i.test(msg) && window.ccRenewSession) {
            renewed = true;
            return window.ccRenewSession(function (tok) {
              if (tok && clean.length && isTok(clean[clean.length - 1])) { clean[clean.length - 1] = tok; tries = 0; return go(); }
              fail(new Error(msg));
            });
          }
          fail(new Error(msg));
        }
      }).catch(function (e) {
        if (tries < 2 && !/Server answered 4/.test(String(e)) && navigator.onLine !== false) return setTimeout(go, 1200); // one retry for flaky phone data
        if (netFail) return netFail(e);
        fail(new Error(navigator.onLine === false ? 'You appear to be offline. Check your connection and try again.' : ('Could not reach Community Covenant (' + (e && e.message || e) + ')')));
      });
    }
    if (navigator.onLine === false && netFail) return netFail(new Error('offline'));
    go();
  }

  /* ---------------- answers shown right away for saves made offline ---------------- */
  function optimistic(fn, a) {
    if (fn === 'saveEntry') return { success: true, offline: true, message: 'Saved on this phone. It will upload when you are back online.' };
    if (fn === 'chatSend') return { success: true, offline: true };
    return { success: true, offline: true, message: 'Saved on this phone' };
  }
  /* waiting saves are shown inside what the app reads, so nothing "disappears" while offline */
  function overlay(fn, args, res) {
    var pend = mem.outbox;
    try {
      if (fn === 'getUserEntries') {
        res = Object.assign({}, res || {}); var list = (res.entries || []).slice();
        pend.forEach(function (p) { if (p.fn !== 'saveEntry' || p.args[1] !== args[1]) return; var ed = p.args[3] || {};
          list.push({ date: new Date(p.at).toISOString(), day: p.args[2], theme: (ed.theme || 'Day ' + p.args[2]) + ' (waiting to upload)', docUrl: '', photoUrl: '' }); });
        res.entries = list; return res;
      }
      if (fn === 'getWorkbookProgress') {
        var w = null; pend.forEach(function (p) { if (p.fn === 'saveWorkbookProgress' && p.args[1] === args[1]) w = p.args[2]; });
        var local = null; try { local = JSON.parse(localStorage.getItem('ccoff:wb:' + args[1]) || 'null'); } catch (e) {}
        if (w) return Object.assign({}, res || {}, { success: true, data: w });
        if (!res && local) return { success: true, data: local };
        return res;
      }
      if (fn === 'seekFirstGet' || fn === 'altarGet') {
        var saver = fn === 'seekFirstGet' ? 'seekFirstSave' : 'altarSave';
        res = Object.assign({ success: true }, res || {}); res.data = Object.assign({}, res.data || {});
        pend.forEach(function (p) { if (p.fn === saver && p.args[1] === args[1]) res.data[p.args[2]] = p.args[3]; });
        return res;
      }
      if (fn === 'getUserProfile') {
        if (!res) return res; res = Object.assign({}, res);
        pend.forEach(function (p) {
          if (p.fn === 'updateUserProfile' && p.args[0] === args[0]) { var a = p.args;
            if (a[2]) res.phone = a[2]; if (a[3]) res.religion = a[3]; if (a[4]) res.fastingPref = a[4]; if (a[5]) res.fastingDuration = a[5];
            if (a[6]) res.activityLevel = a[6]; if (a[7]) res.dailyFocus = a[7]; if (a[8] != null) res.interests = a[8]; }
          if (p.fn === 'updateFastType' && p.args[0] === args[0]) { res.fastingPref = p.args[1]; res.fastingDuration = p.args[2]; }
        });
        return res;
      }
      if (fn === 'chatGet') {
        res = Object.assign({ signedIn: true }, res || {}); var m = (res.messages || []).slice();
        pend.forEach(function (p) { if (p.fn === 'chatSend' && p.args[0] === args[0]) m.push({ from: 'member', at: new Date(p.at).toISOString(), text: p.args[3] + '  (waiting to send)' }); });
        res.messages = m; return res;
      }
    } catch (e) {}
    return res;
  }

  /* ---------------- sign-in that works offline on a phone that has signed in before ---------------- */
  function hash(s) {
    try { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
    catch (e) { return Promise.resolve(''); }
  }
  function authKey(fn, args) { return fn === 'loginUser' ? 'a:login:' + String(args[0] || '').trim().toLowerCase() : 'a:resume:' + String(args[0] || ''); }

  /* ---------------- the call the app makes ---------------- */
  function call(fn, args, ok, fail) {
    var clean = Array.prototype.map.call(args, function (a) { return a === undefined ? null : a; });
    try { if (window.ccBeforeCall) clean = window.ccBeforeCall(fn, clean) || clean; } catch (x) {}
    function done(good, val) { try { if (window.ccCallDone) window.ccCallDone(fn, good, val); } catch (x) {} }
    function good(res) { try { if (window.ccFilterResult) res = window.ccFilterResult(fn, res); } catch (x) {} if (ok) ok(res); done(true, res); }
    function bad(e) { if (fail) fail(e); else console.error(e); done(false, e); }

    ready.then(function () {
      if (WRITE[fn]) {
        if (fn === 'saveWorkbookProgress') { try { localStorage.setItem('ccoff:wb:' + clean[1], JSON.stringify(clean[2])); } catch (e) {} }
        var queue = function () { enqueue(fn, clean); good(optimistic(fn, clean)); if (navigator.onLine !== false) setTimeout(flush, 600); };
        if (mem.outbox.length) return queue(); // keep saves in order behind ones already waiting
        return post(fn, clean, good, bad, queue);
      }
      if (READ[fn]) {
        var k = keyOf(fn, clean);
        var fromDevice = function (e) { kvGet(k).then(function (v) {
          if (v != null || /^(getUserEntries|getWorkbookProgress|seekFirstGet|altarGet|chatGet)$/.test(fn)) { var r = overlay(fn, clean, v); if (r != null) return good(r); }
          bad(offlineErr(fn === 'getReelAudio' ? 'Reading this aloud needs the internet right now.' : null)); }); };
        return post(fn, clean, function (res) { if (fn !== 'getReelAudio' || (res && String(res).length < 400000)) kvPut(k, res); good(overlay(fn, clean, res)); }, bad, fromDevice);
      }
      if (AUTH[fn]) {
        var ak = authKey(fn, clean), secret = fn === 'loginUser' ? String(clean[0] || '').trim().toLowerCase() + '|' + String(clean[1] || '') + '|cc' : '';
        return post(fn, clean, function (res) {
          if (res && res.success) hash(secret).then(function (h) { kvPut(ak, { h: h, res: res, at: Date.now() }); if (res.email) kvPut('a:last', res.email); });
          good(res);
        }, bad, function () {
          kvGet(ak).then(function (v) {
            if (!v || !v.res) return bad(offlineErr(fn === 'loginUser' ? 'You are offline. To use the app offline, sign in once on this phone while you have internet.' : null));
            if (fn === 'resumeSession') return good(v.res);
            hash(secret).then(function (h) { if (h && h === v.h) good(v.res); else good({ success: false, message: 'Offline: that password does not match the one last used on this phone.' }); });
          });
        });
      }
      // everything else (account creation, password reset, AI answers, team desk) needs the internet
      post(fn, clean, good, bad, function () { bad(offlineErr(fn === 'askCovenant' ? 'Scripture answers need the internet. Your question is saved for the team.' : null)); });
    });
  }

  /* ---------------- the waiting list and syncing ---------------- */
  function enqueue(fn, args) {
    var c = COLLAPSE[fn]; if (c) { var id = c(args); mem.outbox = mem.outbox.filter(function (p) { return !(p.fn === fn && COLLAPSE[fn](p.args) === id); }); }
    mem.outbox.push({ id: ++seq, fn: fn, args: args, at: Date.now() }); saveOutbox();
  }
  var syncing = false, lastErr = '';
  function freshToken(args) {
    try { var u = (typeof currentUser !== 'undefined' && currentUser) || null; if (u && u.token && args.length && isTok(args[args.length - 1])) args[args.length - 1] = u.token; } catch (e) {}
    return args;
  }
  function flush() {
    if (syncing || !mem.outbox.length || navigator.onLine === false) return;
    syncing = true; emit();
    (function next() {
      var p = mem.outbox[0];
      if (!p) { syncing = false; emit(true); afterSync(); return; }
      post(p.fn, freshToken(p.args.slice()), function () {
        mem.outbox.shift(); saveOutbox(); next();
      }, function (e) { // the server refused it: keep a record so nothing is silently lost, move on
        lastErr = String(e && e.message || e); var f = mem.outbox.shift(); kvGet('failed').then(function (l) { l = l || []; f.err = lastErr; l.push(f); kvPut('failed', l.slice(-50)); });
        saveOutbox(); next();
      }, function () { syncing = false; emit(); }); // still offline: try again later
    })();
  }
  function afterSync() { try { if (typeof loadLog === 'function') loadLog(); } catch (e) {} }
  window.addEventListener('online', function () { setTimeout(flush, 800); emit(); });
  window.addEventListener('offline', function () { emit(); });
  setInterval(flush, 45000);
  ready.then(function () { setTimeout(flush, 2500); });
  window.ccOffline = { flush: flush, pending: function () { return mem.outbox.length; } };

  /* ---------------- little status bar ---------------- */
  var pill = null, hideT = null;
  function emit(justSynced) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { emit(justSynced); }); return; }
    if (!pill) {
      pill = document.createElement('div'); pill.id = 'ccNet';
      pill.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;padding:7px 14px;border-radius:999px;font:700 13px "Source Sans 3",Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2);display:none;max-width:92vw;text-align:center';
      document.body.appendChild(pill);
    }
    var n = mem.outbox.length, off = navigator.onLine === false; clearTimeout(hideT);
    if (off) { pill.style.background = '#372b4e'; pill.style.color = '#fff'; pill.textContent = 'Offline · everything still works' + (n ? ' · ' + n + ' save' + (n > 1 ? 's' : '') + ' waiting to upload' : ''); pill.style.display = 'block'; return; }
    if (syncing && n) { pill.style.background = '#f1d999'; pill.style.color = '#2a2040'; pill.textContent = 'Back online · uploading ' + n + ' save' + (n > 1 ? 's' : '') + '…'; pill.style.display = 'block'; return; }
    if (justSynced) { pill.style.background = '#eaf3e2'; pill.style.color = '#3f6b2e'; pill.textContent = 'All caught up ✓ your saves are uploaded'; pill.style.display = 'block'; hideT = setTimeout(function () { pill.style.display = 'none'; }, 4000); return; }
    if (n) { pill.style.background = '#f1d999'; pill.style.color = '#2a2040'; pill.textContent = n + ' save' + (n > 1 ? 's' : '') + ' waiting to upload'; pill.style.display = 'block'; return; }
    pill.style.display = 'none';
  }

  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (_, prop) {
        if (prop === 'withSuccessHandler') return function (h) { return runner(h, fail); };
        if (prop === 'withFailureHandler') return function (h) { return runner(ok, h); };
        if (prop === 'withUserObject') return function () { return runner(ok, fail); };
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        return function () { call(prop, arguments, ok, fail); };
      }
    });
  }
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = runner(null, null);
})();
