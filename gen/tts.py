import json, os, numpy as np, soundfile as sf
from kokoro import KPipeline
L = json.load(open('gen/lines.json')); os.makedirs('out', exist_ok=True)
pipe = KPipeline(lang_code='a')
for v, sp in [('am_adam', 0.9), ('am_eric', 0.9), ('am_liam', 0.9), ('am_echo', 0.9), ('am_puck', 0.9), ('bm_daniel', 0.9), ('am_michael', 0.88)]:
    os.makedirs('out/' + v, exist_ok=True)
    for k, t in L:
        a = np.concatenate([au for _, _, au in pipe(t, voice=v, speed=sp)])
        sf.write(f'out/{v}/{k}.wav', a, 24000)
print('done')
