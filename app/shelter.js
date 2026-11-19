/* Community Covenant — "A warm place tonight" (Nov 19 2026). Additive only: nothing existing is changed.
 *  - Asks on the welcome screen: "Do you have a warm place to sleep tonight?" (no sign-in needed)
 *  - "No" or "Not sure" opens a helper matched to who needs the bed: family with children, single woman,
 *    single man, someone leaving domestic violence, youth / young adult, veteran, senior
 *  - Gives the 24/7 people who know tonight's open beds (211, the hotlines), plus shelter and food
 *    searches for the person's ZIP code anywhere in the U.S. (findhelp.org, HUD Find Shelter, maps)
 *  - Optional: send a message to the Covenant team (uses the existing team chat, chatSend)
 *  - Also opens when someone types words like "homeless" or "nowhere to sleep" into Ask for Help
 * Privacy: nothing about the person's situation is kept on the device. Only "asked today" is remembered,
 * and not even that when domestic violence is chosen. A Quick exit button leaves the page at once. */
(function () {
  'use strict';
  var TODAY = new Date().toISOString().slice(0, 10);
  var KEY = 'cc-warm-asked';
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function user() { try { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null; } catch (e) { return null; } }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent); }
  function smsLink(num, body) { return 'sms:' + num + (body ? (isIOS() ? '&' : '?') + 'body=' + encodeURIComponent(body) : ''); }

  /* ---------- who needs the bed ---------- */
  var WHO = [
    { id: 'family', label: 'Family with children', terms: 'family shelter', btn: 'Family shelters' },
    { id: 'woman', label: 'Single woman', terms: "women's shelter", btn: "Women's shelters" },
    { id: 'man', label: 'Single man', terms: "men's shelter", btn: "Men's shelters" },
    { id: 'dv', label: 'Leaving domestic violence (any household)', terms: 'domestic violence shelter', btn: 'Domestic violence help' },
    { id: 'youth', label: 'Youth or young adult (under 25)', terms: 'youth shelter', btn: 'Youth shelters' },
    { id: 'vet', label: 'Veteran', terms: 'veteran housing', btn: 'Veteran housing help' },
    { id: 'senior', label: 'Senior (60+) or disabled', terms: 'emergency shelter', btn: 'Shelters for seniors and disabled', terms2: 'senior shelter' }
  ];

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.ccw-warm{margin-top:14px;max-width:520px;background:rgba(255,255,255,.12);border:1px solid rgba(241,217,153,.55);border-radius:16px;padding:14px 16px;color:#fff}' +
    '.ccw-warm b{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.35em;font-weight:600;display:block;margin-bottom:8px}' +
    '.ccw-warm .r{display:flex;gap:8px;flex-wrap:wrap}' +
    '.ccw-warm button{flex:1 1 30%;border:0;border-radius:999px;padding:11px 10px;font:700 .95em "Source Sans 3",Arial;cursor:pointer;background:rgba(255,255,255,.18);color:#fff}' +
    '.ccw-warm button.no{background:linear-gradient(135deg,#f1d999,#c9a961);color:#2a2040}' +
    '.ccw-warm .ok{font-size:.95em;color:#f3edf9}' +
    '#ccWarm{position:fixed;inset:0;z-index:10050;background:#faf6ee;color:#2a2040;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:"Source Sans 3",Arial,sans-serif}' +
    '#ccWarm .in{max-width:620px;margin:0 auto;padding:18px 18px 60px}' +
    '#ccWarm .top{display:flex;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;background:#faf6ee;padding:6px 0 10px;z-index:2}' +
    '#ccWarm .top button{border:0;border-radius:999px;padding:9px 14px;font:700 .9em "Source Sans 3",Arial;cursor:pointer}' +
    '#ccWarm .exit{background:#8a1c1c;color:#fff}#ccWarm .cls{background:#ece4d3;color:#2a2040}' +
    '#ccWarm h2{font-family:"Cormorant Garamond",Georgia,serif;font-size:2em;font-weight:600;margin:4px 0 6px;color:#372b4e}' +
    '#ccWarm h3{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.35em;margin:22px 0 8px;color:#372b4e}' +
    '#ccWarm p{line-height:1.5;margin:6px 0}' +
    '#ccWarm .danger{background:#8a1c1c;color:#fff;border-radius:14px;padding:12px 14px;margin:10px 0}' +
    '#ccWarm .danger a{color:#fff;font-weight:700}' +
    '#ccWarm .chips{display:flex;flex-wrap:wrap;gap:8px}' +
    '#ccWarm .chip{border:1px solid #b8964f;background:#fff;color:#372b4e;border-radius:999px;padding:10px 14px;font:600 .95em "Source Sans 3",Arial;cursor:pointer}' +
    '#ccWarm .chip.on{background:#372b4e;color:#fff;border-color:#372b4e}' +
    '#ccWarm .zip{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}' +
    '#ccWarm input,#ccWarm textarea{font:1em "Source Sans 3",Arial;padding:11px 12px;border:1px solid #d9cdb4;border-radius:12px;background:#fff;color:#2a2040}' +
    '#ccWarm input.z{width:9em}' +
    '#ccWarm .btn{border:0;border-radius:999px;padding:11px 16px;font:700 .95em "Source Sans 3",Arial;cursor:pointer;background:#372b4e;color:#fff}' +
    '#ccWarm .btn.g{background:linear-gradient(135deg,#f1d999,#c9a961);color:#2a2040}' +
    '#ccWarm .card{background:#fff;border:1px solid #e7ddc9;border-radius:14px;padding:12px 14px;margin:8px 0}' +
    '#ccWarm .card b{display:block;color:#372b4e;font-size:1.05em}' +
    '#ccWarm .card .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}' +
    '#ccWarm .card .acts a{display:inline-block;text-decoration:none;border-radius:999px;padding:9px 14px;font-weight:700;background:#372b4e;color:#fff}' +
    '#ccWarm .card .acts a.alt{background:#ece4d3;color:#2a2040}' +
    '#ccWarm .note{font-size:.88em;color:#6b6280}' +
    '#ccWarm .verse{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-size:1.15em;color:#372b4e;border-left:3px solid #b8964f;padding-left:12px;margin:14px 0}' +
    '#ccWarm .msg{font-weight:600;margin-top:6px}' +
    '.ccw-warm-btn{margin-top:8px}';
  document.head.appendChild(css);

  /* ---------- the helper screen ---------- */
  var state = { who: '', zip: '' };

  function quickExit() {
    try { var w = document.getElementById('ccWarm'); if (w) w.remove(); } catch (e) {}
    try { location.replace('https://www.google.com/search?q=weather'); } catch (e) { location.href = 'https://www.google.com/'; }
  }
  window.ccWarmQuickExit = quickExit;

  function open(prefWho) {
    var old = document.getElementById('ccWarm'); if (old) old.remove();
    state.who = prefWho || state.who || '';
    var chips = WHO.map(function (w) { return '<button type="button" class="chip' + (state.who === w.id ? ' on' : '') + '" data-who="' + w.id + '">' + esc(w.label) + '</button>'; }).join('');
    var m = el(
      '<div id="ccWarm" role="dialog" aria-label="A warm place tonight"><div class="in">' +
      '<div class="top"><button class="cls" type="button">&larr; Back to the app</button><button class="exit" type="button" title="Leaves this page right away">Quick exit</button></div>' +
      '<h2>A warm place tonight</h2>' +
      '<p>You are not alone, and asking for help is not failing. Let’s find you a safe, warm place to sleep and something to eat.</p>' +
      '<div class="danger">In danger right now? <a href="tel:911">Call 911</a>. Thinking about ending your life? <a href="tel:988">Call or text 988</a>, any time, free.</div>' +
      '<h3>1. Who needs the bed?</h3><div class="chips">' + chips + '</div>' +
      '<h3>2. Where are you?</h3>' +
      '<p class="note">Your ZIP code finds places near you. It stays on this screen and is not saved.</p>' +
      '<div class="zip"><input class="z" inputmode="numeric" maxlength="5" placeholder="ZIP code" aria-label="ZIP code" value="' + esc(state.zip) + '">' +
      '<button class="btn g" type="button" data-go="1">Show me help</button><button class="btn" type="button" data-loc="1">Use my location</button></div>' +
      '<div class="msg" aria-live="polite"></div>' +
      '<div class="res"></div>' +
      '</div></div>');
    document.body.appendChild(m);
    m.querySelector('.cls').onclick = function () { m.remove(); };
    m.querySelector('.exit').onclick = quickExit;
    Array.prototype.forEach.call(m.querySelectorAll('.chip'), function (b) {
      b.onclick = function () {
        state.who = b.getAttribute('data-who');
        Array.prototype.forEach.call(m.querySelectorAll('.chip'), function (x) { x.classList.toggle('on', x === b); });
        if (state.who === 'dv') { try { localStorage.removeItem(KEY); } catch (e) {} }
        render(m);
      };
    });
    var zi = m.querySelector('.z');
    zi.oninput = function () { zi.value = zi.value.replace(/\D/g, '').slice(0, 5); state.zip = zi.value; };
    zi.onkeydown = function (e) { if (e.key === 'Enter') render(m); };
    m.querySelector('[data-go]').onclick = function () { state.zip = zi.value; render(m); };
    m.querySelector('[data-loc]').onclick = function () { locate(m); };
    render(m);
  }
  window.ccOpenWarm = open;

  function say(m, t) { var x = m.querySelector('.msg'); if (x) x.textContent = t || ''; }

  function locate(m) {
    if (!navigator.geolocation) { say(m, 'This phone can’t share location here. Please type your ZIP code.'); return; }
    say(m, 'Finding where you are…');
    navigator.geolocation.getCurrentPosition(function (p) {
      state.lat = p.coords.latitude; state.lon = p.coords.longitude;
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=' + state.lat + '&lon=' + state.lon, { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var z = j && j.address && String(j.address.postcode || '').slice(0, 5);
          if (/^\d{5}$/.test(z)) { state.zip = z; m.querySelector('.z').value = z; say(m, 'Found you near ZIP ' + z + '.'); }
          else say(m, 'Found your location. If the ZIP is wrong, type it in.');
          render(m);
        })
        .catch(function () { say(m, 'Found your location. Type your ZIP too for the best shelter list.'); render(m); });
    }, function () { say(m, 'Location is turned off. Please type your ZIP code.'); }, { timeout: 12000, maximumAge: 600000 });
  }

  function card(title, body, links) {
    return '<div class="card"><b>' + esc(title) + '</b>' + (body ? '<p>' + body + '</p>' : '') +
      (links && links.length ? '<div class="acts">' + links.map(function (l) {
        return '<a class="' + (l.alt ? 'alt' : '') + '" href="' + esc(l.href) + '"' + (/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.text) + '</a>';
      }).join('') + '</div>' : '') + '</div>';
  }

  function render(m) {
    var res = m.querySelector('.res'); if (!res) return;
    var w = WHO.filter(function (x) { return x.id === state.who; })[0];
    var zip = /^\d{5}$/.test(state.zip || '') ? state.zip : '';
    var near = zip ? ('near ' + zip) : (state.lat ? ('near ' + state.lat.toFixed(3) + ',' + state.lon.toFixed(3)) : 'near me');
    var maps = function (q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q + ' ' + near); };
    var fh = function (t) { return zip ? 'https://www.findhelp.org/search_results/' + zip + '?terms=' + encodeURIComponent(t) : 'https://www.findhelp.org/'; };
    var h = '';

    if (!w) { res.innerHTML = '<p class="note" style="margin-top:14px">Choose who needs the bed above, and the right numbers will show here.</p>'; return; }

    h += '<h3>Call or text first — they know tonight’s open beds</h3>';

    if (w.id === 'dv') {
      h += card('National Domestic Violence Hotline — 24/7, free, private',
        'Trained advocates help you make a safety plan and find a confidential shelter. Domestic violence shelters keep their addresses private for your safety, so the hotline or 211 connects you.',
        [{ href: 'tel:18007997233', text: 'Call 1-800-799-7233' }, { href: smsLink('88788', 'START'), text: 'Text START to 88788' }, { href: 'https://www.thehotline.org/', text: 'Chat online', alt: 1 }]);
      h += '<p class="note">If someone checks your phone: use Quick exit at the top, and clear your browser history after. Calling from a friend’s phone or a library computer can be safer.</p>';
    }
    if (w.id === 'youth') {
      h += card('National Runaway Safeline — 24/7, for young people',
        'For anyone under 21 who has run away, been put out, or has nowhere safe to go. Free, confidential, no judgment.',
        [{ href: 'tel:18007862929', text: 'Call 1-800-786-2929' }, { href: 'https://www.1800runaway.org/', text: 'Chat or email', alt: 1 }]);
    }
    if (w.id === 'vet') {
      h += card('National Call Center for Homeless Veterans — 24/7',
        'VA staff connect veterans and their families with housing and shelter tonight. You do not have to be enrolled in VA care to call.',
        [{ href: 'tel:18774243838', text: 'Call 1-877-424-3838' }]);
    }

    h += card('211 — local help line, 24/7 in most areas',
      'Tell them: “I need a place to sleep tonight”' + (w.id === 'family' ? ' and how many children and their ages' : '') + '. They know which shelters, warming centers and meal sites are open near you and what time to get there.' +
      (w.id === 'family' ? ' Ask for a <b>family shelter</b> so you can stay together.' : '') +
      (w.id === 'woman' ? ' Ask for a <b>women’s shelter</b>.' : '') +
      (w.id === 'man' ? ' Ask for a <b>men’s shelter</b> or <b>rescue mission</b>.' : '') +
      (w.id === 'senior' ? ' Say if you need a wheelchair-accessible place or help with medicine.' : ''),
      [{ href: 'tel:211', text: 'Call 211' }, { href: smsLink('898211', zip || 'ZIP'), text: 'Text ' + (zip ? zip : 'your ZIP') + ' to 898-211' }]);

    if (w.id === 'family') {
      h += card('Children in school?', 'Every public school district has a homeless student liaison (the McKinney-Vento law). Call your child’s school office tomorrow and ask for the homeless liaison — they can help with school rides, meals, and housing referrals, and your children can stay in the same school.', []);
    }

    h += '<h3>Shelters ' + (zip ? 'near ' + esc(zip) : 'near you') + '</h3>';
    if (!zip) h += '<p class="note">Add your ZIP code above for a list of shelters with their hours and phone numbers.</p>';
    h += card('Shelter list with hours and phone numbers', 'From findhelp.org, a free national directory. Each listing shows its hours, who it serves, and how to get in.',
      [{ href: fh(w.terms), text: w.btn }, { href: fh('emergency shelter'), text: 'All emergency shelters', alt: 1 }]);
    h += card('More ways to look', '',
      [{ href: 'https://www.hud.gov/findshelter', text: 'HUD Find Shelter (government map)' }, { href: maps(w.id === 'dv' ? 'domestic violence help' : 'homeless shelter'), text: 'Shelters on the map', alt: 1 }, { href: maps('warming center'), text: 'Warming centers', alt: 1 }]);

    h += '<h3>Food tonight and tomorrow</h3>';
    h += card('Free meals and food pantries', 'Soup kitchens serve hot meals at set times; pantries give groceries. Listings show the days and hours.',
      [{ href: fh('free meals'), text: 'Free meals' }, { href: fh('food pantry'), text: 'Food pantries', alt: 1 }, { href: maps('soup kitchen'), text: 'Meals on the map', alt: 1 }]);
    h += card('National Hunger Hotline', 'Call or text your ZIP code to find food near you (weekdays).',
      [{ href: 'tel:18005484639', text: 'Call 1-800-548-6479' }, { href: smsLink('18005486479', zip || 'ZIP'), text: 'Text your ZIP', alt: 1 }, { href: 'https://www.feedingamerica.org/find-your-local-foodbank', text: 'Find your food bank', alt: 1 }]);

    h += '<h3>Good to know</h3>';
    h += '<p>• Hours change, and beds fill up in the evening. <b>Call before you go</b>, and go as early as you can.</p>' +
      '<p>• Bring an ID if you have one, any medicine, and a phone charger. No ID? Go anyway — many places still help.</p>' +
      '<p>• When it is freezing, many cities open extra warming centers. Ask 211 for a “warming center.”</p>' +
      '<p>• If you are sleeping in a car, park somewhere lit, crack a window, and never run the engine in a closed space.</p>';

    h += '<h3>Want the Covenant team to check on you?</h3>' +
      '<p class="note">Optional. This goes privately to the Covenant team, who will pray with you and help you follow up. They are not an emergency service.</p>' +
      '<div class="card"><input class="em" type="email" placeholder="Your email" aria-label="Your email" style="width:100%;margin-bottom:8px" value="' + esc((user() && user().email) || '') + '">' +
      '<textarea class="tx" rows="3" style="width:100%" placeholder="Anything you want us to know (a phone number to call you, what you need)"></textarea>' +
      '<div class="acts"><button class="btn" type="button" data-send="1">Send to the team</button></div><div class="sent msg"></div></div>';

    h += '<p class="verse">“The Lord also will be a refuge for the oppressed, a refuge in times of trouble.” — Psalm 9:9</p>';
    h += '<p class="note">Phone numbers and links go to outside services. Community Covenant does not run shelters and cannot promise a bed, but these are the people who can find one tonight.</p>';
    res.innerHTML = h;

    var sb = res.querySelector('[data-send]');
    if (sb) sb.onclick = function () { send(res, w); };
  }

  function send(res, w) {
    var em = String(res.querySelector('.em').value || '').trim();
    var tx = String(res.querySelector('.tx').value || '').trim();
    var out = res.querySelector('.sent');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { out.textContent = 'Please enter an email so the team can answer you.'; return; }
    var u = user();
    var msg = '[A WARM PLACE TONIGHT] No warm place to sleep tonight. Household: ' + w.label + '. ' + (state.zip ? 'ZIP: ' + state.zip + '. ' : '') + (tx ? 'They wrote: ' + tx : '');
    out.textContent = 'Sending…';
    try {
      google.script.run
        .withSuccessHandler(function (r) { out.textContent = (r && r.success) ? 'Sent. The team has been told. Please still call 211 or the hotline above for a bed tonight.' : ((r && r.message) || 'Could not send. Please call 211.'); })
        .withFailureHandler(function () { out.textContent = 'Saved and will send when you are back online. Please still call 211 for tonight.'; })
        .chatSend(em, (u && u.name) || '', (u && u.userId) || '', msg);
    } catch (e) { out.textContent = 'Could not send from here. Please call 211.'; }
  }

  /* ---------- the question on the welcome screen ---------- */
  function addWelcomeQuestion() {
    var acts = document.querySelector('#ccWelcome .acts');
    if (!acts || document.getElementById('ccwWarm')) return;
    var asked = store(KEY) === TODAY;
    var box = el('<div id="ccwWarm" class="ccw-warm" role="group" aria-label="A warm place tonight"></div>');
    function ask() {
      box.innerHTML = '<b>Do you have a warm place to sleep tonight?</b><div class="r">' +
        '<button type="button" data-a="yes">Yes</button><button type="button" class="no" data-a="no">No</button><button type="button" data-a="unsure">Not sure</button></div>';
      Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
        b.onclick = function () {
          var a = b.getAttribute('data-a');
          if (a === 'yes') { store(KEY, TODAY); thanks(); }
          else open('');
        };
      });
    }
    function thanks() {
      box.innerHTML = '<div class="ok">Thank God. If you ever need a warm place or a meal, it is right here. </div>' +
        '<div class="r ccw-warm-btn"><button type="button" data-o="1">A warm place tonight</button></div>';
      box.querySelector('[data-o]').onclick = function () { open(''); };
    }
    if (asked) thanks(); else ask();
    acts.parentNode.insertBefore(box, acts.nextSibling);
  }

  /* ---------- Ask for Help: housing and hunger words open the helper ---------- */
  var HOUSING = ['homeless', 'nowhere to sleep', 'no where to sleep', 'nowhere to stay', 'no place to sleep', 'no place to stay', 'sleeping in my car', 'sleep in my car',
    'sleeping outside', 'kicked out', 'got put out', 'evicted', 'need a shelter', 'homeless shelter', 'find a shelter', 'need a place to stay', 'need somewhere to stay', 'cold tonight',
    'no food', 'nothing to eat', 'food bank', 'food pantry', 'kids are hungry', 'haven\u2019t eaten', "haven't eaten",
    'domestic violence', 'abusive', 'he hits me', 'she hits me', 'not safe at home'];
  function hookAsk() {
    if (typeof window.askForHelp !== 'function' || window.askForHelp.ccWarm) return;
    var orig = window.askForHelp;
    var wrapped = function () {
      var q = '';
      try { var i = document.getElementById('askInput'); q = String((i && i.value) || '').toLowerCase(); } catch (e) {}
      var r = orig.apply(this, arguments);
      if (q) for (var k = 0; k < HOUSING.length; k++) if (q.indexOf(HOUSING[k]) !== -1) {
        var dv = /domestic violence|abusive|hits me|not safe at home/.test(q);
        setTimeout(function () { open(dv ? 'dv' : ''); }, 700); break;
      }
      return r;
    };
    wrapped.ccWarm = true;
    window.askForHelp = wrapped;
  }

  /* ---------- the Give screen: someone without a bed should never have to get past a donation ask ---------- */
  function addToGive() {
    var g = document.querySelector('#ccGive .gv');
    if (!g || document.getElementById('ccGiveWarm')) return;
    var b = el('<button type="button" id="ccGiveWarm" class="cont" style="background:#8a1c1c;color:#fff;margin-bottom:8px">No warm place to sleep or no food tonight? Get help now</button>');
    b.onclick = function () { try { if (typeof window.ccGiveClose === 'function') window.ccGiveClose('not-today'); } catch (e) {} open(''); };
    var h2 = g.querySelector('h2');
    g.insertBefore(b, h2 ? h2.nextSibling : g.firstChild);
  }

  function start() { addWelcomeQuestion(); hookAsk(); addToGive(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
