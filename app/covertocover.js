/* Community Covenant — Reading along with Cover to Cover (Nov 22 2026). Additive only: nothing existing is removed.
 *  The member picks their reading plan, and can switch back and forth at any time:
 *   - "Covenant plan"  : the app's own daily Scripture, exactly as before (the default).
 *   - "Cover to Cover" : the day's Scripture card follows the Faith & Findings Forum's Cover to Cover read
 *                        (whole Bible, KJV, Genesis to Revelation in 365 days, Day 1 = Sun Nov 22 2026),
 *                        with Friday Apocrypha Special Edition and Wednesday Full Armor of God.
 *                        The app's extras (Second Scripture, Apocrypha, Quran, What does this mean, Daily Focus) stay.
 *   - "Both"           : the app's verse stays, and today's Cover to Cover reading is added under it.
 *  Catching up: a member can say which Cover to Cover day they are on; it then moves forward one day each day.
 *  "I read it" check mark per day. The day follows the Date box, so logging an old day shows that day's reading.
 *  Settings save on the device and to the member's account (keys ccReadPlan, ccC2CStart, ccC2CDone).
 *  Plan source: "FNF Cover to Cover — 365-Day Bible Reading & Video Plan" sheet. */
(function () {
  'use strict';
  var READ = ["Genesis 1-3", "Genesis 4-6", "Genesis 7-10", "Genesis 11-13", "Genesis 14-17", "Genesis 18-20", "Genesis 21-23", "Genesis 24-25", "Genesis 26-27", "Genesis 28-29", "Genesis 30-31", "Genesis 32-34", "Genesis 35-37", "Genesis 38-40", "Genesis 41-42", "Genesis 43-44", "Genesis 45-47", "Genesis 48-50", "Exodus 1-4", "Exodus 5-7", "Exodus 8-9", "Exodus 10-12", "Exodus 13-15", "Exodus 16-19", "Exodus 20-22", "Exodus 23-24", "Exodus 25-27", "Exodus 28-29", "Exodus 30-32", "Exodus 33-35", "Exodus 36-37", "Exodus 38-39", "Exodus 40; Leviticus 1-3", "Leviticus 4-6", "Leviticus 7-9", "Leviticus 10-12", "Leviticus 13-14", "Leviticus 15-16", "Leviticus 17-19", "Leviticus 20-22", "Leviticus 23-24", "Leviticus 25-26", "Leviticus 27; Numbers 1", "Numbers 2-3", "Numbers 4-5", "Numbers 6-7", "Numbers 8-9", "Numbers 10-12", "Numbers 13-15", "Numbers 16-17", "Numbers 18-20", "Numbers 21-22", "Numbers 23-25", "Numbers 26-28", "Numbers 29-30", "Numbers 31-32", "Numbers 33-34", "Numbers 35-36; Deuteronomy 1", "Deuteronomy 2-3", "Deuteronomy 4-6", "Deuteronomy 7-9", "Deuteronomy 10-13", "Deuteronomy 14-16", "Deuteronomy 17-20", "Deuteronomy 21-24", "Deuteronomy 25-27", "Deuteronomy 28-29", "Deuteronomy 30-32", "Deuteronomy 33-34; Joshua 1", "Joshua 2-6", "Joshua 7-8", "Joshua 9-11", "Joshua 12-14", "Joshua 15-17", "Joshua 18-20", "Joshua 21-23", "Joshua 24; Judges 1-2", "Judges 3-5", "Judges 6-7", "Judges 8-9", "Judges 10-13", "Judges 14-16", "Judges 17-19", "Judges 20-21; Ruth 1", "Ruth 2-4; 1 Samuel 1", "1 Samuel 2-5", "1 Samuel 6-9", "1 Samuel 10-13", "1 Samuel 14-15", "1 Samuel 16-17", "1 Samuel 18-20", "1 Samuel 21-23", "1 Samuel 24-26", "1 Samuel 27-30", "1 Samuel 31; 2 Samuel 1-2", "2 Samuel 3-6", "2 Samuel 7-10", "2 Samuel 11-13", "2 Samuel 14-15", "2 Samuel 16-18", "2 Samuel 19-21", "2 Samuel 22-23", "2 Samuel 24; 1 Kings 1", "1 Kings 2-3", "1 Kings 4-6", "1 Kings 7-8", "1 Kings 9-10", "1 Kings 11-13", "1 Kings 14-15", "1 Kings 16-18", "1 Kings 19-20", "1 Kings 21-22; 2 Kings 1", "2 Kings 2-4", "2 Kings 5-6", "2 Kings 7-9", "2 Kings 10-12", "2 Kings 13-15", "2 Kings 16-18", "2 Kings 19-21", "2 Kings 22-24", "2 Kings 25; 1 Chronicles 1", "1 Chronicles 2-3", "1 Chronicles 4-5", "1 Chronicles 6-7", "1 Chronicles 8-9", "1 Chronicles 10-11", "1 Chronicles 12-15", "1 Chronicles 16-18", "1 Chronicles 19-22", "1 Chronicles 23-25", "1 Chronicles 26-28", "1 Chronicles 29; 2 Chronicles 1-3", "2 Chronicles 4-6", "2 Chronicles 7-10", "2 Chronicles 11-15", "2 Chronicles 16-19", "2 Chronicles 20-23", "2 Chronicles 24-26", "2 Chronicles 27-30", "2 Chronicles 31-33", "2 Chronicles 34-36", "Ezra 1-2", "Ezra 3-6", "Ezra 7-9", "Ezra 10; Nehemiah 1-3", "Nehemiah 4-6", "Nehemiah 7-8", "Nehemiah 9-11", "Nehemiah 12-13", "Esther 1-4", "Esther 5-9", "Esther 10; Job 1-4", "Job 5-7", "Job 8-11", "Job 12-14", "Job 15-18", "Job 19-21", "Job 22-24", "Job 25-29", "Job 30-31", "Job 32-34", "Job 35-37", "Job 38-40", "Job 41-42; Psalms 1-4", "Psalms 5-10", "Psalms 11-18", "Psalms 19-22", "Psalms 23-29", "Psalms 30-34", "Psalms 35-37", "Psalms 38-43", "Psalms 44-48", "Psalms 49-54", "Psalms 55-61", "Psalms 62-67", "Psalms 68-71", "Psalms 72-75", "Psalms 76-78", "Psalms 79-83", "Psalms 84-88", "Psalms 89-92", "Psalms 93-99", "Psalms 100-104", "Psalms 105-106", "Psalms 107-108", "Psalms 109-115", "Psalms 116-118", "Psalms 119", "Psalms 120-123", "Psalms 124-135", "Psalms 136-140", "Psalms 141-146", "Psalms 147-150; Proverbs 1-2", "Proverbs 3-5", "Proverbs 6-7", "Proverbs 8-10", "Proverbs 11-13", "Proverbs 14-16", "Proverbs 17-19", "Proverbs 20-22", "Proverbs 23-24", "Proverbs 25-28", "Proverbs 29-30", "Proverbs 31; Ecclesiastes 1-3", "Ecclesiastes 4-8", "Ecclesiastes 9-12; Song of Songs 1", "Song of Songs 2-7", "Song of Songs 8; Isaiah 1-3", "Isaiah 4-7", "Isaiah 8-11", "Isaiah 12-16", "Isaiah 17-21", "Isaiah 22-26", "Isaiah 27-30", "Isaiah 31-34", "Isaiah 35-38", "Isaiah 39-41", "Isaiah 42-45", "Isaiah 46-49", "Isaiah 50-54", "Isaiah 55-59", "Isaiah 60-65", "Isaiah 66; Jeremiah 1-2", "Jeremiah 3-5", "Jeremiah 6-8", "Jeremiah 9-11", "Jeremiah 12-15", "Jeremiah 16-19", "Jeremiah 20-23", "Jeremiah 24-26", "Jeremiah 27-30", "Jeremiah 31-32", "Jeremiah 33-35", "Jeremiah 36-39", "Jeremiah 40-43", "Jeremiah 44-48", "Jeremiah 49-50", "Jeremiah 51", "Jeremiah 52; Lamentations 1-2", "Lamentations 3-4", "Lamentations 5; Ezekiel 1-3", "Ezekiel 4-8", "Ezekiel 9-12", "Ezekiel 13-15", "Ezekiel 16-18", "Ezekiel 19-21", "Ezekiel 22-23", "Ezekiel 24-26", "Ezekiel 27-29", "Ezekiel 30-33", "Ezekiel 34-36", "Ezekiel 37-39", "Ezekiel 40-41", "Ezekiel 42-45", "Ezekiel 46-48", "Daniel 1-2", "Daniel 3-5", "Daniel 6-8", "Daniel 9-11", "Daniel 12; Hosea 1-4", "Hosea 5-10", "Hosea 11-14; Joel 1", "Joel 2-3; Amos 1-3", "Amos 4-8", "Amos 9; Obadiah 1; Jonah 1-4", "Micah 1-6", "Micah 7; Nahum 1-3; Habakkuk 1", "Habakkuk 2-3; Zephaniah 1-3", "Haggai 1-2; Zechariah 1-3", "Zechariah 4-8", "Zechariah 9-14", "Malachi 1-4; Matthew 1", "Matthew 2-5", "Matthew 6-7", "Matthew 8-9", "Matthew 10-12", "Matthew 13", "Matthew 14-16", "Matthew 17-18", "Matthew 19-21", "Matthew 22-23", "Matthew 24", "Matthew 25-26", "Matthew 27", "Matthew 28; Mark 1-2", "Mark 3-4", "Mark 5-6", "Mark 7-8", "Mark 9-10", "Mark 11-12", "Mark 13-14", "Mark 15", "Mark 16; Luke 1", "Luke 2-3", "Luke 4-5", "Luke 6-7", "Luke 8", "Luke 9-10", "Luke 11", "Luke 12-13", "Luke 14-16", "Luke 17-18", "Luke 19-20", "Luke 21-22", "Luke 23", "Luke 24; John 1", "John 2-3", "John 4-5", "John 6", "John 7-8", "John 9", "John 10-11", "John 12-13", "John 14-16", "John 17-18", "John 19-21", "Acts 1-3", "Acts 4-5", "Acts 6-7", "Acts 8-9", "Acts 10-12", "Acts 13-14", "Acts 15-16", "Acts 17-19", "Acts 20-21", "Acts 22-23", "Acts 24-26", "Acts 27-28; Romans 1", "Romans 2-3", "Romans 4-7", "Romans 8-10", "Romans 11-13", "Romans 14-16", "1 Corinthians 1-4", "1 Corinthians 5-8", "1 Corinthians 9-11", "1 Corinthians 12-14", "1 Corinthians 15-16", "2 Corinthians 1-4", "2 Corinthians 5-9", "2 Corinthians 10-13", "Galatians 1-3", "Galatians 4-6; Ephesians 1", "Ephesians 2-4", "Ephesians 5-6; Philippians 1", "Philippians 2-4; Colossians 1", "Colossians 2-4; 1 Thessalonians 1", "1 Thessalonians 2-5", "2 Thessalonians 1-3; 1 Timothy 1-2", "1 Timothy 3-6; 2 Timothy 1", "2 Timothy 2-4; Titus 1", "Titus 2-3; Philemon 1; Hebrews 1-2", "Hebrews 3-7", "Hebrews 8-10", "Hebrews 11-12", "Hebrews 13; James 1-3", "James 4-5; 1 Peter 1-2", "1 Peter 3-5; 2 Peter 1", "2 Peter 2-3; 1 John 1-2", "1 John 3-5; 2 John 1; 3 John 1", "Jude 1; Revelation 1-3", "Revelation 4-8", "Revelation 9-13", "Revelation 14-18", "Revelation 19-22"];
  var FRI = ["1 Esdras 1-4", "1 Esdras 5-7", "1 Esdras 8-9; 2 Esdras 1", "2 Esdras 2-4", "2 Esdras 5-8", "2 Esdras 9-11", "2 Esdras 12-14", "2 Esdras 15-16; Tobit 1-2", "Tobit 3-5", "Tobit 6-8", "Tobit 9-12", "Tobit 13-14; Judith 1", "Judith 2-4", "Judith 5-8", "Judith 9-11", "Judith 12-14", "Judith 15-16; Rest of Esther 10-11", "Rest of Esther 12-14", "Rest of Esther 15-16; Wisdom of Solomon 1", "Wisdom of Solomon 2-5", "Wisdom of Solomon 6-8", "Wisdom of Solomon 9-11", "Wisdom of Solomon 12-15", "Wisdom of Solomon 16-18", "Wisdom of Solomon 19; Ecclesiasticus (Sirach) 1-2", "Ecclesiasticus (Sirach) 3-6", "Ecclesiasticus (Sirach) 7-9", "Ecclesiasticus (Sirach) 10-12", "Ecclesiasticus (Sirach) 13-16", "Ecclesiasticus (Sirach) 17-19", "Ecclesiasticus (Sirach) 20-22", "Ecclesiasticus (Sirach) 23-26", "Ecclesiasticus (Sirach) 27-29", "Ecclesiasticus (Sirach) 30-32", "Ecclesiasticus (Sirach) 33-36", "Ecclesiasticus (Sirach) 37-39", "Ecclesiasticus (Sirach) 40-42", "Ecclesiasticus (Sirach) 43-46", "Ecclesiasticus (Sirach) 47-49", "Ecclesiasticus (Sirach) 50-51; Baruch (incl. Epistle of Jeremy) 1", "Baruch (incl. Epistle of Jeremy) 2-5", "Baruch (incl. Epistle of Jeremy) 6; Song of the Three Children 1; Susanna 1", "Bel and the Dragon 1; Prayer of Manasses 1; 1 Maccabees 1", "1 Maccabees 2-5", "1 Maccabees 6-8", "1 Maccabees 9-11", "1 Maccabees 12-15", "1 Maccabees 16; 2 Maccabees 1-2", "2 Maccabees 3-5", "2 Maccabees 6-9", "2 Maccabees 10-12", "2 Maccabees 13-15"];
  var ARMOR = ["'Be strong in the Lord': we wrestle not against flesh and blood (Eph 6:10-13)", "Belt of truth (Eph 6:14)", "Breastplate of righteousness (Eph 6:14)", "Feet shod with the gospel of peace (Eph 6:15)", "Shield of faith: quench the fiery darts (Eph 6:16)", "Helmet of salvation (Eph 6:17)", "Sword of the Spirit, the word of God (Eph 6:17)", "Praying always, watching with perseverance (Eph 6:18)"];
  var SCENE = ["Genesis 3 — the serpent's question: 'Yea, hath God said?'", "Genesis 4 — Cain & Abel: 'Am I my brother's keeper?'", "Genesis 6–7 — Noah hammering while neighbors laugh; the door shuts.", "Genesis 12 — Abram packs up: 'Get thee out… unto a land that I will shew thee.'", "Genesis 16 — Hagar alone in the desert: 'Thou God seest me.'", "Genesis 18 — Sarah laughs: 'Is any thing too hard for the Lord?'", "Genesis 22 — 'God will provide himself a lamb.'", "Genesis 25 — Esau trades his birthright for a bowl of stew.", "Genesis 27 — Jacob in Esau's clothes; the stolen blessing.", "Genesis 28 — 'Surely the Lord is in this place; and I knew it not.'", "Genesis 31 — Rachel hides the idols under the camel saddle.", "Genesis 32 — 'I will not let thee go, except thou bless me.'", "Genesis 37 — Joseph's coat, the dreams, and the pit.", "Genesis 40 — 'But think on me when it shall be well with thee.'"];
  var GROUP_START = '2026-11-22';
  var GROUP_URL = 'https://www.facebook.com/groups/faithandfindingsforum';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function changed() { try { if (window.ccPrefsChanged) window.ccPrefsChanged(); } catch (e) {} }
  function $(id) { return document.getElementById(id); }

  /* ---------- plan + day ---------- */
  function plan() { var p = ls('ccReadPlan'); return (p === 'c2c' || p === 'both') ? p : 'app'; }
  function setPlan(p) { ls('ccReadPlan', p); changed(); redraw(); }
  function redraw() { try { if (typeof window.renderDay === 'function') { window.renderDay(); return; } } catch (e) {} refresh(); }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parse(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function start() { return parse(ls('ccC2CStart')) || parse(GROUP_START); }
  function onDate() { var v = $('entryDate') && $('entryDate').value; var d = parse(v) || new Date(); d.setHours(0, 0, 0, 0); return d; }
  function rawDay() { return Math.round((onDate() - start()) / 864e5) + 1; }
  function day() { return Math.min(365, Math.max(1, rawDay())); }
  function bg(ref) { return 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(ref) + '&version=KJV'; }
  function info(n) {
    var o = { day: n, reading: READ[n - 1] };
    if (n % 7 === 6) o.fri = FRI[(n - 6) / 7];
    if (n % 7 === 4 && (n - 4) / 7 < 8) o.armor = { n: (n - 4) / 7 + 1, t: ARMOR[(n - 4) / 7] };
    if (n % 7 === 0) o.hebrew = true;
    if (n <= SCENE.length) o.scene = SCENE[n - 1];
    return o;
  }
  function done() { try { return JSON.parse(ls('ccC2CDone') || '{}') || {}; } catch (e) { return {}; } }
  function toggleDone(n) { var d = done(); if (d[n]) delete d[n]; else d[n] = 1; ls('ccC2CDone', JSON.stringify(d)); changed(); refresh(); }
  function count() { return Object.keys(done()).length; }

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.c2c-switch{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 16px;padding-bottom:14px;border-bottom:1px solid #55487a}' +
    '.c2c-switch .lbl{font-size:.68em;letter-spacing:2px;text-transform:uppercase;color:var(--gold-soft);font-weight:700;width:100%;margin-bottom:2px}' +
    '.c2c-switch button{background:transparent;border:1px solid #6a5c8e;color:#e6ddf3;border-radius:999px;padding:6px 13px;font:inherit;font-size:.8em;cursor:pointer}' +
    '.c2c-switch button.on{background:var(--gold-soft);border-color:var(--gold-soft);color:var(--plum);font-weight:700}' +
    '.c2c-box{margin-top:14px;padding-top:14px;border-top:1px solid #55487a;font-size:.95em;line-height:1.55}' +
    '.c2c-box .tag{font-size:.7em;letter-spacing:2px;text-transform:uppercase;color:var(--gold-soft);display:block;margin-bottom:6px;font-weight:700}' +
    '.c2c-box .read{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.3em;font-style:italic}' +
    '.c2c-box .extra{margin-top:8px;color:#ffe9b8}' +
    '.c2c-box a{color:var(--gold-soft);font-weight:700;margin-right:16px}' +
    '.c2c-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
    '.c2c-row button{background:transparent;border:1px solid #6a5c8e;color:#e6ddf3;border-radius:999px;padding:6px 13px;font:inherit;font-size:.8em;cursor:pointer}' +
    '.c2c-row button.on{background:#7fb77e;border-color:#7fb77e;color:#14301a;font-weight:700}' +
    '.c2c-catch{display:none;margin-top:10px;font-size:.9em}.c2c-catch.on{display:block}' +
    '.c2c-catch input{width:90px;padding:6px 8px;border-radius:8px;border:1px solid #6a5c8e;margin:0 6px}' +
    '.c2c-fill{margin-top:8px}';
  document.head.appendChild(css);

  /* ---------- the switch (top of the Scripture card) ---------- */
  function switchHtml() {
    var p = plan(), b = function (k, t) { return '<button type="button" data-plan="' + k + '" class="' + (p === k ? 'on' : '') + '">' + t + '</button>'; };
    return '<span class="lbl">Today’s reading plan</span>' + b('app', 'Covenant plan') + b('c2c', 'Reading along: Cover to Cover') + b('both', 'Both');
  }
  function bindSwitch(el) {
    el.addEventListener('click', function (e) { var t = e.target.closest('[data-plan]'); if (t) setPlan(t.getAttribute('data-plan')); });
  }

  /* ---------- the Cover to Cover box ---------- */
  function boxHtml() {
    var n = day(), o = info(n), d = done(), r = rawDay(), own = !!ls('ccC2CStart'), h = '';
    h += '<span class="tag">Cover to Cover · Day ' + n + ' of 365 · King James Version (KJV)</span>';
    if (r < 1) h += '<div class="extra">Cover to Cover starts Sunday, Nov 22, 2026. Here’s Day 1 to get ready.</div>';
    if (r > 365) h += '<div class="extra">You finished the whole Bible, cover to cover. Glory to God! Showing Day 365.</div>';
    h += '<div class="read">' + esc(o.reading) + '</div>';
    if (o.scene) h += '<div class="extra">Today’s scene: ' + esc(o.scene) + '</div>';
    if (o.fri) h += '<div class="extra"><b>Friday Night Special Edition</b> (KJV 1611 Apocrypha): ' + esc(o.fri) + ' · <a href="' + bg(o.fri.replace(/ \(.*?\)/g, '')) + '" target="_blank" rel="noopener">Read it</a></div>';
    if (o.armor) h += '<div class="extra"><b>Wednesday · Putting On the Full Armor of God ' + o.armor.n + ' of 8:</b> ' + esc(o.armor.t) + '</div>';
    if (o.hebrew) h += '<div class="extra"><b>Saturday Hebrew Word Study</b> on this week’s reading is in the group tonight.</div>';
    h += '<div style="margin-top:10px"><a href="' + bg(o.reading) + '" target="_blank" rel="noopener">Read today’s chapters (KJV) &#8599;</a>' +
         '<a href="' + GROUP_URL + '" target="_blank" rel="noopener">Watch & listen in Faith & Findings &#8599;</a></div>';
    h += '<div class="c2c-row"><button type="button" data-c2c="done" class="' + (d[n] ? 'on' : '') + '">' + (d[n] ? '✔ I read Day ' + n : 'Mark Day ' + n + ' read') + '</button>' +
         '<button type="button" data-c2c="catch">' + (own ? 'My day: ' + n + ' · change' : 'Behind or ahead? Set my day') + '</button>' +
         (own ? '<button type="button" data-c2c="group">Back to the group’s day</button>' : '') + '</div>';
    h += '<div class="c2c-catch" id="c2cCatch">I’m on Cover to Cover day <input type="number" min="1" max="365" id="c2cDayIn" value="' + n + '"><button type="button" data-c2c="setday" style="background:var(--gold-soft);color:var(--plum);border:0;border-radius:999px;padding:6px 12px;font-weight:700;cursor:pointer">Set</button>' +
         '<div style="opacity:.8;font-size:.85em;margin-top:4px">It moves forward one day each day from here. The group is on Day ' + Math.min(365, Math.max(1, Math.round((onDate() - parse(GROUP_START)) / 864e5) + 1)) + '.</div></div>';
    h += '<div style="opacity:.8;font-size:.82em;margin-top:8px">' + count() + ' of 365 days read. Switch plans any time with the buttons at the top of this card.</div>';
    return h;
  }
  function bindBox(el) {
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-c2c]'); if (!t) return;
      var a = t.getAttribute('data-c2c');
      if (a === 'done') toggleDone(day());
      else if (a === 'catch') { var c = $('c2cCatch'); if (c) c.classList.toggle('on'); }
      else if (a === 'group') { ls('ccC2CStart', null); changed(); refresh(); }
      else if (a === 'setday') {
        var v = parseInt(($('c2cDayIn') || {}).value, 10); if (!(v >= 1 && v <= 365)) return;
        var s = new Date(onDate()); s.setDate(s.getDate() - (v - 1)); ls('ccC2CStart', ymd(s)); changed(); refresh();
      }
    });
  }

  /* ---------- apply to the Scripture card ---------- */
  var saved = null;
  function refresh() {
    var card = document.querySelector('#dayView .verse-card'); if (!card) return;
    var sw = $('c2cSwitch');
    if (!sw) { sw = document.createElement('div'); sw.id = 'c2cSwitch'; sw.className = 'c2c-switch'; card.insertBefore(sw, card.firstChild); bindSwitch(sw); }
    sw.innerHTML = switchHtml();
    var box = $('c2cBox');
    if (!box) { box = document.createElement('div'); box.id = 'c2cBox'; box.className = 'c2c-box'; var links = card.querySelector('.links'); card.insertBefore(box, links ? links.nextSibling : null); bindBox(box); }
    var p = plan(), main = card.querySelector('.kicker'), q = $('verseQuote'), ref = $('verseRef'), links = card.querySelector('.links');
    box.style.display = p === 'app' ? 'none' : 'block';
    if (p !== 'app') box.innerHTML = boxHtml();
    // Cover to Cover mode: today's reading takes the top of the card (the app's verse comes back with Covenant plan or Both).
    if (p === 'c2c') {
      main.style.display = 'none'; box.style.borderTop = '0'; box.style.marginTop = '0'; box.style.paddingTop = '0';
      q.style.display = 'none'; ref.style.display = 'none'; if (links) links.style.display = 'none';
    } else { main.style.display = ''; box.style.borderTop = ''; box.style.marginTop = ''; box.style.paddingTop = ''; q.style.display = ''; ref.style.display = ''; if (links) links.style.display = ''; }
    var s = $('c2cSettings'); if (s) s.innerHTML = settingsHtml();
    var f = $('c2cFillBtn'); if (f) { f.style.display = p === 'app' ? 'none' : 'inline-block'; f.textContent = 'Use today’s Cover to Cover reading (' + READ[day() - 1] + ')'; }
  }

  /* wrap the app's renderDay so every day/date change also updates this (the original runs first, untouched) */
  function wrap() {
    if (typeof window.renderDay !== 'function' || window.renderDay.__c2c) return;
    var orig = window.renderDay;
    var w = function () { var r = orig.apply(this, arguments); try { refresh(); } catch (e) {} return r; };
    w.__c2c = true; window.renderDay = w;
  }

  /* ---------- "In the Word": one tap fills "What did you read today?" ---------- */
  function addFill() {
    var inp = $('bibleReading'); if (!inp || $('c2cFillBtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'c2cFillBtn'; b.className = 'btn ghost small c2c-fill';
    b.onclick = function () { var r = READ[day() - 1] + ' (KJV, Cover to Cover Day ' + day() + ')'; inp.value = inp.value.trim() ? inp.value.trim() + '; ' + r : r; inp.dispatchEvent(new Event('input', { bubbles: true })); };
    inp.parentNode.insertBefore(b, inp.nextSibling);
  }

  /* ---------- Settings card ---------- */
  function settingsHtml() {
    var p = plan(), b = function (k, t, d) { return '<label style="display:flex;gap:8px;align-items:flex-start;margin:8px 0;cursor:pointer"><input type="radio" name="c2cPlan" value="' + k + '"' + (p === k ? ' checked' : '') + ' style="width:auto;margin-top:4px"><span><b>' + t + '</b><br><span class="hint">' + d + '</span></span></label>'; };
    return '<h3>Reading Plan</h3><p class="hint">Reading along with Cover to Cover in the Faith &amp; Findings Forum? Set your app to it. You can switch back and forth any time.</p>' +
      b('app', 'Covenant plan', 'The app’s own daily Scripture for your covenant day.') +
      b('c2c', 'Reading along: Cover to Cover', 'Your Scripture card follows the whole-Bible read, Genesis to Revelation in 365 days (KJV), with Friday Apocrypha and Wednesday Full Armor of God. Your Daily Focus and extras stay.') +
      b('both', 'Both', 'Keep the app’s verse and add today’s Cover to Cover reading under it.') +
      '<p class="hint">Today: Cover to Cover Day ' + day() + ' — ' + esc(READ[day() - 1]) + '. ' + count() + ' of 365 days marked read.</p>';
  }
  function addSettings() {
    var v = $('settingsView'); if (!v || $('c2cSettings')) return;
    var c = document.createElement('div'); c.className = 'card'; c.id = 'c2cSettings'; c.innerHTML = settingsHtml();
    c.addEventListener('change', function (e) { if (e.target && e.target.name === 'c2cPlan') setPlan(e.target.value); });
    v.insertBefore(c, v.firstChild);
  }

  /* ---------- account sync: these keys ride along with the app's saved settings ---------- */
  window.ccC2CApply = function () { redraw(); };

  function init() { wrap(); addFill(); addSettings(); refresh(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 1500);
  window.addEventListener('storage', function (e) { if (/^ccReadPlan|^ccC2C/.test(e.key || '')) redraw(); });
})();
