/******************************************************************************
 * COVENANT FAMILY v1.0 (2026-11-20) — ADDITIVE. Nothing else is edited:
 * this file adds its own names to CCX.BRIDGE when it loads (it must stay the
 * LAST file in the Apps Script project, after CovenantConnect.gs).
 *
 * A family code links relatives' covenants. Members choose what to share
 * (one tap: "Share with my family"); nothing is shared automatically.
 *  famCreate / famJoin / famLeave  — make a family (faith or everyday wording), join with a code
 *  famHome                          — family, members' progress, feed, map pins, family streak
 *  famShare                         — post a day / walk / testimony to the family feed
 *  famReact                         — cheer a post (one reaction per member per post)
 * Location: only what the member shares, rounded to about 1 km (2 decimals).
 * Sheets (in the Covenant root folder): Covenant — Families, Covenant — Family
 * Members, Covenant — Family Feed.
 ******************************************************************************/

var CCF = {
  FAM: 'Covenant — Families', MEM: 'Covenant — Family Members', FEED: 'Covenant — Family Feed',
  TYPES: { day: 1, walk: 1, testimony: 1, altar: 1, milestone: 1 },
  REACT: { amen: 1, heart: 1, fire: 1, clap: 1, pray: 1 }
};
if (typeof CCX !== 'undefined' && CCX.BRIDGE) ['famCreate', 'famJoin', 'famLeave', 'famHome', 'famShare', 'famReact'].forEach(function (n) { if (CCX.BRIDGE.indexOf(n) === -1) CCX.BRIDGE.push(n); });

function ccfFam_() { return ccxSheet_(CCF.FAM, ['Code', 'Name', 'Mode', 'Owner', 'Created']); }
function ccfMem_() { return ccxSheet_(CCF.MEM, ['Code', 'Email', 'Name', 'Joined', 'Day', 'Of', 'LastShare']); }
function ccfFeed_() { return ccxSheet_(CCF.FEED, ['Id', 'Code', 'When', 'Email', 'Name', 'Type', 'Day', 'Of', 'Text', 'Lat', 'Lng', 'Area', 'Thumb', 'Bits', 'Reactions']); }
function ccfClean_(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').slice(0, n || 500); }
function ccfFirst_(name) { return String(name || '').split(' ')[0] || 'Member'; }

function ccfMyRow_(email) {
  var v = ccfMem_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][1]).toLowerCase() === email) return { row: i + 1, code: String(v[i][0]), v: v[i] };
  return null;
}
function ccfFamily_(code) {
  var v = ccfFam_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === code) return { code: code, name: String(v[i][1]), mode: String(v[i][2] || 'faith'), owner: String(v[i][3]) };
  return null;
}
function ccfNewCode_() {
  var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', taken = {}, v = ccfFam_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) taken[v[i][0]] = 1;
  for (var t = 0; t < 50; t++) {
    var c = 'FAM-'; for (var k = 0; k < 5; k++) c += A.charAt(Math.floor(Math.random() * A.length));
    if (!taken[c]) return c;
  }
  throw new Error('Try again');
}

/** Create a family. mode: 'faith' or 'everyday'. Leaves any family the member was in. */
function famCreate(email, name, mode, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false, message: 'Please sign in again.' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var mine = ccfMyRow_(u.email); if (mine) ccfMem_().deleteRow(mine.row);
    var code = ccfNewCode_(), fam = ccfClean_(name, 60) || (ccfFirst_(u.name) + "'s family");
    ccfFam_().appendRow([code, fam, mode === 'everyday' ? 'everyday' : 'faith', u.email, new Date()]);
    ccfMem_().appendRow([code, u.email, u.name, new Date(), '', '', '']);
    return { success: true, code: code };
  } finally { lock.releaseLock(); }
}

/** Join a family with its code. */
function famJoin(email, code, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false, message: 'Please sign in again.' };
  code = String(code || '').toUpperCase().replace(/\s+/g, ''); if (code && code.indexOf('FAM-') !== 0) code = 'FAM-' + code.replace(/^FAM/, '');
  if (cvpCount_('ccfjoin:' + u.email, 3600) > 20) return { success: false, message: 'Too many tries. Wait a little and try again.' };
  var f = ccfFamily_(code); if (!f) return { success: false, message: 'That family code was not found. Check the letters and try again.' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var mine = ccfMyRow_(u.email); if (mine) ccfMem_().deleteRow(mine.row);
    ccfMem_().appendRow([code, u.email, u.name, new Date(), '', '', '']);
  } finally { lock.releaseLock(); }
  return { success: true, code: code, name: f.name };
}

function famLeave(email, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false };
  var mine = ccfMyRow_(u.email); if (mine) ccfMem_().deleteRow(mine.row);
  return { success: true };
}

/** Everything the Family screen needs. */
function famHome(email, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false, message: 'Please sign in again.' };
  var mine = ccfMyRow_(u.email); if (!mine) return { success: true, family: null };
  var fam = ccfFamily_(mine.code); if (!fam) return { success: true, family: null };
  var mv = ccfMem_().getDataRange().getValues(), members = [];
  for (var i = 1; i < mv.length; i++) if (String(mv[i][0]) === fam.code)
    members.push({ me: String(mv[i][1]).toLowerCase() === u.email, name: ccfFirst_(mv[i][2]), day: +mv[i][4] || 0, of: +mv[i][5] || 30,
      last: mv[i][6] ? new Date(mv[i][6]).getTime() : 0 });
  var fv = ccfFeed_().getDataRange().getValues(), feed = [], days = {}, tz = Session.getScriptTimeZone();
  for (var j = fv.length - 1; j >= 1; j--) {
    if (String(fv[j][1]) !== fam.code) continue;
    var when = new Date(fv[j][2]); days[Utilities.formatDate(when, tz, 'yyyy-MM-dd')] = 1;
    if (feed.length >= 60) continue;
    var re = {}; try { re = JSON.parse(fv[j][14] || '{}'); } catch (x) {}
    var counts = {}, mineR = '';
    Object.keys(re).forEach(function (em) { counts[re[em]] = (counts[re[em]] || 0) + 1; if (em === u.email) mineR = re[em]; });
    var bits = {}; try { bits = JSON.parse(fv[j][13] || '{}'); } catch (x) {}
    feed.push({ id: String(fv[j][0]), when: when.getTime(), name: ccfFirst_(fv[j][4]), me: String(fv[j][3]).toLowerCase() === u.email, type: String(fv[j][5]),
      day: +fv[j][6] || 0, of: +fv[j][7] || 0, text: String(fv[j][8] || ''), lat: fv[j][9] === '' ? null : +fv[j][9], lng: fv[j][10] === '' ? null : +fv[j][10],
      area: String(fv[j][11] || ''), thumb: String(fv[j][12] || ''), bits: bits, reactions: counts, mine: mineR });
  }
  var streak = 0, d = new Date();
  if (!days[Utilities.formatDate(d, tz, 'yyyy-MM-dd')]) d = new Date(d.getTime() - 864e5); // today not shared yet: count from yesterday
  while (days[Utilities.formatDate(d, tz, 'yyyy-MM-dd')]) { streak++; d = new Date(d.getTime() - 864e5); }
  return { success: true, family: fam, members: members, feed: feed, familyStreak: streak };
}

/** Share to the family. json = {type, day, of, text, lat, lng, area, thumb, bits} */
function famShare(email, json, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false, message: 'Please sign in again.' };
  var mine = ccfMyRow_(u.email); if (!mine) return { success: false, message: 'Join or start a family first.' };
  if (cvpCount_('ccfshare:' + u.email, 3600) > 40) return { success: false, message: 'Slow down a little and try again soon.' };
  var p; try { p = JSON.parse(String(json || '{}')); } catch (x) { return { success: false }; }
  var type = CCF.TYPES[p.type] ? p.type : 'day';
  var lat = '', lng = '';
  if (isFinite(+p.lat) && isFinite(+p.lng) && p.lat !== null && p.lat !== '' && p.lng !== null && p.lng !== '') { lat = Math.round(+p.lat * 100) / 100; lng = Math.round(+p.lng * 100) / 100; }
  var thumb = String(p.thumb || ''); if (!/^data:image\/(jpeg|png|webp);base64,/.test(thumb) || thumb.length > 45000) thumb = '';
  var bits = {}; Object.keys(p.bits || {}).slice(0, 12).forEach(function (k) { if (/^[\w-]{1,20}$/.test(k)) bits[k] = ccfClean_(p.bits[k], 300); });
  var id = Utilities.getUuid().slice(0, 13), day = Math.max(0, Math.min(400, +p.day || 0)), of = Math.max(0, Math.min(400, +p.of || 30));
  ccfFeed_().appendRow([id, mine.code, new Date(), u.email, u.name, type, day, of, ccfClean_(p.text, 1500), lat, lng, ccfClean_(p.area, 60), thumb, JSON.stringify(bits), '{}']);
  var ms = ccfMem_(); if (day) { ms.getRange(mine.row, 5, 1, 2).setValues([[day, of]]); } ms.getRange(mine.row, 7).setValue(new Date());
  return { success: true, id: id };
}

/** One reaction per member per post; same reaction again removes it. */
function famReact(email, id, kind, tok) {
  var u = ccpUser_(email, tok); if (!u) return { success: false };
  if (!CCF.REACT[kind]) return { success: false };
  var mine = ccfMyRow_(u.email); if (!mine) return { success: false };
  var sh = ccfFeed_(), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id) && String(v[i][1]) === mine.code) {
    var re = {}; try { re = JSON.parse(v[i][14] || '{}'); } catch (x) {}
    if (re[u.email] === kind) delete re[u.email]; else re[u.email] = kind;
    sh.getRange(i + 1, 15).setValue(JSON.stringify(re));
    return { success: true };
  }
  return { success: false };
}
