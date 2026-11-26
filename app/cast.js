/* Community Covenant — Play on TV / speaker (Nov 26 2026). Additive only.
 *  A "TV" button on Wisdom Reels and the music bar:
 *   - Android + Chrome: sends the reel voice to a Chromecast / Google TV (Remote Playback).
 *   - iPhone / iPad / Mac Safari: opens the AirPlay picker (Apple TV, AirPlay speakers).
 *   - Bluetooth speakers, car and headphones: nothing to set up; connect in the phone's Bluetooth settings and the app plays through it.
 *   - Everything else (computer, Fire TV, Roku): shows how to cast the whole screen, or open the app on the TV's own browser. */
(function () {
  'use strict';
  var SITE = ((window.COVENANT_CONFIG && window.COVENANT_CONFIG.SITE_URL) || 'https://crispcleaninc-dot.github.io/community-covenant/');
  function audio() { var a = document.querySelectorAll('body > audio'); return a.length ? a[a.length - 1] : null; }
  var css = document.createElement('style');
  css.textContent = '.cc-tvbtn{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:999px;padding:5px 11px;font:700 .72em "Source Sans 3",sans-serif;cursor:pointer;margin-left:8px;vertical-align:middle}' +
    '#ccTvHelp{position:fixed;inset:0;z-index:99991;background:rgba(20,12,35,.6);display:none}#ccTvHelp.on{display:block}' +
    '#ccTvHelp .pn{position:absolute;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;background:#2a2040;color:#f4ecdc;border-radius:18px 18px 0 0;padding:18px 18px calc(20px + env(safe-area-inset-bottom));font:15px/1.5 "Source Sans 3",system-ui,sans-serif}' +
    '#ccTvHelp h4{margin:0 0 8px;font:600 1.3em "Cormorant Garamond",Georgia,serif;color:#f1d999}#ccTvHelp li{margin:0 0 8px}#ccTvHelp b{color:#f1d999}' +
    '#ccTvHelp button{background:#f1d999;color:#2a2040;border:0;border-radius:999px;padding:9px 18px;font-weight:700;cursor:pointer;margin-top:6px}';
  document.head.appendChild(css);
  function help(msg) {
    var el = document.getElementById('ccTvHelp');
    if (!el) { el = document.createElement('div'); el.id = 'ccTvHelp'; document.body.appendChild(el); el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-x]')) el.classList.remove('on'); }); }
    el.innerHTML = '<div class="pn"><h4>Play on your TV or speaker</h4>' + (msg ? '<p>' + msg + '</p>' : '') + '<ul style="padding-left:18px;margin:6px 0">' +
      '<li><b>Bluetooth speaker, car or headphones:</b> connect it in your phone’s Bluetooth settings. The reels and music play through it. Reels keep reading with the screen off; the music needs the app open.</li>' +
      '<li><b>Chromecast / Google TV (Android):</b> tap TV while a reel is reading, then pick your TV.</li>' +
      '<li><b>Apple TV or AirPlay:</b> on iPhone, tap TV while a reel is reading, or swipe down to Screen Mirroring.</li>' +
      '<li><b>Show the reels on the TV screen:</b> on a computer, Chrome menu ⋮ › Cast… › Cast tab. On a phone, use Screen Mirroring / Smart View / Cast screen.</li>' +
      '<li><b>Smart TV browser:</b> open <b>covenant.crispusmundo.com</b> on the TV and tap Watch &amp; listen.</li></ul>' +
      '<button data-x>Got it</button></div>';
    el.classList.add('on');
  }
  window.ccCastTV = function () {
    var a = audio();
    if (a && a.src && !/^data:/.test(a.src)) {
      if (a.remote && a.remote.prompt) { a.remote.prompt().catch(function () { help(''); }); return; }
      if (a.webkitShowPlaybackTargetPicker) { try { a.webkitShowPlaybackTargetPicker(); return; } catch (e) {} }
    }
    help(a && a.src ? '' : 'Start a reel reading first (tap Listen), then tap TV to send it to a Chromecast or AirPlay device.');
  };
  function addButtons() {
    var brand = document.querySelector('#ccReels .brand');
    if (brand && !document.getElementById('ccTvB')) { var b = document.createElement('button'); b.type = 'button'; b.id = 'ccTvB'; b.className = 'cc-tvbtn'; b.textContent = '📺 TV'; b.setAttribute('aria-label', 'Play on TV or speaker'); b.onclick = function (e) { e.stopPropagation(); window.ccCastTV(); }; brand.appendChild(b); }
    var rad = document.getElementById('ccRadio');
    if (rad && !document.getElementById('ccTvR')) { var r = document.createElement('button'); r.type = 'button'; r.id = 'ccTvR'; r.className = 'cc-tvbtn'; r.textContent = '📺'; r.setAttribute('aria-label', 'Play on TV or speaker'); r.onclick = function (e) { e.stopPropagation(); window.ccCastTV(); }; rad.appendChild(r); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButtons); else addButtons();
  setTimeout(addButtons, 1500);
})();
