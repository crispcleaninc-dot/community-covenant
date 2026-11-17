/******************************************************************************
 * COVENANT PREFS & HISTORY v1.0 (2026-11-16) — ADDITIVE. Nothing else edited
 * except the 3 names added to CCX.BRIDGE in CovenantConnect.gs.
 *
 *  memberPrefsGet / memberPrefsSave — a signed-in member's likes, "Not for
 *    me" reels, reading voice, volumes and hidden songs, saved as
 *    app-prefs.json in their own folder so it follows them to any device.
 *  memberActivityLog — reels heard/loved/disliked, songs played, give-screen
 *    taps; one row per event in "Covenant — Listening History" (per member,
 *    by email).
 *  covenantTeamSummary — builds "Covenant — Team Summary" (most-loved reels,
 *    most-heard reels, Not-for-me reels, most-played songs, voices used,
 *    giving screen, by member). Runs every morning on its own.
 ******************************************************************************/

var CCP = {
  HISTORY: 'Covenant — Listening History',
  SUMMARY: 'Covenant — Team Summary',
  PREFS_FILE: 'app-prefs.json',
  TYPES: { reel: 1, like: 1, unlike: 1, dislike: 1, undislike: 1, song: 1, 'give-screen': 1, 'give-tap': 1,
    'give-continue': 1, 'give-not-today': 1, 'give-gave': 1 }
};

function ccpUser_(email, tok) {
  var s = cvpSession_(tok), e = String(email || '').toLowerCase().trim();
  if (!s || !s.e || String(s.e).toLowerCase() !== e) return null;
  var v = getOrCreateUsersSheet_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).toLowerCase().trim() === e) return { email: e, name: String(v[i][2] || ''), uid: String(v[i][3] || '') };
  return null;
}
function ccpFolder_(u) { try { return getUserFolder_(u.uid, u.email, u.name); } catch (x) { return null; } }

/** Signed-in member: their saved app settings ({ t, prefs }) or {} */
function memberPrefsGet(email, tok) {
  var u = ccpUser_(email, tok); if (!u) return {};
  var f = ccpFolder_(u), it = f && f.getFilesByName(CCP.PREFS_FILE);
  if (!it || !it.hasNext()) return {};
  try { return JSON.parse(it.next().getBlob().getDataAsString() || '{}'); } catch (x) { return {}; }
}

/** Signed-in member: save app settings. json = '{"t":123,"prefs":{key:"string",...}}' */
function memberPrefsSave(email, json, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false };
  if (cvpCount_('ccpsave:' + u.email, 3600) > 240) return { success: false, message: 'busy' };
  var raw = String(json || ''); if (raw.length > 200000) return { success: false, message: 'too big' };
  var d; try { d = JSON.parse(raw); } catch (x) { return { success: false }; }
  var clean = { t: +d.t || Date.now(), prefs: {} };
  Object.keys(d.prefs || {}).forEach(function (k) { if (/^[\w-]{1,40}$/.test(k) && typeof d.prefs[k] === 'string') clean.prefs[k] = d.prefs[k].slice(0, 60000); });
  var f = ccpFolder_(u); if (!f) return { success: false };
  var it = f.getFilesByName(CCP.PREFS_FILE), body = JSON.stringify(clean);
  if (it.hasNext()) it.next().setContent(body); else f.createFile(CCP.PREFS_FILE, body, MimeType.PLAIN_TEXT);
  return { success: true, t: clean.t };
}

function ccpHistorySheet_() {
  return ccxSheet_(CCP.HISTORY, ['When', 'Email', 'Name', 'Type', 'Item', 'Title', 'Detail']);
}

/** Signed-in member: listening history batch. json = '[[ms,type,id,title,detail],...]' */
function memberActivityLog(email, json, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false };
  if (cvpCount_('ccpact:' + u.email, 3600) > 120) return { success: false, message: 'busy' };
  var a; try { a = JSON.parse(String(json || '[]')); } catch (x) { return { success: false }; }
  if (!Array.isArray(a)) return { success: false };
  var rows = a.slice(0, 200).filter(function (r) { return Array.isArray(r) && CCP.TYPES[String(r[1])]; }).map(function (r) {
    var t = new Date(+r[0] || Date.now()); if (isNaN(t) || t > new Date(Date.now() + 864e5)) t = new Date();
    return [t, u.email, u.name, String(r[1]), String(r[2] || '').slice(0, 60), String(r[3] || '').slice(0, 140), String(r[4] || '').slice(0, 140)];
  });
  if (rows.length) {
    var sh = ccpHistorySheet_(), lock = LockService.getScriptLock();
    try { lock.waitLock(20000); sh.getRange(sh.getLastRow() + 1, 1, rows.length, 7).setValues(rows); } finally { try { lock.releaseLock(); } catch (x) {} }
  }
  ccpEnsureTrigger_();
  return { success: true, n: rows.length };
}

function ccpEnsureTrigger_() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('CCP_SUMMARY_TRIGGER')) return;
  try {
    var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'covenantTeamSummary'; });
    if (!has) ScriptApp.newTrigger('covenantTeamSummary').timeBased().atHour(6).nearMinute(10).everyDays(1).inTimezone('America/New_York').create();
    p.setProperty('CCP_SUMMARY_TRIGGER', '1');
  } catch (x) { Logger.log('summary trigger: ' + x); }
}

/** Builds the team summary. Runs every morning; run it from the editor any time to refresh it now. */
function covenantTeamSummary() { ccpBuildSummary_(); }

function ccpBuildSummary_() {
  var v = ccpHistorySheet_().getDataRange().getValues();
  var reelHeard = {}, likeState = {}, dislikeState = {}, songs = {}, voices = {}, give = {}, members = {}, titles = {}, topics = {};
  function bump(o, k, n) { o[k] = (o[k] || 0) + (n || 1); }
  for (var i = 1; i < v.length; i++) {
    var when = v[i][0], email = String(v[i][1]), name = String(v[i][2]), type = String(v[i][3]), id = String(v[i][4]), title = String(v[i][5]), det = String(v[i][6]);
    var m = members[email] || (members[email] = { name: name, reels: 0, songs: 0, likes: {}, dislikes: {}, last: when, voices: {} });
    if (when > m.last) m.last = when;
    if (title) titles[id] = title;
    if (type === 'reel') { bump(reelHeard, id); m.reels++; if (det) { bump(voices, det); bump(m.voices, det); } }
    else if (type === 'like' || type === 'unlike') { likeState[email + '|' + id] = type === 'like'; if (det) topics[id] = det; if (type === 'like') { m.likes[id] = 1; delete m.dislikes[id]; } else delete m.likes[id]; }
    else if (type === 'dislike' || type === 'undislike') { dislikeState[email + '|' + id] = type === 'dislike'; if (det) topics[id] = det; if (type === 'dislike') { m.dislikes[id] = 1; delete m.likes[id]; likeState[email + '|' + id] = false; } else delete m.dislikes[id]; }
    else if (type === 'song') { bump(songs, id + '\u0001' + title + '\u0001' + det); m.songs++; }
    else if (type.indexOf('give-') === 0) bump(give, type === 'give-screen' ? 'Giving screen shown (' + (det || id) + ')' : type === 'give-tap' ? 'Tapped Give now' : 'Closed with: ' + type.slice(5));
  }
  var liked = {}, disliked = {};
  Object.keys(likeState).forEach(function (k) { if (likeState[k]) bump(liked, k.split('|')[1]); });
  Object.keys(dislikeState).forEach(function (k) { if (dislikeState[k]) bump(disliked, k.split('|')[1]); });
  function top(o, n) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, n || 50); }
  function reelRows(o) { return top(o).map(function (id, i) { return [i + 1, titles[id] || id, topics[id] || '', o[id], id]; }); }

  var root = getRootFolder_(), it = root.getFilesByName(CCP.SUMMARY), ss;
  if (it.hasNext()) ss = SpreadsheetApp.openById(it.next().getId());
  else { ss = SpreadsheetApp.create(CCP.SUMMARY); DriveApp.getFileById(ss.getId()).moveTo(root); }
  function tab(name, header, rows) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name); sh.clear();
    var data = [header].concat(rows.length ? rows : [header.map(function (_, j) { return j ? '' : 'Nothing yet'; })]);
    sh.getRange(1, 1, data.length, header.length).setValues(data);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#372b4e').setFontColor('#ffffff');
    sh.setFrozenRows(1); try { sh.autoResizeColumns(1, header.length); } catch (x) {}
  }
  var nMembers = Object.keys(members).length, totalHeard = 0, totalSongs = 0;
  Object.keys(reelHeard).forEach(function (k) { totalHeard += reelHeard[k]; });
  Object.keys(songs).forEach(function (k) { totalSongs += songs[k]; });
  var tz = 'America/New_York';
  tab('Overview', ['Measure', 'Value'], [
    ['Updated', Utilities.formatDate(new Date(), tz, 'MMM d, yyyy h:mm a')],
    ['Members with listening history', nMembers],
    ['Reels heard (all members)', totalHeard],
    ['Songs played (all members)', totalSongs],
    ['Reels loved right now', Object.keys(liked).reduce(function (s, k) { return s + liked[k]; }, 0)],
    ['Reels marked Not for me right now', Object.keys(disliked).reduce(function (s, k) { return s + disliked[k]; }, 0)],
    ['Most-loved reel', top(liked, 1).map(function (id) { return titles[id] || id; })[0] || '—'],
    ['Most-played song', top(songs, 1).map(function (k) { var p = k.split('\u0001'); return p[1] + ' — ' + p[2]; })[0] || '—'],
    ['Most-used voice', top(voices, 1)[0] || '—'],
    ['Note', 'Counts only members who are signed in. Full event list: ' + CCP.HISTORY]
  ]);
  tab('Most Loved Reels', ['Rank', 'Reel', 'Topic', 'Members who love it', 'Reel #'], reelRows(liked));
  tab('Most Heard Reels', ['Rank', 'Reel', 'Topic', 'Times heard', 'Reel #'], reelRows(reelHeard));
  tab('Not For Me Reels', ['Rank', 'Reel', 'Topic', 'Members who moved it to the end', 'Reel #'], reelRows(disliked));
  tab('Most Played Songs', ['Rank', 'Song', 'Artist', 'Plays', 'YouTube'], top(songs).map(function (k, i) { var p = k.split('\u0001'); return [i + 1, p[1], p[2], songs[k], 'https://youtu.be/' + p[0]]; }));
  tab('Voices Used', ['Rank', 'Voice', 'Reels read in this voice'], top(voices).map(function (k, i) { return [i + 1, k, voices[k]]; }));
  tab('Giving Screen', ['What happened', 'Count'], top(give).map(function (k) { return [k, give[k]]; }));
  tab('By Member', ['Name', 'Email', 'Reels heard', 'Songs played', 'Loved', 'Not for me', 'Favorite voice', 'Last active'],
    Object.keys(members).map(function (e) { var m = members[e]; return [m.name, e, m.reels, m.songs, Object.keys(m.likes).length, Object.keys(m.dislikes).length, top(m.voices, 1)[0] || '', m.last]; })
      .sort(function (a, b) { return (b[7] instanceof Date ? b[7].getTime() : 0) - (a[7] instanceof Date ? a[7].getTime() : 0); }));
  var s1 = ss.getSheetByName('Sheet1'); if (s1 && ss.getSheets().length > 1) try { ss.deleteSheet(s1); } catch (x) {}
  ss.setActiveSheet(ss.getSheetByName('Overview')); ss.moveActiveSheet(1);
  PropertiesService.getScriptProperties().setProperty('CCP_SUMMARY_URL', ss.getUrl());
  Logger.log('Team summary: ' + ss.getUrl());
}
