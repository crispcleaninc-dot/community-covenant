/* Community Covenant — Share (Nov 26 2026). Additive only: nothing existing is removed.
 *  One Share sheet for Wisdom Reels and skits: Text message, Facebook, WhatsApp, Instagram, TikTok, Copy link, More.
 *  What gets sent is a short LINK, not a picture or video, so it costs almost no phone memory.
 *  The link opens a small preview page (s/r<N>.html or s/k-<id>.html) that shows the same plum-and-gold card as the app
 *  in texts and Facebook, then opens the app on that exact reel or skit and keeps going from there.
 *  Music is never attached: gospel songs belong to their labels, so a shared clip with the song can get flagged or muted.
 *  The person who opens the link hears the music inside the app.
 *  Credit line on every share: Scripture (KJV, public domain) and, for outside clips, the creator's name and channel. */
(function () {
  'use strict';
  var SITE = ((window.COVENANT_CONFIG && window.COVENANT_CONFIG.SITE_URL) || 'https://crispcleaninc-dot.github.io/community-covenant/').replace(/\/?$/, '/');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m) { var t = document.createElement('div'); t.textContent = m; t.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#f1d999;color:#2a2040;padding:9px 16px;border-radius:999px;font:700 .85em "Source Sans 3",sans-serif;z-index:99999;max-width:90vw;text-align:center'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function copy(t, msg) {
    function fb() { var a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = 0; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); toast(msg); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast(msg); }, fb); else fb();
  }
  function track(kind, id, how) { try { if (window.ccTrack) window.ccTrack('share', kind + '-' + id, how, ''); } catch (e) {} }

  function info(o) {
    if (o.kind === 'skit') {
      var x = (window.ccSkitInfo && window.ccSkitInfo(o.id)) || { id: o.id, title: o.title || 'A Community Covenant skit', kind: 'Skit', who: '' };
      var credit = x.yt && x.who ? 'Clip by ' + x.who.split(' · ')[0] + ' (from their YouTube channel).' : 'A Community Covenant original. Scripture: KJV.';
      return { link: SITE + 's/k-' + x.id + '.html', title: x.title, line: x.title, credit: credit };
    }
    var ref = o.ref ? ' (' + o.ref + ', KJV)' : '';
    return { link: SITE + 's/r' + o.id + '.html', title: o.title, line: o.title + ref, credit: 'Scripture: King James Version (public domain). Wisdom Reels by Community Covenant.' };
  }

  var css = document.createElement('style');
  css.textContent =
    '#ccShS{position:fixed;inset:0;z-index:99990;display:none;background:rgba(20,12,35,.55)}#ccShS.on{display:block}' +
    '#ccShS .pn{position:absolute;left:0;right:0;bottom:0;background:#2a2040;color:#f4ecdc;border-radius:18px 18px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom));max-width:560px;margin:0 auto;font-family:"Source Sans 3",system-ui,sans-serif}' +
    '#ccShS h4{margin:0 0 4px;font:600 1.25em "Cormorant Garamond",Georgia,serif;color:#f1d999}' +
    '#ccShS .pv{font-size:.88em;opacity:.85;margin:0 0 12px;line-height:1.4}' +
    '#ccShS .g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}' +
    '#ccShS .g button{background:#3a2d57;border:1px solid #55487a;color:#f4ecdc;border-radius:14px;padding:12px 4px 8px;font:600 .78em inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;min-height:76px}' +
    '#ccShS .g button i{font-style:normal;font-size:1.6em;line-height:1}' +
    '#ccShS .cr{font-size:.74em;opacity:.7;margin:12px 0 0;line-height:1.35}' +
    '#ccShS .x{position:absolute;right:12px;top:10px;background:transparent;border:0;color:#f1d999;font-size:1.6em;cursor:pointer}';
  document.head.appendChild(css);

  var cur = null;
  function sheet() {
    var el = document.getElementById('ccShS'); if (el) return el;
    el = document.createElement('div'); el.id = 'ccShS';
    el.innerHTML = '<div class="pn" role="dialog" aria-label="Share"><button class="x" aria-label="Close">&times;</button><h4>Share this</h4><p class="pv" id="ccShPv"></p><div class="g">' +
      '<button data-h="sms"><i>&#128172;</i>Text</button><button data-h="fb"><i>f</i>Facebook</button><button data-h="wa"><i>&#9990;</i>WhatsApp</button><button data-h="ig"><i>&#9711;</i>Instagram</button>' +
      '<button data-h="tt"><i>&#9834;</i>TikTok</button><button data-h="em"><i>&#9993;</i>Email</button><button data-h="cp"><i>&#128279;</i>Copy link</button><button data-h="more"><i>&#8943;</i>More</button></div>' +
      '<p class="cr" id="ccShCr"></p></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target === el || e.target.closest('.x')) { el.classList.remove('on'); return; }
      var b = e.target.closest('[data-h]'); if (b && cur) go(b.getAttribute('data-h'));
    });
    return el;
  }
  function go(h) {
    var i = cur.i, msg = i.line + '\n' + i.link, enc = encodeURIComponent;
    track(cur.o.kind, cur.o.id, h);
    if (h === 'sms') { var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent); location.href = 'sms:' + (ios ? '&' : '?') + 'body=' + enc(msg); }
    else if (h === 'fb') window.open('https://www.facebook.com/sharer/sharer.php?u=' + enc(i.link), '_blank', 'noopener');
    else if (h === 'wa') window.open('https://wa.me/?text=' + enc(msg), '_blank', 'noopener');
    else if (h === 'em') location.href = 'mailto:?subject=' + enc(i.title) + '&body=' + enc(msg + '\n\n' + i.credit);
    else if (h === 'ig' || h === 'tt') {
      var name = h === 'ig' ? 'Instagram' : 'TikTok';
      copy(i.link, 'Link copied. In ' + name + ', add it to your story with the Link sticker, or paste it in your caption or bio.');
      if (navigator.share) setTimeout(function () { navigator.share({ title: i.title, text: i.line, url: i.link }).catch(function () {}); }, 600);
    }
    else if (h === 'cp') copy(i.link, 'Link copied');
    else if (h === 'more') { if (navigator.share) navigator.share({ title: i.title, text: i.line, url: i.link }).catch(function () {}); else copy(msg, 'Copied. Paste it anywhere.'); }
  }
  window.ccShareSheet = function (o) {
    cur = { o: o, i: info(o) };
    var el = sheet();
    document.getElementById('ccShPv').innerHTML = '<b>' + esc(cur.i.title) + '</b><br>Sends a short link (no picture or video to download). It opens right here in the app and keeps going from this ' + (o.kind === 'skit' ? 'skit' : 'reel') + '.';
    document.getElementById('ccShCr').textContent = cur.i.credit + ' Music isn’t attached; it plays in the app.';
    el.classList.add('on');
  };

  /* ---------- opening a shared link: ?reel=N or ?skit=id ---------- */
  function openShared() {
    var q = {}; try { location.search.replace(/^\?/, '').split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }); } catch (e) {}
    if (q.reel != null && q.reel !== '' && typeof window.ccOpenReels === 'function') {
      window.ccStartReel = parseInt(q.reel, 10);
      try { if (typeof window.ccSetTopic === 'function') window.ccSetTopic(-1); } catch (e) {}
      window.ccOpenReels(false);
      toast('Tap ▶ Listen, or turn on music, to keep going');
      return true;
    }
    if (q.skit && typeof window.ccOpenBreak === 'function') { window.ccOpenBreak('skits', q.skit); return true; }
    return false;
  }
  var tries = 0;
  function waitOpen() { if (!/[?&](reel|skit)=/.test(location.search)) return; if (openShared() || ++tries > 20) return; setTimeout(waitOpen, 400); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(waitOpen, 300); }); else setTimeout(waitOpen, 300);
})();
