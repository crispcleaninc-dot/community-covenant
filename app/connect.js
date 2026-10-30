/* Community Covenant — app add-ons for the GitHub version (additive only).
 *  - installable app (home-screen icon, works offline for the shell)
 *  - "How it works" video on the opening screens
 *  - "Chat with the team" button once signed in
 *  - phone notifications (OneSignal) when the team sets it up
 * Nothing here changes how the existing screens work. */
(function () {
  var cfg = window.COVENANT_CONFIG || {};
  var SITE = cfg.SITE_URL || '../';
  var VIDEO = SITE + 'assets/how-it-works.mp4';
  var POSTER = SITE + 'assets/how-it-works-poster.jpg';

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function user() { try { return (typeof currentUser !== 'undefined') ? currentUser : null; } catch (e) { return null; } }

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.cc-vid{display:flex;gap:14px;align-items:center;background:#372b4e;color:#faf6ee;border-radius:14px;padding:14px 16px;margin:0 0 16px;cursor:pointer;box-shadow:0 6px 18px rgba(55,43,78,.18)}' +
    '.cc-vid .pl{flex:0 0 46px;height:46px;border-radius:50%;background:#b8964f;display:flex;align-items:center;justify-content:center}' +
    '.cc-vid .pl:after{content:"";border-left:15px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:4px}' +
    '.cc-vid b{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.25em;display:block}' +
    '.cc-vid span{font-size:.9em;opacity:.85}' +
    '.cc-modal{position:fixed;inset:0;background:rgba(20,15,30,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:14px}' +
    '.cc-modal video{width:100%;max-width:460px;max-height:86vh;border-radius:14px;background:#000}' +
    '.cc-modal .x{position:absolute;top:12px;right:16px;color:#fff;font-size:30px;background:none;border:0;cursor:pointer}' +
    '.cc-fab{position:fixed;left:14px;bottom:16px;z-index:999;background:#372b4e;color:#fff;border:2px solid #b8964f;border-radius:28px;padding:11px 18px;font:600 15px "Source Sans 3",Arial;box-shadow:0 6px 18px rgba(0,0,0,.25);text-decoration:none}' +
    '.cc-install{display:none;margin:0 0 16px;background:#fffdf7;border:1px solid #e7ddc9;border-radius:12px;padding:12px 14px;font-size:.95em;color:#3a3352}' +
    '.cc-install button{background:#b8964f;color:#fff;border:0;border-radius:20px;padding:8px 16px;font-weight:700;margin-left:6px;cursor:pointer}' +
    '.cc-bell{display:none;position:fixed;left:14px;bottom:72px;z-index:999;background:#fffdf7;color:#372b4e;border:1px solid #b8964f;border-radius:28px;padding:10px 16px;font:600 14px "Source Sans 3",Arial;cursor:pointer}';
  document.head.appendChild(css);

  /* ---------- how-it-works video ---------- */
  function openVideo() {
    var m = el('<div class="cc-modal"><button class="x" aria-label="Close">&times;</button><video controls playsinline autoplay poster="' + POSTER + '" src="' + VIDEO + '"></video></div>');
    m.addEventListener('click', function (e) { if (e.target === m || e.target.className === 'x') m.remove(); });
    document.body.appendChild(m);
  }
  window.ccOpenVideo = openVideo;
  var acts = document.querySelector('#ccWelcome .acts');
  if (acts) {
    var wb = el('<button class="ccw-btn glass" type="button">See how the app works</button>');
    wb.onclick = openVideo;
    acts.appendChild(wb);
  }
  ['registerPage', 'loginPage'].forEach(function (id) {
    var p = document.getElementById(id); if (!p) return;
    var card = el('<div class="cc-vid" role="button" tabindex="0"><div class="pl"></div><div><b>See how Community Covenant works</b><span>Signing up, logging in, your daily page, and every feature — about 2 minutes</span></div></div>');
    card.onclick = openVideo; card.onkeydown = function (e) { if (e.key === 'Enter') openVideo(); };
    p.insertBefore(card, p.firstChild);
  });

  /* ---------- Ask for Help: Scripture-backed answers ----------
   * Crisis words still go straight to the app's own care message (988) first.
   * Everything else is answered from Scripture by the server; if that is not
   * available, the app's original glossary + "sent to the team" path runs. */
  if (typeof window.askForHelp === 'function') {
    var origAsk = window.askForHelp;
    var escH = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    window.askForHelp = function () {
      var inp = document.getElementById('askInput'), out = document.getElementById('askAnswer');
      var q = (inp && inp.value || '').trim(); if (!q) return;
      var low = q.toLowerCase();
      var terms = (typeof CRISIS_TERMS !== 'undefined') ? CRISIS_TERMS : [];
      for (var i = 0; i < terms.length; i++) if (low.indexOf(terms[i]) !== -1) return origAsk();
      var u = user();
      out.className = 'msg ok'; out.style.display = 'block';
      out.innerHTML = '<em>Searching the Scriptures for you…</em>';
      google.script.run.withSuccessHandler(function (r) {
        if (r && r.crisis) {
          out.className = 'msg ok';
          out.innerHTML = '<strong>You matter, and you don\u2019t have to carry this alone.</strong><br><br>' +
            'If you are thinking about hurting yourself, please reach out right now:<br>' +
            '\u2022 Call or text <strong>988</strong> \u2014 the Suicide &amp; Crisis Lifeline (24/7, free, confidential)<br>' +
            '\u2022 Or text <strong>HOME</strong> to <strong>741741</strong> \u2014 the Crisis Text Line<br><br>' +
            'Please tell someone close to you, too. Someone from our team will check in with you.<br><br>' +
            '<em>\u201CThe LORD is nigh unto them that are of a broken heart.\u201D \u2014 Psalm 34:18</em>';
          try { logQuestion(q, 'CRISIS'); } catch (e) {}
          return;
        }
        if (!r || !r.success) return origAsk();
        out.className = 'msg ok';
        out.innerHTML = (r.answer || []).map(function (p) { return '<p style="margin:0 0 10px">' + escH(p) + '</p>'; }).join('') +
          ((r.scriptures || []).length ? '<div style="border-left:3px solid #b8964f;padding-left:12px;margin:10px 0">' + r.scriptures.map(function (s) {
            return '<p style="margin:6px 0"><a class="link" target="_blank" rel="noopener" href="https://www.biblegateway.com/passage/?search=' + encodeURIComponent(s.ref) + '&version=KJV"><b>' + escH(s.ref) + '</b></a> &mdash; <i>' + escH(s.text) + '</i></p>';
          }).join('') + '</div>' : '') +
          (r.next_step ? '<p style="margin:8px 0"><b>Next step:</b> ' + escH(r.next_step) + '</p>' : '') +
          '<p style="margin:8px 0 0;font-size:.92em">Want to talk it through with a person? <a class="link" href="' + SITE + 'chat.html">Chat with the team</a>' +
          (r.follow_up ? ' &mdash; we let the team know, too.' : '') + '</p>';
      }).withFailureHandler(function () { origAsk(); })
        .askCovenant(q, u ? u.email : '', u ? u.name : '', u ? u.userId : '', (u && u.token) || '');
    };
  }

  /* ---------- Speak instead of type: a mic on every writing box ----------
   * Works in Chrome (Android, computer), Safari (iPhone/iPad) and Edge.
   * Where the browser can't listen (e.g. some in-app browsers), the mic
   * reminds them they can tap the microphone on their phone keyboard. */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var micCss = document.createElement('style');
  micCss.textContent =
    '.cc-micwrap{position:relative;display:block}' +
    '.cc-mic{position:absolute;right:8px;bottom:8px;width:38px;height:38px;border-radius:50%;border:1px solid #e7ddc9;background:#fffdf7;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;box-shadow:0 2px 6px rgba(55,43,78,.12);padding:0}' +
    '.cc-mic svg{width:18px;height:18px;fill:#372b4e}' +
    '.cc-mic.on{background:#b3532f;border-color:#b3532f;animation:ccPulse 1.2s infinite}' +
    '.cc-mic.on svg{fill:#fff}' +
    '@keyframes ccPulse{0%{box-shadow:0 0 0 0 rgba(179,83,47,.5)}100%{box-shadow:0 0 0 12px rgba(179,83,47,0)}}' +
    '.cc-micwrap textarea{padding-right:52px !important}.cc-micwrap input{padding-right:52px !important}' +
    '.cc-mictip{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#372b4e;color:#fff;padding:10px 16px;border-radius:20px;font:600 14px "Source Sans 3",Arial;z-index:10000;max-width:90vw;text-align:center}';
  document.head.appendChild(micCss);
  var MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
  function micTip(msg) {
    var t = el('<div class="cc-mictip"></div>'); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }
  var active = null;
  function stopActive() { if (active) { try { active.rec.stop(); } catch (e) {} } }
  function listen(field, btn) {
    if (!SR) { field.focus(); micTip('Tap the microphone on your keyboard to speak instead of typing.'); return; }
    if (active && active.btn === btn) { stopActive(); return; }
    stopActive();
    var rec = new SR(), base = field.value, finalText = '';
    rec.lang = navigator.language || 'en-US'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
      }
      var said = (finalText + interim).trim();
      if (said) said = said.charAt(0).toUpperCase() + said.slice(1);
      field.value = (base ? base.replace(/\s*$/, ' ') : '') + said;
      field.dispatchEvent(new Event('input', { bubbles: true })); // auto-save in Workbook / Seek First / Altar still fires
    };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') micTip('Allow the microphone for this site, or tap the mic on your keyboard.');
      else if (e.error === 'no-speech') micTip('I didn’t hear anything — tap the mic and try again.');
    };
    rec.onend = function () {
      btn.classList.remove('on'); btn.setAttribute('aria-label', 'Speak instead of typing');
      field.dispatchEvent(new Event('change', { bubbles: true }));
      if (active && active.rec === rec) active = null;
    };
    try { rec.start(); } catch (e) { micTip('Tap the microphone on your keyboard to speak instead of typing.'); return; }
    active = { rec: rec, btn: btn };
    btn.classList.add('on'); btn.setAttribute('aria-label', 'Stop listening');
  }
  function addMic(field) {
    if (field.__ccMic || field.closest('.cc-micwrap') || field.closest('#ccWelcome')) return;
    if (field.tagName === 'INPUT' && !/^(text|search|)$/i.test(field.getAttribute('type') || '')) return;
    var cws = getComputedStyle(field).width, cw = /px$/.test(cws) && !field.offsetWidth ? parseFloat(cws) : NaN;
    if ((field.offsetWidth && field.offsetWidth < 140) || (!isNaN(cw) && cw > 0 && cw < 140)) return; // tiny inputs (numbers, codes)
    field.__ccMic = true;
    var wrap = document.createElement('span'); wrap.className = 'cc-micwrap';
    var pd = getComputedStyle(field.parentNode).display;
    if (/flex|grid/.test(pd)) { wrap.style.flex = getComputedStyle(field).flex || '1 1 auto'; wrap.style.minWidth = '0'; }
    if (field.style.marginTop) { wrap.style.marginTop = field.style.marginTop; }
    field.parentNode.insertBefore(wrap, field); wrap.appendChild(field);
    var b = el('<button type="button" class="cc-mic" aria-label="Speak instead of typing" title="Speak instead of typing">' + MIC_SVG + '</button>');
    if (field.tagName === 'INPUT') { b.style.bottom = '50%'; b.style.transform = 'translateY(50%)'; b.style.width = b.style.height = '32px'; }
    b.addEventListener('click', function (e) { e.preventDefault(); listen(field, b); });
    wrap.appendChild(b);
  }
  function scanMics(root) { (root || document).querySelectorAll('textarea, input[type=text], input:not([type])').forEach(addMic); }
  scanMics();
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (/^(TEXTAREA|INPUT)$/.test(n.tagName)) addMic(n); else if (n.querySelectorAll) scanMics(n); } }); });
  }).observe(document.body, { childList: true, subtree: true });
  window.ccAddMics = scanMics;


  /* ---------- Music choice: gospel only, or include secular songs ----------
   * A song counts as secular when its Advisory column in the playlist sheet
   * says Secular / Explicit / Mature (e.g. "Help Me" by Real Boston Richey).
   * Default is gospel only; each member can choose to include them. */
  var MF_KEY = 'cc_music_filter', FLAG_KEY = 'cc_flagged_songs';
  function mfGet() { try { return localStorage.getItem(MF_KEY) || 'gospel'; } catch (e) { return 'gospel'; } }
  function mfSet(v) { try { localStorage.setItem(MF_KEY, v); } catch (e) {} }
  function vidOf(u) { var m = String(u || '').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; }
  var flagged = {}; try { flagged = JSON.parse(localStorage.getItem(FLAG_KEY) || '{}') || {}; } catch (e) {}
  flagged['lPNdPQRcMnU'] = 1; // Help Me — Real Boston Richey (pre-marked)
  /* Same-day replies, right away: after a seal (or after you stop typing in another tab) the server answers now. */
  var replyTimer = null;
  function askReplyNow(delay) {
    clearTimeout(replyTimer);
    replyTimer = setTimeout(function () {
      var u = user(); if (!u || !u.token) return;
      google.script.run.withFailureHandler(function () {}).withSuccessHandler(function () {}).replyNow(u.email, u.token);
    }, delay);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && replyTimer) askReplyNow(0); });
  window.ccFilterResult = function (fn, res) {
    if (fn === 'saveEntry' && res && res.success) {
      askReplyNow(1500);
      setTimeout(function () { var b = document.getElementById('savedBar'); if (b && !/reply is on its way/.test(b.innerHTML)) b.innerHTML += '<br><span style="font-size:.92em">Our reply is on its way to your email in the next few minutes.</span>'; }, 300);
    }
    if ((fn === 'seekFirstSave' || fn === 'altarSave' || fn === 'saveWorkbookProgress') && res && res.success !== false) askReplyNow(90000);
    if ((fn !== 'getReelsMusic' && fn !== 'getMusicPlaylist') || !Array.isArray(res)) return res;
    if (fn === 'getReelsMusic') {
      res.forEach(function (s) { if (s && s.advisory) flagged[vidOf(s.youtubeLink)] = 1; });
      try { localStorage.setItem(FLAG_KEY, JSON.stringify(flagged)); } catch (e) {}
    }
    if (mfGet() === 'all') return res;
    return res.filter(function (s) { return !(s && (s.advisory || flagged[vidOf(s.youtubeLink)])); });
  };
  // learn the latest advisory marks once per visit, so the Music tab filters the same songs
  try { google.script.run.withFailureHandler(function () {}).withSuccessHandler(function () {}).getReelsMusic(); } catch (e) {}
  function mfBox() {
    var cur = mfGet();
    var b = el('<div class="cc-mf" style="background:#fffdf7;border:1px solid #e7ddc9;border-radius:12px;padding:12px 14px;margin:0 0 14px">' +
      '<b style="color:#372b4e">Music choice</b><div style="font-size:.92em;color:#6b6280;margin:2px 0 8px">Some songs on our list are secular — their message helps some believers, but not everyone wants them. You choose.</div>' +
      '<label style="display:block;margin:4px 0;font-weight:400"><input type="radio" name="ccmf' + Math.random().toString(36).slice(2, 6) + '" value="gospel"' + (cur !== 'all' ? ' checked' : '') + '> Gospel &amp; worship only</label>' +
      '<label style="display:block;margin:4px 0;font-weight:400"><input type="radio" value="all"' + (cur === 'all' ? ' checked' : '') + '> Include secular songs (marked with a note)</label>' +
      '<div class="cc-mfmsg" style="font-size:.88em;color:#3f6b2e;display:none;margin-top:6px"></div></div>');
    var radios = b.querySelectorAll('input'); radios[1].name = radios[0].name;
    radios.forEach(function (r) {
      r.addEventListener('change', function () {
        mfSet(r.value);
        document.querySelectorAll('.cc-mf input').forEach(function (o) { o.checked = (o.value === r.value); });
        var m = b.querySelector('.cc-mfmsg'); m.style.display = 'block';
        m.textContent = r.value === 'all' ? 'Saved. Secular songs are included, with a note on each.' : 'Saved. Only gospel & worship songs will play.';
        try { if (typeof loadMusic === 'function') loadMusic(); } catch (e) {}
      });
    });
    return b;
  }
  var mv = document.querySelector('#musicView .card'); if (mv) mv.insertBefore(mfBox(), mv.children[1] || null);
  var sv = document.querySelector('#settingsView'); if (sv) { var c = el('<div class="card"><h3>Music</h3></div>'); c.appendChild(mfBox()); sv.appendChild(c); }
  // a small switch inside the gospel radio / Wisdom Reels player too
  new MutationObserver(function () {
    var reels = document.getElementById('ccReels');
    if (reels && !reels.querySelector('.cc-mfchip')) {
      var chip = el('<button type="button" class="cc-mfchip" style="position:absolute;left:14px;bottom:118px;z-index:5;background:rgba(29,22,48,.75);color:#f1d999;border:1px solid rgba(241,217,153,.5);border-radius:16px;padding:6px 12px;font:700 12px \'Source Sans 3\',Arial"></button>');
      var paint = function () { chip.textContent = mfGet() === 'all' ? 'Music: all songs ▾' : 'Music: gospel only ▾'; };
      paint();
      chip.onclick = function (e) { e.stopPropagation(); mfSet(mfGet() === 'all' ? 'gospel' : 'all'); paint(); micTip(mfGet() === 'all' ? 'Secular songs included from the next song list.' : 'Gospel & worship only.'); };
      reels.appendChild(chip);
    }
  }).observe(document.body, { childList: true, subtree: true });

  /* ---------- install the app ---------- */
  var deferred = null;
  var inst = el('<div class="cc-install"></div>');
  var reg = document.getElementById('registerPage') || document.getElementById('loginPage');
  if (reg) reg.insertBefore(inst, reg.children[1] || null);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var inFB = /FBAN|FBAV|Instagram/i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    inst.innerHTML = '<b>Put Community Covenant on your home screen</b> — opens like an app, with reminders. <button type="button">Install</button>';
    inst.style.display = 'block';
    inst.querySelector('button').onclick = function () { deferred.prompt(); deferred.userChoice.then(function () { inst.style.display = 'none'; }); };
  });
  if (!standalone && isIOS && !inFB) {
    inst.innerHTML = '<b>Add to your home screen:</b> tap the Share button <span style="font-size:1.2em">⬆︎</span> at the bottom of Safari, then <b>Add to Home Screen</b>.';
    inst.style.display = 'block';
  }
  if (inFB) {
    inst.innerHTML = '<b>Opened from Facebook?</b> Everything works here. To install it on your phone, tap the <b>⋯</b> menu and choose <b>Open in browser</b>.';
    inst.style.display = 'block';
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register(SITE + 'sw.js', { scope: SITE }).catch(function () {});
  }

  /* ---------- chat button + identity for the chat page ---------- */
  var fab = el('<a class="cc-fab" href="' + SITE + 'chat.html" style="display:none">Chat with the team</a>');
  document.body.appendChild(fab);
  var bell = el('<button class="cc-bell" type="button">Turn on reminders</button>');
  document.body.appendChild(bell);
  var lastId = '';
  setInterval(function () {
    var u = user();
    fab.style.display = u ? 'block' : 'none';
    var id = u ? (u.userId + '|' + u.token) : '';
    if (id === lastId) return; lastId = id;
    try {
      if (u) localStorage.setItem('cc_identity', JSON.stringify({ email: u.email, name: u.name, userId: u.userId, token: u.token, at: Date.now() }));
      else localStorage.removeItem('cc_identity');
    } catch (e) {}
    if (u) pushLogin(u); else pushLogout();
  }, 1500);

  /* ---------- phone notifications (OneSignal) ---------- */
  var pushReady = null;
  function loadPush(appId) {
    if (pushReady || !appId) return pushReady;
    pushReady = new Promise(function (resolve) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      var s = document.createElement('script'); s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer = true;
      document.head.appendChild(s);
      window.OneSignalDeferred.push(function (OneSignal) {
        OneSignal.init({ appId: appId, serviceWorkerPath: SITE.replace(location.origin, '') + 'sw.js', serviceWorkerParam: { scope: SITE.replace(location.origin, '') }, notifyButton: { enable: false } })
          .then(function () { resolve(OneSignal); }).catch(function () { resolve(null); });
      });
    });
    return pushReady;
  }
  function getAppId(cb) {
    if (cfg.ONESIGNAL_APP_ID) return cb(cfg.ONESIGNAL_APP_ID);
    google.script.run.withSuccessHandler(function (r) { cb(r && r.onesignalAppId); }).withFailureHandler(function () { cb(''); }).connectInfo();
  }
  function pushLogin(u) {
    getAppId(function (appId) {
      var p = loadPush(appId); if (!p) return;
      p.then(function (OS) {
        if (!OS) return;
        try { OS.login(String(u.userId)); OS.User.addTag('email', String(u.email || '')); } catch (e) {}
        var on = false; try { on = OS.Notifications.permission; } catch (e) {}
        if (!on && OS.Notifications.isPushSupported()) {
          bell.style.display = 'block';
          bell.onclick = function () { OS.Notifications.requestPermission().then(function () { bell.style.display = 'none'; }); };
        }
      });
    });
  }
  function pushLogout() { bell.style.display = 'none'; if (pushReady) pushReady.then(function (OS) { try { OS && OS.logout(); } catch (e) {} }); }
})();
