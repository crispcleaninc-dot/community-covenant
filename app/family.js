/* Community Covenant — Family (Nov 20 2026). Additive only: nothing existing is changed.
 *  - A family code links relatives. Start a family (faith or everyday wording) or join with a code.
 *  - The only extra step anywhere: "Share with my family" on the green bar after sealing a day,
 *    plus a "Share a testimony" box on the Family screen. Nothing is shared automatically.
 *  - Family screen: everyone's day and streak, a family streak, this week's family walk goal,
 *    a feed with cheers, a map of shared walks (area only, about 1 km), and a Testimonies tab.
 *  - Everyday mode: same feature with no Scripture or church wording, for families who don't believe.
 * Server: server/CovenantFamily.gs (famCreate, famJoin, famLeave, famHome, famShare, famReact). */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function user() { try { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null; } catch (e) { return null; } }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function run(fn, args, ok, fail) {
    var r = google.script.run.withSuccessHandler(ok || function () {}).withFailureHandler(fail || function (e) { toast('No connection right now. Try again in a moment.'); });
    r[fn].apply(r, args);
  }
  var S = { home: null, tab: 'feed', timer: null, map: null };

  /* ---------- wording: faith vs everyday ---------- */
  var W = {
    faith: { testimony: 'Testimony', testimonies: 'Testimonies', shareT: 'Share a testimony', prompt: 'What did God do? Big or small, tell your family.',
      cheers: [['amen', '🙌', 'Amen'], ['pray', '🙏', 'Praying'], ['heart', '❤️', 'Love'], ['fire', '🔥', 'Go!']], streak: 'family covenant streak',
      empty: 'Be the first to share today. Your family is cheering for you.', badge: { 7: 'One week strong', 21: 'Habit built (21 days)', 30: 'Covenant kept' },
      quick: ['Praying for you today', 'Keep pushing one more day', 'God is not done with you', 'So proud of you'] },
    everyday: { testimony: 'Story', testimonies: 'Stories', shareT: 'Share a story', prompt: 'What went well today? Big or small, tell your family.',
      cheers: [['clap', '👏', 'Cheer'], ['heart', '❤️', 'Love'], ['fire', '🔥', 'Go!'], ['amen', '🙌', 'Yes!']], streak: 'family streak',
      empty: 'Be the first to share today. Your family is cheering for you.', badge: { 7: 'One week strong', 21: 'Habit built (21 days)', 30: '30 days done' },
      quick: ['Thinking of you today', 'Keep going one more day', 'You have got this', 'So proud of you'] }
  };
  function w() { return W[(S.home && S.home.family && S.home.family.mode) === 'everyday' ? 'everyday' : 'faith']; }

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#familyView .fam-card{background:#fff;border-radius:18px;padding:16px;margin:0 0 14px;box-shadow:0 2px 10px rgba(55,43,78,.08)}' +
    '#familyView h2{font-family:"Cormorant Garamond",Georgia,serif;color:#372b4e;margin:0 0 4px;font-size:1.7em}' +
    '#familyView .muted{color:#6b6280;font-size:.92em}' +
    '#familyView .fam-btn{border:0;border-radius:999px;padding:11px 16px;font:700 .95em "Source Sans 3",Arial;cursor:pointer;background:linear-gradient(135deg,#5b2a6e,#372b4e);color:#fff}' +
    '#familyView .fam-btn.gold{background:linear-gradient(135deg,#f1d999,#c9a961);color:#2a2040}' +
    '#familyView .fam-btn.ghost{background:#f3eef8;color:#372b4e}' +
    '#familyView input,#familyView textarea{width:100%;box-sizing:border-box;border:1px solid #ddd2ea;border-radius:12px;padding:11px;font:1em "Source Sans 3",Arial;margin:6px 0}' +
    '#familyView .hero{background:linear-gradient(135deg,#372b4e,#6b3b7e);color:#fff;border-radius:20px;padding:18px;margin-bottom:14px;position:relative;overflow:hidden}' +
    '#familyView .hero h2{color:#fff}#familyView .hero .code{display:inline-block;background:rgba(255,255,255,.16);border:1px dashed #f1d999;border-radius:10px;padding:4px 10px;font-weight:700;letter-spacing:1px;margin-top:6px}' +
    '#familyView .flame{font-size:2.4em;line-height:1}#familyView .streak{display:flex;gap:12px;align-items:center;margin-top:12px}' +
    '#familyView .people{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px}' +
    '#familyView .pp{flex:0 0 auto;text-align:center;width:74px}#familyView .pp .av{width:58px;height:58px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font:700 1.3em Georgia;color:#fff;position:relative}' +
    '#familyView .pp .av i{position:absolute;right:-2px;bottom:-2px;background:#2e8b57;color:#fff;border-radius:50%;width:20px;height:20px;font:700 12px Arial;display:flex;align-items:center;justify-content:center;font-style:normal}' +
    '#familyView .pp small{display:block;color:#6b6280}' +
    '#familyView .bar{height:12px;background:#efe8f6;border-radius:99px;overflow:hidden;margin-top:6px}#familyView .bar b{display:block;height:100%;background:linear-gradient(90deg,#c9a961,#f1d999);border-radius:99px;transition:width .8s}' +
    '#familyView .tabs{display:flex;gap:6px;margin:4px 0 12px}#familyView .tabs button{flex:1;border:0;border-radius:999px;padding:9px;font:700 .9em Arial;background:#f3eef8;color:#372b4e;cursor:pointer}#familyView .tabs button.on{background:#372b4e;color:#fff}' +
    '#familyView .post{background:#fff;border-radius:18px;padding:14px;margin-bottom:12px;box-shadow:0 2px 10px rgba(55,43,78,.07)}' +
    '#familyView .post .who{display:flex;gap:10px;align-items:center;margin-bottom:8px}#familyView .post .who .av{width:38px;height:38px;border-radius:50%;color:#fff;font:700 1em Georgia;display:flex;align-items:center;justify-content:center}' +
    '#familyView .post .tag{display:inline-block;background:#f6efdc;color:#7a5a17;border-radius:99px;padding:2px 10px;font-size:.8em;font-weight:700;margin-right:6px}' +
    '#familyView .post img{width:100%;border-radius:12px;margin-top:8px}#familyView .post .txt{white-space:pre-wrap;line-height:1.45;color:#2a2040}' +
    '#familyView .cheers{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}#familyView .cheers button{border:1px solid #e6dcef;background:#fff;border-radius:99px;padding:6px 10px;font-size:.95em;cursor:pointer}' +
    '#familyView .cheers button.on{background:#372b4e;color:#fff;border-color:#372b4e;transform:scale(1.05)}' +
    '#familyView #famMap{height:340px;border-radius:16px;overflow:hidden}' +
    '.fam-share-btn{display:inline-block;margin-top:8px;border:0;border-radius:999px;padding:10px 16px;font:700 .95em "Source Sans 3",Arial;cursor:pointer;background:linear-gradient(135deg,#f1d999,#c9a961);color:#2a2040}' +
    '.fam-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#372b4e;color:#fff;padding:12px 18px;border-radius:14px;z-index:99999;font:600 .95em Arial;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
    '.fam-dot{display:inline-block;min-width:18px;height:18px;border-radius:9px;background:#d9534f;color:#fff;font:700 11px/18px Arial;text-align:center;margin-left:4px;padding:0 4px}' +
    '.fam-conf{position:fixed;top:-10px;font-size:22px;z-index:99999;pointer-events:none;animation:famfall 1.6s ease-in forwards}@keyframes famfall{to{transform:translateY(105vh) rotate(540deg);opacity:.2}}';
  document.head.appendChild(css);

  function toast(t) { var d = document.createElement('div'); d.className = 'fam-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600); }
  function confetti(n) { var e = ['✨', '🎉', '💛', '🌟', '🔥']; for (var i = 0; i < (n || 18); i++) { var s = document.createElement('div'); s.className = 'fam-conf'; s.textContent = e[i % e.length]; s.style.left = Math.random() * 100 + 'vw'; s.style.animationDelay = (Math.random() * .5) + 's'; document.body.appendChild(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 2300); } }
  var COLORS = ['#7b3f8c', '#c26a2e', '#2e7d6b', '#3f5fa8', '#a83f5f', '#6b6b2e', '#2e6b8c'];
  function color(name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length]; }
  function ago(t) { var s = (Date.now() - t) / 1000; if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago'; }
  function today(t) { return new Date(t).toDateString() === new Date().toDateString(); }

  /* ---------- nav button + view ---------- */
  var btn, view;
  function mount() {
    var nav = document.querySelector('#appPage .nav'); if (!nav || btn) return;
    btn = document.createElement('button'); btn.innerHTML = 'Family<span class="fam-dot" style="display:none"></span>';
    btn.onclick = function () { showView('familyView', btn); open(); };
    nav.insertBefore(btn, nav.children[1] || null);
    view = document.createElement('div'); view.id = 'familyView'; view.className = 'view';
    var day = document.getElementById('dayView'); day.parentNode.insertBefore(view, day.nextSibling);
    watchSeal(); setTimeout(checkNew, 4000); setInterval(checkNew, 5 * 60000);
  }
  function setDot(n) { var d = btn && btn.querySelector('.fam-dot'); if (!d) return; d.style.display = n ? 'inline-block' : 'none'; d.textContent = n > 9 ? '9+' : n; }
  function checkNew() {
    var u = user(); if (!u || !navigator.onLine) return;
    run('famHome', [u.email, u.token], function (r) {
      if (!r || !r.family) return; S.home = r;
      var seen = +store('cc-fam-seen') || 0; setDot(r.feed.filter(function (p) { return !p.me && p.when > seen; }).length);
    }, function () {});
  }

  function open() {
    var u = user(); if (!u) { view.innerHTML = '<div class="fam-card">Sign in to see your family.</div>'; return; }
    if (!S.home) view.innerHTML = '<div class="fam-card muted">Loading your family…</div>'; else render();
    load();
    clearInterval(S.timer); S.timer = setInterval(function () { if (view.classList.contains('active')) load(true); else clearInterval(S.timer); }, 60000);
  }
  function load(quiet) {
    var u = user(); if (!u) return;
    run('famHome', [u.email, u.token], function (r) {
      if (!r || r.success === false) { view.innerHTML = '<div class="fam-card">' + esc((r && r.message) || 'Could not load your family.') + '</div>'; return; }
      var before = S.home && S.home.feed ? S.home.feed.length : -1;
      S.home = r; render(); store('cc-fam-seen', String(Date.now())); setDot(0);
      if (quiet && before >= 0 && r.feed && r.feed.length > before) toast('New from your family');
    }, quiet ? function () {} : undefined);
  }

  /* ---------- no family yet ---------- */
  function renderStart() {
    view.innerHTML =
      '<div class="hero"><h2>Walk this together</h2><div>Link your family with one code. See each other\'s days, walks and wins, and cheer each other on.</div></div>' +
      '<div class="fam-card"><b>Start a family</b><input id="famName" placeholder="Family name (e.g. The Johnson Family)">' +
      '<div class="muted" style="margin:6px 0">How should your family page talk?</div>' +
      '<label style="display:block;margin:4px 0"><input type="radio" name="famMode" value="faith" checked style="width:auto"> Faith: Scripture, prayer and testimonies</label>' +
      '<label style="display:block;margin:4px 0 10px"><input type="radio" name="famMode" value="everyday" style="width:auto"> Everyday: same thing with no religious wording</label>' +
      '<button class="fam-btn" id="famCreate">Start our family</button></div>' +
      '<div class="fam-card"><b>Join with a family code</b><input id="famCode" placeholder="FAM-XXXXX" style="text-transform:uppercase"><button class="fam-btn gold" id="famJoin">Join my family</button></div>';
    view.querySelector('#famCreate').onclick = function () {
      var u = user(), mode = (view.querySelector('input[name=famMode]:checked') || {}).value || 'faith';
      this.disabled = true;
      run('famCreate', [u.email, view.querySelector('#famName').value, mode, u.token], function (r) {
        if (r && r.success) { confetti(); toast('Your family code is ' + r.code); load(); } else toast((r && r.message) || 'Try again.');
      });
    };
    view.querySelector('#famJoin').onclick = function () {
      var u = user(), c = view.querySelector('#famCode').value; if (!c) return toast('Type the family code first.');
      run('famJoin', [u.email, c, u.token], function (r) { if (r && r.success) { confetti(); toast('Welcome to ' + r.name + '!'); load(); } else toast((r && r.message) || 'Try again.'); });
    };
  }

  /* ---------- the family page ---------- */
  function render() {
    var h = S.home; if (!h || !h.family) return renderStart();
    var L = w(), f = h.family, mem = h.members || [], feed = h.feed || [];
    var weekAgo = Date.now() - 7 * 864e5, walks = feed.filter(function (p) { return p.when > weekAgo && (p.type === 'walk' || (p.bits && p.bits.walk)); }).length;
    var goal = Math.max(5, mem.length * 5), pct = Math.min(100, Math.round(walks / goal * 100));
    var sharedToday = {}; feed.forEach(function (p) { if (today(p.when)) sharedToday[p.name] = 1; });
    var people = mem.slice().sort(function (a, b) { return b.day - a.day; }).map(function (m) {
      return '<div class="pp"><div class="av" style="background:' + color(m.name) + '">' + esc(m.name.charAt(0)) + (sharedToday[m.name] ? '<i>✓</i>' : '') + '</div><b style="font-size:.9em">' + esc(m.name) + (m.me ? ' (you)' : '') + '</b>' +
        '<small>' + (m.day ? 'Day ' + m.day + ' of ' + m.of : 'Starting') + '</small></div>';
    }).join('');
    var badge = ''; [30, 21, 7].some(function (n) { if (h.familyStreak >= n) { badge = '🏅 ' + L.badge[n]; return true; } return false; });
    var html =
      '<div class="hero"><h2>' + esc(f.name) + '</h2><div class="muted" style="color:#e8dcf0">' + mem.length + ' member' + (mem.length === 1 ? '' : 's') + ' · ' + (f.mode === 'everyday' ? 'Everyday' : 'Faith') + ' page</div>' +
      '<span class="code">' + esc(f.code) + '</span> <button class="fam-btn gold" id="famInvite" style="padding:7px 12px;margin-left:6px">Invite family</button>' +
      '<div class="streak"><span class="flame">' + (h.familyStreak ? '🔥' : '🕯️') + '</span><div><b style="font-size:1.4em">' + h.familyStreak + ' day' + (h.familyStreak === 1 ? '' : 's') + '</b><div style="font-size:.9em">' + L.streak + (badge ? ' · ' + badge : '') + '</div></div></div></div>' +
      '<div class="fam-card"><b>Who showed up today</b><div class="people">' + people + '</div>' +
      '<div style="margin-top:6px"><b>This week\'s family walks:</b> ' + walks + ' of ' + goal + '<div class="bar"><b style="width:' + pct + '%"></b></div></div></div>' +
      '<div class="tabs"><button data-t="feed" class="' + (S.tab === 'feed' ? 'on' : '') + '">Feed</button><button data-t="map" class="' + (S.tab === 'map' ? 'on' : '') + '">Map</button><button data-t="testi" class="' + (S.tab === 'testi' ? 'on' : '') + '">' + L.testimonies + '</button></div>' +
      '<div id="famTab"></div>' +
      '<div style="text-align:center;margin:18px 0"><button class="fam-btn ghost" id="famLeave">Leave this family</button></div>';
    view.innerHTML = html;
    view.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { S.tab = b.getAttribute('data-t'); render(); }; });
    view.querySelector('#famInvite').onclick = function () { invite(f); };
    view.querySelector('#famLeave').onclick = function () {
      if (!confirmLeave()) return; var u = user(); run('famLeave', [u.email, u.token], function () { S.home = null; load(); });
    };
    var tab = view.querySelector('#famTab');
    if (S.tab === 'map') return renderMap(tab, feed);
    if (S.tab === 'testi') return renderFeed(tab, feed.filter(function (p) { return p.type === 'testimony'; }), true);
    renderFeed(tab, feed, false);
  }
  function confirmLeave() { var b = view.querySelector('#famLeave'); if (b.dataset.sure) return true; b.dataset.sure = 1; b.textContent = 'Tap again to leave'; setTimeout(function () { if (b) { b.textContent = 'Leave this family'; delete b.dataset.sure; } }, 4000); return false; }

  function invite(f) {
    var link = (location.origin + location.pathname).replace(/index\.html$/, '');
    var msg = 'Join our family on Community Covenant so we can cheer each other on. Open ' + link + ' , sign in, tap Family and enter the code ' + f.code + '.';
    if (navigator.share) navigator.share({ title: 'Join ' + f.name, text: msg }).catch(function () {});
    else { try { navigator.clipboard.writeText(msg); toast('Invite copied. Paste it in a text.'); } catch (e) { prompt('Copy this invite:', msg); } }
  }

  function composer() {
    var L = w();
    return '<div class="fam-card"><b>' + L.shareT + '</b><div class="muted">' + L.prompt + '</div><textarea id="famT" rows="3"></textarea>' +
      '<button class="fam-btn" id="famPost">Share with my family</button></div>';
  }
  function renderFeed(tab, list, testiOnly) {
    var L = w();
    var html = composer();
    if (!list.length) html += '<div class="fam-card muted">' + L.empty + '</div>';
    list.forEach(function (p) {
      var head = p.type === 'testimony' ? L.testimony : p.type === 'walk' ? 'Walk' : p.type === 'altar' ? (L === W.faith ? 'Daily Altar' : 'Quiet time') : p.type === 'milestone' ? 'Milestone' : 'Day ' + (p.day || '');
      var b = p.bits || {}, lines = [];
      if (p.day && p.type !== 'testimony') lines.push('<span class="tag">Day ' + p.day + ' of ' + p.of + '</span>');
      if (b.walk) lines.push('<span class="tag">🚶 ' + esc(b.walk) + '</span>');
      if (p.area) lines.push('<span class="tag">📍 ' + esc(p.area) + '</span>');
      if (b.feel) lines.push('<span class="tag">' + esc(b.feel) + '</span>');
      var body = '';
      if (b.gratitude) body += '<div class="txt">🙏 ' + (L === W.faith ? 'Thankful for: ' : 'Grateful for: ') + esc(b.gratitude) + '</div>';
      if (b.learned && L === W.faith) body += '<div class="txt">📖 ' + esc(b.learned) + '</div>';
      if (p.text) body += '<div class="txt" style="margin-top:6px">' + esc(p.text) + '</div>';
      var cheers = L.cheers.map(function (c) { var n = (p.reactions || {})[c[0]] || 0; return '<button data-id="' + esc(p.id) + '" data-k="' + c[0] + '" class="' + (p.mine === c[0] ? 'on' : '') + '">' + c[1] + ' ' + c[2] + (n ? ' · ' + n : '') + '</button>'; }).join('');
      html += '<div class="post"><div class="who"><div class="av" style="background:' + color(p.name) + '">' + esc(p.name.charAt(0)) + '</div><div><b>' + esc(p.name) + (p.me ? ' (you)' : '') + '</b><div class="muted">' + esc(head) + ' · ' + ago(p.when) + '</div></div></div>' +
        lines.join('') + body + (p.thumb ? '<img src="' + esc(p.thumb) + '" alt="">' : '') + '<div class="cheers">' + cheers + '</div></div>';
    });
    tab.innerHTML = html;
    tab.querySelector('#famPost').onclick = function () {
      var t = tab.querySelector('#famT').value.trim(); if (!t) return toast('Type a few words first.');
      share({ type: 'testimony', text: t }, function () { tab.querySelector('#famT').value = ''; });
    };
    tab.querySelectorAll('.cheers button').forEach(function (b) {
      b.onclick = function () {
        var u = user(), id = b.getAttribute('data-id'), k = b.getAttribute('data-k'); b.classList.toggle('on'); if (b.classList.contains('on')) confetti(8);
        run('famReact', [u.email, id, k, u.token], function () { load(true); }, function () {});
      };
    });
  }

  function renderMap(tab, feed) {
    var pins = feed.filter(function (p) { return p.lat != null && p.lng != null && p.when > Date.now() - 30 * 864e5; });
    tab.innerHTML = '<div class="fam-card"><div id="famMap"></div><div class="muted" style="margin-top:8px">Shared walks from the last 30 days. Each circle shows the area (about 1 km), never an exact address.</div></div>' +
      (pins.length ? '' : '<div class="fam-card muted">No shared walks with a location yet. On your Day Page, tap "Use my location" before you seal, then "Share with my family".</div>');
    withLeaflet(function () {
      var m = L.map('famMap', { scrollWheelZoom: false }); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 15, attribution: '© OpenStreetMap' }).addTo(m);
      var b = [];
      pins.forEach(function (p) { var c = color(p.name); L.circle([p.lat, p.lng], { radius: 700, color: c, fillColor: c, fillOpacity: .35 }).addTo(m).bindPopup('<b>' + esc(p.name) + '</b><br>' + (p.day ? 'Day ' + p.day + ' · ' : '') + ago(p.when) + (p.bits && p.bits.walk ? '<br>🚶 ' + esc(p.bits.walk) : '')); b.push([p.lat, p.lng]); });
      if (b.length) m.fitBounds(b, { padding: [40, 40], maxZoom: 13 }); else m.setView([39.5, -98.35], 3);
      setTimeout(function () { m.invalidateSize(); }, 200);
    });
  }
  function withLeaflet(cb) {
    if (window.L && window.L.map) return cb();
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = cb; s.onerror = function () { var d = document.getElementById('famMap'); if (d) d.innerHTML = '<div class="muted" style="padding:20px">The map needs the internet.</div>'; }; document.head.appendChild(s);
  }

  /* ---------- sharing ---------- */
  function share(post, done) {
    var u = user(); if (!u) return;
    if (!S.home || !S.home.family) { toast('Start or join a family first.'); if (btn) btn.click(); return; }
    run('famShare', [u.email, JSON.stringify(post), u.token], function (r) {
      if (r && r.success) { confetti(); toast('Shared with ' + S.home.family.name); if (done) done(); load(true); } else toast((r && r.message) || 'Could not share. Try again.');
    });
  }
  function shrink(dataUrl, cb) {
    if (!dataUrl) return cb('');
    var img = new Image(); img.onload = function () {
      var s = Math.min(1, 360 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); var q = .6, out = c.toDataURL('image/jpeg', q);
      while (out.length > 44000 && q > .25) { q -= .1; out = c.toDataURL('image/jpeg', q); } cb(out.length <= 44000 ? out : '');
    }; img.onerror = function () { cb(''); }; img.src = dataUrl;
  }
  function postFromEntry(e) {
    var bits = {}, lat = null, lng = null, area = '';
    var m = /Lat\s*(-?\d+(\.\d+)?),\s*Lng\s*(-?\d+(\.\d+)?)/i.exec(e.location || '');
    if (m) { lat = +m[1]; lng = +m[3]; } else if (e.location) area = String(e.location).slice(0, 40);
    if (String(e.didWalk || '').toLowerCase().indexOf('yes') === 0 || e.walkTime) bits.walk = [e.walkTime, e.walkTimeOfDay, e.companion ? 'with ' + e.companion : ''].filter(Boolean).join(' · ') || 'Walked today';
    var g = (e.gratitudes || []).filter(function (x) { return x && String(x).trim(); }); if (g.length) bits.gratitude = g[0];
    if (e.learned) bits.learned = String(e.learned).slice(0, 280);
    if (e.feeling) bits.feel = String(e.feeling);
    var day = +((document.getElementById('daySelect') || {}).value) || 0, of = +(document.getElementById('daySelect') || {}).max || 30;
    return { type: bits.walk ? 'walk' : 'day', day: day, of: of, text: e.revelation || '', lat: lat, lng: lng, area: area, bits: bits };
  }
  function watchSeal() {
    var bar = document.getElementById('savedBar'); if (!bar) return;
    new MutationObserver(function () {
      if (bar.style.display === 'none' || bar.querySelector('.fam-share-btn')) return;
      var b = document.createElement('button'); b.className = 'fam-share-btn'; b.textContent = '💛 Share with my family';
      b.onclick = function () {
        var e = window.lastEntry; if (!e) return toast('Seal your day first.');
        b.disabled = true; b.textContent = 'Sharing…';
        shrink(window.lastPhoto, function (thumb) { var p = postFromEntry(e); p.thumb = thumb; share(p, function () { b.textContent = '✓ Shared with your family'; }); setTimeout(function () { if (b.textContent === 'Sharing…') { b.disabled = false; b.textContent = '💛 Share with my family'; } }, 15000); });
      };
      bar.appendChild(document.createElement('br')); bar.appendChild(b);
      if (!S.home) checkNew();
    }).observe(bar, { attributes: true, childList: true });
  }

  function boot() { if (document.querySelector('#appPage .nav')) mount(); else setTimeout(boot, 500); }
  boot();
})();
