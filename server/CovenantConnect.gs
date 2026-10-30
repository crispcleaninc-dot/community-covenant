/******************************************************************************
 * COVENANT CONNECT v1.6 (2026-10-30) — ADDITIVE. Must load AFTER CovenantPlus.gs
 * (keep it as the LAST file in the project). Nothing in Code.gs or
 * CovenantPlus.gs is edited; every wrapper calls the function that was there.
 *
 * WHAT IT ADDS
 *  1. GitHub bridge — doPost() lets the GitHub-hosted app call the same
 *     functions the old page called (only the 20 the app uses + chat).
 *     Session/privacy checks from CovenantPlus still apply to every call.
 *  2. Old link forwarding — if Script Property APP_HOME_URL is set, the bare
 *     script link sends people to the GitHub app. ?classic=1 still opens the
 *     old page. Verify-email and reset-password links keep working here.
 *  3. Same-day replies — every sealed log is queued; every 10 minutes the
 *     queue is answered by email: a personal reply to what they wrote (and
 *     their questions), a deeper reading, encouragement, and a "Chat with the
 *     team" button. Uses Claude if ANTHROPIC_API_KEY is set; otherwise a
 *     personal template reply built from their own words.
 *     SAFETY: anything that reads like crisis/self-harm is NOT answered by
 *     the machine — the member gets 988 + Crisis Text Line right away, you
 *     get an URGENT email, and the row is HELD for a person to reply.
 *  4. Team chat — members chat with the team in the app (chat.html); the
 *     team answers from team.html with the TEAM_PIN. Member gets an email
 *     (and a phone notification if push is set up) when the team replies.
 *  5. Push notifications (OneSignal) — off until ONESIGNAL_APP_ID and
 *     ONESIGNAL_REST_KEY are set. Then: reply-ready, team-reply, and a daily
 *     morning + evening nudge.
 *
 * SCRIPT PROPERTIES (Project Settings → Script properties)
 *  APP_HOME_URL        https://crispcleaninc-dot.github.io/community-covenant/app/
 *  TEAM_PIN            code for the team page (6+ characters)
 *  ANTHROPIC_API_KEY   optional — turns on AI-written replies
 *  ANTHROPIC_MODEL     optional — default claude-sonnet-5-5
 *  ONESIGNAL_APP_ID / ONESIGNAL_REST_KEY   optional — phone notifications
 *  REPLIES             set to OFF to pause automatic replies
 *  CARE_ALERT_EMAIL    (already used by CovenantPlus) where alerts go
 *
 * ONE-TIME SETUP: set EDITOR_RUN_UNTIL, then run installCovenantConnect().
 ******************************************************************************/

var CCX = {
  VERSION: '1.6 (2026-10-30)',
  REPLY_SHEET: 'Covenant — Daily Replies',
  CHAT_SHEET: 'Covenant — Team Chat',
  OPTOUT_SHEET: 'Covenant — Email Opt-Outs',
  MAX_REPLIES_PER_DAY: 4,
  MAX_PER_SWEEP: 20,
  TEAM_NAME: 'The Community Covenant Team',
  BRIDGE: ['registerUser', 'loginUser', 'requestPasswordReset', 'resetPassword', 'getUserProfile',
    'updateUserProfile', 'logHelpQuestion', 'updateFastType', 'saveEntry', 'getUserEntries',
    'saveWorkbookProgress', 'getWorkbookProgress', 'getMusicPlaylist', 'addUserSong',
    'seekFirstGet', 'seekFirstSave', 'getReelAudio', 'getReelsMusic', 'logSongFeedback',
    'altarSave', 'altarGet', 'askCovenant', 'replyNow',
    'chatSend', 'chatGet', 'teamThreads', 'teamThread', 'teamReply', 'teamMarkDone', 'connectInfo']
};

var CCX_CRISIS = ['suicide', 'suicidal', 'kill myself', 'killing myself', 'end my life', 'ending my life',
  'want to die', 'wanna die', 'self harm', 'self-harm', 'hurt myself', 'hurting myself', 'cutting myself',
  "don't want to live", 'don’t want to live', 'dont want to live', 'no reason to live', 'better off dead',
  'end it all', "can't go on", 'can’t go on', 'cant go on', 'not worth living', 'take my life',
  'take my own life', 'overdose', 'no way out', 'goodbye forever'];

/* ============================== helpers ================================= */
function ccxProp_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || ''); } catch (e) { return ''; } }
function ccxHome_() { var u = ccxProp_('APP_HOME_URL'); return u ? u.replace(/\/?$/, '/') : ''; }
function ccxSite_() { return ccxHome_().replace(/app\/$/, ''); }
function ccxEsc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function ccxFirst_(name) { return String(name || 'friend').trim().split(/\s+/)[0] || 'friend'; }
function ccxToday_() { return Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd'); }
function ccxSheet_(name, header) {
  var root = getRootFolder_(), it = root.getFilesByName(name), ss;
  if (it.hasNext()) ss = SpreadsheetApp.openById(it.next().getId());
  else {
    ss = SpreadsheetApp.create(name);
    ss.getActiveSheet().appendRow(header);
    ss.getActiveSheet().setFrozenRows(1);
    DriveApp.getFileById(ss.getId()).moveTo(root);
  }
  return ss.getActiveSheet();
}
function ccxReplySheet_() {
  return ccxSheet_(CCX.REPLY_SHEET, ['Queued At', 'Email', 'Name', 'User ID', 'Day', 'Theme', 'Check-in',
    'What they wrote (JSON)', 'Status', 'Flag', 'Sent At', 'Reply Preview', 'Date', 'Tab', 'Last Typed', 'Already Answered (JSON)']);
}
function ccxChatSheet_() {
  return ccxSheet_(CCX.CHAT_SHEET, ['Timestamp', 'Member Email', 'Name', 'User ID', 'From', 'Message', 'Signed In', 'Status']);
}
function ccxSecret_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty('CONNECT_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('CONNECT_SECRET', s); }
  return s;
}
function ccxSig_(email) {
  var b = Utilities.computeHmacSha256Signature(String(email).toLowerCase().trim(), ccxSecret_());
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/, '').slice(0, 22);
}
function ccxOptedOut_(email) {
  var e = String(email).toLowerCase().trim();
  var v = ccxSheet_(CCX.OPTOUT_SHEET, ['Email', 'Opted Out At']).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).toLowerCase().trim() === e) return true;
  return false;
}
function ccxHasCrisis_(text) {
  var t = String(text || '').toLowerCase();
  for (var i = 0; i < CCX_CRISIS.length; i++) if (t.indexOf(CCX_CRISIS[i]) !== -1) return CCX_CRISIS[i];
  return '';
}
function ccxSession_(args) {
  var a = Array.prototype.slice.call(args), tok = '';
  if (a.length && cvpIsTok_(a[a.length - 1])) tok = a.pop();
  return { args: a, s: cvpSession_(tok) };
}

/* ======================= 1. GitHub bridge (doPost) ======================= */
function doPost(e) {
  var out = { ok: false };
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = String(body.fn || ''), args = Array.isArray(body.args) ? body.args : [];
    if (CCX.BRIDGE.indexOf(fn) === -1 || typeof globalThis[fn] !== 'function') throw new Error('Unknown action: ' + fn);
    out = { ok: true, result: globalThis[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out === undefined ? null : out)).setMimeType(ContentService.MimeType.JSON);
}

/** Public settings the app needs (no secrets). */
function connectInfo() {
  return { version: CCX.VERSION, onesignalAppId: ccxProp_('ONESIGNAL_APP_ID'), home: ccxHome_() };
}

/* ======================= 2. Old link forwarding ========================== */
var _ccx_doGet = doGet;
doGet = function (e) {
  var p = (e && e.parameter) || {};
  if (p.optout) return ccxOptOutPage_(p.optout, p.sig);
  var home = ccxHome_();
  if (home && !p.verify && !p.reset && !p.classic) {
    var u = ccxEsc_(home);
    return HtmlService.createHtmlOutput('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Community Covenant</title></head><body style="font-family:Georgia,serif;background:#faf6ee;color:#372b4e;text-align:center;padding:60px 20px">' +
      '<h2>Community Covenant has a new home</h2><p>Taking you there now&hellip;</p>' +
      '<p><a href="' + u + '" target="_top" style="color:#8a6d3b;font-weight:bold">Open Community Covenant</a></p>' +
      '<script>try{window.top.location.href=' + JSON.stringify(home) + ';}catch(x){location.href=' + JSON.stringify(home) + ';}<\/script></body></html>')
      .setTitle('Community Covenant').addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var out = _ccx_doGet(e);
  // Verify / reset pages: "Go to App" buttons should land on the new home.
  if (home && (p.verify || p.reset)) {
    try { out.setContent(out.getContent().split(ScriptApp.getService().getUrl()).join(home)); } catch (x) {}
  }
  return out;
};

function ccxOptOutPage_(email, sig) {
  var ok = email && sig && sig === ccxSig_(email);
  if (ok && !ccxOptedOut_(email)) ccxSheet_(CCX.OPTOUT_SHEET, ['Email', 'Opted Out At']).appendRow([String(email).toLowerCase().trim(), new Date()]);
  return HtmlService.createHtmlOutput('<div style="font-family:Georgia,serif;text-align:center;padding:60px 20px;color:#372b4e">' +
    (ok ? '<h2>You will not get daily reply emails anymore.</h2><p>Your covenant, logs and team chat are untouched. To turn replies back on, message the team in the app.</p>'
        : '<h2>That link did not work.</h2><p>Message the team in the app and we will take care of it.</p>') + '</div>');
}

/* ======================= 3. Same-day replies ============================= */
/* Every place a member types counts: the Day Page log, Seek First notes,
 * the Daily Altar, and My Workbook answers. New writing is queued per member,
 * per day, per tab. Once it has "settled" (no typing for 8 minutes — the
 * workbook auto-saves as they type) the sweep answers all of it in one email.
 * Text already answered is remembered, so nothing is answered twice. */
CCX.SETTLE_MIN = 3;

var CCX_MODELS = ['claude-sonnet-5-5', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest'];
function ccxClaudeRaw_(system, user, maxTokens) {
  var key = ccxProp_('ANTHROPIC_API_KEY').trim();
  if (!key) return { error: 'no key' };
  var models = (ccxProp_('ANTHROPIC_MODEL') ? [ccxProp_('ANTHROPIC_MODEL')] : []).concat(CCX_MODELS), last = '';
  for (var i = 0; i < models.length; i++) {
    try {
      var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        payload: JSON.stringify({ model: models[i], max_tokens: Math.max(maxTokens || 1200, 3000), system: system, messages: [{ role: 'user', content: user }] })
      });
      var code = res.getResponseCode(), body = res.getContentText();
      if (code === 200) {
        if (ccxProp_('ANTHROPIC_MODEL') !== models[i]) try { PropertiesService.getScriptProperties().setProperty('ANTHROPIC_MODEL', models[i]); } catch (x) {}
        var J = JSON.parse(body);
        return { text: J.content.map(function (c) { return c.text || ''; }).join(''), model: models[i], cut: J.stop_reason === 'max_tokens' };
      }
      last = code + ': ' + body.slice(0, 300);
      Logger.log('Claude ' + models[i] + ' ' + last);
      if (code !== 404 && code !== 400) break; // only try another model when this one isn't available
    } catch (x) { last = String(x); Logger.log('Claude failed: ' + x); break; }
  }
  return { error: last };
}
function ccxTag_(t, tag) { var m = String(t).match(new RegExp('<' + tag + '>([\\s\\S]*?)(</' + tag + '>|<(?:reply|reflection|scriptures|next|followup|concern)>|$)', 'i')); return m ? m[1].trim() : ''; }
function ccxParas_(t) { return String(t || '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s*\n\s*/g, ' ').trim(); }).filter(function (p) { return p; }); }
/** Asks Claude and reads its answer from simple tags (no JSON, so quotes in the text can never break it). */
function ccxClaude_(system, user, maxTokens) {
  var fmt = '\n\nWrite your answer in exactly this layout (plain text inside the tags, no JSON, no markdown). The <reply> section is REQUIRED and must contain the full message:\n' +
    '<reply>\nParagraph one...\n\nParagraph two...\n</reply>\n<reflection>two sentences</reflection>\n<scriptures>\nReference | short KJV quote\nReference | short KJV quote\n</scriptures>\n<next>one practical next step</next>\n<followup>yes or no</followup>\n<concern>yes or no</concern>';
  var r = null;
  for (var attempt = 0; attempt < 2; attempt++) {
    r = ccxClaudeRaw_(system, user + fmt, maxTokens);
    if (!r.text) return null;
    if ((/<reply>[\s\S]*?\S[\s\S]*?<\/reply>/i.test(r.text) && !r.cut) || /^y/i.test(ccxTag_(r.text, 'concern'))) break;
    Logger.log('Claude reply missing <reply> (try ' + (attempt + 1) + '): ' + r.text.slice(0, 200));
  }
  var t = r.text, out = { concern: /^y/i.test(ccxTag_(t, 'concern')) };
  out.paragraphs = ccxParas_(ccxTag_(t, 'reply') || ccxTag_(t, 'body'));
  if (!out.paragraphs.length) out.paragraphs = ccxParas_(t.replace(/<(concern|reflection|scriptures|next|followup)>[\s\S]*?<\/\1>/gi, '').replace(/<\/?\w+>/g, '')); // untagged answer
  out.answer = out.paragraphs;
  out.reflection = ccxTag_(t, 'reflection');
  out.scriptures = ccxTag_(t, 'scriptures').split(/\n/).map(function (l) { var p = l.replace(/^[-*\u2022\s]+/, '').split('|'); return p.length > 1 ? { ref: p[0].trim(), text: p.slice(1).join('|').trim().replace(/^["\u201C]|["\u201D]$/g, '') } : null; }).filter(function (x) { return x && x.ref; });
  out.next_step = ccxTag_(t, 'next');
  out.follow_up = /^y/i.test(ccxTag_(t, 'followup'));
  if (!out.paragraphs.length && !out.concern) { Logger.log('Claude reply had no body: ' + t.slice(0, 300)); return null; }
  return out;
}
/** Owner-only check: run from the editor to see if AI replies are working. */
function covenantAiTest() {
  var r = ccxClaudeRaw_('Reply with the single word OK.', 'Say OK', 20);
  var msg = r.text ? ('AI is working (' + r.model + '): ' + r.text) : ('AI NOT working: ' + r.error);
  Logger.log(msg); return msg;
}

var CCX_VOICE = 'You write for Community Covenant, a Christian daily-covenant app whose mission is: "you are not alone. Keep pushing one more day. Don\'t give up in God." ' +
  'You speak for the Community Covenant team: warm, pastoral, plain words, no emojis, never preachy. Ground what you say in Scripture with KJV references and short KJV quotations you are certain of. ' +
  'When Christians genuinely differ on something (for example divorce and remarriage, or end times), say so kindly, show the main scriptural views, and point them to their pastor. ' +
  'Never give medical, legal, or financial instructions; for those, encourage a doctor, counselor, attorney, or advisor. Never claim to be a person. Do not sign the message. Speak to the member directly as "you" everywhere (including the reflection); never guess their gender and never refer to them as he or she. ' +
  'If the member is a child (Under 12 or Teen age group), write simply and kindly for that age. Their religion is given; the app also offers Apocrypha and Quran readings, so be respectful of other faiths without debating. ';

function ccxLabelText_(source, obj) {
  var out = [];
  var LBL = { word: 'The Word', prayer: 'Prayer', community: 'Community', serving: 'Serving', love: 'Love people', career: 'Career', relationships: 'Relationships',
    finances: 'Finances', peace: 'Peace', purpose: 'Purpose', why: 'Why I am seeking first', note: 'Reflection', pnote: 'Prayer note', read: 'What I read' };
  (function walk(v, path) {
    if (v == null) return;
    if (typeof v === 'string') {
      var t = v.trim();
      if (t.length >= 4 && /[a-z]{2}/i.test(t) && !/^\d{4}-\d{2}-\d{2}/.test(t) && !/^https?:\/\//.test(t) && !/^(true|false|verse|chapter|ready|tired|heavy|dontfeel|numb)$/i.test(t))
        out.push({ label: source + (path ? ' — ' + path : ''), text: t.slice(0, 600) });
      return;
    }
    if (typeof v !== 'object') return;
    Object.keys(v).forEach(function (k) {
      if (/^(at|id|ts|time|date|mode|feel|mins)$/i.test(k)) return;
      var lab = LBL[k] || (/^\d+$/.test(k) ? '' : k.replace(/[_-]+/g, ' '));
      walk(v[k], [path, lab].filter(function (x) { return x; }).join(' › ').slice(0, 80));
    });
  })(obj, '');
  return out;
}

/** Adds newly written text for one member / tab / day to the queue (one row, updated as they type). */
function ccxQueueText_(email, name, userId, source, items) {
  email = String(email || '').toLowerCase().trim();
  if (!email || !items.length) return;
  var sh = ccxReplySheet_(), v = sh.getDataRange().getValues(), today = ccxToday_(), now = new Date();
  for (var i = v.length - 1; i >= 1; i--) {
    if (String(v[i][1]).toLowerCase().trim() !== email || String(v[i][13]) !== source || ccxRowDate_(v[i][12]) !== today) continue;
    var have = []; try { have = JSON.parse(v[i][7] || '[]'); } catch (x) {}
    var done = []; try { done = JSON.parse(v[i][15] || '[]'); } catch (x) {}
    var seen = {}; have.concat(done).forEach(function (h) { seen[h.text] = 1; });
    var add = items.filter(function (it) { return !seen[it.text]; });
    if (!add.length) return;
    var st = String(v[i][8]);
    var keep = (st === 'QUEUED') ? have : [];
    sh.getRange(i + 1, 8, 1, 2).setValues([[JSON.stringify(keep.concat(add)).slice(0, 45000), 'QUEUED']]);
    sh.getRange(i + 1, 15).setValue(now);
    return;
  }
  sh.appendRow([now, email, name || '', userId || '', '', '', '', JSON.stringify(items).slice(0, 45000), 'QUEUED', '', '', '', today, source, now, '[]']);
}
function ccxRowDate_(v) { return v instanceof Date ? Utilities.formatDate(v, 'America/New_York', 'yyyy-MM-dd') : String(v || ''); }

function ccxProfileName_(email) {
  try { var p = (typeof _ccx_profile === 'function') ? _ccx_profile(email) : null; return p || {}; } catch (x) { return {}; }
}

// ---- Day Page: every sealed log (wraps the CovenantPlus-protected saveEntry) ----
var _ccx_saveEntry = saveEntry;
saveEntry = function () {
  var a = Array.prototype.slice.call(arguments);
  var res = _ccx_saveEntry.apply(this, a);
  try {
    if (res && res.success) {
      var d = a[3] || {}, json = JSON.stringify(d), now = new Date();
      if (json.length > 45000) json = json.slice(0, 45000);
      ccxReplySheet_().appendRow([now, String(a[1] || '').toLowerCase().trim(), d.name || '', a[0] || '', a[2] || '',
        d.theme || '', d.checkinType || '', json, 'QUEUED', '', '', '', ccxToday_(), 'Day Page', new Date(now.getTime() - CCX.SETTLE_MIN * 60000), '[]']);
      res.replyQueued = true;
      if (ccxHasCrisis_(ccxEntryText_(d))) ccxSweepNow_();
    }
  } catch (x) { Logger.log('reply queue: ' + x); }
  return res;
};

// ---- Seek First / Daily Altar / My Workbook: only text that is new since the last save ----
function ccxWatch_(orig, source, readOld, dataIdx) {
  return function () {
    var a = Array.prototype.slice.call(arguments), before = [];
    try { before = ccxLabelText_(source, readOld(a)); } catch (x) {}
    var res = orig.apply(this, a);
    try {
      if (res && res.success !== false) {
        var data = a[dataIdx]; if (typeof data === 'string') { try { data = JSON.parse(data); } catch (x) {} }
        var old = {}; before.forEach(function (b) { old[b.text] = 1; });
        var fresh = ccxLabelText_(source, data).filter(function (it) { return !old[it.text]; });
        if (fresh.length) {
          var p = ccxProfileName_(a[1]);
          ccxQueueText_(a[1], p.name || '', a[0], source, fresh);
          if (ccxHasCrisis_(fresh.map(function (f) { return f.text; }).join(' '))) ccxSweepNow_();
        }
      }
    } catch (x) { Logger.log('watch ' + source + ': ' + x); }
    return res;
  };
}
var _ccx_profile = function (email) {
  var v = getOrCreateUsersSheet_().getDataRange().getValues(), e = String(email || '').toLowerCase().trim(), hit = null;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).toLowerCase().trim() === e) hit = { name: String(v[i][2] || ''), age: String(v[i][15] || ''), religion: String(v[i][22] || ''), userId: String(v[i][3] || '') };
  return hit;
};
seekFirstSave = ccxWatch_(seekFirstSave, 'Seek First', function (a) {
  if (!cvpSession_(a[a.length - 1])) return {}; return (cvpSeekRead_(a[0], a[1]).data || {})[a[2]] || {};
}, 3);
altarSave = ccxWatch_(altarSave, 'Daily Altar', function (a) {
  if (!cvpSession_(a[a.length - 1])) return {}; return (altarRead_(a[0], a[1]).data || {})[a[2]] || {};
}, 3);
saveWorkbookProgress = ccxWatch_(saveWorkbookProgress, 'My Workbook', function (a) {
  if (!cvpSession_(a[a.length - 1])) return {};
  var f = getUserFolder_(a[0], a[1], null), it = f && f.getFilesByName('workbook-progress.json');
  if (!it || !it.hasNext()) return {};
  try { return JSON.parse(it.next().getBlob().getDataAsString() || '{}'); } catch (x) { return {}; }
}, 2);

function ccxSweepNow_() { var was = CVP.trusted; CVP.trusted = true; try { covenantReplySweep(); } finally { CVP.trusted = was; } }

function ccxEntryText_(d) {
  d = d || {};
  if (Array.isArray(d)) return d.map(function (x) { return x.text; }).join(' \n ');
  var g = (d.gratitudes || []).filter(function (x) { return x; });
  return [d.docText, d.bibleReading, d.learned, d.revelation, d.message, g.join('; '), d.notes, d.wellbeingNote, d.cornerNote, d.cornerShare].join(' \n ');
}
function ccxQuestions_(d) {
  var t = Array.isArray(d) ? d.map(function (x) { return x.text; }).join(' \n ') : [d.docText, d.learned, d.revelation, d.notes, d.wellbeingNote, d.cornerNote, d.cornerShare].join(' \n ');
  var m = t.match(/[^.!?\n]{6,240}\?/g) || [];
  return m.map(function (q) { return q.trim(); }).slice(0, 6);
}

/** Runs every 10 minutes (installed by installCovenantConnect). */
function covenantReplySweep(e) { return ccxProcess_({}); }
function ccxProcess_(opt) {
  opt = opt || {};
  if (ccxProp_('REPLIES').toUpperCase() === 'OFF') return 'paused';
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(opt.onlyEmail ? 20000 : 5000)) return 'busy';
  try {
    var sh = ccxReplySheet_(), v = sh.getDataRange().getValues(), today = ccxToday_(), settle = Date.now() - CCX.SETTLE_MIN * 60000;
    var groups = {}, order = [], sentToday = {};
    for (var i = 1; i < v.length; i++) {
      var em = String(v[i][1]).toLowerCase().trim(), st = String(v[i][8]), rd = ccxRowDate_(v[i][12]);
      if (/^(SENT|HELD)/.test(st) && ccxRowDate_(v[i][10]) === today) { (sentToday[em] = sentToday[em] || {})[String(v[i][10])] = 1; }
      if (st !== 'QUEUED' || !em) continue;
      if (opt.onlyEmail && em !== opt.onlyEmail) continue;
      if (rd && rd !== today) { sh.getRange(i + 1, 9).setValue('MISSED (older than today)'); continue; }
      if (!groups[em]) { groups[em] = { rows: [], settled: true }; order.push(em); }
      groups[em].rows.push(i + 1);
      var up = v[i][14] instanceof Date ? v[i][14].getTime() : 0;
      if (!opt.now && up > settle && !ccxHasCrisis_(String(v[i][7]))) groups[em].settled = false; // still typing — wait
    }
    var done = 0;
    for (var k = 0; k < order.length && done < CCX.MAX_PER_SWEEP; k++) {
      var email = order[k], g = groups[email];
      if (!g.settled) continue;
      var rows = g.rows.map(function (r) { return { r: r, v: sh.getRange(r, 1, 1, 16).getValues()[0] }; });
      var parts = rows.map(function (x) {
        var d = {}; try { d = JSON.parse(x.v[7]); } catch (y) {}
        if (d && d.docText && !Array.isArray(d)) { var pd = ccxParseDoc_(d.docText); Object.keys(pd).forEach(function (k) { if (!d[k]) d[k] = pd[k]; }); }
        return { source: x.v[13] || 'Day Page', data: d, day: x.v[4], name: x.v[2], userId: x.v[3] };
      });
      var allText = parts.map(function (p) { return ccxEntryText_(p.data); }).join('\n');
      var who = { email: email, name: (parts.filter(function (p) { return p.name; })[0] || {}).name || '', userId: (parts.filter(function (p) { return p.userId; })[0] || {}).userId || '' };
      var prof = _ccx_profile(email) || {}; who.name = who.name || prof.name; who.userId = who.userId || prof.userId; who.age = prof.age || ''; who.religion = prof.religion || '';
      var crisis = ccxHasCrisis_(allText);
      var mark = function (status, flag, preview) {
        rows.forEach(function (x) {
          sh.getRange(x.r, 9, 1, 4).setValues([[status, flag, new Date(), preview]]);
          var dd = null; try { dd = JSON.parse(x.v[7] || 'null'); } catch (y) {}
          if (Array.isArray(dd)) {
            var prev = []; try { prev = JSON.parse(x.v[15] || '[]'); } catch (y) {}
            sh.getRange(x.r, 16).setValue(JSON.stringify(prev.concat(dd)).slice(0, 45000));
          }
        });
      };
      if (crisis) { ccxCrisisCare_(email, who, crisis, allText); mark('HELD', 'CRISIS: ' + crisis, 'Care email + 988 sent; waiting for a person'); done++; continue; }
      if (ccxOptedOut_(email)) { mark('OPTED OUT', '', ''); continue; }
      if (!opt.ignoreCap && Object.keys(sentToday[email] || {}).length >= CCX.MAX_REPLIES_PER_DAY) { mark('NO REPLY (daily limit)', '', 'Already answered ' + CCX.MAX_REPLIES_PER_DAY + ' times today'); continue; }
      if (MailApp.getRemainingDailyQuota() < 5) break; // keep a few for crisis alerts; the rest wait
      var r = ccxSendReply_(who, parts);
      mark(r.status, r.flag, r.preview);
      done++;
    }
    if (!opt.onlyEmail) done += ccxAnswerHelpBacklog_();
    return 'replied to ' + done;
  } finally { lock.releaseLock(); }
}

function ccxCrisisCare_(email, who, term, allText) {
  var first = ccxFirst_(who.name), chat = ccxSite_() ? ccxSite_() + 'chat.html' : '';
  var html = ccxFrame_('You are not alone, ' + ccxEsc_(first),
    '<p>Hi ' + ccxEsc_(first) + ',</p>' +
    '<p>We read what you shared today, and we want you to know you matter and you are not alone. A person from our team is going to reach out to you personally.</p>' +
    '<div style="background:#fbe9e4;border-radius:10px;padding:16px 18px;margin:18px 0;color:#7a2f18">' +
    '<b>If you are thinking about ending your life or hurting yourself, please reach out right now:</b><br>' +
    '&bull; Call or text <b>988</b> (Suicide &amp; Crisis Lifeline, any time, free)<br>' +
    '&bull; Text <b>HOME</b> to <b>741741</b> (Crisis Text Line)<br>' +
    '&bull; If you are in danger right now, call <b>911</b><br>' +
    '&bull; Tell someone you trust who is near you today</div>' +
    '<p style="font-style:italic;color:#4a3f66">&ldquo;The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.&rdquo; &mdash; Psalm 34:18</p>' +
    (chat ? ccxButton_(chat, 'Talk with the team') : ''), email, false);
  GmailApp.sendEmail(email, 'You are not alone — Community Covenant', 'Call or text 988 any time. Text HOME to 741741. A person from our team will reach out to you.', { htmlBody: html, name: CCX.TEAM_NAME });
  GmailApp.sendEmail(GMAIL_ADDRESS, 'URGENT — Covenant member may be in crisis',
    'Something a member wrote in the app contains crisis language ("' + term + '").\n\nName: ' + (who.name || '') + '\nEmail: ' + email + '\nUser ID: ' + (who.userId || '') +
    '\n\nThey were emailed 988 and Crisis Text Line just now. NO automatic reply was sent — please reach out personally as soon as you can.' +
    (ccxSite_() ? '\n\nTeam desk: ' + ccxSite_() + 'team.html' : '') + '\n\nWhat they wrote:\n' + String(allText).slice(0, 3000));
  ccxPush_([who.userId], 'We’re here with you', 'Call or text 988 any time. A person from our team will reach out.', chat);
}

function ccxSendReply_(who, parts) {
  var email = who.email, first = ccxFirst_(who.name);
  var dayParts = parts.filter(function (p) { return p.source === 'Day Page'; });
  var tabParts = parts.filter(function (p) { return p.source !== 'Day Page'; });
  var d = dayParts.length ? dayParts[dayParts.length - 1].data : {};
  var day = Number(dayParts.length ? dayParts[dayParts.length - 1].day : 0) || ccxMemberDay_(email);
  var reading = CCX_DEEPER[(day - 1) % CCX_DEEPER.length];
  var questions = [];
  parts.forEach(function (p) { questions = questions.concat(ccxQuestions_(p.data)); });
  var hard = dayParts.some(function (p) { return /really hard|struggling/i.test(String(p.data.feeling || '')); });
  var ai = ccxAiReply_(who, dayParts, tabParts, reading, questions), body, flag = '';
  if (ai && ai.concern) {
    ccxCrisisCare_(email, who, 'AI flagged concern', parts.map(function (p) { return ccxEntryText_(p.data); }).join('\n'));
    return { status: 'HELD', flag: 'AI CONCERN', preview: 'Care email + 988 sent; waiting for a person' };
  }
  if (ai && ai.paragraphs && ai.paragraphs.length) {
    body = ai.paragraphs.map(function (p) { return '<p>' + ccxEsc_(p) + '</p>'; }).join('');
    flag = 'AI';
  } else {
    body = ccxTemplateBody_(dayParts, tabParts, questions, day);
    flag = questions.length ? 'QUESTION (team to follow up)' : 'TEMPLATE';
    if (questions.length) GmailApp.sendEmail(GMAIL_ADDRESS, 'Covenant — ' + (who.name || email) + ' asked a question in the app',
      (who.name || '') + ' (' + email + ') asked:\n\n' + questions.join('\n') + '\n\nThey got the automatic reply (AI answers turn on once ANTHROPIC_API_KEY is set). Answer them in the team desk: ' + ccxSite_() + 'team.html');
  }
  flag += ' [' + parts.map(function (p) { return p.source; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).join(', ') + ']';
  if (hard) {
    body += '<div style="background:#f6efe2;border-radius:10px;padding:14px 16px;margin:16px 0">You told us today was hard. That is honest, and it is welcome here. If it gets heavier, call or text <b>988</b> any time, and tap the chat button below &mdash; a real person on our team will answer.</div>';
    GmailApp.sendEmail(GMAIL_ADDRESS, 'Covenant — ' + (who.name || email) + ' said today was hard', (who.name || '') + ' (' + email + ') marked their feeling as "' + d.feeling + '" on Day ' + day + '. They got a reply with 988 and the chat link. A personal check-in would mean a lot.\n\n' + ccxSite_() + 'team.html');
    flag += ' + FEELING CHECK-IN';
  }
  var readingHtml = '<div style="border-left:3px solid #b8964f;padding:4px 0 4px 16px;margin:22px 0">' +
    '<div style="font:600 12px Arial;letter-spacing:2px;color:#8a6d3b;text-transform:uppercase">Go deeper today</div>' +
    '<div style="font:600 19px Georgia;color:#372b4e;margin:6px 0">' + ccxEsc_(reading.ref) + '</div>' +
    '<div style="font-style:italic;color:#4a3f66;margin-bottom:8px">&ldquo;' + ccxEsc_(reading.text) + '&rdquo;</div>' +
    '<p style="margin:6px 0">' + ccxEsc_((ai && ai.reflection) || reading.reflect) + '</p>' +
    '<p style="margin:6px 0"><b>Try this:</b> ' + ccxEsc_(reading.practice) + '</p>' +
    '<p style="margin:6px 0"><a style="color:#8a6d3b" href="https://www.biblegateway.com/passage/?search=' + encodeURIComponent(reading.read) + '&version=KJV">Read the whole passage: ' + ccxEsc_(reading.read) + '</a></p></div>';
  var chat = ccxSite_() ? ccxSite_() + 'chat.html' : '';
  var title = dayParts.length ? 'Day ' + day + ' — we read your log' : 'We read what you wrote today';
  var html = ccxFrame_(title,
    '<p>Hi ' + ccxEsc_(first) + ',</p>' + body + readingHtml +
    '<p style="font-style:italic">' + ccxEsc_(CCX_ENCOURAGE[(day - 1) % CCX_ENCOURAGE.length]) + '</p>' +
    '<div style="background:#372b4e;color:#faf6ee;border-radius:12px;padding:18px;text-align:center;margin:22px 0">' +
    '<div style="font:600 18px Georgia;margin-bottom:6px">Our door is open</div>' +
    '<div style="font-size:14px;margin-bottom:12px">Questions, prayer requests, or you just want to talk &mdash; chat with the team any time.</div>' +
    (chat ? '<a href="' + chat + '" style="display:inline-block;background:#b8964f;color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:24px">Chat with the team</a>' : 'Reply to this email to reach the team.') +
    '</div>', email, true);
  GmailApp.sendEmail(email, dayParts.length ? 'Day ' + day + ' — a reply to your covenant log' : 'A reply to what you wrote in Community Covenant',
    'Hi ' + first + ', we read what you wrote today. Open this email to see our reply, a deeper reading, and a link to chat with the team.', { htmlBody: html, name: CCX.TEAM_NAME });
  ccxPush_([who.userId], dayParts.length ? 'We read your Day ' + day + ' log' : 'We read what you wrote', 'Your reply and a deeper reading are in your email.', ccxHome_());
  return { status: 'SENT', flag: flag, preview: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300) };
}

function ccxMemberDay_(email) {
  try {
    var v = getOrCreateUsersSheet_().getDataRange().getValues(), e = String(email).toLowerCase().trim();
    for (var i = v.length - 1; i >= 1; i--) if (String(v[i][0]).toLowerCase().trim() === e && v[i][13]) {
      var n = Math.floor((Date.now() - new Date(v[i][13]).getTime()) / 864e5) + 1; return Math.max(1, Math.min(30, n));
    }
  } catch (x) {}
  return 1;
}

function ccxParseDoc_(t) {
  var out = {}, sec = '', map = { 'WHAT I LEARNED': 'learned', 'REVELATION': 'revelation', 'IN THE WORD': 'word', 'FOUR GRATITUDES': 'grat', 'MESSAGE OF LOVE': 'msg', 'HOW ARE YOU DOING': 'how', 'MY CORNER': 'corner', 'THE WALK': 'walk', 'REMEMBERING': 'notes' };
  String(t || '').split(/\n/).forEach(function (l) {
    var L = l.trim(); if (!L) return;
    var key = Object.keys(map).filter(function (k) { return L.toUpperCase().indexOf(k) === 0; })[0];
    if (key) { sec = map[key]; return; }
    if (/^THE BODY/i.test(L)) { sec = 'body'; return; }
    if (sec) (out[sec] = out[sec] || []).push(L);
  });
  var r = {};
  if (out.learned) r.learned = out.learned.join(' ');
  if (out.revelation) r.revelation = out.revelation.join(' ');
  if (out.word) { var rd = out.word.join(' ').replace(/^Read:\s*/i, ''); if (!/scriptures above/i.test(rd)) r.bibleReading = rd; }
  if (out.grat) r.gratitudes = out.grat.map(function (g) { return g.replace(/^\d+\.\s*/, ''); });
  if (out.msg) { var to = (out.msg[0] || '').match(/Sent to:\s*(.+)/i); if (to) { r.messageTo = to[1].trim(); r.message = out.msg.slice(1).join(' ').replace(/[\u201C\u201D"]/g, ''); } }
  if (out.how) { var f = (out.how[0] || '').match(/Feeling:\s*([^\u00B7]+)/i); if (f) r.feeling = f[1].trim(); if (out.how.length > 1) r.wellbeingNote = out.how.slice(1).join(' '); }
  if (out.corner) r.cornerNote = out.corner.join(' ');
  if (out.notes) r.notes = out.notes.join(' ');
  if (out.walk && /\u2714|yes/i.test(out.walk.join(' '))) r.didWalk = 'Yes';
  return r;
}
function ccxTemplateBody_(dayParts, tabParts, questions, day) {
  var p = [];
  if (dayParts.length) {
    var d = dayParts[dayParts.length - 1].data;
    p.push('Thank you for sealing Day ' + day + (d.theme ? ' — ' + d.theme : '') + '. Showing up, day after day, is the covenant. We see you.');
  } else p.push('Thank you for the time you spent in Community Covenant today. We read every word.');
  dayParts.forEach(function (o) {
    var x = o.data;
    if (/yes/i.test(String(x.didWalk || '')) || x.walkTime) p.push('You walked' + (x.walkTime ? ' ' + x.walkTime : '') + (x.companion ? ' with ' + x.companion : '') + (x.location ? ' at ' + x.location : '') + '. Moving your body and praying as you go is worship too.');
    if (!x.bibleReading && x.learned) p.push('What you learned today \u2014 \u201C' + String(x.learned).slice(0, 220) + '\u201D \u2014 is worth carrying into tomorrow.');
    if (x.bibleReading) p.push('You read ' + x.bibleReading + '.' + (x.learned ? ' What you took from it — “' + String(x.learned).slice(0, 220) + '” — is worth carrying into tomorrow.' : ''));
    if (x.revelation) p.push('Your revelation today: “' + String(x.revelation).slice(0, 220) + '”. Write it somewhere you will see it again this week.');
    var g = (x.gratitudes || []).filter(function (y) { return y; });
    if (g.length) { var q = g.map(function (y) { return '“' + String(y).slice(0, 80) + '”'; }); p.push('You gave thanks for ' + (q.length > 1 ? q.slice(0, -1).join(', ') + ' and ' + q[q.length - 1] : q[0]) + '. A grateful heart is a guarded heart.'); }
    if (x.messageTo && x.message) p.push('The love you sent to ' + x.messageTo + ' matters more than you know. Words like that are how families get knit back together.');
  });
  var NOTE = { 'Seek First': 'putting God first', 'Daily Altar': 'your time at the altar', 'My Workbook': 'your workbook' };
  tabParts.forEach(function (o) {
    var items = (o.data || []).filter(function (it) { return !/\?\s*$/.test(it.text); }).slice(0, 3);
    if (!items.length) return;
    p.push('In ' + o.source + ' you wrote ' + items.map(function (it) { return '“' + it.text.slice(0, 160) + '”'; }).join(', ') + '. Thank you for being honest about ' + (NOTE[o.source] || 'what you are working on') + ' — that is how growth happens.');
  });
  if (questions.length) p.push('You asked: ' + questions.map(function (q) { return '“' + q + '”'; }).join(' ') + ' A person on our team saw your question and will answer you personally — or tap the chat button below and we can talk it through.');
  return p.map(function (s) { return '<p>' + ccxEsc_(s) + '</p>'; }).join('');
}

function ccxAiReply_(who, dayParts, tabParts, reading, questions) {
  var logs = dayParts.map(function (o) {
    var x = o.data, c = { day: o.day }; ['theme', 'checkinType', 'didWalk', 'walkTime', 'companion', 'location', 'bibleReading', 'learned', 'revelation', 'messageTo', 'message', 'gratitudes', 'notes', 'feeling', 'fastStuck', 'wellbeingNote', 'cornerNote', 'cornerShare', 'fasting', 'dailyFocus', 'docText'].forEach(function (k) { if (x[k]) c[k] = x[k]; });
    return c;
  });
  var tabs = {}; tabParts.forEach(function (o) { tabs[o.source] = (tabs[o.source] || []).concat(o.data || []); });
  var sys = CCX_VOICE +
    'Write the same-day reply to a member about EVERYTHING they wrote in the app today: their Day Page log and anything they typed in other tabs (Seek First, Daily Altar, My Workbook). ' +
    'Respond to each tab they wrote in, naming their specifics. Answer EVERY question they asked, fully, with Scripture backing (book chapter:verse, KJV). ' +
    'Length: 3 to 5 short paragraphs, about 250 to 420 words in total — finish every sentence. ' +
    'If anything suggests self-harm, suicide, abuse, or danger, put yes in <concern>. ' +
    'Today\'s deeper reading is ' + reading.ref + '; in <reflection> write 2 sentences, speaking to them as \"you\", connecting it to what they shared. ' +
    'The message to the member goes in <reply>.';
  return ccxClaude_(sys, 'Member first name: ' + ccxFirst_(who.name) + '\nAge group: ' + (who.age || 'unknown') + '\nReligion: ' + (who.religion || 'unknown') +
    '\nQuestions found: ' + JSON.stringify(questions) + '\nDay Page logs today: ' + JSON.stringify(logs).slice(0, 9000) + '\nOther tabs today: ' + JSON.stringify(tabs).slice(0, 6000), 1400);
}

/* ---------- Ask for Help: a real, Scripture-backed answer in the app ---------- */
function askCovenant(question, email, name, userId) {
  var x = ccxSession_(arguments), a = x.args, s = x.s;
  question = String(a[0] || '').trim().slice(0, 1500); email = String(a[1] || '').toLowerCase().trim(); name = String(a[2] || ''); userId = String(a[3] || '');
  if (!question) return { success: false };
  var crisis = ccxHasCrisis_(question);
  if (crisis) return { success: false, crisis: true }; // the app shows 988 + logs CRISIS itself
  if (!ccxProp_('ANTHROPIC_API_KEY')) return { success: false, reason: 'no-ai' };
  var who = (s && s.e) ? s.e : ('anon:' + (email || 'x'));
  if (cvpCount_('ccxask:' + who, 3600) > 30 || cvpCount_('ccxask:all:' + ccxToday_(), 86400) > 1500) return { success: false, reason: 'busy' };
  var prof = (s && s.e) ? (_ccx_profile(s.e) || {}) : {};
  var r = ccxClaude_(CCX_VOICE +
    'A member typed a question into the app\'s "Ask for Help" box. Answer it well and directly: what the Bible says, with 2 to 5 key Scriptures (reference + short KJV quote), a plain explanation, and one practical next step. ' +
    'For word-meaning questions, give the plain meaning first, then the Scripture. 120 to 320 words total. ' +
    'If it suggests self-harm, suicide, abuse, or danger, put yes in <concern>. Put the explanation in <reply>, the key Scriptures in <scriptures>, one next step in <next>, ' +
    'and yes in <followup> when a pastor or the team should talk with them personally.',
    'Age group: ' + (prof.age || 'unknown') + '\nReligion: ' + (prof.religion || 'unknown') + '\nQuestion: ' + question, 1100);
  if (!r) return { success: false, reason: 'ai-failed' };
  if (r.concern) return { success: false, crisis: true }; // the app shows 988 and logs it as CRISIS (urgent email to you)
  var text = (r.answer || []).join('\n\n') + '\n\n' + (r.scriptures || []).map(function (q) { return q.ref + ' — ' + q.text; }).join('\n') + (r.next_step ? '\n\nNext step: ' + r.next_step : '');
  ccxLogHelpAnswer_(email || (s && s.e) || '', name + (s ? '' : ' (not signed in — identity not confirmed)'), userId, question, r.follow_up ? 'AI-ANSWERED + FOLLOW UP' : 'AI-ANSWERED', text);
  if (r.follow_up) GmailApp.sendEmail(GMAIL_ADDRESS, 'Covenant — Ask for Help question may need a personal follow-up', (name || 'A member') + ' (' + (email || 'no email') + ') asked: "' + question + '"\n\nThe app answered:\n\n' + text + '\n\nTeam desk: ' + ccxSite_() + 'team.html');
  return { success: true, answer: r.answer || [], scriptures: r.scriptures || [], next_step: r.next_step || '', follow_up: !!r.follow_up };
}

function ccxHelpSheet_() {
  return ccxSheet_('Covenant — Help Questions', ['Timestamp', 'Name', 'Email', 'UserId', 'Question', 'Status', 'Responded By', 'Response Sent']);
}
function ccxLogHelpAnswer_(email, name, userId, question, status, answer) {
  ccxHelpSheet_().appendRow([new Date(), name || '', email || '', userId || '', question, status, 'Covenant AI', String(answer).slice(0, 45000)]);
}

/** Older questions the app could not answer (like ones sent before AI was on): answer them by email. */
function ccxAnswerHelpBacklog_() {
  if (!ccxProp_('ANTHROPIC_API_KEY')) return 0;
  var sh = ccxHelpSheet_(), v = sh.getDataRange().getValues(), n = 0, cutoff = Date.now() - 30 * 864e5;
  for (var i = 1; i < v.length && n < 5; i++) {
    if (String(v[i][5]) !== 'UNANSWERED') continue;
    var email = String(v[i][2] || '').toLowerCase().trim(), nm = String(v[i][1] || '');
    var t = v[i][0] instanceof Date ? v[i][0].getTime() : 0;
    if (!/@/.test(email) || /not signed in/i.test(nm) || t < cutoff) { sh.getRange(i + 1, 6).setValue('UNANSWERED (team only)'); continue; }
    if (ccxHasCrisis_(v[i][4])) { sh.getRange(i + 1, 6).setValue('CRISIS'); continue; }
    var prof = _ccx_profile(email) || {};
    var r = ccxClaude_(CCX_VOICE + 'A member asked this in the app and has been waiting for an answer. Answer it well: what the Bible says, 2 to 5 key Scriptures (reference + short KJV quote), plain explanation, one practical next step; 150 to 350 words. ' +
      'If it suggests danger, put yes in <concern>. Explanation in <reply>, Scriptures in <scriptures>, one next step in <next>.',
      'Age group: ' + (prof.age || 'unknown') + '\nReligion: ' + (prof.religion || 'unknown') + '\nQuestion: ' + v[i][4], 1100);
    if (!r) break;
    if (r.concern) { sh.getRange(i + 1, 6).setValue('NEEDS A PERSON'); GmailApp.sendEmail(GMAIL_ADDRESS, 'Covenant — a waiting question needs a person', nm + ' (' + email + ') asked: "' + v[i][4] + '"'); continue; }
    var first = ccxFirst_(nm.replace(/\s*\(.*$/, ''));
    var html = ccxFrame_('An answer to your question',
      '<p>Hi ' + ccxEsc_(first) + ',</p><p>You asked in Community Covenant: <i>&ldquo;' + ccxEsc_(v[i][4]) + '&rdquo;</i> Thank you for waiting &mdash; here is what Scripture says.</p>' +
      (r.answer || []).map(function (p) { return '<p>' + ccxEsc_(p) + '</p>'; }).join('') +
      '<div style="border-left:3px solid #b8964f;padding:4px 0 4px 16px;margin:18px 0">' + (r.scriptures || []).map(function (q) { return '<p style="margin:6px 0"><b>' + ccxEsc_(q.ref) + '</b> &mdash; <i>' + ccxEsc_(q.text) + '</i></p>'; }).join('') + '</div>' +
      (r.next_step ? '<p><b>Next step:</b> ' + ccxEsc_(r.next_step) + '</p>' : '') +
      (ccxSite_() ? ccxButton_(ccxSite_() + 'chat.html', 'Talk it through with the team') : ''), email, true);
    GmailApp.sendEmail(email, 'An answer to your question — Community Covenant', 'Open this email to read the answer to your question.', { htmlBody: html, name: CCX.TEAM_NAME });
    sh.getRange(i + 1, 6, 1, 3).setValues([['AI-ANSWERED (emailed)', 'Covenant AI', ((r.answer || []).join('\n\n')).slice(0, 45000)]]);
    n++;
  }
  return n;
}

function ccxExecUrl_() {
  var u = ''; try { u = ScriptApp.getService().getUrl() || ''; } catch (x) {}
  if (!u || /\/dev$/.test(u)) u = ccxProp_('EXEC_URL') || 'https://script.google.com/macros/s/AKfycbzgI4aUh2ICbJQqFVHXkuKOJv6TFIx_aZMqGOV_7uc3ZKigfoilvN27kFRzRhixYzkLUQ/exec';
  return u;
}
function ccxButton_(href, label) {
  return '<p style="text-align:center;margin:22px 0"><a href="' + href + '" style="display:inline-block;background:#372b4e;color:#fff;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:24px">' + label + '</a></p>';
}

/** Email shell: header, body, sign-off, ADA disclosure, opt-out. */
function ccxFrame_(title, inner, email, allowOptOut) {
  var opt = '';
  try { if (allowOptOut) opt = ccxExecUrl_() + '?optout=' + encodeURIComponent(email) + '&sig=' + ccxSig_(email); } catch (x) {}
  return '<div style="background:#faf6ee;padding:24px 12px;font-family:Georgia,serif;color:#3a3352">' +
    '<div style="max-width:560px;margin:0 auto;background:#fffdf7;border:1px solid #e7ddc9;border-radius:14px;overflow:hidden">' +
    '<div style="background:#372b4e;color:#faf6ee;padding:18px 24px"><div style="font:600 11px Arial;letter-spacing:3px;text-transform:uppercase;color:#c9a961">Community Covenant</div>' +
    '<div style="font:600 22px Georgia;margin-top:4px">' + title + '</div></div>' +
    '<div style="padding:20px 24px;font-size:16px;line-height:1.6">' + inner +
    '<p style="margin-top:22px">Woven together with you,<br><b>' + CCX.TEAM_NAME + '</b><br><span style="color:#777;font-size:13px">Colossians 2:2</span></p></div>' +
    '<div style="padding:14px 24px;background:#f1e9d9;font:12px/1.5 Arial;color:#6b6280">' +
    'This reply was prepared with an AI writing assistant on behalf of Ciarne Cyars and the Community Covenant team, as an accommodation for visual and cognitive gaps under the Americans with Disabilities Act (42 U.S.C. &sect;12101 et seq.). ' +
    'Daily replies go out automatically so you hear back the same day; Ciarne reviews this reply program and remains fully responsible for every message it sends. ' +
    'If anything here is wrong or unclear, please tell us in writing (reply to this email or use team chat) so we can correct it in writing. ' +
    'What you share in Community Covenant is kept private to you and our care team and is never sold. This is spiritual encouragement, not medical, legal, or mental-health care; in an emergency call 911, or call or text 988.' +
    (opt ? '<br><a style="color:#6b6280" href="' + opt + '">Stop daily reply emails</a>' : '') + '</div></div></div>';
}

/* ======================= 4. Team chat ==================================== */
/** Member sends a message. Signed-in members are verified; visitors may still write. */
function chatSend(email, name, userId, message) {
  var x = ccxSession_(arguments), a = x.args, s = x.s;
  email = String(a[0] || '').toLowerCase().trim(); name = String(a[1] || ''); userId = String(a[2] || ''); message = String(a[3] || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { success: false, message: 'Please enter your email so the team can answer you.' };
  if (!message) return { success: false, message: 'Type a message first.' };
  if (message.length > 4000) message = message.slice(0, 4000);
  if (cvpCount_('ccxchat:' + email, 600) > 15) return { success: false, message: 'You have sent a lot of messages — the team will catch up. Try again in a few minutes.' };
  var signed = !!(s && s.e === email);
  var crisis = ccxHasCrisis_(message);
  var sh = ccxChatSheet_();
  sh.appendRow([new Date(), email, name, userId, 'member', message, signed ? 'yes' : 'no (identity not confirmed)', crisis ? 'URGENT' : 'NEW']);
  if (crisis) {
    sh.appendRow([new Date(), email, CCX.TEAM_NAME, userId, 'team', 'We are so glad you told us. You are not alone. Please call or text 988 right now (Suicide & Crisis Lifeline, free, any time), or text HOME to 741741. If you are in danger, call 911. A person from our team is being alerted right now and will reach out to you.', 'auto', 'SENT']);
    GmailApp.sendEmail(GMAIL_ADDRESS, 'URGENT — Covenant team chat: member may be in crisis', name + ' (' + email + ', ' + (signed ? 'signed in' : 'NOT signed in') + ') wrote:\n\n' + message + '\n\nThey were shown 988 and Crisis Text Line. Please reach out personally now.\n\n' + ccxSite_() + 'team.html');
  } else if (cvpCount_('ccxchatalert:' + email, 600) === 1) {
    GmailApp.sendEmail(GMAIL_ADDRESS, 'Covenant team chat — new message from ' + (name || email), (name || '') + ' (' + email + ', ' + (signed ? 'signed in' : 'not signed in') + ') wrote:\n\n' + message + '\n\nAnswer here: ' + ccxSite_() + 'team.html');
  }
  return { success: true, crisis: !!crisis, signedIn: signed };
}

/** Member reads their own thread (must be signed in — keeps chats private). */
function chatGet(email) {
  var x = ccxSession_(arguments), s = x.s; email = String(x.args[0] || '').toLowerCase().trim();
  if (!s || s.e !== email) return { success: false, signedIn: false, messages: [] };
  return { success: true, signedIn: true, messages: ccxThread_(email) };
}

function ccxThread_(email) {
  var v = ccxChatSheet_().getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) if (String(v[i][1]).toLowerCase().trim() === email)
    out.push({ at: v[i][0] instanceof Date ? v[i][0].toISOString() : String(v[i][0]), from: v[i][4], name: v[i][2], text: v[i][5] });
  return out.slice(-200);
}

function ccxTeamOk_(pin) {
  var p = ccxProp_('TEAM_PIN');
  if (!p || p.length < 6) throw new Error('Team page is not set up yet (TEAM_PIN script property).');
  if (cvpPeek_('ccxpin') >= 20) throw new Error('Too many tries. Wait 15 minutes.');
  if (String(pin || '') !== p) { cvpCount_('ccxpin', 900); throw new Error('Wrong team code.'); }
}

function teamThreads(pin) {
  ccxTeamOk_(pin);
  var v = ccxChatSheet_().getDataRange().getValues(), t = {};
  for (var i = 1; i < v.length; i++) {
    var em = String(v[i][1]).toLowerCase().trim(); if (!em) continue;
    var r = t[em] || (t[em] = { email: em, name: '', last: '', lastAt: '', open: 0, urgent: false, signed: false });
    if (v[i][4] === 'member') { r.name = v[i][2] || r.name; if (/^yes/.test(v[i][6])) r.signed = true; if (v[i][7] === 'NEW' || v[i][7] === 'URGENT') r.open++; if (v[i][7] === 'URGENT') r.urgent = true; }
    r.last = String(v[i][5]).slice(0, 140); r.lastAt = v[i][0] instanceof Date ? v[i][0].toISOString() : String(v[i][0]);
  }
  var list = Object.keys(t).map(function (k) { return t[k]; });
  list.sort(function (a, b) { return (b.urgent - a.urgent) || (b.open - a.open) || (b.lastAt > a.lastAt ? 1 : -1); });
  // Also surface held daily logs that still need a person.
  var held = [], rv = ccxReplySheet_().getDataRange().getValues();
  for (var j = 1; j < rv.length; j++) if (String(rv[j][8]) === 'HELD') held.push({ email: rv[j][1], name: rv[j][2], day: rv[j][4], flag: rv[j][9], at: rv[j][0] instanceof Date ? rv[j][0].toISOString() : String(rv[j][0]) });
  return { success: true, threads: list, held: held.slice(-50) };
}

function teamThread(pin, email) { ccxTeamOk_(pin); return { success: true, messages: ccxThread_(String(email).toLowerCase().trim()) }; }

function teamReply(pin, email, message, teamName) {
  ccxTeamOk_(pin);
  email = String(email || '').toLowerCase().trim(); message = String(message || '').trim();
  if (!email || !message) return { success: false, message: 'Pick a conversation and type a reply.' };
  var who = String(teamName || '').trim() || CCX.TEAM_NAME;
  var sh = ccxChatSheet_(), v = sh.getDataRange().getValues(), uid = '', name = '';
  for (var i = 1; i < v.length; i++) if (String(v[i][1]).toLowerCase().trim() === email) {
    if (v[i][4] === 'member') { uid = v[i][3] || uid; name = v[i][2] || name; if (v[i][7] === 'NEW' || v[i][7] === 'URGENT') sh.getRange(i + 1, 8).setValue('ANSWERED'); }
  }
  sh.appendRow([new Date(), email, who, uid, 'team', message, 'team', 'SENT']);
  var chat = ccxSite_() + 'chat.html';
  GmailApp.sendEmail(email, 'The Community Covenant team answered you', who + ' wrote:\n\n' + message + '\n\nKeep the conversation going: ' + chat, {
    name: CCX.TEAM_NAME,
    htmlBody: ccxFrame_('A message from the team', '<p>Hi ' + ccxEsc_(ccxFirst_(name)) + ',</p><p style="white-space:pre-wrap">' + ccxEsc_(message) + '</p><p style="color:#777">&mdash; ' + ccxEsc_(who) + '</p>' + ccxButton_(chat, 'Reply in team chat'), email, false)
  });
  ccxPush_([uid], 'The team answered you', message.slice(0, 120), chat);
  return { success: true };
}

/** Mark a held daily log as handled once a person has reached out. */
function teamMarkDone(pin, email) {
  ccxTeamOk_(pin);
  var sh = ccxReplySheet_(), v = sh.getDataRange().getValues(), n = 0;
  for (var i = 1; i < v.length; i++) if (String(v[i][1]).toLowerCase().trim() === String(email).toLowerCase().trim() && String(v[i][8]) === 'HELD') { sh.getRange(i + 1, 9).setValue('HANDLED BY TEAM'); n++; }
  return { success: true, updated: n };
}

/* ======================= 5. Push notifications =========================== */
function ccxPush_(userIds, title, message, url) {
  var app = ccxProp_('ONESIGNAL_APP_ID'), key = ccxProp_('ONESIGNAL_REST_KEY');
  if (!app || !key) return false;
  var body = { app_id: app, headings: { en: title }, contents: { en: message } };
  if (url) body.url = url;
  if (userIds && userIds.length) { var ids = userIds.filter(function (u) { return u; }).map(String); if (!ids.length) return false; body.include_aliases = { external_id: ids }; body.target_channel = 'push'; }
  else body.included_segments = ['Total Subscriptions'];
  try {
    var r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Key ' + key }, payload: JSON.stringify(body) });
    return r.getResponseCode() < 300;
  } catch (x) { Logger.log('push: ' + x); return false; }
}
function covenantMorningPush(e) { return ccxPush_(null, 'Your covenant is waiting', 'Today’s scripture is ready. Keep pushing one more day.', ccxHome_()); }
function covenantEveningPush(e) { return ccxPush_(null, 'Have you sealed today?', 'A few minutes with your log — the team replies the same day.', ccxHome_()); }


/** Called by the app right after a member saves: answers their writing immediately. */
function replyNow(email) {
  var x = ccxSession_(arguments), s = x.s; email = String(x.args[0] || '').toLowerCase().trim();
  if (!s || s.e !== email) return { success: false };
  if (cvpCount_('ccxnow:' + email, 600) > 12) return { success: false, message: 'busy' };
  var was = CVP.trusted; CVP.trusted = true;
  try { return { success: true, result: ccxProcess_({ onlyEmail: email, now: true }) }; } finally { CVP.trusted = was; }
}

/** Owner-only: queue everything members wrote earlier today (before replies were switched on) and answer it. */
function covenantBackfillToday() {
  var today = ccxToday_(), users = getOrCreateUsersSheet_().getDataRange().getValues(), queued = 0, seen = {};
  var rs = ccxReplySheet_(), rv = rs.getDataRange().getValues(), have = {};
  for (var r = 1; r < rv.length; r++) have[String(rv[r][1]).toLowerCase() + '|' + rv[r][13] + '|' + rv[r][4] + '|' + ccxRowDate_(rv[r][12])] = 1;
  for (var i = 1; i < users.length; i++) {
    var email = String(users[i][0] || '').toLowerCase().trim(), name = String(users[i][2] || ''), uid = String(users[i][3] || '');
    if (!email || seen[email]) continue; seen[email] = 1;
    var folder = null; try { folder = getUserFolder_(uid, email, name); } catch (x) {}
    if (!folder) continue;
    try {
      var it = folder.getFilesByName('Entries');
      if (it.hasNext()) {
        var ev = SpreadsheetApp.openById(it.next().getId()).getActiveSheet().getDataRange().getValues();
        for (var j = 1; j < ev.length; j++) {
          var ts = ev[j][0] instanceof Date ? ev[j][0] : new Date(ev[j][0]);
          if (isNaN(ts) || Utilities.formatDate(ts, 'America/New_York', 'yyyy-MM-dd') !== today) continue;
          var day = ev[j][5], key = email + '|Day Page|' + day + '|' + today;
          if (have[key]) continue;
          var txt = ''; try { if (/^http/.test(String(ev[j][8]))) txt = DocumentApp.openByUrl(String(ev[j][8])).getBody().getText().slice(0, 8000); } catch (x) {}
          rs.appendRow([new Date(), email, name, uid, day, ev[j][7] || '', '', JSON.stringify({ name: name, theme: ev[j][7] || '', docText: txt }), 'QUEUED', 'backfill', '', '', today, 'Day Page', new Date(0), '[]']);
          have[key] = 1; queued++;
        }
      }
    } catch (x) { Logger.log('backfill entries ' + email + ': ' + x); }
    [['seek-first.json', 'Seek First'], ['daily-altar.json', 'Daily Altar']].forEach(function (f) {
      try {
        var fi = folder.getFilesByName(f[0]); if (!fi.hasNext()) return;
        var data = JSON.parse(fi.next().getBlob().getDataAsString() || '{}')[today];
        var items = data ? ccxLabelText_(f[1], data) : [];
        if (items.length) { ccxQueueText_(email, name, uid, f[1], items); queued++; }
      } catch (x) { Logger.log('backfill ' + f[1] + ' ' + email + ': ' + x); }
    });
  }
  var res = ccxProcess_({ now: true });
  return 'Backfill queued ' + queued + '; ' + res;
}

/** Owner-only: preview the AI reply for today's newest Day Page log, WITHOUT emailing anyone. */
function covenantPreviewReply() {
  var v = ccxReplySheet_().getDataRange().getValues(), d = null, row = null;
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][13]) === 'Day Page') { try { d = JSON.parse(v[i][7]); row = v[i]; } catch (x) {} break; }
  if (!d) return 'No Day Page log found to preview.';
  if (d.docText) { var pd = ccxParas_ && ccxParseDoc_(d.docText); Object.keys(pd).forEach(function (k) { if (!d[k]) d[k] = pd[k]; }); }
  var prof = _ccx_profile(row[1]) || {};
  var who = { email: row[1], name: row[2] || prof.name, userId: row[3], age: prof.age, religion: prof.religion };
  var reading = CCX_DEEPER[((Number(row[4]) || 1) - 1) % CCX_DEEPER.length];
  var ai = ccxAiReply_(who, [{ source: 'Day Page', data: d, day: row[4] }], [], reading, ccxQuestions_(d));
  var msg = ai ? ('AI REPLY PREVIEW (not sent):\n\n' + (ai.paragraphs || []).join('\n\n') + '\n\nReflection: ' + (ai.reflection || '')) : 'AI reply failed — see log lines above.';
  Logger.log(msg); return msg;
}

/** Owner-only: today's replies that went out as the basic (non-AI) version get answered again with full AI replies. */
function covenantResendToday() {
  var sh = ccxReplySheet_(), v = sh.getDataRange().getValues(), today = ccxToday_(), n = 0;
  for (var i = 1; i < v.length; i++) {
    if (ccxRowDate_(v[i][12]) !== today || String(v[i][8]) !== 'SENT' || (/^AI/.test(String(v[i][9])) && !(CCX.resendOwner && String(v[i][1]).toLowerCase() === CVP.OWNER))) continue;
    var answered = []; try { answered = JSON.parse(v[i][15] || '[]'); } catch (x) {}
    var wrote = String(v[i][7]);
    if (Array.isArray(answered) && answered.length && wrote.charAt(0) !== '[') wrote = JSON.stringify(answered);
    sh.getRange(i + 1, 8, 1, 9).setValues([[wrote, 'QUEUED', 'resend (AI)', '', '', today, v[i][13], new Date(0), '[]']]);
    n++;
  }
  return 'Re-queued ' + n + '; ' + ccxProcess_({ now: true, ignoreCap: true });
}

/** Owner-only test: re-answer YOUR OWN entries from today with a fresh AI reply (ignores the daily limit). */
function covenantResendMine() { CCX.resendOwner = true; try { return covenantResendToday(); } finally { CCX.resendOwner = false; } }

/* ======================= setup =========================================== */
function installCovenantConnect() {
  var want = { covenantReplySweep: 1, covenantMorningPush: 1, covenantEveningPush: 1 };
  ScriptApp.getProjectTriggers().forEach(function (t) { if (want[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('covenantReplySweep').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('covenantMorningPush').timeBased().atHour(8).nearMinute(5).everyDays(1).inTimezone('America/New_York').create();
  ScriptApp.newTrigger('covenantEveningPush').timeBased().atHour(19).nearMinute(5).everyDays(1).inTimezone('America/New_York').create();
  ccxReplySheet_(); ccxChatSheet_(); ccxSecret_();
  return 'Covenant Connect ' + CCX.VERSION + ' installed: replies every 5 min (and right away after each save), push 8am/7pm (push only sends once OneSignal keys are set).';
}
// Owner-only: these cannot be called from a web page, only from the editor (EDITOR_RUN_UNTIL) or your own timers.
installCovenantConnect = cvpOwner_(installCovenantConnect, 'installCovenantConnect');
covenantReplySweep = cvpOwner_(covenantReplySweep, 'covenantReplySweep');
covenantBackfillToday = cvpOwner_(covenantBackfillToday, 'covenantBackfillToday');
covenantAiTest = cvpOwner_(covenantAiTest, 'covenantAiTest');
covenantPreviewReply = cvpOwner_(covenantPreviewReply, 'covenantPreviewReply');
covenantResendToday = cvpOwner_(covenantResendToday, 'covenantResendToday');
covenantResendMine = cvpOwner_(covenantResendMine, 'covenantResendMine');
covenantMorningPush = cvpOwner_(covenantMorningPush, 'covenantMorningPush');
covenantEveningPush = cvpOwner_(covenantEveningPush, 'covenantEveningPush');

/* ======================= reading + encouragement banks =================== */
var CCX_DEEPER = [
  { ref: 'Genesis 9:16', read: 'Genesis 9:8-17', text: 'And the bow shall be in the cloud; and I will look upon it, that I may remember the everlasting covenant between God and every living creature.', reflect: 'God put the covenant where He would see it. He does not forget His promises — not to the earth, and not to you.', practice: 'Write one promise of God on a card and put it where you will see it every morning this week.' },
  { ref: 'Ephesians 6:2-3', read: 'Ephesians 6:1-4', text: 'Honour thy father and mother; which is the first commandment with promise; That it may be well with thee.', reflect: 'Honor is not the same as agreeing. It is choosing respect, even where there is hurt, and leaving the judging to God.', practice: 'Do one quiet act of honor today for a parent or elder — a call, a meal, a kind word.' },
  { ref: 'Isaiah 58:6', read: 'Isaiah 58:6-12', text: 'Is not this the fast that I have chosen? to loose the bands of wickedness, to undo the heavy burdens, and to let the oppressed go free.', reflect: 'The fast God chooses is not only about food. It loosens what binds us and makes us repairers of broken places.', practice: 'Name one broken relationship and pray for that person by name, without asking God to fix them first.' },
  { ref: 'Colossians 3:13-14', read: 'Colossians 3:12-17', text: 'Forbearing one another, and forgiving one another... And above all these things put on charity, which is the bond of perfectness.', reflect: 'Unity is put on like clothing — a daily choice. Love is what holds every other virtue together.', practice: 'Before bed, forgive one small thing from today out loud to God.' },
  { ref: 'Matthew 17:20-21', read: 'Matthew 17:14-21', text: 'If ye have faith as a grain of mustard seed... nothing shall be impossible unto you. Howbeit this kind goeth not out but by prayer and fasting.', reflect: 'Some breakthroughs wait on prayer and fasting. Small faith, planted and kept, still moves mountains.', practice: 'Pick one mountain in your life and pray about it at the same hour every day this week.' },
  { ref: 'Isaiah 40:29', read: 'Isaiah 40:25-31', text: 'He giveth power to the faint; and to them that have no might he increaseth strength.', reflect: 'Strength from God is given most to the ones who admit they are faint. Tired is not disqualified.', practice: 'When you feel weak today, stop and breathe this verse three times before you push on.' },
  { ref: 'Matthew 11:28-29', read: 'Matthew 11:25-30', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', reflect: 'Rest is an invitation, not a reward for finishing. Jesus offers it in the middle of the work.', practice: 'Take ten minutes today with no phone, no task — just sit with God.' },
  { ref: 'Psalm 103:1-2', read: 'Psalm 103:1-14', text: 'Bless the LORD, O my soul: and all that is within me, bless his holy name... and forget not all his benefits.', reflect: 'Gratitude is remembering on purpose. The soul forgets unless we tell it what God has done.', practice: 'List five benefits God has given you this year and read them aloud.' },
  { ref: 'Luke 10:36-37', read: 'Luke 10:25-37', text: 'Which now of these three, thinkest thou, was neighbour unto him that fell among the thieves? ... Go, and do thou likewise.', reflect: 'Jesus turns the question around: not "who is my neighbor?" but "will I be one?"', practice: 'Do one unasked kindness for someone outside your usual circle today.' },
  { ref: 'Proverbs 4:7', read: 'Proverbs 4:1-13', text: 'Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.', reflect: 'Wisdom is something we go and get — by asking, listening and reading. It does not arrive by accident.', practice: 'Ask an elder you trust one question about life and write down the answer.' },
  { ref: 'Hebrews 8:10', read: 'Hebrews 8:6-13', text: 'I will put my laws into their mind, and write them in their hearts: and I will be to them a God, and they shall be to me a people.', reflect: 'The new covenant is written on the heart. Daily time in the Word is how the writing deepens.', practice: 'Memorize one verse from this covenant and say it before each meal today.' },
  { ref: 'Ruth 1:16', read: 'Ruth 1:6-18', text: 'Whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God.', reflect: 'Ruth honored Naomi by staying. Sometimes honor looks like simply not leaving.', practice: 'Tell someone in your family, in writing, that you are staying with them through this season.' },
  { ref: '2 Corinthians 5:18', read: '2 Corinthians 5:17-21', text: 'And all things are of God, who hath reconciled us to himself by Jesus Christ, and hath given to us the ministry of reconciliation.', reflect: 'We were given a ministry: carrying reconciliation to others because we have received it ourselves.', practice: 'Send a short, no-pressure message to someone you have drifted from.' },
  { ref: 'Ecclesiastes 4:12', read: 'Ecclesiastes 4:9-12', text: 'And if one prevail against him, two shall withstand him; and a threefold cord is not quickly broken.', reflect: 'A cord with God woven in is not quickly broken. Unity is strength you cannot make alone.', practice: 'Pray with one other person today, even for one minute on the phone.' },
  { ref: 'Daniel 10:12', read: 'Daniel 10:1-14', text: 'From the first day that thou didst set thine heart to understand, and to chasten thyself before thy God, thy words were heard.', reflect: 'Daniel\'s answer was sent the first day he prayed. Delay is not denial.', practice: 'Write down what you are fasting for and date it — you will want to remember the day God answered.' },
  { ref: 'Philippians 4:13', read: 'Philippians 4:10-13', text: 'I can do all things through Christ which strengtheneth me.', reflect: 'Paul learned this in hunger and in plenty. Christ\'s strength is for contentment as much as conquest.', practice: 'Name one hard thing you will do today and tell Christ you are doing it in His strength.' },
  { ref: 'Psalm 23:1-3', read: 'Psalm 23', text: 'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.', reflect: 'Sometimes the Shepherd makes us lie down. Restoration is His work, not our performance.', practice: 'Read Psalm 23 slowly tonight and stop on the line that speaks to you.' },
  { ref: 'Psalm 100:4', read: 'Psalm 100', text: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.', reflect: 'Thanksgiving is the gate. We come into God\'s presence the moment we start thanking Him.', practice: 'Begin your next prayer with thanks only — no requests for the first minute.' },
  { ref: 'Romans 12:10', read: 'Romans 12:9-21', text: 'Be kindly affectioned one to another with brotherly love; in honour preferring one another.', reflect: 'Love that prefers others is a quiet strength — it lets someone else go first.', practice: 'Let someone else have the better portion, the better seat, or the last word today.' },
  { ref: 'James 3:17', read: 'James 3:13-18', text: 'But the wisdom that is from above is first pure, then peaceable, gentle, and easy to be intreated, full of mercy and good fruits.', reflect: 'Heavenly wisdom is gentle and open to correction. It shows in how we treat people.', practice: 'In your next disagreement, listen fully before you answer.' },
  { ref: 'Jeremiah 31:33', read: 'Jeremiah 31:31-34', text: 'I will put my law in their inward parts, and write it in their hearts; and will be their God, and they shall be my people.', reflect: 'God wants a people who belong to Him from the inside out. The covenant is relationship.', practice: 'Tell God plainly, in your own words, "I am Yours" — and mean it today.' },
  { ref: 'Proverbs 31:28', read: 'Proverbs 31:25-31', text: 'Her children arise up, and call her blessed; her husband also, and he praiseth her.', reflect: 'Honor spoken out loud builds a home. Blessing someone with words is a gift that lasts.', practice: 'Speak a specific blessing over someone in your home today.' },
  { ref: 'Matthew 5:23-24', read: 'Matthew 5:21-26', text: 'Leave there thy gift before the altar, and go thy way; first be reconciled to thy brother, and then come and offer thy gift.', reflect: 'God puts reconciliation ahead of offerings. Peace with people is part of worship.', practice: 'Before you give or serve this week, settle one thing that is unsettled with someone.' },
  { ref: 'John 17:21', read: 'John 17:20-26', text: 'That they all may be one; as thou, Father, art in me, and I in thee, that they also may be one in us.', reflect: 'Jesus prayed for our unity the night before the cross. He prayed for you by name in that prayer.', practice: 'Pray for the unity of your family and church by name tonight.' },
  { ref: 'Esther 4:16', read: 'Esther 4:10-17', text: 'Go, gather together all the Jews... and fast ye for me, and neither eat nor drink three days... and if I perish, I perish.', reflect: 'Esther did not fast alone; she gathered her people. Shared fasting carries courage.', practice: 'Ask one person to fast or pray with you for the same need this week.' },
  { ref: '2 Corinthians 12:9', read: '2 Corinthians 12:7-10', text: 'My grace is sufficient for thee: for my strength is made perfect in weakness.', reflect: 'The weak places are where God\'s strength shows most clearly. You do not have to hide them from Him.', practice: 'Tell God one weakness honestly, then thank Him that His grace covers it.' },
  { ref: 'Hebrews 4:9-10', read: 'Hebrews 4:1-11', text: 'There remaineth therefore a rest to the people of God. For he that is entered into his rest, he also hath ceased from his own works.', reflect: 'Rest is a place we enter by trusting God with what we cannot finish.', practice: 'Write down one worry, pray over it, and leave the paper closed until morning.' },
  { ref: 'Colossians 3:15', read: 'Colossians 3:15-17', text: 'And let the peace of God rule in your hearts, to the which also ye are called in one body; and be ye thankful.', reflect: 'Peace and thankfulness travel together. A thankful heart lets peace be the referee.', practice: 'When you feel anxious today, name three things you are thankful for right then.' },
  { ref: '1 John 4:20-21', read: '1 John 4:7-21', text: 'He that loveth not his brother whom he hath seen, how can he love God whom he hath not seen?', reflect: 'Loving God shows up in how we love the people we can see. The two cannot be separated.', practice: 'Show love to the hardest person to love in your life today, in one small way.' },
  { ref: 'Proverbs 3:5-6', read: 'Proverbs 3:1-12', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.', reflect: 'The end of the covenant is trust. Keep acknowledging Him, and He keeps directing.', practice: 'Write a letter to yourself about what God did these 30 days, and keep it.' }
];

var CCX_ENCOURAGE = [
  'You are not alone. Keep pushing one more day.',
  'What you did today counts, even if it felt small.',
  'Don’t give up in God — He has not given up on you.',
  'Every log is a stitch in something God is weaving.',
  'Rest if you must, but do not quit. We are walking this with you.',
  'Your faithfulness today is a seed for someone else’s tomorrow.',
  'The covenant is kept one day at a time. Today is kept.'
];
