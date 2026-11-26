"""Builds the small share pages and preview cards (Nov 26 2026).
s/r<N>.html and s/k-<id>.html: a tiny page with Open Graph tags so a texted or posted link shows the
plum-and-gold Community Covenant card, then opens the app on that reel or skit (app/?reel=N / app/?skit=id).
s/c/r<N>.jpg and s/c/k-<id>.jpg: the 1200x630 preview cards.
Run: node tools/share_data.js && python3 tools/make_share.py"""
import json, os, html, textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
SITE = 'https://crispcleaninc-dot.github.io/community-covenant/'
D = json.load(open(os.path.join(os.path.dirname(__file__), 'share_data.json')))
os.makedirs(os.path.join(ROOT, 's', 'c'), exist_ok=True)
GF = '/usr/share/fonts/truetype/google-fonts/'
SER = GF + 'Lora-Variable.ttf'; SERI = GF + 'Lora-Italic-Variable.ttf'; SANS = GF + 'Poppins-Bold.ttf'
PLUM, PLUM2, GOLD, CREAM = (42, 32, 64), (61, 43, 86), (241, 217, 153), (244, 236, 220)

def font(p, s):
    f = ImageFont.truetype(p, s)
    try: f.set_variation_by_axes([600] if 'Variable' in p else [])
    except Exception: pass
    return f

def fit(d, text, path, size, width, max_lines):
    while size > 18:
        f = font(path, size); chars = max(8, int(width / (size * 0.52)))
        lines = textwrap.wrap(text, chars)
        if len(lines) <= max_lines and all(d.textlength(l, font=f) <= width for l in lines): return f, lines
        size -= 2
    f = font(path, size); return f, textwrap.wrap(text, int(width / (size * 0.52)))[:max_lines]

def card(out, kicker, hook, verse, ref, foot):
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), PLUM); d = ImageDraw.Draw(im)
    for y in range(H):  # soft plum gradient like the app's verse card
        t = y / H; c = tuple(int(PLUM2[k] * (1 - t) + PLUM[k] * t) for k in range(3)); d.line([(0, y), (W, y)], fill=c)
    d.rectangle([40, 40, W - 40, H - 40], outline=(120, 100, 150), width=2)
    d.text((80, 78), kicker.upper(), font=font(SANS, 22), fill=GOLD)
    d.line([(80, 116), (230, 116)], fill=GOLD, width=3)
    f, lines = fit(d, hook, SER, 62, W - 160, 3); y = 140
    for l in lines: d.text((80, y), l, font=f, fill=CREAM); y += int(f.size * 1.22)
    if verse:
        y += 14; fv, vl = fit(d, '“' + verse + '”', SERI, 30, W - 160, 4)
        for l in vl: d.text((80, y), l, font=fv, fill=(225, 214, 240)); y += int(fv.size * 1.3)
        if ref: d.text((80, y + 6), ref + ' (KJV)', font=font(SANS, 22), fill=GOLD)
    d.text((80, H - 108), foot, font=font(SANS, 22), fill=GOLD)
    d.text((80, H - 78), 'Tap to open in the Community Covenant app', font=font(SANS, 18), fill=(210, 200, 225))
    im.save(out, 'JPEG', quality=80, optimize=True, progressive=True)

def page(out, title, desc, img, target):
    e = html.escape
    open(out, 'w').write(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} · Community Covenant</title>
<meta name="description" content="{e(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Community Covenant">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="{SITE}{e(os.path.relpath(out, ROOT))}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{img}">
<meta http-equiv="refresh" content="0; url={e(target)}">
<style>body{{margin:0;background:#2a2040;color:#f4ecdc;font:16px/1.5 system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:20px}}a{{color:#f1d999;font-weight:700}}img{{max-width:100%;border-radius:12px}}</style>
</head><body><div><img src="{img}" alt=""><p>Opening Community Covenant&hellip; <a href="{e(target)}">Tap here if it doesn’t open</a></p></div>
<script>location.replace({json.dumps(target)});</script></body></html>''')

n = 0
for r in D['reels']:
    i = r['i']; cimg = f's/c/r{i}.jpg'
    card(os.path.join(ROOT, cimg), 'Wisdom Reels' + (' · ' + r['topic'] if r['topic'] else ''), r['hook'], r['verse'], r['ref'], 'Community Covenant · woven together with those next to you')
    page(os.path.join(ROOT, f's/r{i}.html'), r['hook'], (r['thought'] + ' — ' + r['ref'] + ' (KJV)').strip(), SITE + cimg, SITE + f'app/?reel={i}')
    n += 1
for k in D['skits']:
    cimg = f's/c/k-{k["id"]}.jpg'; v = k.get('verse') or [None, None]
    who = k['who'].split(' · ')[0] if k['who'] else ''
    foot = ('Clip by ' + who + ' · shared through Community Covenant') if k['yt'] and who else 'A Community Covenant original'
    card(os.path.join(ROOT, cimg), k['kind'] or 'Skit', k['title'], v[0], v[1], foot)
    page(os.path.join(ROOT, f's/k-{k["id"]}.html'), k['title'], (k['kind'] + (' by ' + who if who else '') + ' — watch it in the Community Covenant app').strip(), SITE + cimg, SITE + 'app/?skit=' + k['id'])
    n += 1
print('pages', n)
