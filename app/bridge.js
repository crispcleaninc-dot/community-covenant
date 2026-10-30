/* Community Covenant — GitHub bridge.
 * The app was written for Google Apps Script, which provides google.script.run.
 * This file provides the same thing on GitHub: every call is sent to the
 * Apps Script server (doPost) and the answer comes back to the same
 * success / failure handlers. Nothing else in the app had to change. */
(function () {
  var cfg = window.COVENANT_CONFIG || {};
  function call(fn, args, ok, fail) {
    var clean = Array.prototype.map.call(args, function (a) { return a === undefined ? null : a; });
    try { if (window.ccBeforeCall) clean = window.ccBeforeCall(fn, clean) || clean; } catch (x) {}
    var tries = 0, renewed = false;
    function done(good, val) { try { if (window.ccCallDone) window.ccCallDone(fn, good, val); } catch (x) {} }
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
        if (d && d.ok) { var res = d.result; try { if (window.ccFilterResult) res = window.ccFilterResult(fn, res); } catch (x) {} if (ok) ok(res); done(true, res); }
        else {
          var msg = (d && d.error) || 'Something went wrong';
          // Private session code timed out: quietly sign back in on this device and try once more.
          if (!renewed && /sign in again/i.test(msg) && window.ccRenewSession) {
            renewed = true;
            return window.ccRenewSession(function (tok) {
              if (tok && clean.length && /^cv_[a-f0-9]{32}$/.test(String(clean[clean.length - 1]))) { clean[clean.length - 1] = tok; tries = 0; return go(); }
              var e0 = new Error(msg); if (fail) fail(e0); else console.error(e0); done(false, e0);
            });
          }
          var e = new Error(msg); if (fail) fail(e); else console.error(e); done(false, e);
        }
      }).catch(function (e) {
        if (tries < 2 && !/Server answered 4/.test(String(e))) return setTimeout(go, 1200); // one retry for flaky phone data
        var err = new Error(navigator.onLine === false ? 'You appear to be offline. Check your connection and try again.' : ('Could not reach Community Covenant (' + (e && e.message || e) + ')'));
        if (fail) fail(err); else console.error(err); done(false, err);
      });
    }
    go();
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
