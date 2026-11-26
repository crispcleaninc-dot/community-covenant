// Pulls reel and skit data out of app/index.html into tools/share_data.json (used by make_share.py). Nov 26 2026.
const fs = require('fs'), path = require('path');
const L = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8').split('\n');
const idx = re => L.findIndex(l => re.test(l));
const rs = idx(/^  var R = \[\["smile"/), re = idx(/if \(CC_TOPICS\.indexOf\('Full Armor of God'\) < 0\)/);
const { R } = new Function(L.slice(rs, re + 1).join('\n') + '; return { R };')();
const os = idx(/^  var O = \[/), ae = idx(/^  var ALL = O\.concat\(V\);/);
const { O, V } = new Function('var SCENE={};' + L.slice(os, ae).join('\n') + '; return { O, V };')();
const first = {}; R.forEach((r, i) => { if (r[6] && !(r[6] in first)) first[r[6]] = i; });
fs.writeFileSync(path.join(__dirname, 'share_data.json'), JSON.stringify({
  reels: R.map((r, i) => ({ i, hook: r[1], thought: r[2], verse: r[3], ref: r[4], think: r[5], topic: r[6] || '', founder: first[r[6]] === i })),
  skits: O.concat(V).map(x => ({ id: x.id, title: x.title, kind: x.kind, who: x.who || '', yt: x.yt || '', verse: x.verse || null }))
}));
console.log('reels', R.length, 'skits', O.length + V.length);
