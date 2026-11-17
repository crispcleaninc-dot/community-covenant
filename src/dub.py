"""Dubbed version of an episode: python3 dub.py ep1|ep2 es|fr|pt|zh|hi|sw [tts|time|cta|render|final|all]"""
import json, os, sys, shutil, subprocess, re
EP, LANG = sys.argv[1], sys.argv[2]; STEP = sys.argv[3] if len(sys.argv) > 3 else 'all'
SRC = {'ep1': '/home/claude/ad2', 'ep2': '/home/claude/ep2'}[EP]
D = f'/home/claude/dub/{EP}_{LANG}'; os.makedirs(D, exist_ok=True); os.chdir(D)
TR = json.load(open('/home/claude/dub/tr.json'))[LANG][EP]
BASE = json.load(open(f'{SRC}/lines.json'))
# lines: [role, speed, spoken, caption]
L = [[b[0], b[1], (t if isinstance(t, str) else t[0]), (t if isinstance(t, str) else t[1])] for b, t in zip(BASE, TR)]
json.dump(L, open('lines.json', 'w'), ensure_ascii=False, indent=0)

LABEL = {'es': 'D R A M A T I Z A C I Ó N', 'fr': 'D R A M A T I S A T I O N', 'pt': 'D R A M A T I Z A Ç Ã O',
         'zh': '情 景 再 现', 'hi': 'नाट्य रूपांतरण', 'sw': 'I G I Z O'}[LANG]
FONT_FILE = {'zh': '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 'hi': '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'}.get(LANG)
CAPFONT = {'zh': 'Noto Sans CJK SC Black', 'hi': 'Poppins'}.get(LANG, 'Inter ExtraBold')
CAPSIZE = {'zh': 84, 'hi': 76}.get(LANG, 78)

def setup():
    for f in os.listdir(SRC):
        if f.startswith('ins_') and f.endswith('.png') and not os.path.exists(f): os.symlink(f'{SRC}/{f}', f)
    if not os.path.exists('img'): os.symlink(f'{SRC}/img', 'img')
    r = open(f'{SRC}/render.py').read().replace("'D R A M A T I Z A T I O N'", repr(LABEL))
    if FONT_FILE: r = r.replace("lab_font = ImageFont.truetype(", f"lab_font = ImageFont.truetype({FONT_FILE!r}, 28) if True else ImageFont.truetype(", 1)
    open('render.py', 'w').write(r)

def tts():
    import soundfile as sf
    if LANG == 'sw':
        for i, l in enumerate(L):
            src = f'/home/claude/dub/sw_out/{EP}_l{i}s.wav' if l[0] == 'p' else f'/home/claude/dub/sw_f/{EP}_l{i}.wav'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
                            '-ar', '24000', '-ac', '1', f'l{i}.wav'], check=True)
            print(i, round(sf.info(f'l{i}.wav').duration, 2))
        return
    from kokoro_onnx import Kokoro
    k = Kokoro("/home/claude/kok/kokoro-v1.0.onnx", "/home/claude/kok/voices-v1.0.bin")
    VO = {'es': {'m': 'ef_dora', 'd': 'ef_dora', 'n': 'ef_dora', 'p': 'em_alex'},
          'fr': {'m': 'ff_siwis', 'd': 'ff_siwis', 'n': 'ff_siwis', 'p': 'ff_siwis'},
          'pt': {'m': 'pf_dora', 'd': 'pf_dora', 'n': 'pf_dora', 'p': 'pm_alex'},
          'hi': {'m': 'hf_alpha', 'd': 'hf_alpha', 'n': 'hf_beta', 'p': 'hm_omega'},
          'zh': {'m': 'zf_xiaoxiao', 'd': 'zf_xiaoxiao', 'n': 'zf_xiaobei', 'p': 'zm_yunjian'}}[LANG]
    code = {'es': 'es', 'fr': 'fr-fr', 'pt': 'pt-br', 'hi': 'hi', 'zh': 'cmn'}[LANG]
    g2p = None
    if LANG == 'zh':
        from misaki import zh; g2p = zh.ZHG2P()
    for i, (v, sp, text, _) in enumerate(L):
        speed = {'p': 0.85}.get(v, 0.95 if LANG != 'zh' else 0.9)
        if EP == 'ep2' and v == 'm': speed -= 0.04
        if g2p:
            ph = g2p(text); ph = ph[0] if isinstance(ph, tuple) else ph
            a, sr = k.create(ph, voice=VO[v], speed=speed, lang=code, is_phonemes=True)
        else: a, sr = k.create(text, voice=VO[v], speed=speed, lang=code)
        sf.write(f'l{i}.wav', a, sr); print(i, round(len(a) / sr, 2), flush=True)

def timing():
    src = open(f'{SRC}/timing.py').read().split('def ts(x)')[0]
    src = src.replace("L = json.load(open('lines.json'))", "L = json.load(open('lines.json'))")
    exec(compile(src, 'timing', 'exec'), G := {})
    starts, durs, total = G['starts'], G['durs'], G['total']
    def ts(x): return f'{int(x//3600)}:{int(x%3600//60):02d}:{x%60:05.2f}'
    hdr = open('/home/claude/ad/caps.ass').read().split('[Events]')[0]
    hdr = hdr.replace('Inter ExtraBold,82', f'{CAPFONT},{CAPSIZE}') + '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
    ev = []; EV = []; cjk = LANG == 'zh'
    for i, (v, sp, _, text) in enumerate(L):
        if cjk:  # tokens: latin words or single CJK chars (punctuation glued to previous)
            toks = []
            for m in re.finditer(r'[A-Za-z]+|\s+|.', text):
                s = m.group(0)
                if s.isspace(): continue
                if toks and re.fullmatch(r'[，。、：；？！“”（）…,.!?:;"]', s): toks[-1] += s
                else: toks.append(s)
            wt = [len(x) * 0.6 + 1 if re.match(r'[A-Za-z]', x) else 1 + (1.5 if re.search(r'[，。？！：；]$', x) else 0) for x in toks]
        else:
            toks = text.split(); wt = [len(re.sub(r'[^\w]', '', x)) + 2 + (4 if re.search(r'[.,;!?:»।]$', x) else 0) for x in toks]
        st = starts[i] + 0.12; dur = durs[i] - 0.3; tot = sum(wt); times = []; acc = st
        for kk in wt: times.append(acc); acc += dur * kk / tot
        times.append(st + dur)
        chunks = []; cur = []; mx = 7 if cjk else 3
        for kk, x in enumerate(toks):
            cur.append(kk)
            if len(cur) >= mx or re.search(r'[.,;!?:»।，。？！：；]["”»]?$', x): chunks.append(cur); cur = []
        if cur: chunks.append(cur)
        col = '&H66D9F1&' if v != 'p' else '&HF7C9E0&'; sep = '' if cjk else ' '
        up = (lambda s: s.upper()) if LANG in ('es', 'fr', 'pt', 'sw') else (lambda s: s)
        for ch in chunks:
            for kk in ch:
                s = times[kk]; e = times[kk + 1] + (0.3 if kk == len(toks) - 1 else 0)
                parts = [('{\\c' + col + '}' + up(toks[q]) + '{\\c&HFFFFFF&}') if q == kk else up(toks[q]) for q in ch]
                ev.append(f'Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,' + sep.join(parts))
                EV.append([s, e, [[up(toks[q]), q == kk] for q in ch], v == 'p'])
    open('caps.ass', 'w').write(hdr + '\n'.join(ev) + '\n'); json.dump(EV, open('caps.json', 'w'), ensure_ascii=False)
    print('total', round(total, 2))

CTA = {'es': ('Escrituras leídas para ti &middot; música gospel<br>oración diaria &middot; un equipo que te responde', 'Empieza hoy &rarr;', 'Cualquier teléfono. Toca el enlace para abrir.', ''),
       'fr': ('Les Écritures lues pour toi &middot; musique gospel<br>prière chaque jour &middot; une équipe qui te répond', 'Commence aujourd&rsquo;hui &rarr;', 'Tout téléphone. Touche le lien pour ouvrir.', ''),
       'pt': ('Escrituras lidas para você &middot; música gospel<br>oração diária &middot; uma equipe que te responde', 'Comece hoje &rarr;', 'Qualquer celular. Toque no link para abrir.', ''),
       'zh': ('为你朗读经文 &middot; 福音音乐<br>每日祷告 &middot; 有团队给你回信', '今天就开始 &rarr;', '任何手机都能用。点击链接打开。', '社区圣约'),
       'hi': ('आपके लिए पढ़ा गया वचन &middot; गॉस्पेल संगीत<br>रोज़ की प्रार्थना &middot; एक टीम जो जवाब देती है', 'आज ही शुरू करें &rarr;', 'किसी भी फ़ोन पर। खोलने के लिए लिंक पर टैप करें।', ''),
       'sw': ('Maandiko yanasomwa kwa ajili yako &middot; muziki wa injili<br>maombi ya kila siku &middot; timu inayokujibu', 'Anza leo &rarr;', 'Simu yoyote. Gusa kiungo kufungua.', '')}
def cta():
    sub, btn, foot, alt = CTA[LANG]
    h = open('/home/claude/ad2/cta.html').read()
    h = h.replace('Scripture read over you &middot; gospel music<br>daily prayer &middot; a team that writes you back', sub)
    h = h.replace('Start today &rarr;', btn).replace('Any phone. Tap the link to open.', foot)
    if alt: h = h.replace('Covenant</div>', f'Covenant<div style="font:700 60px \'Noto Sans CJK SC\';color:#f1d999;margin-top:18px">{alt}</div></div>', 1)
    fam = {'zh': "'Noto Sans CJK SC'", 'hi': 'Poppins'}.get(LANG)
    if fam: h = h.replace('font-family:Inter', f'font-family:Inter,{fam}').replace(' Inter;', f' Inter,{fam};').replace(' Inter"', f' Inter,{fam}"')
    open('cta.html', 'w').write(h)
    open('cta.js', 'w').write("const { chromium } = require('playwright'); (async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });"
        f" await p.goto('file://{D}/cta.html'); await p.waitForTimeout(400); await p.screenshot({{ path: '{D}/cta.png', omitBackground: true }}); await b.close(); }})();")
    subprocess.run(['node', 'cta.js'], check=True)

def render():
    subprocess.run(['python3', 'render.py', 'all'], check=True)

def burn_pil(src, dst):
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    EV = json.load(open('caps.json')); W, H, FPS = 1080, 1920, 30
    font = ImageFont.truetype('/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf', CAPSIZE, layout_engine=ImageFont.Layout.RAQM)
    cache = {}
    def layer(i):
        if i in cache: return cache[i]
        s, e, parts, pr = EV[i]; L = Image.new('RGBA', (W, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
        sp = d.textlength(' ', font=font); ws = [d.textlength(t, font=font) for t, _ in parts]; tot = sum(ws) + sp * (len(ws) - 1)
        x = (W - tot) / 2; hl = (224, 201, 247) if pr else (241, 217, 102)
        for (t, h), w in zip(parts, ws):
            d.text((x + 3, 133), t, font=font, fill=(0, 0, 0, 150), anchor='ls', stroke_width=6, stroke_fill=(0, 0, 0, 150))
            d.text((x, 130), t, font=font, fill=hl if h else (255, 255, 255), anchor='ls', stroke_width=6, stroke_fill=(30, 12, 24))
            x += w + sp
        cache.clear(); cache[i] = L; return L
    rd = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    wr = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
    n = 0; j = 0
    while True:
        b = rd.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        t = n / FPS; n += 1
        while j < len(EV) and EV[j][1] <= t: j += 1
        if j < len(EV) and EV[j][0] <= t:
            im = Image.frombytes('RGB', (W, H), b).convert('RGBA'); im.alpha_composite(layer(j), (0, H - 190 - 170)); b = im.convert('RGB').tobytes()
        wr.stdin.write(b)
    wr.stdin.close(); assert wr.wait() == 0

def final():
    T = json.load(open('timing.json')); n = len(T['scenes'])
    open('list.txt', 'w').write(''.join(f"file 'sc{i}.mp4'\n" for i in range(n)))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'video.mp4'], check=True)
    out = f'/home/claude/dub/out/{EP}_{LANG}.mp4'; os.makedirs('/home/claude/dub/out', exist_ok=True)
    vf = ['-vf', 'ass=caps.ass:fontsdir=/usr/share/fonts']
    if LANG == 'hi': burn_pil('video.mp4', 'video_c.mp4'); vin = 'video_c.mp4'; vf = []
    else: vin = 'video.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vin, '-i', 'mix.wav', '-map', '0:v', '-map', '1:a', *vf, '-c:v', 'libx264', '-crf', '24', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
                    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out + '.tmp.mp4'], check=True)
    os.replace(out + '.tmp.mp4', out); print('done', out, round(os.path.getsize(out) / 1e6, 1), 'MB')

steps = {'setup': [setup], 'tts': [setup, tts], 'time': [timing], 'cta': [cta], 'render': [render], 'final': [final],
         'all': [setup, tts, timing, cta, render, final], 'pre': [setup, tts, timing, cta]}[STEP]
for f in steps: f()
