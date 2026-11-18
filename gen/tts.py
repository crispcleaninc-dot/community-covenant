import json, os, numpy as np, soundfile as sf
from kokoro import KPipeline
L = json.load(open('gen/lines.json')); os.makedirs('out', exist_ok=True)
pipe = KPipeline(lang_code='a')
for v, sp in [('am_onyx', 0.94), ('am_michael', 0.96)]:
    os.makedirs('out/' + v, exist_ok=True)
    for k, t in L:
        a = np.concatenate([au for _, _, au in pipe(t, voice=v, speed=sp)])
        sf.write(f'out/{v}/{k}.wav', a, 24000)
print('done')
