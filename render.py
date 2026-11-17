"""Dubbed Holland film: python3 render.py <lang> [audio|video|all]"""
import json, os, sys, re, subprocess
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from PIL import Image, ImageDraw, ImageFont
L = sys.argv[1]; STEP = sys.argv[2] if len(sys.argv) > 2 else 'all'
H = '/home/claude/hol'; SRC = '/home/claude/more/holland.mp4'; os.chdir(H)
S = json.load(open('/home/claude/more/story.json')); T = json.load(open('/home/claude/more/tr_holland.json'))[L]
roles = [v for _, _, ls in S for v, _ in ls]
ids = [f'{sid}_l{j}' for sid, _, ls in S for j in range(len(ls))]
TIMES = json.load(open('en_times.json'))
def cap_of(x): return x if isinstance(x, str) else (x[1] or x[0])
SR = 48000; W, Hh = 1920, 1080

def load(p):
    a, r = sf.read(p, dtype='float32')
    if a.ndim > 1: a = a.mean(1)
    if r != SR: a = resample_poly(a, SR, r).astype(np.float32)
    nz = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, nz[0] - 480): nz[-1] + 2400] if len(nz) else a

def tempo(a, f):
    if f <= 1.001: return a
    sf.write('/tmp/claude-0/t_in.wav', a, SR)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/claude-0/t_in.wav', '-af', f'atempo={f:.4f}', '/tmp/claude-0/t_out.wav'], check=True)
    return sf.read('/tmp/claude-0/t_out.wav', dtype='float32')[0]

def line_wav(i):
    r = roles[i]
    if L == 'fr' and r != 'af_heart': return load(f'{H}/piper/fr_{i}.wav')
    if L == 'sw':
        p = f'{H}/piper/sw_{i}.wav'
        if r == 'af_heart':
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-af', 'asetrate=22050*1.17,aresample=22050,atempo=0.8547,rubberband=pitch=1.33:formant=preserved', '/tmp/claude-0/swf.wav'], check=True)
            p = '/tmp/claude-0/swf.wav'
        return load(p)
    return load(f'{H}/{L}/{i}.wav')

def audio():
    music, mr = sf.read(f'{H}/music.flac', dtype='float32')
    if mr != SR: music = resample_poly(music, SR, mr, axis=0).astype(np.float32)
    total = len(music) / SR; voice = np.zeros(len(music) + SR * 5, np.float32); placed = []; prev_end = 0
    for i in range(len(ids)):
        a = line_wav(i); en, _ = sf.read(f'{H}/en/{ids[i]}.wav', dtype='float32')
        rms_en = np.sqrt(np.mean(en ** 2)) + 1e-6; rms = np.sqrt(np.mean(a ** 2)) + 1e-6; a = a * (rms_en / rms) * 0.95
        st = max(TIMES[i][0], prev_end + 0.25)
        nxt = TIMES[i + 1][0] if i + 1 < len(ids) else total - 1.5
        slot = max(0.8, nxt - st - 0.2); d = len(a) / SR
        f = min(1.22, d / slot) if d > slot else 1.0
        if f > 1: a = tempo(a, f)
        j = int(st * SR); voice[j: j + len(a)] += a[: len(voice) - j]
        prev_end = st + len(a) / SR; placed.append([round(st, 3), round(len(a) / SR, 3)])
    voice = voice[: len(music)]
    mix = music + voice[:, None] if music.ndim > 1 else music + voice
    pk = np.abs(mix).max()
    if pk > 0.98: mix = mix / pk * 0.98
    sf.write(f'{H}/{L}_mix.wav', mix, SR); json.dump(placed, open(f'{H}/{L}_times.json', 'w'))
    over = [(k, p[0] + p[1]) for k, p in enumerate(placed) if k + 1 < len(placed) and p[0] + p[1] > TIMES[k + 1][0] + 0.5]
    print('audio ok; lines that ran long:', len(over), 'end', round(prev_end, 1), 'of', round(total, 1))

CJK = L == 'zh'
def events():
    placed = json.load(open(f'{H}/{L}_times.json')); EV = []
    for i, (st0, du) in enumerate(placed):
        text = cap_of(T[i])
        if CJK:
            toks = []
            for m in re.finditer(r'[A-Za-z]+|\s+|.', text):
                s = m.group(0)
                if s.isspace(): continue
                if toks and re.fullmatch(r'[，。、：；？！“”（）…,.!?:;"]', s): toks[-1] += s
                else: toks.append(s)
            wt = [len(x) * 0.6 + 1 if re.match(r'[A-Za-z]', x) else 1 + (1.5 if re.search(r'[，。？！：；]$', x) else 0) for x in toks]; mx = 14
        else:
            toks = text.split(); wt = [len(re.sub(r'[^\w]', '', x)) + 2 + (4 if re.search(r'[.,;!?:»।]$', x) else 0) for x in toks]; mx = 7
        st = st0 + 0.08; dur = du - 0.2; tot = sum(wt); times = []; acc = st
        for k in wt: times.append(acc); acc += dur * k / tot
        times.append(st + dur)
        chunks = []; cur = []
        for k, x in enumerate(toks):
            cur.append(k)
            if len(cur) >= mx or re.search(r'[.;!?:।，。？！：；]["”»]?$', x) or (len(cur) >= 4 and x.endswith(',')): chunks.append(cur); cur = []
        if cur: chunks.append(cur)
        for ch in chunks:
            for k in ch:
                e = times[k + 1] + (0.25 if k == ch[-1] else 0)
                EV.append([times[k], e, [[toks[q], q == k] for q in ch], roles[i] == 'am_fenrir'])
    EV.sort(key=lambda x: x[0])
    for n in range(len(EV) - 1): EV[n][1] = min(EV[n][1], EV[n + 1][0])
    return EV

LABEL = {'es': 'Dramatización · Imágenes generadas con IA', 'fr': 'Dramatisation · Images générées par IA', 'pt': 'Dramatização · Imagens geradas por IA',
         'zh': '情景再现 · AI 生成图像', 'hi': 'नाट्य रूपांतरण · AI से बनी तस्वीरें', 'sw': 'Igizo · Picha zimetengenezwa na AI'}[L]
FONT = {'zh': '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 'hi': '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'}.get(L, '/usr/share/fonts/opentype/inter/Inter-Bold.otf')
def overlay_png():
    im = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); g = Image.new('L', (1, Hh))
    for y in range(Hh): g.putpixel((0, y), int(min(1, max(0, (y - 820) / 200)) * 205) if y > 820 else 0)
    shade = Image.new('RGBA', (W, Hh), (8, 4, 14, 0)); shade.putalpha(g.resize((W, Hh))); im.alpha_composite(shade)
    top = Image.new('L', (1, 90)); [top.putpixel((0, y), int((1 - y / 90) * 110)) for y in range(90)]
    t2 = Image.new('RGBA', (W, 90), (8, 4, 14, 0)); t2.putalpha(top.resize((W, 90))); im.alpha_composite(t2, (0, 0))
    f = ImageFont.truetype(FONT, 24, layout_engine=ImageFont.Layout.RAQM); ImageDraw.Draw(im).text((40, 30), LABEL, font=f, fill=(241, 217, 153, 200))
    im.save(f'{H}/{L}_ov.png')

def ts(x): return f'{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}'
def video():
    overlay_png(); EV = events(); use_ass = L != 'hi'
    fc = ("[0:v]split=3[b][x][y];[x]crop=1920:200:0:880,boxblur=28:3[bb];[2:v]format=gray[mb];[bb][mb]alphamerge[band];"
          "[y]crop=640:100:0:0,boxblur=14:2[lb];[3:v]format=gray[ml];[lb][ml]alphamerge[lab];"
          '[b][band]overlay=0:880[v1];[v1][lab]overlay=0:0[v2];[v2][1:v]overlay=0:0[v3]')
    if use_ass:
        fn = {'zh': 'Noto Sans CJK SC Black'}.get(L, 'Inter ExtraBold'); fs = {'zh': 60}.get(L, 56)
        hdr = ('[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n[V4+ Styles]\n'
               'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
               f'Style: Cap,{fn},{fs},&H00FFFFFF,&H00FFFFFF,&H00180C1E,&H96000000,1,0,0,0,100,100,0,0,1,4,2,2,120,120,78,1\n\n[Events]\n'
               'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n')
        sep = '' if CJK else ' '; ev = []
        for s, e, parts, pr in EV:
            col = '&HF7C9E0&' if pr else '&H66D9F1&'
            ev.append(f'Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,' + sep.join(('{\\c' + col + '}' + t + '{\\c&HFFFFFF&}') if h else t for t, h in parts))
        open(f'{H}/{L}.ass', 'w').write(hdr + '\n'.join(ev) + '\n'); fc += f';[v3]ass={H}/{L}.ass:fontsdir=/usr/share/fonts[vo]'
    else: fc += ';[v3]null[vo]'
    tmp = f'{H}/{L}_v.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-i', f'{H}/{L}_ov.png', '-loop', '1', '-i', f'{H}/mask_band.png', '-loop', '1', '-i', f'{H}/mask_lab.png', '-filter_complex', fc, '-map', '[vo]', '-an', '-t', '452.6',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-maxrate', '2M', '-bufsize', '4M', '-pix_fmt', 'yuv420p', tmp], check=True)
    vin = tmp
    if not use_ass: burn_pil(tmp, f'{H}/{L}_vc.mp4', EV); vin = f'{H}/{L}_vc.mp4'
    out = f'/home/claude/hol/out/holland_{L}.mp4'; os.makedirs('/home/claude/hol/out', exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', vin, '-i', f'{H}/{L}_mix.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out + '.tmp.mp4'], check=True)
    os.replace(out + '.tmp.mp4', out); print('done', out, round(os.path.getsize(out) / 1e6, 1), 'MB')

def burn_pil(src, dst, EV):
    font = ImageFont.truetype(FONT, 54, layout_engine=ImageFont.Layout.RAQM); cache = {}
    def layer(i):
        if i in cache: return cache[i]
        s, e, parts, pr = EV[i]; Lr = Image.new('RGBA', (W, 140), (0, 0, 0, 0)); d = ImageDraw.Draw(Lr)
        sp = d.textlength(' ', font=font); ws = [d.textlength(t, font=font) for t, _ in parts]; x = (W - sum(ws) - sp * (len(ws) - 1)) / 2
        hl = (224, 201, 247) if pr else (241, 217, 102)
        for (t, h), w in zip(parts, ws):
            d.text((x + 2, 92), t, font=font, fill=(0, 0, 0, 150), anchor='ls', stroke_width=4, stroke_fill=(0, 0, 0, 150))
            d.text((x, 90), t, font=font, fill=hl if h else (255, 255, 255), anchor='ls', stroke_width=4, stroke_fill=(30, 12, 24)); x += w + sp
        cache.clear(); cache[i] = Lr; return Lr
    rd = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    wr = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{Hh}', '-r', '30', '-i', '-',
                           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-maxrate', '2M', '-bufsize', '4M', '-pix_fmt', 'yuv420p', dst], stdin=subprocess.PIPE)
    n = 0; j = 0; fsz = W * Hh * 3
    while True:
        b = rd.stdout.read(fsz)
        if len(b) < fsz: break
        t = n / 30; n += 1
        while j < len(EV) and EV[j][1] <= t: j += 1
        if j < len(EV) and EV[j][0] <= t:
            im = Image.frombytes('RGB', (W, Hh), b); im.paste(layer(j), (0, Hh - 78 - 120), layer(j)); b = im.tobytes()
        wr.stdin.write(b)
    wr.stdin.close(); assert wr.wait() == 0

if STEP in ('audio', 'all'): audio()
if STEP in ('video', 'all'): video()
