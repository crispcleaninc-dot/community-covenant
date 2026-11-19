import json, os, numpy as np, soundfile as sf
from kokoro import KPipeline
L = json.load(open('gen/lines.json')); os.makedirs('out', exist_ok=True)
P = {}
for k, lc, v, sp, t in L:
    if lc not in P: P[lc] = KPipeline(lang_code=lc)
    try:
        a = np.concatenate([au for _, _, au in P[lc](t, voice=v, speed=sp)])
        sf.write(f'out/{k}.wav', a, 24000); print(k, 'ok')
    except Exception as e: print(k, 'ERR', e)
print('done')
